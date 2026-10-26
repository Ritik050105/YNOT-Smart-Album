#!/bin/bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
trap 'echo "Repair stopped. Do not install partial output. Send the error above."; read -r -p "Press Return to close. " _ || true' ERR
[ "$(uname -s)" = Darwin ] || { echo 'Run on the Mac used to build YNOT.'; exit 1; }
source="${1:-$HOME/Desktop/YNOT-Mac-Source}"
cd "$source"
source="$PWD"
command -v node >/dev/null
arch="$(node -p process.arch)"
case "$arch" in arm64|x64) ;; *) echo 'Unsupported architecture'; exit 1;; esac
if [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ] || { [ "$(sysctl -in hw.optional.arm64 2>/dev/null || echo 0)" = 1 ] && [ "$arch" != arm64 ]; }; then
 echo 'Use native Terminal and native Node on Apple Silicon, not Rosetta.'; exit 1
fi
[ -d node_modules/electron/dist/Electron.app ] && [ -f node_modules/electron-builder/cli.js ] && [ -f dist-electron/main.js ] && [ -f dist/index.html ] || { echo 'Use the original source folder with the completed build and node_modules. Nothing will be downloaded.'; exit 1; }
node -e 'require("sharp"); console.log("Local Sharp dependency loads")'
node "$here/fix-config.cjs" "$source/package.json"
export npm_config_offline=true CSC_IDENTITY_AUTO_DISCOVERY=false
out="$(mktemp -d "$HOME/Desktop/YNOT-Mac-$arch-fixed-XXXXXX")"
node node_modules/electron-builder/cli.js --mac dmg "--$arch" --publish never --config.npmRebuild=false --config.nodeGypRebuild=false "--config.electronDist=$source/node_modules/electron/dist" "--config.directories.output=$out" "--config.mac.sign=$source/scripts/sign-mac-test.cjs" --config.mac.hardenedRuntime=false --config.mac.notarize=false
if [ "$arch" = arm64 ]; then folder=mac-arm64; else folder=mac; fi
bundle="$out/$folder/YNOT Album Studio.app"
codesign --verify --deep --strict "$bundle"
ELECTRON_RUN_AS_NODE=1 "$bundle/Contents/MacOS/YNOT Album Studio" "$here/test-packaged-sharp.cjs" "$bundle/Contents/Resources/app.asar" "$arch"
find "$out" -maxdepth 1 -name '*.dmg' -exec shasum -a 256 {} \; > "$out/DMG-SHA256.txt"
echo "Repair and packaged image test passed: $out"
echo 'Use only the DMG in this new fixed folder for this Mac architecture.'
echo 'This is still an ad-hoc signed local test build. Read INSTALL STEPS.txt.'
read -r -p 'Press Return to close. ' _ || true
