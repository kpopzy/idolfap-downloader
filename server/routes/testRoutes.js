import express from 'express';
import puppeteer from 'puppeteer';
import logger from '../utils/logger.js';
import { launchBrowserWithRetry, createPage, closeBrowser } from '../utils/browserUtils.js';

const router = express.Router();

// Test browser launch endpoint
router.get('/test/browser', async (req, res) => {
  const testLogger = logger.withContext('TestRoute');
  
  testLogger.info('Browser test endpoint called');
  
  try {
    testLogger.info('Attempting to launch browser...');
    
    const browser = await launchBrowserWithRetry();
    testLogger.info('Browser launched successfully!');
    
    const page = await createPage(browser);
    testLogger.info('New page created successfully');
    
    testLogger.info('Testing page navigation...');
    await page.goto('https://www.google.com', { timeout: 10000 });
    testLogger.info('Page navigation successful');
    
    const title = await page.title();
    testLogger.info(`Page title: ${title}`);
    
    await page.close();
    await closeBrowser(browser);
    
    testLogger.info('Browser test completed successfully!');
    
    res.json({
      success: true,
      message: 'Browser test passed!',
      title: title
    });
    
  } catch (error) {
    testLogger.error('Browser test failed', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Browser launch or navigation failed'
    });
  }
});

// Simple browser test endpoint
router.get('/test/browser-simple', async (req, res) => {
  const testLogger = logger.withContext('TestRoute');
  
  testLogger.info('Simple browser test endpoint called');
  
  try {
    testLogger.info('Attempting to launch browser with ultra minimal config...');
    
    const browser = await Promise.race([
      puppeteer.launch({
        headless: true,
        protocolTimeout: 30000,
        args: ['--no-sandbox'],
        timeout: 10000
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser launch timeout after 10 seconds')), 10000)
      )
    ]);
    
    testLogger.info('Browser launched successfully!');
    
    const page = await browser.newPage();
    testLogger.info('New page created successfully');
    
    await page.goto('data:text/html,<html><body>Test</body></html>', { 
      waitUntil: 'domcontentloaded',
      timeout: 5000 
    });
    
    testLogger.info('Page navigation successful');
    
    await page.close();
    await browser.close();
    
    testLogger.info('Simple browser test completed successfully!');
    
    res.json({
      success: true,
      message: 'Simple browser test passed!'
    });
    
  } catch (error) {
    testLogger.error('Simple browser test failed', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Simple browser launch failed'
    });
  }
});

// Ultra simple browser test endpoint
router.get('/test/browser-ultra-simple', async (req, res) => {
  const testLogger = logger.withContext('TestRoute');
  
  testLogger.info('Ultra simple browser test endpoint called');
  
  try {
    testLogger.info('Attempting to launch browser with absolute minimal config...');
    
    const browser = await Promise.race([
      puppeteer.launch({
        headless: true,
        protocolTimeout: 30000,
        args: ['--no-sandbox']
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser launch timeout after 5 seconds')), 5000)
      )
    ]);
    
    testLogger.info('Browser launched successfully!');
    
    const page = await browser.newPage();
    testLogger.info('New page created successfully');
    
    await page.close();
    await browser.close();
    
    testLogger.info('Ultra simple browser test completed successfully!');
    
    res.json({
      success: true,
      message: 'Ultra simple browser test passed!'
    });
    
  } catch (error) {
    testLogger.error('Ultra simple browser test failed', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Ultra simple browser launch failed'
    });
  }
});

// Alternative browser test using different approach
router.get('/test/browser-alternative', async (req, res) => {
  const testLogger = logger.withContext('TestRoute');
  
  testLogger.info('Alternative browser test endpoint called');
  
  try {
    testLogger.info('Attempting to launch browser with alternative config...');
    
    // Try using a different approach with more explicit settings
    const browser = await Promise.race([
      puppeteer.launch({
        headless: true,
        protocolTimeout: 60000,
        args: [
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
        ],
        timeout: 30000
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser launch timeout after 30 seconds')), 30000)
      )
    ]);
    
    testLogger.info('Browser launched successfully!');
    
    const page = await browser.newPage();
    testLogger.info('New page created successfully');
    
    await page.goto('data:text/html,<html><body>Test</body></html>', { 
      waitUntil: 'domcontentloaded',
      timeout: 5000 
    });
    
    testLogger.info('Page navigation successful');
    
    await page.close();
    await browser.close();
    
    testLogger.info('Alternative browser test completed successfully!');
    
    res.json({
      success: true,
      message: 'Alternative browser test passed!'
    });
    
  } catch (error) {
    testLogger.error('Alternative browser test failed', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Alternative browser launch failed'
    });
  }
});

// Test proxy access endpoint
router.get('/test/proxy', async (req, res) => {
  const testLogger = logger.withContext('TestRoute');
  
  testLogger.info('Proxy test endpoint called');
  
  try {
    testLogger.info('Attempting to launch browser with proxy...');
    
    const browser = await Promise.race([
      puppeteer.launch({
        headless: true,
        protocolTimeout: 30000,
        args: [
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
          '--disable-features=VizDisplayCompositor',
          ...(process.env.PROXY_SERVER ? [`--proxy-server=${process.env.PROXY_SERVER}`] : [])
        ],
        timeout: 30000
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser launch timeout after 30 seconds')), 30000)
      )
    ]);
    
    testLogger.info('Browser launched successfully!');
    
    const page = await browser.newPage();
    testLogger.info('New page created successfully');
    
    // Set proxy authentication if provided
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
      });
      testLogger.info('Proxy authentication configured');
    }
    
    testLogger.info('Testing page navigation to target site...');
    await page.goto('https://idolfap.com/idols/momo/page/1/', { 
      timeout: 10000,
      waitUntil: 'domcontentloaded'
    });
    testLogger.info('Page navigation successful');
    
    const title = await page.title();
    testLogger.info(`Page title: ${title}`);
    
    await page.close();
    await browser.close();
    
    testLogger.info('Proxy test completed successfully!');
    
    res.json({
      success: true,
      message: 'Proxy test passed!',
      title: title,
      proxy: process.env.PROXY_SERVER || 'none'
    });
    
  } catch (error) {
    testLogger.error('Proxy test failed', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Proxy test failed',
      proxy: process.env.PROXY_SERVER || 'none'
    });
  }
});

export default router; 