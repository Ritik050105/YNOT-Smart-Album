# Album workflow verification — 22 October 2026

The installed SmartAlbums application was exercised with synthetic images. This is a record of verified behavior, not a claim of complete product parity. The existing YNOT color palette is retained.

## Verified in the packaged Windows application

- Open a recent, self-contained album; restore cover, text, custom frame geometry, patterns and interior spreads.
- Create a custom cover; draw, populate and resize a frame; add and edit multiline text; save and reopen.
- Cut the image timeline into additional spreads while retaining all photos.
- Move photos between groups, reorder images within a group, reorder whole spreads, insert an unplaced dock image into a group, and create a spread by dropping onto either new-spread target. Native Undo/Redo restores timeline moves.
- Use a continuous, independently scrolling timeline. Click a group divider to merge adjacent spreads; add a cut between images to split them again. All image thumbnails remain in one strip rather than separate clipped per-spread lists.
- Import different images with the same filename without discarding either. Reimport identical content without adding a duplicate. Import Favorites marks an existing photo as a favorite.
- Apply patterns to covers and interior spreads and persist them in the project.
- Import a 16-bit TIFF and a composite PSD. Recognize the PSD's ICC profile and warn about the untagged TIFF.
- Adjust warmth and brightness immediately in Designer; restore both using Undo.
- Cancel navigation when the album has unsaved changes.
- Export PDF and PDF/X-3 through native save dialogs, including the cover. The PDF/X test produced four 12-inch square pages, a PDF 1.3 header and an embedded ICC output intent.
- Start the final packaged application and reopen the saved test album.
- Export a 3600 x 3600 PSD cover and interior spread from the packaged app. Read the cover back and confirm the independent editable multiline text layer, ArialMT font, size and box geometry.

- Recover an unsaved timeline edit after a forced exit of the packaged test app; restore all 16 photos and six spreads including the cover, without overwriting the saved album. Save the recovered result as a separate file and verify the recovery copy is removed.
- Use Ctrl+C / Ctrl+V to copy an image between Designer frames; Undo restores the original. Ctrl+D deselects. Ctrl+I opens the native import picker in Designer View and cancellation leaves the album unchanged.

- Compare reference Left/Right spread navigation, Up/Down layout cycling, image-browser Ctrl+A, and the Save/Discard/Cancel close prompt directly with the installed SmartAlbums app.
- In YNOT, move between spreads with Left/Right, cycle a matching layout with Down, open the matching-template browser from the overview card, select all 16 browser images with Ctrl+A, then move browser focus with Right without changing the selected spread.
- Verify the overview template browser is a full-window dialog with visible header, filters and Apply/Cancel footer. Preview and apply a matching layout; Undo restores the prior layout.
- Cancel the native close prompt and keep the album open. Close again with Save; verify the synthetic project was written, the recovery copy removed, and the process exited.

- Compare SmartAlbums Auto Build with a twelve-image synthetic selection: default three spreads and 3–6 images per spread; Specify range retains three spreads; the build appends three spreads rather than replacing the original three.
- In the packaged YNOT app, build the twelve-image fixture into groups of 3, 3 and 6. Change the numeric spread count to four and back to three; page and image statistics update immediately.
- Append three new matched spreads and verify the saved file: original three spreads byte-for-byte structurally unchanged, all twelve new placements in timeline order. Apply the shared 3:2 filter, build again and verify every appended template against the physical album aspect ratio.

## Automated checks passed

