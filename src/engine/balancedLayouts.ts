import { PlaceholderRect, TemplateDefinition } from '@/types'
import { supportsUniformGap } from './templateLayout'
import { shapeOf } from './layoutMath'
import { MAX_PHOTOS_PER_SPREAD } from './spreadLimits'

/** Balanced layouts for every mix of landscape and upright photographs.
 *
 *  The designed families cover the mixes they happen to cover, and the filler family underneath
 *  them (shapeSetTemplates) guarantees one layout per mix but not a good choice of them. This one
 *  makes the choice deep: for an album shape, a photo count and a split into landscapes and
 *  uprights, it searches many ways to tile the whole page and keeps the best few.
 *
 *  Every layout here is a straight-cut tiling of the full sheet, so the album's margin runs evenly
 *  round the outside and its gap is the only spacing between frames — the properties the browsers
 *  filter on. Frames are classed by the app's own shape rule, so a landscape photograph only ever
 *  meets landscape frames and an upright one upright frames; there are no squares to soak up a
 *  mismatch. The ones that read best win: frames near the proportions of real photographs, close
 *  in size, with few distinct edges so the rows and columns line up.
 *
 *  Generated for the exact album shape asked for, so a custom size gets layouts drawn for it
 *  rather than the nearest preset. Ids carry the shape, count and rank, and `balancedFromId`
 *  rebuilds any of them, so a saved album always finds its layout. */

/** Frames of each shape sit well clear of the shape rule's 1.15 deadband, whatever the album. */
const LANDSCAPE = { ideal: 1.5, min: 1.22, max: 2.6 }
const UPRIGHT = { ideal: 1 / 1.5, min: 0.38, max: 0.82 }
/** A square photograph needs a square frame: inside the shape rule's 0.87-1.15 deadband, where a frame counts as square whatever the gap does to it. */
const SQUARE = { ideal: 1, min: 0.89, max: 1.12 }

/** Largest frame over smallest. Past this a layout reads as one hero and a scatter of stamps. */
const MAX_SPREAD = 3.6
/** The deep shelf for a set of photographs' own mix (see `balancedForMix`); the library every count shares holds fewer. */
const KEEP_PER_MIX = 40
/** Draws per mix: enough to find the good ones, fewer as the count grows since the cost of a draw
 *  grows with it and big sets are rarer. A mix that is hard to tile simply gets fewer layouts. */
const budget = (count: number) => ({ min: 120, max: count <= 6 ? 1200 : count <= 12 ? 700 : 480 })

export type Box = [x: number, y: number, w: number, h: number]

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The ways a split can order its photographs: grouped by shape, in either order, alternating,
 *  with one shape wrapped round the other, or shuffled. Grouped ones tend to look the most
 *  deliberate, so they get most of the draws. */
function order(landscapes: number, uprights: number, pattern: number, random: () => number, squares = 0): number[] {
  const L = Array(landscapes).fill(0), U = Array(uprights).fill(1)
  if (squares > 0) {
    // Squares join as a third group: kept together, between the others, or scattered.
    const S = Array(squares).fill(2)
    switch (pattern % 6) {
      case 0: return [...L, ...U, ...S]
      case 1: return [...S, ...L, ...U]
      case 2: return [...U, ...S, ...L]
      case 3: return [...L, ...S, ...U]
      case 4: { const out: number[] = [], pool = [landscapes, uprights, squares]; while (out.length < landscapes + uprights + squares) for (let k = 0; k < 3; k++) if (pool[k] > 0) { out.push(k === 0 ? 0 : k === 1 ? 1 : 2); pool[k]-- } return out }
      default: return [...L, ...U, ...S].sort(() => random() - 0.5)
    }
  }
  switch (pattern % 6) {
    case 0: return [...L, ...U]
    case 1: return [...U, ...L]
    case 2: {
      const out: number[] = []
      for (let i = 0, l = 0, u = 0; l < landscapes || u < uprights; i++) {
        if ((i % 2 === 0 && l < landscapes) || u >= uprights) { out.push(0); l++ } else { out.push(1); u++ }
      }
      return out
    }
    case 3: { const h = Math.floor(landscapes / 2); return [...L.slice(0, h), ...U, ...L.slice(h)] }
    case 4: { const h = Math.floor(uprights / 2); return [...U.slice(0, h), ...L, ...U.slice(h)] }
    default: return [...L, ...U].sort(() => random() - 0.5)
  }
}

