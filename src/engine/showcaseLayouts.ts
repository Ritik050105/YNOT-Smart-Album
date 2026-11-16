import { PlaceholderRect, TemplateDefinition } from '@/types'
import { Box, KEY_SCALE, balancedForSequence, codeOf, inOrder, keyFor, kindsOfCode, layoutLook } from './balancedLayouts'
import { patternClass } from './patternClass'
import { MAX_PHOTOS_PER_SPREAD } from './spreadLimits'

/** Showcase layouts: photographs set on the page with white space round and between them, the way a designer
 *  floats a few pictures on a spread: a row, a row that rises and dips, a feature picture with the others at its
 *  sides or stacked beside it, columns, a fan of overlapping pictures. Where the balanced family tiles the whole
 *  sheet, these are about pattern, not filling the page, so they are the answer to "show me something different".
 *
 *  They are drawn for the photographs in their own order (the first photograph in the first frame from the left)
 *  and each frame has exactly its photograph's shape, so a landscape photograph never meets a portrait frame. The
 *  album's gap and margin do not apply: the spacing is part of the design. Ids carry the album shape, count, the
 *  order of shapes and the variant, and `showcaseFromId` rebuilds any of them. */

const RATIO = [1.5, 2 / 3, 1]
/** A frame shorter than this fraction of the page stops reading as a photograph. */
const MIN_SIDE = 0.12
/** The block of pictures spans at least this share of the page, across or down. */
const MIN_SPAN = 0.6

/** `fixed` layouts are already drawn for each side, so they are not also mirrored left to right (the left page would become the right). */
interface Variant { key: string; name: string; boxes: Box[]; fixed?: boolean }

/** Fits a layout drawn at any size inside `fill` of the page and centres it. Page units are width = aspect, height = 1;
 *  the result is normalised to 0-1 each way. */
function place(boxes: Box[], aspect: number, fill: number): Box[] | null {
  const x0 = Math.min(...boxes.map(b => b[0])), x1 = Math.max(...boxes.map(b => b[0] + b[2]))
  const y0 = Math.min(...boxes.map(b => b[1])), y1 = Math.max(...boxes.map(b => b[1] + b[3]))
  const k = Math.min((fill * aspect) / (x1 - x0), fill / (y1 - y0))
  const ox = (aspect - (x1 - x0) * k) / 2 - x0 * k
  const oy = (1 - (y1 - y0) * k) / 2 - y0 * k
  const out = boxes.map(([x, y, w, h]): Box => [(x * k + ox) / aspect, y * k + oy, (w * k) / aspect, h * k])
  // A layout whose pictures come out postage-stamp small is not offered: every picture at least an eighth of the page's height on
  // its short side, and the block spanning most of the page one way or the other (a band across it, or a column down it).
  const smallest = Math.min(...out.map(([, , w, h]) => Math.min(w * aspect, h)))
  const span = Math.max(((x1 - x0) * k) / aspect, (y1 - y0) * k)
  return smallest >= MIN_SIDE && span >= MIN_SPAN ? out : null
}

/** Photographs side by side at one height. `rise` lifts every other one and drops the rest, `overlap` tucks each under the last. */
function row(ratios: number[], gap: number, rise = 0, overlap = 0): Box[] {
  const out: Box[] = []
  let x = 0
  ratios.forEach((r, i) => {
    out.push([x, rise ? (i % 2 ? rise : -rise) : 0, r, 1])
    x += r * (1 - overlap) + gap
  })
  return out
}

/** Photographs stacked in one column at a common width, top to bottom. */
function stack(ratios: number[], x: number, gap: number, height = 1): Box[] {
  const w = (height - gap * (ratios.length - 1)) / ratios.reduce((a, r) => a + 1 / r, 0)
  let y = 0
  return ratios.map((r): Box => { const box: Box = [x, y, w, w / r]; y += w / r + gap; return box })
}

const pct = (v: number) => Math.round(v * 100)

