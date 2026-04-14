#!/usr/bin/env node
/**
 * Build script: copies app files into dist/ and stamps a unique
 * cache version into sw.js so the service worker busts the cache
 * on every new deployment.
 */
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(__dirname, 'dist');

// Files/dirs to include in the build
const INCLUDE = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'icons',
];

// ===== Helpers =====
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ===== Build =====
const version = `v${Date.now()}`;
console.log(`Building... cache version: ${version}`);

// Clean dist
rm(DIST);
fs.mkdirSync(DIST, { recursive: true });

// Copy assets
for (const item of INCLUDE) {
  const src = path.join(SRC, item);
  const dest = path.join(DIST, item);
  if (!fs.existsSync(src)) {
    console.warn(`  SKIP (not found): ${item}`);
    continue;
  }
  copyRecursive(src, dest);
  console.log(`  Copied: ${item}`);
}

// Stamp cache version into dist/sw.js
const swPath = path.join(DIST, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(
  /const CACHE_NAME = 'soccer-score-tracker-[^']*'/,
  `const CACHE_NAME = 'soccer-score-tracker-${version}'`
);
fs.writeFileSync(swPath, swContent);
console.log(`  Stamped cache version in sw.js`);

console.log(`\nBuild complete -> dist/`);