const WIDE_CHOICES = [1.3, 1.4, 1.5, 1.6, 1.75], TALL_CHOICES = [0.58, 0.62, 1 / 1.5, 0.72, 0.77], SQUARE_CHOICES = [0.92, 0.96, 1, 1.04, 1.09]
const pick = (list: number[], random: () => number) => list[Math.floor(random() * list.length)]

/** Photographs in rows, every row as wide as the block. A row's height follows from the shapes in
 *  it, so one holding few photographs is taller. Rows share one stretch factor, which is what
 *  keeps every frame close to the shape it started as; if it strays too far the draw is dropped.
 *  Columns are the same thing turned on its side. */
function justified(kinds: number[], from: number, to: number, x: number, y: number, w: number, h: number,
  aspect: number, random: () => number, out: Box[], columns: boolean): boolean {
  const n = to - from
  // Work in the orientation where the block is rows; flip afterwards for columns.
  const ratios = Array.from({ length: n }, (_, i) => {
    const kind = kinds[from + i], r = kind === 0 ? pick(WIDE_CHOICES, random) : kind === 2 ? pick(SQUARE_CHOICES, random) : pick(TALL_CHOICES, random)
    return columns ? 1 / r : r
  })
  const region = columns ? (h / (w * aspect)) : (w * aspect) / h
  const rowsGuess = Math.sqrt(ratios.reduce((a, r) => a + r, 0) / region)
  const rows = Math.max(1, Math.min(n, Math.round(rowsGuess + (random() < 0.5 ? 0 : random() < 0.5 ? -1 : 1))))
  // Rows of equal height are the tidiest; rows sharing one stretch factor are the most faithful to
  // each photograph's shape. Half the draws take each.
  const equal = random() < 0.5
  const cuts = [0]
  if (equal) {
    // Fill each row to the width its share of the height calls for, stopping at the closer side.
    const target = ratios.reduce((a, r) => a + r, 0) / rows
    for (let j = 1; j < rows; j++) {
      let at = cuts[j - 1], sum = 0
      const last = n - (rows - j)
      while (at < last) {
        const next = sum + ratios[at]
        if (at > cuts[j - 1] && Math.abs(next - target) > Math.abs(sum - target)) break
        sum = next; at++
      }
      cuts.push(at)
    }
  } else {
    for (let j = 1; j < rows; j++) {
      const at = Math.round((j * n) / rows + (random() < 0.5 ? 0 : random() < 0.5 ? -1 : 1))
      cuts.push(Math.max(cuts[j - 1] + 1, Math.min(n - (rows - j), at)))
    }
  }
  cuts.push(n)
  const sums = Array.from({ length: rows }, (_, j) => ratios.slice(cuts[j], cuts[j + 1]).reduce((a, r) => a + r, 0))
  const heights = equal ? sums.map(() => 1 / rows) : (() => { const t = sums.reduce((a, S) => a + 1 / S, 0); return sums.map(S => 1 / S / t) })()
  // A row's stretch: how far its photographs are widened or narrowed to fill it.
  for (let j = 0; j < rows; j++) {
    const stretch = region / (heights[j] * sums[j])
    if (stretch < 0.62 || stretch > 1.6) return false
  }
  let at = 0
  for (let j = 0; j < rows; j++) {
    const next = j === rows - 1 ? 1 : at + heights[j]
    let across = 0
    for (let i = cuts[j]; i < cuts[j + 1]; i++) {
      const end = i === cuts[j + 1] - 1 ? 1 : across + ratios[i] / sums[j]
      const [a0, a1, b0, b1] = [across, end, at, next]
      out[from + i] = columns
        ? [x + w * b0, y + h * a0, w * (b1 - b0), h * (a1 - a0)]
        : [x + w * a0, y + h * b0, w * (a1 - a0), h * (b1 - b0)]
      across = end
    }
    at = next
  }
  return true
}

/** A block of photographs in a region: a straight cut into two smaller blocks, or rows, or columns.
 *  Cuts hand each side area in proportion to its photographs, nudged so layouts differ. */
