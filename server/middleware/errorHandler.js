// Error handling middleware
export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  };

  // Validation errors
  if (err.name === 'ValidationError') {
    error.status = 400;
    error.message = 'Validation Error';
    error.details = err.details;
  }

  // Puppeteer errors
  if (err.message && err.message.includes('puppeteer')) {
    error.status = 500;
    error.message = 'Browser error occurred during download';
  }

  res.status(error.status).json({
    success: false,
    error: error.message,
    details: error.details
  });
}

// 404 handler
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Route ${req.method} ${req.path} does not exist`
  });
} 