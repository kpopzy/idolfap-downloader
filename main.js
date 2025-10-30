import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Get idolName from command-line arguments
const idolName = process.argv[2];
const start = parseInt(process.argv[3]);
const end = parseInt(process.argv[4]);

if (!idolName) {
  console.error('❌ Please provide an idol name as a parameter. Example: node jihyo.js jihyo');
  process.exit(1);
}

(async () => {
console.log('Starting...')
console.log(idolName)
console.log(start)
console.log(end)
  if(!idolName | !start | !end) {
    console.log(`Example : node main.js jihyo 1 10`)
    process.exit(1);
  }

  const downloadDir = path.resolve('./downloads/' + idolName);
  fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (let index = start; index <= end; index++) {
    try {
      await page.goto(`https://idolfap.com/idols/${idolName}/page/${index}/`, { timeout: 60000 });

      const postLinks = await page.$$eval(
        '.grid.grid-show .post-image-wrapper > a',
        els => els.map(a => a.href)
      );

      for (let postLink of postLinks) {
        const postPage = await browser.newPage();
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

        console.log('----------------------------------------------------------------');
        console.log(`Found ${images.length} images (${idolName}) on ${postLink}`);

        for (let imageUrl of images) {
          const filename = path.basename(new URL(imageUrl).pathname);
          const savePath = path.join(downloadDir, filename);

          try {
            await fs.promises.access(savePath);
            console.log(`✓ Skipping ${filename}, already exists.`);
            continue;
          } catch {}

          console.log(`Downloading (${idolName}) [page/${index}] : ${imageUrl}`);
          try {
            const response = await postPage.goto(imageUrl, {
              timeout: 60000,
              waitUntil: 'networkidle2'
            });

            const buffer = await response.buffer();
            await fs.promises.writeFile(savePath, buffer);
            console.log(`✓ Saved (${idolName}) ${filename}`);
          } catch (err) {
            console.error(`✗ Failed ${filename}: ${err.message}`);
          }
        }

        await postPage.close();
      }
    } catch (navErr) {
      console.error(`Error on page ${index}: ${navErr.message}`);
    }
  }

  await page.close();
  await browser.close();
})();
