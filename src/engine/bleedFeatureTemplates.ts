import { TemplateDefinition, PlaceholderRect } from '@/types'

/** The layout YNOT's own albums use more than any other: one photograph run hard to the trim,
 *  and everything else inset and separated by the album's gap.
 *
 *  It is a mixed layout, which is the whole point of it. The feature frame is authored `bleed`, so
 *  the album margin is not applied to it and it keeps the page edge; the rest are ordinary frames,
 *  so they take the margin and the gap set in the album's own settings. Turn the gap up and the
 *  inset photographs breathe while the feature stays welded to the edge.
 *
 *  Deliberately one size per arrangement. A panel at 0.22 and the same panel at 0.3 is the same
 *  design twice, and `uniqueTemplates` now collapses the pair anyway — so only the arrangements
 *  differ here, never the proportions. */

type Box = [x: number, y: number, width: number, height: number]

/** A spread is twice as wide as it is tall on a square album, which is what these are drawn for. */
const SPREAD_ASPECT = 2

/** How many rows to break `count` photographs into so each cell comes out closest to square in the
 *  region given. Guessing this beats hand-tuning a row count per layout, and it is what keeps a
 *  strip of ten from being authored as one unusable 10-wide line. */
function bestRows(count: number, region: Box): number {
  const [, , w, h] = region
  let best = 1, bestScore = Infinity
  for (let rows = 1; rows <= count; rows++) {
    const cols = Math.ceil(count / rows)
    if (rows * cols - count >= cols) continue // a whole empty row
    const ratio = (w / cols) / (h / rows) * SPREAD_ASPECT
    const score = Math.abs(Math.log(ratio))
    if (score < bestScore) { bestScore = score; best = rows }
  }
  return best
}

/** `count` cells filling `region`, last row stretched to take up the remainder. */
function fill(count: number, region: Box): Box[] {
  const [rx, ry, rw, rh] = region
  const rows = bestRows(count, region)
  const out: Box[] = []
  let left = count
  for (let r = 0; r < rows; r++) {
    const cols = Math.ceil(left / (rows - r))
    const h = rh / rows
    for (let c = 0; c < cols; c++) out.push([rx + rw * c / cols, ry + h * r, rw / cols, h])
    left -= cols
  }
  return out
}

const COUNTS = [1, 2, 3, 4, 6, 8, 10]
const PANEL = 0.22, BAND = 0.32, BOOKEND = 0.18

type Layout = { key: string; name: string; bleed: Box[]; inset: Box[] }
const LAYOUTS: Layout[] = []

for (const n of COUNTS) {
  // A full-height photograph against one edge, the rest inset beside it.
  LAYOUTS.push({ key: `panel-left-${n}`, name: `Bleed Panel Left + ${n}`,
    bleed: [[0, 0, PANEL, 1]], inset: fill(n, [PANEL, 0, 1 - PANEL, 1]) })
  LAYOUTS.push({ key: `panel-right-${n}`, name: `Bleed Panel Right + ${n}`,
    bleed: [[1 - PANEL, 0, PANEL, 1]], inset: fill(n, [0, 0, 1 - PANEL, 1]) })

  // A full-width band across the top or the foot of the spread.
  LAYOUTS.push({ key: `band-top-${n}`, name: `Bleed Band Top + ${n}`,
    bleed: [[0, 0, 1, BAND]], inset: fill(n, [0, BAND, 1, 1 - BAND]) })
  LAYOUTS.push({ key: `band-foot-${n}`, name: `Bleed Band Foot + ${n}`,
    bleed: [[0, 1 - BAND, 1, BAND]], inset: fill(n, [0, 0, 1, 1 - BAND]) })

  // Both outer edges held by a photograph, the story inset between them.
  LAYOUTS.push({ key: `bookends-${n}`, name: `Bleed Bookends + ${n}`,
    bleed: [[0, 0, BOOKEND, 1], [1 - BOOKEND, 0, BOOKEND, 1]],
    inset: fill(n, [BOOKEND, 0, 1 - 2 * BOOKEND, 1]) })

  // Half the sheet given to one photograph, which is the single most common spread in the albums.
  LAYOUTS.push({ key: `half-left-${n}`, name: `Bleed Half Left + ${n}`,
    bleed: [[0, 0, 0.5, 1]], inset: fill(n, [0.5, 0, 0.5, 1]) })
  LAYOUTS.push({ key: `half-right-${n}`, name: `Bleed Half Right + ${n}`,
    bleed: [[0.5, 0, 0.5, 1]], inset: fill(n, [0, 0, 0.5, 1]) })
}

function frame(id: string, [x, y, width, height]: Box, bleed: boolean): PlaceholderRect {
  return { id, x, y, width, height, preferredOrientation: 'any', ...(bleed ? { bleed: true } : {}) }
}

export const BLEED_FEATURE_TEMPLATES: TemplateDefinition[] = LAYOUTS.map((layout) => {
  const id = `ref-bleed-${layout.key}`
  return {
    id,
    name: layout.name,
    photoCount: layout.bleed.length + layout.inset.length,
    pageSide: 'spread',
    isBuiltIn: true,
    createdAt: new Date(0).toISOString(),
    thumbnailColor: '#6b5f55',
    placeholders: [
      ...layout.bleed.map((box, i) => frame(`${id}-b${i}`, box, true)),
      ...layout.inset.map((box, i) => frame(`${id}-p${i}`, box, false)),
    ],
  }
})
