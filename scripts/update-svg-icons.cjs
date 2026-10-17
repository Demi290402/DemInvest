const fs = require('fs');
const path = require('path');

const logoPath = path.resolve('public/Logo_no_sfondo.png');
const b64 = fs.readFileSync(logoPath).toString('base64');

// 192x192 SVG with embedded Logo_no_sfondo.png
const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" fill="#0F172A"/>
  <image href="data:image/png;base64,${b64}" x="16" y="16" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

// 512x512 SVG with embedded Logo_no_sfondo.png
const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0F172A"/>
  <image href="data:image/png;base64,${b64}" x="40" y="40" width="432" height="432" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

fs.writeFileSync(path.resolve('public/icons/icon-192.svg'), svg192);
fs.writeFileSync(path.resolve('public/icons/icon-512.svg'), svg512);

console.log('Successfully replaced public/icons/icon-192.svg and icon-512.svg with Logo_no_sfondo.png!');
