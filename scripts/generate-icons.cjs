const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const logoPath = path.resolve('public/Logo_no_sfondo.png');
  const logoData = fs.readFileSync(logoPath).toString('base64');
  const logoSrc = `data:image/png;base64,${logoData}`;

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const targets = [
    { file: 'public/icons/icon-192.png', size: 192, pad: 14, bg: '#0F172A', rounded: false },
    { file: 'public/icons/icon-512.png', size: 512, pad: 36, bg: '#0F172A', rounded: false },
    { file: 'public/icons/icon-maskable-512.png', size: 512, pad: 80, bg: '#0F172A', rounded: false },
    { file: 'public/icons/apple-touch-icon.png', size: 180, pad: 14, bg: '#0F172A', rounded: false },
    { file: 'public/apple-touch-icon.png', size: 180, pad: 14, bg: '#0F172A', rounded: false },
    // Also transparent version for standard web favicon
    { file: 'public/icons/icon-192-transparent.png', size: 192, pad: 8, bg: 'transparent', rounded: false },
    { file: 'public/icons/icon-512-transparent.png', size: 512, pad: 16, bg: 'transparent', rounded: false }
  ];

  for (const t of targets) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${t.size}px;
            height: ${t.size}px;
            background: ${t.bg};
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          img {
            width: ${t.size - t.pad * 2}px;
            height: ${t.size - t.pad * 2}px;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${logoSrc}" alt="DemInvest" />
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.screenshot({
      path: path.resolve(t.file),
      omitBackground: t.bg === 'transparent'
    });
    console.log(`Generated: ${t.file} (${t.size}x${t.size})`);
    await page.close();
  }

  await browser.close();
  console.log('All mobile icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
