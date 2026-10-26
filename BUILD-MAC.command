#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
trap 'echo "Build stopped. Read the error above; do not distribute partial output." >&2' ERR
if [ "$(uname -s)" != Darwin ]; then echo "Run this on a Mac, not Windows." >&2; exit 1; fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then echo "Install the included Node.js package, reopen Terminal and try again." >&2; exit 1; fi
node -e 'if(Number(process.versions.node.split(".")[0])<22) throw Error("Node.js 22 or newer is required")'
arch="$(node -p 'process.arch')"
case "$arch" in arm64|x64) ;; *) echo "Unsupported Node architecture: $arch" >&2; exit 1 ;; esac
hardware="$(uname -m)"
if [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ] || { [ "$hardware" = arm64 ] && [ "$arch" != arm64 ]; }; then
  echo "Use native Apple Silicon Node and Terminal (not Rosetta), then try again." >&2; exit 1
fi
xcode-select -p >/dev/null || { echo "Install Apple's Command Line Tools: xcode-select --install" >&2; exit 1; }
mode="${1:-test}"
case "$mode" in
  test)
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    signing=("--config.mac.sign=$PWD/scripts/sign-mac-test.cjs" --config.mac.hardenedRuntime=false --config.mac.notarize=false)
    echo "LOCAL TEST BUILD: not Developer ID signed/notarized. Not ready for office rollout."
    ;;
  signed)
    : "${APPLE_KEYCHAIN_PROFILE:?Set APPLE_KEYCHAIN_PROFILE to your notarytool Keychain profile first}"
    if ! security find-identity -v -p codesigning | grep -q 'Developer ID Application:'; then
      echo "Install a Developer ID Application certificate and its private key in Keychain first." >&2; exit 1
    fi
    export CSC_IDENTITY_AUTO_DISCOVERY=true
    signing=(--config.forceCodeSigning=true --config.mac.notarize=true)
    ;;
  *) echo "Usage: bash BUILD-MAC.command [test|signed]" >&2; exit 1 ;;
esac
# Use the lockfile and native Mac dependencies, never the Windows node_modules.
npm ci --include=optional
npm run build
node scripts/test-client-license.cjs
node scripts/test-license-backup.cjs
out="$(mktemp -d "$HOME/Desktop/YNOT-Mac-$arch-$mode-XXXXXX")"
client="$out/01 - Employee Installation"
owner="$out/02 - Owner Only - Private"
mkdir -p "$client" "$owner"
npx --no-install electron-builder --mac "--$arch" --publish never "--config.directories.output=$client" "${signing[@]}"
node scripts/build-license-admin.cjs "$owner" --publish never "${signing[@]}"
if [ "$mode" = signed ]; then
  for dir in "$client" "$owner"; do
    for bundle in "$dir"/mac*/*.app; do
      [ -d "$bundle" ] || { echo "Packaged app missing in $dir" >&2; exit 1; }
      codesign --verify --deep --strict "$bundle"
      xcrun stapler validate "$bundle"
      spctl --assess --type execute --verbose "$bundle"
    done
  done
fi
find "$out" -type f -name '*.dmg' -exec shasum -a 256 {} \; > "$out/DMG-SHA256.txt"
echo "Both builds finished: $out"
echo "Install and run the acceptance checklist before distributing."
echo "Copy only the employee DMG to employee Macs. Keep admin DMG and signing key with the owner."