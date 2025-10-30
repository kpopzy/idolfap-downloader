import puppeteer from 'puppeteer';
import fs from 'fs';
import logger from './logger.js';
import { config } from '../config/app.js';

// Check if Chromium is available
const checkChromiumAvailability = () => {
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      logger.info(`Found Chromium at: ${path}`);
      return path;
    }
  }
  
  logger.warn('No Chromium found in common locations');
  return null;
};

// Browser launch with simplified third attempt configuration
export async function launchBrowserWithRetry(maxRetries = 3) {
  const browserLogger = logger.withContext('Browser');
  
  browserLogger.info('Attempting to launch browser with simplified third attempt config');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      browserLogger.info(`Browser launch attempt ${attempt}/${maxRetries}`);
      
      // Try different executable paths based on attempt
      let executablePath = undefined;
      if (attempt === 2) {
        executablePath = '/usr/bin/chromium-browser';
      } else if (attempt === 3) {
        executablePath = '/usr/bin/google-chrome';
      }
      
      // Build args array with proxy support
      const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-pings',
        '--disable-web-security',
        '--disable-background-networking',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-features=VizDisplayCompositor'
      ];
      
      // Add proxy if configured
      if (process.env.PROXY_SERVER) {
        args.push(`--proxy-server=${process.env.PROXY_SERVER}`);
        browserLogger.info(`Using proxy: ${process.env.PROXY_SERVER}`);
      }
      
      // Use simplified third attempt configuration with essential settings only
      const browser = await Promise.race([
        puppeteer.launch({
          headless: true,
          protocolTimeout: 30000,
          executablePath,
          args,
          timeout: 30000
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Browser launch timeout after 30 seconds`)), 30000)
        )
      ]);

      // Test if browser is actually working
      const testPage = await browser.newPage();
      
      // Set proxy authentication if provided
      if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        await testPage.authenticate({
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD
        });
        browserLogger.info('Proxy authentication configured');
      }
      
      await testPage.goto('data:text/html,<html><body>Test</body></html>', { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      });
      await testPage.close();

      browserLogger.info('Browser launched successfully with simplified third attempt config');
      return browser;

    } catch (error) {
      browserLogger.error(`Browser launch attempt ${attempt} failed`, { 
        error: error.message,
        attempt,
        maxRetries
      });

      if (attempt === maxRetries) {
        browserLogger.error('All browser launch attempts failed', { 
          error: error.message
        });
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Graceful browser cleanup
export async function closeBrowser(browser) {
  if (!browser) return;
  
  try {
    const pages = await browser.pages();
    await Promise.all(pages.map(page => page.close()));
    await browser.close();
    logger.info('Browser closed successfully');
  } catch (error) {
    logger.warn('Error closing browser', { error: error.message });
  }
}

// Create new page with error handling
export async function createPage(browser) {
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1');
    
    // Set minimal headers for faster loading
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    
    logger.debug('New page created successfully with mobile user agent');
    return page;
  } catch (error) {
    logger.error('Failed to create new page', { error: error.message });
    throw error;
  }
} 