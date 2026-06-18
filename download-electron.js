// Run once: node download-electron.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electronDir = path.dirname(require.resolve('electron'));
const distPath = path.join(electronDir, 'dist');
const pathTxt = path.join(electronDir, 'path.txt');

// The zip was already downloaded to the cache
const zipPath = '/Users/lewisfelix/Library/Caches/electron/c94f2fc32e1fb05767f75322ea533eeb9828155f017ec184140930a3ec825e81/electron-v31.7.7-darwin-arm64.zip';

if (!fs.existsSync(zipPath)) {
  console.error('Zip not found at:', zipPath);
  console.error('Run the original download-electron.js first to re-download it.');
  process.exit(1);
}

console.log('Clearing old dist...');
execSync(`rm -rf "${distPath}"`);
fs.mkdirSync(distPath, { recursive: true });

console.log('Extracting electron-v31.7.7-darwin-arm64.zip ...');
execSync(`unzip -q "${zipPath}" -d "${distPath}"`, { stdio: 'inherit' });

console.log('Writing path.txt...');
fs.writeFileSync(pathTxt, 'Electron.app/Contents/MacOS/Electron');

const size = execSync(`du -sh "${distPath}"`).toString().split('\t')[0];
console.log(`\nDone! dist/ is now ${size}`);
console.log('Run: npm run dev');