function variants(kinds: number[], aspect: number): Variant[] {
  const n = kinds.length, r = kinds.map(k => RATIO[k]), out: Variant[] = []
  const add = (key: string, name: string, raw: Box[], fill: number) => { const boxes = place(raw, aspect, fill); if (boxes) out.push({ key, name, boxes }) }
  if (n === 1) { for (const f of [0.5, 0.84]) add(`one${pct(f)}`, 'One Centred', [[0, 0, r[0], 1]], f); return out }
  if (n <= 8) {
    // One size of each pattern: a layout that is the same arrangement a little larger or smaller is not another choice.
    add('row', 'Row', row(r, 0.06), 0.84)
  }
  // A feature photograph with the others on either side, level with its middle, its top or its bottom, or alternating.
  if (n >= 3) {
    for (const m of new Set([Math.floor(n / 2), 1, n - 2].filter(v => v >= 1 && v <= n - 2))) {
      for (const align of ['mid', 'top', 'bottom', 'alt']) for (const f of [0.88]) {
        const boxes: Box[] = new Array(n), s = 0.42, gap = 0.07
        // Each side is one column of smaller pictures, flush to the feature.
        const column = (list: number[], first: number, toLeft: boolean, idx: number) => {
          const width = Math.max(...list.map(v => v * s)), total = list.length * s + gap * (list.length - 1)
          let y = align === 'top' ? 0 : align === 'bottom' ? 1 - total : align === 'alt' ? (idx === 0 ? 0 : 1 - total) : (1 - total) / 2
          list.forEach((v, i) => {
            const w = v * s, x = toLeft ? first - gap - width + (width - w) / 2 : first + gap + (width - w) / 2
            boxes[(toLeft ? 0 : m + 1) + i] = [x, y, w, s]
            y += s + gap
          })
        }
        boxes[m] = [0, 0, r[m], 1]
        column(r.slice(0, m), 0, true, 0)
        column(r.slice(m + 1), r[m], false, 1)
        add(`hero${m}${align}-${pct(f)}`, 'Feature Between', boxes, f)
      }
    }
  }
  // A feature photograph with the rest stacked beside it, on either side.
  if (n >= 2) {
    for (const side of ['L', 'R']) for (const f of [0.88]) for (const g of [0.07]) {
      const heroIndex = side === 'L' ? 0 : n - 1, heroRatio = r[heroIndex], others = r.filter((_, i) => i !== heroIndex)
      // Columns of at most three, side by side.
      const parts: Box[] = []
      let x = side === 'L' ? heroRatio + g : 0
      for (let i = 0; i < others.length; i += 3) { const col = stack(others.slice(i, i + 3), x, g); parts.push(...col); x += col[0][2] + g }
      const hero: Box = [side === 'L' ? 0 : x, 0, heroRatio, 1]
      add(`side${side}${pct(f)}-${pct(g)}`, 'Feature and Stack', side === 'L' ? [hero, ...parts] : [...parts, hero], f)
    }
  }
  // The photographs as consecutive columns of stacked pictures, the block centred.
  if (n >= 4) {
    for (let k = 2; k <= Math.min(6, Math.floor(n / 2)); k++) for (const f of [0.88]) for (const g of [0.06]) {
      const boxes: Box[] = []
      let at = 0, x = 0
      for (let c = 0; c < k; c++) {
        const size = Math.floor(n / k) + (c < n % k ? 1 : 0), col = stack(r.slice(at, at + size), x, g)
        boxes.push(...col); at += size; x += col[0][2] + g
      }
      add(`cols${k}-${pct(f)}-${pct(g)}`, 'Columns', boxes, f)
    }
  }
  // A feature picture with the rest in a row above or below it, the row as wide as the feature. Below, the feature is the first
  // photograph; above, the second, which is where it falls in reading order (the first of the row, then the feature under it).
  if (n >= 3 && n <= 8) {
    for (const edge of ['top', 'bottom']) {
      const heroIndex = edge === 'top' ? 1 : 0, rest = r.filter((_, i) => i !== heroIndex), width = r[heroIndex], gap = 0.04
      const h = (width - gap * (rest.length - 1)) / rest.reduce((a, v) => a + v, 0)
      const hero: Box = [0, edge === 'top' ? h + gap : 0, width, 1], row: Box[] = []
      let x = 0
      for (const v of rest) { row.push([x, edge === 'top' ? 0 : 1 + gap, v * h, h]); x += v * h + gap }
      add(`rowof${edge}`, edge === 'top' ? 'Row over Feature' : 'Feature over Row', edge === 'top' ? [row[0], hero, ...row.slice(1)] : [hero, ...row], 0.88)
    }
  }
  return out
}

