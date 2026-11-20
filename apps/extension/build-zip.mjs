/**
 * build-zip.mjs
 * Creates a ZIP archive from a source directory using Node.js streams.
 *
 * WHY THIS FILE EXISTS:
 *   PowerShell's Compress-Archive -CompressionLevel Optimal has a reproducible
 *   bug on Windows where it produces a ~1275-byte compressed entry for large
 *   PNG files (e.g. icon128.png, 49 KB) instead of the full 49 KB stored/deflated
 *   content. The resulting ZIP entry has a compression ratio of ~97% which is
 *   physically impossible for an already-compressed PNG. AMO (Firefox Add-on
 *   marketplace) rejects such ZIPs with "Invalid file name in archive".
 *
 *   This script uses Node's built-in zlib.deflateRawSync() with the same
 *   DEFLATE algorithm but writes the ZIP format manually, ensuring every entry
 *   is complete and valid. PNG files are stored with CompressionMethod=0 (Store)
 *   to avoid the double-compression problem entirely; JS/JSON/text files use
 *   Deflate (method 8).
 *
 * Usage:
 *   node build-zip.mjs <sourceDir> <outputZip>
 *
 * Example:
 *   node build-zip.mjs dist  ../../dist/ai-cage-extension-v0.6.0-chrome.zip
 *   node build-zip.mjs firefox-dist  ../../dist/ai-cage-extension-v0.6.0-firefox.zip
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateRawSync, crc32 as zlibCrc32 } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const [,, srcArg, destArg] = process.argv;
if (!srcArg || !destArg) {
  console.error('[AI CAGE] Usage: node build-zip.mjs <sourceDir> <outputZip>');
  process.exit(1);
}

const SRC  = resolve(__dirname, srcArg);
const DEST = resolve(__dirname, destArg);

// ── ZIP format helpers ───────────────────────────────────────────────────────

function uint16LE(n) { const b = Buffer.allocUnsafe(2); b.writeUInt16LE(n); return b; }
function uint32LE(n) { const b = Buffer.allocUnsafe(4); b.writeUInt32LE(n >>> 0); return b; }

// CRC-32 via zlib (same polynomial as ZIP spec)
function crc32(buf) {
  // zlibCrc32 is available in Node ≥ 22; fall back to manual if absent
  if (typeof zlibCrc32 === 'function') return zlibCrc32(buf);
  // Manual CRC-32 (standard ZIP/PNG polynomial 0xEDB88320)
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Files that should be stored (not deflated) — already compressed
const STORE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.zip', '.gz', '.woff', '.woff2']);

function shouldStore(name) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 && STORE_EXTS.has(name.slice(dot).toLowerCase());
}

// ── Walk source directory ────────────────────────────────────────────────────

const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else {
      files.push(full);
    }
  }
}

walk(SRC);
files.sort(); // deterministic order

// ── Build ZIP ────────────────────────────────────────────────────────────────

const localHeaders = [];   // Buffer[] — local file records
const centralDir   = [];   // Buffer[] — central directory records
let   offset       = 0;    // running byte offset in the output stream

const DOS_DATE = 0x5720; // 2026-11-17 in DOS date format (year-1980 << 9 | month << 5 | day)
const DOS_TIME = 0x0000;

for (const filePath of files) {
  const entryName = relative(SRC, filePath).replace(/\\/g, '/');
  const rawData   = readFileSync(filePath);
  const store     = shouldStore(filePath);

  let compData;
  let method;
  if (store) {
    compData = rawData;
    method   = 0; // Store
  } else {
    compData = deflateRawSync(rawData, { level: 9 });
    // If deflate makes it larger, store instead
    if (compData.length >= rawData.length) { compData = rawData; method = 0; }
    else method = 8; // Deflate
  }

  const crc        = crc32(rawData);
  const nameBuffer = Buffer.from(entryName, 'utf8');

  // Local file header (signature 0x04034b50)
  const localHeader = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // signature
    uint16LE(20),              // version needed: 2.0
    uint16LE(0),               // general purpose bit flag
    uint16LE(method),          // compression method
    uint16LE(DOS_TIME),        // last mod time
    uint16LE(DOS_DATE),        // last mod date
    uint32LE(crc),             // CRC-32
    uint32LE(compData.length), // compressed size
    uint32LE(rawData.length),  // uncompressed size
    uint16LE(nameBuffer.length), // file name length
    uint16LE(0),               // extra field length
    nameBuffer,
    compData,
  ]);

  localHeaders.push(localHeader);

  // Central directory record (signature 0x02014b50)
  const cdRecord = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x01, 0x02]), // signature
    uint16LE(20),              // version made by
    uint16LE(20),              // version needed
    uint16LE(0),               // general purpose bit flag
    uint16LE(method),          // compression method
    uint16LE(DOS_TIME),
    uint16LE(DOS_DATE),
    uint32LE(crc),
    uint32LE(compData.length),
    uint32LE(rawData.length),
    uint16LE(nameBuffer.length),
    uint16LE(0),               // extra field length
    uint16LE(0),               // file comment length
    uint16LE(0),               // disk number start
    uint16LE(0),               // internal attributes
    uint32LE(0),               // external attributes
    uint32LE(offset),          // relative offset of local header
    nameBuffer,
  ]);

  centralDir.push(cdRecord);
  offset += localHeader.length;
}

// End of central directory record (signature 0x06054b50)
const cdSize   = centralDir.reduce((s, b) => s + b.length, 0);
const eocd = Buffer.concat([
  Buffer.from([0x50, 0x4B, 0x05, 0x06]), // signature
  uint16LE(0),               // disk number
  uint16LE(0),               // disk with central dir
  uint16LE(centralDir.length),
  uint16LE(centralDir.length),
  uint32LE(cdSize),
  uint32LE(offset),          // offset of central dir
  uint16LE(0),               // comment length
]);

const zip = Buffer.concat([...localHeaders, ...centralDir, eocd]);
writeFileSync(DEST, zip);

const totalRawKB  = files.reduce((s, f) => s + statSync(f).size, 0) / 1024;
const zipKB       = zip.length / 1024;
console.log(`[AI CAGE] ✅ ZIP created: ${DEST.split(/[/\\]/).pop()}  ${zipKB.toFixed(1)} KB  (${files.length} files, ${totalRawKB.toFixed(0)} KB raw)`);
