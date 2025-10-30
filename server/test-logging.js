#!/usr/bin/env node

import logger from './utils/logger.js';

console.log('🧪 Testing Cypress Pop Logging System\n');

// Test different log levels
logger.info('Starting logging system test');
logger.warn('This is a warning message');
logger.error('This is an error message');
logger.debug('This is a debug message');

// Test download-specific logging
logger.downloadStart('jihyo', 1, 5);
logger.downloadProgress('jihyo', 2, 5, 15);
logger.downloadWaiting('jihyo', 'Loading page 3');
logger.downloadSuccess('jihyo', {
  pagesProcessed: 5,
  imagesDownloaded: 45,
  errors: []
});

// Test image download logging
logger.imageDownloadStart('image123.jpg', 'jihyo-page-1');
logger.imageDownloadSuccess('image123.jpg', 'jihyo-page-1');
logger.imageDownloadError('image456.jpg', new Error('Network timeout'), 'jihyo-page-1');

// Test browser logging
logger.browserLaunch();
logger.pageNavigation('https://idolfap.com/idols/jihyo/page/1/', 'Page 1');
logger.browserClose();

// Test context-specific logging
const downloadLogger = logger.withContext('Download-jihyo');
downloadLogger.info('Custom context logging test');

const routeLogger = logger.withContext('Route-Download');
routeLogger.info('Route-specific logging test');

console.log('\n✅ Logging system test completed!');
console.log('📋 Check the logs/ directory for log files');
console.log('🔍 Use: node scripts/view-logs.js to view logs'); 