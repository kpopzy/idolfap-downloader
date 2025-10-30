import express from 'express';
import { 
  downloadIdolImages, 
  downloadSinglePost, 
  downloadCreatorPosts 
} from '../controllers/downloadController.js';
import {
  validateIdolDownload,
  validateSinglePostDownload,
  validateCreatorDownload
} from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Download idol images endpoint
router.post('/download', validateIdolDownload, async (req, res) => {
  const { idolName, start, end } = req.body;
  const routeLogger = logger.withContext('Route-Download');

  routeLogger.info(`Download request received for ${idolName}`, { idolName, start, end });

  try {
    const result = await downloadIdolImages(idolName, parseInt(start), parseInt(end));
    
    routeLogger.info(`Download request completed successfully for ${idolName}`, { 
      idolName, 
      result: {
        pagesProcessed: result.pagesProcessed,
        imagesDownloaded: result.imagesDownloaded,
        errors: result.errors.length
      }
    });
    
    res.json({
      success: true,
      message: `Download completed for ${idolName}`,
      data: result
    });
  } catch (error) {
    routeLogger.error(`Download request failed for ${idolName}`, { 
      idolName, 
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download single post endpoint
router.post('/download/single', validateSinglePostDownload, async (req, res) => {
  const { postUrl } = req.body;
  const routeLogger = logger.withContext('Route-Single');

  routeLogger.info(`Single post download request received`, { postUrl });

  try {
    const result = await downloadSinglePost(postUrl);
    
    routeLogger.info(`Single post download request completed successfully`, { 
      postUrl,
      result: {
        imagesDownloaded: result.imagesDownloaded,
        errors: result.errors.length
      }
    });
    
    res.json({
      success: true,
      message: `Single post download completed`,
      data: result
    });
  } catch (error) {
    routeLogger.error(`Single post download request failed`, { 
      postUrl, 
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download creator posts endpoint
router.post('/download/creator', validateCreatorDownload, async (req, res) => {
  const { creatorName } = req.body;
  const routeLogger = logger.withContext('Route-Creator');

  routeLogger.info(`Creator download request received for ${creatorName}`, { creatorName });

  try {
    const result = await downloadCreatorPosts(creatorName);
    
    routeLogger.info(`Creator download request completed successfully for ${creatorName}`, { 
      creatorName,
      result: {
        pagesProcessed: result.pagesProcessed,
        postsProcessed: result.postsProcessed,
        imagesDownloaded: result.imagesDownloaded,
        errors: result.errors.length
      }
    });
    
    res.json({
      success: true,
      message: `Creator download completed for ${creatorName}`,
      data: result
    });
  } catch (error) {
    routeLogger.error(`Creator download request failed for ${creatorName}`, { 
      creatorName, 
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router; 