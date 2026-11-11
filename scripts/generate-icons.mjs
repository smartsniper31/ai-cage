/**
 * scripts/generate-icons.mjs
 * AI CAGE — Icon Generator
 *
 * Generates branded PNG icons for the Tauri desktop app.
 * Uses only Node.js built-ins — no npm install required.
 *
 * The icon is a green square (#15803d) with a white lock (🔒) symbol
 * drawn as simple SVG paths, converted to PNG via the Canvas API
 * (available in Node.js 18+ via global `createImageBitmap` / fetch,
 * but we use a pure SVG→PNG approach via the Tauri CLI icon generator).
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 *
 * This creates:
 *   apps/desktop/src-tauri/icons/app-icon.svg  (source)
 *   Then runs: pnpm tauri icon app-icon.svg
 *   Which generates all required sizes automatically.
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const ICONS_DIR = resolve(ROOT, 'apps/desktop/src-tauri/icons');
const SVG_PATH  = resolve(ICONS_DIR, 'app-icon.svg');

// ── AI CAGE branded SVG icon ──────────────────────────────────────────────────
// Green background (#15803d) + white padlock shape
// Padlock is drawn as pure SVG paths — no emoji rendering needed
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Background: AI CAGE green -->
  <rect width="512" height="512" rx="96" ry="96" fill="#15803d"/>

  <!-- Lock shackle (arc) -->
  <path
    d="M 176 220
       L 176 170
       A 80 80 0 0 1 336 170
       L 336 220"
    stroke="white"
    stroke-width="40"
    stroke-linecap="round"
    fill="none"
  />

  <!-- Lock body -->
  <rect x="136" y="216" width="240" height="180" rx="24" ry="24" fill="white"/>

  <!-- Keyhole circle -->
  <circle cx="256" cy="296" r="30" fill="#15803d"/>

  <!-- Keyhole stem -->
  <rect x="242" y="296" width="28" height="50" rx="6" ry="6" fill="#15803d"/>
</svg>`;

// Write SVG
writeFileSync(SVG_PATH, SVG, 'utf8');
console.log(`[icons] ✅ SVG written: ${SVG_PATH}`);

// Use Tauri CLI to generate all icon sizes from SVG
// This creates: 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico
const DESKTOP_DIR = resolve(ROOT, 'apps/desktop');

try {
  console.log('[icons] Generating all icon sizes via Tauri CLI...');
  execSync(
    `node_modules/.bin/tauri icon "${SVG_PATH}"`,
    {
      cwd:    DESKTOP_DIR,
      stdio:  'inherit',
    }
  );
  console.log('[icons] ✅ All Tauri icon sizes generated successfully');
  console.log('[icons] Files updated:');
  console.log('  - icons/32x32.png');
  console.log('  - icons/128x128.png');
  console.log('  - icons/128x128@2x.png');
  console.log('  - icons/icon.icns');
  console.log('  - icons/icon.ico');
} catch (err) {
  console.error('[icons] ❌ Tauri icon generation failed:', err.message);
  console.error('[icons] Make sure you are in the correct directory and Tauri CLI is installed.');
  process.exit(1);
}
