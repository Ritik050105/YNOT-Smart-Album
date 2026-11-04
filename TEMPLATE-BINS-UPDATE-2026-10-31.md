# Template, bins and font update — 31 October 2026

## Implemented
- Shared image-template source/category/favorites filters between browsing and overview arrows. No matching candidates means no cycling.
- With no matching design, gallery insertions keep separate photo elements; existing frame geometry is retained and new images stack. No flattening.
- Explicit right-hand-only first page checkbox in project presets; also honored by first gallery insertion.
- Inspector and image-gallery toggles in Designer header.
- Drop gallery selections onto bin buttons; additions are one Undo step and do not remove other bin memberships.
- Auto Build selected bins: numerical order option and template type, category, subcategory controls for each selected bin. Image and mixed designs use the chosen layouts; font choices add saved quote compositions to an image layout. Photos belonging to several selected bins are included once, in the first applicable bin. No-match choices show an error before modifying the project.
- Blending-effect labels open their respective advanced controls. Switching text layers clears stale editors; preview remains cancellable. Effect checkbox changes are disabled while an advanced preview is open to prevent conflicting Undo history.
- Searchable Google Fonts catalog: 1,959 open-source families from the official metadata snapshot. The 14 previously bundled families remain fully offline. Other families download their available styles on first use and cache locally for subsequent offline use. This cache is per app profile, not an all-font offline installer or transferable font bundle.

## Verification
- TypeScript noEmit and renderer/Electron production build passed.
- scripts/test-bin-template-update.cjs: stacked insertion, RHS first spread, disabled cycling, bin assignment Undo/Redo, effect switching and clearing, per-bin mixed category build, real Google font download and offline cache reload passed.
- scripts/test-gallery-font-update.cjs and scripts/test-template-workflows.cjs passed.

## Limits and remaining verification
- Canva's complete editable font-combination catalog has not been supplied or imported. Eight existing original editable combinations remain; they are not represented as the complete Canva collection.
- No installer was generated, installed or copied to USB for this update. Tests used the Electron renderer harness on Windows; Mac interaction testing remains outstanding.
- Not every Google font was downloaded or visually checked. First use of an uncached font requires internet. Catalog source: https://fonts.google.com/metadata/fonts .
