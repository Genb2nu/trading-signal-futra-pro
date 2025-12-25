import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple icon generator using Node.js
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const sourcePath = path.join(__dirname, 'public', 'icon-original.png');

// For now, just copy the original to all sizes
// Browsers will handle the resizing automatically
sizes.forEach(size => {
  const destPath = path.join(__dirname, 'public', `icon-${size}.png`);
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Created icon-${size}.png`);
});

console.log('✅ All icons generated successfully!');
console.log('Note: Using original image for all sizes. Browsers will auto-resize.');
