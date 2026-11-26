#!/usr/bin/env node
/**
 * patch-android.mjs
 * Patches the expo-generated Android files for pnpm monorepo compatibility.
 *
 * Usage:
 *   node patch-android.mjs <settings.gradle> <app/build.gradle>
 *                          <plugin_dir> <rn_dir> <rnc_dir> <expo_dir>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';

const args = process.argv.slice(2);
const [settingsPath, appBuildPath, pluginDir, rnDir, rncDir, expoDir] = args;

if (args.length < 6) {
  console.error('Usage: node patch-android.mjs <settings> <app/build.gradle> <plugin_dir> <rn_dir> <rnc_dir> <expo_dir>');
  process.exit(1);
}

// ── Validate paths ────────────────────────────────────────────────────────────
const paths = { pluginDir, rnDir, rncDir, expoDir };
for (const [name, dir] of Object.entries(paths)) {
  if (!existsSync(dir)) {
    console.error('[patch] ERROR: ' + name + ' does not exist: ' + dir);
    process.exit(1);
  }
}

const autolinkGradle = expoDir + '/scripts/autolinking.gradle';
const nativeModules  = rncDir + '/native_modules.gradle';
const libsToml       = rnDir + '/gradle/libs.versions.toml';

for (const [desc, p] of [['autolinking.gradle', autolinkGradle], ['native_modules.gradle', nativeModules], ['libs.versions.toml', libsToml]]) {
  if (!existsSync(p)) {
    console.error('[patch] ERROR: ' + desc + ' not found: ' + p);
    process.exit(1);
  }
  console.log('[patch] confirmed: ' + desc + ' => ' + p);
}

// ── Patch 1: settings.gradle — surgical line-by-line replacement ─────────────
//
// expo prebuild generates settings.gradle with dynamic node --print calls:
//   new File(["node","--print","require.resolve(...)"].execute(null,rootDir).text.trim())
// These return "null" in pnpm monorepo (packages are in .pnpm virtual store,
// not accessible from android/ at Gradle config time).
//
// We process line-by-line, collecting multi-line blocks, and replace each
// dynamic expression with a pre-resolved absolute path.

const rawSettings = readFileSync(settingsPath, 'utf8');
console.log('[patch] settings.gradle BEFORE:\n' + rawSettings + '\n---');

const lines = rawSettings.split('\n');
const out = [];

// Helper: does this line start a dynamic new File(["node"...]) block?
function isDynamicLine(l) {
  return l.includes('.execute(null, rootDir)') ||
         l.includes('.execute(null,rootDir)') ||
         l.includes('new File(["node"') ||
         l.includes("new File(['node'");
}

// Classify what a block resolves to
function classify(block) {
  if (block.includes('gradle-plugin')) return 'plugin';
  if (block.includes('autolinking.gradle') || block.includes("'expo/package.json'") || block.includes('"expo/package.json"')) return 'expo';
  if (block.includes('libs.versions.toml') || block.includes("'react-native/package.json'") || block.includes('"react-native/package.json"')) return 'toml';
  if (block.includes('cli-platform-android') || block.includes('native_modules.gradle')) return 'rnc';
  return 'unknown';
}

let i = 0;
while (i < lines.length) {
  const line = lines[i];

  // Keep react-settings-plugin — required for RN 0.74.x (declares com.facebook.react.settings).
  // expo prebuild generates android/react-settings-plugin/ alongside settings.gradle.
  // This directory is committed to git and restored by CI before Gradle runs.
  // DO NOT remove this includeBuild — removing it causes:
  //   "Plugin [id: 'com.facebook.react.settings'] was not found"
  if (line.trim() === 'includeBuild("react-settings-plugin")' ||
      line.trim() === "includeBuild('react-settings-plugin')") {
    console.log('[patch] keeping react-settings-plugin includeBuild (required for RN 0.74.x)');
    out.push(line);
    i++;
    continue;
  }

  if (isDynamicLine(line)) {
    // Collect the full block until parens balance
    let block = line;
    let depth = 0;
    for (const ch of line) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    let j = i + 1;
    while (depth > 0 && j < lines.length) {
      block += '\n' + lines[j];
      for (const ch of lines[j]) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      j++;
    }
    i = j; // skip all consumed lines

    const kind = classify(block);
    const indent = line.match(/^(\s*)/)[1];

    if (kind === 'plugin') {
      out.push(indent + 'includeBuild("' + pluginDir + '")');
    } else if (kind === 'expo') {
      // Preserve the "apply from:" prefix if present, then useExpoModules stays
      if (block.includes('apply from:')) {
        out.push(indent + 'apply from: new File("' + expoDir + '", "scripts/autolinking.gradle");');
      } else {
        out.push(indent + '"' + expoDir + '/scripts/autolinking.gradle"');
      }
    } else if (kind === 'toml') {
      out.push(indent + 'from(files("' + libsToml + '"))');
    } else if (kind === 'rnc') {
      if (block.includes('apply from:')) {
        out.push(indent + 'apply from: new File("' + rncDir + '", "native_modules.gradle"); applyNativeModulesSettingsGradle(settings)');
      } else {
        out.push(indent + '"' + rncDir + '"');
      }
    } else {
      console.error('[patch] WARNING: unknown dynamic block at line ' + (i - (block.split('\n').length) + 1) + ':');
      console.error('  ' + block.split('\n')[0].trim());
      out.push('// [patch] replaced unknown dynamic call');
    }
    continue;
  }

  out.push(line);
  i++;
}

const patched = out.join('\n');

// Final check
const residual = out.filter(function(l) {
  return l.includes('.execute(null, rootDir)') || l.includes('.execute(null,rootDir)');
});
if (residual.length > 0) {
  console.error('[patch] ERROR: .execute(null, rootDir) still present:');
  residual.forEach(function(l) { console.error('  ' + l.trim()); });
  process.exit(1);
}

console.log('[patch] settings.gradle AFTER:\n' + patched + '\n---');
writeFileSync(settingsPath, patched);
console.log('[patch] settings.gradle written OK');

// ── Patch 2: app/build.gradle — append BouncyCastle + autolinking ─────────────
let appBuild = readFileSync(appBuildPath, 'utf8');

// Idempotent: strip previous AI CAGE block
const MARKER = '// AI CAGE --';
const idx = appBuild.indexOf(MARKER);
if (idx !== -1) {
  appBuild = appBuild.slice(0, idx).trimEnd() + '\n';
  console.log('[patch] app/build.gradle: removed previous AI CAGE block');
}

appBuild += '\n' +
  '// AI CAGE -- BouncyCastle for on-device MITM proxy CA (LocalCertManager)\n' +
  'dependencies {\n' +
  '    implementation "org.bouncycastle:bcpkix-jdk18on:1.78.1"\n' +
  '    implementation "org.bouncycastle:bcprov-jdk18on:1.78.1"\n' +
  '}\n' +
  '\n' +
  '// AI CAGE -- app-level autolinking\n' +
  'apply from: new File("' + rncDir + '", "native_modules.gradle"); applyNativeModulesAppBuildGradle(project)\n';

writeFileSync(appBuildPath, appBuild);
console.log('[patch] app/build.gradle written OK');
console.log('[patch] Done.');
