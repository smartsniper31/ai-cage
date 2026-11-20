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
    // AMO requires data_collection_permissions inside gecko since Nov 3, 2025.
    // AI CAGE collects no data, so we declare "none" as required.
    // Reference: https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
    data_collection_permissions: {
      required: ['none'],
    },
  },
};

// Firefox MV3: replace service_worker with scripts.
// Having both simultaneously causes background.js to fail to start on some
// Firefox versions — service_worker must be deleted, not kept alongside scripts.
// Chrome is unaffected: it reads dist/manifest.json (source), not firefox-dist/.
if (manifest['background']?.['service_worker']) {
  const swFile = manifest['background']['service_worker'];
  delete manifest['background']['service_worker'];
  manifest['background']['scripts'] = [swFile];
}

// Firefox icon fix: Firefox recommends 48px and 96px as primary toolbar sizes.
// Without 96px, Firefox scales 128px down and the result is blurry.
// We explicitly set 48 and 96 as the preferred sizes for Firefox toolbar.
const ffIcons = {
  '16':  'icons/icon16.png',
  '32':  'icons/icon32.png',
  '48':  'icons/icon48.png',
  '96':  'icons/icon96.png',
  '128': 'icons/icon128.png',
};
manifest['icons'] = ffIcons;
if (manifest['action']) {
  manifest['action']['default_icon'] = ffIcons;
}

// Bump version for Firefox (match main version)
manifest['version'] = '0.6.0';

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('[AI CAGE] Patched manifest.json for Firefox');

// Step 3: Security check — no unauthorised network calls in bundle
//
// Intentional fetch() uses (excluded from the check):
//   popup.js    — fetches version.json from Vercel for the update checker
//   content.js  — fetch() + Blob URL fallback for Firefox CSP-restricted pages
//                 (injectPageScript Method 2: runs in content-script origin,
//                  outside the page CSP, to inject injected.js when a <script>
//                  tag is blocked by the host page's CSP on Firefox)
//
// background.js must NEVER contain fetch/XHR/WebSocket — checked strictly.
const bgContent = readFileSync(resolve(FIREFOX_DIR, 'background.js'), 'utf-8');
if (/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(bgContent)) {
  console.error('[AI CAGE] SECURITY: Network call found in background.js');
  process.exit(1);
}
// content.js: XMLHttpRequest and WebSocket are still forbidden; only fetch() is intentional.
const ctContent = readFileSync(resolve(FIREFOX_DIR, 'content.js'), 'utf-8');
if (/XMLHttpRequest|WebSocket/.test(ctContent)) {
  console.error('[AI CAGE] SECURITY: Unauthorised network call (XHR/WebSocket) found in content.js');
  process.exit(1);
}
console.log('[AI CAGE] ✅ Security check passed — no unauthorised network calls in core bundle');
console.log('[AI CAGE] ✅ Firefox extension ready: apps/extension/firefox-dist/');