- Larger mixed sets: 72, 240 and 1,200 images preserve every photo and feasible 3–6 bounds. Mixed-ratio template matching preserves all 72 photos at album aspects 0.75, 1.5 and 2, with timeline order both on and off.
- Missing timestamps no longer poison grouping costs or erase camera boundaries. Grouping stores only the preceding cost row and typed backtracking cuts, and skips unreachable states.
- Auto Build dialog regression: switching a 72-image recommendation to Specify range preserves 18 spreads and initializes the range from the current groups.
- Grouping now uses the enabled template counts and the same full-spread/single-page candidate filter as layout selection. Two/four-frame libraries can group 72 photos into 18 valid four-frame spreads; unsupported three-frame groups are avoided.
- Automatic recommendations search nearby feasible counts: two-frame-only libraries recommend 36 spreads for 72 photos; three/five-frame libraries can use four three-frame spreads for 12 photos. Explicit manual counts remain fixed, with a visible error and disabled Build when impossible. Direct Auto Build uses the same constraints. Impossible count combinations do not mutate the album.
- Backtracking cuts now store lengths in one byte instead of four; the 1,200-photo preservation/bounds checks still pass.

## Larger-set reference and responsive verification

- Imported 72 numbered synthetic JPEGs into SmartAlbums, covering portrait, landscape, square and panoramic shapes, color/B&W, two camera models and four time blocks. The reference recommended 18 spreads with 2–6 images; building appended 18 to the existing three and reported all 84 images used. The synthetic reference project was saved.
- Packaged YNOT opened the same 72 assets in a synthetic project, recommended and built 18 spreads, and saved 72 unique placements. Its groups were 3–6 images: exact group boundaries still differ from the reference.
- Final delivered release launched, reopened the saved 18-spread/72-photo project, selected all 72 photos, and retained 18 spreads when switching Auto Build to Specify range. The dialog was cancelled without adding another build.
- Native workspace resized from 1426×810 to 894×600. The photo toolbar wrapped; Auto Build statistics, settings and footer buttons remained visible; Designer View refitted the spread after opening the inspector, whose controls remained scrollable.
- Main and New Project windows now cap initial/minimum dimensions to the display work area; main minimum is 720×480 where available. Sidebars adapt in width; toolbars wrap; the dock is height-bounded and scrollable; short-window dialogs use compact spacing. No palette values changed.
- The native window was clamped to its enforced 720×480 minimum using Windows Size and border controls (the capture excludes part of the native frame). Home controls, editor, Auto Build's fixed footer and scroll access to its lower settings were exercised there. The restricted-library build saved 18 four-frame spreads with 72 unique placements.
- This test exposed dock thumbnails clipped by wrapped controls and a Designer toolbar leaving part of the spread below the visible area. Short-window toolbars now scroll horizontally, the canvas can fit the remaining height, and Auto Build statistics use compact spacing.
- Final packaged retest at the enforced 720×480 minimum: the entire Designer spread remains visible with the inspector open; horizontal scrolling reaches all Designer/dock controls; the compact Auto Build dialog displays all statistics, grouping/reuse settings and footer buttons without scrolling. The dialog was cancelled without changing the saved album.
- Window-sizing calculations pass for 720×480, smaller work areas, and simulated 3840×2160 work areas at 100%, 125%, 150%, 175%, 200%, 250% and 300% scaling. The user confirmed no 4K monitor is connected: physical 4K rendering and monitor transitions remain unverified.
- A repeat SmartAlbums comparison reconfirmed its 72-image recommendation of 18 spreads and 2–6 images, and the saved first groups 1–6, 7–8, 9–12. The reference then hung/crashed while changing Metadata; Windows reported about 68 MB free committed memory. No camera-weight adjustment or claim of identical default grouping was made from this incomplete repeat test. The user requested continuing with available checks.

## Other automated checks

- TypeScript renderer and Electron compilation; workflow, rendering, image import and atomic file-write scripts.
- Photo preservation, bounded grouping, timeline movement/cuts/merges, edits retained through layout changes, cover isolation, frame geometry and history.
- Preview/export scaling, crop/flip/border/text rendering, PSD raster layers, page ranges, split-page output, cover dimensions, patterns and export preflight warnings.
- TIFF/PSD decoding, embedded profile detection, invalid file rejection and extension handling.
- Pointer gesture routing, ordered selected-photo drops, insertion before/after, edge scrolling, Escape/focus cancellation, button isolation, outside drops and cover-drop routing.
- Editable PSD text descriptors round-trip with multiline content, alignment, font size, bold/italic styling, color and position. Raster layer previews still match the design. PSD export writes one spread before rendering the next and does no rendering when the directory picker is cancelled.
- Filename collision checks preserve distinct image content and deduplicate repeated content within one batch.
- PDF/X metadata, document IDs, trapping flag, trim boxes and ICC output intent. Multiplicative brightness and visible warmth.

