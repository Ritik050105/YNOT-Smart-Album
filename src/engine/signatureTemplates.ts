import { TemplateDefinition, PlaceholderRect } from '@/types'

/** A curated set of spread layouts, written by hand rather than generated.
 *
 *  The generated families cover every arrangement that fits; this is the short list a designer
 *  would actually reach for first. The rules behind them:
 *
 *  - **Nothing crosses the fold.** A face on the gutter is a face folded in half, so every frame
 *    lives on one page. The only exception is a deliberate full-bleed spread.
 *  - **Frames are photo-shaped.** Everything here sits between 2:3 and 2:1, the range real
 *    photographs come in, so no frame asks for a crop the picture cannot give.
 *  - **Each layout mixes shapes.** A spread of mixed portrait and landscape photos needs somewhere
 *    for both, so most of these offer a square or two alongside the uprights and the wides.
 *  - **The margin is generous and even.** Album pages breathe; the white around a photo is part of
 *    the design, not what is left over.
 *  - **Weight is deliberate, and mirrored.** Every asymmetric layout exists both ways round, so a
 *    run of spreads can alternate instead of leaning the same way page after page.
 *
 *  Coordinates below are PAGE-LOCAL — 0-1 across one page, 0-1 down it — and `page()` maps them
 *  onto the spread. On the square album sizes this app ships (a spread twice as wide as it is
 *  tall) a page-local box's width divided by its height is exactly the photo proportion it wants,
 *  which is why these read as plain aspect ratios: 0.67 is an upright, 1.0 a square, 1.5 a wide. */

type Box = [x: number, y: number, width: number, height: number]
type Side = 'left' | 'right'
interface Layout {
  key: string
  name: string
  /** Boxes per page. A page with none is left empty on purpose. */
  left: Box[]
  right: Box[]
  /** Both pages as one picture, ignoring the page split. */
  bleed?: boolean
  /** Asymmetric layouts are generated both ways round; symmetric ones are their own mirror. */
  symmetric?: boolean
}

/** Page-local box to spread coordinates. */
function page(side: Side, [x, y, width, height]: Box): Box {
  return [side === 'left' ? x * 0.5 : 0.5 + x * 0.5, y, width * 0.5, height]
}

// Shapes used below, as page-local width/height. Named so the layouts read as compositions rather
// than as arithmetic.
const UPRIGHT = 0.67, SQUARE = 1, WIDE = 1.5

/** A box of a given shape, centred at (cx, cy) page-local, `height` tall. */
function shaped(cx: number, cy: number, height: number, shape: number): Box {
  const width = height * shape
  return [cx - width / 2, cy - height / 2, width, height]
}

/** Evenly spaced boxes stacked down a page, all the same shape. */
function stack(count: number, cx: number, top: number, bottom: number, shape: number, gap = 0.04): Box[] {
  const height = (bottom - top - gap * (count - 1)) / count
  return Array.from({ length: count }, (_, i) => shaped(cx, top + height / 2 + i * (height + gap), height, shape))
}

/** A row of boxes across a page, all the same shape. */
function row(count: number, cy: number, left: number, right: number, shape: number, gap = 0.04): Box[] {
  const width = (right - left - gap * (count - 1)) / count
  const height = width / shape
  return Array.from({ length: count }, (_, i) => [left + i * (width + gap), cy - height / 2, width, height] as Box)
}

/** A grid of squares filling a page's working area. */
function grid(cols: number, rows: number, left: number, top: number, right: number, bottom: number, gap = 0.04): Box[] {
  const width = (right - left - gap * (cols - 1)) / cols
  const height = (bottom - top - gap * (rows - 1)) / rows
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) =>
    [left + c * (width + gap), top + r * (height + gap), width, height] as Box)).flat()
}

