#!/usr/bin/env node
/**
 * patch-android.mjs
 * Patches the expo-generated Android files for pnpm monorepo compatibility.
 *
 * Usage:
 *   node patch-android.mjs <settings.gradle> <app/build.gradle> <plugin_dir> <rn_dir> <rnc_dir>
 *
 * Arguments:
 *   settings.gradle  — path to android/settings.gradle
 *   app/build.gradle — path to android/app/build.gradle
 *   plugin_dir       — absolute path to @react-native/gradle-plugin
 *   rn_dir           — absolute path to react-native package
 *   rnc_dir          — absolute path to @react-native-community/cli-platform-android
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const [,, settingsPath, appBuildPath, pluginDir, rnDir, rncDir] = process.argv;

if (!settingsPath || !appBuildPath || !pluginDir || !rnDir || !rncDir) {
  console.error('Usage: node patch-android.mjs <settings> <app/build.gradle> <plugin_dir> <rn_dir> <rnc_dir>');
  process.exit(1);
}

// ── Patch 1: settings.gradle ─────────────────────────────────────────────────
// expo prebuild generates settings.gradle with dynamic node --print calls
// that return "null" in a pnpm monorepo (packages are in .pnpm virtual store,
// not accessible via require.resolve() from android/).
//
// STRATEGY: surgical replacement — keep everything expo generated
// (pluginManagement, versionCatalogs/reactAndroidLibs, ReactSettingsExtension,
// autolinking.gradle, useExpoModules(), include ':app') but replace ONLY the
// 4 dynamic .execute(null, rootDir) calls with pre-resolved absolute paths.

let settings = readFileSync(settingsPath, 'utf8');

// 1a. includeBuild for gradle-plugin (pluginManagement block)
//     Matches: includeBuild(new File([...].execute(null, rootDir).text.trim()).getParentFile()...)
settings = settings.replace(
  /includeBuild\(new File\([\s\S]*?\.execute\(null,\s*rootDir\)\.text\.trim\(\)\)\.getParentFile\(\)(?:\.toString\(\))?\)/g,
  `includeBuild("${pluginDir}")`
);

// 1b. includeBuild at the bottom (the one with { paths: [...] } variant)
//     Same pattern — already covered by 1a but add explicit fallback
settings = settings.replace(
  /includeBuild\(new File\([\s\S]*?gradle-plugin[\s\S]*?\.execute\(null,\s*rootDir\)[\s\S]*?\)\)/g,
  `includeBuild("${pluginDir}")`
);

// 1c. versionCatalogs reactAndroidLibs — libs.versions.toml path
//     Matches: from(files(new File([...].execute(null, rootDir).text.trim(), "../gradle/libs.versions.toml")))
settings = settings.replace(
  /from\(files\(new File\([\s\S]*?\.execute\(null,\s*rootDir\)\.text\.trim\(\),\s*["']\.\.\/gradle\/libs\.versions\.toml["']\)\)\)/g,
  `from(files("${rnDir}/gradle/libs.versions.toml"))`
);

// 1d. expo autolinking.gradle path
//     Matches: apply from: new File([...].execute(null, rootDir).text.trim(), "../scripts/autolinking.gradle")
settings = settings.replace(
  /apply from: new File\([\s\S]*?expo[\s\S]*?\.execute\(null,\s*rootDir\)\.text\.trim\(\),\s*["']\.\.\/scripts\/autolinking\.gradle["']\)/g,
  `apply from: new File("${rnDir}/../expo/scripts/autolinking.gradle")`
);

// 1e. Final check: replace any remaining .execute(null, rootDir) in includeBuild
settings = settings.replace(
  /includeBuild\(new File\([\s\S]*?\.execute\(null,\s*rootDir\)[\s\S]*?\)\)/g,
  `includeBuild("${pluginDir}")`
);

console.log('[patch-android] settings.gradle: checking remaining issues...');
if (settings.includes('.execute(null, rootDir)')) {
  const lines = settings.split('\n').filter(l => l.includes('.execute(null, rootDir)'));
  console.error('[patch-android] WARNING: unreplaced .execute(null, rootDir) remaining:');
  lines.forEach(l => console.error('  ' + l.trim()));
} else {
  console.log('[patch-android] settings.gradle: all dynamic calls replaced ✓');
}

writeFileSync(settingsPath, settings);
console.log('[patch-android] settings.gradle written.');

// ── Patch 2: app/build.gradle ────────────────────────────────────────────────
// expo-generated app/build.gradle is correct (uses com.facebook.react plugin,
// BOM, rootProject.ext.*). We only need to ADD:
//   - BouncyCastle (for LocalCertManager MITM proxy CA)
//   - app-level autolinking (applyNativeModulesAppBuildGradle)
// We remove any previously-appended AI CAGE block first (idempotent).

let appBuild = readFileSync(appBuildPath, 'utf8');

// Remove previously-appended AI CAGE block if present (idempotency)
const AI_CAGE_MARKER = '// AI CAGE --';
const markerIdx = appBuild.indexOf(AI_CAGE_MARKER);
if (markerIdx !== -1) {
  appBuild = appBuild.slice(0, markerIdx).trimEnd() + '\n';
  console.log('[patch-android] app/build.gradle: removed previous AI CAGE block.');
}

// Append BouncyCastle and app-level autolinking
const addition = `

// AI CAGE -- BouncyCastle for on-device MITM proxy CA (LocalCertManager)
// Required by LocalCertManager.kt to generate self-signed X.509 certificates
// for the local HTTPS interception proxy. No network calls, no key export.
dependencies {
    implementation "org.bouncycastle:bcpkix-jdk18on:1.78.1"
    implementation "org.bouncycastle:bcprov-jdk18on:1.78.1"
}

// AI CAGE -- app-level autolinking (registers VPN native module with RN)
apply from: new File("${rncDir}", "native_modules.gradle"); applyNativeModulesAppBuildGradle(project)
`;

writeFileSync(appBuildPath, appBuild + addition);
console.log('[patch-android] app/build.gradle written.');

console.log('[patch-android] Done.');
