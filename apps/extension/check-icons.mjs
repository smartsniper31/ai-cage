/**
 * check-icons.mjs
 * Verifies that every required PNG icon in apps/extension/dist/icons/ has the
 * correct pixel dimensions (iconNNN.png must be NxN pixels).
 *
 * If a wrong-size icon is found it is auto-corrected by bilinear-downscaling
 * the nearest larger correct icon.  The corrected file is written back to
 * dist/icons/ AND to src/icons/ so the fix survives the next build.
 *
 * Background: Firefox uses icon96.png for its toolbar.  If that file is a
 * copy of icon128.png (128x128) Firefox renders it as a blurry transparent
 * circle.  Chrome ignores the mismatch silently; Firefox does not.
 *
 * Usage (called by scripts/release.ps1 — same pattern as build-firefox.mjs):
 *   node check-icons.mjs
 *
 * Exit codes:
 *   0 — all icons OK (or auto-corrected successfully)
 *   1 — missing icon or unrecoverable error
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync, inflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ICON_SIZES = [16, 32, 48, 96, 128];
const DIST_ICONS = resolve(__dirname, 'dist', 'icons');
const SRC_ICONS  = resolve(__dirname, 'src',  'icons');

// ── PNG helpers ──────────────────────────────────────────────────────────────

/** Read width and height from a PNG file buffer (IHDR chunk, bytes 16-23). */
function pngDimensions(buf) {
  // PNG signature is 8 bytes; IHDR chunk: 4 len + 4 type + 13 data + 4 CRC
  // Width  = bytes 16-19 (big-endian uint32)
  // Height = bytes 20-23 (big-endian uint32)
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h };
}

/**
 * Walk PNG chunks and collect all IDAT buffers, then inflate.
 * Returns the raw scanline buffer (height * (1 + width*4) bytes, filter byte
 * per row, 8-bit RGBA).
 */
function pngDecompress(buf) {
  const PNG_SIG_LEN = 8;
  let offset = PNG_SIG_LEN;
  const idatChunks = [];

  while (offset < buf.length) {
    const length   = buf.readUInt32BE(offset);       offset += 4;
    const type     = buf.toString('ascii', offset, offset + 4); offset += 4;
    const data     = buf.slice(offset, offset + length);        offset += length;
    /* CRC */                                                    offset += 4;

    if (type === 'IDAT') idatChunks.push(data);
    if (type === 'IEND') break;
  }

  return inflateSync(Buffer.concat(idatChunks));
}

/** Decode raw scanline buffer into a 2-D RGBA pixel array [y][x] = [r,g,b,a]. */
function rawToPixels(raw, W, H) {
  const pixels = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    const base = y * (W * 4 + 1) + 1; // skip 1-byte filter
    for (let x = 0; x < W; x++) {
      const b = base + x * 4;
      row.push([raw[b], raw[b + 1], raw[b + 2], raw[b + 3]]);
    }
    pixels.push(row);
  }
  return pixels;
}

