import fs from 'fs';
import path from 'path';

// Try to import chalk, fallback to basic console if not available
let chalk;
try {
  chalk = (await import('chalk')).default;
} catch (error) {
  // Fallback to basic console colors if chalk is not available
  chalk = {
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`
  };
}

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be set via environment variable)
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() || 'INFO'];

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFilePath = path.join(logsDir, `server-${new Date().toISOString().split('T')[0]}.log`);

// Helper function to write to log file
function writeToFile(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(logFilePath, logLine);
}

// Main logger class
class Logger {
  constructor(context = 'Server') {
    this.context = context;
  }

  // Create a new logger instance with a specific context
  withContext(context) {
    return new Logger(context);
  }

  // Error logging
  error(message, data = null) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      const formattedMessage = `[${this.context}] ${message}`;
      console.error(chalk.red(`❌ ERROR: ${formattedMessage}`));
      if (data) console.error(chalk.gray(JSON.stringify(data, null, 2)));
      writeToFile('ERROR', formattedMessage, data);
    }
  }

  // Warning logging
  warn(message, data = null) {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      const formattedMessage = `[${this.context}] ${message}`;
      console.warn(chalk.yellow(`⚠️  WARN: ${formattedMessage}`));
      if (data) console.warn(chalk.gray(JSON.stringify(data, null, 2)));
      writeToFile('WARN', formattedMessage, data);
    }
  }

  // Info logging
  info(message, data = null) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      const formattedMessage = `[${this.context}] ${message}`;
      console.log(chalk.blue(`ℹ️  INFO: ${formattedMessage}`));
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
      writeToFile('INFO', formattedMessage, data);
    }
  }

  // Debug logging
  debug(message, data = null) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      const formattedMessage = `[${this.context}] ${message}`;
      console.log(chalk.gray(`🔍 DEBUG: ${formattedMessage}`));
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
      writeToFile('DEBUG', formattedMessage, data);
    }
  }

  // Download-specific logging methods
  downloadStart(idolName, start, end) {
    this.info(`🚀 Starting download for ${idolName} (pages ${start}-${end})`, {
      idolName,
      start,
      end,
      timestamp: new Date().toISOString()
    });
  }

  downloadProgress(idolName, currentPage, totalPages, imagesDownloaded) {
    const progress = Math.round((currentPage / totalPages) * 100);
    this.info(`📥 Download progress for ${idolName}: ${progress}% (${currentPage}/${totalPages} pages, ${imagesDownloaded} images)`, {
      idolName,
      currentPage,
      totalPages,
      imagesDownloaded,
      progress
    });
  }

  downloadWaiting(idolName, reason) {
    this.info(`⏳ Waiting: ${reason} for ${idolName}`, {
      idolName,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  downloadSuccess(idolName, results) {
    this.info(`✅ Download completed for ${idolName}`, {
      idolName,
      results,
      timestamp: new Date().toISOString()
    });
  }

  downloadError(idolName, error, context = '') {
    this.error(`❌ Download failed for ${idolName}${context ? ` (${context})` : ''}`, {
      idolName,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  imageDownloadStart(filename, context) {
    this.debug(`📸 Starting image download: ${filename}`, { filename, context });
  }

  imageDownloadSuccess(filename, context) {
    this.debug(`✅ Image downloaded: ${filename}`, { filename, context });
  }

  imageDownloadError(filename, error, context) {
    this.warn(`❌ Image download failed: ${filename}`, { 
      filename, 
      error: error.message, 
      context 
    });
  }

  browserLaunch() {
    this.info('🌐 Launching browser instance');
  }

  browserClose() {
    this.info('🔒 Closing browser instance');
  }

  pageNavigation(url, status = '') {
    this.debug(`🌍 Navigating to: ${url}${status ? ` (${status})` : ''}`);
  }

  pageError(url, error) {
    this.error(`❌ Page navigation failed: ${url}`, { url, error: error.message });
  }
}

// Create default logger instance
const logger = new Logger();

export default logger; 