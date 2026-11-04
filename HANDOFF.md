# YNOT Album Studio — session handoff for further corrections

## What this app is
Electron + React + TypeScript + Vite + Zustand + Konva/react-konva desktop app
("YNOT Album Studio") that clones **Pixellu SmartAlbums** (the reference app), with
our own color palette instead of theirs. Repo root: `E:\Smart album application`
(branch `master`). This work happened in a **git worktree**:
`E:\Smart album application\.claude\worktrees\project-analysis-ce4b4c`
(branch `claude/project-analysis-ce4b4c`). Worktrees don't share `node_modules` —
run `npm install` in the worktree if missing.

**The reference app is installed locally** at `E:\SmartAlbums\SmartAlbums.exe` —
use it directly (trial mode) to verify any UI/behavior question instead of
guessing. This was far more reliable this session than the user's reference
video, which was partially misread earlier (see "Mistakes already made and
corrected" below).

## Build / release workflow (standing instructions — do every time, unmodified)
1. `npx tsc -b --noEmit` — fix all errors before building. Never skip this.
2. `npm run build` (renderer + electron main) then `npm run dist` (electron-builder
   → `release/YNOT Album Studio-Setup-0.1.0.exe` + portable exe, inside the worktree).
3. Copy the worktree's `release/` output into the **main checkout's**
   `E:\Smart album application\release` folder (that's the one true release
   location the user watches) — but first move whatever's currently there into a
   new `previous-build-<YYYY-MM-DD-HHMM>/` subfolder. Never overwrite silently.
   `package.json` version has stayed `0.1.0` the whole project, so filenames
   always collide — that's expected, not a bug to "fix" by bumping the version.
4. Launch the packaged `win-unpacked\YNOT Album Studio.exe` and confirm it opens
   with no crash before calling anything "shipped."
5. Do this after every commit, without being asked.

## Architecture as of the last commit (5335fd6)
Two-screen editor, matching the live reference app exactly (verified by
side-by-side testing against the real SmartAlbums install):

- **`SpreadsPanel.tsx`** — the main/default view. A horizontal row of real,
  proportioned spread cards (cover card or "drop images to create a cover" card,
  then each interior spread, then a trailing "drop images to create a new
  spread" card). No ruler, no tool rail here — matches the reference's own
  overview exactly. Single click selects a spread (context menu, highlight);
  double-click opens **DesignerViewScreen**.
- **`DesignerViewScreen.tsx`** — the focused single-spread editor, reached only
  by double-clicking a spread (or Spread ▸ Edit in Designer View). Has its own
  back button, ruler, 5-icon tool rail (Select/Frame/Text/Pan/Zoom), zoomed Konva
  canvas, and a right sidebar (Album Info/Inspector/Template Library) that's
  collapsed by default and reveals itself once you select a placeholder/text box.
  Escape (with nothing else selected) or the back button returns to the overview.
- **`App.tsx`** routes between: resume-session prompt → loading overlay → Home →
  Gallery/Slideshow → `designerViewSpreadId ? DesignerViewScreen : main shell`.
  The main shell = MenuBar + TopBar + collapsible left (ImportPanel) / right
  (AlbumInfoPanel) panels around `SpreadsPanel`, plus the collapsible bottom
  photo dock (`PhotoBin`).
- **`AutoBuildModal.tsx`** — Auto Build is *never* instant; it always opens this
  configuration dialog first (spread-count slider, images-per-spread stat,
  Smart Grouping vs. Specify range, Blocks of time/B&W/Metadata checkboxes,
  Template reuse Low/Medium/High), matching the reference pixel-for-pixel in
  structure. Confirming calls `runAutoBuildFromGroups` (new store action),
  which **appends** new spreads built from the selected/target photos — it does
  **not** replace the whole album. Target photos = `selectedPhotoIds` if 2+ are
  selected in the dock, else every unplaced photo (`autoBuildTargetPhotoIds` in
  `src/engine/autoBuildTarget.ts`). The old `runAutoBuild()` (full-album
  rebuild) still exists for internal callers but user-facing Auto Build buttons
  no longer call it directly.
- **Importing photos never auto-creates spreads anymore** — matches the
  reference exactly (confirmed live: importing only fills the pool; "Auto
  Build" stays a separate, deliberate step, highlighted yellow/primary once
  there are unplaced photos).
- **New albums start with 0 spreads** (not a pre-seeded blank one) — also
  confirmed against the live reference app.
- **Import Images / Import Favorites / Auto Build buttons** live in the bottom
  photo dock's own toolbar (`PhotoBin.tsx`), not just the collapsible left
  panel — shared logic in `src/engine/useImportPhotos.ts`.
- **"Missing Color Profile" dialog** (`MissingColorProfileDialog.tsx`) — fires
  after import if a photo lacks an embedded ICC profile (byte-sniffed in
  `src/engine/colorProfile.ts`: JPEG's `ICC_PROFILE` APP2 marker, PNG's `iCCP`
  chunk). Has a persisted "don't show again". Verified near-pixel-identical
  wording/layout to the reference app's own dialog.
- **`TimelinePanel.tsx` / `TemplateSuggestionsStrip.tsx` were deleted this
  session** — they were built for an abandoned single-canvas layout and don't
  exist in the reference app's real UI. Don't resurrect them without re-checking
  the live reference app first.

## Electron-specific fix worth knowing about
`electron/main.ts`'s `createNewProjectWindow()` was creating its `BrowserWindow`
**without** `show: false` + a `ready-to-show` listener (unlike the main window,
which does this correctly) — it showed the window immediately, before the page
had painted anything, and in packaged builds it would sometimes never repaint,
leaving a permanently blank "New Project" window. Fixed to match the main
window's pattern, and it also now focuses/reuses an existing New Project window
instead of stacking a second one. **Confirmed fixed** by running the actual
packaged exe end-to-end (wizard opens → completes → native Save As → lands in
the overview). If anything in the New Project flow still misbehaves, this is
the file to check first.

## Mistakes already made and corrected (don't repeat)
1. Early in the session, video frames of the reference app were misread as
   "everything lives in one zoomed canvas with a ruler + Rearrange
   Timeline/Match Timeline Order strips always visible." This was **wrong** —
   confirmed by live-testing the actual installed reference app. The real
   reference app has the two-screen split described above; the "Rearrange
   Timeline"/"Match Timeline Order" panel from an earlier guess was never found
   in the live app and was removed. **Always verify UI structure against the
   live SmartAlbums install, not just video stills, before architecting
   around it.**
2. A "merge everything into one canvas" refactor (commit 13776ea) was done
   based on that misreading, then reverted (commit 6ae5039) once live testing
   showed it was wrong. The revert kept the genuinely good pieces made along
   the way (dock import buttons, Missing Color Profile dialog, zero-spreads
   start, Designer View's min-height layout fix).

## Known open items / things to double-check next
- **The Auto Build dialog's grouping math is a best-effort approximation**, not
  a reverse-engineered copy of SmartAlbums' real algorithm (which is closed
  source). "Blocks of time" is real (reuses the existing time-gap grouping);
  "Black & White" and "Metadata" checkboxes are present in the UI for visual
  fidelity but aren't wired to real logic yet — nothing reads EXIF
  camera/lens metadata or photo color content today. If asked to make these
  real, `PhotoAsset` (src/types) doesn't currently store camera metadata, so
  that would need extending the import pipeline (`src/engine/importPhotos.ts`,
  already uses `exifr`).
- **"Template reuse" Low/Medium/High** only has one real behavioral hook so far
  (`allowTemplateRepeats` — High skips the "don't repeat the last template"
  logic in `buildSpreadsFromGroups`; Low/Medium are currently identical). Worth
  revisiting if the reference app's actual effect becomes clearer.
- The reference app's **cover creation flow** was approximated (drop photos on
  the "create a cover" card → `addCoverSpread()` + place the first 2 photos in
  order) rather than reverse-engineered from the live app in detail — worth a
  closer live comparison if cover behavior gets flagged.
- `.spreads-panel__row` currently wraps via CSS flex-wrap; the live reference
  app's behavior with **many** spreads (10+) was not specifically tested —
  only verified with 1–2 spreads. Worth checking if a long album looks right
  (wrap vs. horizontal scroll).
- `AlbumInfoPanel`/`Inspector`/`TemplateLibraryPanel` panel split was carried
  over from before this session's work and not independently re-verified
  against the live app's exact field set this session (only `AlbumInfoPanel`
  was explicitly compared and matched well).
