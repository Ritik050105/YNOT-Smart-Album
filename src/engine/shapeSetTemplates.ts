import { MAX_PHOTOS_PER_SPREAD } from "./spreadLimits"
import { TemplateDefinition, PlaceholderRect } from '@/types'

/** A layout for every mix of upright and landscape photographs.
 *
 *  The rest of the library is a collection of designs, and what it covers is whatever those
 *  designs happen to cover. On a square sheet that turned out to be almost everything; on a
 *  portrait album it left real gaps — five landscapes and one upright had nowhere to go at all,
 *  so the browser offered layouts that cropped half of them and the drop took the first one.
 *
 *  This family exists to make that impossible. For each album shape and each split of a photo
 *  count into landscapes and uprights, it emits one layout with exactly that many landscape
 *  frames and that many upright frames. It is the floor under the library, not a shelf anyone
 *  browses for pleasure: a plain block of each shape, centred, with paper around it.
 *
 *  A template's coordinates mean different shapes on different albums — a frame is landscape when
 *  `width / height * aspect` is over 1.15 — so one set is generated per album shape the app
 *  offers. The ones that do not apply to the album in hand are filtered out by the browsers'
 *  own shape rule, exactly as they are for every other family. */

type Box = [x: number, y: number, width: number, height: number]

/** The album shapes the size presets produce, as width / height of the whole spread. */
const ASPECTS = [0.75, 0.8, 1, 1.25, 1.33, 1.5]

/** Comfortably inside the shape rule's 1.15 deadband, so rounding never tips a frame the wrong
 *  way on an album whose proportions sit between two of the shapes above. */
const LANDSCAPE = 1.45, UPRIGHT = 0.69

/** Rows to break `n` frames into, so the block stays close to square overall. */
function rowsFor(n: number, cellRatio: number): number {
  let best = 1, bestScore = Infinity
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows)
    if (rows * cols - n >= cols) continue
    const score = Math.abs(Math.log((cols * cellRatio) / rows))
    if (score < bestScore) { bestScore = score; best = rows }
  }
  return best
}

/** A block of `n` cells of the given shape, in units where one cell is one unit tall. */
function block(n: number, cellRatio: number) {
  const rows = rowsFor(n, cellRatio)
  const cols = Math.ceil(n / rows)
  return { rows, cols, width: cols * cellRatio, height: rows }
}

/** The two blocks stacked, scaled together to fit the sheet with a margin of paper around them. */
function layout(landscapes: number, uprights: number, aspect: number): Box[] | null {
  // Cell shapes in fraction space: a frame reads as `width / height * aspect`.
  const wide = LANDSCAPE / aspect, tall = UPRIGHT / aspect
  const blocks = [
    landscapes > 0 ? { ...block(landscapes, wide), cell: wide, count: landscapes } : null,
    uprights > 0 ? { ...block(uprights, tall), cell: tall, count: uprights } : null,
  ].filter((b): b is NonNullable<typeof b> => !!b)
  if (!blocks.length) return null

  // The two blocks meet on a shared edge rather than floating apart. A built-in layout is only
  // offered if the album's gap can be applied uniformly across it, and a seam of any other size
  // fails that — the family would be generated and then never shown, which is the trap the
  // bleeding family fell into.
  const GUTTER = 0
  const totalHeight = blocks.reduce((sum, b) => sum + b.height, 0) + (blocks.length - 1) * GUTTER
  const widest = Math.max(...blocks.map((b) => b.width))
  // One scale for both blocks, so a landscape cell and an upright cell stay the same height and
  // the page reads as one composition rather than two unrelated grids.
  const scale = Math.min(0.9 / widest, 0.9 / totalHeight)
  if (!Number.isFinite(scale) || scale <= 0) return null

  const boxes: Box[] = []
  let y = (1 - totalHeight * scale) / 2
  for (const b of blocks) {
    const cellW = b.cell * scale, cellH = scale
    for (let i = 0; i < b.count; i++) {
      const row = Math.floor(i / b.cols), col = i % b.cols
      // The last row is centred under the others rather than left-aligned with a hole beside it.
      const inRow = Math.min(b.cols, b.count - row * b.cols)
      const rowLeft = (1 - inRow * cellW) / 2
      boxes.push([rowLeft + col * cellW, y + row * cellH, cellW, cellH])
    }
    y += b.height * scale + GUTTER * scale
  }
  return boxes.every(([x, by, w, h]) => x >= -1e-9 && by >= -1e-9 && x + w <= 1 + 1e-9 && by + h <= 1 + 1e-9)
    ? boxes : null
}

const MAX_PHOTOS = MAX_PHOTOS_PER_SPREAD

export const SHAPE_SET_TEMPLATES: TemplateDefinition[] = (() => {
  const out: TemplateDefinition[] = []
  for (const aspect of ASPECTS) {
    const tag = String(aspect).replace('.', '')
    for (let count = 2; count <= MAX_PHOTOS; count++) {
      for (let landscapes = 0; landscapes <= count; landscapes++) {
        // All of one shape is what the rest of the library is full of; this family is here for
        // the mixes it has no answer for.
        if (landscapes === 0 || landscapes === count) continue
        const boxes = layout(landscapes, count - landscapes, aspect)
        if (!boxes) continue
        const id = `ref-shapeset-${tag}-${landscapes}l${count - landscapes}p`
        out.push({
          id,
          name: `Shapes · ${landscapes} Wide and ${count - landscapes} Upright`,
          photoCount: count,
          pageSide: 'spread',
          isBuiltIn: true,
          createdAt: new Date(0).toISOString(),
          thumbnailColor: '#5e6368',
          placeholders: boxes.map(([x, y, width, height], i): PlaceholderRect => ({
            id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any',
          })),
        })
      }
    }
  }
  return out
})()
