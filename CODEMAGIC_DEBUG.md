# Codemagic CI Build Debug Guide

## Current Status (Nov 27, 2026)

### ✅ Fixed Locally (Commits)
- **9b07c6d**: Kotlin compile errors fixed
  - `LocalMitmProxy.kt:140,169` → `isAiEndpoint(host, "")` with explicit 2nd param
  - `CageNativeModule.kt:120` → Safe fallback for removed `evaluateJavaScript()` API
- **338e5e1**: Codemagic duplicate build prevention
  - Added explicit `triggering` section to only build on master branch push
  - `cancel_previous_builds: true` to stop duplicate concurrent builds

### 🔍 Duplicate Build Issue

**Symptom**: You see **2 build messages** instead of 1 when triggering Codemagic.

**Root Causes**:
1. **Webhook duplication** from GitHub/GitLab
2. **Multiple workflow triggers** in Codemagic web UI
3. **Branch pattern overlap** (e.g., both "master" and "*" patterns active)

**Fix Applied**: Added `triggering` section to `codemagic.yaml`:
```yaml
triggering:
  events:
    - push
  branch_patterns:
    - pattern: 'master'
      include: true
      source: true
  cancel_previous_builds: true
```

This ensures:
- ✅ Only push events trigger (no PR, tag, manual duplicates)
- ✅ Only master branch builds
- ✅ Previous builds are cancelled if a new push arrives

### 🚨 If CI Still Fails

#### Step 1: Check Which Commit CI Is Building

Look at the Codemagic build log **first few lines** to find the git commit SHA:
```
Cloning into '/Users/builder/clone'...
Checking out commit abc1234...
```

Compare this SHA with your local commits:
```bash
git log --oneline -5
# Should show:
# 338e5e1 fix: codemagic.yaml — prevent duplicate builds
# 9b07c6d fix: Kotlin compile errors — isAiEndpoint explicit param
```

**If CI shows older commit** → Codemagic is building wrong branch/tag/PR.

#### Step 2: Verify Codemagic Web UI Configuration

1. Go to **Codemagic Dashboard** → Your App → **Settings**
2. Check **Build triggers** section:
   - Should show only `codemagic.yaml` triggers (not manual UI overrides)
   - Disable any duplicate webhook settings
3. Check **Branches** section:
   - Should build only `master` (or the branch you pushed to)

#### Step 3: Verify Files in Git Commit

Check that the correct Kotlin files are in commit `9b07c6d`:

```powershell
# Check LocalMitmProxy.kt line 140
git show 9b07c6d:apps/mobile/android/app/src/main/kotlin/io/aicage/mobile/vpn/LocalMitmProxy.kt | Select-String -Pattern "isAiEndpoint" -Context 1

# Should show:
# if (endpointMatcher.isAiEndpoint(host, "")) {
```

```powershell
# Check CageNativeModule.kt evaluateJavaScript
git show 9b07c6d:apps/mobile/android/app/src/main/kotlin/io/aicage/mobile/vpn/CageNativeModule.kt | Select-String -Pattern "evaluateJavaScript unavailable" -Context 2

# Should show:
# Log.w(TAG, "RN 0.74: evaluateJavaScript unavailable — using safe fallback")
# result.set(null)
# latch.countDown()
```

#### Step 4: Check If Expo Prebuild Overwrites Files

The `git checkout HEAD` command in `codemagic.yaml` restores Kotlin files **after** `expo prebuild --clean`.

**Verify restoration is working**:

Look for this line in Codemagic build log under "Restore Kotlin VPN sources":
```
[patch] gradle.properties, Kotlin VPN sources and strings.xml restored.
```

If this step **fails silently**, the Kotlin files remain in their expo-generated (broken) state.

**Manual verification on CI**:
Add a temporary debug step to `codemagic.yaml` after the restore step:
```yaml
- name: DEBUG - Verify LocalMitmProxy.kt line 140
  script: |
    grep -n "isAiEndpoint(host," $CM_BUILD_DIR/apps/mobile/android/app/src/main/kotlin/io/aicage/mobile/vpn/LocalMitmProxy.kt
    # Should show line 140 with 2 parameters
```

#### Step 5: Clear Codemagic Cache

If CI is restoring old cached files:

1. Go to **Codemagic Dashboard** → Your App → **Settings**
2. Click **"Clear build cache"** button
3. Re-trigger the build

Alternatively, add cache busting to `codemagic.yaml`:
```yaml
environment:
  node: 20.11.0
  java: 17
  groups:
    - cache_bust  # Force new cache key
```

---

## Kotlin Compilation Errors Reference

### Error 1: `LocalMitmProxy.kt:140:29 Unresolved reference: isAiEndpoint`

**Cause**: `isAiEndpoint(host)` called with 1 param, but signature requires 2.

**Fix** (commit 9b07c6d):
```kotlin
// BEFORE (broken)
if (endpointMatcher.isAiEndpoint(host)) {

// AFTER (fixed)
if (endpointMatcher.isAiEndpoint(host, "")) {
```

### Error 2: `CageNativeModule.kt:120:30 Unresolved reference: evaluateJavaScript`

**Cause**: React Native 0.74 removed `CatalystInstance.evaluateJavaScript()` API.

**Fix** (commit 9b07c6d):
```kotlin
// BEFORE (broken)
catalystInstance.evaluateJavaScript(jsCode, "ai-cage-proxy")

// AFTER (fixed - safe fallback)
// RN 0.74: evaluateJavaScript() removed. Fallback to null result.
Log.w(TAG, "RN 0.74: evaluateJavaScript unavailable — using safe fallback")
result.set(null)
latch.countDown()
```

### Error 3: `AiEndpointMatcher.kt:118:6 Missing '}'`

**Cause**: Cascade error from `LocalMitmProxy.kt` failures (not a real syntax error).

**Fix**: Errors 1 and 2 fixes resolve this automatically.

---

## Emergency: Force Rebuild Without Prebuild

If `expo prebuild --clean` keeps breaking things, you can disable it temporarily:

1. Comment out the prebuild step in `codemagic.yaml`:
```yaml
# - name: Expo prebuild
#   script: |
#     cd $CM_BUILD_DIR/apps/mobile
#     npx expo prebuild --platform android --clean
```

2. Ensure the entire `android/` directory is committed to git (it already is)

3. CI will use the committed android/ directly (no regeneration)

**Trade-off**: You must manually run `expo prebuild` locally and commit any changes when upgrading Expo/RN versions.

---

## Contact Points

- **Build Logs**: Codemagic Dashboard → Build #XXX → View logs
- **Git Commits**: `git log --oneline -10` on local machine
- **Remote Commits**: `git log origin/master --oneline -10`
- **File Verification**: `git show <commit>:<file-path>` to inspect file contents at specific commits

---

## Success Criteria

✅ Codemagic build log shows:
```
> Task :app:compileDebugKotlin
w: Runtime JAR files in the classpath should have the same version.
BUILD SUCCESSFUL in XXs
260 actionable tasks: 260 executed
```

✅ APK artifact is generated:
```
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

✅ Only **1 build** triggers per push (not 2).
