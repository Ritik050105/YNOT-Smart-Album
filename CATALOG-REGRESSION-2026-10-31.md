# Catalog and regression review — 2026-10-31

## Delivered
- Font browser checkbox is named Canva templates as requested. Its description clearly identifies YNOT-created, Canva-inspired combinations, not an official or complete Canva catalog.
- Expanded original editable compositions from 8 to 24 using existing bundled font families. Local and user-saved templates remain separately filterable.
- Combination rows scale to short/wide spreads, stay in bounds and avoid overlapping each other.
- Invalid/null saved quote records no longer hide otherwise valid saved compositions. This read filter does not rewrite stored data.
- Null JSON template/quote imports now produce a useful validation message rather than a property-access exception.

## Verification
Production renderer + Electron builds passed.
Eleven selected regression suites passed (after fixing two outdated test harnesses):
- test-bin-template-update
- test-review-fixes
- test-layer-workflows
- test-template-workflows
- test-gallery-font-update
- test-background-removal
- test-photo-shortcuts
- test-timeline-drop
- test-license-security
- test-canva-download-sync
- test-import-font-discovery

Added assertions for catalog geometry at five aspect ratios, damaged quote records alongside a valid record, and null quote import errors.
Layer test harness needed bundled asset loaders. Shortcut harness needed isolated userData to prevent previous tests' saved window settings changing its pointer coordinates. Both passed afterward.

## Remaining limits
This is a scoped source review and regression pass, not proof of zero bugs throughout the application. Installed-app and macOS testing were not performed in this turn. No installer was installed or copied to USB.
The combination library is 24 original compositions; a complete reference catalog was not supplied, so complete Canva parity cannot be claimed.
Build reports a large renderer bundle warning; no performance improvement is claimed by this change.
Canva cloud autosave is still separate from local watched-file sync: returning an edited local file is required.

## Background removal deferred
Removed at user request after the initial test run: UI, IPC, store action, model, runtime dependency and cutout-specific test. Existing image assets remain unchanged.
