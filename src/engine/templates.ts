import { TemplateDefinition, PlaceholderRect } from '@/types'
import { GAP, placeGridInRect, geometrySignature, resolveTemplateFrames } from './templateLayout'
import { GENERATED_TEMPLATES } from './templateGenerator'
import { expandTemplateLibrary } from './referenceTemplates'
import { EDITORIAL_TEMPLATES } from './editorialTemplates'
import { SIGNATURE_TEMPLATES } from './signatureTemplates'
import { ALBUM_TEMPLATES } from './albumTemplates'
import { EDGE_TEMPLATES } from './edgeTemplates'
import { BLEED_FEATURE_TEMPLATES, isBleedFeatureTemplate } from './bleedFeatureTemplates'
import { SHAPE_SET_TEMPLATES } from './shapeSetTemplates'

// A plain incrementing counter (not crypto.randomUUID()) — module evaluation order is the same
// on every app launch, so this produces the exact same placeholder ids every time. That stability
// matters: a saved .ablm project stores `placement.placeholderId` strings that have to keep
// matching this template's placeholder ids after the app restarts, or its photos would silently
// stop lining up with their slots.
let nextHandCraftedId = 0
function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  preferredOrientation: PlaceholderRect['preferredOrientation'] = 'any'
): PlaceholderRect {
  return { id: `hc${nextHandCraftedId++}`, x, y, width, height, preferredOrientation }
}

/** Full-bleed single photo spread. */
const full: TemplateDefinition = {
  id: 'full-bleed',
  name: 'Full Bleed',
  photoCount: 1,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 1, 1)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#3a4a6b',
}

/** Two photos, vertical split. */
const twoVertical: TemplateDefinition = {
  id: 'two-vertical',
  name: 'Two Up',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.5 - GAP / 2, 1), rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 1)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#45577c',
}

/** Two photos, one left page, one right page (classic spread layout). */
const leftRightPair: TemplateDefinition = {
  id: 'left-right-pair',
  name: 'Left / Right Pair',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.5 - GAP, 1), rect(0.5 + GAP, 0, 0.5 - GAP, 1)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4c6186',
}

/** Three photos: one large + two stacked. */
const threeAsymmetric: TemplateDefinition = {
  id: 'three-asymmetric',
  name: 'Feature + Two',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.62 - GAP / 2, 1, 'landscape'),
    rect(0.62 + GAP / 2, 0, 0.38 - GAP / 2, 0.5 - GAP / 2, 'any'),
    rect(0.62 + GAP / 2, 0.5 + GAP / 2, 0.38 - GAP / 2, 0.5 - GAP / 2, 'any'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#536a96',
}

/** Three photos, even thirds. */
const threeEven: TemplateDefinition = {
  id: 'three-even',
  name: 'Even Thirds',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, (1 - 2 * GAP) / 3, 1),
    rect((1 - 2 * GAP) / 3 + GAP, 0, (1 - 2 * GAP) / 3, 1),
    rect((2 * (1 - 2 * GAP)) / 3 + 2 * GAP, 0, (1 - 2 * GAP) / 3, 1),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#5c75a3',
}

/** Four photos, 2x2 grid. */
const fourGrid: TemplateDefinition = {
  id: 'four-grid',
  name: 'Quad Grid',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.5 - GAP / 2, 0.5 - GAP / 2),
    rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 0.5 - GAP / 2),
    rect(0, 0.5 + GAP / 2, 0.5 - GAP / 2, 0.5 - GAP / 2),
    rect(0.5 + GAP / 2, 0.5 + GAP / 2, 0.5 - GAP / 2, 0.5 - GAP / 2),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#64809f',
}

/** Four photos: filmstrip row. */
const fourFilmstrip: TemplateDefinition = {
  id: 'four-filmstrip',
  name: 'Filmstrip',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [0, 1, 2, 3].map((i) => rect(i * (0.25 + GAP / 4), 0, 0.25 - (GAP * 3) / 4, 1)),
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#6d8aad',
}

/** Five photos: feature strip + grid of four. */
const fiveFeatureGrid: TemplateDefinition = {
  id: 'five-feature-grid',
  name: 'Feature + Quad',
  photoCount: 5,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.55 - GAP / 2, 1, 'portrait'),
    rect(0.55 + GAP / 2, 0, 0.45 - GAP / 2, 0.5 - GAP / 2),
    rect(0.775 + GAP / 2, 0, 0.225 - GAP / 2, 0.5 - GAP / 2),
    rect(0.55 + GAP / 2, 0.5 + GAP / 2, 0.45 - GAP / 2, 0.5 - GAP / 2),
    rect(0.775 + GAP / 2, 0.5 + GAP / 2, 0.225 - GAP / 2, 0.5 - GAP / 2),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#76909f',
}

/** Six photos, 2x3 grid. */
const sixGrid: TemplateDefinition = {
  id: 'six-grid',
  name: 'Six Grid',
  photoCount: 6,
  pageSide: 'spread',
  placeholders: [0, 1, 2].flatMap((col) =>
    [0, 1].map((row) =>
      rect(
        col * ((1 - 2 * GAP) / 3 + GAP),
        row * (0.5 + GAP / 2),
        (1 - 2 * GAP) / 3,
        0.5 - GAP / 2
      )
    )
  ),
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#7e96a3',
}

/** Single photo, matted (inset border) rather than full-bleed. */
const framedSingle: TemplateDefinition = {
  id: 'framed-single',
  name: 'Framed Single',
  photoCount: 1,
  pageSide: 'spread',
  placeholders: [rect(0.08, 0.08, 0.84, 0.84)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#44557a',
}

/** Two photos, horizontal split (top/bottom instead of left/right). */
const twoHorizontal: TemplateDefinition = {
  id: 'two-horizontal',
  name: 'Two Stacked',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 1, 0.5 - GAP / 2), rect(0, 0.5 + GAP / 2, 1, 0.5 - GAP / 2)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#3f5276',
}

/** Two photos, big + small (70/30 vertical split). */
const twoBigSmall: TemplateDefinition = {
  id: 'two-big-small',
  name: 'Big + Small',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.68 - GAP / 2, 1, 'portrait'), rect(0.68 + GAP / 2, 0, 0.32 - GAP / 2, 1)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4b5f85',
}

