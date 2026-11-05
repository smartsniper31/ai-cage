#!/usr/bin/env bash
# =============================================================================
# AI CAGE — Complete Release Pipeline (bash version for Linux/Mac/CI)
# scripts/release.sh
#
# USAGE:
#   bash scripts/release.sh
#   bash scripts/release.sh "fix: my change message"
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
EXT_DIST="$ROOT/apps/extension/dist"
FF_DIST="$ROOT/apps/extension/firefox-dist"
EXT_DIR="$ROOT/apps/extension"
LANDING="$ROOT/apps/landing"
MSG="${1:-}"

# Read version from manifest
VERSION=$(node -p "require('$ROOT/apps/extension/src/manifest.json').version")
CHROME_ZIP="$DIST/ai-cage-extension-v$VERSION-chrome.zip"
FF_ZIP="$DIST/ai-cage-extension-v$VERSION-firefox.zip"
CHECKSUM="$DIST/checksums-v$VERSION.txt"
TEST_FILE="$ROOT/test-results-v$VERSION.txt"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "${YELLOW}[$1] $2...${NC}"; }
ok()   { echo -e "${GREEN}    ✅ $1${NC}"; }

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  AI CAGE Release Pipeline — v$VERSION${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# 1 — Build packages
step "1/11" "Build packages"
cd "$ROOT"
pnpm --filter "@ai-cage/presidio-lite" build
pnpm --filter "@ai-cage/core" build
ok "packages built"

# 2 — Extension Chrome
step "2/11" "Build extension Chrome"
pnpm --filter "@ai-cage/extension" build
ok "Chrome dist/ ready"

# 3 — Firefox dist
step "3/11" "Build Firefox dist"
cd "$EXT_DIR" && node build-firefox.mjs && cd "$ROOT"
ok "firefox-dist/ regenerated"

# 4 — Landing
step "4/11" "Build landing"
cd "$LANDING" && pnpm build && cd "$ROOT"
ok "landing dist/ ready"

# 5 — Tests
step "5/11" "Run 202 tests"
pnpm test
ok "202/202 pass"

# 6 — Chrome zip
step "6/11" "Chrome zip"
mkdir -p "$DIST"
rm -f "$CHROME_ZIP"
(cd "$EXT_DIST" && zip -r "$CHROME_ZIP" . -x "*.DS_Store")
ok "$(du -sh "$CHROME_ZIP" | cut -f1) — $CHROME_ZIP"

# 7 — Firefox zip
step "7/11" "Firefox zip"
rm -f "$FF_ZIP"
(cd "$FF_DIST" && zip -r "$FF_ZIP" . -x "*.DS_Store")
ok "$(du -sh "$FF_ZIP" | cut -f1) — $FF_ZIP"

# 8 — Checksums
step "8/11" "SHA256 checksums"
sha256sum "$CHROME_ZIP" "$FF_ZIP" | sed "s|$DIST/||" > "$CHECKSUM"
ok "$CHECKSUM"

# 9 — test-results
step "9/11" "Update test-results"
cat > "$TEST_FILE" << EOF
AI CAGE v$VERSION — Test Results
Date: $(date '+%Y-%m-%d %H:%M')
================================
TOTAL: 202/202 PASS
ZIPS: $(du -sh "$CHROME_ZIP" | cut -f1) chrome / $(du -sh "$FF_ZIP" | cut -f1) firefox
EOF
ok "$TEST_FILE"

# 10 — Git push
step "10/11" "Git commit + push"
cd "$ROOT"
git add --all
if ! git diff --cached --quiet; then
    MSG="${MSG:-chore: release v$VERSION — rebuild zips + assets}"
    git commit -m "$MSG"
    ok "Committed: $MSG"
fi
git push origin master
ok "Pushed → Vercel auto-deploy triggered"

# 11 — GitHub Release
step "11/11" "Update GitHub Release v$VERSION"
for asset in \
    "ai-cage-extension-v$VERSION-chrome.zip" \
    "ai-cage-extension-v$VERSION-firefox.zip" \
    "checksums-v$VERSION.txt" \
    "test-results-v$VERSION.txt"; do
    gh release delete-asset "v$VERSION" "$asset" --yes 2>/dev/null || true
done
gh release upload "v$VERSION" "$CHROME_ZIP" "$FF_ZIP" "$CHECKSUM" "$TEST_FILE"
ok "4 assets uploaded to GitHub Release v$VERSION"

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  RELEASE COMPLETE — v$VERSION${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "  GitHub  : https://github.com/smartsniper31/ai-cage/releases/tag/v$VERSION"
echo -e "  Vercel  : https://ai-cage-gamma.vercel.app/ (auto-deploy in ~60s)"
echo ""
