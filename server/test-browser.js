#!/usr/bin/env node

import puppeteer from 'puppeteer';
import logger from './utils/logger.js';

console.log('🧪 Testing Browser Launch in Docker Environment\n');

const testLogger = logger.withContext('BrowserTest');

async function testBrowserLaunch() {
  testLogger.info('Starting browser launch test');
  
  try {
    testLogger.info('Attempting to launch browser...');
    
    const browser = await Promise.race([
      puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
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
    
    testLogger.info('Testing page navigation...');
    await page.goto('https://www.google.com', { timeout: 10000 });
    testLogger.info('Page navigation successful');
    
    const title = await page.title();
    testLogger.info(`Page title: ${title}`);
    
    await page.close();
    await browser.close();
    
    testLogger.info('Browser test completed successfully!');
    console.log('✅ Browser test passed!');
    
  } catch (error) {
    testLogger.error('Browser test failed', { 
      error: error.message,
      stack: error.stack 
    });
    console.log('❌ Browser test failed:', error.message);
    process.exit(1);
  }
}

testBrowserLaunch(); 