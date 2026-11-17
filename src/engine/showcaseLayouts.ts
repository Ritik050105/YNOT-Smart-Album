import { PlaceholderRect, TemplateDefinition } from '@/types'
import { Box, KEY_SCALE, balancedForSequence, fitForRatios, inOrderShapes, keyFor, kindsOfCode, ratioCode, ratiosFromCode } from './balancedLayouts'
import { patternClass } from './patternClass'
import { MAX_PHOTOS_PER_SPREAD } from './spreadLimits'

/** Page layouts: pictures kept to one page, or split between the two, never across the fold.
 *
 *  Each page is its own tiling, drawn for the photographs that go on it, so the album's gap is the only spacing between frames
 *  and every frame has its photograph's own proportion (or as near as a tiling allows). A page is either filled to the album's
 *  margin or held as a slightly smaller block of the same proportion with white round it. All the photographs may go on the
 *  left page, all on the right, or they are shared out between the two, the left page first. One photograph on a page can sit
 *  centred, or nearer the outer or inner edge, or high or low, with the page's white round it.
 *
 *  The photographs are taken in their own order (the first one in the first frame from the left). Ids carry the album shape, the
 *  count, the photographs' proportions and the variant, and `showcaseFromId` rebuilds any of them. */

const RATIO = [1.5, 2 / 3, 1]
const shapeKind = (ratio: number) => ratio > 1.15 ? 0 : ratio < 1 / 1.15 ? 1 : 2

/** `bleed` lists the frames that run to the trim; `moved` marks a layout drawn for the photographs in another order (one picked out to fill a
 *  page), which only the rearranging browser row can use. */
export type Mode = 'full' | 'fill' | 'loose'
interface Variant { key: string; name: string; boxes: Box[]; bleed?: number[]; moved?: boolean }

/** How a layout is named: what goes where, in the words a designer uses. A page is "full" (the photographs run to the trim), "fill" (they fill the
 *  page to the album's margin) or neither (they sit on the page with white round them, so the page is just named). */
export const photosWord = (m: number) => `${m} photo${m === 1 ? '' : 's'}`
export const modeWord = (mode: Mode) => mode === 'full' ? 'full ' : mode === 'fill' ? 'fill ' : ''

/** Up to this many photographs a layout may lay one across the fold (a big picture running over the middle of the spread, with the line
 *  drawn through it): with so few pictures the fold is part of the composition. More than this and nothing may cross it. */
export const FOLD_FREE_COUNT = 4

/** Whether any frame lies across the fold (the line down the middle of the spread, where the two pages meet). */
export const crossesFold = (frames: { x: number; width: number }[]) => frames.some(f => f.x < 0.497 && f.x + f.width > 0.503)

/** The white round a block of pictures on a page, in units of the spread's height, the same on all four sides: none (the page is filled
 *  to the album's own margin) or a little more. Even on every side, so the block keeps the page's proportion and sits in the middle of it. */
const PAGE_MARGINS: [name: string, margin: number, tag: string][] = [['Full Page', 0, 'F'], ['Inset Page', 0.07, 'I'], ['Wide Margin Page', 0.13, 'W'], ['Narrow Margin Page', 0.035, 'N'], ['Medium Margin Page', 0.1, 'M'], ['Deep Margin Page', 0.16, 'D'],
  // Finer steps of the same equal white, so a combination has as many templates as it is asked for without a floating or a tiny frame among them.
  ['Margin 02 Page', 0.02, 'a'], ['Margin 05 Page', 0.05, 'b'], ['Margin 085 Page', 0.085, 'c'], ['Margin 115 Page', 0.115, 'd'], ['Margin 145 Page', 0.145, 'e'], ['Margin 18 Page', 0.18, 'f'], ['Margin 21 Page', 0.21, 'g'], ['Margin 24 Page', 0.24, 'h']]
/** The margins tried for a page of this many photographs: a big set is searched for fewer shapes of page, or generating them all would take long. */
const marginsFor = (count: number, aspect: number) => PAGE_MARGINS.filter(([, m], i) => 0.5 - (2 * m) / aspect >= 0.2 && (count <= 4 || i < (count <= 6 ? 6 : 2)))

