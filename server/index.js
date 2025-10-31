import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import axios from 'axios';
// removed pipelinePromise (no longer needed)
import { runDownload } from '../main.js';

const app = express();
const port = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const downloadsDir = path.join(__dirname, '..', 'downloads');
let currentJob = null;
// SSE clients map: ip -> Set(res)
const sseClients = new Map();

function addSseClient(ip, res) {
  if (!sseClients.has(ip)) sseClients.set(ip, new Set());
  sseClients.get(ip).add(res);
}

function removeSseClient(ip, res) {
  const set = sseClients.get(ip);
  if (set) {
    set.delete(res);
    if (set.size === 0) sseClients.delete(ip);
  }
}

function sendLog(ip, message) {
  const set = sseClients.get(ip);
  if (!set) return;
  for (const res of set) {
    try { res.write(`data: ${message}\n\n`); } catch {}
  }
}

// Get client IP address (handles proxies)
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

// Sanitize IP for folder names
function sanitizeIP(ip) {
  return ip.replace(/:/g, '-').replace(/\./g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

// Trust proxy to get real client IP
app.set('trust proxy', true);

app.use(bodyParser.json());
app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Server-Sent Events for live logs (IP-scoped)
app.get('/logs', (req, res) => {
  const ip = sanitizeIP(getClientIP(req));
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders?.();

  addSseClient(ip, res);
  // greet (only once)
  sendLog(ip, `[${new Date().toISOString()}] Connected to logs (IP ${ip})`);

  // Keepalive ping every 30 seconds to prevent timeout
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (err) {
      clearInterval(pingInterval);
      removeSseClient(ip, res);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(pingInterval);
    removeSseClient(ip, res);
    res.end();
  });

  req.on('error', () => {
    clearInterval(pingInterval);
    removeSseClient(ip, res);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(publicDir, 'gallery.html'));
});

// List all idols for current IP
app.get('/api/idols', (req, res) => {
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const userDownloadsDir = path.join(downloadsDir, clientIP);
    if (!fs.existsSync(userDownloadsDir)) {
      return res.json([]);
    }
    const idols = fs.readdirSync(userDownloadsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    res.json(idols);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// List files for an idol (IP-based) with pagination
app.get('/api/files/:idol', (req, res) => {
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const idolDir = path.join(downloadsDir, clientIP, req.params.idol);
    if (!fs.existsSync(idolDir)) {
      return res.json({ files: [], total: 0, hasMore: false });
    }
    const allFiles = fs.readdirSync(idolDir, { withFileTypes: true })
      .filter(dirent => dirent.isFile())
      .map(dirent => ({
        name: dirent.name,
        path: `/files/${req.params.idol}/${dirent.name}`,
        size: fs.statSync(path.join(idolDir, dirent.name)).size
      }))
      .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name descending
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const files = allFiles.slice(offset, offset + limit);
    const hasMore = offset + limit < allFiles.length;
    
    res.json({ files, total: allFiles.length, hasMore, offset, limit });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Serve files inline for preview (IP-based)
app.get('/files/:idol/:filename', (req, res) => {
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const filePath = path.join(downloadsDir, clientIP, req.params.idol, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Force download (IP-based)
app.get('/files/download/:idol/:filename', (req, res) => {
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const filePath = path.join(downloadsDir, clientIP, req.params.idol, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(filePath, req.params.filename);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Download all files for an idol as ZIP (IP-based)
app.get('/files/download-zip/:idol', (req, res) => {
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const idolDir = path.join(downloadsDir, clientIP, req.params.idol);
    if (!fs.existsSync(idolDir)) {
      return res.status(404).json({ error: 'Idol folder not found' });
    }

    const zipName = `${req.params.idol}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => res.status(500).end(err.message));
    archive.pipe(res);
    archive.directory(idolDir, false);
    archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.post('/download', async (req, res) => {
  const { idol, start, end } = req.body || {};
  if (!idol || !start || !end) {
    return res.status(400).json({ error: 'idol, start, end are required' });
  }
  if (currentJob) {
    return res.status(409).json({ error: 'A download job is already running' });
  }
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const userDownloadsDir = path.join(downloadsDir, clientIP);
    currentJob = {
      browser: null,
      abort: { value: false },
      clientIP
    };
    
    // Emit a header line
    sendLog(clientIP, `[${new Date().toISOString()}] Starting job idol=${idol} start=${start} end=${end} (IP: ${clientIP})`);
    
    await runDownload(
      String(idol), 
      parseInt(start), 
      parseInt(end), 
      (line) => sendLog(clientIP, line),
      (browser) => { currentJob.browser = browser; },
      () => currentJob.abort.value,
      userDownloadsDir
    );
    
    if (currentJob.abort.value) {
      sendLog(clientIP, `[${new Date().toISOString()}] Job cancelled by user`);
      res.status(499).json({ status: 'cancelled', idol, start: Number(start), end: Number(end) });
    } else {
      res.json({ status: 'completed', idol, start: Number(start), end: Number(end) });
    }
  } catch (err) {
    if (err.message === 'Cancelled' || currentJob?.abort?.value) {
      sendLog(clientIP, `[${new Date().toISOString()}] Job cancelled: ${err.message}`);
      res.status(499).json({ status: 'cancelled', error: 'Job was cancelled' });
    } else {
      res.status(500).json({ error: err?.message || String(err) });
    }
  } finally {
    currentJob = null;
  }
});

app.post('/stop', (req, res) => {
  if (!currentJob) {
    return res.json({ status: 'no_job', message: 'No active download job' });
  }
  currentJob.abort.value = true;
  if (currentJob.browser) {
    currentJob.browser.close().catch(() => {});
  }
  const clientIP = sanitizeIP(getClientIP(req));
  sendLog(clientIP, `[${new Date().toISOString()}] Stop requested by user`);
  res.json({ status: 'stopping', message: 'Download job will be stopped' });
});

// Download a single URL into the user's IP + idol folder
// (Removed) /download-url endpoint

// Download all images from a single post URL into the user's IP + idol folder
app.post('/download-post', async (req, res) => {
  const { idol, postUrl } = req.body || {};
  if (!idol || !postUrl) {
    return res.status(400).json({ error: 'idol and postUrl are required' });
  }
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const targetDir = path.join(downloadsDir, clientIP, String(idol));
    fs.mkdirSync(targetDir, { recursive: true });

    // Launch a minimal Puppeteer instance (headless, Chromium in Docker)
    const puppeteer = (await import('puppeteer')).default;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    page.setDefaultNavigationTimeout(30000);

    await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
    try { await page.waitForSelector('.post-slider-item, .post-content', { timeout: 5000 }); } catch {}

    // Collect image candidates from multiple selectors (supports lazy attrs)
    let imageCandidates = await page.$$eval(
      '.post-slider-item.open-gallery img, .post-content img, .post-content a',
      (els, baseUrl) => {
        const urls = [];
        els.forEach((el) => {
          const tag = (el.tagName || '').toUpperCase();
          if (tag === 'A') {
            const href = el.getAttribute('href') || '';
            if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(href)) {
              try {
                const abs = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                urls.push(abs);
              } catch { urls.push(href); }
            }
          } else if (tag === 'IMG') {
            const src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || '';
            if (src) {
              try {
                const abs = src.startsWith('http') ? src : new URL(src, baseUrl).href;
                urls.push(abs);
              } catch { urls.push(src); }
            }
          }
        });
        return Array.from(new Set(urls));
      },
      postUrl
    ).catch(() => []);
    imageCandidates = imageCandidates.filter(u => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(u));
    const saved = [];
    const skipped = [];
    for (const imageUrl of imageCandidates) {
      const rawName = decodeURIComponent((new URL(imageUrl)).pathname.split('/').pop() || 'file');
      let filename = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      let savePath = path.join(targetDir, filename);
      if (fs.existsSync(savePath)) {
        skipped.push(filename);
        continue;
      }
      try {
        const resp = await page.goto(imageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        if (!resp) throw new Error('No response');
        const buf = await resp.buffer();
        await fs.promises.writeFile(savePath, buf);
        saved.push(filename);
        sendLog(clientIP, `[${new Date().toISOString()}] Saved from post: ${filename}`);
      } catch (e) {
        sendLog(clientIP, `[${new Date().toISOString()}] Failed to save ${filename}: ${e.message}`);
      }
    }

    await page.close();
    await browser.close();

    return res.json({ status: 'completed', idol, postUrl, savedCount: saved.length, skippedCount: skipped.length, saved, skipped });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// Download images from a creator's pages (range) into the user's IP + creator folder
app.post('/download-creator', async (req, res) => {
  const { creator, start = 1, end = 1 } = req.body || {};
  if (!creator) {
    return res.status(400).json({ error: 'creator is required' });
  }
  const startPage = Math.max(1, parseInt(start));
  const endPage = Math.max(startPage, parseInt(end));
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const targetDir = path.join(downloadsDir, clientIP, String(creator));
    fs.mkdirSync(targetDir, { recursive: true });

    const puppeteer = (await import('puppeteer')).default;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    page.setDefaultNavigationTimeout(60000);

    let totalPostsProcessed = 0;
    let totalSaved = 0;
    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
      const pageUrl = pageNumber === 1
        ? `https://idolfap.com/creator/${encodeURIComponent(creator)}/`
        : `https://idolfap.com/creator/${encodeURIComponent(creator)}/page/${pageNumber}/`;
      sendLog(clientIP, `[${new Date().toISOString()}] [Creator ${creator}] Opening page ${pageNumber}: ${pageUrl}`);
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      } catch (navErr) {
        sendLog(clientIP, `[${new Date().toISOString()}] Failed to open page ${pageNumber}: ${navErr.message}`);
        continue;
      }

      const postLinks = await page.$$eval('body > div > main > div.grid.grid-show .post-image-wrapper > a', els => els.map(a => a.href));
      if (!postLinks || postLinks.length === 0) {
        sendLog(clientIP, `[${new Date().toISOString()}] No posts found on page ${pageNumber}.`);
        continue;
      }

      sendLog(clientIP, `[${new Date().toISOString()}] Found ${postLinks.length} posts on page ${pageNumber}`);

      for (const postLink of postLinks) {
        totalPostsProcessed++;
        const postPage = await browser.newPage();
        try {
          await postPage.goto(postLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
          try { await postPage.waitForSelector('.post-slider-item, .post-content', { timeout: 5000 }); } catch {}
          const pageUrl = postPage.url();
          let imageCandidates = await postPage.$$eval(
            '.post-slider-item.open-gallery img, .post-content img, .post-content a',
            (els, baseUrl) => {
              const urls = [];
              els.forEach((el) => {
                const tag = (el.tagName || '').toUpperCase();
                if (tag === 'A') {
                  const href = el.getAttribute('href') || '';
                  if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp|\.svg)(\?.*)?$/i.test(href)) {
                    try {
                      const abs = href.startsWith('http') ? href : new URL(href, baseUrl).href;
                      urls.push(abs);
                    } catch { urls.push(href); }
                  }
                } else if (tag === 'IMG') {
                  const src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-original') || '';
                  if (src) {
                    try {
                      const abs = src.startsWith('http') ? src : new URL(src, baseUrl).href;
                      urls.push(abs);
                    } catch { urls.push(src); }
                  }
                }
              });
              return Array.from(new Set(urls));
            },
            pageUrl
          ).catch(() => []);
          imageCandidates = imageCandidates.filter(u => /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp|\.svg)(\?.*)?$/i.test(u));
          sendLog(clientIP, `[${new Date().toISOString()}] [Post ${totalPostsProcessed}] Images: ${imageCandidates.length} - ${postLink}`);
          for (const imageUrl of imageCandidates) {
            const raw = decodeURIComponent((new URL(imageUrl)).pathname.split('/').pop() || 'file');
            const filename = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
            const savePath = path.join(targetDir, filename);
            try {
              await fs.promises.access(savePath);
              sendLog(clientIP, `[${new Date().toISOString()}] Skip exists: ${filename}`);
              continue;
            } catch {}
            try {
              const resp = await postPage.goto(imageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
              if (!resp) throw new Error('No response');
              const buf = await resp.buffer();
              await fs.promises.writeFile(savePath, buf);
              totalSaved++;
              sendLog(clientIP, `[${new Date().toISOString()}] Saved: ${filename}`);
            } catch (e) {
              sendLog(clientIP, `[${new Date().toISOString()}] Failed ${filename}: ${e.message}`);
            }
          }
        } catch (err) {
          sendLog(clientIP, `[${new Date().toISOString()}] Error processing post ${totalPostsProcessed}: ${err.message}`);
        } finally {
          await postPage.close();
        }
      }
    }

    await page.close();
    await browser.close();
    return res.json({ status: 'completed', creator, start: startPage, end: endPage, postsProcessed: totalPostsProcessed, saved: totalSaved });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}`);
});


