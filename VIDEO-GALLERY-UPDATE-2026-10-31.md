# Video and gallery update - 31 October 2026

Implementation checkout: E:\Smart album application\.claude\worktrees\project-analysis-ce4b4c
Version currently in package.json: 0.1.17. This report does not certify an installed release.

## Changes in this pass
- Gallery context menu: Copy, Copy Filename(s), Delete, Make Background Image of Current Spread, Open in Photo Viewer, Show in Explorer/Finder, Photoshop, Canva, Reload from Original, Replace Image and Relink Missing File. Unsupported multi-selection operations are disabled. Existing used-photo deletion warning is retained.
- Gallery Copy integrates with canvas paste and Undo; gallery shortcuts are scoped to the gallery.
- Import builds 1600px WebP previews from native file paths with two concurrent workers, retains source paths/original resolution for export, and displays embedded progress rather than a blocking import dialog. Preview seeds are separate from the thumbnail cache so 300 imported photos do not immediately evict one another.
- Font discovery scans accessible Windows drive letters or macOS user/font folders and mounted volumes. Scan progress and cancellation are available. Fonts load lazily; bulk/folder font import is available.
- Added 14 Google Fonts families bundled offline, with OFL files under public/licenses/google-fonts. Added eight original editable font combinations. These are not Canva's complete proprietary catalog.
- Imported template classifications populate the category index.
- Unchanged PSD quote artwork retains its source bounds instead of being remeasured using a fallback font. Overview grouped resizing uses group bounds and proportional font scaling, and commits one Undo step. Group movement includes grouped images and text.

## Checks
- npm run build: passed renderer TypeScript/Vite and Electron TypeScript compilation.
- scripts/test-gallery-font-update.cjs: passed context-menu labels, actual gallery paste and Undo, proportional quote resize/artwork bounds, imported category indexing, 300 preview seeds, 14 bundled font families, eight compositions.
- scripts/test-review-fixes.cjs: passed actual overview pointer movement, smart-grid removal, slider reset, rotation coverage, empty-spread cleanup and Undo.
- scripts/test-template-workflows.cjs: passed earlier in this pass: used-photo deletion cancellation, delete Undo/Redo, formatting Undo, mixed template classification/export/import.
- scripts/test-import-font-discovery.cjs: passed earlier in this pass. Native preview pipeline processed 300 copies of one 4000x3000 PNG (36,066,826 bytes) in 92.649 seconds; average preview 1,017,162 bytes; original hash unchanged. This is not a measurement of 300 distinct client photos in the installed app.
- One concurrent build/test attempt exhausted host memory. Sequential build and interaction test passed afterward.

## Video review and remaining acceptance
All nine supplied videos were visually sampled using contact sheets. No audio transcript was used, per the user's clarification.
- 22.31.09 and 22.48.34: quote bounds and resize mismatch addressed by preserving source artwork bounds and group scaling.
- 22.26.41, 22.30.15, 22.35.55 and 22.39.56: classification indexing corrected. No-match states with all template sources unchecked are expected; specific client favorites/frequent-category data still needs replay against that client's project.
- 22.21.30, 22.23.26 and 22.34.48: rotation, gap indicators and accumulated quote/group interactions require a complete installed-app replay before claiming every demonstrated issue is resolved. Screens alone do not establish every intended operation.

## Limits / release gate
- No installer built, installed-app test, Mac runtime test, or USB copy for this pass.
- Font discovery supports TTF/OTF/WOFF/WOFF2 up to 10MB each, skips symlinks and inaccessible folders; TTC collections are not added. External drives must be connected when scanning.
- Preview seeds are session-only; reopening projects uses the existing preview-generation path. PSD/TIFF retain their existing raster handling.
- Existing originals are preserved; this change does not claim AI enhancement or invent detail in exports.
- External Photoshop/Canva actions were not tested against those applications in this pass.
- Do not describe the eight original combinations as all Canva combinations or the bundled open fonts as Canva premium fonts.