/** The ways to lay these photographs (in order) out in a block of this shape, as boxes in the block (0-1 each way), one of each kind
 *  of arrangement first. Layouts drawn for the photographs' own proportions come first, then those drawn for their shapes. */
const blockCache = new Map<string, Box[][]>()
function blockLayouts(ratios: number[], blockAspect: number, limit: number): Box[][] {
  // The same photographs in a block of the same shape come up again for the other page, the other margins and the other splits.
  // The block's shape to a twentieth: a few per cent of shape does not change what a tiling looks like, and a margin of a few more per cent would
  // otherwise be a whole new search.
  if (ratios.length === 1) return makeBlockLayouts(ratios, blockAspect, limit)
  blockAspect = Math.max(0.05, Math.round(blockAspect * 20) / 20)
  const key = `${ratios.map(r => r.toFixed(3)).join(',')}|${blockAspect.toFixed(4)}|${limit}`, hit = blockCache.get(key)
  if (hit) return hit
  const made = makeBlockLayouts(ratios, blockAspect, limit)
  if (blockCache.size > 4000) blockCache.clear()
  blockCache.set(key, made)
  return made
}
function makeBlockLayouts(ratios: number[], blockAspect: number, limit: number): Box[][] {
  if (ratios.length === 1) {
    const r = ratios[0], w = r >= blockAspect ? 1 : r / blockAspect, h = r >= blockAspect ? blockAspect / r : 1
    return [[[(1 - w) / 2, (1 - h) / 2, w, h]]]
  }
  const ordinary = (t: TemplateDefinition) => t.placeholders.every(p => { const ratio = (p.width * blockAspect) / p.height; return ratio <= 2.4 && ratio >= 1 / 2.4 })
  const fitted = fitForRatios(ratios, blockAspect, 8).filter(ordinary)
  // The shape-based search is only for when the fitted one found too few to choose from (it costs about as much again).
  const shaped = fitted.length >= Math.min(limit, 4) ? [] : balancedForSequence(ratios.map(shapeKind), blockAspect, 8).filter(ordinary)
  const groups = new Map<string, TemplateDefinition[]>()
  for (const t of [...fitted, ...shaped]) { const k = patternClass(t), g = groups.get(k); if (g) g.push(t); else groups.set(k, [t]) }
  const picks: TemplateDefinition[] = []
  for (let depth = 0; picks.length < limit && depth < 6; depth++) for (const g of groups.values()) if (g[depth] && picks.length < limit) picks.push(g[depth])
  return picks.map(t => t.placeholders.map((p): Box => [p.x, p.y, p.width, p.height]))
}

/** A finer reading of where a layout's edges fall than the library's own (a twenty-fifth of the page), so that one picture set a few
 *  per cent nearer an edge of a narrow page is still told from the same picture set centrally. */
const finerLook = (boxes: Box[]) => boxes.map(([x, y, w, h]) => [x, y, x + w, y + h].map(v => Math.round(v * 40)).join(',')).sort().join('|')