- Recovery persistence validates snapshots, preserves the saved file, includes embedded photos and never-saved albums, ignores stale serialization after save/discard or project replacement, and retains corrupt recovery for a retry/manual recovery.
- Clipboard key routing separates image cut/copy/paste from shifted tone copy/paste and leaves text-entry fields alone. Multiselection deletion creates one history entry and one Undo restores every image.

- Overview navigation stops at album boundaries, keeps the cover first, does not dirty the project, and does not override Designer or browser key handling.
- Template cycling preserves photo/crop/tone data, uses matching photo counts and library filters, excludes covers, and restores the prior layout in one Undo.
- Browser selection follows visible chronological/filter order, keeps arrow/range selection local to the browser, focuses/scrolls the next image and leaves text-entry controls alone.
- Save-on-close cancellation/failure leaves edits open. A save of an older snapshot cannot close the app or clear recovery for edits made during that save.
- Floating dialogs mount at the document root to escape panel containment/clipping; the standalone New Project wizard stays inline.

- Minimum-crop template ranking uses album aspect, margin and gap. With timeline order disabled, assignment matches brute-force optimal solutions for small mixed-ratio groups. With timeline order enabled, both preview and application use physical left-to-right frame order rather than template storage order.
- The reserved cover template is excluded from interior Auto Build and interior template browsing.
- Strict project-library and frame filters cannot silently fall back to unrelated layouts; a rejected build leaves project, history and dirty state unchanged. Saved templates participate in matching.
- Manual spread-count changes retain important time/metadata boundaries where possible, honor feasible min/max limits, preserve chronological order, and never drop images. Automated checks cover 1–80 images across multiple ranges.
- Single-page start/end settings produce right/left pages; Medium reuse may repeat a significantly better match instead of forcing a worse crop. Low reuse remains distributed across the candidate pool.

## Deferred or unverified

- Recovery updates after one second of inactivity; an abrupt exit before a snapshot finishes can lose the latest edit. Recovery errors are reported; normal Save remains necessary. OS power-loss durability and very large albums were not stress-tested.
- IDML: deferred at the user's request because the reference trial disables it.
- Hosted galleries and client/cloud proofing: deferred at the user's request.
- No independent PDF/X preflight or print-lab acceptance check was available. Output is sRGB; arbitrary CMYK/Adobe RGB output conversion is not implemented.
- PSD output now contains editable text records plus cached layer previews. Editing in Photoshop itself has not been tested; fonts must be installed there and may be substituted. PSD import requires a saved composite.
- Auto Build now uses crop-ranked templates and bounded time/metadata grouping, calibrated against the twelve-image reference workflow. This does not reproduce SmartAlbums' proprietary template assets, complete lab catalogue or guarantee identical grouping on every photo collection.
- Browser workflow re-testing was blocked by the browser tool's URL policy. Native desktop testing was used.

## Expanded template gallery (22 October 2026)

