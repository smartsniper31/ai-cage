/**
 * scripts/generate-icons-png.mjs
 * AI CAGE — PNG Icon Generator (pure Node.js, no external deps)
 *
 * Generates a valid 32x32 PNG and 128x128 PNG with AI CAGE branding
 * using raw PNG binary format (DEFLATE-compressed IDAT).
 *
 * Icon design: green (#15803d) background + white lock silhouette
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const ICONS_DIR = resolve(ROOT, 'apps/desktop/src-tauri/icons');

// ── PNG binary helpers ────────────────────────────────────────────────────────

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function makePNG(size) {
  // Green: #15803d = R:21 G:128 B:61
  const R = 21, G = 128, B = 61;

  // Build raw pixel data with filter byte (0 = None) per scanline
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      const pixel = getPixel(x, y, size, R, G, B);
      rawData.push(pixel.r, pixel.g, pixel.b, pixel.a);
    }
  }

  const raw = Buffer.from(rawData);
  const compressed = deflateSync(raw, { level: 9 });

  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Draw lock icon ────────────────────────────────────────────────────────────

function getPixel(x, y, size, bgR, bgG, bgB) {
  const cx = size / 2;
  const cy = size / 2;
  const s  = size / 32; // scale factor

  // Rounded corners for background
  const cornerR = size * 0.18;
  const inCorner = isInRoundedRect(x, y, 0, 0, size, size, cornerR);
  if (!inCorner) return { r: 0, g: 0, b: 0, a: 0 }; // transparent

  // Lock body: rectangle in lower half
  const bodyX1 = cx - 10 * s, bodyX2 = cx + 10 * s;
  const bodyY1 = cy - 2 * s,  bodyY2 = cy + 10 * s;
  const inBody = x >= bodyX1 && x <= bodyX2 && y >= bodyY1 && y <= bodyY2;

  // Lock shackle: arc (top part)
  const shackleOuter = 8 * s;
  const shackleInner = 5 * s;
  const shackleTop   = cy - 10 * s;
  const dx = x - cx;
  const dy = y - (cy - 2 * s);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const inShackle = dist >= shackleInner && dist <= shackleOuter
    && y <= (cy - 2 * s)
    && y >= shackleTop
    && x >= (cx - shackleOuter) && x <= (cx + shackleOuter);

  // Keyhole: small circle + stem
  const kDx = x - cx, kDy = y - (cy + 2 * s);
  const kDist = Math.sqrt(kDx * kDx + kDy * kDy);
  const inKeyCircle = kDist <= 2.5 * s;
  const inKeyStem   = Math.abs(x - cx) <= 1.2 * s && y >= (cy + 2 * s) && y <= (cy + 7 * s);
  const inKeyhole   = inBody && (inKeyCircle || inKeyStem);

  if (inKeyhole) return { r: bgR, g: bgG, b: bgB, a: 255 };
  if (inBody || inShackle) return { r: 255, g: 255, b: 255, a: 255 };
  return { r: bgR, g: bgG, b: bgB, a: 255 };
}

function isInRoundedRect(px, py, rx, ry, rw, rh, r) {
  if (px < rx || px >= rx + rw || py < ry || py >= ry + rh) return false;
  const nearCorner = (
    (px < rx + r && py < ry + r) ||
    (px >= rx + rw - r && py < ry + r) ||
    (px < rx + r && py >= ry + rh - r) ||
    (px >= rx + rw - r && py >= ry + rh - r)
  );
  if (!nearCorner) return true;
  // Check distance from nearest corner center
  const cx = px < rx + r ? rx + r : rx + rw - r;
  const cy = py < ry + r ? ry + r : ry + rh - r;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) <= r;
}

// ── Generate and save ─────────────────────────────────────────────────────────

const sizes = [
  { size: 32,  file: '32x32.png' },
  { size: 128, file: '128x128.png' },
  { size: 256, file: '128x128@2x.png' },
];

for (const { size, file } of sizes) {
  const png = makePNG(size);
  const path = resolve(ICONS_DIR, file);
  writeFileSync(path, png);
  console.log(`[icons] ✅ ${file} (${size}x${size}) — ${png.length} bytes`);
}

console.log('\n[icons] ✅ All PNG icons generated with AI CAGE branding');
console.log('[icons] Note: icon.ico and icon.icns require the full Tauri rebuild');
console.log('[icons] They will be auto-generated during pnpm tauri build');