function block(kinds: number[], from: number, to: number, x: number, y: number, w: number, h: number,
  aspect: number, random: () => number, out: Box[], depth: number, flow = false): boolean {
  const n = to - from
  if (n === 1) { out[from] = [x, y, w, h]; return true }
  if (depth > 0 && n >= 3 && random() < 0.5) {
    const k = 1 + Math.floor(random() * (n - 1))
    const share = Math.max(0.2, Math.min(0.8, (k / n) * (0.88 + random() * 0.24)))
    // A wide region is cut side by side, a tall one into rows, most of the time.
    const side = flow || random() < Math.max(0.15, Math.min(0.85, 0.5 + 0.45 * Math.log((w * aspect) / h)))
    if (side) {
      const xs = x + w * share
      return block(kinds, from, from + k, x, y, xs - x, h, aspect, random, out, depth - 1, flow)
        && block(kinds, from + k, to, xs, y, x + w - xs, h, aspect, random, out, depth - 1, flow)
    }
    const ys = y + h * share
    return block(kinds, from, from + k, x, y, w, ys - y, aspect, random, out, depth - 1)
      && block(kinds, from + k, to, x, ys, w, y + h - ys, aspect, random, out, depth - 1)
  }
  return justified(kinds, from, to, x, y, w, h, aspect, random, out, flow || random() < 0.4)
}

interface Candidate { boxes: Box[]; score: number; signature: string }

/** Pulls seams that nearly line up onto one line (within 3% of the page). Independent cuts in
 *  neighbouring blocks land a hair apart, and a hair is enough to give the gap between them a
 *  different width from the rest — those layouts used to be thrown away; lined up they are kept and
 *  read tidier. Every edge goes through the same mapping, so the tiling stays a tiling. */
const SNAP = 0.03
function snapped(boxes: Box[]): Box[] {
  const maps = [0, 1].map(axis => {
    const edges = [...new Set(boxes.flatMap(b => [b[axis], b[axis] + b[axis + 2]].map(v => Math.round(v * 1e6) / 1e6)))].sort((p, q) => p - q)
    const to = new Map<number, number>()
    for (let i = 0; i < edges.length;) {
      let j = i
      while (j + 1 < edges.length && edges[j + 1] - edges[j] <= SNAP) j++
      // Keep the sheet's own edges where they are; anything within reach of them joins them.
      const mean = edges[i] === 0 ? 0 : edges[j] === 1 ? 1 : edges.slice(i, j + 1).reduce((a, v) => a + v, 0) / (j - i + 1)
      for (let k = i; k <= j; k++) to.set(edges[k], mean)
      i = j + 1
    }
    return (v: number) => to.get(Math.round(v * 1e6) / 1e6) ?? v
  })
  return boxes.map(([x, y, w, h]): Box => {
    const x0 = maps[0](x), x1 = maps[0](x + w), y0 = maps[1](y), y1 = maps[1](y + h)
    return [x0, y0, x1 - x0, y1 - y0]
  })
}

/** Whether the album's gap comes out the same everywhere in the layout, at the album's own presets:
 *  the new-album wizard offers gaps of 0, 6, 16 and 28 and sets the margin to half the gap. A layout
 *  that holds at one and breaks at another would silently vanish from the browsers at that setting,
 *  so it is kept only if it holds at all of them. The widest is tried first, since it fails most. */
const GAP_SETTINGS: [margin: number, gap: number][] = [[14, 28], [8, 16], [3, 6]]
const gapHolds = (boxes: Box[], aspect: number, settings = GAP_SETTINGS) => {
  const frames = boxes.map(([x, y, width, height], i): PlaceholderRect => ({ id: String(i), x, y, width, height, preferredOrientation: 'any' }))
  return settings.every(([margin, gap]) => supportsUniformGap(frames, aspect, margin, gap))
}