/** Whether any frame lies across the fold (the line down the middle of the spread, where the two pages meet). */
export const crossesFold = (frames: { x: number; width: number }[]) => frames.some(f => f.x < 0.497 && f.x + f.width > 0.503)

/** One block of pictures set on a single page: how much of the page it takes across and down. Equal fractions are a block as
 *  wide as it is tall, narrower ones a column, wider ones a band; `1, 1` fills the page to the album's margin. */
const PAGE_BLOCKS: [name: string, across: number, down: number][] = [['Page', 0.86, 0.86], ['Narrow Page', 0.62, 0.86], ['Wide Page', 0.86, 0.6], ['Full Page', 1, 1]]

/** The ways to lay these photographs (in order) out in a block of this shape, as boxes in the block (0-1 each way), one of each
 *  kind of arrangement first. One photograph is the frame of its own shape, as large as the block allows. */
function blockLayouts(kinds: number[], blockAspect: number, limit: number): Box[][] {
  if (kinds.length === 1) {
    const r = RATIO[kinds[0]], w = r >= blockAspect ? 1 : r / blockAspect, h = r >= blockAspect ? blockAspect / r : 1
    return [[[(1 - w) / 2, (1 - h) / 2, w, h]]]
  }
  const tiled = balancedForSequence(kinds, blockAspect, 12).filter(t => t.placeholders.every(p => { const ratio = (p.width * blockAspect) / p.height; return ratio <= 2.4 && ratio >= 1 / 2.4 }))
  const groups = new Map<string, typeof tiled>()
  for (const t of tiled) { const k = patternClass(t), g = groups.get(k); if (g) g.push(t); else groups.set(k, [t]) }
  const picks: typeof tiled = []
  for (let depth = 0; picks.length < limit && depth < 6; depth++) for (const g of groups.values()) if (g[depth] && picks.length < limit) picks.push(g[depth])
  return picks.map(t => t.placeholders.map((p): Box => [p.x, p.y, p.width, p.height]))
}

/** Layouts that keep each page to itself: all the photographs on the left page, all on the right, or split between them, every
 *  page its own tiling with the album's gap between the frames, and nothing across the fold. Set as a block with white round it,
 *  or filling the page. Photographs go to the left page first, in order, then the right. */
function pageVariants(kinds: number[], aspect: number): Variant[] {
  const n = kinds.length, out: Variant[] = []
  const place = (page: 0 | 1, sub: Box[], across: number, down: number): Box[] =>
    sub.map(([x, y, w, h]): Box => [page * 0.5 + (0.5 - 0.5 * across) / 2 + x * 0.5 * across, (1 - down) / 2 + y * down, w * 0.5 * across, h * down])
  const fits = (boxes: Box[]) => boxes.every(([, , w, h]) => Math.min(w * aspect, h) >= 0.1 && (w * aspect) / h <= 2.5 && (w * aspect) / h >= 0.4)
  // One photograph on a page takes the whole block (a narrow or wide one would only make it small).
  const blocks = n > 8 ? [PAGE_BLOCKS[0], PAGE_BLOCKS[3]] : n === 1 ? [PAGE_BLOCKS[0], PAGE_BLOCKS[3]] : PAGE_BLOCKS
  // Everything on one page.
  for (const [name, across, down] of blocks) {
    const blockAspect = (0.5 * across * aspect) / down
    const layouts = blockLayouts(kinds, blockAspect, n > 8 ? 4 : 6)
    layouts.forEach((l, i) => {
      for (const page of [0, 1] as const) {
        const boxes = place(page, l, across, down)
        if (fits(boxes)) out.push({ key: `pg${page ? 'R' : 'L'}${name[0]}${i}`, name: page ? 'Right Page' : 'Left Page', boxes, fixed: true })
      }
    })
  }
  // Split between the two pages, near the middle first.
  const splits = [...new Set([Math.floor(n / 2), Math.ceil(n / 2), 1, n - 1])].filter(k => k >= 1 && k <= n - 1).slice(0, n > 8 ? 2 : 4)
  for (const k of splits) for (const [name, across, down] of blocks) {
    const left = blockLayouts(kinds.slice(0, k), (0.5 * across * aspect) / down, 3), right = blockLayouts(kinds.slice(k), (0.5 * across * aspect) / down, 3)
    for (let i = 0; i < Math.min(3, Math.max(left.length, right.length)); i++) {
      for (const [a, b] of [[i, i], [i, i + 1]]) {
        const l = left[a % Math.max(1, left.length)], r = right[b % Math.max(1, right.length)]
        if (!l || !r) continue
        const boxes = [...place(0, l, across, down), ...place(1, r, across, down)]
        if (fits(boxes)) out.push({ key: `pg${k}${name[0]}${a}-${b}`, name: 'Two Pages', boxes, fixed: true })
      }
    }
  }
  return out
}