- Reviewed public spread previews from [Studio PK](https://www.studiopk.in/pre-wedding-photo-album-designs-vol-01/), [Opus Album](https://opusalbum.com/templates) and [Smart Photo Selection](https://smartphotoselection.com/). Studio PK mixes hero images and supporting clusters; Opus shows paired page grids; Smart Photo Selection shows editorial portraits, detail strips and supporting sequences.
- Added original, editable rectangular photo-frame compositions inspired by those broad patterns: Editorial, Paired Pages, Storyboard and Salon Mosaic. Third-party photographs, layered PSDs, decorative masks, backgrounds and lettering are not included. This is a frame-layout expansion, not an import of those sites' PSD packs.
- Library contains 300 interior templates for every photo count from 1 through 30 (9,000 total), plus the existing cover. This adds 7,257 layouts and preserves all 1,744 original template IDs and frame coordinates. Existing palette values are unchanged.
- Deterministic recipe IDs, geometry deduplication, positive finite dimensions and normalized bounds protect saved albums. All new layouts pass pairwise non-overlap checks; balanced paired-page layouts are present for every count above one.
- Gallery displays 60 layouts per page with photo-count and family filters, aspect-aware live previews and double-click/apply. Template-from-photo importing now narrows its base-layout dropdown by photo count instead of mounting 9,001 options.
- `test-template-library.mjs` checks all counts, unique IDs, original-geometry SHA-256, no new geometry duplicates/overlaps, template lookup and mixed-photo matching at spread aspects 0.75, 1.5 and 3. `test-template-gallery.mjs` reaches all 300 thirty-photo layouts across five pages, checks the 60-item render bound and applies the final layout. Auto Build, dialog, workflow and TypeScript checks pass.
- Native packaged inspection confirmed 9,001 library entries, 300 matches for six and thirty photos, live previews and navigation to page two. Existing 72-photo synthetic album opens with all 72 placements retained. Final release smoke verification is recorded below.
- Final delivered release opened the 72-photo album, displayed all 300 matching six-photo layouts, applied a new Salon Mosaic by double-click with all 72 photos retained, and restored the original layout with one Undo. The restored synthetic album was saved.
- IDML remains pending; physical 4K verification remains unavailable without a connected 4K display.

## Release

### Inline matching-template browser follow-up

- Directly exercised SmartAlbums' spread-grid button: the reference replaces its photo browser with an inline two-row layout browser above the overview/timeline, labelled Rearrange Timeline and Match Timeline Order. Hovering shows a candidate on the actual spread/timeline; clicking commits and closes the browser. The reference also shows favorite hearts on its layout thumbnails.
- Replaced the separate Template Gallery dialog in overview and Inspector with a shared inline matching panel. Added a discoverable Designer View entry. Both rows support horizontal scrolling/arrows, frame filters, persisted favorite hearts, Favorites-only browsing, keyboard row/layout navigation, Enter to apply, and Escape to cancel. The existing photo-dock visibility preference is preserved while browsing temporarily hides the dock.
- Preview spread data lives outside the saved project, history and recovery snapshots. Rearrange Timeline uses optimal photo/frame assignment and carries each placement's crop, tone and flip edits; Match Timeline Order retains the sequence. Clicking applies one undoable edit, returns the photo dock, and closes the browser. Closing, changing spread/project, Undo/Redo or an edit clears transient previews.
- Removed the obsolete pop-up gallery component/tests. Layout rows render only the visible range plus a small buffer instead of mounting all 600 candidates. Existing 9,000 interior layouts remain available by matching photo count; no template IDs, geometry or palette values were replaced.
- Fixed invalid/missing template IDs creating empty Undo entries. Also fixed Enter routing when focus remains on the Browse trigger, and protected keyboard activation of favorite/close buttons from committing a layout.
- New `test-matching-templates.mjs` verifies preview/cancel without dirty/history changes, both assignment modes, repeated uses of one photo retaining distinct edits, favorites persistence, strict library filtering, invalid-template safety and one-step Undo/Redo. `test-matching-layout.cjs` verifies the actual component in Electron at eight viewport/scaling combinations from 720×480 to simulated 4K, including dock/workspace bounds, no dialog, bounded rendering, scroll/favorites, and keyboard preview/cancel/apply. Screenshots/results are in `%TEMP%\ynot-matching-layout`.
- Regression checks passed for Auto Build/dialog, all 300 templates at counts 1–30, dense 20–30 layouts, raster/PDF/PSD output, workflow/timeline, keyboard, photo browser, pointer gestures, atomic file writes, save-on-close, recovery, modal behavior and TypeScript. This is evidence for the tested workflows; it does not establish error-free software or complete proprietary SmartAlbums parity. The existing grouping/physical-4K/IDML limitations remain listed above.

### Dense layout and responsive follow-up

- Shared `resolveTemplateFrames` now applies spread margins and gaps identically in gallery/Inspector previews, crop matching, editor and export. Extra gap is capped at half the smallest cell dimension so every frame retains at least half its size. Template IDs and stored normalized coordinates remain unchanged; formerly collapsed frames now remain visible.
- Gallery and hover previews preserve focal points, zoom and horizontal/vertical flips. When browsing a higher photo count, additional project photos fill sample frames; applying still preserves the selected spread's existing images and leaves added frames empty.
- Gallery height adapts to the viewport; short windows scroll family tabs horizontally, narrow windows use smaller preview/grid columns, pagination stays visible, and changing pages resets the grid scroll position.
- Dense geometry/crop checks pass for all 300 layouts at each count 20–30, spread aspects 0.75/1.5/3, margins 0/24/60 and gaps 8/20/40: 89,100 template/appearance combinations. Checks cover finite positive frames, crop bounds at three focal/zoom settings, mirrored geometry, matching and photo preservation, CSS crop offsets and 4× export geometry. Worst best-match average crop loss across the tested extreme-ratio sets was 43.8%; this is crop-area loss, not a guarantee that faces stay inside crops.
- Actual raster tests confirm every photo renders in 20-, 25- and 30-photo spreads at aspects 1.5 and 3, at two output resolutions, with zoom/focal/flip edits retained. Existing rendering, PDF/PSD, Auto Build, dialog, workflow, template-library and TypeScript checks pass.
- Real Electron/Chromium component tests pass at 720×480, 1024×768, approximately 1366×768 (rounded to 1367 by Windows scaling), 1920×1080 and simulated 3840×2160 at 100%, 150%, 200% and 300% zoom. The test waits for the requested CSS viewport and checks horizontal overflow, dialog/footer bounds, 60 visible swatches, 30 preview images, pagination/apply and the unchanged bronze accent. This uses an offscreen component fixture, not a physical 4K monitor or a full native workflow.
- Evidence: `%TEMP%\ynot-gallery-layout\results.json`, `gallery-720x480-1x.png`, `gallery-3840x2160-2x.png`, and `%TEMP%\ynot-dense-30-export.png`. A 72-photo native fixture with 20/22/30-photo spreads is saved as `%TEMP%\ynot-reference-workflow\ynot-dense-20-22-30.ablm.json`.
- Native follow-up passed after the user unlocked Windows. The staged executable opened the 72-photo fixture, showed 300 matches for each selected 20/22/30-photo spread, and applied `ref-paired-20-51`, `ref-mosaic-22-55` and `ref-editorial-30-18`. Saving retained exactly 72 unique photo placements, plus the edited photo's focal point (0,1), zoom 2 and horizontal flip.
- Native gallery inspection passed at normal 1426×810 and intermediate 894×810 capture sizes, then at the enforced 720×480 minimum (708×474 captured content excludes native frame). At minimum size the preview, horizontally scrollable family tabs, fixed footer and Apply remain visible. Scrolling keeps pagination accessible, and Next shows page two at its first row; a thirty-photo layout applied successfully from that page. No new source changes were needed after this retest.
- IDML stays pending and physical 4K/monitor transitions remain unverified.

The tested follow-up build is also preserved in `E:\Smart album application\release\template-update-2026-10-22-170010`, with installer, portable executable and unpacked app.

- Staged installer SHA-256: `8D8334806498F7EE99548A3607B1069943F158CB1D5722C36EC7193301C6F86C`.
- Staged portable SHA-256: `FF766D85637BE1E1D0E9344CC21119AD1689202C553A72B3F3AA718DB0022EA8`.
- Staged application archive SHA-256: `ACEE1ABD8D2FA4C2C319213064D99BD831EC683DE58F57427FCF6B9B4AD3D874`.

The tested installer, portable executable and unpacked application replaced the main artifacts in `E:\Smart album application\release`. All three hashes matched the staged build. The previous release was preserved in `previous-build-2026-10-22-172820`.

The updated main-release executable launched successfully and reopened the saved dense album from Recents, displaying all three new layouts and 72/72 images used.

- Installer SHA-256: `8D8334806498F7EE99548A3607B1069943F158CB1D5722C36EC7193301C6F86C`.
- Portable SHA-256: `FF766D85637BE1E1D0E9344CC21119AD1689202C553A72B3F3AA718DB0022EA8`.
- Application archive SHA-256: `ACEE1ABD8D2FA4C2C319213064D99BD831EC683DE58F57427FCF6B9B4AD3D874`.

### Delivered inline-browser build

- Final packaged native test passed in overview and Designer View: inline rows, transient spread/timeline preview, click/Enter apply and close, Escape cancel, restored photo dock, and one Undo restoring geometry/photo order. The 72-photo fixture was saved with its original layouts after testing.
- At the enforced native 720×480 minimum (708×474 captured content), Designer's Browse button, both horizontal matching rows and canvas remained accessible; Escape restored the dock without leaving Designer. Physical 4K remains unverified; eight simulated viewport/scaling combinations passed.
- Replaced the main installer, portable executable and unpacked application after preserving previous artifacts in `E:\Smart album application\release\previous-build-2026-10-22-181407`. Source and destination SHA-256 values matched. Main-release startup, reopening all three 20/22/30-photo spreads with 72/72 images used, and opening the inline 300-match browser passed.
- Current installer SHA-256: `0B731280FD72876088F2B7AC280843321BFBD3D7E947F7A5376808A75734D9E6`.
- Current portable SHA-256: `C25193EC838DB0680EA14CAC90E77992E6C43F8FD46CC54D27FB0478DF61A28E`.
- Current application archive SHA-256: `099DE56EFB7C6FBBC2FCC1E29CC43F3C0D088F06B656FF9158C8E0D0B134EFF0`.
- This build supersedes the historical pop-up/pagination behavior and release hashes above. Complete SmartAlbums parity is not verified: proprietary templates, exact default Auto Build grouping, physical 4K and the other deferred items remain open. IDML remains pending.

### Keyboard and favorite-selection follow-up

- Fixed Enter applying a previously focused thumbnail after arrow keys changed the live preview. Thumbnail Enter now follows the active preview; favorite/close controls retain their own keyboard activation.
- Changing favorites clears stale preview/index state before the reordered candidate list is used. Preview changes remain outside album history and saved data.
- Component checks pass at eight viewport/scaling combinations, including focused-thumbnail arrow/Enter selection and favorite-reset regression. Store matching, Auto Build grouping/assignment, Auto Build dialog and global keyboard checks pass; production TypeScript/build and installer/portable packaging passed.
- Main artifacts updated with matching source/destination hashes; prior build preserved in `previous-build-2026-10-22-182251`.
- Installer SHA-256: `B96A20912A125A091F8F341285A5C018559098555BD9C4D7BEC6655528516A60`.
- Portable SHA-256: `91C35E9B7465908F4CB35AB8EE4812C81F7EF26F3C849ECA4E399932E608E2F8`.
- Application archive SHA-256: `03B43055ED43E135BC2D277E68D06DD62A4DE3E7117A8CE022EF316B62DF8AAC`.
- Final main-release native smoke passed: reopened the 72-photo dense album, entered Designer, opened the two-row 300-match inline panel and cancelled with Escape, restoring the photo dock without an album edit.
- SmartAlbums eventually loaded the saved synthetic reference after delayed startup; selecting all dock images and clicking Auto Build did not expose its dialog during this check. No grouping weights were changed from that inconclusive result. Exact default grouping and physical 4K remain unverified; IDML stays pending.

### Auto Build criteria and capture-date follow-up

- Direct reference comparison used exactly 72 unused mixed synthetic photos in My New Project (two existing spreads, six placed images). Default Smart Grouping: 18 spreads, 2–6 images. Disabling Metadata retained 2–6; time-only gave 1–12; Metadata-only gave 3–6; time plus Metadata gave 1–11; restoring all three returned 2–6. All three criteria off disabled Auto Build. Spread count stayed 18 throughout.
- Clicking Auto Build with all three restored closed/crashed the reference process before a usable result could be captured. No exact group-boundary calibration was inferred from this incomplete build.
- Matched the verified all-criteria-off behavior in YNOT. The button disables and the handler rejects a stale click; Specify range still works independently of the smart criteria.
- Fixed valid capture dates failing to sort consistently when mixed with invalid/missing timestamps. Dialog, initial moments and fixed-count grouping now share stable chronological ordering, with unknown timestamps last and original order retained for ties/unknowns. Input photos are not mutated.
- Auto Build dialog/engine and workflow/timeline regressions pass, including larger 72/240/1,200-photo preservation checks, strict libraries, supported template counts, mixed-date order, no-criteria guard and switching to Specify range. Palette is unchanged; IDML stays pending. Default proprietary grouping remains unverified.
- Delivered installer/portable/unpacked build after successful production compilation/package. Previous artifacts are preserved in `previous-build-2026-10-22-183229`; source/destination SHA-256 values match.
- Current installer SHA-256: `7378FEA1FBE1DB28CD23BF482287140665BDA834BCC82B15C52F39444167D8E1`.
- Current portable SHA-256: `6F7645CB0A5A13E7D10E29881991F3AE22D8E4A622EA4E19724C49CF7A24690C`.
- Current app.asar SHA-256: `20B83ED813B56033227011D6E28786F982FB93C39BB454847B294519142D9199`.
- Native delivered-build control verification used Windows accessibility because screenshot capture returned black after the reference crash. Opened the saved 18-spread/72-photo fixture, selected all 72, disabled all smart criteria and confirmed Build disabled. Specify range enabled Build, retained 18 groups with 3–6 images, and appended 18 spreads (36 total, 72/72 photos used). One Undo restored 18 spreads; the restored synthetic fixture was saved. This confirms control/build behavior, not a fresh visual screenshot check.

### Shared Auto Build recommendation and physical timeline order

- Continued reference testing with YNOT closed to free memory. The recovered My New Project contained three spreads and 12/78 used photos, consistent with only the first six-photo spread of the earlier 72-photo attempt surviving. This is not a complete 18-spread result. Repeated new-project Next/Enter requests timed out; SmartAlbums and the native testing service then exited/restarted. No new grouping weights were inferred.
- Unified the spread-count recommendation used by the direct engine and the dialog. The direct path previously used every B&W/camera moment to determine the count while the dialog based its recommendation on time moments and roughly four photos per spread. Both now use the dialog's already reference-checked recommendation; the larger mixed fixture recommends 18 in both paths, with matching group boundaries at the same settings.
- Fixed Auto Build timeline ordering with Match Timeline Order off. Placements now follow physical left-to-right frame order in both modes, matching the shared template browser. Optimal photo/frame assignment remains intact; template storage order and repeated photo IDs cannot scramble timeline frame order.
- A stale selected image ID now rejects the entire build with a recoverable message instead of silently dropping that image and producing a different layout. The rejected build leaves project, history and dirty state unchanged.
- Passed Auto Build engine/dialog, workflow/timeline, matching store/component, keyboard, photo browser, pointer gestures, save/close, atomic writes, recovery, modal and sizing checks. The template library, 89,100 dense geometry combinations, TIFF/PSD import, raster crop/flip/text, dense 20/25/30 render, PDF/PDF-X, PSD layer/text and project save/reopen checks passed. Explicit TypeScript no-emit and production renderer/Electron/package builds passed.
- Updated the main installer/portable/unpacked artifacts; source/destination hashes matched. Previous build preserved in `previous-build-2026-10-22-185637`.
- Current installer SHA-256: `9EE1BF72A8AC05DDDE95B63CB21CB5CE8682FFC2889177DDDAAEE162D495B1D2`.
- Current portable SHA-256: `7D0032C85D5FC984613E1D7F788E43D3948AAE91563674A1AFC54244F43E9747`.
- Current app.asar SHA-256: `5D58F738CA94CA162C9066286AC2E77BC8B1B5816C71D54C62B56ACCDE0BBB1A`.
- Final main-release startup confirmed through its accessible Home controls. A fresh native end-to-end run could not proceed: capture failed with `SetIsBorderRequired failed: Desktop composition is disabled (0x80263001)` and accessibility click failed with `coordinate input geometry is unavailable`. No system graphics/security settings were changed. Exact SmartAlbums grouping and full native workflow parity remain unverified. Palette remains unchanged; IDML remains pending.

### Post-restart reference grouping comparison

- Desktop capture recovered after the user's restart. A second Windows restart occurred after the fresh reference project was saved (project timestamp 19:20:04, OS boot 19:20:46); testing resumed from that file.
- Created a clean custom 20×10-inch reference album, 300 DPI, full-spread start/end, all templates and 8-point gap. Imported nine numbered mixed photos (six color, three B&W, one camera, minute-spaced capture dates). Reference default: three spreads with exact groups 1–3, 4–6, 7–9. One Undo removed the build. Changing the count to four produced exact groups 1–3, 4–6, 7–8, 9 (range 1–3). Saved the synthetic reference project at `%TEMP%\ynot-reference-workflow\reference-grouping-nine.saproj`.
- YNOT previously regrouped the four-spread case as 2/2/2/3. Count changes now retain a soft preference for the original recommendation's cuts, while still respecting range/template constraints. Equal-cost manual splits prefer keeping the larger earlier group. The default count's existing grouping weights and tie behavior remain unchanged; range-only builds do not add smart-cut preferences. Reference-backed engine and dialog regressions assert the exact nine-photo boundaries at counts three and four.
- Added the remaining 63 photos to the clean reference project and verified its default recommendation of 18 spreads, 2–6 images. The build reached two spreads/eight placed photos and showed Adding spreads; available commit then became too low to start a PowerShell/CoreCLR process. Capture returned black and the reference process exited before a complete result could be verified. Full 72-photo boundary matching remains open; the observed first groups were 1–6 and 7–8.
- Passed Auto Build, dialog and workflow/timeline regressions, including 72/240/1,200-photo preservation/bounds, strict templates, unsupported-count safety and atomic rejection of stale photos. Also passed matching, keyboard, photo browser, pointer gestures, save/close, atomic file writes, recovery, modal/sizing, all 9,001 templates, 89,100 dense geometry cases, TIFF/PSD import, project save/reopen, dense raster crops/edits, PDF/PDF-X and layered PSD checks. Explicit no-emit typecheck and production packaging passed. These are automated workflow checks; full native workflow verification did not complete.
- Rebuilt YNOT launched and exposed its Home/Open controls through accessibility. Native project-open clicks subsequently failed with coordinate input geometry unavailable after the reference memory failure; screenshots were black. Closed only the idle worktree test process (Home/Open picker, no album edits) before replacing release artifacts.
- Main installer/portable/unpacked artifacts updated with identical source/destination hashes. Previous release preserved in `previous-build-2026-10-22-200128`.
- Installer SHA-256: `282992011948E019459D3EC83885846361063CCEF9B4AEC038D3A988F7E472BA`.
- Portable SHA-256: `09C79967517961970E5B1737DA1F020FD2E6304F84811D958B52D11D7201B96B`.
- Application archive SHA-256: `B2AA8822A773CF3CE3A94D37E8DF1AF53F8DC255477B1FC49AC275715B58A860`.
- Palette unchanged, IDML pending, physical 4K unverified. This fixes the observed manual-count case; it does not establish complete proprietary SmartAlbums grouping parity.