function pageVariants(ratios: number[], aspect: number): Variant[] {
  const n = ratios.length, out: Variant[] = []
  /** A block of the spread on one page, with this white round it: where it starts and how big it is, in the spread's own 0-1 units. */
  /** The inset page's white round the block, kept to a tenth of the page's width on a narrow page (a tall album's page is a strip, and 7% of its height eats most of it). */
  const insetMargin = Math.min(PAGE_MARGINS[1][1], 0.12 * aspect)
  const block = (page: 0 | 1, margin: number) => ({ x: page * 0.5 + margin / aspect, y: margin, w: 0.5 - (2 * margin) / aspect, h: 1 - 2 * margin })
  const aspectOf = (b: { w: number; h: number }) => (b.w * aspect) / b.h
  const into = (b: { x: number; y: number; w: number; h: number }, sub: Box[]): Box[] => sub.map(([x, y, w, h]): Box => [b.x + x * b.w, b.y + y * b.h, w * b.w, h * b.h])
  // The smallest frame a layout may have: a big set on one spread has small frames, and is judged by what its frames can be.
  const floor = n > 12 ? 0.045 : n > 8 ? 0.07 : 0.1
  const fits = (boxes: Box[], smallest = floor) => boxes.every(([, , w, h]) => Math.min(w * aspect, h) >= smallest && (w * aspect) / h <= 2.4 && (w * aspect) / h >= 0.42)
  /** Every way to set these photographs on one page, as boxes in the spread. One photograph can fill the page, be held inset, or be smaller
   *  (two sizes) and set in the middle, at an edge or in a corner of the inset page (anchors run from the inner edge to the outer one and from the
   *  top to the bottom); more than one are tiled, filling the page or held inset. */
  type Option = { key: string; boxes: Box[]; bleed?: boolean; mode: Mode }
  const options = (sub: number[], page: 0 | 1, limit: number): Option[] => {
    const list: Option[] = []
    if (sub.length === 1) {
      for (const [name, margin] of marginsFor(sub.length, aspect)) { const b = block(page, margin); list.push({ key: name.replace(/ /g, ''), boxes: into(b, blockLayouts(sub, aspectOf(b), 1)[0]), mode: margin === 0 ? 'fill' : 'loose' }) }
      // The page edge to edge, to the trim.
      if (0.5 * aspect >= 0.42) list.push({ key: 'Bleed', boxes: [[page * 0.5, 0, 0.5, 1]], bleed: true, mode: 'full' })
      // A single photograph on a narrow page is small whatever is done, so it is only asked not to be a stamp.
      return list.filter(o => fits(o.boxes, Math.min(0.07, 0.15 * aspect)))
    }
    for (const [, margin, tag] of marginsFor(sub.length, aspect)) {
      const b = block(page, margin)
      blockLayouts(sub, aspectOf(b), limit).forEach((l, i) => {
        const boxes = into(b, l)
        if (!fits(boxes)) return
        list.push({ key: `${tag}${i}`, boxes, mode: margin === 0 ? 'fill' : 'loose' })
        // The same tiling run to the trim, the frames flush: the page "full".
        if (margin === 0) list.push({ key: `B${i}`, boxes, bleed: true, mode: 'full' })
      })
    }
    // The set in a block of its own natural proportion (a row, a column, or between), centred on the page with the same white at both sides and above and
    // below: a wide and a tall photograph side by side, say, make a block far wider than a square page, so they are set in a band across it.
    if (sub.length <= 6) {
      const row = sub.reduce((s, r) => s + r, 0), column = 1 / sub.reduce((s, r) => s + 1 / r, 0), shapes = [row, column, Math.sqrt(row * column)].filter((A, i, all) => all.findIndex(B => Math.abs(B - A) < 0.1 * A) === i)
      for (const A of shapes) for (const e of [0.02, 0.06, 0.1]) {
        const w = Math.min(((1 - 2 * e) * A) / aspect, 0.5 - (2 * e) / aspect), h = (w * aspect) / A
        if (w <= 0 || h <= 0 || h > 1 - 2 * e + 1e-9) continue
        const b = { x: page * 0.5 + (0.5 - w) / 2, y: (1 - h) / 2, w, h }
        blockLayouts(sub, A, 2).forEach((l, i) => { const boxes = into(b, l); if (fits(boxes)) list.push({ key: `c${Math.round(A * 100)}e${Math.round(e * 100)}-${i}`, boxes, mode: 'loose' }) })
      }
    }
    return list
  }
  // One photograph can also run to the trim: the whole spread, or a whole page, edge to edge, or the spread held to the album's margin.
  if (n === 1) {
    out.push({ key: 'spreadBleed', name: '1 photo full spread', boxes: [[0, 0, 1, 1]], bleed: [0] }, { key: 'spreadMargin', name: '1 photo fill spread', boxes: [[0, 0, 1, 1]] })
    // The photograph on the spread with the same white round it on every side (the album's own margin, then a few wider ones), in the middle, across the
    // fold. (It is the photograph's shape, so a photograph that does not suit the spread's shape has the same white above and below, and at the two sides.)
    for (const e of [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.16, 0.18, 0.2]) {
      const b = { x: e / aspect, y: e, w: 1 - (2 * e) / aspect, h: 1 - 2 * e }
      out.push({ key: `spInset${Math.round(e * 100)}`, name: '1 photo spread', boxes: into(b, blockLayouts(ratios, aspectOf(b), 1)[0]) })
    }
    // (A page this narrow is a strip, which no layout is.)
    if (0.5 * aspect >= 0.42) for (const page of [0, 1] as const) out.push({ key: `pg${page ? 'R' : 'L'}Bleed`, name: `1 photo full ${page ? 'right' : 'left'}`, boxes: [[page * 0.5, 0, 0.5, 1]], bleed: [0] })
    // The photograph in a frame as tall as the spread (to the trim, "full", or to the album's margin, "fill") and as wide as a square, or as its own shape, or
    // between: at the left edge, in the middle of the left page, at the fold, in the middle of the right page or at the right edge. Squared frames also sit
    // centred, a little smaller, on a page or on the spread. Every frame suits the photograph's shape (a landscape one is never given a tall frame).
    const r = ratios[0], kind = shapeKind(r)
    const frameRatios = (kind === 2 ? [r] : [0, 0.25, 0.5, 0.75, 1].map(t => (kind === 0 ? 1 + (r - 1) * t : r + (1 - r) * t))).filter((v, i, all) => all.findIndex(u => Math.abs(u - v) < 0.04) === i)
    const POSITIONS: [name: string, at: (w: number) => number][] = [['far left', () => 0], ['left', w => (0.5 - w) / 2], ['inner left', w => 0.5 - w], ['centre', w => 0.5 - w / 2], ['inner right', () => 0.5], ['right', w => 0.5 + (0.5 - w) / 2], ['far right', w => 1 - w]]
    for (const rho of frameRatios) {
      const w = rho / aspect, word = Math.abs(rho - 1) < 0.04 ? 'squared' : 'frame'
      if (w > 1 || w < 0.1) continue
      const spots = w <= 0.5 ? POSITIONS : POSITIONS.filter(([name]) => ['far left', 'centre', 'far right'].includes(name))
      for (const [name, at] of spots) for (const mode of ['full', 'fill'] as const) out.push({ key: `col${Math.round(rho * 100)}${name.replace(' ', '')}${mode}`, name: `1 photo ${mode} ${word} ${name}`, boxes: [[at(w), 0, w, 1]], ...(mode === 'full' ? { bleed: [0] } : {}) })
    }
    if (kind !== 2 || Math.abs(r - 1) < 0.04) for (const h of [0.92, 0.84, 0.76, 0.68]) {
      const w = h / aspect
      if (w > 0.5 - 0.02 / aspect) continue
      for (const [name, at] of [['left', (0.5 - w) / 2], ['right', 0.5 + (0.5 - w) / 2], ['spread', 0.5 - w / 2]] as [string, number][]) out.push({ key: `sqc${Math.round(h * 100)}${name}`, name: `1 photo squared ${name}`, boxes: [[at, (1 - h) / 2, w, h]] })
    }
  }
  // The set in a block of its own proportions (tall to wide) or as a grid of squares, set in the spread or on either page with the same white on the
  // sides that matter: on a page the block is as tall as the page allows less a margin at the top and the bottom, and sits that margin from the page's outer
  // edge (the white above, below and outside is equal, whatever the block's shape); on the spread it is centred with that margin above and below. Every
  // arrangement of the photographs' own shapes is a tiling of some block, so this gives layouts on an album of any shape (a tall one included).
  const nested = (A: number, where: 'Spread' | 'Left' | 'Right', e: number) => {
    const span = where === 'Spread' ? 1 : 0.5, x0 = where === 'Right' ? 0.5 : 0
    const h = 1 - 2 * e, w = (h * A) / aspect, room = span - (where === 'Spread' ? (2 * e) / aspect : e / aspect)
    if (h <= 0 || w > room + 1e-9) return null
    return { x: where === 'Spread' ? x0 + (span - w) / 2 : where === 'Left' ? x0 + e / aspect : x0 + span - e / aspect - w, y: e, w, h }
  }
  const addNested = () => {
  if (n >= 1 && n <= 24) {
    const shapes: { key: string; A: number; layouts: Box[][] }[] = []
    // A single photograph is its own block: the frame is the photograph's shape.
    if (n === 1) shapes.push({ key: 'nb1', A: ratios[0], layouts: [[[0, 0, 1, 1]]] })
    else for (const A of n > 12 ? [0.6, 1, 1.7] : n <= 4 ? [0.4, 0.5, 0.6, 0.7, 0.85, 1, 1.2, 1.4, 1.7, 2, 2.5] : [0.4, 0.6, 0.85, 1.2, 1.7, 2.5]) { const layouts = blockLayouts(ratios, A, 2); if (layouts.length) shapes.push({ key: `nb${Math.round(A * 100)}`, A, layouts }) }
    // Squares: every way of making n from rows and columns, each a grid of unit squares in a block of the proportion columns to rows.
    if (n <= 12) for (let rows = 1; rows <= n; rows++) if (!(n % rows)) { const cols = n / rows, grid: Box[] = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid.push([c / cols, r / rows, 1 / cols, 1 / rows]); shapes.push({ key: `sq${rows}x${cols}`, A: cols / rows, layouts: [grid] }) }
    for (const shape of shapes) for (const where of ['Spread', 'Left', 'Right'] as const) for (const e of n <= 4 ? [0.02, 0.03, 0.045, 0.06, 0.08, 0.1, 0.12, 0.14, 0.17, 0.2, 0.23] : [0.02, 0.03, 0.045, 0.06, 0.08, 0.1, 0.12, 0.14]) {
      const b = nested(shape.A, where, e); if (!b) continue
      shape.layouts.forEach((l, i) => { const boxes = into(b, l); if (fits(boxes)) out.push({ key: `${shape.key}${where[0]}${Math.round(e * 100)}-${i}`, name: `${photosWord(n)} ${shape.key.startsWith('sq') ? 'squares' : 'block'} ${where.toLowerCase()}`, boxes }) })
    }
  }
  }
  // Everything on one page, either page.
  const PER = n > 8 ? 2 : 3
  for (const page of [0, 1] as const) {
    const taken: Record<Mode, number> = { full: 0, fill: 0, loose: 0 }
    for (const o of options(ratios, page, n > 8 ? 6 : 8)) {
      if (n === 1 && o.bleed) continue
      // Up to a few of each kind, but every kind (full, fill, loose); a single photograph keeps all of its spots.
      if (n > 1 && taken[o.mode] >= (o.mode === 'loose' ? PER * 3 : PER)) continue
      taken[o.mode]++
      out.push({ key: `pg${page ? 'R' : 'L'}${o.key}`, name: `${photosWord(n)} ${modeWord(o.mode)}${page ? 'right' : 'left'}`, boxes: o.boxes, ...(o.bleed ? { bleed: o.boxes.map((_, q) => q) } : {}) })
    }
  }
  if (n === 1) {
    addNested()
    // The classic single-photograph templates lead, in the order a designer lists them; the columns and the squares follow.
    const lead = ['1 photo full spread', '1 photo fill spread', '1 photo full right', '1 photo fill right', '1 photo full left', '1 photo fill left', '1 photo right', '1 photo left', '1 photo spread', '1 photo squared spread', '1 photo squared right', '1 photo squared left']
    const rank = (v: Variant) => { const i = lead.indexOf(v.name); return i < 0 ? lead.length : i }
    return out.map((v, i) => ({ v, i })).sort((x, y) => rank(x.v) - rank(y.v) || x.i - y.i).map(x => x.v)
  }
  // Split between the two pages, near the middle first (every split for a short set, a few for a long one).
  const mid = Math.floor(n / 2), order = Array.from({ length: n - 1 }, (_, i) => i + 1).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q)
  const splits = new Set(order.slice(0, n > 12 ? 10 : n - 1))
  // A whole page given to the first photograph, or to the last, is always among them.
  splits.add(1); splits.add(n - 1)
  for (const k of splits) {
    const left = options(ratios.slice(0, k), 0, n > 8 ? 6 : 5), right = options(ratios.slice(k), 1, n > 8 ? 6 : 5)
    if (!left.length || !right.length) continue
    // Every pairing of how the left page is set and how the right page is (full, fill or neither), a few arrangements of each.
    for (const ml of ['full', 'fill', 'loose'] as const) for (const mr of ['full', 'fill', 'loose'] as const) {
      const A = left.filter(o => o.mode === ml), B = right.filter(o => o.mode === mr)
      if (!A.length || !B.length) continue
      const seenPair = new Set<string>()
      for (let t = 0; t < PER * (ml === 'loose' || mr === 'loose' ? 3 : 1) && seenPair.size < PER * (ml === 'loose' || mr === 'loose' ? 3 : 1); t++) {
        const a = A[t % A.length], b = B[(t * 2 + 1) % B.length], id = `${a.key}-${b.key}`
        if (seenPair.has(id)) continue
        seenPair.add(id)
        const boxes = [...a.boxes, ...b.boxes]
        if (!fits(boxes)) continue
        const bleed = [...(a.bleed ? a.boxes.map((_, q) => q) : []), ...(b.bleed ? b.boxes.map((_, q) => a.boxes.length + q) : [])]
        out.push({ key: `pg${k}-${id}`, name: `${photosWord(k)} ${modeWord(ml)}left · ${photosWord(n - k)} ${modeWord(mr)}right`, boxes, ...(bleed.length ? { bleed } : {}) })
      }
    }
  }
  // The same splits for every mix of wide, tall and square photographs, not only the order they came in: any of them may be the one alone on a page, or
  // the few on one page with the rest on the other, on either side. (Photographs go to frames of their own shape wherever they are, so these are for the
  // rearranging shelf; the photographs' own order only fits some of them.)
  if (n >= 2 && n <= 10) {
    const kinds = [0, 1, 2], rep = kinds.map(k => ratios.find(r => shapeKind(r) === k) ?? [1.5, 2 / 3, 1][k])
    const have = kinds.map(k => ratios.filter(r => shapeKind(r) === k).length)
    const listOf = (c: number[]) => c.flatMap((count, k) => Array<number>(count).fill(rep[k]))
    const compositions = (k: number): number[][] => { const out: number[][] = []; for (let a = 0; a <= Math.min(k, have[0]); a++) for (let b = 0; b <= Math.min(k - a, have[1]); b++) { const c = k - a - b; if (c <= have[2]) out.push([a, b, c]) } return out }
    for (const k of new Set((n <= 8 ? [1, 2, 3, n - 3, n - 2, n - 1] : [1, 2, n - 2, n - 1]).filter(q => q >= 1 && q <= n - 1))) for (const a of compositions(k)) for (const side of [0, 1]) {
      if (k * 2 === n && side === 1) continue
      const rest = have.map((c, i) => c - a[i]), leftC = side === 0 ? a : rest, rightC = side === 0 ? rest : a
      const lr = listOf(leftC), rr = listOf(rightC)
      if (!lr.length || !rr.length) continue
      const left = options(lr, 0, 3), right = options(rr, 1, 3)
      if (!left.length || !right.length) continue
      const sig = `${leftC.join('')}_${rightC.join('')}`
      for (const ml of ['full', 'fill', 'loose'] as const) for (const mr of ['full', 'fill', 'loose'] as const) {
        const A = left.filter(o => o.mode === ml), B = right.filter(o => o.mode === mr)
        if (!A.length || !B.length) continue
        const seenPair = new Set<string>()
        for (let t = 0; t < 2 && seenPair.size < 2; t++) {
          const x = A[t % A.length], y = B[(t * 2 + 1) % B.length], id = `${x.key}-${y.key}`
          if (seenPair.has(id)) continue
          seenPair.add(id)
          const boxes = [...x.boxes, ...y.boxes]
          if (!fits(boxes)) continue
          const bleed = [...(x.bleed ? x.boxes.map((_, q) => q) : []), ...(y.bleed ? y.boxes.map((_, q) => x.boxes.length + q) : [])]
          out.push({ key: `mx${sig}-${id}`, name: `${photosWord(lr.length)} ${modeWord(ml)}left · ${photosWord(rr.length)} ${modeWord(mr)}right`, boxes, moved: true, ...(bleed.length ? { bleed } : {}) })
        }
      }
    }
  }
  // The whole set tiled across the whole spread: to the album's margin ("fill") or run to the trim, the frames flush ("full"). Only while the
  // fold may be crossed; with more photographs the pages are laid out one at a time above.
  if (n >= 2 && n <= 12) {
    blockLayouts(ratios, aspect, 6).forEach((l, i) => {
      const boxes = into({ x: 0, y: 0, w: 1, h: 1 }, l)
      out.push({ key: `spFill${i}`, name: `${photosWord(n)} fill spread`, boxes })
      out.push({ key: `spFull${i}`, name: `${photosWord(n)} full spread`, boxes, bleed: boxes.map((_, q) => q) })
    })
  }
  // The whole set tiled in one block across the spread, as tall as the spread or a band of it (nine tenths, four fifths...): each height is a
  // different shape to tile, so these are different arrangements, not the same one resized, and the spread is used to near its edges.
  if (n >= 2 && n <= 12) {
    for (const h of [0.92, 0.82, 0.72, 0.62, 0.52]) {
      const b = { x: 0.03, y: (1 - h) / 2, w: 0.94, h }
      blockLayouts(ratios, aspectOf(b), 4).forEach((l, i) => out.push({ key: `sb${Math.round(h * 100)}-${i}`, name: `${photosWord(n)} spread`, boxes: into(b, l) }))
    }
  }
  addNested()
  // One photograph picked out of the middle of the set to fill a page (a whole upright page, say), the rest tiled on the other page. The
  // photographs are then in another order than the timeline's, so these are for the rearranging row only.
  if (n >= 3 && n <= 8) {
    const seenKinds = new Set<string>()
    for (let j = 1; j < n - 1; j++) for (const page of [0, 1] as const) {
      const kindKey = `${page}${shapeKind(ratios[j])}`
      if (seenKinds.has(kindKey)) continue
      seenKinds.add(kindKey)
      const others = ratios.filter((_, q) => q !== j)
      const feature = options([ratios[j]], page, 1), rest = options(others, page === 0 ? 1 : 0, 5)
      if (!feature.length || !rest.length) continue
      let made = 0
      for (let i = 0; i < feature.length && made < 24; i++) for (const q of [i, i + 2]) {
        const r = rest[q % rest.length], boxes = page === 0 ? [...feature[i].boxes, ...r.boxes] : [...r.boxes, ...feature[i].boxes]
        if (made >= 24 || !fits(boxes, 0.07)) continue
        const at = page === 0 ? 0 : r.boxes.length
        out.push({ key: `f${j}${page ? 'R' : 'L'}-${feature[i].key}-${r.key}`, name: `${photosWord(1)} ${modeWord(feature[i].mode)}${page ? 'right' : 'left'} · ${photosWord(n - 1)} ${modeWord(r.mode)}${page ? 'left' : 'right'} (rearranged)`, boxes, moved: true, ...(feature[i].bleed ? { bleed: [at] } : {}) }); made++
      }
    }
  }
  return out
}

