/**
 * build-firefox.mjs
 * Builds the Firefox-compatible extension by:
 *   1. Running the standard Chrome MV3 build
 *   2. Copying dist/ to firefox-dist/
 *   3. Patching manifest.json with Firefox-specific settings
 *
 * Firefox supports MV3 but with some differences:
 *   - `browser_specific_settings.gecko.id` required for signing
 *   - `background.service_worker` → Firefox prefers `background.scripts` (MV2 compat)
 *   - `webRequest` is still available in Firefox MV3 (unlike Chrome MV3 which restricts it)
 *
 * Usage: node build-firefox.mjs
 */

import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, 'dist');
const FIREFOX_DIR = resolve(__dirname, 'firefox-dist');

console.log('[AI CAGE] Building Firefox extension...');

// Step 1: Copy all files from dist/ to firefox-dist/
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = resolve(src, entry.name);
    const d = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

if (!existsSync(DIST_DIR)) {
  console.error('[AI CAGE] dist/ not found. Run "pnpm --filter @ai-cage/extension build" first.');
  process.exit(1);
}

copyDir(DIST_DIR, FIREFOX_DIR);
console.log('[AI CAGE] Copied dist/ → firefox-dist/');

// Step 2: Patch manifest.json for Firefox
const manifestPath = resolve(FIREFOX_DIR, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Add Firefox-specific settings
manifest['browser_specific_settings'] = {
  gecko: {
    id: 'ai-cage@ai-cage.io',
    strict_min_version: '115.0',
  },
};

// Firefox MV3 uses background.scripts instead of service_worker
// (Firefox 121+ supports service_worker, but scripts is more compatible)
if (manifest['background']?.['service_worker']) {
  manifest['background']['scripts'] = [manifest['background']['service_worker']];
  // Keep service_worker for Firefox 121+ but also add scripts for older versions
}

// Bump version for Firefox (match main version)
manifest['version'] = '0.6.0';

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('[AI CAGE] Patched manifest.json for Firefox');

// Step 3: Security check — no network calls in bundle
for (const file of ['background.js', 'content.js', 'popup.js']) {
  const content = readFileSync(resolve(FIREFOX_DIR, file), 'utf-8');
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(content)) {
    console.error(`[AI CAGE] SECURITY: Network call found in ${file}`);
    process.exit(1);
  }
}
console.log('[AI CAGE] ✅ Security check passed — no network calls in bundle');
console.log('[AI CAGE] ✅ Firefox extension ready: apps/extension/firefox-dist/');
