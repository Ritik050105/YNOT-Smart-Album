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

export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  full,
  twoVertical,
  leftRightPair,
  threeAsymmetric,
  threeEven,
  fourGrid,
  fourFilmstrip,
  fiveFeatureGrid,
  sixGrid,
]

/** Returns every built-in template that fits a given photo count, for the "smart grid suggestions" picker. */
export function templatesForCount(count: number): TemplateDefinition[] {
  return BUILT_IN_TEMPLATES.filter((t) => t.photoCount === count)
}

/** Picks a reasonable default template for a count, varying the choice so consecutive spreads don't repeat. */
export function suggestTemplate(count: number, avoidId?: string): TemplateDefinition {
  const candidates = templatesForCount(Math.min(count, 6))
  if (candidates.length === 0) return full
  const filtered = candidates.filter((t) => t.id !== avoidId)
  const pool = filtered.length > 0 ? filtered : candidates
  return pool[Math.floor(Math.random() * pool.length)]
}
