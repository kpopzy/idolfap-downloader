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

// Rate limiting: IP -> { count: number, resetAt: timestamp }
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxImages = 10;
  
  const record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetAt) {
    // Reset or new window
    rateLimitStore.set(ip, { count: 0, resetAt: now + windowMs });
    return { allowed: true, remaining: maxImages, resetIn: windowMs };
  }
  
  if (record.count >= maxImages) {
    const resetIn = Math.ceil((record.resetAt - now) / 1000); // seconds
    return { allowed: false, remaining: 0, resetIn };
  }
  
  return { allowed: true, remaining: maxImages - record.count - 1, resetIn: Math.ceil((record.resetAt - now) / 1000) };
}

function incrementRateLimit(ip, imageCount = 1) {
  const record = rateLimitStore.get(ip);
  if (record) {
    record.count += imageCount;
  }
}

// Cleanup old rate limit records every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, 15 * 60 * 1000);

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

// Download all files for an idol/creator as ZIP (IP-based) - MUST be before /files/:idol/:filename
app.get('/files/download-zip/:idol', (req, res) => {
  console.log(`[ZIP] Route hit! Params:`, req.params);
  try {
    const rawIP = getClientIP(req);
    const clientIP = sanitizeIP(rawIP);
    const idolDir = path.join(downloadsDir, clientIP, req.params.idol);
    
    console.log(`[ZIP] Raw IP: ${rawIP}, Sanitized: ${clientIP}, Path: ${idolDir}`);
    
    // List available directories to help debug
    const userDownloadsDir = path.join(downloadsDir, clientIP);
    const availableDirs = fs.existsSync(userDownloadsDir) 
      ? fs.readdirSync(userDownloadsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
      : [];
    
    // If folder doesn't exist, try to find it in any IP folder (for localhost variations)
    let actualIdolDir = idolDir;
    if (!fs.existsSync(idolDir)) {
      console.log(`[ZIP] Folder not found at ${idolDir}, searching in downloads directory...`);
      if (fs.existsSync(downloadsDir)) {
        const ipDirs = fs.readdirSync(downloadsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        console.log(`[ZIP] Found IP directories: ${ipDirs.join(', ')}`);
        
        for (const ipDir of ipDirs) {
          const checkPath = path.join(downloadsDir, ipDir, req.params.idol);
          if (fs.existsSync(checkPath)) {
            console.log(`[ZIP] Found folder at: ${checkPath}`);
            actualIdolDir = checkPath;
            break;
          }
        }
      }
      
      if (!fs.existsSync(actualIdolDir)) {
        return res.status(404).json({ 
          error: 'Folder not found', 
          path: idolDir,
          searchedPath: actualIdolDir,
          rawIP: rawIP,
          sanitizedIP: clientIP,
          availableFolders: availableDirs,
          userDownloadsDir: userDownloadsDir,
          allIPDirs: fs.existsSync(downloadsDir) ? fs.readdirSync(downloadsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : []
        });
      }
    }

    // Check if directory is actually a directory and not empty
    const files = fs.readdirSync(actualIdolDir);
    if (files.length === 0) {
      return res.status(404).json({ error: 'Folder is empty' });
    }

    const zipName = `${req.params.idol}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });
    archive.pipe(res);
    archive.directory(actualIdolDir, false);
    archive.finalize();
  } catch (err) {
    console.error('ZIP download error:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Force download (IP-based) - MUST be before /files/:idol/:filename
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

// Serve files inline for preview (IP-based) - MUST be last (most general pattern)
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

app.post('/download', async (req, res) => {
  const { idol, start, end } = req.body || {};
  if (!idol || !start || !end) {
    return res.status(400).json({ error: 'idol, start, end are required' });
  }
  if (currentJob) {
    return res.status(409).json({ error: 'A download job is already running' });
  }
  
  const clientIP = sanitizeIP(getClientIP(req));
  const rateLimit = checkRateLimit(clientIP);
  if (!rateLimit.allowed) {
    const minutes = Math.floor(rateLimit.resetIn / 60);
    const seconds = rateLimit.resetIn % 60;
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: `You have reached the limit of 10 images per 10 minutes. Please try again in ${minutes}m ${seconds}s.`,
      resetIn: rateLimit.resetIn
    });
  }
  
  // Estimate images: assume ~15 images per page
  const estimatedImages = (parseInt(end) - parseInt(start) + 1) * 15;
  if (estimatedImages > rateLimit.remaining) {
    return res.status(429).json({ 
      error: 'Rate limit would be exceeded',
      message: `This request would download approximately ${estimatedImages} images, but you only have ${rateLimit.remaining} remaining in this 10-minute window.`,
      remaining: rateLimit.remaining,
      resetIn: rateLimit.resetIn
    });
  }
  
  try {
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
      // Increment rate limit by estimated count (we already checked it won't exceed)
      incrementRateLimit(clientIP, estimatedImages);
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
  
  const clientIP = sanitizeIP(getClientIP(req));
  const rateLimit = checkRateLimit(clientIP);
  if (!rateLimit.allowed) {
    const minutes = Math.floor(rateLimit.resetIn / 60);
    const seconds = rateLimit.resetIn % 60;
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: `You have reached the limit of 10 images per 10 minutes. Please try again in ${minutes}m ${seconds}s.`,
      resetIn: rateLimit.resetIn
    });
  }
  
  if (currentJob) {
    return res.status(409).json({ error: 'A download job is already running' });
  }
  
  currentJob = {
    browser: null,
    abort: { value: false },
    clientIP,
    type: 'post'
  };
  
  try {
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
    currentJob.browser = browser;
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
      if (currentJob?.abort?.value) {
        sendLog(clientIP, `[${new Date().toISOString()}] Download cancelled by user`);
        break;
      }
      
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

    // Increment rate limit with actual saved count
    incrementRateLimit(clientIP, saved.length);

    if (currentJob?.abort?.value) {
      res.status(499).json({ status: 'cancelled', idol, postUrl, savedCount: saved.length, skippedCount: skipped.length });
    } else {
      res.json({ status: 'completed', idol, postUrl, savedCount: saved.length, skippedCount: skipped.length, saved, skipped });
    }
  } catch (err) {
    if (err.message === 'Cancelled' || currentJob?.abort?.value) {
      sendLog(clientIP, `[${new Date().toISOString()}] Download cancelled: ${err.message}`);
      res.status(499).json({ status: 'cancelled', error: 'Download was cancelled' });
    } else {
      res.status(500).json({ error: err?.message || String(err) });
    }
  } finally {
    currentJob = null;
  }
});

// Download images from a creator's pages (range) into the user's IP + creator folder
app.post('/download-creator', async (req, res) => {
    console.log('/download-creator')
  const { creator, start = 1, end = 1 } = req.body || {};
  if (!creator) {
    return res.status(400).json({ error: 'creator is required' });
  }
  const startPage = Math.max(1, parseInt(start));
  const endPage = Math.max(startPage, parseInt(end));
  
  const clientIP = sanitizeIP(getClientIP(req));
  const rateLimit = checkRateLimit(clientIP);
  if (!rateLimit.allowed) {
    const minutes = Math.floor(rateLimit.resetIn / 60);
    const seconds = rateLimit.resetIn % 60;
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: `You have reached the limit of 10 images per 10 minutes. Please try again in ${minutes}m ${seconds}s.`,
      resetIn: rateLimit.resetIn
    });
  }
  
  if (currentJob) {
    return res.status(409).json({ error: 'A download job is already running' });
  }
  
  currentJob = {
    browser: null,
    abort: { value: false },
    clientIP,
    type: 'creator'
  };
  
  try {
    const targetDir = path.join(downloadsDir, clientIP, String(creator));
    fs.mkdirSync(targetDir, { recursive: true });

    const puppeteer = (await import('puppeteer')).default;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    currentJob.browser = browser;

    const page = await browser.newPage();
    await page.setViewport({ width: 1365, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    page.setDefaultNavigationTimeout(100000);

    let totalPostsProcessed = 0;
    let totalSaved = 0;
    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
      if (currentJob?.abort?.value) {
        sendLog(clientIP, `[${new Date().toISOString()}] Download cancelled by user`);
        break;
      }
      
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
        if (currentJob?.abort?.value) {
          sendLog(clientIP, `[${new Date().toISOString()}] Download cancelled by user`);
          break;
        }
        
        totalPostsProcessed++;
        const postPage = await browser.newPage();
        try {
          await postPage.goto(postLink, { timeout: 60000 });

          // First try to get images from the slider structure (EXACT match to creator.js line 57-60)
          let images = [];
          try {
            images = await postPage.$$eval(
              '.post-slider-item.open-gallery img',
              els => els.map(img => img.src)
            );
            sendLog(clientIP, `[${new Date().toISOString()}] [Post ${totalPostsProcessed}] Slider selector found ${images.length} images`);
        } catch (e) {
            sendLog(clientIP, `[${new Date().toISOString()}] [Post ${totalPostsProcessed}] Slider selector error: ${e.message}`);
          }

          // If no images found in slider, fall back to post-content links (EXACT match to creator.js line 64-67)
          if (images.length === 0) {
            try {
              images = await postPage.$$eval(
                '.post-content a',
                els => els.map(a => a.href)
              );
              sendLog(clientIP, `[${new Date().toISOString()}] [Post ${totalPostsProcessed}] Content links selector found ${images.length} links`);
            } catch (e) {
              sendLog(clientIP, `[${new Date().toISOString()}] [Post ${totalPostsProcessed}] Content links selector error: ${e.message}`);
            }
          }

          sendLog(clientIP, `[${new Date().toISOString()}] [Post ${totalPostsProcessed}] Found ${images.length} images (${creator}) on post ${totalPostsProcessed}: ${postLink}`);

          for (const imageUrl of images) {
            if (currentJob?.abort?.value) {
              sendLog(clientIP, `[${new Date().toISOString()}] Download cancelled by user`);
              break;
            }
            
            const filename = path.basename(new URL(imageUrl).pathname);
            const savePath = path.join(targetDir, filename);

            // Skip if already exists (matching creator.js)
            try {
              await fs.promises.access(savePath);
              sendLog(clientIP, `[${new Date().toISOString()}] ✓ Skipping ${filename}, already exists.`);
              continue;
            } catch {}

            sendLog(clientIP, `[${new Date().toISOString()}] Downloading (${creator}) [post ${totalPostsProcessed}] : ${imageUrl}`);
            try {
              const response = await postPage.goto(imageUrl, {
                timeout: 60000,
                waitUntil: 'networkidle2'
              });

              if (!response) {
                throw new Error('No response from image URL');
              }

              const buffer = await response.buffer();
              await fs.promises.writeFile(savePath, buffer);
              totalSaved++;
              sendLog(clientIP, `[${new Date().toISOString()}] ✓ Saved (${creator}) ${filename}`);
            } catch (err) {
              sendLog(clientIP, `[${new Date().toISOString()}] ✗ Failed ${filename}: ${err.message}`);
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
    
    // Increment rate limit with actual saved count
    incrementRateLimit(clientIP, totalSaved);
    
    if (currentJob?.abort?.value) {
      res.status(499).json({ status: 'cancelled', creator, start: startPage, end: endPage, postsProcessed: totalPostsProcessed, saved: totalSaved });
    } else {
      res.json({ status: 'completed', creator, start: startPage, end: endPage, postsProcessed: totalPostsProcessed, saved: totalSaved });
    }
  } catch (err) {
    if (err.message === 'Cancelled' || currentJob?.abort?.value) {
      sendLog(clientIP, `[${new Date().toISOString()}] Download cancelled: ${err.message}`);
      res.status(499).json({ status: 'cancelled', error: 'Download was cancelled' });
    } else {
      res.status(500).json({ error: err?.message || String(err) });
    }
  } finally {
    currentJob = null;
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}`);
});


