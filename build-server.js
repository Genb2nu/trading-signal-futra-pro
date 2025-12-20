import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy server files to dist
const serverFiles = [
  'src/server/index.js',
  'src/server/binanceService.js',
  'src/server/smcAnalyzer.js',
  'src/shared/smcDetectors.js'
];

const distDir = path.join(__dirname, 'dist');
const serverDir = path.join(distDir, 'server');
const sharedDir = path.join(distDir, 'shared');

// Create directories
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}
if (!fs.existsSync(sharedDir)) {
  fs.mkdirSync(sharedDir, { recursive: true });
}

// Copy server files
serverFiles.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(distDir, file.replace('src/', ''));
  const destDir = path.dirname(destPath);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied: ${file} -> ${destPath}`);
});

// Update the server index.js to serve from correct path
const serverIndexPath = path.join(serverDir, 'index.js');
let serverContent = fs.readFileSync(serverIndexPath, 'utf-8');

// Update the static path to point to dist root
serverContent = serverContent.replace(
  "const staticPath = path.join(__dirname, '../dist');",
  "const staticPath = path.join(__dirname, '../');"
);

fs.writeFileSync(serverIndexPath, serverContent);

console.log('\n✅ Build complete! Server files copied to dist/');
console.log('📦 To run the production build: node dist/server/index.js');
