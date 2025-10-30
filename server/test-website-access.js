#!/usr/bin/env node

import puppeteer from 'puppeteer';
import https from 'https';
import logger from './utils/logger.js';

const testLogger = logger.withContext('WebsiteTest');

async function testWebsiteAccess() {
  console.log('🧪 Testing Website Access Methods\n');
  
  const targetUrl = 'https://idolfap.com/idols/momo/page/1/';
  
  // Test 1: Direct HTTPS request
  console.log('1. Testing direct HTTPS request...');
  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.get(targetUrl, { timeout: 5000 }, (res) => {
        resolve(res);
      });
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout')));
    });
    console.log('✅ HTTPS request successful:', response.statusCode);
  } catch (error) {
    console.log('❌ HTTPS request failed:', error.message);
  }
  
  // Test 2: Browser with different user agents
  console.log('\n2. Testing browser access...');
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 10000
    });
    
    const page = await browser.newPage();
    
    // Test different user agents
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    for (let i = 0; i < userAgents.length; i++) {
      try {
        console.log(`   Testing user agent ${i + 1}...`);
        await page.setUserAgent(userAgents[i]);
        await page.goto(targetUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
        console.log(`   ✅ User agent ${i + 1} successful`);
        break;
      } catch (error) {
        console.log(`   ❌ User agent ${i + 1} failed:`, error.message);
      }
    }
    
    await browser.close();
  } catch (error) {
    console.log('❌ Browser test failed:', error.message);
  }
  
  // Test 3: Check if it's a DNS issue
  console.log('\n3. Testing DNS resolution...');
  try {
    const dns = require('dns').promises;
    const addresses = await dns.resolve4('idolfap.com');
    console.log('✅ DNS resolution successful:', addresses);
  } catch (error) {
    console.log('❌ DNS resolution failed:', error.message);
  }
  
  console.log('\n🏁 Website access test completed');
}

testWebsiteAccess().catch(console.error); 