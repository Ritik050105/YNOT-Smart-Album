# Editor review fixes — 30 October 2026

Source changes and production build; not a newly installed release or USB delivery.

| Request | Implementation |
|---|---|
| 1 Import performance | Native Sharp makes 1600px WebP previews, reused by thumbnails; two concurrent imports. Original source and dimensions remain for export. PSD composite import still needs its original decoding step. |
| 2 Normal-view text/shapes | Pointer move and resize, grouped text preserved, inspector opens for text/shapes, Escape cancels and Undo restores. |
| 3 Off-page artwork | Designer artwork group clips to page; controls remain outside with dashed selection outlines. Overview artwork is clipped by its canvas. |
| 4 Empty spreads | An edit that removes the last content removes its spread in the same Undo step. Deliberately added blank spreads are retained. |
| 5 Smart Grid | Removed inspector suggestions UI and matching computation. |
| 6 Crop preview | Dim uncropped image surrounds the active crop frame. |
| 7 In-frame rotation | Shared canvas/export and Konva paths scale the rotated image to cover corners. |
| 8 Gallery | Marquee selection on empty gallery space, Delete/Backspace, context-menu Delete with shortcut. Existing individual trash controls retained. |
| 9 Normal-view swap | Dragging a photo onto another within its spread uses swapPlacements. |
| 10 Slider reset | Shared SliderField double-click reset, image adjustments supply their exact defaults. |
| 11 Original gap | Original-gap edge targets participate in the existing threshold snap; moving beyond threshold releases it. |
| 12 Categories | Smart design, Creative design, Random generation in both browser and Auto Build. |
| 13 Animation | Template geometry interpolates rather than crossfading; pointer edits bypass interpolation. |
| 14 Alignment guides | Text movement uses rotated visual bounds for existing snap/guideline calculation. |
| 15 Text angle | Inspector angle uses the fixed-center rotation helper. |
| 16 Strikethrough | Button, saved property, canvas/export rendering; bypasses unchanged PSD artwork cache. |
| 17 Advanced effects | Nonmodal side drawer with slide transition, live preview, Cancel/Escape and one-step Apply. |
| 18 Font templates | Overview group movement/resizing and selected-layer inspector editing; original grouping retained. Exact typography still requires original fonts. |
| 19 Bevel | New bevel starts with existing text color; soft-light compositing avoids replacing base fill. |
| 20 Filled shape icon | Filled rectangle/circle/triangle icons for fill-and-stroke tool. |
| 21 Focal Y | Focal edits provide enough zoom/crop room so movement is visible rather than silently clamped. |

## Checks actually run
- TypeScript no-emit and full renderer/main production build passed.
- test-import-preview.cjs: 24MP input bytes unchanged, original 6000×4000 dimensions retained, 1600×1067 compressed preview.
- test-review-fixes.cjs: overview text hit target and actual pointer movement/Undo; inspector removal; opacity double-click reset; rotated-photo corner alpha; emptied spread removal/Undo; effects drawer; gallery Delete/Undo; Focal Y crop room.
- test-shape-tools.cjs: shapes, dashed/dotted rendering, handles, fixed-center rotation, rotation Undo, Home at six resolutions.
- test-timeline-drop.cjs: divider positions, reorder, cross-spread move, gallery insertion, marker, Escape and Undo.
- Inspected effects drawer screenshot.

## Limits and follow-up verification
No installed-app upgrade, USB copy or macOS runtime test in this pass. Not every item has a separate pointer-level regression test: crop surround visual accuracy, animation smoothness under large real albums, gap feel, marquee interaction, grouped-font editing and off-page clipping need installed workflow QA. No original file is overwritten or automatically enhanced. Full-resolution exports remain limited by available original image quality. This is not a claim of performance testing on the client's hardware.