const LAYOUTS: Layout[] = [
  // --- One photo ------------------------------------------------------------------------------
  // No full-bleed single here: the library already carries that spread, and repeating it would
  // only give the browser the same card twice.
  { key: 'solo-statement', name: 'Single · Statement', left: [], right: [shaped(0.5, 0.5, 0.7, SQUARE)] },
  { key: 'solo-upright', name: 'Single · Upright', left: [], right: [shaped(0.5, 0.5, 0.78, UPRIGHT)] },

  // --- Two ------------------------------------------------------------------------------------
  { key: 'facing-squares', name: 'Two · Facing', left: [shaped(0.5, 0.5, 0.66, SQUARE)], right: [shaped(0.5, 0.5, 0.66, SQUARE)], symmetric: true },
  { key: 'facing-uprights', name: 'Two · Facing Uprights', left: [shaped(0.5, 0.5, 0.78, UPRIGHT)], right: [shaped(0.5, 0.5, 0.78, UPRIGHT)], symmetric: true },
  { key: 'pair-together', name: 'Two · Together', left: [], right: row(2, 0.5, 0.08, 0.92, UPRIGHT) },
  { key: 'wide-over-wide', name: 'Two · Stacked Wides', left: [], right: stack(2, 0.5, 0.12, 0.88, WIDE) },

  // --- Three ----------------------------------------------------------------------------------
  { key: 'hero-two-wides', name: 'Three · Hero and Pair', left: [shaped(0.5, 0.5, 0.7, SQUARE)], right: stack(2, 0.5, 0.12, 0.88, WIDE) },
  { key: 'hero-two-uprights', name: 'Three · Hero and Uprights', left: [shaped(0.5, 0.5, 0.78, UPRIGHT)], right: row(2, 0.5, 0.12, 0.88, UPRIGHT) },
  { key: 'triptych-split', name: 'Three · One and Two', left: [shaped(0.5, 0.5, 0.62, SQUARE)], right: stack(2, 0.5, 0.16, 0.84, SQUARE) },

  // --- Four -----------------------------------------------------------------------------------
  { key: 'quad-facing', name: 'Four · Two by Two', left: stack(2, 0.5, 0.12, 0.88, WIDE), right: stack(2, 0.5, 0.12, 0.88, WIDE), symmetric: true },
  { key: 'hero-trio', name: 'Four · Hero and Three', left: [shaped(0.5, 0.5, 0.74, SQUARE)], right: stack(3, 0.5, 0.08, 0.92, WIDE, 0.03) },
  { key: 'quad-grid', name: 'Four · Quiet Grid', left: [], right: grid(2, 2, 0.08, 0.14, 0.92, 0.86) },
  { key: 'upright-and-three', name: 'Four · Upright and Details', left: [shaped(0.5, 0.5, 0.8, UPRIGHT)], right: stack(3, 0.5, 0.1, 0.9, SQUARE, 0.03) },

  // --- Five -----------------------------------------------------------------------------------
  { key: 'hero-quad', name: 'Five · Hero and Four', left: [shaped(0.5, 0.5, 0.78, UPRIGHT)], right: grid(2, 2, 0.1, 0.16, 0.9, 0.84) },
  { key: 'two-and-three', name: 'Five · Two and Three', left: stack(2, 0.5, 0.14, 0.86, SQUARE), right: stack(3, 0.5, 0.08, 0.92, WIDE, 0.03) },
  { key: 'wide-and-row', name: 'Five · Wide and Row', left: [shaped(0.5, 0.5, 0.46, WIDE)], right: grid(2, 2, 0.1, 0.16, 0.9, 0.84) },

  // --- Six ------------------------------------------------------------------------------------
  { key: 'six-facing', name: 'Six · Three and Three', left: stack(3, 0.5, 0.08, 0.92, WIDE, 0.03), right: stack(3, 0.5, 0.08, 0.92, WIDE, 0.03), symmetric: true },
  { key: 'hero-and-five', name: 'Six · Hero and Five', left: [shaped(0.5, 0.5, 0.76, SQUARE)], right: [...row(2, 0.28, 0.1, 0.9, SQUARE), ...row(3, 0.72, 0.08, 0.92, SQUARE, 0.03)] },
  // A wide over two squares, repeated on both pages: three to a page without the column of
  // letterboxes that stacking three the full width of a page would give.
  { key: 'six-crowned', name: 'Six · Wide over Pair',
    left: [shaped(0.5, 0.26, 0.3, WIDE), ...row(2, 0.68, 0.275, 0.725, SQUARE)],
    right: [shaped(0.5, 0.26, 0.3, WIDE), ...row(2, 0.68, 0.275, 0.725, SQUARE)], symmetric: true },

  // --- Seven and eight ------------------------------------------------------------------------
  { key: 'hero-and-six', name: 'Seven · Hero and Six', left: [shaped(0.5, 0.5, 0.78, UPRIGHT)], right: grid(2, 3, 0.08, 0.08, 0.92, 0.92, 0.03) },
  { key: 'eight-grid', name: 'Eight · Facing Grids', left: grid(2, 2, 0.1, 0.16, 0.9, 0.84), right: grid(2, 2, 0.1, 0.16, 0.9, 0.84), symmetric: true },
]

function makeTemplate(id: string, name: string, boxes: Box[], bleed: boolean): TemplateDefinition {
  const placeholders: PlaceholderRect[] = boxes.map(([x, y, width, height], i) => ({
    id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any', ...(bleed ? { bleed: true } : {}),
  }))
  return {
    id, name, photoCount: placeholders.length, pageSide: 'spread', isBuiltIn: true,
    createdAt: new Date(0).toISOString(), thumbnailColor: '#8d7a63', placeholders,
  }
}

/** Every signature layout, asymmetric ones in both directions. */
export const SIGNATURE_TEMPLATES: TemplateDefinition[] = LAYOUTS.flatMap((layout) => {
  if (layout.bleed) return [makeTemplate(`ref-signature-${layout.key}`, layout.name, [[0, 0, 1, 1]], true)]
  const sides: Side[] = layout.symmetric ? ['left'] : ['left', 'right']
  return sides.map((anchor) => {
    // The "anchor" is the page the layout's own left-hand boxes land on; flipping it mirrors the
    // whole composition, and a layout that reads the same both ways is only made once.
    const boxes = anchor === 'left'
      ? [...layout.left.map((b) => page('left', b)), ...layout.right.map((b) => page('right', b))]
      : [...layout.right.map((b) => page('left', b)), ...layout.left.map((b) => page('right', b))]
    const suffix = layout.symmetric ? '' : anchor === 'left' ? '-left' : '-right'
    const label = layout.symmetric ? layout.name : `${layout.name} ${anchor === 'left' ? 'Left' : 'Right'}`
    return makeTemplate(`ref-signature-${layout.key}${suffix}`, label, boxes, false)
  })
})
