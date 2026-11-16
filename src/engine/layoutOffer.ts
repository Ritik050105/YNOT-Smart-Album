import { PhotoAsset, TemplateDefinition } from '@/types'
import { frameSizeSpread, hasEvenMargins, supportsUniformGap } from './templateLayout'
import { templateCategory } from './templateTransfer'
import { templateFramesInReadingOrder, templateOrderMismatches, templateShapeMismatches } from './templateMatching'
import { arrangementSignature, runsToTheTrim } from './templates'
import { patternClass } from './patternClass'
import { FOLD_FREE_COUNT, crossesFold } from './showcaseLayouts'
export { FOLD_FREE_COUNT }
export { patternClass }

/** A built-in layout with a photograph across the fold, where the two pages meet, which is only refused once there are more than a few
 *  photographs on the spread. */
export const crossesTheFold = (t: TemplateDefinition) => !!t.isBuiltIn && t.placeholders.length > FOLD_FREE_COUNT && crossesFold(t.placeholders)

/** Fewer even layouts than this and the shelf is too thin to be useful, so uneven ones come back. */
const MIN_EVEN_LAYOUTS = 3

/** Layouts that give every photograph a frame of its own shape: a landscape photo only meets
 *  landscape or square frames, an upright one only upright or square. When no layout manages that
 *  for a mixed set, the ones that miss the fewest are kept rather than an empty shelf. Layouts
 *  whose frame count differs from the photo count (imported designs) are not judged. With
 *  `keepOrder` each photograph is judged against the frame it would actually be given. */
export function onlyFittingShapes(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number, keepOrder = false, strict = false): TemplateDefinition[] {
  if (!photos.length) return templates
  const judged = templates.filter(t => t.placeholders.length === photos.length)
  if (!judged.length) return templates
  const count = keepOrder ? templateOrderMismatches : templateShapeMismatches
  const missed = new Map(judged.map(t => [t.id, count(photos, t, aspect, marginPx, gapPx)]))
  const fewest = Math.min(...missed.values())
  // Strict: only layouts that give every photograph a frame of its own shape, and nothing at all when
  // there are none, rather than the nearest misses.
  const wanted = strict ? 0 : fewest
  return templates.filter(t => !missed.has(t.id) || missed.get(t.id) === wanted)
}

/** Layouts whose spacing honours the album's gap: built-in layouts must leave exactly the chosen gap
 *  between neighbouring frames. Designs that run to the trim, and the designer's own templates, are
 *  exempt. If nothing passes, the list is returned as it was rather than empty. */
export function uniformGapLayouts(templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number): TemplateDefinition[] {
  const kept = templates.filter(t => templateCategory(t) !== 'reference' || supportsUniformGap(t.placeholders, aspect, marginPx, gapPx))
  return kept.length ? kept : templates
}

/** The widest or tallest a built-in frame may be: past about two to one a frame stops being a photograph and becomes a
 *  strip, and a photograph cropped into one loses most of itself. Designers can still draw one by hand. */
const NORMAL_RATIO = 2.5
export function normalFrames(t: TemplateDefinition, aspect: number) {
  return t.placeholders.every(p => { const ratio = (p.width * aspect) / p.height; return ratio <= NORMAL_RATIO && ratio >= 1 / NORMAL_RATIO })
}

/** Layouts with an even border all round and frames of comparable size, which is what the album's
 *  margin and gap settings promise. Full-bleed designs are exempt, since running to the trim is
 *  their point. Kept only while enough of them remain to choose from. */
export function preferEvenLayouts(templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number): TemplateDefinition[] {
  // No strips, anywhere a layout is chosen (Auto Build included), while there are enough ordinary ones to choose from.
  const normal = templates.filter(t => !t.isBuiltIn || normalFrames(t, aspect))
  templates = normal.length >= MIN_EVEN_LAYOUTS ? normal : templates
  // No photograph across the fold, where the two pages meet: a layout with one is never offered, whatever its family. If every candidate
  // crosses, the list stays as it was.
  const tidy = templates.filter(t => !crossesTheFold(t))
  templates = tidy.length ? tidy : templates
  const even = templates.filter(t => runsToTheTrim(t) || (hasEvenMargins(t.placeholders, aspect, marginPx, gapPx) && frameSizeSpread(t.placeholders) <= 6))
  return even.length >= MIN_EVEN_LAYOUTS ? even : templates
}

/** The one rule every browser applies after its own category and collection filters. */
export function offeredLayouts(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number, keepOrder = false, strict = false): TemplateDefinition[] {
  return preferEvenLayouts(wellCovered(photos, onlyFittingShapes(photos, templates, aspect, marginPx, gapPx, keepOrder, strict), aspect, keepOrder), aspect, marginPx, gapPx)
}

