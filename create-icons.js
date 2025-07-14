// Simple script to create basic PWA icons
// Run with: node create-icons.js

const fs = require('fs');

// Create a simple SVG icon
const createSVGIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${size * 0.1}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
        fill="white" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold">
    Z
  </text>
</svg>`;

// Icon sizes needed for PWA
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

console.log('Creating basic PWA icons...');

sizes.forEach(size => {
  const svg = createSVGIcon(size);
  fs.writeFileSync(`public/icon-${size}x${size}.svg`, svg);
  console.log(`Created icon-${size}x${size}.svg`);
});

console.log('Icons created! Convert SVGs to PNG using an online converter or image editing tool.');
console.log('Recommended: https://convertio.co/svg-png/ or similar service');