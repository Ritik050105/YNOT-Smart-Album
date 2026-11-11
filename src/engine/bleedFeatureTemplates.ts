import { TemplateDefinition, PlaceholderRect } from '@/types'

/** The layout YNOT's own albums use more than any other: one photograph run hard to the trim, and
 *  the rest of the story inset beside it, separated by the album's own gap.
 *
 *  It is a mixed layout, which is the whole point of it. The feature frame is authored `bleed`, so
 *  the album margin is not applied to it and it keeps the page edge; the rest are ordinary frames,
 *  so they take the margin and the gap set in the album's settings. Turn the gap up and the inset
 *  photographs breathe while the feature stays welded to the edge.
 *
 *  The proportions matter more here than anywhere else in the library. A template's 0–1 box covers
 *  the whole open spread, and an album's `size` IS that spread — a "12×12 Square" is a square
 *  sheet with the fold down the middle, not two 12×12 pages. So a frame a fifth of the sheet wide
 *  and full height is a 1:5 sliver on a square album, and the browsers drop it as band-shaped
 *  before anyone sees it. Everything below is sized so each frame stays photo-shaped on a square
 *  album, and counts that cannot manage it are not generated at all. */

type Box = [x: number, y: number, width: number, height: number]

/** Frames must read as photographs, not strips. The browsers allow 3.2:1 either way; this family
 *  keeps a margin inside that so a slightly wider album shape does not tip a frame over the edge. */
const MIN_RATIO = 0.36, MAX_RATIO = 2.6

const ratioOf = ([, , w, h]: Box) => w / h
const photoShaped = (box: Box) => ratioOf(box) >= MIN_RATIO && ratioOf(box) <= MAX_RATIO

/** Break `count` frames into rows so each cell comes out closest to an upright photograph, then
 *  vary the widths within each row. An even grid beside a bleeding photograph reads as a contact
 *  sheet; the delivered albums always break one frame wider than its neighbours. */
function mosaic(count: number, [rx, ry, rw, rh]: Box): Box[] | null {
  let rows = 1, best = Infinity
  for (let r = 1; r <= count; r++) {
    const cols = Math.ceil(count / r)
    if (r * cols - count >= cols) continue // a row that would come out empty
    const score = Math.abs(Math.log((rw / cols) / (rh / r) / 0.8))
    if (score < best) { best = score; rows = r }
  }
  // Weights repeat on a three-step cycle, offset per row, so the wider frame moves down the page.
  const WEIGHTS = [1, 1.22, 0.94]
  const out: Box[] = []
  let left = count, y = ry
  for (let r = 0; r < rows; r++) {
    const cols = Math.ceil(left / (rows - r))
    const h = rh / rows
    const weights = Array.from({ length: cols }, (_, c) => WEIGHTS[(c + r) % WEIGHTS.length])
    const total = weights.reduce((sum, w) => sum + w, 0)
    let x = rx
    for (const w of weights) {
      const width = rw * w / total
      out.push([x, y, width, h])
      x += width
    }
    left -= cols
    y += h
  }
  return out.every(photoShaped) ? out : null
}

const PANEL = 0.38, CORNER_W = 0.34, CORNER_H = 0.72, BAND = 0.42

/** Where the bleeding photograph sits, what is left for the mosaic, and any inset frame that falls
 *  outside that rectangle (the corner layouts tuck one photograph into the space the feature
 *  leaves). Every bleed box is itself checked against the shape rule below. */
const FEATURES: { key: string; name: string; bleed: Box[]; region: Box; extra?: Box[] }[] = [
  { key: 'panel-left', name: 'Bleed Panel Left', bleed: [[0, 0, PANEL, 1]], region: [PANEL, 0, 1 - PANEL, 1] },
  { key: 'panel-right', name: 'Bleed Panel Right', bleed: [[1 - PANEL, 0, PANEL, 1]], region: [0, 0, 1 - PANEL, 1] },
  { key: 'half-left', name: 'Bleed Half Left', bleed: [[0, 0, 0.5, 1]], region: [0.5, 0, 0.5, 1] },
  { key: 'half-right', name: 'Bleed Half Right', bleed: [[0.5, 0, 0.5, 1]], region: [0, 0, 0.5, 1] },
  { key: 'band-top', name: 'Bleed Band Top', bleed: [[0, 0, 1, BAND]], region: [0, BAND, 1, 1 - BAND] },
  { key: 'band-foot', name: 'Bleed Band Foot', bleed: [[0, 1 - BAND, 1, BAND]], region: [0, 0, 1, 1 - BAND] },
  { key: 'corner-left', name: 'Bleed Corner Left', bleed: [[0, 0, CORNER_W, CORNER_H]],
    region: [CORNER_W, 0, 1 - CORNER_W, 1], extra: [[0, CORNER_H, CORNER_W, 1 - CORNER_H]] },
  { key: 'corner-right', name: 'Bleed Corner Right', bleed: [[1 - CORNER_W, 1 - CORNER_H, CORNER_W, CORNER_H]],
    region: [0, 0, 1 - CORNER_W, 1], extra: [[1 - CORNER_W, 0, CORNER_W, 1 - CORNER_H]] },
]

const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function frame(id: string, [x, y, width, height]: Box, bleed: boolean): PlaceholderRect {
  return { id, x, y, width, height, preferredOrientation: 'any', ...(bleed ? { bleed: true } : {}) }
}

export const BLEED_FEATURE_TEMPLATES: TemplateDefinition[] = FEATURES.flatMap((feature) =>
  COUNTS.flatMap((n) => {
    const laid = mosaic(n, feature.region)
    // A count the region cannot hold in photo-shaped frames is simply not offered: a layout nobody
    // can see, because the browsers drop it, is worse than one that was never generated.
    if (!laid || !feature.bleed.every(photoShaped) || !(feature.extra ?? []).every(photoShaped)) return []
    const id = `ref-bleed-${feature.key}-${n}`
    const inset = [...laid, ...(feature.extra ?? [])]
    return [{
      id,
      name: `${feature.name} + ${inset.length}`,
      photoCount: feature.bleed.length + inset.length,
      pageSide: 'spread' as const,
      isBuiltIn: true,
      createdAt: new Date(0).toISOString(),
      thumbnailColor: '#6b5f55',
      placeholders: [
        ...feature.bleed.map((box, i) => frame(`${id}-b${i}`, box, true)),
        ...inset.map((box, i) => frame(`${id}-p${i}`, box, false)),
      ],
    }]
  })
)

/** The browsers gate built-in layouts on the album's gap being applicable uniformly across the
 *  sheet, which this family can never satisfy — the feature frame runs to the trim by design, so
 *  the seam beside it is a margin, not a gap. Exempted by id, the same way the full-bleed family
 *  already is, rather than loosening a check that is right for everything else. */
export function isBleedFeatureTemplate(id: string): boolean {
  return id.startsWith('ref-bleed-')
}
