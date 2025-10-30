export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Available idols and creators
  idols: [
    'jihyo', 'karina', 'izone-yujin', 'park-min-young'
  ],
  
  creators: [
    'darkyeji', 'twice', 'blackpink', 'redvelvet'
  ],
  
  // Puppeteer settings
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 30000, // 30 seconds for browser launch (like alternative test)
    protocolTimeout: 30000 // 30 seconds for protocol operations
  },
  
  // Download settings
  download: {
    timeout: 10000, // 10 seconds for page navigation (faster but not too aggressive)
    waitUntil: 'domcontentloaded', // Faster loading
    retries: 2 // Two attempts for reliability
  }
}; 