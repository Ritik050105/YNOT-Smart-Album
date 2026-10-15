import { TemplateDefinition, PlaceholderRect } from '@/types'

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  preferredOrientation: PlaceholderRect['preferredOrientation'] = 'any'
): PlaceholderRect {
  return { id: crypto.randomUUID(), x, y, width, height, preferredOrientation }
}

const GAP = 0.02

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

/** Splits `total` into `parts` buckets as evenly as possible (e.g. 10 into 3 -> [4,3,3]). */
function distributeEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total % parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}

/** Lays `count` placeholders into a "justified" grid (balanced rows, no ragged gaps — the same
 *  approach photo apps like Google/Apple Photos use) inside the sub-rectangle (x0,y0,w,h).
 *  `idOffset` keeps placeholder ids unique when this is combined with other placeholders (e.g.
 *  a hero cell). Row count is chosen from the rect's own aspect ratio, not assumed square. */
function placeGridInRect(idOffset: number, count: number, x0: number, y0: number, w: number, h: number): PlaceholderRect[] {
  const rows = Math.max(1, Math.round(Math.sqrt((count * h) / w)))
  const rowCounts = distributeEvenly(count, rows)
  const rowH = h / rows
  const placeholders: PlaceholderRect[] = []
  let idx = idOffset
  for (let r = 0; r < rows; r++) {
    const cols = rowCounts[r]
    const colW = w / cols
    for (let c = 0; c < cols; c++) {
      placeholders.push({
        id: `p${idx}`,
        x: x0 + c * colW + GAP / 2,
        y: y0 + r * rowH + GAP / 2,
        width: colW - GAP,
        height: rowH - GAP,
        preferredOrientation: 'any',
      })
      idx++
    }
  }
  return placeholders
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

export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  full,
  framedSingle,
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

export type TemplateFrameFilter = 'all' | 'no-square' | 'only-3x2'

const RATIO_TOLERANCE = 0.08

/** Whether every placeholder is close to a classic 3:2 (or 2:3) photo ratio. */
function hasOnly3x2Frames(t: TemplateDefinition): boolean {
  return t.placeholders.every((ph) => {
    const r = ph.width / ph.height
    return Math.abs(r - 1.5) < RATIO_TOLERANCE || Math.abs(r - 2 / 3) < RATIO_TOLERANCE
  })
}

/** Mirrors the reference app's "Templates without square frames" / "...only with 3:2 frame
 *  ratios" filters — a coarse shape check on the template's own placeholders, not a perfect
 *  frame-matcher, but enough to narrow the picker when square or non-3:2 crops don't suit a job. */
export function matchesFrameFilter(t: TemplateDefinition, filter: TemplateFrameFilter): boolean {
  if (filter === 'no-square') return !t.placeholders.some((ph) => Math.abs(ph.width / ph.height - 1) < RATIO_TOLERANCE)
  if (filter === 'only-3x2') return hasOnly3x2Frames(t)
  return true
}

/** Returns every built-in template that fits a given photo count, for the "smart grid suggestions" picker. */
export function templatesForCount(
  count: number,
  enabledTemplateIds: string[] | null = null,
  frameFilter: TemplateFrameFilter = 'all'
): TemplateDefinition[] {
  if (count <= 0) return []
  let builtins = BUILT_IN_TEMPLATES.filter((t) => t.photoCount === count)
  if (enabledTemplateIds) {
    const narrowed = builtins.filter((t) => enabledTemplateIds.includes(t.id))
    // If the project's chosen template library happens to exclude every template for this
    // exact count, fall back to the full set rather than silently producing nothing.
    if (narrowed.length > 0) builtins = narrowed
  }
  if (frameFilter !== 'all') {
    const narrowed = builtins.filter((t) => matchesFrameFilter(t, frameFilter))
    if (narrowed.length > 0) builtins = narrowed
  }
  if (builtins.length > 0) return builtins
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

/** Picks a reasonable default template for a count, varying the choice so consecutive spreads don't repeat. */
export function suggestTemplate(count: number, avoidId?: string, enabledTemplateIds: string[] | null = null): TemplateDefinition {
  const candidates = templatesForCount(Math.max(1, Math.min(count, 30)), enabledTemplateIds)
  if (candidates.length === 0) return full
  const filtered = candidates.filter((t) => t.id !== avoidId)
  const pool = filtered.length > 0 ? filtered : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}
