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
interface Variant { key: string; name: string; boxes: Box[]; bleed?: number[]; moved?: boolean }

/** Up to this many photographs a layout may lay one across the fold (a big picture running over the middle of the spread, with the line
 *  drawn through it): with so few pictures the fold is part of the composition. More than this and nothing may cross it. */
export const FOLD_FREE_COUNT = 4

/** Whether any frame lies across the fold (the line down the middle of the spread, where the two pages meet). */
export const crossesFold = (frames: { x: number; width: number }[]) => frames.some(f => f.x < 0.497 && f.x + f.width > 0.503)

/** The white round a block of pictures on a page, in units of the spread's height, the same on all four sides: none (the page is filled
 *  to the album's own margin) or a little more. Even on every side, so the block keeps the page's proportion and sits in the middle of it. */
const PAGE_MARGINS: [name: string, margin: number][] = [['Full Page', 0], ['Inset Page', 0.07], ['Wide Margin Page', 0.13]]

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
  const block = (page: 0 | 1, margin: number) => ({ x: page * 0.5 + margin / aspect, y: margin, w: 0.5 - (2 * margin) / aspect, h: 1 - 2 * margin })
  const aspectOf = (b: { w: number; h: number }) => (b.w * aspect) / b.h
  const into = (b: { x: number; y: number; w: number; h: number }, sub: Box[]): Box[] => sub.map(([x, y, w, h]): Box => [b.x + x * b.w, b.y + y * b.h, w * b.w, h * b.h])
  // The smallest frame a layout may have: a big set on one spread has small frames, and is judged by what its frames can be.
  const floor = n > 12 ? 0.045 : n > 8 ? 0.07 : 0.1
  const fits = (boxes: Box[], smallest = floor) => boxes.every(([, , w, h]) => Math.min(w * aspect, h) >= smallest && (w * aspect) / h <= 2.4 && (w * aspect) / h >= 0.42)
  /** Every way to set these photographs on one page, as boxes in the spread. One photograph can fill the page, be held inset, or be smaller
   *  (two sizes) and set in the middle, at an edge or in a corner of the inset page (anchors run from the inner edge to the outer one and from the
   *  top to the bottom); more than one are tiled, filling the page or held inset. */
  const options = (sub: number[], page: 0 | 1, limit: number): { key: string; boxes: Box[]; bleed?: boolean }[] => {
    const list: { key: string; boxes: Box[]; bleed?: boolean }[] = []
    if (sub.length === 1) {
      for (const [name, margin] of PAGE_MARGINS.filter(([, m]) => 0.5 - (2 * m) / aspect >= 0.2)) { const b = block(page, margin); list.push({ key: name.replace(/ /g, ''), boxes: into(b, blockLayouts(sub, aspectOf(b), 1)[0]) }) }
      // The page edge to edge, to the trim.
      if (0.5 * aspect >= 0.42) list.push({ key: 'Bleed', boxes: [[page * 0.5, 0, 0.5, 1]], bleed: true })
      const inner = block(page, PAGE_MARGINS[1][1]), outer = page === 0 ? -1 : 1
      // (The middle of the page first, then the same smaller block nearer an edge or a corner.)
      for (const size of [0.85, 0.7, 0.6, 0.5]) for (const ax of size === 0.7 || size === 0.5 ? [0, -1, 1] : [0]) for (const ay of size === 0.7 || size === 0.5 ? [0, -1, 1] : [0]) {
        const w = inner.w * size, h = inner.h * size
        const b = { x: inner.x + (inner.w - w) / 2 + ((inner.w - w) / 2) * ax * outer, y: inner.y + (inner.h - h) / 2 + ((inner.h - h) / 2) * ay, w, h }
        const where = `${ay < 0 ? 'High' : ay > 0 ? 'Low' : ''}${ax === 0 ? '' : ax * outer > 0 ? 'Outer' : 'Inner'}` || 'Centre'
        list.push({ key: `s${Math.round(size * 10)}${where}`, boxes: into(b, blockLayouts(sub, aspectOf(b), 1)[0]) })
      }
      // A single photograph on a narrow page is small whatever is done, so it is only asked not to be a stamp.
      return list.filter(o => fits(o.boxes, 0.07))
    }
    for (const [name, margin] of PAGE_MARGINS.filter(([, m]) => 0.5 - (2 * m) / aspect >= 0.2)) {
      const b = block(page, margin)
      blockLayouts(sub, aspectOf(b), limit).forEach((l, i) => { const boxes = into(b, l); if (fits(boxes)) list.push({ key: `${name[0]}${i}`, boxes }) })
    }
    // The same kind of block, a little smaller, set high, low, toward the inner edge or toward the outer one, leaving the page's white where
    // a caption or a title can go.
    const inner = block(page, PAGE_MARGINS[1][1]), outer = page === 0 ? -1 : 1
    // (The same proportion as the inset block, so the arrangements are the ones already drawn for it, only smaller and moved.)
    const layouts = blockLayouts(sub, aspectOf(inner), 3)
    for (const [where, ax, ay, scale] of [['High', 0, -1, 0.8], ['Low', 0, 1, 0.8], ['Inner', -1, 0, 0.8], ['Outer', 1, 0, 0.8], ['Mid', 0, 0, 0.65], ['HighMid', 0, -1, 0.65], ['LowMid', 0, 1, 0.65]] as const) {
      const w = inner.w * scale, h = inner.h * scale
      const b = { x: inner.x + (inner.w - w) / 2 + ((inner.w - w) / 2) * ax * outer, y: inner.y + (inner.h - h) / 2 + ((inner.h - h) / 2) * ay, w, h }
      layouts.forEach((l, i) => { const boxes = into(b, l); if (fits(boxes)) list.push({ key: `${where}${i}`, boxes }) })
    }
    return list
  }
  // One photograph can also run to the trim: the whole spread, or a whole page, edge to edge, or the spread held to the album's margin.
  if (n === 1) {
    out.push({ key: 'spreadBleed', name: 'Full Spread Bleed', boxes: [[0, 0, 1, 1]], bleed: [0] }, { key: 'spreadMargin', name: 'Full Spread', boxes: [[0, 0, 1, 1]] })
    // (A page this narrow is a strip, which no layout is.)
    if (0.5 * aspect >= 0.42) for (const page of [0, 1] as const) out.push({ key: `pg${page ? 'R' : 'L'}Bleed`, name: page ? 'Full Right Page Bleed' : 'Full Left Page Bleed', boxes: [[page * 0.5, 0, 0.5, 1]], bleed: [0] })
  }
  // Everything on one page, either page.
  for (const page of [0, 1] as const) for (const o of options(ratios, page, n > 8 ? 6 : 8)) { if (n === 1 && o.bleed) continue; out.push({ key: `pg${page ? 'R' : 'L'}${o.key}`, name: page ? 'Right Page' : 'Left Page', boxes: o.boxes }) }
  if (n === 1) return out
  // Split between the two pages, near the middle first (every split for a short set, a few for a long one).
  const mid = Math.floor(n / 2), order = Array.from({ length: n - 1 }, (_, i) => i + 1).sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid) || p - q)
  const splits = new Set(order.slice(0, n > 8 ? 6 : n > 5 ? 4 : n - 1))
  // A whole page given to the first photograph, or to the last, is always among them.
  splits.add(1); splits.add(n - 1)
  for (const k of splits) {
    const left = options(ratios.slice(0, k), 0, n > 8 ? 6 : 5), right = options(ratios.slice(k), 1, n > 8 ? 6 : 5)
    if (!left.length || !right.length) continue
    // Each left arrangement with a few of the right ones, so the two pages differ from each other as well as from other splits.
    let made = 0
    for (let i = 0; i < left.length && made < 90; i++) for (const j of [i, i + 1, i + 3, i + 5]) {
      const r = right[j % right.length], boxes = [...left[i].boxes, ...r.boxes]
      if (made < 90 && fits(boxes)) {
        const bleed = [...(left[i].bleed ? Array.from({ length: left[i].boxes.length }, (_, q) => q) : []), ...(r.bleed ? Array.from({ length: r.boxes.length }, (_, q) => left[i].boxes.length + q) : [])]
        out.push({ key: `pg${k}-${left[i].key}-${r.key}`, name: bleed.length ? 'Feature Page' : 'Two Pages', boxes, ...(bleed.length ? { bleed } : {}) }); made++
      }
    }
  }
  // The whole set tiled in one block across the spread, as tall as the spread or a band of it (nine tenths, four fifths...): each height is a
  // different shape to tile, so these are different arrangements, not the same one resized, and the spread is used to near its edges.
  if (n >= 2 && n <= 12) {
    for (const h of [0.92, 0.82, 0.72, 0.62, 0.52]) {
      const b = { x: 0.03, y: (1 - h) / 2, w: 0.94, h }
      blockLayouts(ratios, aspectOf(b), 4).forEach((l, i) => out.push({ key: `sb${Math.round(h * 100)}-${i}`, name: 'Spread Block', boxes: into(b, l) }))
    }
  }
  // The whole set in one row at the photographs' own proportions, as wide as the spread allows (or as tall as a good band can be), centred
  // or set high or low. Every frame is its photograph's own shape, whatever the album's, so mixes that no tiling suits still have layouts.
  if (n >= 2 && n <= 6) {
    const total = ratios.reduce((sum, r) => sum + r, 0)
    for (const width of [0.92, 0.86, 0.8, 0.73, 0.66, 0.58]) {
      const h = Math.min(0.72, (width * aspect) / total), rowW = (h * total) / aspect
      if (h < 0.18 || rowW < 0.3) continue
      for (const [where, y] of [['Mid', (1 - h) / 2], ['High', 0.1], ['Low', 0.9 - h], ['AboveMid', (1 - h) / 2 - 0.08], ['BelowMid', (1 - h) / 2 + 0.08]] as const) {
        if (y < 0.02 || y + h > 0.98) continue
        let x = (1 - rowW) / 2
        const boxes = ratios.map((r): Box => { const w = (r * h) / aspect, box: Box = [x, y, w, h]; x += w; return box })
        out.push({ key: `band${Math.round(width * 100)}${where}`, name: 'Filmstrip Band', boxes })
      }
    }
  }
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
        out.push({ key: `f${j}${page ? 'R' : 'L'}-${feature[i].key}-${r.key}`, name: feature[i].bleed ? 'Feature Page' : 'Two Pages', boxes, moved: true, ...(feature[i].bleed ? { bleed: [at] } : {}) }); made++
      }
    }
  }
  return out
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
    // (With a few photographs a picture may run across the fold.)
    if (count > FOLD_FREE_COUNT && crossesFold(boxes.map(([x, , w]) => ({ x, width: w })))) continue
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
