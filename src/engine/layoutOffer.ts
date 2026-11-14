import { PhotoAsset, TemplateDefinition } from '@/types'
import { frameSizeSpread, hasEvenMargins, supportsUniformGap } from './templateLayout'
import { templateCategory } from './templateTransfer'
import { templateOrderMismatches, templateShapeMismatches } from './templateMatching'
import { arrangementSignature, runsToTheTrim } from './templates'
import { patternClass } from './patternClass'
export { patternClass }

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
  const even = templates.filter(t => runsToTheTrim(t) || (hasEvenMargins(t.placeholders, aspect, marginPx, gapPx) && frameSizeSpread(t.placeholders) <= 6))
  return even.length >= MIN_EVEN_LAYOUTS ? even : templates
}

/** The one rule every browser applies after its own category and collection filters. */
export function offeredLayouts(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number, keepOrder = false, strict = false): TemplateDefinition[] {
  return preferEvenLayouts(onlyFittingShapes(photos, templates, aspect, marginPx, gapPx, keepOrder, strict), aspect, marginPx, gapPx)
}

/** Where a layout's frames, taken together, sit on the page: the bounding box to a tenth, so a layout that fills the page
 *  and the same arrangement set in a smaller block with white space round it are told apart. */
const extent = (t: TemplateDefinition) => {
  const f = t.placeholders
  return [Math.min(...f.map(p => p.x)), Math.min(...f.map(p => p.y)), Math.max(...f.map(p => p.x + p.width)), Math.max(...f.map(p => p.y + p.height))].map(v => Math.round(v * 10)).join(',')
}

/** Reorders a shelf so neighbours are different patterns: the best layout of every pattern class first (in the
 *  order given), then the second best of each, and so on. And drops layouts that are only a slightly different size
 *  of one already on the shelf: the same arrangement of frames, in the same block of the page, is one layout; what
 *  differs between two such is a cut a few percent one way or the other, which nobody picks between. */
export function varyPatterns<T>(items: T[], templateOf: (item: T) => TemplateDefinition, aspect?: number): T[] {
  // The browsers do not offer a strip (Auto Build, which must find a fit for every photograph, still may use one).
  if (aspect) { const normal = items.filter(item => { const t = templateOf(item); return !t.isBuiltIn || normalFrames(t, aspect) }); if (normal.length >= MIN_EVEN_LAYOUTS) items = normal }
  const groups = new Map<string, T[]>()
  const seen = new Set<string>()
  for (const item of items) {
    const t = templateOf(item), head = `${t.pageSide}:${t.placeholders.length}:${t.textBoxes?.length ?? 0}`
    const fine = `${head}:${arrangementSignature(t.placeholders)}:${extent(t)}`
    if (seen.has(fine)) continue
    seen.add(fine)
    const key = `${head}:${patternClass(t)}`, g = groups.get(key)
    if (g) g.push(item); else groups.set(key, [item])
  }
  const out: T[] = []
  const total = [...groups.values()].reduce((a, g) => a + g.length, 0)
  for (let depth = 0; out.length < total; depth++) for (const g of groups.values()) if (g[depth]) out.push(g[depth])
  return out
}
