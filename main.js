import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';

function resolveChromeExecutablePath() {
  const isWSL = os.release().toLowerCase().includes('microsoft');
  const linuxCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ].filter(Boolean);

  for (const candidate of linuxCandidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch {}
  }

  // Avoid using Windows Chrome from WSL; it often fails to launch headless.
  if (!isWSL) {
    const windowsCandidates = [
      '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
      '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ];
    for (const candidate of windowsCandidates) {
      try { if (fs.existsSync(candidate)) return candidate; } catch {}
    }
  }

  return null;
}

function getWindowsHostIpForWSL() {
  try {
    const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const match = resolv.match(/nameserver\s+([0-9.]+)/);
    if (match) return match[1];
  } catch {}
  return '172.22.224.1';
}

function resolveProxyForWSL() {
  const isWSL = os.release().toLowerCase().includes('microsoft');
  const proxy = process.env.ALL_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.PROXY_URL;
  if (!proxy) return null;
  try {
    const url = new URL(proxy);
    if (isWSL && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {
      url.hostname = getWindowsHostIpForWSL();
    }
    return url.toString();
  } catch {
    return proxy;
  }
}

export async function runDownload(idolName, start, end, onLog, onBrowserReady, shouldAbort, customDownloadDir) {
function logStep(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { if (typeof onLog === 'function') onLog(line); } catch {}
}

logStep('Starting...')
logStep(`Idol: ${idolName}`)
logStep(`Range: ${start}..${end}`)
  if(!idolName || !start || !end) {
    console.log(`Example : node main.js jihyo 1 10`)
    process.exit(1);
  }

  const baseDownloadDir = customDownloadDir || path.resolve('./downloads');
  const downloadDir = path.join(baseDownloadDir, idolName);
  fs.mkdirSync(downloadDir, { recursive: true });

  // Resolve browser executable in this order:
  // 1) Puppeteer's bundled Chromium (if present)
  // 2) System Chrome/Chromium
  let executablePath = null;
  try {
    const bundled = puppeteer.executablePath && puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) executablePath = bundled;
  } catch {}
  if (!executablePath) executablePath = resolveChromeExecutablePath();
  if (!executablePath) {
    const lines = [
      '❌ No Chrome/Chromium executable found.',
      'Fix one of these:',
      '  - Download Puppeteer browser: npx puppeteer browsers install chrome',
      '  - Or install system Chromium: sudo apt-get update && sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser',
      '  - Or set PUPPETEER_EXECUTABLE_PATH to your Chrome path.'
    ];
    lines.forEach(l => { console.error(l); try { if (onLog) onLog(l); } catch {} });
    process.exit(1);
  }

  logStep('Launching browser...')
  const proxyServer = resolveProxyForWSL();
  const headlessMode = process.env.HEADLESS !== 'false';
  logStep(`Headless mode: ${headlessMode ? 'enabled' : 'disabled'}`);
  const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-features=VizDisplayCompositor',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions'
  ];
  
  if (!headlessMode) {
    launchArgs.push('--window-size=1365,768', '--start-maximized', '--no-zygote');
  }
  
  if (proxyServer) {
    launchArgs.push(`--proxy-server=${proxyServer}`);
    logStep(`Using proxy: ${proxyServer}`);
  } else {
    launchArgs.push("--proxy-server='direct://'", "--proxy-bypass-list=*");
  }

  let browser;
  const wsEndpoint = process.env.PUPPETEER_WS_ENDPOINT || process.env.BROWSER_WS_ENDPOINT;
  const browserURL = process.env.PUPPETEER_BROWSER_URL || process.env.BROWSER_URL;
  if (wsEndpoint) {
    logStep(`Connecting to existing browser via WS: ${wsEndpoint}`);
    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: null });
  } else if (browserURL) {
    logStep(`Connecting to existing browser via URL: ${browserURL}`);
    browser = await puppeteer.connect({ browserURL, defaultViewport: null });
  } else {
    browser = await puppeteer.launch({
      headless: headlessMode ? 'new' : false,
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
      executablePath
    });
  }
  if (typeof onBrowserReady === 'function') {
    onBrowserReady(browser);
  }
  logStep('Creating main page...')
  let page = await browser.newPage();
  await page.setViewport({ width: 1365, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'upgrade-insecure-requests': '1'
  });
  // Stealth tweaks
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    // present a minimal chrome object
    window.chrome = { runtime: {} };
  });
  page.setDefaultNavigationTimeout(5000);
  page.setDefaultTimeout(5000);

  // Block heavy assets on main page
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (type === 'image' || type === 'stylesheet' || type === 'font' || type === 'media') {
      return req.abort();
    }
    req.continue();
  });

  async function gotoWithRetry(targetPage, url, options = {}) {
    const attempts = 3;
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
      try {
        logStep(`Navigating (attempt ${i}/${attempts}) -> ${url}`);
        await targetPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000, ...options });
        logStep(`Navigation success -> ${url}`);
        return;
      } catch (err) {
        lastErr = err;
        logStep(`Navigation failed (attempt ${i}) -> ${url} | ${err.message}`);
        if (i < attempts) {
          await new Promise(r => setTimeout(r, 2000 * i));
          continue;
        }
      }
    }
    throw lastErr;
  }

  for (let index = start; index <= end; index++) {
    if (shouldAbort && shouldAbort()) {
      await browser.close();
      throw new Error('Cancelled');
    }
    try {
      logStep(`Processing listing page index=${index}`);
      await gotoWithRetry(page, `https://idolfap.com/idols/${idolName}/page/${index}/`);

      const postLinks = await page.$$eval(
        '.grid.grid-show .post-image-wrapper > a',
        els => els.map(a => a.href)
      );

      logStep(`Found ${postLinks.length} post links on index=${index}`);

      for (let postLink of postLinks) {
        if (shouldAbort && shouldAbort()) {
          await browser.close();
          throw new Error('Cancelled');
        }
        logStep(`Opening post: ${postLink}`);
        const postPage = await browser.newPage();
        await postPage.setViewport({ width: 1365, height: 768 });
        await postPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        await postPage.setExtraHTTPHeaders({
          'accept-language': 'en-US,en;q=0.9',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'upgrade-insecure-requests': '1'
        });
        await postPage.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        postPage.setDefaultNavigationTimeout(5000);
        postPage.setDefaultTimeout(5000);
        const allowedImageUrls = new Set();
        await postPage.setRequestInterception(true);
        postPage.on('request', req => {
          const type = req.resourceType();
          const url = req.url();
          if (type === 'image') {
            if (allowedImageUrls.has(url)) {
              return req.continue();
            }
            return req.abort();
          }
          if (type === 'stylesheet' || type === 'font' || type === 'media') {
            return req.abort();
          }
          req.continue();
        });
        await gotoWithRetry(postPage, postLink);

        // First try to get images from the slider structure
        let images = await postPage.$$eval(
          '.post-slider-item.open-gallery img',
          els => els.map(img => img.src)
        );

        // If no images found in slider, fall back to post-content links
        if (images.length === 0) {
          images = await postPage.$$eval(
            '.post-content a',
            els => els.map(a => a.href)
          );
        }

        logStep('----------------------------------------------------------------');
        logStep(`Found ${images.length} images (${idolName}) on ${postLink}`);

        for (let imageUrl of images) {
          const filename = path.basename(new URL(imageUrl).pathname);
          const savePath = path.join(downloadDir, filename);

          try {
            await fs.promises.access(savePath);
            logStep(`✓ Skipping ${filename}, already exists.`);
            continue;
          } catch {}

          logStep(`Downloading (${idolName}) [page/${index}] : ${imageUrl}`);
          try {
            allowedImageUrls.add(imageUrl);
            const response = await postPage.goto(imageUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
            const buffer = await response.buffer();
            await fs.promises.writeFile(savePath, buffer);
            logStep(`✓ Saved (${idolName}) ${filename}`);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] ✗ Failed ${filename}: ${err.message}`);
          }
        }

        await postPage.close();
        logStep(`Closed post page: ${postLink}`);
      }
    } catch (navErr) {
      console.error(`[${new Date().toISOString()}] Error on page ${index}: ${navErr.message}`);
      const msg = (navErr && navErr.message ? navErr.message.toLowerCase() : '');
      if (msg.includes('detached') || msg.includes('connection closed')) {
        try { await page.close(); } catch {}
        logStep('Main page detached/closed; recreating a fresh page for next index...');
        // Recreate main page with same configuration
        const newPage = await browser.newPage();
        await newPage.setViewport({ width: 1365, height: 768 });
        await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        await newPage.setExtraHTTPHeaders({
          'accept-language': 'en-US,en;q=0.9',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'upgrade-insecure-requests': '1'
        });
        await newPage.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
          window.chrome = { runtime: {} };
        });
        newPage.setDefaultNavigationTimeout(5000);
        newPage.setDefaultTimeout(5000);
        await newPage.setRequestInterception(true);
        newPage.on('request', req => {
          const type = req.resourceType();
          if (type === 'image' || type === 'stylesheet' || type === 'font' || type === 'media') {
            return req.abort();
          }
          req.continue();
        });
        // Replace reference for next loop iteration
        page = newPage;
      }
    }
  }

  await page.close();
  logStep('Closed main page');
  await browser.close();
  logStep('Browser closed');
}

// CLI entry
if (process.argv[1] && process.argv[1].endsWith('main.js')) {
  const idolName = process.argv[2];
  const start = parseInt(process.argv[3]);
  const end = parseInt(process.argv[4]);
  if (!idolName || !start || !end) {
    console.error('❌ Usage: node main.js <idol> <startPage> <endPage>');
    process.exit(1);
  }
  runDownload(idolName, start, end).catch(err => {
    console.error('Fatal error:', err?.message || err);
    process.exit(1);
  });
}
