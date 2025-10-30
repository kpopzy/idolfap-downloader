#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '..', 'logs');

function viewLogs(options = {}) {
  const {
    level = 'all',
    context = 'all',
    limit = 50,
    follow = false,
    date = new Date().toISOString().split('T')[0]
  } = options;

  const logFile = path.join(logsDir, `server-${date}.log`);
  
  if (!fs.existsSync(logFile)) {
    console.log(`❌ No log file found for date: ${date}`);
    console.log(`Available log files:`);
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    files.forEach(file => console.log(`  - ${file}`));
    return;
  }

  console.log(`📋 Viewing logs from: ${logFile}`);
  console.log(`🔍 Filter: level=${level}, context=${context}, limit=${limit}`);
  console.log('─'.repeat(80));

  const logLines = fs.readFileSync(logFile, 'utf8').split('\n').filter(line => line.trim());
  let count = 0;

  for (const line of logLines) {
    try {
      const logEntry = JSON.parse(line);
      
      // Apply filters
      if (level !== 'all' && logEntry.level !== level.toUpperCase()) continue;
      if (context !== 'all' && !logEntry.message.includes(`[${context}]`)) continue;
      
      // Format and display log entry
      const timestamp = new Date(logEntry.timestamp).toLocaleString();
      const levelIcon = {
        'ERROR': '❌',
        'WARN': '⚠️',
        'INFO': 'ℹ️',
        'DEBUG': '🔍'
      }[logEntry.level] || '📝';
      
      console.log(`${levelIcon} [${timestamp}] ${logEntry.message}`);
      
      if (logEntry.data) {
        console.log(`   Data: ${JSON.stringify(logEntry.data, null, 2)}`);
      }
      
      count++;
      if (count >= limit) break;
      
    } catch (err) {
      // Skip malformed log lines
      continue;
    }
  }

  if (count === 0) {
    console.log('No logs found matching the specified filters.');
  } else {
    console.log(`\n📊 Displayed ${count} log entries`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  switch (arg) {
    case '--level':
    case '-l':
      options.level = args[++i];
      break;
    case '--context':
    case '-c':
      options.context = args[++i];
      break;
    case '--limit':
    case '-n':
      options.limit = parseInt(args[++i]);
      break;
    case '--follow':
    case '-f':
      options.follow = true;
      break;
    case '--date':
    case '-d':
      options.date = args[++i];
      break;
    case '--help':
    case '-h':
      console.log(`
📋 Log Viewer for Cypress Pop Server

Usage: node view-logs.js [options]

Options:
  -l, --level <level>     Filter by log level (ERROR, WARN, INFO, DEBUG, all)
  -c, --context <context> Filter by context (Download-jihyo, Route-Download, etc.)
  -n, --limit <number>    Limit number of log entries to display (default: 50)
  -f, --follow            Follow log file in real-time
  -d, --date <date>       Specify log file date (YYYY-MM-DD format)
  -h, --help              Show this help message

Examples:
  node view-logs.js --level ERROR
  node view-logs.js --context Download-jihyo --limit 20
  node view-logs.js --follow
  node view-logs.js --date 2024-01-15
`);
      process.exit(0);
      break;
  }
}

viewLogs(options); 