/** CRC-32 table (standard PNG CRC). */
function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
    t[i] = v;
  }
  return t;
}
const CRC_TABLE = buildCrcTable();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf  = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Encode RGBA pixel array into a minimal RGBA PNG buffer. */
function pixelsToPng(pixels, TW, TH) {
  const rawRows = [];
  for (let y = 0; y < TH; y++) {
    const r = Buffer.allocUnsafe(1 + TW * 4);
    r[0] = 0; // filter: None
    for (let x = 0; x < TW; x++) {
      const b = 1 + x * 4;
      r[b]     = pixels[y][x][0];
      r[b + 1] = pixels[y][x][1];
      r[b + 2] = pixels[y][x][2];
      r[b + 3] = pixels[y][x][3];
    }
    rawRows.push(r);
  }
  const compressed = deflateSync(Buffer.concat(rawRows), { level: 9 });

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(TW, 0);
  ihdr.writeUInt32BE(TH, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Bilinear-resize a pixel array to TW×TH. */
function bilinearResize(pixels, W, H, TW, TH) {
  const out = [];
  for (let ty = 0; ty < TH; ty++) {
    const row = [];
    for (let tx = 0; tx < TW; tx++) {
      const sx = tx * (W - 1) / (TW - 1);
      const sy = ty * (H - 1) / (TH - 1);
      const x0 = Math.floor(sx), x1 = Math.min(x0 + 1, W - 1);
      const y0 = Math.floor(sy), y1 = Math.min(y0 + 1, H - 1);
      const fx = sx - x0, fy = sy - y0;
      const rgba = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        rgba[c] = Math.round(
          pixels[y0][x0][c] * (1 - fx) * (1 - fy) +
          pixels[y0][x1][c] *      fx  * (1 - fy) +
          pixels[y1][x0][c] * (1 - fx) *      fy  +
          pixels[y1][x1][c] *      fx  *      fy
        );
      }
      row.push(rgba);
    }
    out.push(row);
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('[AI CAGE] Verifying icon dimensions...');

let anyFixed = false;

for (const size of ICON_SIZES) {
  const iconPath = resolve(DIST_ICONS, `icon${size}.png`);

  if (!existsSync(iconPath)) {
    console.error(`[AI CAGE] ❌ Missing icon: dist/icons/icon${size}.png — regenerate icons before releasing`);
    process.exit(1);
  }

  const buf = readFileSync(iconPath);
  const { w, h } = pngDimensions(buf);

  if (w === size && h === size) {
    console.log(`[AI CAGE]    icon${size}.png  ✓  ${w}×${h}`);
    continue;
  }

  console.warn(`[AI CAGE] ⚠️  icon${size}.png is ${w}×${h} — expected ${size}×${size}. Auto-correcting...`);

  // Find the nearest larger icon with correct dimensions to use as source
  let srcBuf = null;
  let srcSize = null;
  for (const candidate of [128, 96, 48, 32, 16]) {
    if (candidate <= size) continue; // must be larger
    const candidatePath = resolve(DIST_ICONS, `icon${candidate}.png`);
    if (!existsSync(candidatePath)) continue;
    const cb = readFileSync(candidatePath);
    const { w: cw, h: ch } = pngDimensions(cb);
    if (cw === candidate && ch === candidate) {
      srcBuf  = cb;
      srcSize = candidate;
      break;
    }
  }

  if (!srcBuf) {
    // Fallback: try icon128.png regardless of its declared dimensions
    const fallback = resolve(DIST_ICONS, 'icon128.png');
    if (existsSync(fallback)) {
      srcBuf = readFileSync(fallback);
      const { w: fw } = pngDimensions(srcBuf);
      srcSize = fw;
    }
  }

  if (!srcBuf) {
    console.error(`[AI CAGE] ❌ Cannot auto-correct icon${size}.png — no usable source icon found`);
    process.exit(1);
  }

  // Decode → resize → encode
  const { w: SW, h: SH } = pngDimensions(srcBuf);
  const raw    = pngDecompress(srcBuf);
  const pixels = rawToPixels(raw, SW, SH);
  const scaled = bilinearResize(pixels, SW, SH, size, size);
  const png    = pixelsToPng(scaled, size, size);

  writeFileSync(iconPath, png);
  console.log(`[AI CAGE] ✅ Fixed icon${size}.png: ${size}×${size} (downscaled from ${srcSize}×${srcSize})`);
  anyFixed = true;
}

// ALWAYS sync src/icons/ from dist/icons/ — not only when a fix was needed.
// Reason: vite.config.ts copies src/icons/* → dist/icons/* on every build.
// If src/ still contains a wrong-size icon (e.g. icon96.png 128×128) it will
// overwrite the corrected dist/ icon on the NEXT pnpm build, causing the
// blurry-icon bug to silently reappear.  Keeping src/ identical to dist/ after
// every verification run permanently breaks this cycle.
let srcSyncCount = 0;
for (const size of ICON_SIZES) {
  const distIcon = resolve(DIST_ICONS, `icon${size}.png`);
  const srcIcon  = resolve(SRC_ICONS,  `icon${size}.png`);
  if (existsSync(srcIcon)) {
    const distBuf = readFileSync(distIcon);
    const srcBuf  = readFileSync(srcIcon);
    // Only write if different (avoid unnecessary disk writes + git noise)
    if (!distBuf.equals(srcBuf)) {
      writeFileSync(srcIcon, distBuf);
      srcSyncCount++;
      console.log(`[AI CAGE] ✅ src/icons/icon${size}.png synced from dist/ (was different)`);
    }
  }
}
if (srcSyncCount === 0) {
  console.log('[AI CAGE]    src/icons/ already in sync with dist/icons/ — no changes needed');
} else {
  console.log(`[AI CAGE] ✅ ${srcSyncCount} src/icons/ file(s) synced — will persist across builds`);
}

console.log(`[AI CAGE] ✅ All ${ICON_SIZES.length} icons verified — dimensions correct`);