function evaluate(boxes: Box[], kinds: number[], aspect: number, round: number): number | null {
  // Later rounds widen what a frame may be. The shape rule takes a squarish frame (0.87 to 1.15) for a photograph of
  // either orientation, so the last round lets those in, which is what gives two or three photographs more than a
  // couple of ways to sit on a page.
  const wideMin = [LANDSCAPE.min, 1.1, 1.0][round], tallMax = [UPRIGHT.max, 0.92, 1.0][round], maxSpread = MAX_SPREAD + 1.2 * round
  let dev = 0, minArea = Infinity, maxArea = 0
  const xs = new Set<number>(), ys = new Set<number>()
  for (let i = 0; i < boxes.length; i++) {
    const [x, y, w, h] = boxes[i]
    const ratio = (w * aspect) / h, kind = kinds[i], shape = kind === 0 ? LANDSCAPE : kind === 2 ? SQUARE : UPRIGHT
    if (ratio < (kind === 0 ? wideMin : shape.min) || ratio > (kind === 1 ? tallMax : shape.max)) return null
    dev += Math.abs(Math.log(ratio / shape.ideal))
    const area = w * h
    minArea = Math.min(minArea, area); maxArea = Math.max(maxArea, area)
    xs.add(Math.round(x * 200)); xs.add(Math.round((x + w) * 200))
    ys.add(Math.round(y * 200)); ys.add(Math.round((y + h) * 200))
  }
  const spread = maxArea / minArea
  if (spread > maxSpread) return null
  // Lower is better: proportions close to a real photograph, similar sizes, and few distinct edges
  // so the rows and columns line up instead of staggering.
  return (dev / boxes.length) * 3 + Math.log(spread) * 0.8 + ((xs.size + ys.size) / boxes.length) * 1.0
}

/** Frames in the order the template matcher reads them: by left edge, then top edge. The browser
 *  previews a template by handing photographs to its frames in array order and applies it in this
 *  order, so a template whose frames are listed any other way shows one photograph and applies another. */
const readingOrder = (boxes: Box[]) => boxes
  .map((b, i) => ({ b, i }))
  .sort((p, q) => p.b[0] - q.b[0] || p.b[1] - q.b[1])

/** The arrangement a layout makes, ignoring proportions: which grid lines each frame sits between,
 *  with lines closer than a twenty-fifth of the page counted as one. The library's own duplicate check
 *  reads layouts the same way, so what is kept here survives it. */
function arrangement(boxes: Box[]): string {
  const lines = (values: number[]) => {
    const out: number[] = []
    for (const v of [...values].sort((p, q) => p - q)) if (!out.length || v - out[out.length - 1] > 0.04) out.push(v)
    return out
  }
  const xs = lines([0, 1, ...boxes.flatMap(([x, , w]) => [x, x + w])]), ys = lines([0, 1, ...boxes.flatMap(([, y, , h]) => [y, y + h])])
  const at = (list: number[], v: number) => Math.max(0, list.findIndex(e => Math.abs(e - v) <= 0.04))
  return `${xs.length}x${ys.length}:` + boxes.map(([x, y, w, h]) => [at(xs, x), at(ys, y), at(xs, x + w), at(ys, y + h)].join(',')).sort().join('|')
}

/** What a layout looks like at a glance: every edge to the nearest twelfth of the page. Two layouts
 *  cut the same way but at visibly different places (a hero a half or two thirds of the page) are
 *  different compositions, where `arrangement` calls them one. */
export function layoutLook(boxes: Box[]): string {
  return boxes.map(([x, y, w, h]) => [x, y, x + w, y + h].map(v => Math.round(v * 12)).join(',')).sort().join('|')
}

/** Best first, but taking one of each arrangement before a second of any, so the first ones on a
 *  shelf are different from each other rather than the same cut in six proportions. */
export const lookOfFrames = (frames: PlaceholderRect[]) => layoutLook(frames.map((f): Box => [f.x, f.y, f.width, f.height]))

function diverse(sorted: Candidate[]): Candidate[] {
  const groups = new Map<string, Candidate[]>()
  for (const c of sorted) { const g = groups.get(c.signature); if (g) g.push(c); else groups.set(c.signature, [c]) }
  const out: Candidate[] = []
  for (let depth = 0; out.length < sorted.length; depth++) for (const g of groups.values()) if (g[depth]) out.push(g[depth])
  return out
}

