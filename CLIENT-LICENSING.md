# Offline client licensing

Packaged Windows builds require a valid signed license before the editor opens. Development builds remain usable for development. Both installer and portable builds use the same startup check. Installation itself is allowed; use of the installed application requires activation.

## Activate a client PC (no commands required)

1. Install and launch the client app. Click **Copy PC ID** on its activation screen.
2. On the administrator PC, open **YNOT License Admin.exe** from `E:\Smart album application\YNOT License Admin - Private`. Enter the employee name and paste the PC ID.
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

## License history

The separate admin tool records the employee name, complete PC ID, original issue date and saved JSON path in `license-history.json` in its own Windows user-data folder. History survives closing the tool and restarting Windows. Use the search field to filter by employee name or PC ID, then **Open license** or **Show in folder**.

Use **Add existing license** to register licenses made before history was added, or to locate a license moved to another folder. Only licenses signed by the app's matching key are accepted. Moving a license updates its path without adding another PC record. Missing files are marked; changed or invalid files cannot be opened through history. Keep backups of the history and saved license files. An unreadable history file is preserved, and new issuance is blocked until it is restored.

The admin tool blocks a second issuance for a PC already present in its local history. This is an administrative safeguard, not an online activation counter. The signed PC identity is what rejects copied licenses on other PCs. Importing the same valid license again on its original PC remains allowed and does not create another entitlement. A strict globally tracked one-time redemption requires an activation server; offline license files cannot enforce it reliably. Full machine-identity cloning or deliberate app modification remains outside this offline protection.

## Back up and move to another administrator PC

Choose **Back up history & files** in License history and save a new backup JSON. It includes every recorded signed license and its client/PC/issue-date details, but never the private signing key. A missing or changed license blocks the backup; first reconnect it with **Add existing license**. Keep backup files private because they contain client records.

On the destination PC, open the separate admin tool, choose **Restore backup**, select the file and review the counts before confirming. Existing records are retained. Identical PC licenses are skipped, missing license files are repaired, and different licenses for the same PC are rejected rather than silently overwritten. Restored files live in the admin tool's user-data folder. The normal history Open/Show buttons work with their new local paths, and duplicate issuance checks immediately include restored PCs. Restoring the same backup again does not duplicate records.

Transfer the original private signing key separately using your secure backup process if the new PC needs to issue new licenses. Restoring and opening existing licenses does not require the private key. Use the restored destination as your issuing PC and stop issuing on the old PC; disconnected offline admin PCs cannot synchronize future issuance. Restoring an old backup cannot recover records created after it. An unreadable current history is preserved and blocks merging: retain that file for recovery rather than deleting unknown records.

Backup/restore tests: `node scripts/test-license-backup.cjs` covers transfer, validation, merge, missing-file repair, repeated restore, rejected tampering/conflicts and rollback on write failure. The admin GUI tests cover buttons, confirmation, cancellation and duplicate blocking after restore.

## Restore preview

Selecting a backup opens a review dialog before any files or history change. Every validated license shows its employee name, full PC ID and original issue date. Labels distinguish **New**, **Already present**, **Already present - restore missing file**, and **Conflicting** records. Conflicts show the reason and current employee/date for comparison. Duplicate PC entries in a backup are also marked conflicting.

Choose **Restore** to apply a conflict-free preview or **Cancel** (Escape also works) to leave everything unchanged. Restore is disabled when conflicts exist; no partial restore or overwrite occurs. Invalid signatures or malformed backups are rejected before preview. The app holds the validated backup contents until confirmation and refuses to apply if local history changed in the meantime.

The restore preview has **Show only new and conflicting records**. It hides already-present rows (including missing-file repairs) for review only. The summary and Restore eligibility still describe the complete backup. Restore applies the same full validated plan regardless of the filter; Cancel makes no changes. Reopening the preview keeps the search and status checkbox from the last preview while the admin tool remains open.

## Studio-owner handoff and employee licensing

During the first setup, place the separate admin tool on the studio owner's administrator PC and securely provision the original signing key there. The tool detects it at that Windows user's `.ynot-licensing/signing-private.pem`, or the owner can use **Choose signing key**. Keep a separate secure backup of that key and keep it away from employee PCs.

After setup, the owner can independently enter the employee's full name, paste the PC ID copied from the employee's Album Studio activation screen, and save the license. Give that employee only the generated JSON to import on that PC. The owner does not need commands, internet access or the developer to issue these licenses.

The admin interface now uses **Employee name** throughout. Existing licenses and history retain their previously recorded names; the app does not guess employees or rewrite signed files. The internal signed `client` field is retained for compatibility and stores the employee name for newly issued licenses.

Restore preview search matches employee names (including the current name shown on conflicting records) or partial/full PC IDs, ignoring case and surrounding spaces. Search and **Show only new and conflicting records** combine. Both are retained when reopening the preview during the current admin session. Summary counts and Restore eligibility still cover the full validated backup, and hiding a conflict never enables Restore. Cancel makes no changes.

**Clear search** beside the restore-preview search field clears only the query and returns focus to search. It preserves the status checkbox, summary, restore plan and conflict blocking. It is disabled when the search is empty.

**Reset filters** clears the preview search and unchecks Show only new and conflicting records together, revealing all records and returning focus to search. It changes no data, conflict rules or restore plan. Restore and Cancel remain available. The button is disabled when both filters are already clear.

Reopening after Restore, Cancel or Escape keeps the latest display filters during the current admin session. Clear search and Reset filters also become the remembered state. A fresh backup is still validated on every open; no pending restore operation is saved or automatically applied. Closing the admin tool starts a new filter session.