/** How much of each photograph a layout throws away, one number per photograph (0 to 1): the share of its area outside the frame it
 *  would get. With the photographs in order each takes the frame in reading order; otherwise the frames and the photographs are
 *  both put in order of proportion and matched along, which is the pairing that keeps the worst crop smallest. */
function cropLosses(photos: PhotoAsset[], t: TemplateDefinition, aspect: number, keepOrder: boolean): number[] {
  const frames = keepOrder ? templateFramesInReadingOrder(t) : [...t.placeholders]
  let ratios = frames.map(f => (f.width * aspect) / f.height), wanted = photos.map(p => (p.width > 0 && p.height > 0 ? p.width / p.height : 1))
  if (!keepOrder) { ratios = ratios.sort((a, b) => a - b); wanted = wanted.sort((a, b) => a - b) }
  return wanted.map((r, i) => 1 - Math.min(ratios[i] / r, r / ratios[i]))
}

/** Layouts that keep most of every photograph. A frame of another proportion than its photograph cuts the picture to fit, and the
 *  subject goes with it, so layouts are kept only while no photograph loses more than a third (and the set loses a fifth on
 *  average); when fewer than sixty pass, the allowance is widened a little at a time, and as a last resort the best of the rest are kept. Layouts drawn for
 *  the photographs' own proportions pass at once. Designers' own templates are left as they are. */
export function wellCovered(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, keepOrder = false): TemplateDefinition[] {
  if (!photos.length) return templates
  const judged = templates.filter(t => t.isBuiltIn && t.placeholders.length === photos.length)
  if (judged.length < 2) return templates
  const losses = new Map(judged.map(t => { const l = cropLosses(photos, t, aspect, keepOrder); return [t.id, { max: Math.max(...l), mean: l.reduce((a, v) => a + v, 0) / l.length }] as const }))
  const keep = (maxLoss: number, meanLoss: number) => templates.filter(t => !losses.has(t.id) || (losses.get(t.id)!.max <= maxLoss && losses.get(t.id)!.mean <= meanLoss))
  for (const [maxLoss, meanLoss] of [[0.34, 0.2], [0.4, 0.26], [0.46, 0.32], [0.52, 0.38]]) { const kept = keep(maxLoss, meanLoss); if (kept.filter(t => losses.has(t.id)).length >= 60) return kept }
  // (A layout and its mirror lose the same, so the cut falls between losses, never between a layout and its twin.)
  const ranked = [...judged].sort((a, b) => losses.get(a.id)!.max - losses.get(b.id)!.max), cut = losses.get(ranked[Math.min(ranked.length, Math.max(12, Math.ceil(judged.length * 0.5))) - 1].id)!.max
  const best = new Set(ranked.filter(t => losses.get(t.id)!.max <= cut + 1e-9).map(t => t.id))
  return templates.filter(t => !losses.has(t.id) || best.has(t.id))
}

/** Where a layout's frames, taken together, sit on the page: the bounding box to a tenth, so a layout that fills the page
 *  and the same arrangement set in a smaller block with white space round it are told apart. */
const extent = (t: TemplateDefinition) => {
  const f = t.placeholders
  return [Math.min(...f.map(p => p.x)), Math.min(...f.map(p => p.y)), Math.max(...f.map(p => p.x + p.width)), Math.max(...f.map(p => p.y + p.height))].map(v => Math.round(v * 20)).join(',')
}

/** Reorders a shelf so neighbours are different patterns: the best layout of every pattern class first (in the
 *  order given), then the second best of each, and so on. And drops layouts that are only a slightly different size
 *  of one already on the shelf: the same arrangement of frames, in the same block of the page, is one layout; what
 *  differs between two such is a cut a few percent one way or the other, which nobody picks between. */
export function varyPatterns<T>(items: T[], templateOf: (item: T) => TemplateDefinition, aspect?: number): T[] {
  // Layouts that use the spread come first: a design whose frames cover under half the spread leaves most of it white. They are kept to the
  // end of the shelf, and only used at all when the fuller ones are too few to make a shelf.
  const rich = items.filter(item => coverage(templateOf(item)) >= MIN_COVERAGE)
  if (rich.length === items.length || rich.length < 4) return varyCore(items, templateOf, aspect)
  const fuller = varyCore(rich, templateOf, aspect)
  if (fuller.length >= WANTED_TEMPLATES) return fuller
  const sparse = items.filter(item => !rich.includes(item)).sort((p, q) => coverage(templateOf(q)) - coverage(templateOf(p)))
  return varyCore([...rich, ...sparse], templateOf, aspect)
}

/** The share of the spread the frames cover. */
export const coverage = (t: TemplateDefinition) => t.placeholders.reduce((sum, p) => sum + p.width * p.height, 0)
const MIN_COVERAGE = 0.5