function mixLayouts(count: number, landscapes: number, squares: number, aspect: number, aspectKey: number, keep: number): Candidate[] {
  const uprights = count - landscapes - squares
  const random = rng(count * 100003 + landscapes * 1009 + squares * 7919 + aspectKey * 31)
  const found = new Map<string, Candidate>()
  const { min, max } = budget(count)
  // Per candidate, not per signature: a better draw can replace the one a signature first held.
  const holds = new WeakMap<Candidate, boolean>()
  const kept: Candidate[] = []
  let draw = 0
  // Most mixes are done in the first round. One that is hard to tile gets up to four more, so a
  // shelf is not left thin just because the first draws were unlucky.
  for (let round = 0; round < 5 && kept.length < keep; round++) {
    for (let s = 0; s < max && (s < min || found.size < keep * 2); s++, draw++) {
      const items = order(landscapes, uprights, draw, random, squares)
      const drawn: Box[] = new Array(count)
      if (!block(items, 0, count, 0, 0, 1, 1, aspect, random, drawn, 2)) continue
      const boxes = snapped(drawn)
      const score = evaluate(boxes, items, aspect, Math.min(round, 2))
      if (score === null) continue
      // Draws that differ only in proportion are one layout: the library treats two layouts whose
      // frames touch the same grid lines as the same arrangement and keeps one, so the shelf is
      // made of different arrangements, each in its best proportions.
      const look = layoutLook(boxes)
      const known = found.get(look)
      if (!known || known.score > score) found.set(look, { boxes, score, signature: arrangement(boxes) })
    }
    // A layout is only worth keeping if the album's gap comes out the same everywhere in it; a
    // slight stagger between neighbouring rows or columns breaks that.
    kept.length = 0
    const good: Candidate[] = []
    for (const c of [...found.values()].sort((p, q) => p.score - q.score || (p.signature < q.signature ? -1 : 1))) {
      let ok = holds.get(c)
      if (ok === undefined) holds.set(c, ok = gapHolds(c.boxes, aspect))
      if (ok) good.push(c)
    }
    kept.push(...diverse(good).slice(0, keep))
  }
  return kept
}

const cache = new Map<string, TemplateDefinition[]>()

/** Album shapes are bucketed to a ten-thousandth. The gap check works in pixels, so a layout drawn for
 *  an album a fraction of a percent off its real shape can fail it at a sliver; this keeps the drawn
 *  shape within a twentieth of a pixel of the real one. */
export const KEY_SCALE = 10000
export const keyFor = (aspect: number) => Math.max(2000, Math.min(50000, Math.round(aspect * KEY_SCALE)))

/** How many layouts per mix the general library holds. The photographs' own mix is served deeper (up
 *  to KEEP_PER_MIX) by `balancedForMix`, so the library every count shares stays the size it was. */
const LIBRARY_PER_MIX = 12

/** One mix as templates: each find also stands mirrored, left to right and top to bottom, a different
 *  composition (the weight sits elsewhere, the reading order changes) for no extra search, and a mirror
 *  of a tiling is still a tiling with the same gaps. Ids carry the shape, count, mix and rank. */
function mixTemplates(count: number, landscapes: number, squares: number, aspectKey: number, deep: boolean): TemplateDefinition[] {
  const out: TemplateDefinition[] = []
  const seen = new Set<string>()
  const mix = squares ? `${landscapes}l${squares}s` : `${landscapes}l`
  const tall = count - landscapes - squares
  let rank = 0
  for (const c of layoutsFor(count, landscapes, squares, aspectKey, deep ? KEEP_PER_MIX : LIBRARY_PER_MIX)) {
    for (const [flipX, flipY] of [[false, false], [true, false], [false, true], [true, true]]) {
      const boxes = c.boxes.map(([x, y, w, h]): Box => [flipX ? 1 - x - w : x, flipY ? 1 - y - h : y, w, h])
      const key = layoutLook(boxes)
      if (seen.has(key)) continue
      seen.add(key)
      // A mirror holds the gap at the same settings as the layout it mirrors, so only the widest is
      // re-checked here; the test asserts every preset on every layout.
      if ((flipX || flipY) && !gapHolds(boxes, aspectKey / KEY_SCALE, GAP_SETTINGS.slice(0, 1))) continue
      const id = `mix-${aspectKey}-${count}-${mix}-${deep ? 'd' : ''}${rank++}`
      out.push({
        id,
        name: `Balanced · ${landscapes} Wide, ${tall} Upright${squares ? `, ${squares} Square` : ''} · ${rank}`,
        photoCount: count,
        pageSide: 'spread',
        isBuiltIn: true,
        createdAt: new Date(0).toISOString(),
        thumbnailColor: '#5e6368',
        placeholders: readingOrder(boxes).map(({ b: [x, y, width, height] }, i): PlaceholderRect => ({
          id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any',
        })),
      })
    }
  }
  return out
}

/** Every balanced layout for `count` photographs on an album of this shape, best first within each
 *  mix of wide and upright photographs. One photograph needs no search: a full frame is already in
 *  the library. */
