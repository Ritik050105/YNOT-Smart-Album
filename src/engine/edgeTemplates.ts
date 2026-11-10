import { TemplateDefinition, PlaceholderRect } from '@/types'

/** Layouts that run to the edge of the sheet.
 *
 *  The signature set is quiet — generous margins, photographs floating in white. This is the other
 *  half of how YNOT's own albums are designed: the picture reaches the trim on every side, the
 *  spread reads as one surface, and the only white on the page is the gap between photographs.
 *
 *  Every frame here is authored `bleed`, which means the album margin is not applied to it — that
 *  margin is exactly the white border these layouts exist to avoid. The album's GAP still applies,
 *  but only on edges where a frame meets another frame: an outer edge stays on the trim. So the
 *  same layout is a tight mosaic at gap 0 and an airy one at gap 20, without ever pulling away
 *  from the page edge.
 *
 *  Coordinates are [x, y, width, height] as fractions of the whole spread. Frames cross the fold
 *  freely: a sheet designed as one surface has no two pages to respect. */

type Box = [x: number, y: number, width: number, height: number]

/** A row of cells spanning `left`..`right`, at the given relative widths. */
function row(top: number, bottom: number, left: number, right: number, weights: number[]): Box[] {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let x = left
  return weights.map((w) => {
    const width = (right - left) * (w / total)
    const box: Box = [x, top, width, bottom - top]
    x += width
    return box
  })
}

/** A column of cells spanning `top`..`bottom`, at the given relative heights. */
function column(left: number, right: number, top: number, bottom: number, weights: number[]): Box[] {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let y = top
  return weights.map((w) => {
    const height = (bottom - top) * (w / total)
    const box: Box = [left, y, right - left, height]
    y += height
    return box
  })
}

const LAYOUTS: { key: string; name: string; boxes: Box[]; symmetric?: boolean }[] = [
  // --- One surface, split ------------------------------------------------------------------------
  // No plain halves here — a spread split down the middle already exists in the library.
  { key: 'thirds', name: 'Edge · Thirds', boxes: row(0, 1, 0, 1, [1, 1, 1]), symmetric: true },
  { key: 'wide-centre', name: 'Edge · Wide Centre', boxes: row(0, 1, 0, 1, [1, 2, 1]), symmetric: true },
  { key: 'quarters', name: 'Edge · Quarters', boxes: row(0, 1, 0, 1, [1, 1, 1, 1]), symmetric: true },

  // --- A hero running to the trim, with a stack beside it -----------------------------------------
  { key: 'hero-pair', name: 'Edge · Hero and Pair',
    boxes: [...row(0, 1, 0, 0.62, [1]), ...column(0.62, 1, 0, 1, [1, 1])] },
  { key: 'hero-trio', name: 'Edge · Hero and Three',
    boxes: [...row(0, 1, 0, 0.58, [1]), ...column(0.58, 1, 0, 1, [1, 1, 1])] },
  { key: 'hero-quad', name: 'Edge · Hero and Four',
    boxes: [...row(0, 1, 0, 0.56, [1]), ...row(0, 0.5, 0.56, 1, [1, 1]), ...row(0.5, 1, 0.56, 1, [1, 1])] },
  { key: 'hero-strip', name: 'Edge · Hero over Strip',
    boxes: [...row(0, 0.64, 0, 1, [1]), ...row(0.64, 1, 0, 1, [1, 1, 1, 1])] },

  // --- Banded: a full-width band with a row of details ---------------------------------------------
  { key: 'band-over-four', name: 'Edge · Band over Four',
    boxes: [...row(0, 0.56, 0, 1, [1, 1]), ...row(0.56, 1, 0, 1, [1, 1, 1, 1])], symmetric: true },
  { key: 'band-under-three', name: 'Edge · Three over Band',
    boxes: [...row(0, 0.52, 0, 1, [1, 1, 1]), ...row(0.52, 1, 0, 1, [1, 1])], symmetric: true },

  // --- Mosaics, the dense end of the set ------------------------------------------------------------
  { key: 'mosaic-six', name: 'Edge · Six Mosaic',
    boxes: [...row(0, 0.5, 0, 1, [1, 1, 1]), ...row(0.5, 1, 0, 1, [1, 1, 1])], symmetric: true },
  { key: 'mosaic-eight', name: 'Edge · Eight Mosaic',
    boxes: [...row(0, 0.5, 0, 1, [1, 1, 1, 1]), ...row(0.5, 1, 0, 1, [1, 1, 1, 1])], symmetric: true },
  { key: 'mosaic-weighted', name: 'Edge · Weighted Mosaic',
    boxes: [...row(0, 0.54, 0, 1, [3, 2, 2]), ...row(0.54, 1, 0, 1, [2, 3, 2])], symmetric: true },
  { key: 'mosaic-ten', name: 'Edge · Ten Mosaic',
    boxes: [...row(0, 0.5, 0, 1, [1, 1, 1, 1, 1]), ...row(0.5, 1, 0, 1, [1, 1, 1, 1, 1])], symmetric: true },

  // --- A column of details against a wide picture ----------------------------------------------------
  { key: 'column-and-wide', name: 'Edge · Column and Wide',
    boxes: [...column(0, 0.26, 0, 1, [1, 1, 1]), ...row(0, 1, 0.26, 1, [1])] },
  { key: 'column-pair-wide', name: 'Edge · Column, Pair and Wide',
    boxes: [...column(0, 0.24, 0, 1, [1, 1]), ...row(0, 1, 0.24, 0.62, [1]), ...column(0.62, 1, 0, 1, [1, 1])], symmetric: true },
]

function makeTemplate(id: string, name: string, boxes: Box[]): TemplateDefinition {
  const placeholders: PlaceholderRect[] = boxes.map(([x, y, width, height], i) => ({
    id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any', bleed: true,
  }))
  return {
    id, name, photoCount: placeholders.length, pageSide: 'spread', isBuiltIn: true,
    createdAt: new Date(0).toISOString(), thumbnailColor: '#5b5f63', placeholders,
  }
}

/** Every edge-to-edge layout, asymmetric ones in both directions. */
export const EDGE_TEMPLATES: TemplateDefinition[] = LAYOUTS.flatMap((layout) => {
  const made = [makeTemplate(`ref-edge-${layout.key}`, layout.name, layout.boxes)]
  if (layout.symmetric) return made
  // Mirrored about the fold, so a run of spreads can alternate which side carries the hero.
  const mirrored = layout.boxes.map(([x, y, width, height]) => [1 - x - width, y, width, height] as Box)
  made.push(makeTemplate(`ref-edge-${layout.key}-mirror`, `${layout.name} Mirrored`, mirrored))
  return made
})
