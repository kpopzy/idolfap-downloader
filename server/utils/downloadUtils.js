import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { config } from '../config/app.js';
import logger from './logger.js';
import { launchBrowserWithRetry, createPage, closeBrowser } from './browserUtils.js';

// Create downloads directory
const downloadsDir = path.join(process.cwd(), '../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Common function to download images from a post
export async function downloadImagesFromPost(postPage, downloadDir, context = '') {
  const images = [];
  const imageLogger = logger.withContext('ImageDownload');
  
  // First try to get images from the slider structure
  let imageUrls = await postPage.$$eval(
    '.post-slider-item.open-gallery img',
    els => els.map(img => img.src)
  );

  // If no images found in slider, fall back to post-content links
  if (imageUrls.length === 0) {
    imageUrls = await postPage.$$eval(
      '.post-content a',
      els => els.map(a => a.href)
    );
  }

  imageLogger.info(`Found ${imageUrls.length} images to download`, { context, imageCount: imageUrls.length });

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const filename = path.basename(new URL(imageUrl).pathname);
    const savePath = path.join(downloadDir, filename);

    try {
      await fs.promises.access(savePath);
      imageLogger.debug(`Skipping ${filename}, already exists`, { filename, context });
      continue;
    } catch {}

    imageLogger.imageDownloadStart(filename, context);
    try {
      const response = await postPage.goto(imageUrl, {
        timeout: config.download.timeout,
        waitUntil: 'domcontentloaded' // Use faster wait condition for image downloads
      });

      const buffer = await response.buffer();
      await fs.promises.writeFile(savePath, buffer);
      imageLogger.imageDownloadSuccess(filename, context);
      images.push({ filename, success: true });
    } catch (err) {
      imageLogger.imageDownloadError(filename, err, context);
      images.push({ filename, success: false, error: err.message });
    }
  }

  const successfulImages = images.filter(img => img.success).length;
  const failedImages = images.filter(img => !img.success).length;
  
  imageLogger.info(`Image download batch completed: ${successfulImages} successful, ${failedImages} failed`, {
    context,
    successfulImages,
    failedImages,
    totalImages: images.length
  });

  return images;
}

// Common function to launch browser
export async function launchBrowser() {
  return await launchBrowserWithRetry();
}

// Get downloads directory
export function getDownloadsDir() {
  return downloadsDir;
}

// Create directory if it doesn't exist
export function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
} 