/** Three photos: two stacked left, one large right (mirror of Feature + Two). */
const threeAsymmetricRight: TemplateDefinition = {
  id: 'three-asymmetric-right',
  name: 'Two + Feature',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.38 - GAP / 2, 0.5 - GAP / 2),
    rect(0, 0.5 + GAP / 2, 0.38 - GAP / 2, 0.5 - GAP / 2),
    rect(0.38 + GAP / 2, 0, 0.62 - GAP / 2, 1, 'landscape'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#51699b',
}

/** Three photos: one wide strip on top, two even below. */
const threeTopStrip: TemplateDefinition = {
  id: 'three-top-strip',
  name: 'Banner + Two',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 1, 0.5 - GAP / 2, 'landscape'),
    rect(0, 0.5 + GAP / 2, 0.5 - GAP / 2, 0.5 - GAP / 2),
    rect(0.5 + GAP / 2, 0.5 + GAP / 2, 0.5 - GAP / 2, 0.5 - GAP / 2),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#5d7aae',
}

/** Three photos: two even on top, one wide strip on bottom. */
const threeBottomStrip: TemplateDefinition = {
  id: 'three-bottom-strip',
  name: 'Two + Banner',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.5 - GAP / 2, 0.5 - GAP / 2),
    rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 0.5 - GAP / 2),
    rect(0, 0.5 + GAP / 2, 1, 0.5 - GAP / 2, 'landscape'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#6886bd',
}

/** Four photos: one wide top banner, three even underneath. */
const fourTopBanner: TemplateDefinition = {
  id: 'four-top-banner',
  name: 'Banner + Three',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 1, 0.48 - GAP / 2, 'landscape'),
    ...[0, 1, 2].map((i) => rect(i * ((1 - 2 * GAP) / 3 + GAP), 0.48 + GAP / 2, (1 - 2 * GAP) / 3, 0.52 - GAP / 2)),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#466089',
}

/** Four photos: three stacked left, one large feature right. */
const fourFeatureRight: TemplateDefinition = {
  id: 'four-feature-right',
  name: 'Three + Feature',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [
    ...[0, 1, 2].map((i) => rect(0, i * ((1 - 2 * GAP) / 3 + GAP), 0.38 - GAP / 2, (1 - 2 * GAP) / 3)),
    rect(0.38 + GAP / 2, 0, 0.62 - GAP / 2, 1, 'portrait'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#53709e',
}

/** Four photos, vertical filmstrip (stacked rows instead of side-by-side columns). */
const fourFilmstripVertical: TemplateDefinition = {
  id: 'four-filmstrip-vertical',
  name: 'Filmstrip Vertical',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [0, 1, 2, 3].map((i) => rect(0, i * (0.25 + GAP / 4), 1, 0.25 - (GAP * 3) / 4)),
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#60809f',
}

/** Four photos, offset quad — one larger cell, three smaller. */
const fourOffsetQuad: TemplateDefinition = {
  id: 'four-offset-quad',
  name: 'Offset Quad',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.62 - GAP / 2, 0.62 - GAP / 2, 'landscape'),
    rect(0.62 + GAP / 2, 0, 0.38 - GAP / 2, 0.62 - GAP / 2),
    rect(0, 0.62 + GAP / 2, 0.5 - GAP / 2, 0.38 - GAP / 2),
    rect(0.5 + GAP / 2, 0.62 + GAP / 2, 0.5 - GAP / 2, 0.38 - GAP / 2),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#577aa8',
}

/** Five photos, five even columns. */
const fiveEvenColumns: TemplateDefinition = {
  id: 'five-even-columns',
  name: 'Five Columns',
  photoCount: 5,
  pageSide: 'spread',
  placeholders: [0, 1, 2, 3, 4].map((i) => rect(i * ((1 - 4 * GAP) / 5 + GAP), 0, (1 - 4 * GAP) / 5, 1)),
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#6c88ab',
}

/** Five photos arranged as a center feature with four corner accents. */
const fiveCross: TemplateDefinition = {
  id: 'five-cross',
  name: 'Center + Corners',
  photoCount: 5,
  pageSide: 'spread',
  placeholders: [
    rect(0.27 + GAP / 2, 0.27 + GAP / 2, 0.46 - GAP, 0.46 - GAP, 'any'),
    rect(0, 0, 0.27 - GAP / 2, 0.27 - GAP / 2),
    rect(0.73 + GAP / 2, 0, 0.27 - GAP / 2, 0.27 - GAP / 2),
    rect(0, 0.73 + GAP / 2, 0.27 - GAP / 2, 0.27 - GAP / 2),
    rect(0.73 + GAP / 2, 0.73 + GAP / 2, 0.27 - GAP / 2, 0.27 - GAP / 2),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#7a93af',
}

/** Six photos: one large feature left, five-photo balanced grid right. */
const sixFeatureFive: TemplateDefinition = {
  id: 'six-feature-five',
  name: 'Feature + Five',
  photoCount: 6,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.42 - GAP / 2, 1, 'portrait'),
    ...placeGridInRect(0, 5, 0.42 + GAP / 2, 0, 0.58 - GAP / 2, 1),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4e6a9c',
}

/** Six photos, two columns x three rows (taller cells than the standard Six Grid). */
const sixGridTall: TemplateDefinition = {
  id: 'six-grid-tall',
  name: 'Six Grid (Tall)',
  photoCount: 6,
  pageSide: 'spread',
  placeholders: [0, 1].flatMap((col) =>
    [0, 1, 2].map((row) => rect(col * (0.5 + GAP / 2), row * ((1 - 2 * GAP) / 3 + GAP), 0.5 - GAP / 2, (1 - 2 * GAP) / 3))
  ),
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#88a0c3',
}

/** Six photos, even filmstrip row. */
const sixFilmstrip: TemplateDefinition = {
  id: 'six-filmstrip',
  name: 'Filmstrip Six',
  photoCount: 6,
  pageSide: 'spread',
  placeholders: [0, 1, 2, 3, 4, 5].map((i) => rect(i * ((1 - 5 * GAP) / 6 + GAP), 0, (1 - 5 * GAP) / 6, 1)),
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#96acc9',
}

// ---------------------------------------------------------------------------
// "Seamless" family — edge-to-edge rectangular frames with zero gap between them, modeled on
// the client's own site (ynot.website): full-bleed portrait photos with no border or spacing,
// never overlapping. Distinct from the rest of the hand-crafted set, which all use GAP spacing.
// ---------------------------------------------------------------------------

/** Full-bleed single portrait photo, edge-to-edge — the tall, borderless hero shot used
 *  throughout the client's site rather than a generic "any orientation" frame. */
const seamlessPortrait: TemplateDefinition = {
  id: 'seamless-portrait',
  name: 'Seamless Portrait',
  photoCount: 1,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 1, 1, 'portrait')],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#2d3b57',
}

