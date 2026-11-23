# =============================================================================
# AI CAGE Mobile — Release Pipeline
# scripts/release-mobile.ps1
#
# PURPOSE:
#   Build, validate, and package the AI CAGE Mobile Android app.
#   Run this after every change to apps/mobile before committing.
#
# USAGE (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/release-mobile.ps1
#
#   With a custom commit message:
#   powershell -ExecutionPolicy Bypass -File scripts/release-mobile.ps1 -Message "fix: vpn toggle"
#
#   Build profile (preview = APK, production = AAB):
#   powershell -ExecutionPolicy Bypass -File scripts/release-mobile.ps1 -Profile preview
#
# WHAT IT DOES:
#   Step 1  — Type-check apps/mobile (tsc --noEmit)
#   Step 2  — Lint apps/mobile/src
#   Step 3  — Build @ai-cage/presidio-lite (mobile depends on it)
#   Step 4  — Build @ai-cage/core (mobile depends on it)
#   Step 5  — Run existing 202 tests (presidio-lite + core) — must stay green
#   Step 6  — Expo prebuild (generates android/ native project)
#   Step 7  — EAS Build (APK for preview / AAB for production) — optional
#   Step 8  — Git add + commit + push origin master
#
# SAFETY:
#   - Stops on any error
#   - Never force-pushes
#   - Never modifies git config
#   - Step 7 (EAS) is skipped by default to avoid accidental paid builds
#     Pass -BuildNative to run it
# =============================================================================

param(
    [string]$Message     = "",
    [string]$Profile     = "preview",
    [switch]$BuildNative = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT       = Split-Path -Parent $PSScriptRoot
$MOBILE_DIR = Join-Path $ROOT "apps\mobile"

# ── Version from app.json ─────────────────────────────────────────────────────
$appJson    = Get-Content (Join-Path $MOBILE_DIR "app.json") | ConvertFrom-Json
$VERSION    = $appJson.expo.version

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  AI CAGE Mobile Release Pipeline — v$VERSION (Android)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

function Step([string]$n, [string]$desc) {
    Write-Host "[$n] $desc..." -ForegroundColor Yellow
}
function OK([string]$msg) {
    Write-Host "    OK  $msg" -ForegroundColor Green
}
function FAIL([string]$msg) {
    Write-Host "    FAILED: $msg" -ForegroundColor Red
    exit 1
}

# ── STEP 1: TypeScript type check ─────────────────────────────────────────────
Step "1/8" "TypeScript type-check apps/mobile"
Set-Location $MOBILE_DIR
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { FAIL "TypeScript errors — fix before releasing" }
OK "No type errors"
Set-Location $ROOT

# ── STEP 2: Lint ──────────────────────────────────────────────────────────────
Step "2/8" "ESLint apps/mobile/src"
Set-Location $MOBILE_DIR
npx eslint src --ext .ts,.tsx --max-warnings 0
if ($LASTEXITCODE -ne 0) { FAIL "ESLint errors — fix before releasing" }
OK "Lint clean"
Set-Location $ROOT

# ── STEP 3: Build presidio-lite ───────────────────────────────────────────────
Step "3/8" "Build @ai-cage/presidio-lite"
pnpm --filter "@ai-cage/presidio-lite" build
if ($LASTEXITCODE -ne 0) { FAIL "presidio-lite build failed" }
OK "presidio-lite built"

# ── STEP 4: Build core ────────────────────────────────────────────────────────
Step "4/8" "Build @ai-cage/core"
pnpm --filter "@ai-cage/core" build
if ($LASTEXITCODE -ne 0) { FAIL "core build failed" }
OK "core built"

# ── STEP 5: Run 202 tests (must stay green — zero regressions allowed) ────────
Step "5/8" "Run 202 tests"
pnpm test
if ($LASTEXITCODE -ne 0) { FAIL "Tests failed — fix before releasing" }
OK "202/202 tests pass"

# ── STEP 6: Expo prebuild ─────────────────────────────────────────────────────
Step "6/8" "Expo prebuild (generates android/ native project)"
Set-Location $MOBILE_DIR
npx expo prebuild --platform android --clean
if ($LASTEXITCODE -ne 0) { FAIL "expo prebuild failed" }
$mainKt = Join-Path $MOBILE_DIR "android\app\src\main\kotlin"
if (!(Test-Path $mainKt)) { FAIL "android/ native project not generated" }
OK "android/ native project generated"
Set-Location $ROOT

# ── STEP 7: EAS Build (optional — only with -BuildNative flag) ───────────────
if ($BuildNative) {
    Step "7/8" "EAS Build — profile: $Profile"
    Set-Location $MOBILE_DIR
    npx eas build --platform android --profile $Profile --non-interactive
    if ($LASTEXITCODE -ne 0) { FAIL "EAS build failed" }
    OK "EAS build complete — check Expo dashboard for APK/AAB"
    Set-Location $ROOT
} else {
    Write-Host "[7/8] EAS Build — SKIPPED (pass -BuildNative to run)" -ForegroundColor DarkGray
}

# ── STEP 8: Git commit + push ─────────────────────────────────────────────────
Step "8/8" "Git commit + push origin master"

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

git add --all 2>&1 | Out-Null

$status = git status --porcelain
if ($status) {
    if ($Message -eq "") {
        $Message = "chore: mobile v$VERSION — prebuild updated"
    }
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { FAIL "git commit failed (pre-commit hook may have blocked it)" }
    OK "Committed: $Message"
} else {
    Write-Host "    Nothing new to commit — working tree clean" -ForegroundColor DarkGray
}

git push origin master
if ($LASTEXITCODE -ne 0) { FAIL "git push failed" }
OK "Pushed to origin/master"

$ErrorActionPreference = $prevEAP

# ── DONE ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  MOBILE PIPELINE COMPLETE — v$VERSION" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To build the APK:" -ForegroundColor Cyan
Write-Host "    powershell -ExecutionPolicy Bypass -File scripts/release-mobile.ps1 -BuildNative" -ForegroundColor White
Write-Host ""
Write-Host "  To run on a connected device:" -ForegroundColor Cyan
Write-Host "    cd apps/mobile" -ForegroundColor White
Write-Host "    npx expo run:android" -ForegroundColor White
Write-Host ""
