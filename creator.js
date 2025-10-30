import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Get creatorName from command-line arguments
const creatorName = process.argv[2];

if (!creatorName) {
  console.error('❌ Please provide a creator name as a parameter. Example: node creator.js darkyeji');
  process.exit(1);
}

(async () => {
  console.log('Starting creator download...');
  console.log(`Creator: ${creatorName}`);

  const downloadDir = path.resolve('./creator');
  fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let pageNumber = 1;
  let totalPostsProcessed = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    try {
      const pageUrl = pageNumber === 1 
        ? `https://idolfap.com/creator/${creatorName}/`
        : `https://idolfap.com/creator/${creatorName}/page/${pageNumber}/`;
      
      console.log(`\n--- Processing page ${pageNumber}: ${pageUrl} ---`);
      await page.goto(pageUrl, { timeout: 60000 });

      const postLinks = await page.$$eval(
        'body > div > main > div.grid.grid-show .post-image-wrapper > a',
        els => els.map(a => a.href)
      );

      if (postLinks.length === 0) {
        console.log(`No posts found on page ${pageNumber}. Ending download.`);
        hasMorePages = false;
        break;
      }

      console.log(`Found ${postLinks.length} posts on page ${pageNumber}`);

      for (let i = 0; i < postLinks.length; i++) {
        const postLink = postLinks[i];
        const postPage = await browser.newPage();
        
        try {
          await postPage.goto(postLink, { timeout: 60000 });

          // First try to get images from the slider structure
          let images = await postPage.$$eval(
            '.post-slider-item.open-gallery img',
            els => els.map(img => img.src)
          );

          // If no images found in slider, fall back to post-content links
          if (images.length === 0) {
            images = await postPage.$$eval(
              '.post-content a',
              els => els.map(a => a.href)
            );
          }

          totalPostsProcessed++;
          console.log('----------------------------------------------------------------');
          console.log(`Found ${images.length} images (${creatorName}) on post ${totalPostsProcessed}: ${postLink}`);

          for (let imageUrl of images) {
            const filename = path.basename(new URL(imageUrl).pathname);
            const savePath = path.join(downloadDir, filename);

            try {
              await fs.promises.access(savePath);
              console.log(`✓ Skipping ${filename}, already exists.`);
              continue;
            } catch {}

            console.log(`Downloading (${creatorName}) [post ${totalPostsProcessed}] : ${imageUrl}`);
            try {
              const response = await postPage.goto(imageUrl, {
                timeout: 60000,
                waitUntil: 'networkidle2'
              });

              const buffer = await response.buffer();
              await fs.promises.writeFile(savePath, buffer);
              console.log(`✓ Saved (${creatorName}) ${filename}`);
            } catch (err) {
              console.error(`✗ Failed ${filename}: ${err.message}`);
            }
          }

        } catch (err) {
          console.error(`Error processing post ${totalPostsProcessed}: ${err.message}`);
        }

        await postPage.close();
      }

      pageNumber++;
      
    } catch (navErr) {
      console.error(`Error accessing page ${pageNumber}: ${navErr.message}`);
      hasMorePages = false;
    }
  }

  await page.close();
  await browser.close();
  console.log(`\nCreator download completed! Total posts processed: ${totalPostsProcessed}`);
})(); 