export function balancedTemplates(count: number, aspect: number): TemplateDefinition[] {
  if (count < 2 || !Number.isFinite(aspect) || aspect <= 0) return []
  const aspectKey = keyFor(aspect), cacheKey = `${count}|${aspectKey}`
  const hit = cache.get(cacheKey)
  if (hit) return hit
  const out: TemplateDefinition[] = []
  for (let landscapes = 0; landscapes <= count; landscapes++) out.push(...mixTemplates(count, landscapes, 0, aspectKey, false))
  cache.set(cacheKey, out)
  return out
}

const mixCache = new Map<string, Candidate[]>()
function layoutsFor(count: number, landscapes: number, squares: number, aspectKey: number, keep: number): Candidate[] {
  const key = `${count}|${landscapes}|${squares}|${aspectKey}|${keep}`
  let hit = mixCache.get(key)
  if (!hit) {
    mixCache.set(key, hit = mixLayouts(count, landscapes, squares, aspectKey / KEY_SCALE, aspectKey, keep))
    // Squares are drawn only for the albums that hold them, so there is no bound on how many mixes can be asked for.
    if (mixCache.size > 400) mixCache.delete(mixCache.keys().next().value!)
  }
  return hit
}

const compositionCache = new Map<string, TemplateDefinition[]>()
/** The deep shelf for photographs of exactly this mix: `wide` landscapes, `tall` portraits and `square`
 *  squares, in any order. This is what the template browser draws on once it knows the photographs. */
export function balancedForMix(wide: number, tall: number, square: number, aspect: number): TemplateDefinition[] {
  const count = wide + tall + square
  if (count < 2 || count > MAX_PHOTOS_PER_SPREAD || !Number.isFinite(aspect) || aspect <= 0) return []
  const aspectKey = keyFor(aspect), cacheKey = `${count}|${wide}|${square}|${aspectKey}`
  let hit = compositionCache.get(cacheKey)
  if (!hit) {
    compositionCache.set(cacheKey, hit = mixTemplates(count, wide, square, aspectKey, true))
    if (compositionCache.size > 200) compositionCache.delete(compositionCache.keys().next().value!)
  }
  return hit
}

/** Rebuilds a balanced layout from its id, so albums saved with one still resolve it. */
export function balancedFromId(id: string): TemplateDefinition | undefined {
  const ordered = id.match(/^mixseq(3?)-(\d+)-(\d+)-(\d+)-(\d+)$/)
  if (ordered) {
    const [, three, key, count, code, rank] = ordered
    const list = balancedForSequence(kindsOfCode(Number(code), Number(count), three ? 3 : 2), Number(key) / KEY_SCALE)
    // An id from an earlier build names its layout by rank; the layouts for that order are the nearest there is.
    return three ? list.find(t => t.id === id) : list[Number(rank)]
  }
  const m = id.match(/^mix-(\d+)-(\d+)-(\d+)l(?:(\d+)s)?-(d?)(\d+)$/)
  if (!m) return undefined
  // Ids from earlier builds carry the shape in hundredths; they are small enough to tell apart.
  const key = Number(m[1]), count = Number(m[2]), wide = Number(m[3]), square = Number(m[4] ?? 0), deep = m[5] === 'd', aspect = key < 1000 ? key / 100 : key / KEY_SCALE
  if (count > MAX_PHOTOS_PER_SPREAD) return undefined
  return (deep ? balancedForMix(wide, count - wide - square, square, aspect) : balancedTemplates(count, aspect)).find(t => t.id === id)
}

/** Layouts for photographs in one particular order.
 *
 *  The template browser's "match timeline order" row puts the first photograph in the first frame,
 *  the second in the second, and so on, where frames are taken left to right and top to bottom
 *  within a column. A layout drawn for a mix of shapes only suits that row if its frames happen to
 *  come out in the same order as the photographs. These are drawn for the order itself: the
 *  frames flow down columns, left to right, so the n-th frame is the n-th photograph's shape. */
/** 0 for a landscape photograph, 1 for a portrait one, 2 for a square one, by the app's own shape rule. */
export function sequenceKinds(photos: { width: number; height: number }[]): number[] {
  return photos.map(p => { const shape = shapeOf(p.width, p.height); return shape === 'landscape' ? 0 : shape === 'portrait' ? 1 : 2 })
}
/** The order of shapes as one number: base 3 here. Earlier builds wrote it in base 2 (landscape and
 *  portrait only) under the id prefix `mixseq-`, which still decodes the way it was written. */
