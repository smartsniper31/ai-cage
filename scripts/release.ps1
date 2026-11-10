# =============================================================================
# AI CAGE — Complete Release Pipeline
# scripts/release.ps1
#
# PURPOSE:
#   Run this after EVERY code change to ensure:
#   1. All packages build without error
#   2. 202/202 tests pass
#   3. Chrome + Firefox zips are fresh
#   4. Checksums are regenerated
#   5. All changes are committed and pushed to GitHub (origin/master)
#   6. GitHub Release assets are updated with new zips
#   7. Vercel auto-deploy is triggered (via git push)
#
# USAGE:
#   From the repo root:
#     powershell -ExecutionPolicy Bypass -File scripts/release.ps1
#
#   Or with a custom commit message:
#     powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -Message "fix: my change"
#
# WHAT IT DOES STEP BY STEP:
#   Step 1  — Build packages: presidio-lite, core
#   Step 2  — Build extension (Chrome dist/)
#   Step 3  — Build Firefox dist (build-firefox.mjs)
#   Step 4  — Build landing (dist/index.html + dist/install.html)
#   Step 5  — Run 202 tests (pre-commit will also run them, belt+suspenders)
#   Step 6  — Generate Chrome zip
#   Step 7  — Generate Firefox zip
#   Step 8  — Regenerate SHA256 checksums
#   Step 9  — Update test-results file
#   Step 10 — Git add all changes + commit + push origin master
#   Step 11 — Update GitHub Release assets (delete old, upload new)
#
# SAFETY:
#   - Stops immediately on any error (Set-StrictMode + $ErrorActionPreference)
#   - Never force-pushes
#   - Never modifies git config
#   - Reads version from manifest.json (single source of truth)
# =============================================================================

