#!/usr/bin/env python3
"""
patch_settings.py — Fix settings.gradle for pnpm monorepo + React Native

PROBLEM:
  In a pnpm monorepo, expo prebuild generates settings.gradle with a dynamic
  includeBuild that calls `node --print require.resolve(...)` from android/.
  On Codemagic (and any CI where packages are hoisted to workspace root),
  this returns "null" because @react-native/gradle-plugin is NOT inside
  apps/mobile/node_modules/ — it lives at the workspace root node_modules/.
  Gradle then tries includeBuild(".../android/null") and fails.

  The exact generated pattern varies by Expo/RN version and OS. Rather than
  trying to match a moving target with a regex, this script uses a REWRITE
  strategy: it replaces the ENTIRE settings.gradle with a known-good version
  that uses an absolute path to the gradle plugin.

STRATEGY:
  1. Read the generated settings.gradle (to extract projectName and any extra lines)
  2. Write a clean settings.gradle with a hardcoded absolute includeBuild path
  3. Keep all other content (native_modules.gradle apply, include ':app', etc.)

USAGE:
  python3 patch_settings.py <settings.gradle> <plugin_dir> <project_name>

  Example (from codemagic.yaml):
    python3 patch_settings.py \\
      "$CM_BUILD_DIR/apps/mobile/android/settings.gradle" \\
      "$CM_BUILD_DIR/node_modules/@react-native/gradle-plugin" \\
      "ai-cage-mobile"
"""

import re
import sys
import os

def find_plugin_dir(hint_path):
    """Find the gradle-plugin directory, trying multiple locations."""
    candidates = [
        hint_path,
        # pnpm virtual store (Codemagic puts everything at workspace root)
        os.path.join(os.path.dirname(os.path.dirname(hint_path)), ".pnpm"),
    ]

    # Direct hint path
    if os.path.isdir(hint_path):
        return hint_path

    # Walk up from hint looking for the package
    base = os.path.dirname(hint_path)  # node_modules/@react-native
    parent = os.path.dirname(base)     # node_modules
    for root_candidate in [parent, os.path.dirname(parent)]:
        p = os.path.join(root_candidate, "node_modules", "@react-native", "gradle-plugin")
        if os.path.isdir(p):
            return p
        p2 = os.path.join(root_candidate, "@react-native", "gradle-plugin")
        if os.path.isdir(p2):
            return p2

    return None


def main():
    if len(sys.argv) < 3:
        print("Usage: patch_settings.py <settings.gradle> <plugin_dir> [project_name]", file=sys.stderr)
        sys.exit(1)

    settings_path = sys.argv[1]
    plugin_dir_hint = sys.argv[2]
    project_name = sys.argv[3] if len(sys.argv) > 3 else "app"

    # --- Validate settings.gradle exists ---
    if not os.path.isfile(settings_path):
        print(f"ERROR: settings.gradle not found: {settings_path}", file=sys.stderr)
        sys.exit(1)

    with open(settings_path, "r", encoding="utf-8") as f:
        original = f.read()

    print("=== Original settings.gradle ===")
    print(original[:600])
    print("=================================")

    # --- Find gradle plugin directory ---
    plugin_dir = None
    if os.path.isdir(plugin_dir_hint):
        plugin_dir = plugin_dir_hint
    else:
        print(f"WARNING: plugin dir not found at hint: {plugin_dir_hint}", file=sys.stderr)
        # Try to find it relative to CM_BUILD_DIR
        cm_build_dir = os.environ.get("CM_BUILD_DIR", "")
        if cm_build_dir:
            candidates = [
                os.path.join(cm_build_dir, "node_modules", "@react-native", "gradle-plugin"),
                os.path.join(cm_build_dir, "apps", "mobile", "node_modules", "@react-native", "gradle-plugin"),
            ]
            for c in candidates:
                print(f"  trying: {c} -> {'EXISTS' if os.path.isdir(c) else 'missing'}", file=sys.stderr)
                if os.path.isdir(c):
                    plugin_dir = c
                    break

    if not plugin_dir:
        # Last resort: list what's available
        hint_parent = os.path.join(os.path.dirname(plugin_dir_hint), "@react-native")
        if os.path.isdir(hint_parent):
            pkgs = os.listdir(hint_parent)
            print(f"Available @react-native packages: {pkgs}", file=sys.stderr)
        print(f"FATAL: cannot locate @react-native/gradle-plugin", file=sys.stderr)
        sys.exit(1)

    # Normalize to forward slashes (Groovy/Gradle on any OS)
    plugin_dir = plugin_dir.replace("\\", "/")
    print(f"Using plugin dir: {plugin_dir}")

    # --- Determine project name from original settings.gradle ---
    # Try to extract: rootProject.name = 'something'
    m = re.search(r"rootProject\.name\s*=\s*['\"]([^'\"]+)['\"]", original)
    if m:
        project_name = m.group(1)

    # --- Extract native_modules.gradle apply line if present ---
    native_modules_line = ""
    for line in original.splitlines():
        stripped = line.strip()
        if "native_modules.gradle" in stripped or "applyNativeModulesSettingsGradle" in stripped:
            native_modules_line = stripped
            break

    # --- Check if already patched with a static path ---
    # If the original no longer contains "new File" or ".execute(", it's already patched
    if "new File" not in original and ".execute(" not in original and f'includeBuild("{plugin_dir}")' in original:
        print("INFO: settings.gradle already patched with static path — nothing to do.")
        sys.exit(0)

    # --- Write the clean settings.gradle ---
    # Build the native_modules apply line using a relative path
    # (kept as-is from original if present, otherwise use standard path)
    if not native_modules_line:
        native_modules_line = (
            'apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle"); '
            'applyNativeModulesSettingsGradle(settings)'
        )

    patched = f"""rootProject.name = '{project_name}'
{native_modules_line}
include ':app'
includeBuild("{plugin_dir}")
"""

    with open(settings_path, "w", encoding="utf-8") as f:
        f.write(patched)

    print(f"OK: rewrote {settings_path}")
    print(f"    rootProject.name = '{project_name}'")
    print(f"    includeBuild(\"{plugin_dir}\")")

    # --- Verification ---
    with open(settings_path, "r", encoding="utf-8") as f:
        verified = f.read()

    print("=== Patched settings.gradle ===")
    print(verified)
    print("================================")

    # Fail-safe: confirm "null" is not in an includeBuild line
    for line in verified.splitlines():
        if "includeBuild" in line and "/null" in line:
            print(f"ERROR: null still in includeBuild after rewrite: {line}", file=sys.stderr)
            sys.exit(1)

    if "new File" in verified or ".execute(" in verified:
        print("ERROR: dynamic expression still present after rewrite!", file=sys.stderr)
        sys.exit(1)

    print("VERIFIED: settings.gradle is clean.")


if __name__ == "__main__":
    main()
