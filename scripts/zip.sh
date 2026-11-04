#!/usr/bin/env bash
# scripts/zip.sh — AI CAGE release zip generator
# Usage: bash scripts/zip.sh [VERSION]
# Example: bash scripts/zip.sh 0.6.0
set -euo pipefail

VERSION="${1:-$(node -p "require('./package.json').version")}"
DIST="$(pwd)/dist"
EXT_DIST="$(pwd)/apps/extension/dist"
FF_DIST="$(pwd)/apps/extension/firefox-dist"

echo "[AI CAGE] Generating release zips for v${VERSION}..."
mkdir -p "$DIST"

# ── Chrome ZIP ──────────────────────────────────────────────────────────────
CHROME_ZIP="$DIST/ai-cage-extension-v${VERSION}-chrome.zip"
rm -f "$CHROME_ZIP"
(cd "$EXT_DIST" && zip -r "$CHROME_ZIP" . -x "*.DS_Store")
echo "✅ Chrome: $CHROME_ZIP ($(du -sh "$CHROME_ZIP" | cut -f1))"

# ── Firefox ZIP (build firefox-dist/ first) ─────────────────────────────────
echo "[AI CAGE] Building Firefox dist..."
node apps/extension/build-firefox.mjs

FF_ZIP="$DIST/ai-cage-extension-v${VERSION}-firefox.zip"
rm -f "$FF_ZIP"
(cd "$FF_DIST" && zip -r "$FF_ZIP" . -x "*.DS_Store")
echo "✅ Firefox: $FF_ZIP ($(du -sh "$FF_ZIP" | cut -f1))"

# ── Checksums ────────────────────────────────────────────────────────────────
CHECKSUM_FILE="$DIST/checksums-v${VERSION}.txt"
sha256sum "$DIST"/*.zip > "$CHECKSUM_FILE"
echo "✅ Checksums: $CHECKSUM_FILE"

echo ""
echo "[AI CAGE] All zips ready in dist/:"
ls -lh "$DIST"/*.zip "$DIST"/*.txt
