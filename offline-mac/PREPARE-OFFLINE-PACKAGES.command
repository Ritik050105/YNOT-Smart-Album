#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
[ "$(uname -s)" = Darwin ] || { echo 'Run on the Mac with the completed local DMG builds.' >&2; exit 1; }
builds="${1:?Usage: bash PREPARE-OFFLINE-PACKAGES.command /path/to/YNOT-Mac-build-output}"
count=0
for arch in arm64 x64; do
  client="$builds/01 - Employee Installation/YNOT Album Studio-0.1.5-$arch.dmg"
  admin="$builds/02 - Owner Only - Private/YNOT-License-Admin-1.0.1-$arch.dmg"
  if [ ! -f "$client" ] && [ ! -f "$admin" ]; then continue; fi
  [ -f "$client" ] && [ -f "$admin" ] || { echo "Both DMGs are required for $arch." >&2; exit 1; }
  for role in 'Employee Mac' 'Owner Mac'; do
    target="$PWD/$role/payload/$arch"
    mkdir -p "$target"
    cp "$client" "$target/YNOT Album Studio.dmg"
    shasum -a 256 "$target/YNOT Album Studio.dmg" | cut -d ' ' -f 1 > "$target/YNOT Album Studio.dmg.sha256"
  done
  cp "$admin" "$PWD/Owner Mac/payload/$arch/YNOT License Admin.dmg"
  shasum -a 256 "$PWD/Owner Mac/payload/$arch/YNOT License Admin.dmg" | cut -d ' ' -f 1 > "$PWD/Owner Mac/payload/$arch/YNOT License Admin.dmg.sha256"
  count=$((count+1))
  echo "Prepared offline $arch packages."
done
[ "$count" -gt 0 ] || { echo 'No matching completed builds found. No files downloaded.' >&2; exit 1; }
echo 'Copy Employee Mac to employee USBs. Keep Owner Mac private. Test installation on a Mac before rollout.'
