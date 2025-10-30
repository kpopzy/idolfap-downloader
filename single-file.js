import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Get post URL from command-line arguments
const postUrl = process.argv[2];

if (!postUrl) {
  console.error('❌ Please provide a post URL as a parameter. Example: node single-file.js "https://idolfap.com/post/110673/"');
  process.exit(1);
}

(async () => {
  console.log('Starting single post download...');
  console.log(`Post URL: ${postUrl}`);

  // Use single folder for all single post downloads
  const downloadDir = path.resolve('./single');
  fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(postUrl, { timeout: 60000 });

    // First try to get images from the slider structure
    let images = await page.$$eval(
      '.post-slider-item.open-gallery img',
      els => els.map(img => img.src)
    );

    // If no images found in slider, fall back to post-content links
    if (images.length === 0) {
      images = await page.$$eval(
        '.post-content a',
        els => els.map(a => a.href)
      );
    }

    console.log('----------------------------------------------------------------');
    console.log(`Found ${images.length} images in post: ${postUrl}`);

    for (let imageUrl of images) {
      const filename = path.basename(new URL(imageUrl).pathname);
      const savePath = path.join(downloadDir, filename);

      try {
        await fs.promises.access(savePath);
        console.log(`✓ Skipping ${filename}, already exists.`);
        continue;
      } catch {}

      console.log(`Downloading: ${imageUrl}`);
      try {
        const response = await page.goto(imageUrl, {
          timeout: 60000,
          waitUntil: 'networkidle2'
        });

        const buffer = await response.buffer();
        await fs.promises.writeFile(savePath, buffer);
        console.log(`✓ Saved ${filename}`);
      } catch (err) {
        console.error(`✗ Failed ${filename}: ${err.message}`);
      }
    }

  } catch (err) {
    console.error(`Error processing post: ${err.message}`);
  }

  await page.close();
  await browser.close();
  console.log('Download completed!');
})(); 