export const codeOf = (kinds: number[]) => kinds.reduce((sum, k, i) => sum + k * 3 ** i, 0)
export const kindsOfCode = (code: number, count: number, base = 3) => Array.from({ length: count }, (_, i) => (Math.floor(code / base ** i) % base))

/** Whether the matcher, which takes frames by left edge then top edge, hands every photograph a frame of its own shape. */
export const inOrder = (boxes: Box[], kinds: number[]) => boxes.map((_, i) => i)
  .sort((p, q) => boxes[p][0] - boxes[q][0] || boxes[p][1] - boxes[q][1])
  .every((frame, k) => kinds[frame] === kinds[k])

/** The photographs as consecutive columns, each column a stack: the way to lay out an exact order, since the
 *  matcher reads frames left to right and top to bottom. `cuts` says where one column ends and the next
 *  begins. A column's width follows from what is stacked in it, and all columns share one stretch factor. */
function columnsFor(kinds: number[], cuts: number[], random: () => number, aspect: number, equal: boolean): Box[] {
  const ratios = kinds.map(kind => kind === 0 ? pick(WIDE_CHOICES, random) : kind === 2 ? pick(SQUARE_CHOICES, random) : pick(TALL_CHOICES, random))
  const cols = cuts.slice(0, -1).map((from, j) => ({ from, to: cuts[j + 1] }))
  const widths = cols.map(({ from, to }) => {
    const rs = ratios.slice(from, to), k = rs.length
    return equal ? rs.reduce((a, r) => a + r, 0) / k / k : 1 / rs.reduce((a, r) => a + 1 / r, 0)
  })
  const total = widths.reduce((a, w) => a + w, 0)
  const out: Box[] = new Array(kinds.length)
  let x = 0
  cols.forEach(({ from, to }, j) => {
    const w = j === cols.length - 1 ? 1 - x : widths[j] / total
    const rs = ratios.slice(from, to), inv = rs.map(r => equal ? 1 : 1 / r), sum = inv.reduce((a, v) => a + v, 0)
    let y = 0
    for (let i = from; i < to; i++) {
      const h = i === to - 1 ? 1 - y : inv[i - from] / sum
      out[i] = [x, y, w, h]
      y += h
    }
    x += w
  })
  return out
}

/** Where the columns of an order could break: every way for a short one, a spread of them for a long one. */
function columnCuts(count: number, random: () => number, draws: number): number[][] {
  const out: number[][] = []
  if (count <= 11) {
    for (let mask = 0; mask < 1 << (count - 1); mask++) {
      const cuts = [0]
      for (let i = 1; i < count; i++) if (mask & (1 << (i - 1))) cuts.push(i)
      cuts.push(count)
      out.push(cuts)
    }
    return out
  }
  for (let d = 0; d < draws; d++) {
    // Columns of about the size the album's shape wants, give or take.
    const cuts = [0]
    while (cuts[cuts.length - 1] < count) cuts.push(Math.min(count, cuts[cuts.length - 1] + 1 + Math.floor(random() * 4)))
    out.push(cuts)
  }
  return out
}

function sequenceLayouts(kinds: number[], aspect: number, aspectKey: number, keep: number): Candidate[] {
  const count = kinds.length
  const random = rng(codeOf(kinds) % 2147483647 * 7919 + count * 131 + aspectKey)
  const found = new Map<string, Candidate>()
  const holds = new WeakMap<Candidate, boolean>()
  const kept: Candidate[] = []
  // A draw is cheap and few fit one exact order, so far more are made than for a mix. Most flow down
  // columns, which is how the matcher reads; the rest are free-form and kept if they happen to match.
  const max = budget(count).max * 12
  const partitions = columnCuts(count, random, 600)
  for (let round = 0; round < 3 && kept.length < keep; round++) {
    for (let s = 0; s < max + partitions.length * 2 && found.size < keep * 2; s++) {
      // Half of the work is columns, taken partition by partition, which covers an order far more evenly
      // than chance does; the rest is the free-form search, for the layouts columns cannot make.
      const drawn: Box[] = s < partitions.length * 2 ? columnsFor(kinds, partitions[s % partitions.length], random, aspect, s >= partitions.length) : new Array(count)
      if (s >= partitions.length * 2 && !block(kinds, 0, count, 0, 0, 1, 1, aspect, random, drawn, 2, random() < 0.7)) continue
      const boxes = snapped(drawn)
      const score = evaluate(boxes, kinds, aspect, Math.min(round, 2))
      if (score === null) continue
      // Keep a layout only if the matcher's reading order gives every photograph a frame of its own shape.
      if (!inOrder(boxes, kinds)) continue
      const look = layoutLook(boxes)
      const known = found.get(look)
      if (!known || known.score > score) found.set(look, { boxes, score, signature: arrangement(boxes) })
    }
    kept.length = 0
    const good: Candidate[] = []
    for (const c of [...found.values()].sort((p, q) => p.score - q.score || (p.signature < q.signature ? -1 : 1))) {
      let ok = holds.get(c)
      if (ok === undefined) holds.set(c, ok = gapHolds(c.boxes, aspect))
      if (ok) good.push(c)
    }
    kept.push(...diverse(good).slice(0, keep))
  }
  return kept
}

