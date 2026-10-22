import { TemplateDefinition, PlaceholderRect } from '@/types'
import { GAP, distributeEvenly, placeGridInRect, geometrySignature } from './templateLayout'
import { GENERATED_TEMPLATES } from './templateGenerator'
import { expandTemplateLibrary } from './referenceTemplates'
import { EDITORIAL_TEMPLATES } from './editorialTemplates'

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

const HAND_CRAFTED_TEMPLATES: TemplateDefinition[] = [
  full,
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
export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [...existingTemplates, ...editorialAdditions]

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
export function templatesForCount(
  count: number,
  enabledTemplateIds: string[] | null = null,
  frameFilter: TemplateFrameFilter = 'all',
  aspect = 1
): TemplateDefinition[] {
  if (count <= 0) return []
  let builtins = [...BUILT_IN_TEMPLATES, ...userTemplateRegistry].filter((t) => t.photoCount === count && t.id !== 'cover-front-spine-back')
  if (enabledTemplateIds !== null) builtins = builtins.filter((t) => enabledTemplateIds.includes(t.id))
  if (frameFilter !== 'all') builtins = builtins.filter((t) => matchesFrameFilter(t, frameFilter, aspect))
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
}

/** Looks up a template by id across both the built-in library and the user's saved/imported ones. */
export function findTemplate(id: string): TemplateDefinition | undefined {
  const known = BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? userTemplateRegistry.find((t) => t.id === id)
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
