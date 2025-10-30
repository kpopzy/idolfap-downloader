export const loggingConfig = {
  // Log levels: ERROR, WARN, INFO, DEBUG
  level: process.env.LOG_LEVEL || 'INFO',
  
  // Enable/disable file logging
  enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
  
  // Enable/disable console logging
  enableConsoleLogging: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
  
  // Log file settings
  logFile: {
    // Maximum log file size in MB before rotation
    maxSize: process.env.LOG_MAX_SIZE || 10,
    
    // Number of log files to keep
    maxFiles: process.env.LOG_MAX_FILES || 5,
    
    // Log file directory
    directory: process.env.LOG_DIRECTORY || 'logs'
  },
  
  // Download-specific logging settings
  download: {
    // Enable detailed progress logging
    enableProgressLogging: process.env.ENABLE_PROGRESS_LOGGING !== 'false',
    
    // Log interval for progress updates (in seconds)
    progressLogInterval: process.env.PROGRESS_LOG_INTERVAL || 30,
    
    // Enable image-level logging
    enableImageLogging: process.env.ENABLE_IMAGE_LOGGING !== 'false'
  },
  
  // Browser logging settings
  browser: {
    // Enable browser launch/close logging
    enableBrowserLogging: process.env.ENABLE_BROWSER_LOGGING !== 'false',
    
    // Enable page navigation logging
    enableNavigationLogging: process.env.ENABLE_NAVIGATION_LOGGING !== 'false'
  }
};

// Helper function to check if a log level should be displayed
export function shouldLog(level) {
  const levels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const currentLevel = levels[loggingConfig.level.toUpperCase()] || 2;
  const requestedLevel = levels[level.toUpperCase()] || 2;
  return requestedLevel <= currentLevel;
}

// Helper function to get log level from environment
export function getLogLevel() {
  return loggingConfig.level.toUpperCase();
} 