#!/usr/bin/env python3
"""
patch_settings.py — Fix settings.gradle for pnpm monorepo + React Native

PROBLEM:
  expo prebuild generates settings.gradle with a dynamic includeBuild that
  resolves @react-native/gradle-plugin via a shell-exec node command:

    includeBuild(new File(["node", "--print",
      "require.resolve('@react-native/gradle-plugin/package.json')"]
      .execute(null, rootDir).text.trim()).parentFile.absolutePath)

  In a pnpm workspace, `node --print require.resolve(...)` executed from
  android/ returns "null" because @react-native/gradle-plugin lives in the
  workspace root node_modules/ (hoisted), not in apps/mobile/node_modules/.
  Gradle then tries to includeBuild(".../android/null") which does not exist.

SOLUTION:
  Replace the entire dynamic includeBuild(...) expression with a static path
  computed here from the workspace root node_modules.

USAGE:
  python3 patch_settings.py <settings.gradle> <path_to_gradle_plugin_dir>

  Example (called from codemagic.yaml):
    SETTINGS="$CM_BUILD_DIR/apps/mobile/android/settings.gradle"
    PLUGIN="$CM_BUILD_DIR/node_modules/@react-native/gradle-plugin"
    python3 "$CM_BUILD_DIR/apps/mobile/scripts/patch_settings.py" "$SETTINGS" "$PLUGIN"
"""

import re
import sys
import os

def main():
    if len(sys.argv) != 3:
        print("Usage: patch_settings.py <settings.gradle> <plugin_dir>", file=sys.stderr)
        sys.exit(1)

    settings_path = sys.argv[1]
    plugin_dir = sys.argv[2]

    if not os.path.isfile(settings_path):
        print(f"ERROR: settings.gradle not found: {settings_path}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isdir(plugin_dir):
        print(f"ERROR: gradle-plugin directory not found: {plugin_dir}", file=sys.stderr)
        print("Available node_modules:", file=sys.stderr)
        rn_dir = os.path.join(os.path.dirname(plugin_dir), "@react-native")
        if os.path.isdir(rn_dir):
            for d in os.listdir(rn_dir):
                print(f"  @react-native/{d}", file=sys.stderr)
        sys.exit(1)

    with open(settings_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Match the entire dynamic includeBuild expression — may span multiple lines.
    # Pattern: includeBuild(new File([...].execute(...).text.trim()).parentFile.absolutePath)
    pattern = re.compile(
        r'includeBuild\(new\s+File\(\["node".*?\.absolutePath\)',
        re.DOTALL
    )

    if not pattern.search(content):
        print("INFO: dynamic includeBuild not found — settings.gradle may already be patched.")
        print(content[:500])
        # Not an error: could be a future Expo version that generates differently
        sys.exit(0)

    # Escape backslashes for the replacement string (Windows paths)
    safe_plugin_dir = plugin_dir.replace("\\", "/")
    replacement = f'includeBuild("{safe_plugin_dir}")'

    patched = pattern.sub(replacement, content)

    with open(settings_path, "w", encoding="utf-8") as f:
        f.write(patched)

    print(f"OK: patched {settings_path}")
    print(f"    includeBuild => \"{safe_plugin_dir}\"")

    # Verification: re-read and confirm "null" is gone
    with open(settings_path, "r", encoding="utf-8") as f:
        verified = f.read()

    if "null" in verified and 'includeBuild' in verified:
        # Only fail if null appears as part of an includeBuild path
        lines = [l for l in verified.splitlines() if "includeBuild" in l and "null" in l]
        if lines:
            print(f"ERROR: 'null' still present in includeBuild after patch:", file=sys.stderr)
            for l in lines:
                print(f"  {l}", file=sys.stderr)
            sys.exit(1)

    print("VERIFIED: no residual null in includeBuild lines.")

if __name__ == "__main__":
    main()
