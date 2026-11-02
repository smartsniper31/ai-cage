/**
 * create-brand-icons.mjs
 * Creates professional AI CAGE branded icons.
 * Design: Dark green background + white lock + "AC" monogram
 * Brand color: #15803d (cage-green-dark)
 *
 * Uses SVG-to-PNG via pure Node.js without external canvas library.
 * Outputs valid PNG files at 16, 32, 48, 128 px.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '../apps/extension/src/icons');
mkdirSync(iconDir, { recursive: true });

// ── Pure PNG encoder — no dependencies ────────────────────────────────────

function adler32(data) {
  let s1 = 1, s2 = 0;
  for (let i = 0; i < data.length; i++) {
    s1 = (s1 + data[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
}

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(val) {
  return [(val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff];
}

function deflateRaw(data) {
  // Store blocks (no compression) — valid deflate
  const blocks = [];
  const BLOCK = 65535;
  for (let i = 0; i < data.length; i += BLOCK) {
    const chunk = data.slice(i, i + BLOCK);
    const last = i + BLOCK >= data.length ? 1 : 0;
    blocks.push(last, chunk.length & 0xff, (chunk.length >> 8) & 0xff,
                (~chunk.length) & 0xff, ((~chunk.length) >> 8) & 0xff);
    blocks.push(...chunk);
  }
  if (data.length === 0) blocks.push(1, 0, 0, 0xff, 0xff);
  return new Uint8Array(blocks);
}

function zlib(data) {
  const raw = deflateRaw(data);
  const checksum = adler32(data);
  return new Uint8Array([0x78, 0x01, ...raw, ...writeUint32BE(checksum)]);
}

function pngChunk(type, data) {
  const typeBytes = type.split('').map(c => c.charCodeAt(0));
  const len = writeUint32BE(data.length);
  const crcData = [...typeBytes, ...data];
  const crcVal = writeUint32BE(crc32(new Uint8Array(crcData)));
  return [...len, ...typeBytes, ...data, ...crcVal];
}

function encodePNG(pixels, size) {
  // pixels: Uint8Array of RGBA values, row by row, top to bottom
  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

  // IHDR
  const ihdr = [
    ...writeUint32BE(size), ...writeUint32BE(size),
    8, 2,  // 8-bit depth, RGB color type
    0, 0, 0
  ];

  // Build raw scanlines (filter type 0 = None)
  const rawLines = [];
  for (let y = 0; y < size; y++) {
    rawLines.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      rawLines.push(pixels[i], pixels[i+1], pixels[i+2]); // RGB only
    }
  }

  const compressed = zlib(new Uint8Array(rawLines));

  const bytes = [
    ...PNG_SIGNATURE,
    ...pngChunk('IHDR', ihdr),
    ...pngChunk('IDAT', Array.from(compressed)),
    ...pngChunk('IEND', []),
  ];

  return new Uint8Array(bytes);
}

// ── Icon drawing ────────────────────────────────────────────────────────────

function drawAICageIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;

  // Brand colors
  const GREEN_DARK = [21, 128, 61];    // #15803d
  const GREEN_MED  = [22, 163, 74];    // #16a34a
  const WHITE      = [255, 255, 255];
  const GREEN_LIGHT= [134, 239, 172];  // #86efac

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (Math.round(y) * size + Math.round(x)) * 4;
    // Alpha blend over current
    const alpha = a / 255;
    pixels[i]   = Math.round(pixels[i]   * (1 - alpha) + r * alpha);
    pixels[i+1] = Math.round(pixels[i+1] * (1 - alpha) + g * alpha);
    pixels[i+2] = Math.round(pixels[i+2] * (1 - alpha) + b * alpha);
    pixels[i+3] = 255;
  }

  function fillCircle(cx, cy, r, [R, G, B]) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= r) {
          const aa = Math.max(0, Math.min(1, r - dist + 0.5));
          setPixel(x, y, R, G, B, Math.round(aa * 255));
        }
      }
    }
  }

  function fillRect(x1, y1, x2, y2, [R, G, B]) {
    for (let y = Math.round(y1); y < Math.round(y2); y++) {
      for (let x = Math.round(x1); x < Math.round(x2); x++) {
        setPixel(x, y, R, G, B);
      }
    }
  }

  function fillRoundRect(x1, y1, x2, y2, r, color) {
    fillRect(x1 + r, y1, x2 - r, y2, color);
    fillRect(x1, y1 + r, x2, y2 - r, color);
    fillCircle(x1 + r, y1 + r, r, color);
    fillCircle(x2 - r, y1 + r, r, color);
    fillCircle(x1 + r, y2 - r, r, color);
    fillCircle(x2 - r, y2 - r, r, color);
  }

  function drawArc(cx, cy, rx, ry, startDeg, endDeg, thickness, [R, G, B]) {
    const steps = Math.ceil((endDeg - startDeg) * Math.max(rx, ry) * 0.1);
    for (let i = 0; i <= steps; i++) {
      const angle = (startDeg + (endDeg - startDeg) * i / steps) * Math.PI / 180;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      fillCircle(x, y, thickness / 2, [R, G, B]);
    }
  }

  const s = size;

  // ── Background: rounded green square ──────────────────────────────────
  const bgR = s * 0.18;
  fillRoundRect(0, 0, s, s, bgR, GREEN_DARK);

  // Add subtle gradient effect (lighter strip at top)
  for (let y = 0; y < s * 0.4; y++) {
    const alpha = Math.round((1 - y / (s * 0.4)) * 25);
    for (let x = 0; x < s; x++) {
      const idx = (Math.round(y) * s + x) * 4;
      if (pixels[idx+3] > 0) {
        pixels[idx]   = Math.min(255, pixels[idx]   + alpha);
        pixels[idx+1] = Math.min(255, pixels[idx+1] + alpha);
        pixels[idx+2] = Math.min(255, pixels[idx+2] + alpha);
      }
    }
  }

  // ── Lock icon ──────────────────────────────────────────────────────────
  if (size >= 32) {
    const lw = s * 0.52;  // lock body width
    const lh = s * 0.34;  // lock body height
    const lx = (s - lw) / 2;
    const ly = s * 0.50;  // lock body top
    const lr = s * 0.06;  // corner radius

    // Lock body
    fillRoundRect(lx, ly, lx + lw, ly + lh, lr, WHITE);

    // Keyhole
    if (size >= 48) {
      const khR = s * 0.065;
      fillCircle(cx, ly + lh * 0.42, khR, GREEN_DARK);
      fillRect(cx - s * 0.04, ly + lh * 0.42, cx + s * 0.04, ly + lh * 0.78, GREEN_DARK);
    }

    // Shackle (arc on top)
    const sw = lw * 0.54;  // shackle width
    const sh = s * 0.28;   // shackle height
    const sx = cx;
    const sy = ly - sh * 0.45;
    const thick = Math.max(2, s * 0.068);

    drawArc(sx, sy, sw / 2, sh / 2, 180, 360, thick, WHITE);

    // Shackle legs (vertical lines)
    const legH = sh * 0.55;
    fillRect(sx - sw/2 - thick/2, sy, sx - sw/2 + thick/2, sy + legH, WHITE);
    fillRect(sx + sw/2 - thick/2, sy, sx + sw/2 + thick/2, sy + legH, WHITE);

  } else {
    // Small icon (16px) — simple lock silhouette
    const lw = s * 0.56;
    const lh = s * 0.36;
    const lx = (s - lw) / 2;
    const ly = s * 0.50;
    fillRect(lx, ly, lx + lw, ly + lh, WHITE);
    const sw = lw * 0.52;
    const thick = Math.max(1.5, s * 0.1);
    drawArc(cx, ly - s * 0.1, sw / 2, s * 0.22, 180, 360, thick, WHITE);
    fillRect(cx - sw/2 - thick/2, ly - s * 0.1, cx - sw/2 + thick/2, ly, WHITE);
    fillRect(cx + sw/2 - thick/2, ly - s * 0.1, cx + sw/2 + thick/2, ly, WHITE);
  }

  // ── Small "AC" badge in bottom-right corner (only for 48px+) ──────────
  // (too small for smaller icons)

  return encodePNG(pixels, size);
}

// ── Generate all sizes ─────────────────────────────────────────────────────

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png = drawAICageIcon(size);
  const path = join(iconDir, `icon${size}.png`);
  writeFileSync(path, png);
  console.log(`✅ icon${size}.png (${png.length} bytes)`);
}

// Also create Tauri desktop icons
const tauriIconDir = join(__dirname, '../apps/desktop/src-tauri/icons');
mkdirSync(tauriIconDir, { recursive: true });
writeFileSync(join(tauriIconDir, '32x32.png'), drawAICageIcon(32));
writeFileSync(join(tauriIconDir, '128x128.png'), drawAICageIcon(128));
writeFileSync(join(tauriIconDir, '128x128@2x.png'), drawAICageIcon(256));
console.log('✅ Tauri icons created');

console.log('\n🎨 AI CAGE brand icons generated — dark green + white lock');
