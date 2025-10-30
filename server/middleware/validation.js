// Validation middleware for download requests
export function validateIdolDownload(req, res, next) {
  const { idolName, start, end } = req.body;

  if (!idolName || !start || !end) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'Please provide idolName, start, and end parameters',
      example: {
        idolName: 'jihyo',
        start: 1,
        end: 10
      }
    });
  }

  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({
      error: 'Invalid parameters',
      message: 'start and end must be numbers'
    });
  }

  if (parseInt(start) > parseInt(end)) {
    return res.status(400).json({
      error: 'Invalid range',
      message: 'start must be less than or equal to end'
    });
  }

  next();
}

export function validateSinglePostDownload(req, res, next) {
  const { postUrl } = req.body;

  if (!postUrl) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'Please provide postUrl parameter',
      example: {
        postUrl: 'https://idolfap.com/post/110673/'
      }
    });
  }

  if (!postUrl.startsWith('https://idolfap.com/')) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: 'postUrl must be a valid idolfap.com URL'
    });
  }

  next();
}

export function validateCreatorDownload(req, res, next) {
  const { creatorName } = req.body;

  if (!creatorName) {
    return res.status(400).json({
      error: 'Missing required parameters',
      message: 'Please provide creatorName parameter',
      example: {
        creatorName: 'darkyeji'
      }
    });
  }

  if (typeof creatorName !== 'string' || creatorName.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid creator name',
      message: 'creatorName must be a non-empty string'
    });
  }

  next();
} 