/** Whether a layout's white space is even and its frames are not small for the page they are on. Each group of frames (the left page's, the right page's, or
 *  all of them when one crosses the fold) must cover at least 30% of its page or spread; on a page the white above and below the group, and on its outer
 *  side, must be equal (the inner side, at the fold, is free); on the spread the white above and below must be equal, and at the two sides. Frames
 *  that run to the trim or to the album's margin have none, which is equal. */
export function balancedWhite(boxes: Box[], aspect: number, tolerance = 0.03): boolean {
  const left = boxes.filter(b => b[0] + b[2] <= 0.5 + 1e-6), right = boxes.filter(b => b[0] >= 0.5 - 1e-6)
  const crossing = boxes.length - left.length - right.length > 0
  const groups: { frames: Box[]; from: number; to: number; page: 'L' | 'R' | 'S' }[] = crossing ? [{ frames: boxes, from: 0, to: 1, page: 'S' }] : []
  if (!crossing) { if (left.length) groups.push({ frames: left, from: 0, to: 0.5, page: 'L' }); if (right.length) groups.push({ frames: right, from: 0.5, to: 1, page: 'R' }) }
  for (const { frames, from, to, page } of groups) {
    const x0 = Math.min(...frames.map(b => b[0])), x1 = Math.max(...frames.map(b => b[0] + b[2])), y0 = Math.min(...frames.map(b => b[1])), y1 = Math.max(...frames.map(b => b[1] + b[3]))
    if (frames.reduce((sum, b) => sum + b[2] * b[3], 0) < 0.3 * (to - from) - 1e-9) return false
    const top = y0, bottom = 1 - y1, lm = (x0 - from) * aspect, rm = (to - x1) * aspect
    if (Math.abs(top - bottom) > tolerance) return false
    // A single frame as tall as the spread, at the left, in the middle or at the right, has no white above or below to be unequal: it is a column, not a
    // floating picture, and (with the 30% cover above) no stamp.
    if (frames.length === 1 && top <= 0.02 && bottom <= 0.02) continue
    if (page === 'S') { if (Math.abs(lm - rm) > tolerance) return false; continue }
    const outer = page === 'L' ? lm : rm, inner = page === 'L' ? rm : lm
    // Either the white above, below and outside is equal, or the group is centred on its page (the same white at both sides and so the same above and
    // below) (with the 30% cover above, so it is no stamp): a wide photograph on an upright page, or an upright one on a wide page, can only be set that way.
    const centred = Math.abs(outer - inner) <= tolerance
    if (Math.abs(top - outer) > tolerance && !centred) return false
  }
  return true
}