const cache = new Map<string, TemplateDefinition[]>()

/** Showcase layouts for photographs of these shapes in this order, on an album of this shape. */
export function showcaseForSequence(kinds: number[], aspect: number): TemplateDefinition[] {
  const count = kinds.length
  if (count < 1 || count > MAX_PHOTOS_PER_SPREAD || !Number.isFinite(aspect) || aspect <= 0) return []
  const aspectKey = keyFor(aspect), code = codeOf(kinds), cacheKey = `${aspectKey}|${count}|${code}`
  const hit = cache.get(cacheKey)
  if (hit) return hit
  const seen = new Set<string>(), out: TemplateDefinition[] = []
  for (const v of [...pageVariants(kinds, aspectKey / KEY_SCALE), ...variants(kinds, aspectKey / KEY_SCALE)]) {
    // Each also stands mirrored, left to right and top to bottom: the feature on the other side, the row rising the other way. A
    // mirror that no longer reads in the photographs' order is dropped.
    let mirror = 0
    for (const [flipX, flipY] of [[false, false], [true, false], [false, true], [true, true]].filter(([fx]) => !(v.fixed && fx))) {
      const boxes = v.boxes.map(([x, y, w, h]): Box => [flipX ? 1 - x - w : x, flipY ? 1 - y - h : y, w, h])
      // The matcher hands photographs to frames left to right, top to bottom: a layout is kept only if that is the order drawn.
      if (!inOrder(boxes, kinds)) continue
      // Nothing across the fold: a photograph split by the line between the pages is not offered.
      if (crossesFold(boxes.map(([x, , w]) => ({ x, width: w })))) continue
      const look = layoutLook(boxes)
      if (seen.has(look)) continue
      seen.add(look)
      const id = `show-${aspectKey}-${count}-${code}-${v.key}${mirror ? `m${mirror}` : ''}`
      mirror++
      const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => p.b[0] - q.b[0] || p.b[1] - q.b[1])
      out.push({
        id, name: `Showcase · ${v.name}`, photoCount: count, pageSide: 'spread', isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#7a6a58',
        placeholders: order.map(({ b: [x, y, width, height] }, i): PlaceholderRect => ({ id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any' })),
      })
    }
  }
  if (cache.size > 300) cache.clear()
  cache.set(cacheKey, out)
  return out
}

/** Rebuilds a showcase layout from its id, so albums saved with one still open it. */
export function showcaseFromId(id: string): TemplateDefinition | undefined {
  const m = id.match(/^show-(\d+)-(\d+)-(\d+)-/)
  if (!m) return undefined
  const [, key, count, code] = m
  return showcaseForSequence(kindsOfCode(Number(code), Number(count), 3), Number(key) / KEY_SCALE).find(t => t.id === id)
}