const sequenceCache = new Map<string, TemplateDefinition[]>()

/** Balanced layouts whose frames come out in the order of these photographs' shapes. */
/** `keep` is how many layouts to search for before stopping: the browser's own list wants plenty, a caller that only needs a handful to choose from
 *  (the framed blocks) asks for fewer and gets them several times faster. */
export function balancedForSequence(kinds: number[], aspect: number, keep = KEEP_PER_MIX): TemplateDefinition[] {
  const count = kinds.length
  if (count < 2 || count > MAX_PHOTOS_PER_SPREAD || !Number.isFinite(aspect) || aspect <= 0) return []
  const aspectKey = keyFor(aspect), code = codeOf(kinds), cacheKey = `${aspectKey}|${count}|${code}|${keep}`
  const hit = sequenceCache.get(cacheKey)
  if (hit) return hit
  const aspectOf = aspectKey / KEY_SCALE
  // Mirrored, the way the mix shelf is: a mirror that still reads in the photographs' order is another composition.
  const boxesList: Box[][] = []
  const seen = new Set<string>()
  for (const c of sequenceLayouts(kinds, aspectOf, aspectKey, keep)) {
    for (const [flipX, flipY] of [[false, false], [true, false], [false, true], [true, true]]) {
      const boxes = c.boxes.map(([x, y, w, h]): Box => [flipX ? 1 - x - w : x, flipY ? 1 - y - h : y, w, h])
      const look = layoutLook(boxes)
      if (seen.has(look) || ((flipX || flipY) && (!inOrder(boxes, kinds) || !gapHolds(boxes, aspectOf, GAP_SETTINGS.slice(0, 1))))) continue
      seen.add(look)
      boxesList.push(boxes)
    }
  }
  const out = boxesList.map((boxes, rank): TemplateDefinition => {
    const id = `mixseq3-${aspectKey}-${count}-${code}-${rank}`
    const wide = kinds.filter(k => k === 0).length, tall = kinds.filter(k => k === 1).length, square = count - wide - tall
    return {
      id,
      name: `Balanced · in your order · ${wide} Wide, ${tall} Upright${square ? `, ${square} Square` : ''} · ${rank + 1}`,
      photoCount: count,
      pageSide: 'spread',
      isBuiltIn: true,
      createdAt: new Date(0).toISOString(),
      thumbnailColor: '#5e6368',
      placeholders: readingOrder(boxes).map(({ b: [x, y, width, height] }, i): PlaceholderRect => ({ id: `${id}-p${i}`, x, y, width, height, preferredOrientation: 'any' })),
    }
  })
  if (sequenceCache.size > 200) sequenceCache.clear()
  sequenceCache.set(cacheKey, out)
  return out
}

/** The work of `balancedTemplates(count, aspect)` cut into one small piece per mix of shapes (a few
 *  tens of milliseconds each), so a caller can spread it over time instead of freezing for the lot. */
export function balancedWarmSteps(count: number, aspect: number): (() => void)[] {
  if (count < 2 || !Number.isFinite(aspect) || aspect <= 0) return []
  const aspectKey = keyFor(aspect)
  return Array.from({ length: count + 1 }, (_, landscapes) => () => { layoutsFor(count, landscapes, 0, aspectKey, LIBRARY_PER_MIX) })
}
