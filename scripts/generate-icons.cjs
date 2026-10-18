const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const logoPath = path.resolve('public/Logo_no_sfondo.png');
  const logoData = fs.readFileSync(logoPath).toString('base64');
  const logoSrc = `data:image/png;base64,${logoData}`;

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const targets = [
    { file: 'public/icons/icon-192.png', size: 192, pad: 16, bg: '#0F172A' },
    { file: 'public/icons/icon-512.png', size: 512, pad: 44, bg: '#0F172A' },
    { file: 'public/icons/icon-maskable-192.png', size: 192, pad: 32, bg: '#0F172A' },
    { file: 'public/icons/icon-maskable-512.png', size: 512, pad: 84, bg: '#0F172A' },
    { file: 'public/icons/apple-touch-icon.png', size: 180, pad: 14, bg: '#0F172A' },
    { file: 'public/apple-touch-icon.png', size: 180, pad: 14, bg: '#0F172A' },
    { file: 'public/favicon.png', size: 192, pad: 6, bg: 'transparent' },
    { file: 'public/icons/icon-192-transparent.png', size: 192, pad: 6, bg: 'transparent' },
    { file: 'public/icons/icon-512-transparent.png', size: 512, pad: 16, bg: 'transparent' },
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

    const s = fs.statSync(path.resolve(t.file));
    console.log(`Generated: ${t.file} (${t.size}x${t.size}) -> ${s.size} bytes`);
    await page.close();
  }

  await browser.close();

  // Overwrite SVG fallbacks with the high-res embedded SVG
  const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" fill="#0F172A"/>
  <image href="${logoSrc}" x="16" y="16" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
  const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0F172A"/>
  <image href="${logoSrc}" x="44" y="44" width="424" height="424" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
  fs.writeFileSync(path.resolve('public/icons/icon-192.svg'), svg192);
  fs.writeFileSync(path.resolve('public/icons/icon-512.svg'), svg512);
  console.log('Overwritten public/icons/icon-192.svg and icon-512.svg with embedded official logo.');

  console.log('All mobile and PWA icons generated and verified successfully!');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
