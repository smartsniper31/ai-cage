#!/usr/bin/env bash
# ============================================================================
# AI CAGE Chrome Extension — Chrome Web Store packaging script
#
# Usage:
#   bash apps/extension/zip.sh
#
# Output:
#   ai-cage-extension-v<version>.zip  (in repo root)
#
# Requirements:
#   - pnpm (for build)
#   - zip (standard Unix utility)
#   - jq  (to read version from package.json)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"

echo "🔒 AI CAGE Extension — Building for Chrome Web Store..."
echo "   Repo: $REPO_ROOT"

# ── 1. Build ─────────────────────────────────────────────────────────────
cd "$REPO_ROOT"
pnpm --filter @ai-cage/presidio-lite build
pnpm --filter @ai-cage/core build
pnpm --filter @ai-cage/extension build

# ── 2. Read version from manifest ────────────────────────────────────────
VERSION=$(node -e "const m=require('./apps/extension/dist/manifest.json'); console.log(m.version)")
echo "   Version: $VERSION"

# ── 3. Verify required files ─────────────────────────────────────────────
REQUIRED_FILES=(
  "background.js"
  "content.js"
  "popup.js"
  "popup.html"
  "manifest.json"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$DIST_DIR/$file" ]; then
    echo "❌ Missing required file: dist/$file"
    exit 1
  fi
done
echo "   ✅ All required files present."

# ── 4. Security check — no network calls in bundle ───────────────────────
echo "   → Running security check on bundle..."
for jsfile in "$DIST_DIR"/*.js; do
  if grep -qE "\bfetch\s*\(|XMLHttpRequest|WebSocket" "$jsfile" 2>/dev/null; then
    echo "❌ SECURITY: Network call found in $(basename "$jsfile")"
    exit 1
  fi
done
echo "   ✅ Security check passed — no network calls in bundle."

# ── 5. Create ZIP ─────────────────────────────────────────────────────────
ZIP_NAME="$REPO_ROOT/ai-cage-extension-v${VERSION}.zip"

# Remove previous zip if exists
[ -f "$ZIP_NAME" ] && rm "$ZIP_NAME"

cd "$DIST_DIR"
zip -r "$ZIP_NAME" . \
  --exclude "*.map" \
  --exclude ".DS_Store" \
  --exclude "Thumbs.db"

echo ""
echo "✅ Package created: ai-cage-extension-v${VERSION}.zip"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Click 'New item' or 'Upload updated package'"
echo "  3. Upload: ai-cage-extension-v${VERSION}.zip"
echo "  4. Complete the store listing (description, screenshots, privacy policy)"
echo ""
echo "Privacy policy URL must state:"
echo "  'No data is collected, stored, or transmitted to any server.'"
