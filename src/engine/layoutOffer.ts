import { PhotoAsset, TemplateDefinition } from '@/types'
import { frameSizeSpread, hasEvenMargins, supportsUniformGap } from './templateLayout'
import { templateCategory } from './templateTransfer'
import { templateOrderMismatches, templateShapeMismatches } from './templateMatching'
import { runsToTheTrim } from './templates'

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

/** Layouts with an even border all round and frames of comparable size, which is what the album's
 *  margin and gap settings promise. Full-bleed designs are exempt, since running to the trim is
 *  their point. Kept only while enough of them remain to choose from. */
export function preferEvenLayouts(templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number): TemplateDefinition[] {
  const even = templates.filter(t => runsToTheTrim(t) || (hasEvenMargins(t.placeholders, aspect, marginPx, gapPx) && frameSizeSpread(t.placeholders) <= 6))
  return even.length >= MIN_EVEN_LAYOUTS ? even : templates
}

/** The one rule every browser applies after its own category and collection filters. */
export function offeredLayouts(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number, keepOrder = false, strict = false): TemplateDefinition[] {
  return preferEvenLayouts(onlyFittingShapes(photos, templates, aspect, marginPx, gapPx, keepOrder, strict), aspect, marginPx, gapPx)
}

/** The kind of pattern a layout is, ignoring mirroring and exact proportions: how the page is first cut (a
 *  straight line top to bottom, side to side, both, or neither), whether one frame dominates, evenly sized
 *  frames or a mix of sizes, and how many grid lines it is built on. A layout and its mirror, or the same cut at
 *  another size, share a class; a rows layout, a columns layout, a feature-and-grid and a pinwheel do not. */
const classes = new WeakMap<TemplateDefinition['placeholders'], string>()
export function patternClass(t: TemplateDefinition): string {
  let hit = classes.get(t.placeholders)
  if (hit) return hit
  const f = t.placeholders, tol = 0.03
  const lines = (edges: number[]) => { const out: number[] = []; for (const v of [...edges].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > tol) out.push(v); return out }
  const xs = lines(f.flatMap(p => [p.x, p.x + p.width])), ys = lines(f.flatMap(p => [p.y, p.y + p.height]))
  const cuts = (list: number[], from: 'x' | 'y', size: 'width' | 'height') => list.filter(v => v > tol && v < 1 - tol && f.every(p => p[from] + p[size] <= v + tol || p[from] >= v - tol)).length
  const across = cuts(xs, 'x', 'width'), down = cuts(ys, 'y', 'height')
  const areas = f.map(p => p.width * p.height), big = Math.max(...areas), small = Math.min(...areas)
  const weight = big >= 0.4 ? 'H' : big / small <= 1.6 ? 'E' : 'M'
  hit = `${across && down ? '+' : across ? '|' : down ? '-' : '@'}${weight}${xs.length}x${ys.length}`
  classes.set(t.placeholders, hit)
  return hit
}

/** Reorders a shelf so neighbours are different patterns: the best layout of every pattern class first (in the
 *  order given), then the second best of each, and so on. Layouts that differ only by a mirror or where one cut
 *  falls are the same pattern, and pressing Next should not walk through five of them in a row. */
export function varyPatterns<T>(items: T[], templateOf: (item: T) => TemplateDefinition): T[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const t = templateOf(item), key = `${t.pageSide}:${t.placeholders.length}:${t.textBoxes?.length ?? 0}:${patternClass(t)}`
    const g = groups.get(key)
    if (g) g.push(item); else groups.set(key, [item])
  }
  const out: T[] = []
  for (let depth = 0; out.length < items.length; depth++) for (const g of groups.values()) if (g[depth]) out.push(g[depth])
  return out
}
