import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { runDownload } from '../main.js';

const app = express();
const port = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const downloadsDir = path.join(__dirname, '..', 'downloads');
const logEmitter = new EventEmitter();
let currentJob = null;

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

// Server-Sent Events for live logs
app.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const onLog = (msg) => {
    res.write(`data: ${msg}\n\n`);
  };
  logEmitter.on('log', onLog);

  req.on('close', () => {
    logEmitter.off('log', onLog);
    res.end();
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

// List files for an idol (IP-based)
app.get('/api/files/:idol', (req, res) => {
  try {
    const clientIP = sanitizeIP(getClientIP(req));
    const idolDir = path.join(downloadsDir, clientIP, req.params.idol);
    if (!fs.existsSync(idolDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(idolDir, { withFileTypes: true })
      .filter(dirent => dirent.isFile())
      .map(dirent => ({
        name: dirent.name,
        path: `/files/${req.params.idol}/${dirent.name}`,
        size: fs.statSync(path.join(idolDir, dirent.name)).size
      }));
    res.json(files);
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
    logEmitter.emit('log', `[${new Date().toISOString()}] Starting job idol=${idol} start=${start} end=${end} (IP: ${clientIP})`);
    
    await runDownload(
      String(idol), 
      parseInt(start), 
      parseInt(end), 
      (line) => logEmitter.emit('log', line),
      (browser) => { currentJob.browser = browser; },
      () => currentJob.abort.value,
      userDownloadsDir
    );
    
    if (currentJob.abort.value) {
      logEmitter.emit('log', `[${new Date().toISOString()}] Job cancelled by user`);
      res.status(499).json({ status: 'cancelled', idol, start: Number(start), end: Number(end) });
    } else {
      res.json({ status: 'completed', idol, start: Number(start), end: Number(end) });
    }
  } catch (err) {
    if (err.message === 'Cancelled' || currentJob?.abort?.value) {
      logEmitter.emit('log', `[${new Date().toISOString()}] Job cancelled: ${err.message}`);
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
  logEmitter.emit('log', `[${new Date().toISOString()}] Stop requested by user`);
  res.json({ status: 'stopping', message: 'Download job will be stopped' });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}`);
});