const cache = new Map<string, TemplateDefinition[]>()

/** Page layouts for photographs of these proportions in this order, on an album of this shape. */
export function showcaseForRatios(ratios: number[], aspect: number): TemplateDefinition[] {
  const count = ratios.length
  if (count < 1 || count > MAX_PHOTOS_PER_SPREAD || !Number.isFinite(aspect) || aspect <= 0) return []
  const aspectKey = keyFor(aspect), code = ratioCode(ratios), cacheKey = `${aspectKey}|${code}`
  const hit = cache.get(cacheKey)
  if (hit) return hit
  const quantised = ratiosFromCode(code), seen = new Set<string>(), out: TemplateDefinition[] = []
  for (const v of pageVariants(quantised, aspectKey / KEY_SCALE)) {
    const boxes = v.boxes
    // The matcher hands photographs to frames left to right, top to bottom, so the left page's photographs come first.
    if (!v.moved && !inOrderShapes(boxes, quantised, aspectKey / KEY_SCALE)) continue
    // Even white space and no stamp-sized frames: a block floating off-centre, or small on its page, is not offered.
    if (!balancedWhite(boxes, aspectKey / KEY_SCALE)) continue
    // (A full-spread layout may run a picture across the fold, as long as the gaps are equal and the edges line up.)
    // (A bleed layout and the same frame held to the album's margin are two layouts.)
    const look = finerLook(boxes) + (v.bleed?.length ? 'b' + v.bleed.join('') : '')
    if (seen.has(look)) continue
    seen.add(look)
    const id = `show2-${aspectKey}-${count}-${code}-${v.key}`
    const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => p.b[0] - q.b[0] || p.b[1] - q.b[1])
    out.push({
      id, name: `Showcase · ${v.name}`, photoCount: count, pageSide: 'spread', isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#7a6a58',
      placeholders: order.map(({ b: [x, y, width, height], i: from }, i): PlaceholderRect => ({ id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any', ...(v.bleed?.includes(from) ? { bleed: true } : {}) })),
    })
  }
  if (cache.size > 300) cache.clear()
  cache.set(cacheKey, out)
  return out
}

/** Rebuilds a page layout from its id, so albums saved with one still open it. */
export function showcaseFromId(id: string): TemplateDefinition | undefined {
  const m = id.match(/^show(2?)-(\d+)-(\d+)-([0-9a-z]+)-/)
  if (!m) return undefined
  const [, two, key, count, code] = m
  // Ids from earlier builds carry the shapes (landscape, portrait, square) rather than the proportions.
  const ratios = two ? ratiosFromCode(code) : kindsOfCode(Number(code), Number(count), 3).map(k => RATIO[k])
  return showcaseForRatios(ratios, Number(key) / KEY_SCALE).find(t => t.id === id)
}