function varyCore<T>(items: T[], templateOf: (item: T) => TemplateDefinition, aspect?: number): T[] {
  // The browsers do not offer a strip (Auto Build, which must find a fit for every photograph, still may use one).
  if (aspect) { const normal = items.filter(item => { const t = templateOf(item); return !t.isBuiltIn || normalFrames(t, aspect) }); if (normal.length >= MIN_EVEN_LAYOUTS) items = normal }
  const groups = new Map<string, T[]>()
  const seen = new Set<string>(), looks = new Set<string>(), copies = new Map<string, T[]>()
  for (const item of items) {
    const t = templateOf(item), head = `${t.pageSide}:${t.placeholders.length}:${t.textBoxes?.length ?? 0}`
    const fine = `${head}:${arrangementSignature(t.placeholders)}:${extent(t)}${t.placeholders.some(p => p.bleed) ? ':bleed' : ''}`
    // The same arrangement in the same block at a slightly different size is a copy too: it waits with the mirrored ones.
    if (seen.has(fine)) { const id = `${head}:${lookKey(t) || fine}`; const c = copies.get(id); if (c) c.push(item); else copies.set(id, [item]); continue }
    seen.add(fine)
    // The same arrangement mirrored, or drawn in a smaller or moved block, is not another template: it only moves the pictures about.
    // A layout is only another one's copy within the same structure (what goes on which page, and how each page is set): a layout with the
    // photographs on the other page, or a page full instead of filled, is a different template whatever it looks like.
    const structure = /^show2-/.test(t.id) ? t.name : ''
    const look = lookKey(t)
    if (look) { const id = `${head}:${structure}:${look}`; if (looks.has(id)) { const c = copies.get(id); if (c) c.push(item); else copies.set(id, [item]); continue } looks.add(id) }
    // Page layouts rotate by structure, the rest by pattern class, so one press after another is another way of setting the photographs.
    const key = structure ? `${head}:${structure}` : `${head}:${patternClass(t)}`, g = groups.get(key)
    if (g) g.push(item); else groups.set(key, [item])
  }
  const out: T[] = []
  const total = [...groups.values()].reduce((a, g) => a + g.length, 0)
  for (let depth = 0; out.length < total; depth++) for (const g of groups.values()) if (g[depth]) out.push(g[depth])
  if (out.length >= WANTED_TEMPLATES) return out
  // A shelf with fewer than thirty different arrangements is brought up to thirty with the same arrangements mirrored, resized or moved, after
  // all the different ones, one of each arrangement in turn, so every step is still another arrangement for as long as there is one.
  const extra: T[] = [], lists = [...copies.values()]
  for (let depth = 0; extra.length < WANTED_TEMPLATES - out.length && lists.some(l => l[depth]); depth++) for (const l of lists) if (l[depth] && extra.length < WANTED_TEMPLATES - out.length) extra.push(l[depth])
  return [...out, ...extra]
}

/** How many layouts a shelf is brought up to. */
const WANTED_TEMPLATES = 30

/** What a layout looks like with mirroring and block size taken out: each page's frames as a share of the block they fill (so a page filled
 *  edge to edge and the same page set smaller or moved are one look), the same whichever way the layout is mirrored, with which pages
 *  or one it uses. Empty for a single frame (where it sits is the point) and for text designs. */
export function lookKey(t: TemplateDefinition): string {
  const f = t.placeholders
  if (f.length < 2 || t.textBoxes?.length) return ''
  const crossing = f.some(p => p.x < 0.4999 && p.x + p.width > 0.5001)
  // Each side of the fold on its own; a design that straddles it is read whole.
  const sides = crossing ? [f] : [f.filter(p => p.x + p.width <= 0.5001), f.filter(p => p.x >= 0.4999)]
  // A page's frames as a share of the block they fill, flipped one way or another, with the cuts read to a fifth of the block: two layouts
  // that cut the same way within a few per cent of each other (or in a smaller or moved block, or mirrored) are one arrangement.
  const q = (v: number) => Math.round(v * 5)
  const topology = (list: typeof f, fx: number, fy: number) => {
    if (!list.length) return ''
    const x0 = Math.min(...list.map(p => p.x)), y0 = Math.min(...list.map(p => p.y)), x1 = Math.max(...list.map(p => p.x + p.width)), y1 = Math.max(...list.map(p => p.y + p.height))
    const w = x1 - x0 || 1, h = y1 - y0 || 1
    return list.map(p => {
      const x = (p.x - x0) / w, y = (p.y - y0) / h, ww = p.width / w, hh = p.height / h
      const left = fx ? 1 - x - ww : x, top = fy ? 1 - y - hh : y
      return [q(left), q(top), q(left + ww), q(top + hh)].join(',')
    }).sort().join('|')
  }
  const variants = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([fx, fy]) => (fx ? [...sides].reverse() : sides).map(list => topology(list, fx, fy)).join('/'))
  // (A layout on the left page and its mirror on the right are one look: the right-hand copy is only where the same design sits.)
  return (crossing ? 'X' : sides[0].length && sides[1].length ? 'B' : 'S') + variants.sort()[0]
}
