# Logging System Documentation

## Overview

The Cypress Pop server now includes a comprehensive logging system that tracks download status, failures, and waiting states. The logging system provides:

- **Structured logging** with different levels (ERROR, WARN, INFO, DEBUG)
- **Colored console output** for easy reading
- **File-based logging** for persistence and analysis
- **Context-specific logging** for different components
- **Download progress tracking** with detailed status updates

## Log Levels

### ERROR (❌)
Critical errors that prevent operations from completing successfully.

### WARN (⚠️)
Non-critical issues that don't stop operations but may indicate problems.

### INFO (ℹ️)
General information about operations, progress, and status updates.

### DEBUG (🔍)
Detailed information useful for debugging and development.

## Logging Contexts

The logging system uses different contexts to organize logs:

- **Server**: General server operations
- **Route-Download**: Download route requests
- **Route-Single**: Single post download requests
- **Route-Creator**: Creator download requests
- **Download-{idolName}**: Specific idol download operations
- **Download-Creator-{creatorName}**: Specific creator download operations
- **ImageDownload**: Image download operations
- **Browser**: Browser launch/close operations

## Configuration

### Environment Variables

Set these environment variables to configure logging behavior:

```bash
# Log level (ERROR, WARN, INFO, DEBUG)
LOG_LEVEL=INFO

# Enable/disable file logging
ENABLE_FILE_LOGGING=true

# Enable/disable console logging
ENABLE_CONSOLE_LOGGING=true

# Download-specific settings
ENABLE_PROGRESS_LOGGING=true
ENABLE_IMAGE_LOGGING=true
PROGRESS_LOG_INTERVAL=30

# Browser logging settings
ENABLE_BROWSER_LOGGING=true
ENABLE_NAVIGATION_LOGGING=true
```

### Log File Settings

Log files are stored in the `logs/` directory with the format `server-YYYY-MM-DD.log`.

- **Location**: `server/logs/`
- **Format**: JSON lines for easy parsing
- **Rotation**: Daily log files
- **Retention**: Configurable via environment variables

## Usage Examples

### Viewing Logs

Use the log viewer script to filter and view logs:

```bash
# View recent logs
node scripts/view-logs.js

# View only errors
node scripts/view-logs.js --level ERROR

# View logs for a specific idol download
node scripts/view-logs.js --context Download-jihyo

# View logs with limit
node scripts/view-logs.js --limit 20

# View logs for a specific date
node scripts/view-logs.js --date 2024-01-15

# Get help
node scripts/view-logs.js --help
```

### Log File Structure

Each log entry is a JSON object with the following structure:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "message": "[Download-jihyo] 🚀 Starting download for jihyo (pages 1-5)",
  "data": {
    "idolName": "jihyo",
    "start": 1,
    "end": 5,
    "timestamp": "2024-01-15T10:30:45.123Z"
  }
}
```

## Download Status Tracking

The logging system provides detailed tracking for download operations:

### Download Start
```
🚀 Starting download for jihyo (pages 1-5)
```

### Progress Updates
```
📥 Download progress for jihyo: 60% (3/5 pages, 45 images)
```

### Waiting States
```
⏳ Waiting: Loading page 3 for jihyo
```

### Success Messages
```
✅ Download completed for jihyo
```

### Error Messages
```
❌ Download failed for jihyo (Page navigation)
```

## Image Download Tracking

Individual image downloads are tracked with:

### Image Start
```
📸 Starting image download: image123.jpg
```

### Image Success
```
✅ Image downloaded: image123.jpg
```

### Image Error
```
❌ Image download failed: image123.jpg
```

## Browser Operations

Browser-related operations are logged:

### Browser Launch
```
🌐 Launching browser instance
```

### Page Navigation
```
🌍 Navigating to: https://idolfap.com/idols/jihyo/page/1/
```

### Browser Close
```
🔒 Closing browser instance
```

## Integration with Existing Code

The logging system is integrated throughout the codebase:

### Controllers
- `downloadController.js`: Download operation logging
- `infoController.js`: Information endpoint logging
- `statusController.js`: Status endpoint logging

### Routes
- `downloadRoutes.js`: Route request logging
- `infoRoutes.js`: Info route logging
- `statusRoutes.js`: Status route logging

### Utils
- `downloadUtils.js`: Image download and browser logging

## Best Practices

1. **Use appropriate log levels**:
   - ERROR: For critical failures
   - WARN: For recoverable issues
   - INFO: For general progress
   - DEBUG: For detailed debugging

2. **Include relevant data**:
   - Always include context in log messages
   - Add structured data for filtering and analysis
   - Include timestamps for temporal analysis

3. **Monitor log files**:
   - Regularly check log files for errors
   - Use the log viewer script for analysis
   - Set up log rotation to manage disk space

4. **Configure log levels appropriately**:
   - Use DEBUG for development
   - Use INFO for production
   - Use ERROR/WARN for monitoring

## Troubleshooting

### Common Issues

1. **Log files not created**:
   - Check that the `logs/` directory exists
   - Ensure write permissions are set correctly

2. **Too much logging**:
   - Increase log level (e.g., set LOG_LEVEL=WARN)
   - Disable specific logging features via environment variables

3. **Log files too large**:
   - Configure log rotation settings
   - Increase LOG_MAX_SIZE environment variable

### Performance Considerations

- Logging to files is asynchronous and won't block operations
- Console logging is synchronous but minimal
- Use appropriate log levels to balance detail vs performance
- Consider disabling DEBUG logging in production

## Future Enhancements

- Log aggregation and analysis tools
- Real-time log streaming
- Log-based alerting system
- Performance metrics from logs
- Integration with external logging services 