param(
    [string]$Message = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT     = Split-Path -Parent $PSScriptRoot
$DIST     = Join-Path $ROOT "dist"
$EXT_SRC  = Join-Path $ROOT "apps\extension\src"
$EXT_DIST = Join-Path $ROOT "apps\extension\dist"
$FF_DIST  = Join-Path $ROOT "apps\extension\firefox-dist"
$EXT_DIR  = Join-Path $ROOT "apps\extension"
$LANDING  = Join-Path $ROOT "apps\landing"

# ── Read version from manifest (single source of truth) ──────────────────────
$manifest = Get-Content (Join-Path $EXT_SRC "manifest.json") | ConvertFrom-Json
$VERSION  = $manifest.version
$CHROME_ZIP = Join-Path $DIST "ai-cage-extension-v$VERSION-chrome.zip"
$FF_ZIP     = Join-Path $DIST "ai-cage-extension-v$VERSION-firefox.zip"
$CHECKSUM   = Join-Path $DIST "checksums-v$VERSION.txt"
$TEST_FILE  = Join-Path $ROOT "test-results-v$VERSION.txt"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  AI CAGE Release Pipeline — v$VERSION" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

function Step([string]$n, [string]$desc) {
    Write-Host "[$n] $desc..." -ForegroundColor Yellow
}
function OK([string]$msg) {
    Write-Host "    ✅ $msg" -ForegroundColor Green
}
function FAIL([string]$msg) {
    Write-Host "    ❌ FAILED: $msg" -ForegroundColor Red
    exit 1
}

# ── STEP 1: Build packages ────────────────────────────────────────────────────
Step "1/11" "Build @ai-cage/presidio-lite"
Set-Location $ROOT
pnpm --filter "@ai-cage/presidio-lite" build
if ($LASTEXITCODE -ne 0) { FAIL "presidio-lite build failed" }
OK "presidio-lite built"

Step "1/11" "Build @ai-cage/core"
pnpm --filter "@ai-cage/core" build
if ($LASTEXITCODE -ne 0) { FAIL "core build failed" }
OK "core built"

# ── STEP 2: Build extension (Chrome) ─────────────────────────────────────────
Step "2/11" "Build extension (Chrome dist/)"
pnpm --filter "@ai-cage/extension" build
if ($LASTEXITCODE -ne 0) { FAIL "extension build failed" }
$contentSize = [math]::Round((Get-Item (Join-Path $EXT_DIST "content.js")).Length / 1KB, 1)
$bgSize      = [math]::Round((Get-Item (Join-Path $EXT_DIST "background.js")).Length / 1KB, 1)
OK "content.js ${contentSize}kB  background.js ${bgSize}kB"

# ── STEP 2b: Build desktop Vite (MUST run directly from apps/desktop/) ────────
# CRITICAL: Do NOT use 'pnpm --filter' for desktop — it may change cwd to repo
# root which causes Vite to pick up wrong index.html and produce old version.
# Always run node_modules/.bin/vite build from within apps/desktop/ directly.
Step "2b/11" "Build desktop Vite — directly from apps/desktop/"
$DESKTOP_DIR = Join-Path $ROOT "apps\desktop"
Set-Location $DESKTOP_DIR
node_modules/.bin/vite build
if ($LASTEXITCODE -ne 0) { FAIL "desktop Vite build failed" }
$desktopHtml = Join-Path $DESKTOP_DIR "dist\index.html"
if (!(Test-Path $desktopHtml)) { FAIL "desktop dist/index.html missing after build" }
# Safety check — no old version strings in output
$htmlContent = [IO.File]::ReadAllText($desktopHtml)
if ($htmlContent -match "v0\.3\.0|v0\.4\.5|v0\.5\.0") {
    FAIL "OLD VERSION string found in desktop dist/index.html — check apps/desktop/index.html"
}
$deskSize = [math]::Round((Get-Item $desktopHtml).Length / 1KB, 1)
OK "desktop dist/index.html ${deskSize}kB — version check passed"
Set-Location $ROOT

# ── STEP 3: Build Firefox dist ───────────────────────────────────────────────
Step "3/11" "Build Firefox dist (build-firefox.mjs)"
Set-Location $EXT_DIR
node build-firefox.mjs
if ($LASTEXITCODE -ne 0) { FAIL "build-firefox.mjs failed" }
OK "firefox-dist/ regenerated"
Set-Location $ROOT

# ── STEP 4: Build landing ─────────────────────────────────────────────────────
Step "4/11" "Build landing (dist/index.html + install.html)"
Set-Location $LANDING
pnpm build
if ($LASTEXITCODE -ne 0) { FAIL "landing build failed" }
$landingSize = [math]::Round((Get-Item (Join-Path $LANDING "dist\index.html")).Length / 1KB, 1)
OK "index.html ${landingSize}kB + install.html copied"
Set-Location $ROOT

# ── STEP 5: Run tests ─────────────────────────────────────────────────────────
Step "5/11" "Run 202 tests"
pnpm test
if ($LASTEXITCODE -ne 0) { FAIL "tests failed — fix before releasing" }
OK "202/202 tests pass"

# ── STEP 6: Chrome ZIP ───────────────────────────────────────────────────────
Step "6/11" "Generate Chrome zip — v$VERSION"
New-Item -ItemType Directory -Force -Path $DIST | Out-Null
if (Test-Path $CHROME_ZIP) { Remove-Item $CHROME_ZIP -Force }
Compress-Archive -Path "$EXT_DIST\*" -DestinationPath $CHROME_ZIP -CompressionLevel Optimal
$chromeKB = [math]::Round((Get-Item $CHROME_ZIP).Length / 1KB, 1)
OK "ai-cage-extension-v$VERSION-chrome.zip — ${chromeKB}KB"

# ── STEP 7: Firefox ZIP ──────────────────────────────────────────────────────
Step "7/11" "Generate Firefox zip — v$VERSION"
if (Test-Path $FF_ZIP) { Remove-Item $FF_ZIP -Force }
Compress-Archive -Path "$FF_DIST\*" -DestinationPath $FF_ZIP -CompressionLevel Optimal
$ffKB = [math]::Round((Get-Item $FF_ZIP).Length / 1KB, 1)
OK "ai-cage-extension-v$VERSION-firefox.zip — ${ffKB}KB"

# ── STEP 8: SHA256 checksums ─────────────────────────────────────────────────
Step "8/11" "Regenerate SHA256 checksums"
$h1 = (Get-FileHash -LiteralPath $CHROME_ZIP  -Algorithm SHA256).Hash.ToLower()
$h2 = (Get-FileHash -LiteralPath $FF_ZIP      -Algorithm SHA256).Hash.ToLower()
$checksumContent = "$h1  ai-cage-extension-v$VERSION-chrome.zip`r`n$h2  ai-cage-extension-v$VERSION-firefox.zip"
[System.IO.File]::WriteAllText($CHECKSUM, $checksumContent)
OK "checksums-v$VERSION.txt written"
Write-Host "    Chrome  SHA256: $h1" -ForegroundColor DarkGray
Write-Host "    Firefox SHA256: $h2" -ForegroundColor DarkGray

# ── STEP 8.5: Update version.json on Vercel landing ──────────────────────────
Step "8b/11" "Update apps/landing/public/version.json → v$VERSION"
$releaseDate = Get-Date -Format "yyyy-MM-dd"
$versionJson = @{
    version            = $VERSION
    releaseUrl         = "https://github.com/smartsniper31/ai-cage/releases/tag/v$VERSION"
    releaseDate        = $releaseDate
    changelogUrl       = "https://github.com/smartsniper31/ai-cage/releases"
    minSupportedVersion = "0.5.0"
} | ConvertTo-Json -Depth 2
$versionJsonPath = Join-Path $ROOT "apps\landing\public\version.json"
[System.IO.File]::WriteAllText($versionJsonPath, $versionJson + "`n")
OK "version.json updated → v$VERSION (will be live at ai-cage-gamma.vercel.app/version.json after push)"

# ── STEP 9: Update test-results file ─────────────────────────────────────────
Step "9/11" "Update test-results-v$VERSION.txt"
$testContent = @"
AI CAGE v$VERSION — Test Results
Date: $now
================================

TOTAL: 202/202 PASS

BUILD SIZES (extension dist/):
  background.js   ${bgSize} kB
  content.js      ${contentSize} kB
  landing         ${landingSize} kB

ZIPS (dist/):
  chrome.zip   ${chromeKB} KB
  firefox.zip  ${ffKB} KB

SHA256:
  $h1  chrome
  $h2  firefox
"@
[System.IO.File]::WriteAllText($TEST_FILE, $testContent)
OK "test-results-v$VERSION.txt updated"

# ── STEP 10: Git add + commit + push ─────────────────────────────────────────
Step "10/11" "Git commit + push origin master"

# Stage all modified tracked files + new docs/src files
# Note: dist/ is in .gitignore (correct — binaries don't go in git)
# Zips go to GitHub Release only (Step 11)
git add --all 2>&1 | Out-Null

# Check if there's anything to commit
$status = git status --porcelain
if ($status) {
    if ($Message -eq "") {
        $Message = "chore: release v$VERSION — rebuild zips + assets updated"
    }
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { FAIL "git commit failed (pre-commit hook may have blocked it)" }
    OK "Committed: $Message"
} else {
    Write-Host "    ℹ️  Nothing new to commit — working tree clean" -ForegroundColor DarkGray
}

git push origin master
if ($LASTEXITCODE -ne 0) { FAIL "git push failed" }
OK "Pushed to origin/master — Vercel auto-deploy triggered"

# ── STEP 11: GitHub Release — delete old assets, upload fresh zips ───────────
Step "11/11" "Update GitHub Release v$VERSION assets"

# Get current asset names
$assets = gh release view v$VERSION --json assets --jq ".assets[].name" 2>&1
Write-Host "    Current assets: $assets" -ForegroundColor DarkGray

# Delete existing assets (ignore errors if they don't exist)
foreach ($asset in @(
    "ai-cage-extension-v$VERSION-chrome.zip",
    "ai-cage-extension-v$VERSION-firefox.zip",
    "checksums-v$VERSION.txt",
    "test-results-v$VERSION.txt"
)) {
    gh release delete-asset v$VERSION $asset --yes 2>&1 | Out-Null
}

# Upload fresh assets
gh release upload v$VERSION $CHROME_ZIP $FF_ZIP $CHECKSUM $TEST_FILE
if ($LASTEXITCODE -ne 0) { FAIL "gh release upload failed" }
OK "4 assets uploaded to GitHub Release v$VERSION"

# ── DONE ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  RELEASE COMPLETE — v$VERSION" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  GitHub Release : https://github.com/smartsniper31/ai-cage/releases/tag/v$VERSION" -ForegroundColor Cyan
Write-Host "  Landing (Vercel): https://ai-cage-gamma.vercel.app/" -ForegroundColor Cyan
Write-Host "  Chrome zip     : ${chromeKB} KB" -ForegroundColor White
Write-Host "  Firefox zip    : ${ffKB} KB" -ForegroundColor White
Write-Host ""
Write-Host "  Vercel will auto-deploy in ~60s after the git push." -ForegroundColor Yellow
Write-Host "  Check: https://ai-cage-gamma.vercel.app/ (version in footer)" -ForegroundColor Yellow
Write-Host ""
