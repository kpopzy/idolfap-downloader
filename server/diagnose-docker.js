#!/usr/bin/env node

import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './utils/logger.js';

const execAsync = promisify(exec);

console.log('🔍 Docker Environment Diagnosis\n');

const diagnosticLogger = logger.withContext('Diagnostic');

async function runDiagnostics() {
  try {
    // Check system information
    diagnosticLogger.info('Checking system information...');
    
    const { stdout: uname } = await execAsync('uname -a');
    console.log('System:', uname.trim());
    
    // Check available browsers
    diagnosticLogger.info('Checking for available browsers...');
    
    const browserPaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/firefox'
    ];
    
    for (const path of browserPaths) {
      if (fs.existsSync(path)) {
        console.log(`✅ Found browser: ${path}`);
        try {
          const { stdout: version } = await execAsync(`${path} --version`);
          console.log(`   Version: ${version.trim()}`);
        } catch (error) {
          console.log(`   Version check failed: ${error.message}`);
        }
      } else {
        console.log(`❌ Not found: ${path}`);
      }
    }
    
    // Check environment variables
    diagnosticLogger.info('Checking environment variables...');
    console.log('PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH || 'Not set');
    console.log('CHROME_BIN:', process.env.CHROME_BIN || 'Not set');
    console.log('CHROME_PATH:', process.env.CHROME_PATH || 'Not set');
    
    // Check available memory
    diagnosticLogger.info('Checking system resources...');
    
    try {
      const { stdout: meminfo } = await execAsync('cat /proc/meminfo | head -5');
      console.log('Memory info:');
      console.log(meminfo);
    } catch (error) {
      console.log('Could not read memory info:', error.message);
    }
    
    // Check disk space
    try {
      const { stdout: df } = await execAsync('df -h /');
      console.log('Disk space:');
      console.log(df);
    } catch (error) {
      console.log('Could not read disk info:', error.message);
    }
    
    // Check if we can run basic commands
    diagnosticLogger.info('Testing basic command execution...');
    
    try {
      const { stdout: ls } = await execAsync('ls -la /usr/bin/ | grep -E "(chrome|chromium)"');
      console.log('Chrome/Chromium files in /usr/bin/:');
      console.log(ls || 'No chrome/chromium files found');
    } catch (error) {
      console.log('Could not list chrome files:', error.message);
    }
    
    // Test if we can create a simple process
    diagnosticLogger.info('Testing process creation...');
    
    try {
      const { stdout: echo } = await execAsync('echo "Process creation works"');
      console.log('Process creation test:', echo.trim());
    } catch (error) {
      console.log('Process creation failed:', error.message);
    }
    
    console.log('\n✅ Diagnosis completed!');
    
  } catch (error) {
    diagnosticLogger.error('Diagnosis failed', { error: error.message });
    console.log('❌ Diagnosis failed:', error.message);
  }
}

runDiagnostics(); 