/** Two full-bleed photos, side by side, touching with no gap between them. */
const seamlessTwoUp: TemplateDefinition = {
  id: 'seamless-two-up',
  name: 'Seamless Two Up',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.5, 1, 'portrait'), rect(0.5, 0, 0.5, 1, 'portrait')],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#334568',
}

/** Two full-bleed photos, stacked top/bottom with no gap. */
const seamlessStackTwo: TemplateDefinition = {
  id: 'seamless-stack-two',
  name: 'Seamless Stack',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 1, 0.5, 'landscape'), rect(0, 0.5, 1, 0.5, 'landscape')],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#3a4d73',
}

/** Three full-bleed columns, touching with no gap. */
const seamlessThreeUp: TemplateDefinition = {
  id: 'seamless-three-up',
  name: 'Seamless Three Up',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 1 / 3, 1, 'portrait'),
    rect(1 / 3, 0, 1 / 3, 1, 'portrait'),
    rect(2 / 3, 0, 1 / 3, 1, 'portrait'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#415680',
}

/** Four full-bleed photos, 2x2, no gap. */
const seamlessFourGrid: TemplateDefinition = {
  id: 'seamless-four-grid',
  name: 'Seamless Quad',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.5, 0.5), rect(0.5, 0, 0.5, 0.5), rect(0, 0.5, 0.5, 0.5), rect(0.5, 0.5, 0.5, 0.5)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4a618c',
}

/** Auto-generated balanced grid for photo counts beyond the hand-designed templates (7-30).
 *  Deterministic id/placeholder-ids so re-deriving the same template on every render (via
 *  findTemplate) keeps matching the photo placements already stored on the spread. */
export function generateJustifiedGrid(count: number): TemplateDefinition {
  return {
    id: `auto-justified-${count}`,
    name: 'Even Grid',
    photoCount: count,
    pageSide: 'spread',
    placeholders: placeGridInRect(0, count, 0, 0, 1, 1),
    isBuiltIn: true,
    createdAt: new Date(0).toISOString(),
    thumbnailColor: '#5c75a3',
  }
}

/** Auto-generated "feature photo + supporting grid" layout — a large hero cell plus the rest
 *  of the photos in a balanced grid alongside it, for counts beyond the hand-designed templates. */
export function generateHeroGrid(count: number): TemplateDefinition {
  if (count <= 1) return generateJustifiedGrid(count)
  const heroW = count <= 4 ? 0.62 : 0.5
  const hero: PlaceholderRect = {
    id: 'p0',
    x: GAP / 2,
    y: GAP / 2,
    width: heroW - GAP,
    height: 1 - GAP,
    preferredOrientation: 'portrait',
  }
  const rest = placeGridInRect(1, count - 1, heroW, 0, 1 - heroW, 1)
  return {
    id: `auto-hero-${count}`,
    name: 'Feature + Grid',
    photoCount: count,
    pageSide: 'spread',
    placeholders: [hero, ...rest],
    isBuiltIn: true,
    createdAt: new Date(0).toISOString(),
    thumbnailColor: '#536a96',
  }
}

/** A fully custom rows x cols uniform grid — the "custom layout" escape hatch beyond any
 *  suggested template, picked explicitly by rows/columns rather than photo count. */
export function generateCustomGrid(rows: number, cols: number): TemplateDefinition {
  const safeRows = Math.max(1, Math.min(10, Math.round(rows)))
  const safeCols = Math.max(1, Math.min(10, Math.round(cols)))
  return {
    id: `custom-grid-${safeRows}x${safeCols}`,
    name: `${safeRows} × ${safeCols} Custom Grid`,
    photoCount: safeRows * safeCols,
    pageSide: 'spread',
    placeholders: placeGridInRect(0, safeRows * safeCols, 0, 0, 1, 1),
    isBuiltIn: true,
    createdAt: new Date(0).toISOString(),
    thumbnailColor: '#8a6fd1',
  }
}

/** Album cover: back + front panels with a blank spine gap between them for a title text box —
 *  spines are almost always text/logo, not a photo, so it isn't modeled as a placeholder. */
const coverFrontSpineBack: TemplateDefinition = {
  id: 'cover-front-spine-back',
  name: 'Front + Spine + Back',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.46, 1, 'portrait'), rect(0.54, 0, 0.46, 1, 'portrait')],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#2b2b2e',
}

/** A caption text box with sane, overridable defaults. */
function caption(x: number, y: number, width: number, height: number, color = '#222222'): import('@/types').TextBox {
  return { id: `hc${nextHandCraftedId++}`, text: 'Your Title Here', x, y, width, height, fontFamily: 'Playfair Display', fontSize: 28, color, align: 'center', bold: false, italic: false, autoWidth: false }
}

/** One side full-bleed, the other side a photo + caption below it. */
const fullLeftCaption: TemplateDefinition = {
  id: 'gen-mixed-full-left-caption',
  name: 'Full Left + Caption',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0, 0, 0.5 - GAP / 2, 1, 'any'), rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 0.6, 'any')],
  textBoxes: [caption(0.5 + GAP / 2, 0.62, 0.5 - GAP / 2, 0.36)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#6b4f8a',
}
const fullRightCaption: TemplateDefinition = {
  id: 'gen-mixed-full-right-caption',
  name: 'Full Right + Caption',
  photoCount: 2,
  pageSide: 'spread',
  placeholders: [rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 1, 'any'), rect(0, 0, 0.5 - GAP / 2, 0.6, 'any')],
  textBoxes: [caption(0, 0.62, 0.5 - GAP / 2, 0.36)],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#704f8a',
}

