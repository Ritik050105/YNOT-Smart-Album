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
export function onlyFittingShapes(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number, keepOrder = false): TemplateDefinition[] {
  if (!photos.length) return templates
  const judged = templates.filter(t => t.placeholders.length === photos.length)
  if (!judged.length) return templates
  const count = keepOrder ? templateOrderMismatches : templateShapeMismatches
  const missed = new Map(judged.map(t => [t.id, count(photos, t, aspect, marginPx, gapPx)]))
  const fewest = Math.min(...missed.values())
  return templates.filter(t => !missed.has(t.id) || missed.get(t.id) === fewest)
}

/** Layouts whose spacing honours the album's gap: built-in layouts must leave exactly the chosen gap
 *  between neighbouring frames. Designs that run to the trim, and the designer's own templates, are
 *  exempt. If nothing passes, the list is returned as it was rather than empty. */
export function uniformGapLayouts(templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number): TemplateDefinition[] {
  const kept = templates.filter(t => templateCategory(t) !== 'reference' || runsToTheTrim(t) || supportsUniformGap(t.placeholders, aspect, marginPx, gapPx))
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
export function offeredLayouts(photos: PhotoAsset[], templates: TemplateDefinition[], aspect: number, marginPx: number, gapPx: number, keepOrder = false): TemplateDefinition[] {
  return preferEvenLayouts(onlyFittingShapes(photos, templates, aspect, marginPx, gapPx, keepOrder), aspect, marginPx, gapPx)
}
