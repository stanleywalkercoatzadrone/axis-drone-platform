#!/usr/bin/env node
// Strips the crossorigin attribute from Vite's generated script/link tags.
// Without crossorigin, browsers don't require CORS headers for same-origin assets.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../dist/index.html');

if (!existsSync(htmlPath)) {
  console.log('[strip-crossorigin] dist/index.html not found, skipping.');
  process.exit(0);
}

let html = readFileSync(htmlPath, 'utf8');
html = html
  .replace(/<script type="module" crossorigin/g, '<script type="module"')
  .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"')
  .replace(/<link rel="modulepreload" crossorigin/g, '<link rel="modulepreload"');

writeFileSync(htmlPath, html, 'utf8');
console.log('[strip-crossorigin] ✅ crossorigin attributes removed from dist/index.html');
