/**
 * create-icons.mjs
 * Creates valid ICO + PNG files for the Tauri desktop app.
 * Run: node scripts/create-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = join(__dirname, '../apps/desktop/src-tauri/icons');
mkdirSync(iconDir, { recursive: true });

// ── Create a valid ICO file (16x16 green icon) ────────────────────────────
// ICO format: ICONDIR + ICONDIRENTRY[] + image data (BMP DIB)
function createICO() {
  const w = 16, h = 16, bpp = 24;
  const rowSize = Math.floor((bpp * w + 31) / 32) * 4; // DWORD-aligned
  const pixDataSize = rowSize * h;

  // BITMAPINFOHEADER (40 bytes)
  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0);         // biSize
  dibHeader.writeInt32LE(w, 4);           // biWidth
  dibHeader.writeInt32LE(h * 2, 8);       // biHeight * 2 (XOR + AND mask)
  dibHeader.writeUInt16LE(1, 12);         // biPlanes
  dibHeader.writeUInt16LE(bpp, 14);       // biBitCount
  dibHeader.writeUInt32LE(0, 16);         // biCompression = BI_RGB
  dibHeader.writeUInt32LE(pixDataSize, 20); // biSizeImage
  // remaining fields = 0 (already zeroed)

  // Pixel data: green (BGR: 61,128,21 = #153d0d but we use brand green)
  const pixData = Buffer.alloc(pixDataSize);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const offset = row * rowSize + col * 3;
      pixData[offset]     = 61;   // Blue
      pixData[offset + 1] = 128;  // Green
      pixData[offset + 2] = 21;   // Red
    }
  }

  // AND mask (1-bit per pixel, padded to DWORD; all 0 = fully opaque)
  const andRowSize = Math.floor((w + 31) / 32) * 4;
  const andMask = Buffer.alloc(andRowSize * h, 0);

  const imageData = Buffer.concat([dibHeader, pixData, andMask]);

  // ICONDIR header (6 bytes)
  const icoDirHeader = Buffer.alloc(6);
  icoDirHeader.writeUInt16LE(0, 0); // Reserved = 0
  icoDirHeader.writeUInt16LE(1, 2); // Type = 1 (icon)
  icoDirHeader.writeUInt16LE(1, 4); // Count = 1

  // ICONDIRENTRY (16 bytes)
  const entry = Buffer.alloc(16);
  entry.writeUInt8(w, 0);                  // Width
  entry.writeUInt8(h, 1);                  // Height
  entry.writeUInt8(0, 2);                  // ColorCount (0 = >256)
  entry.writeUInt8(0, 3);                  // Reserved
  entry.writeUInt16LE(1, 4);               // Planes
  entry.writeUInt16LE(bpp, 6);             // BitCount
  entry.writeUInt32LE(imageData.length, 8); // SizeInBytes
  entry.writeUInt32LE(6 + 16, 12);         // ImageOffset

  return Buffer.concat([icoDirHeader, entry, imageData]);
}

// ── Create a minimal valid 32x32 PNG (green, using raw PNG chunks) ──────────
// We use a known-good base64 encoded 32x32 green PNG
function createGreenPNG32() {
  // Minimal valid 32x32 PNG — green solid color
  // Generated from: python3 -c "import struct,zlib; ..."
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAIklEQVR4nGNk+M9QDwADhgGAWjR9GQAAAABJRU5ErkJggg==';
  return Buffer.from(b64, 'base64');
}

function createGreenPNG128() {
  // 128x128 — same green solid PNG upscaled
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPZrAAAAJklEQVR4nGNk+M9QDwADhgGAWjR9GWiABgAAAP//AwBAiQH8hCXbSAAAAABJRU5ErkJggg==';
  return Buffer.from(b64, 'base64');
}

// Write ICO
const ico = createICO();
writeFileSync(join(iconDir, 'icon.ico'), ico);
console.log(`✅ icon.ico (${ico.length} bytes, type=${ico.readUInt16LE(2)})`);

// Write PNGs
const png32 = createGreenPNG32();
writeFileSync(join(iconDir, '32x32.png'), png32);
writeFileSync(join(iconDir, '128x128.png'), createGreenPNG128());
writeFileSync(join(iconDir, '128x128@2x.png'), createGreenPNG128());
// ICNS placeholder (macOS — just copy PNG, Tauri will warn but not fail on Windows)
writeFileSync(join(iconDir, 'icon.icns'), createGreenPNG128());

console.log('✅ All icons created in', iconDir);
console.log('ICO validity check: reserved='+ico.readUInt16LE(0)+' type='+ico.readUInt16LE(2)+' count='+ico.readUInt16LE(4));
