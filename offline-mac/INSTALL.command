#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
finish() { printf '\nPress Return to close. '; read -r _ || true; }
trap 'echo "Installation stopped. Read the message above." >&2; finish' ERR
if [ "$(uname -s)" != Darwin ]; then echo 'This installer runs only on macOS.' >&2; exit 1; fi
role="$(cat INSTALL-ROLE.txt)"
case "$role" in
  owner) apps=('YNOT Album Studio' 'YNOT License Admin') ;;
  employee) apps=('YNOT Album Studio') ;;
  *) echo 'Invalid installer role.' >&2; exit 1 ;;
esac
if [ "$(sysctl -in hw.optional.arm64 2>/dev/null || echo 0)" = 1 ]; then arch=arm64; else arch=x64; fi
native_arch="$arch"; [ "$arch" != x64 ] || native_arch=x86_64
payload="$PWD/payload/$arch"
destination="$HOME/Applications"
# Validate all input files before changing the installed applications.
for name in "${apps[@]}"; do
  dmg="$payload/$name.dmg"
  if [ ! -f "$dmg" ] || [ ! -f "$dmg.sha256" ]; then
    echo "Missing offline Mac package: $dmg (and its .sha256 file)." >&2
    echo 'No downloads will be attempted. Ask the installer to add the built Mac package.' >&2
    finish; exit 1
  fi
  expected="$(tr -d '\r\n' < "$dmg.sha256")"
  [[ "$expected" =~ ^[a-fA-F0-9]{64}$ ]] || { echo "Invalid checksum for $name" >&2; exit 1; }
  actual="$(shasum -a 256 "$dmg" | cut -d ' ' -f 1)"
  [ "$(printf '%s' "$expected" | tr 'A-F' 'a-f')" = "$actual" ] || { echo "Checksum failed: $name" >&2; exit 1; }
  if [ -e "$destination/$name.app" ]; then
    echo "$destination/$name.app already exists. Nothing was overwritten." >&2
    echo 'For an upgrade, quit the app and rename the old app in Finder before rerunning.' >&2
    finish; exit 1
  fi
done
mkdir -p "$destination"
work="$(mktemp -d "$destination/.ynot-install-XXXXXX")"
mounted=false
cleanup() {
  if [ "$mounted" = true ]; then hdiutil detach "$work/mount" -quiet || true; fi
  # This is the exact temporary directory made above; never remove user apps.
  if [[ "$work" == "$destination"/.ynot-install-* ]]; then rm -rf "$work"; fi
}
trap cleanup EXIT
mkdir "$work/mount"
for name in "${apps[@]}"; do
  hdiutil attach "$payload/$name.dmg" -readonly -nobrowse -mountpoint "$work/mount" -quiet
  mounted=true
  bundle="$work/mount/$name.app"
  [ -d "$bundle" ] || { echo "Expected app missing from disk image: $name" >&2; exit 1; }
  if [ "$name" = 'YNOT License Admin' ]; then id=com.ynotphotography.licenseadmin; else id=com.ynotphotography.albumstudio; fi
  [ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$bundle/Contents/Info.plist")" = "$id" ] || { echo 'Wrong application in package.' >&2; exit 1; }
  executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$bundle/Contents/Info.plist")"
  [[ "$executable" != */* && "$executable" != '..' ]] || { echo 'Invalid application executable.' >&2; exit 1; }
  binary_info="$(file -b "$bundle/Contents/MacOS/$executable")"
  [[ "$binary_info" == *"$native_arch"* ]] || { echo 'Package architecture does not match this Mac.' >&2; exit 1; }
  codesign --verify --deep --strict "$bundle"
  ditto "$bundle" "$work/$name.app"
  hdiutil detach "$work/mount" -quiet
  mounted=false
done
for name in "${apps[@]}"; do
  [ ! -e "$destination/$name.app" ] || { echo 'Destination changed during installation; stopped.' >&2; exit 1; }
  mv "$work/$name.app" "$destination/$name.app"
done
printf '\nInstalled locally into %s\n' "$destination"
printf '  %s.app\n' "${apps[@]}"
echo 'Open the apps from Finder > Go > Home > Applications.'
echo 'License creation and import are manual; see OFFLINE LICENSE STEPS.txt.'
echo 'No downloads or license activation requests were made by this installer.'
finish
