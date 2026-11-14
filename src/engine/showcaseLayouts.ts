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
const MIN_SIDE = 0.07

interface Variant { key: string; name: string; boxes: Box[] }

/** Fits a layout drawn at any size inside `fill` of the page and centres it. Page units are width = aspect, height = 1;
 *  the result is normalised to 0-1 each way. */
function place(boxes: Box[], aspect: number, fill: number): Box[] | null {
  const x0 = Math.min(...boxes.map(b => b[0])), x1 = Math.max(...boxes.map(b => b[0] + b[2]))
  const y0 = Math.min(...boxes.map(b => b[1])), y1 = Math.max(...boxes.map(b => b[1] + b[3]))
  const k = Math.min((fill * aspect) / (x1 - x0), fill / (y1 - y0))
  const ox = (aspect - (x1 - x0) * k) / 2 - x0 * k
  const oy = (1 - (y1 - y0) * k) / 2 - y0 * k
  const out = boxes.map(([x, y, w, h]): Box => [(x * k + ox) / aspect, y * k + oy, (w * k) / aspect, h * k])
  return out.every(([, , w, h]) => h >= MIN_SIDE && w * aspect >= MIN_SIDE * 0.6) ? out : null
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
    for (const flip of [1, -1]) add(`zig${flip > 0 ? 'u' : 'd'}`, 'Rise and Dip', row(r, 0.06, 0.22 * flip), 0.84)
    add('fan', 'Overlapping Fan', row(r, 0, 0.12, 0.27), 0.84)
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
  // The tiled layouts of a block of another shape, set on the page with white space round it: a square block, a tall one, a
  // wide one, the page's own shape drawn smaller. Each block shape has its own arrangements, so these are different
  // patterns, not the full-page ones at another size.
  if (n >= 2 && n <= 12) {
    const shapes = [aspect, 1, 0.72, 2].filter((b, i, all) => all.findIndex(c => Math.abs(c - b) / b < 0.1) === i)
    for (const b of shapes) {
      const tiled = balancedForSequence(kinds, b)
      // One of each kind of arrangement first, a few in all.
      const groups = new Map<string, typeof tiled>()
      for (const t of tiled) { const k = patternClass(t), g = groups.get(k); if (g) g.push(t); else groups.set(k, [t]) }
      const picks: typeof tiled = []
      for (let depth = 0; picks.length < 5 && depth < 3; depth++) for (const g of groups.values()) if (g[depth] && picks.length < 5) picks.push(g[depth])
      const label = b === aspect ? 'Inset' : b === 1 ? 'Square Block' : b < 1 ? 'Tall Block' : 'Wide Block'
      // The template lists its frames in reading order, which is the photographs' order here.
      picks.forEach((t, i) => add(`frm${pct(b)}-${i}`, `Framed · ${label}`, t.placeholders.map((p): Box => [p.x * b, p.y, p.width * b, p.height]), 0.82))
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
  for (const v of variants(kinds, aspectKey / KEY_SCALE)) {
    // The matcher hands photographs to frames left to right, top to bottom: a layout is kept only if that is the order drawn.
    if (!inOrder(v.boxes, kinds)) continue
    const look = layoutLook(v.boxes)
    if (seen.has(look)) continue
    seen.add(look)
    const id = `show-${aspectKey}-${count}-${code}-${v.key}`
    const order = v.boxes.map((b, i) => ({ b, i })).sort((p, q) => p.b[0] - q.b[0] || p.b[1] - q.b[1])
    out.push({
      id, name: `Showcase · ${v.name}`, photoCount: count, pageSide: 'spread', isBuiltIn: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#7a6a58',
      placeholders: order.map(({ b: [x, y, width, height] }, i): PlaceholderRect => ({ id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any' })),
    })
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