/** One side full-bleed with the caption overlaid directly on the photo, the other side two stacked photos. */
const fullLeftOverlay: TemplateDefinition = {
  id: 'gen-mixed-full-left-overlay',
  name: 'Full Left Overlay + Two',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.5 - GAP / 2, 1, 'any'),
    rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 0.5 - GAP / 2, 'any'),
    rect(0.5 + GAP / 2, 0.5 + GAP / 2, 0.5 - GAP / 2, 0.5 - GAP / 2, 'any'),
  ],
  textBoxes: [caption(0.04, 0.78, 0.42, 0.14, '#ffffff')],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4f5a8a',
}
const fullRightOverlay: TemplateDefinition = {
  id: 'gen-mixed-full-right-overlay',
  name: 'Full Right Overlay + Two',
  photoCount: 3,
  pageSide: 'spread',
  placeholders: [
    rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 1, 'any'),
    rect(0, 0, 0.5 - GAP / 2, 0.5 - GAP / 2, 'any'),
    rect(0, 0.5 + GAP / 2, 0.5 - GAP / 2, 0.5 - GAP / 2, 'any'),
  ],
  textBoxes: [caption(0.54, 0.78, 0.42, 0.14, '#ffffff')],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4f6a8a',
}

/** Same full-bleed-plus-stack idea as above but without text, for the image template library. */
const fullLeftTriple: TemplateDefinition = {
  id: 'gen-full-left-triple',
  name: 'Full Left + Three',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [
    rect(0, 0, 0.5 - GAP / 2, 1, 'any'),
    rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, (1 - 2 * GAP) / 3, 'any'),
    rect(0.5 + GAP / 2, (1 - 2 * GAP) / 3 + GAP, 0.5 - GAP / 2, (1 - 2 * GAP) / 3, 'any'),
    rect(0.5 + GAP / 2, 2 * (1 - 2 * GAP) / 3 + 2 * GAP, 0.5 - GAP / 2, (1 - 2 * GAP) / 3, 'any'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4f8a6b',
}
const fullRightTriple: TemplateDefinition = {
  id: 'gen-full-right-triple',
  name: 'Full Right + Three',
  photoCount: 4,
  pageSide: 'spread',
  placeholders: [
    rect(0.5 + GAP / 2, 0, 0.5 - GAP / 2, 1, 'any'),
    rect(0, 0, 0.5 - GAP / 2, (1 - 2 * GAP) / 3, 'any'),
    rect(0, (1 - 2 * GAP) / 3 + GAP, 0.5 - GAP / 2, (1 - 2 * GAP) / 3, 'any'),
    rect(0, 2 * (1 - 2 * GAP) / 3 + 2 * GAP, 0.5 - GAP / 2, (1 - 2 * GAP) / 3, 'any'),
  ],
  isBuiltIn: true,
  createdAt: new Date(0).toISOString(),
  thumbnailColor: '#4f8a76',
}

/** The hand-written full-spread layouts above, widened into a family: one page carries a
 *  full-bleed image while the facing page carries the rest of the spread's photos in one of the
 *  ordinary layouts — a stack, a balanced grid at any row count, a feature photo with the others
 *  beside it, or a cascade. Thirty of them per photo count, so the browser's Smart design row
 *  opens on a full page of this look at any album size.
 *
 *  Every frame is authored flush and marked `bleed`, so the album's margin and image gap are not
 *  applied to it: this family's whole point is that no white border is left anywhere on the spread,
 *  and an inset here would put one back at the trim edge. */
const FULL_SPREAD_TEMPLATES: TemplateDefinition[] = []
/** Thirty variants per photo count is the target; past that the differences stop reading. */
const FULL_SPREAD_PER_COUNT = 30
const bleed = (x: number, y: number, width: number, height: number) =>
  ({ ...rect(x, y, width, height), bleed: true })
/** `placeGridInRect` with its gutters taken back out, so the cells meet edge to edge. */
function flushGrid(count: number, x: number, y: number, w: number, h: number, rows?: number) {
  return placeGridInRect(0, count, x, y, w, h, rows)
    .map(p => ({ ...p, id: `hc${nextHandCraftedId++}`, bleed: true,
      x: p.x - GAP / 2, y: p.y - GAP / 2, width: p.width + GAP, height: p.height + GAP }))
}

type Side = 'left' | 'right'

/** `count` photos filling `height` from `top` on the facing page — a simple stack while they
 *  still read at that size, a balanced grid once a stack would be a row of slivers. */
function facingStack(side: Side, count: number, top: number, height: number) {
  const pageX = side === 'left' ? 0.5 : 0
  if (count > 4) return flushGrid(count, pageX, top, 0.5, height)
  const cellH = height / count
  return Array.from({ length: count }, (_, i) => bleed(pageX, top + i * cellH, 0.5, cellH))
}
/** `count` photos in a row on a common baseline, each one a step shorter as it moves away from
 *  the full-bleed page, so the two pages read as one descending run. */
function facingCascade(side: Side, count: number, flip: boolean) {
  const pageX = side === 'left' ? 0.5 : 0, cellW = 0.5 / count
  return Array.from({ length: count }, (_, i) => {
    const step = (side === 'left') !== flip ? i : count - 1 - i
    const height = 1 - step * (0.5 / count)
    return bleed(pageX + i * cellW, 1 - height, cellW, height)
  })
}
/** A feature photo taking `share` of the facing page against `edge`, the rest gridded beside it. */
function facingFeature(side: Side, count: number, edge: 'top' | 'bottom' | 'inner' | 'outer', share: number) {
  const pageX = side === 'left' ? 0.5 : 0
  const vertical = edge === 'top' || edge === 'bottom'
  const first = edge === 'top' || (edge === 'inner') === (side === 'right')
  if (vertical) {
    const feature = bleed(pageX, first ? 0 : 1 - share, 0.5, share)
    const rest = flushGrid(count - 1, pageX, first ? share : 0, 0.5, 1 - share)
    return first ? [feature, ...rest] : [...rest, feature]
  }
  const w = 0.5 * share
  const feature = bleed(first ? pageX : pageX + 0.5 - w, 0, w, 1)
  const rest = flushGrid(count - 1, first ? pageX + w : pageX, 0, 0.5 - w, 1)
  return first ? [feature, ...rest] : [...rest, feature]
}

/** Every distinct facing-page layout for `count` photos, best first. The first three keys are the
 *  ones this family has always used, so albums already referencing one keep their geometry. */
function facingLayouts(side: Side, count: number): { key: string; name: string; frames: PlaceholderRect[] }[] {
  const label = side === 'left' ? 'Left' : 'Right'
  const pageX = side === 'left' ? 0.5 : 0
  const out = [{ key: '', name: `Full ${label} + ${count}`, frames: facingStack(side, count, 0, 1) }]
  if (count >= 2) out.push({ key: 'cascade-', name: `Full ${label} Cascade + ${count}`, frames: facingCascade(side, count, false) })
  if (count >= 3) out.push({ key: 'hero-', name: `Full ${label} + Feature + ${count - 1}`, frames: facingFeature(side, count, 'top', count <= 3 ? 0.62 : 0.5) })
  if (count >= 2) out.push({ key: 'cascade-up-', name: `Full ${label} Rising + ${count}`, frames: facingCascade(side, count, true) })
  // The feature photo against each edge of the facing page, at three sizes.
  for (const edge of ['top', 'bottom', 'inner', 'outer'] as const) {
    for (const share of [0.5, 0.62, 0.38]) {
      if (count < 2) continue
      out.push({ key: `feature${edge}${Math.round(share * 100)}-`, name: `Full ${label} ${edge[0].toUpperCase()}${edge.slice(1)} Feature + ${count - 1}`, frames: facingFeature(side, count, edge, share) })
    }
  }
  // A balanced grid at every row count the photos divide into, which is where most of the variety
  // at higher photo counts comes from.
  for (let rows = 1; rows <= count; rows++) {
    out.push({ key: `rows${rows}-`, name: `Full ${label} + ${count} in ${rows} Row${rows === 1 ? '' : 's'}`, frames: flushGrid(count, pageX, 0, 0.5, 1, rows) })
  }
  return out
}

/** The signature uniqueTemplates dedupes on, so the thirty kept here are thirty that survive it. */
const frameSignature = (frames: PlaceholderRect[]) =>
  frames.map(p => [p.x, p.y, p.width, p.height].map(v => Math.round(v * 20)).join(',')).sort().join('|')

// Counts run outermost and the two sides alternate inside them, so each photo count fills its
// thirty from both sides rather than the left page taking them all.
for (let count = 1; count <= 29; count++) {
  const layouts = { left: facingLayouts('left', count), right: facingLayouts('right', count) }
  const seen = new Set<string>()
  let kept = 0
  for (let i = 0; kept < FULL_SPREAD_PER_COUNT && (i < layouts.left.length || i < layouts.right.length); i++) {
    for (const side of ['left', 'right'] as const) {
      const layout = layouts[side][i]
      if (!layout || kept >= FULL_SPREAD_PER_COUNT) continue
      const placeholders = [bleed(side === 'left' ? 0 : 0.5, 0, 0.5, 1), ...layout.frames]
      const signature = frameSignature(placeholders)
      if (seen.has(signature)) continue
      seen.add(signature)
      kept++
      FULL_SPREAD_TEMPLATES.push({ id: `gen-full-${side}-${layout.key}${count}`, name: layout.name, photoCount: count + 1,
        placeholders, pageSide: 'spread', isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#4f8a6b' })
    }
  }
  for (const side of ['left', 'right'] as const) {
    const label = side === 'left' ? 'Left' : 'Right'
    const fullX = side === 'left' ? 0 : 0.5, pageX = side === 'left' ? 0.5 : 0
    const page = bleed(fullX, 0, 0.5, 1)
    // Caption under the photos on the facing page.
    FULL_SPREAD_TEMPLATES.push({
      id: `gen-mixed-full-${side}-caption-${count}`, name: `Full ${label} + ${count} + Caption`, photoCount: count + 1,
      placeholders: [page, ...facingStack(side, count, 0, 0.78)],
      textBoxes: [caption(pageX + 0.02, 0.8, 0.46, 0.16)],
      pageSide: 'spread', isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#6b4f8a',
    })
    // Caption overlaid on the full-bleed page itself, white so it reads against a photo.
    FULL_SPREAD_TEMPLATES.push({
      id: `gen-mixed-full-${side}-overlay-${count}`, name: `Full ${label} Overlay + ${count}`, photoCount: count + 1,
      placeholders: [page, ...facingStack(side, count, 0, 1)],
      textBoxes: [caption(fullX + 0.04, 0.78, 0.42, 0.14, '#ffffff')],
      pageSide: 'spread', isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#4f5a8a',
    })
  }
}

/** Mixed layouts that are not full-spread: a photo grid with a caption band across the top or the
 *  bottom of the whole spread. Gives the mixed browser a built-in option at every common count. */
for (const edge of ['top', 'bottom'] as const) {
  for (let count = 1; count <= 30; count++) {
    const bandH = 0.18, photosY = edge === 'top' ? bandH + GAP : 0
    FULL_SPREAD_TEMPLATES.push({
      id: `gen-mixed-band-${edge}-${count}`,
      name: `${count} Photo${count === 1 ? '' : 's'} + ${edge === 'top' ? 'Title Above' : 'Caption Below'}`,
      photoCount: count,
      pageSide: 'spread',
      placeholders: placeGridInRect(0, count, 0, photosY, 1, 1 - bandH - GAP)
        .map(p => ({ ...p, id: `hc${nextHandCraftedId++}` })),
      textBoxes: [caption(0.2, edge === 'top' ? 0.01 : 1 - bandH + 0.01, 0.6, bandH - 0.02)],
      isBuiltIn: true,
      createdAt: new Date(0).toISOString(),
      thumbnailColor: '#8a6b4f',
    })
  }
}

const HAND_CRAFTED_TEMPLATES: TemplateDefinition[] = [
  full,
  fullLeftCaption,
  fullRightCaption,
  fullLeftOverlay,
  fullRightOverlay,
  fullLeftTriple,
  fullRightTriple,
  framedSingle,
  coverFrontSpineBack,
  seamlessPortrait,
  seamlessTwoUp,
  seamlessStackTwo,
  seamlessThreeUp,
  seamlessFourGrid,
  twoVertical,
  twoHorizontal,
  leftRightPair,
  twoBigSmall,
  threeAsymmetric,
  threeAsymmetricRight,
  threeEven,
  threeTopStrip,
  threeBottomStrip,
  fourGrid,
  fourFilmstrip,
  fourFilmstripVertical,
  fourTopBanner,
  fourFeatureRight,
  fourOffsetQuad,
  fiveFeatureGrid,
  fiveEvenColumns,
  fiveCross,
  sixGrid,
  sixGridTall,
  sixFilmstrip,
  sixFeatureFive,
]

/** 300 interior layouts per photo count (1–30), plus the cover. Keep original entries first
 *  so existing projects and equally ranked layout suggestions retain their geometry/order. */
const originalTemplates = [...HAND_CRAFTED_TEMPLATES, ...GENERATED_TEMPLATES]
const existingTemplates = [...originalTemplates, ...expandTemplateLibrary(originalTemplates)]
const signatures = new Set(existingTemplates.map(t => `${t.photoCount}:${geometrySignature(t.placeholders)}`))
const editorialAdditions = EDITORIAL_TEMPLATES.filter(t => {
  const signature = `${t.photoCount}:${geometrySignature(t.placeholders)}`
  if (signatures.has(signature)) return false
  signatures.add(signature)
  return true
})
// Appended after everything the library was ever built from, so a hand-written layout always wins
// the dedup pass below and the geometry of saved albums is untouched.
// Full-spread first: now that this family runs edge to edge it collides with the classic
// two-page layouts that carry a gutter gap, and the edge-to-edge version is the one designers
// asked for, so it is the one `uniqueTemplates` should keep.
// The signature set leads: it is the short list of hand-written layouts a designer reaches for
// first, and being ahead of everything else means it also wins the dedup pass when a generated
// grid happens to land on the same geometry.
const legacyTemplates = [...ALBUM_TEMPLATES, ...BLEED_FEATURE_TEMPLATES, ...EDGE_TEMPLATES, ...SIGNATURE_TEMPLATES, ...FULL_SPREAD_TEMPLATES, ...existingTemplates, ...editorialAdditions, ...SHAPE_SET_TEMPLATES]

/** What makes two layouts the same design: which edges the frames share, not how wide the columns
 *  are. A spread split 1:1 and the same spread split 1:2 are one arrangement at two sizes, and
 *  only one of them belongs in the browser — a shelf of near-identical tiles is the complaint this
 *  answers. Running to the trim is a different design, so `bleed` stays part of the signature. */
const arrangementCache = new WeakMap<PlaceholderRect[], string>()

/** Strips an authored page margin, so a layout drawn 4% in from the sheet and the same layout
 *  drawn 9% in are one arrangement rather than two. The album applies its own margin when the
 *  template is used, so the one in the artwork is a drawing convention, not part of the design.
 *
 *  Only an even margin is stripped — all four insets equal, and small. A layout pushed to one
 *  side is making a point of where it sits on the sheet, and stretching it to fill would say the
 *  opposite. */
function withoutAuthoredMargin(frames: PlaceholderRect[]): PlaceholderRect[] {
  if (!frames.length) return frames
  const left = Math.min(...frames.map(p => p.x)), right = Math.max(...frames.map(p => p.x + p.width))
  const top = Math.min(...frames.map(p => p.y)), bottom = Math.max(...frames.map(p => p.y + p.height))
  const insets = [left, top, 1 - right, 1 - bottom]
  const even = Math.max(...insets) - Math.min(...insets) <= 0.025
  if (!even || Math.max(...insets) <= 0.001 || Math.max(...insets) > 0.14) return frames
  const width = right - left, height = bottom - top
  if (width <= 0 || height <= 0) return frames
  return frames.map(p => ({ ...p,
    x: (p.x - left) / width, y: (p.y - top) / height,
    width: p.width / width, height: p.height / height }))
}

function arrangementSignature(authored: PlaceholderRect[]): string {
  const cached = arrangementCache.get(authored)
  if (cached !== undefined) return cached
  // Authored gutters are not part of the arrangement. The same pair of photographs side by side is
  // in the library three times over — once flush, once with a hairline between them, once with a
  // wide one — and each gutter adds its own pair of edges, so comparing raw coordinates reads them
  // as three different designs. resolveTemplateFrames collapses a gutter to a shared boundary
  // before anything else, which is exactly the normalisation wanted here; at zero margin and zero
  // gap it does that and nothing more.
  const frames = withoutAuthoredMargin(resolveTemplateFrames(authored, 1, 0, 0))
  // The distinct edges the layout is built on, near-equal ones merged: these are its grid lines.
  // Wide enough to absorb a gutter the collapse pass left behind, narrow enough that two sides of
  // a real photograph are never mistaken for one edge. An authored page margin is handled before
  // this, by withoutAuthoredMargin, rather than by widening the tolerance until it swallows one.
  const TOLERANCE = 0.04
  const gridLines = (values: number[]) => {
    const out: number[] = []
    for (const v of [...values].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > TOLERANCE) out.push(v)
    return out
  }
  // The sheet's own edges count as grid lines even when nothing touches them, and the number of
  // lines is part of the signature. Without that, one photograph on the left page and one filling
  // the whole spread would both read as "a single frame" and collapse into each other — the same
  // arrangement only in the sense that every solo layout is.
  const xs = gridLines([0, 1, ...frames.flatMap(p => [p.x, p.x + p.width])])
  const ys = gridLines([0, 1, ...frames.flatMap(p => [p.y, p.y + p.height])])
  const line = (list: number[], v: number) => Math.max(0, list.findIndex(e => Math.abs(e - v) <= TOLERANCE))
  const signature = `${xs.length}x${ys.length}:` + frames.map(p => [
    line(xs, p.x), line(ys, p.y), line(xs, p.x + p.width), line(ys, p.y + p.height),
    p.bleed ? 'b' : '', Math.round((p.rotationDeg ?? 0) / 5),
  ].join(',')).sort().join('|')
  arrangementCache.set(authored, signature)
  return signature
}

export function uniqueTemplates(templates: TemplateDefinition[]): TemplateDefinition[] {
  const seen = new Set<string>()
  return templates.filter(t => {
    const frames = arrangementSignature(t.placeholders)
    // Captions are part of the design: the same photo grid with and without a text box, or with the
    // caption in a different place, are different templates and both belong in the browser.
    const text = (t.textBoxes ?? []).map(b => [b.x, b.y, b.width, b.height].map(v => Math.round(v * 20)).join(',')).sort().join('|')
    const signature = `${!t.isBuiltIn?t.id+':':''}${t.pageSide}:${t.id === 'cover-front-spine-back' ? 'cover' : t.photoCount}:${frames}:${text}`
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}

// Keep legacy IDs resolvable so existing albums retain their frame IDs and geometry.
export const BUILT_IN_TEMPLATES = uniqueTemplates(legacyTemplates)

/** CSS style for a template swatch's background — a thumbnail image, a flat color, or a CSS
 *  gradient string (the generated library's `thumbnailColor` values are gradients, e.g.
 *  "linear-gradient(...)"). Deliberately keeps `backgroundColor`/`backgroundImage` as the only
 *  keys touched (never the `background` shorthand) and never sets both at once — mixing the
 *  shorthand with `backgroundImage` in the same inline style object is a classic React footgun:
 *  whichever one is processed second silently clears the background-image the other just set,
 *  since they share that underlying CSS longhand. */
export function templateSwatchStyle(t: Pick<TemplateDefinition, 'thumbnailColor' | 'thumbnailImage'>): {
  backgroundColor?: string
  backgroundImage?: string
} {
  if (t.thumbnailImage) return { backgroundImage: `url(${t.thumbnailImage})` }
  if (t.thumbnailColor.includes('gradient')) return { backgroundImage: t.thumbnailColor }
  return { backgroundColor: t.thumbnailColor }
}

/** The full-bleed-page family — one page edge to edge, the facing page carrying the photos and,
 *  in the mixed variants, the caption. Listed ahead of everything else in the template browser,
 *  the way a recently used layout is, because it is the look designers reach for most. */
/** Layouts the browsers must not test for a uniform gap: one of their frames runs to the trim by
 *  design, so the seam beside it is a margin rather than a gap and the check can never pass. */
export function runsToTheTrim(t: TemplateDefinition): boolean {
  return isFullSpreadTemplate(t) || isBleedFeatureTemplate(t.id)
}

export function isFullSpreadTemplate(t: TemplateDefinition): boolean {
  // The generated family only — its ids always end in the photo count. The six hand-written
  // originals it grew from carry gutters and an inset, so they are ordinary templates: this
  // predicate marks the ones authored full-bleed, which is what earns the exemptions above.
  return /^gen-(full|mixed-full)-(left|right)-[a-z0-9-]*[0-9]+$/.test(t.id)
}

export type TemplateFrameFilter = 'all' | 'no-square' | 'only-3x2'

const RATIO_TOLERANCE = 0.08

/** Whether every placeholder is close to a classic 3:2 (or 2:3) photo ratio. */
function hasOnly3x2Frames(t: TemplateDefinition, aspect: number): boolean {
  return t.placeholders.every((ph) => {
    const r = ph.width / ph.height * aspect
    return Math.abs(r - 1.5) < RATIO_TOLERANCE || Math.abs(r - 2 / 3) < RATIO_TOLERANCE
  })
}

/** Filter actual frame proportions at the album aspect ratio, rather than normalized coordinates. */
export function matchesFrameFilter(t: TemplateDefinition, filter: TemplateFrameFilter, aspect = 1): boolean {
  if (filter === 'no-square') return !t.placeholders.some((ph) => Math.abs(ph.width / ph.height * aspect - 1) < RATIO_TOLERANCE)
  if (filter === 'only-3x2') return hasOnly3x2Frames(t, aspect)
  return true
}

/** Returns every built-in template that fits a given photo count, for the "smart grid suggestions" picker. */
/** Answers for one state of the library, thrown away whenever the user template registry changes.
 *  Auto Build asks this question for all thirty photo counts, several times over, for every
 *  checkbox the user touches — and the answer only ever changes when that registry does. The outer
 *  key is the caller's own `enabledTemplateIds` array, so a caller that keeps a stable array (every
 *  caller on a hot path does) gets a stable cache entry without hashing a long id list. */
let forCountCache = new WeakMap<object, Map<string, TemplateDefinition[]>>()
const ALL_TEMPLATES = {}

export function templatesForCount(
  count: number,
  enabledTemplateIds: string[] | null = null,
  frameFilter: TemplateFrameFilter = 'all',
  aspect = 1
): TemplateDefinition[] {
  if (count <= 0) return []
  const bucketKey = enabledTemplateIds ?? ALL_TEMPLATES
  let bucket = forCountCache.get(bucketKey)
  if (!bucket) forCountCache.set(bucketKey, bucket = new Map())
  const key = `${count}|${frameFilter}|${aspect}`
  const hit = bucket.get(key)
  if (hit) return hit
  const answer = computeTemplatesForCount(count, enabledTemplateIds, frameFilter, aspect)
  bucket.set(key, answer)
  return answer
}

/** How long and thin a frame may be before it stops reading as a photo and starts reading as a
 *  band. 3.2:1 keeps panoramas and ordinary wide rectangles; it drops the letterbox strips a grid
 *  of one column by many rows produces, which no designer picks on purpose. */
const MAX_FRAME_RATIO = 3.2

/** A layout built from photo-shaped frames: squares and rectangles, nothing stretched into a strip.
 *  Measured in real proportions, so the album's own shape is taken into account — the same frame is
 *  a square on a 12x12 and a letterbox on a 36x12. */
/** A layout where no photo sits on top of another. One photo overlapping the next is a staged
 *  collage, not a page layout: the frame underneath is partly hidden, so whatever is dropped into
 *  it is partly thrown away. A shared edge is fine — that is how a flush grid is built. */
export function hasSeparateFrames(t: TemplateDefinition): boolean {
  const f = t.placeholders
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
    const a = f[i], b = f[j]
    if (a.x < b.x + b.width - 0.004 && b.x < a.x + a.width - 0.004 &&
        a.y < b.y + b.height - 0.004 && b.y < a.y + a.height - 0.004) return false
  }
  return true
}

export function hasPhotoShapedFrames(t: TemplateDefinition, aspect: number): boolean {
  return t.placeholders.every((ph) => {
    const ratio = ph.width / ph.height * aspect
    return ratio <= MAX_FRAME_RATIO && ratio >= 1 / MAX_FRAME_RATIO
  })
}

function computeTemplatesForCount(
  count: number,
  enabledTemplateIds: string[] | null,
  frameFilter: TemplateFrameFilter,
  aspect: number
): TemplateDefinition[] {
  let builtins = [...legacyTemplates, ...userTemplateRegistry].filter((t) => t.photoCount === count && t.id !== 'cover-front-spine-back')
  if (enabledTemplateIds !== null) builtins = builtins.filter((t) => enabledTemplateIds.includes(t.id))
  if (frameFilter !== 'all') builtins = builtins.filter((t) => matchesFrameFilter(t, frameFilter, aspect))
  // Smart design is the curated shelf: only layouts whose frames are photo-shaped belong on it.
  // Anything stretched into a band is dropped — unless that leaves nothing at all for this photo
  // count, in which case a strip beats refusing to build the album.
  const photoShaped = builtins.filter((t) => hasPhotoShapedFrames(t, aspect) && hasSeparateFrames(t))
  if (photoShaped.length > 0) builtins = photoShaped
  builtins = uniqueTemplates(builtins)
  if (!enabledTemplateIds) {
    // Default suggestions favor clean, non-overlapping rectangular layouts — matching the
    // client's own site (ynot.website), which never overlaps photos. The "Collage" family
    // (two photos deliberately drawn on top of each other) stays fully browsable from
    // "Browse All Templates…", just not auto-suggested or picked by Auto-Build.
    const nonOverlapping = builtins.filter((t) => templateFamilyLabel(t) !== 'Collage')
    if (nonOverlapping.length > 0) builtins = nonOverlapping
  }
  if (builtins.length > 0 || enabledTemplateIds !== null || frameFilter !== 'all') return builtins
  // Beyond the hand-designed 1-6 photo templates, offer two auto-generated, balanced layouts.
  const clamped = Math.min(count, 30)
  return [generateJustifiedGrid(clamped), generateHeroGrid(clamped)]
}

// User-saved/imported templates aren't known to this module by default — the store mirrors its
// userTemplates list in here via setUserTemplateRegistry() so lookups below (used when applying
// a template to a spread, and when rendering a spread's placeholder boxes) can find them too.
let userTemplateRegistry: TemplateDefinition[] = []

export function setUserTemplateRegistry(templates: TemplateDefinition[]) {
  userTemplateRegistry = templates
  // Every cached answer was computed from the old registry.
  forCountCache = new WeakMap()
  byId = null
}

/** Every template by id. findTemplate used to scan the library, which is thousands of entries, and
 *  it is called for every frame of every spread — including once per pointer move while a frame is
 *  being dragged, where the scan was most of the frame budget. */
let byId: Map<string, TemplateDefinition> | null = null
function templateIndex(): Map<string, TemplateDefinition> {
  if (!byId) {
    byId = new Map()
    for (const t of legacyTemplates) if (!byId.has(t.id)) byId.set(t.id, t)
    for (const t of userTemplateRegistry) byId.set(t.id, t)
  }
  return byId
}

/** Imported PSD/artwork templates carry absolute frames — a finished design, not a layout that
 *  flexes to a photo count — so `templatesForCount` would only ever surface one on a spread that
 *  happens to hold exactly as many photos. The template browsers offer them at any count instead,
 *  and applying one retemplates the spread to its own frames. `templatesForCount` already returned
 *  the exact-count matches, and `retemplateSpread` refuses a template with fewer frames than the
 *  spread has photos rather than dropping any, so only designs with more frames are added here. */
export function importedDesignTemplates(
  photoCount: number,
  enabledTemplateIds: string[] | null = null,
  frameFilter: TemplateFrameFilter = 'all',
  aspect = 1
): TemplateDefinition[] {
  return userTemplateRegistry.filter((t) =>
    t.absoluteFrames &&
    t.photoCount > photoCount &&
    (enabledTemplateIds === null || enabledTemplateIds.includes(t.id)) &&
    (frameFilter === 'all' || matchesFrameFilter(t, frameFilter, aspect)))
}

/** Looks up a template by id across both the built-in library and the user's saved/imported ones. */
export function findTemplate(id: string): TemplateDefinition | undefined {
  const known = templateIndex().get(id)
  if (known) return known

  // Auto-generated templates (justified/hero grids, custom rows x cols) aren't stored anywhere —
  // they're cheap to recompute deterministically from their id, which also keeps them in sync if
  // the generator logic changes later.
  const justified = id.match(/^auto-justified-(\d+)$/)
  if (justified) return generateJustifiedGrid(Number(justified[1]))
  const hero = id.match(/^auto-hero-(\d+)$/)
  if (hero) return generateHeroGrid(Number(hero[1]))
  const custom = id.match(/^custom-grid-(\d+)x(\d+)$/)
  if (custom) return generateCustomGrid(Number(custom[1]), Number(custom[2]))
  return undefined
}

/** Coarse family label derived from a template's id — used only to group the Template Gallery
 *  browser into tabs (Classic / Seamless / Grid / Hero / Split / Mosaic / Collage / Filmstrip /
 *  Custom / My Templates), since the generated library doesn't carry a separate "family" field. */
export function templateFamilyLabel(t: TemplateDefinition): string {
  if (t.id.startsWith('ref-bleed-')) return 'Bleed Feature'
  if (t.id.startsWith('ref-edge-')) return 'Edge to Edge'
  if (t.id.startsWith('ref-album-')) return 'Album Study'
  if (t.id.startsWith('ref-signature-')) return 'Signature'
  if (t.id.startsWith('ref-editorial-')) return 'Editorial'
  if (t.id.startsWith('ref-paired-')) return 'Paired Pages'
  if (t.id.startsWith('ref-storyboard-')) return 'Storyboard'
  if (t.id.startsWith('ref-mosaic-')) return 'Mosaic'
  if (t.id.startsWith('seamless-')) return 'Seamless'
  if (t.id.startsWith('gen-grid-') || t.id.startsWith('gen-gridcol-')) return 'Grid'
  if (t.id.startsWith('gen-hero-')) return 'Hero'
  if (t.id.startsWith('gen-split-')) return 'Split'
  if (t.id.startsWith('gen-mosaic-')) return 'Mosaic'
  if (t.id.startsWith('gen-collage-')) return 'Collage'
  if (t.id.startsWith('gen-filmstrip-')) return 'Filmstrip'
  if (t.id.startsWith('gen-modern-')) return 'Modern'
  if (t.id.startsWith('auto-') || t.id.startsWith('custom-grid-')) return 'Custom'
  if (!t.isBuiltIn) return 'My Templates'
  return 'Classic'
}

export const TEMPLATE_FAMILIES = [
  'All',
  'Classic',
  'Seamless',
  'Modern',
  'Editorial',
  'Paired Pages',
  'Storyboard',
  'Grid',
  'Hero',
  'Split',
  'Mosaic',
  'Collage',
  'Filmstrip',
  'My Templates',
] as const

/** Picks a reasonable default template for a count, varying the choice so consecutive spreads don't repeat. */
export function suggestTemplate(count: number, avoidId?: string, enabledTemplateIds: string[] | null = null): TemplateDefinition {
  const candidates = templatesForCount(Math.max(1, Math.min(count, 30)), enabledTemplateIds)
  if (candidates.length === 0) return full
  const filtered = candidates.filter((t) => t.id !== avoidId)
  const pool = filtered.length > 0 ? filtered : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}
