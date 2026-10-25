# Offline client licensing

Packaged Windows builds require a valid signed license before the editor opens. Development builds remain usable for development. Both installer and portable builds use the same startup check. Installation itself is allowed; use of the installed application requires activation.

## Activate a client PC (no commands required)

1. Install and launch the client app. Click **Copy PC ID** on its activation screen.
2. On the administrator PC, open **YNOT License Admin.exe** from `E:\Smart album application\YNOT License Admin - Private`. Enter the client name and paste the PC ID.
3. The tool automatically detects the existing signing key on this administrator PC. If moved to another authorized administrator PC, click **Choose signing key** and select your securely transferred original PEM key. Do not create a new key for existing builds.
4. Click **Generate and save license**, choose a new filename, then use **Show license in folder**. Existing license files are never overwritten.
5. Send only the generated JSON to the client. In the client app choose **Import license**. Subsequent launches validate it automatically.

The admin executable is a separate portable tool, not included in the client installer or portable app. It contains the public verification key but no private signing key. Keep it in the administrator folder, never in the client release folder or shared client NAS.

For developers, `npm run dist:admin` builds the separate tool under `admin-license/release`; `node scripts/build-license-admin.cjs "<output-folder>"` chooses another output folder after `npm run build:main`. The existing `scripts/issue-client-license.cjs` command remains available and uses the same signing logic as the GUI.

## Key custody and limitations

The private signing key is outside the repository and release folder at `C:\Users\ritik\.ynot-licensing\signing-private.pem`, restricted to this Windows user and SYSTEM. Back it up securely offline. Never distribute it, put it on the client NAS, or commit it. The app contains only its public verification key. Losing the private key prevents issuing new licenses compatible with these builds.

The device ID hashes the Windows MachineGuid and hardware system UUID. Network changes do not affect it. A Windows reinstall or motherboard change can require a replacement license. PCs with unavailable/invalid hardware identity cannot activate; do not silently bypass this check. A license is local to the Windows user's app data; another account on the same PC may import the same license.

This is an offline deterrent to ordinary copying, not an unbreakable DRM system. There is no remote revocation or expiration. A fully cloned machine identity or deliberate binary modification can bypass local protections. Older unlicensed releases remain usable and cannot be revoked by this update. Keep source and admin tools private, control distribution of old builds, and use client Windows account/access policies where appropriate. Windows executable code signing is separate and requires your signing certificate; it is not configured by this licensing feature.

## Validation

`node scripts/test-client-license.cjs` checks signatures, device binding, invalid inputs and stable hardware identity. `node scripts/test-activation.cjs` checks the activation dialog flow with mocked dialogs and a temporary profile. These are not tests on a second physical client PC.

`npx electron scripts/test-license-admin.cjs` exercises the administrator form, signing, cancellation, key validation and overwrite protection with temporary test keys.
