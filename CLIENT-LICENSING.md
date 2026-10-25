# Offline client licensing

Packaged Windows builds require a valid signed license before the editor opens. Development builds remain usable for development. Both installer and portable builds use the same startup check. Installation itself is allowed; use of the installed application requires activation.

## Activate a client PC

1. Install and launch YNOT Album Studio. Click **Copy PC ID** and send that ID to the administrator.
2. On the administrator PC, run `npm run build:main`, then:

   ```powershell
   node scripts/issue-client-license.cjs <PC-ID> "Client company" "C:\Licenses\client-pc-01.json" "C:\Users\ritik\.ynot-licensing\signing-private.pem"
   ```

   The output must be a new file. Use one license per approved PC.
3. Send only the resulting license JSON to the client. Click **Import license** in the app. The app saves and checks the license on subsequent launches.

## Key custody and limitations

The private signing key is outside the repository and release folder at `C:\Users\ritik\.ynot-licensing\signing-private.pem`, restricted to this Windows user and SYSTEM. Back it up securely offline. Never distribute it, put it on the client NAS, or commit it. The app contains only its public verification key. Losing the private key prevents issuing new licenses compatible with these builds.

The device ID hashes the Windows MachineGuid and hardware system UUID. Network changes do not affect it. A Windows reinstall or motherboard change can require a replacement license. PCs with unavailable/invalid hardware identity cannot activate; do not silently bypass this check. A license is local to the Windows user's app data; another account on the same PC may import the same license.

This is an offline deterrent to ordinary copying, not an unbreakable DRM system. There is no remote revocation or expiration. A fully cloned machine identity or deliberate binary modification can bypass local protections. Older unlicensed releases remain usable and cannot be revoked by this update. Keep source and admin tools private, control distribution of old builds, and use client Windows account/access policies where appropriate. Windows executable code signing is separate and requires your signing certificate; it is not configured by this licensing feature.

## Validation

`node scripts/test-client-license.cjs` checks signatures, device binding, invalid inputs and stable hardware identity. `node scripts/test-activation.cjs` checks the activation dialog flow with mocked dialogs and a temporary profile. These are not tests on a second physical client PC.