- Standing user preference, unresolved: ponytail mode (lazy-senior-dev style)
  was toggled on/off several times earlier in the session; check current state
  before assuming a style.

## Key files touched this session (for a quick diff orientation)
```
src/App.tsx                              — route restored to two-screen split
src/components/SpreadsPanel.tsx          — NEW (restored + redesigned, real-size card row)
src/components/DesignerViewScreen.tsx    — restored to standalone focused editor
src/components/AutoBuildModal.tsx        — NEW
src/components/MissingColorProfileDialog.tsx — NEW
src/components/ImportPanel.tsx           — Auto Build button now opens the modal
src/components/PhotoBin.tsx              — dock toolbar: Import Images/Favorites/Auto Build
src/components/KeyboardShortcuts.tsx     — Escape exits Designer View again
src/components/MenuBar.tsx               — "Edit in Designer View" menu item restored
src/engine/autoLayout.ts                 — buildSpreadsFromGroups, splitPhotosIntoGroups
src/engine/autoBuildTarget.ts            — NEW (autoBuildTargetPhotoIds)
src/engine/useImportPhotos.ts            — shared import logic, no auto-build-on-import
src/engine/colorProfile.ts               — NEW (ICC profile byte-sniffing)
src/state/projectStore.ts                — designerViewSpreadId/enter/exitDesignerView
                                            restored; runAutoBuildFromGroups added;
                                            rightPanelOpen reveal-on-select pattern;
                                            new albums start with 0 spreads
electron/main.ts                         — New Project window show:false fix
src/styles/app.css                       — spreads-panel card-row styles, dead CSS removed
(deleted) src/components/TimelinePanel.tsx
(deleted) src/components/TemplateSuggestionsStrip.tsx
```
Relevant commits, oldest first: `13776ea` (the wrong merge) → `32036b3` →
`4ad7c04` → `b78dc6c` → `6193be3` → `688c385` → `6ae5039` (the revert/fix) →
`5335fd6` (New Project window fix, HEAD).

## User's standing feedback (apply without being asked)
- Always `npx tsc -b --noEmit` and fix errors before building — never skip.
- Always build + package + move to the shared `release/` folder after every
  commit, backing up what's there first — don't wait to be asked.
- User wants the app to be an **exact functional/UI replica of the reference
  app first**; only after that is solid should new/extra features be added.
- Verify claims against the **live reference app install**, not assumptions or
  a single pass over a video.
