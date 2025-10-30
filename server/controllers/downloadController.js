import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { config } from '../config/app.js';
import { 
  downloadImagesFromPost, 
  launchBrowser, 
  getDownloadsDir, 
  ensureDirectory 
} from '../utils/downloadUtils.js';
import { createPage, closeBrowser } from '../utils/browserUtils.js';
import logger from '../utils/logger.js';

// Helper function to retry page navigation
async function navigateWithRetry(page, url, context = '', maxRetries = config.download.retries) {
  const downloadLogger = logger.withContext('Navigation');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      downloadLogger.info(`Navigation attempt ${attempt}/${maxRetries} for ${context}`, { url, attempt });
      
      await page.goto(url, { 
        timeout: config.download.timeout,
        waitUntil: config.download.waitUntil
      });
      
      downloadLogger.info(`Navigation successful for ${context}`, { url, attempt });
      return true;
      
    } catch (error) {
      downloadLogger.error(`Navigation attempt ${attempt} failed for ${context}`, { 
        url, 
        attempt, 
        error: error.message 
      });
      
      if (attempt === maxRetries) {
        downloadLogger.error(`All navigation attempts failed for ${context}`, { url, error: error.message });
        throw error;
      }
      
      // Short wait before retry for 3-second timeout
      const waitTime = 500;
      downloadLogger.info(`Waiting ${waitTime}ms before retry for ${context}`, { waitTime, attempt });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Download images for idols
export async function downloadIdolImages(idolName, start, end) {
  const downloadLogger = logger.withContext(`Download-${idolName}`);
  
  downloadLogger.downloadStart(idolName, start, end);
  
  const downloadDir = ensureDirectory(path.join(getDownloadsDir(), idolName));
  
  downloadLogger.browserLaunch();
  
  let browser;
  try {
    browser = await launchBrowser();
    downloadLogger.info('Browser launched successfully, creating new page');
  } catch (error) {
    downloadLogger.error('Failed to launch browser', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
  
  const page = await createPage(browser);
  
  const results = {
    idolName,
    pagesProcessed: 0,
    imagesDownloaded: 0,
    errors: []
  };

  try {
    const totalPages = end - start + 1;
    
    for (let index = start; index <= end; index++) {
      try {
        const pageUrl = `https://idolfap.com/idols/${idolName}/page/${index}/`;
        downloadLogger.pageNavigation(pageUrl);
        
        downloadLogger.downloadWaiting(idolName, `Loading page ${index}`);
        
        // Use retry logic for page navigation
        await navigateWithRetry(page, pageUrl, `Page ${index} for ${idolName}`);

        const postLinks = await page.$$eval(
          '.grid.grid-show .post-image-wrapper > a',
          els => els.map(a => a.href)
        );

        downloadLogger.info(`Found ${postLinks.length} posts on page ${index}`, { page: index, postCount: postLinks.length });

        for (let postIndex = 0; postIndex < postLinks.length; postIndex++) {
          const postLink = postLinks[postIndex];
          const postPage = await browser.newPage();
          
          try {
            downloadLogger.pageNavigation(postLink, `Post ${postIndex + 1}/${postLinks.length}`);
            
            // Use retry logic for post page navigation
            await navigateWithRetry(postPage, postLink, `Post ${postIndex + 1} on page ${index}`);

            const downloadedImages = await downloadImagesFromPost(
              postPage, 
              downloadDir, 
              `(${idolName}) [page/${index}]`
            );

            const successfulImages = downloadedImages.filter(img => img.success).length;
            const failedImages = downloadedImages.filter(img => !img.success).length;
            
            results.imagesDownloaded += successfulImages;
            results.errors.push(...downloadedImages.filter(img => !img.success));
            
            downloadLogger.info(`Post ${postIndex + 1} completed: ${successfulImages} images downloaded, ${failedImages} failed`, {
              postIndex: postIndex + 1,
              successfulImages,
              failedImages
            });

          } catch (err) {
            downloadLogger.error(`Error processing post ${postIndex + 1} on page ${index}`, { 
              postIndex: postIndex + 1, 
              page: index, 
              error: err.message 
            });
            results.errors.push({
              page: index,
              post: postIndex + 1,
              error: err.message
            });
          }

          await postPage.close();
        }
        
        results.pagesProcessed++;
        downloadLogger.downloadProgress(idolName, results.pagesProcessed, totalPages, results.imagesDownloaded);
        
      } catch (navErr) {
        downloadLogger.pageError(`https://idolfap.com/idols/${idolName}/page/${index}/`, navErr);
        results.errors.push({
          page: index,
          error: navErr.message
        });
      }
    }
  } finally {
    await page.close();
    downloadLogger.browserClose();
    await closeBrowser(browser);
  }

  downloadLogger.downloadSuccess(idolName, results);
  return results;
}

// Download single post
export async function downloadSinglePost(postUrl) {
  const downloadLogger = logger.withContext('Download-Single');
  
  downloadLogger.info(`🚀 Starting single post download: ${postUrl}`);
  
  const downloadDir = ensureDirectory(path.join(getDownloadsDir(), 'single'));
  
  downloadLogger.browserLaunch();
  const browser = await launchBrowser();
  const page = await createPage(browser);
  
  const results = {
    postUrl,
    imagesDownloaded: 0,
    errors: []
  };

  try {
    downloadLogger.pageNavigation(postUrl);
    downloadLogger.downloadWaiting('Single Post', 'Loading post page');
    
    // Use retry logic for page navigation
    await navigateWithRetry(page, postUrl, 'Single Post');

    const downloadedImages = await downloadImagesFromPost(page, downloadDir, '');
    
    const successfulImages = downloadedImages.filter(img => img.success).length;
    const failedImages = downloadedImages.filter(img => !img.success).length;
    
    results.imagesDownloaded = successfulImages;
    results.errors = downloadedImages.filter(img => !img.success);
    
    downloadLogger.info(`Single post download completed: ${successfulImages} images downloaded, ${failedImages} failed`, {
      successfulImages,
      failedImages,
      postUrl
    });

  } catch (err) {
    downloadLogger.downloadError('Single Post', err, 'Post processing');
    results.errors.push({
      error: err.message
    });
  } finally {
    await page.close();
    downloadLogger.browserClose();
    await browser.close();
  }

  downloadLogger.downloadSuccess('Single Post', results);
  return results;
}

// Download creator posts
export async function downloadCreatorPosts(creatorName) {
  const downloadLogger = logger.withContext(`Download-Creator-${creatorName}`);
  
  downloadLogger.info(`🚀 Starting creator download for ${creatorName}`);
  
  const downloadDir = ensureDirectory(path.join(getDownloadsDir(), 'creator'));
  
  downloadLogger.browserLaunch();
  const browser = await launchBrowser();
  const page = await createPage(browser);
  
  const results = {
    creatorName,
    pagesProcessed: 0,
    postsProcessed: 0,
    imagesDownloaded: 0,
    errors: []
  };

  let pageNumber = 1;
  let hasMorePages = true;

  try {
    while (hasMorePages) {
      try {
        const pageUrl = pageNumber === 1 
          ? `https://idolfap.com/creator/${creatorName}/`
          : `https://idolfap.com/creator/${creatorName}/page/${pageNumber}/`;
        
        downloadLogger.pageNavigation(pageUrl, `Page ${pageNumber}`);
        downloadLogger.downloadWaiting(creatorName, `Loading page ${pageNumber}`);
        
        // Use retry logic for page navigation
        await navigateWithRetry(page, pageUrl, `Page ${pageNumber} for ${creatorName}`);

        const postLinks = await page.$$eval(
          'body > div > main > div.grid.grid-show .post-image-wrapper > a',
          els => els.map(a => a.href)
        );

        if (postLinks.length === 0) {
          downloadLogger.info(`No posts found on page ${pageNumber}. Ending download.`, { pageNumber });
          hasMorePages = false;
          break;
        }

        downloadLogger.info(`Found ${postLinks.length} posts on page ${pageNumber}`, { pageNumber, postCount: postLinks.length });

        for (let i = 0; i < postLinks.length; i++) {
          const postLink = postLinks[i];
          const postPage = await browser.newPage();
          
          try {
            downloadLogger.pageNavigation(postLink, `Post ${i + 1}/${postLinks.length}`);
            
            // Use retry logic for post page navigation
            await navigateWithRetry(postPage, postLink, `Post ${i + 1} on page ${pageNumber} for ${creatorName}`);

            results.postsProcessed++;
            downloadLogger.info(`Processing post ${results.postsProcessed} for ${creatorName}`, { 
              postNumber: results.postsProcessed, 
              postUrl: postLink 
            });

            const downloadedImages = await downloadImagesFromPost(
              postPage, 
              downloadDir, 
              `(${creatorName}) [post ${results.postsProcessed}]`
            );

            const successfulImages = downloadedImages.filter(img => img.success).length;
            const failedImages = downloadedImages.filter(img => !img.success).length;
            
            results.imagesDownloaded += successfulImages;
            results.errors.push(...downloadedImages.filter(img => !img.success));
            
            downloadLogger.info(`Post ${results.postsProcessed} completed: ${successfulImages} images downloaded, ${failedImages} failed`, {
              postNumber: results.postsProcessed,
              successfulImages,
              failedImages
            });

          } catch (err) {
            downloadLogger.error(`Error processing post ${results.postsProcessed}`, { 
              postNumber: results.postsProcessed, 
              error: err.message 
            });
            results.errors.push({
              post: results.postsProcessed,
              error: err.message
            });
          }

          await postPage.close();
        }

        results.pagesProcessed++;
        downloadLogger.info(`Page ${pageNumber} completed. Total: ${results.pagesProcessed} pages, ${results.postsProcessed} posts, ${results.imagesDownloaded} images`, {
          pageNumber,
          pagesProcessed: results.pagesProcessed,
          postsProcessed: results.postsProcessed,
          imagesDownloaded: results.imagesDownloaded
        });
        pageNumber++;
        
      } catch (navErr) {
        downloadLogger.pageError(`https://idolfap.com/creator/${creatorName}/page/${pageNumber}/`, navErr);
        results.errors.push({
          page: pageNumber,
          error: navErr.message
        });
        hasMorePages = false;
      }
    }
  } finally {
    await page.close();
    downloadLogger.browserClose();
    await browser.close();
  }

  downloadLogger.downloadSuccess(creatorName, results);
  return results;
} 