import { v4 as uuid } from 'uuid'
import { PhotoAsset, Spread, PlacedPhoto, TextBox } from '@/types'
import { suggestTemplate, findTemplate, BUILT_IN_TEMPLATES } from './templates'

export interface AutoLayoutOptions {
  /**
   * Minutes of silence between shots that signals a new "moment" (and thus a new spread).
   * Lower = more, smaller spreads; higher = fewer, bigger spreads. This is the
   * "timeline based sorting" sensitivity knob exposed in the UI.
   */
  gapMinutes: number
  maxPhotosPerSpread: number
}

export const DEFAULT_AUTO_LAYOUT_OPTIONS: AutoLayoutOptions = {
  gapMinutes: 20,
  maxPhotosPerSpread: 6,
}

export function defaultPlacement(
  placeholderId: string,
  photoId: string | null,
  border: { width: number; color: string } = { width: 0, color: '#ffffff' }
): PlacedPhoto {
  return {
    placeholderId,
    photoId,
    focalX: 0.5,
    focalY: 0.5,
    zoom: 1,
    borderWidth: border.width,
    borderColor: border.color,
    opacity: 1,
    warmth: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    frameStyle: 'none',
    rotationDeg: 0,
    relightIntensity: 0,
    cornerRadiusPx: 24,
    flipHorizontal: false,
    flipVertical: false,
  }
}

/** Groups photos into "moments" by elapsed time between consecutive shots, then caps group size. */
export function groupPhotosIntoMoments(photos: PhotoAsset[], options: AutoLayoutOptions): PhotoAsset[][] {
  const sorted = [...photos].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
  const groups: PhotoAsset[][] = []
  let current: PhotoAsset[] = []

  for (let i = 0; i < sorted.length; i++) {
    const photo = sorted[i]
    if (current.length === 0) {
      current.push(photo)
      continue
    }
    const prev = current[current.length - 1]
    const gapMs = new Date(photo.capturedAt).getTime() - new Date(prev.capturedAt).getTime()
    const gapMin = gapMs / 60000
    if (gapMin > options.gapMinutes || current.length >= options.maxPhotosPerSpread) {
      groups.push(current)
      current = [photo]
    } else {
      current.push(photo)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

export interface SpreadAppearanceDefaults {
  backgroundColor: string
  gapPx: number
  marginPx: number
  borderWidth: number
  borderColor: string
}

export const FALLBACK_APPEARANCE_DEFAULTS: SpreadAppearanceDefaults = {
  backgroundColor: '#ffffff',
  gapPx: 8,
  marginPx: 24,
  borderWidth: 0,
  borderColor: '#ffffff',
}

/** New Project wizard's "Layout Type: Starts with / Ends with / Include full spread templates". */
export interface AutoBuildLayoutOptions {
  start: 'spread' | 'single'
  end: 'spread' | 'single'
  includeFullSpreadTemplates: boolean
}

export const DEFAULT_AUTO_BUILD_LAYOUT: AutoBuildLayoutOptions = {
  start: 'spread',
  end: 'spread',
  includeFullSpreadTemplates: true,
}

/** Narrows a template id pool down to single-page (non-"spread") templates — falls back to the
 *  original pool if that would leave nothing to choose from, same "don't produce zero candidates"
 *  rule `templatesForCount` already follows. */
function narrowToSinglePage(ids: string[] | null): string[] | null {
  const base = ids ?? BUILT_IN_TEMPLATES.map((t) => t.id)
  const singlePage = base.filter((id) => findTemplate(id)?.pageSide !== 'spread')
  return singlePage.length > 0 ? singlePage : ids
}

/** Builds full Spread records (template + placements) from timeline-grouped photos. "Auto-Build"
 *  entry point. `enabledTemplateIds` narrows the 1-6 photo template pool to whatever was chosen
 *  in the New Project wizard's Template Library step (null/omitted = every built-in available).
 *  `layout` is that same wizard's "Layout Type" setting — whether the album's first/last interior
 *  spread must stay a single page, and whether two-page templates are offered at all. */
export function autoBuildSpreads(
  photos: PhotoAsset[],
  options: AutoLayoutOptions = DEFAULT_AUTO_LAYOUT_OPTIONS,
  appearance: SpreadAppearanceDefaults = FALLBACK_APPEARANCE_DEFAULTS,
  enabledTemplateIds: string[] | null = null,
  layout: AutoBuildLayoutOptions = DEFAULT_AUTO_BUILD_LAYOUT
): Spread[] {
  const groups = groupPhotosIntoMoments(photos, options)
  const pool = layout.includeFullSpreadTemplates ? enabledTemplateIds : narrowToSinglePage(enabledTemplateIds)
  const border = { width: appearance.borderWidth, color: appearance.borderColor }
  let lastTemplateId: string | undefined
  return groups.map((group, index) => {
    const forceSingle = (index === 0 && layout.start === 'single') || (index === groups.length - 1 && layout.end === 'single')
    const candidatePool = forceSingle ? narrowToSinglePage(pool) : pool
    const template = suggestTemplate(group.length, lastTemplateId, candidatePool)
    lastTemplateId = template.id
    const placements: PlacedPhoto[] = template.placeholders.map((ph, i) =>
      defaultPlacement(ph.id, group[i]?.id ?? null, border)
    )
    const textBoxes: TextBox[] = []
    return {
      id: uuid(),
      order: index,
      pageSide: template.pageSide,
      templateId: template.id,
      placements,
      textBoxes,
      backgroundColor: appearance.backgroundColor,
      gapPx: appearance.gapPx,
      marginPx: appearance.marginPx,
      flipped: false,
      isCover: false,
    }
  })
}

/** Rebuilds a single spread's placements against a different template, keeping as many existing photos as possible. */
export function retemplateSpread(spread: Spread, templateId: string): Spread {
  const template = findTemplate(templateId)
  if (!template) return spread
  const existingPhotoIds = spread.placements.map((p) => p.photoId).filter((id): id is string => !!id)
  const placements = template.placeholders.map((ph, i) => defaultPlacement(ph.id, existingPhotoIds[i] ?? null))
  return { ...spread, templateId: template.id, placements }
}

function buildSpreadFromPhotoIds(photoIds: (string | null)[], pageSide: Spread['pageSide'], like: Spread): Spread {
  const template = suggestTemplate(Math.max(photoIds.length, 1))
  const placements = template.placeholders.map((ph, i) => defaultPlacement(ph.id, photoIds[i] ?? null))
  return {
    id: uuid(),
    order: like.order,
    pageSide,
    templateId: template.id,
    placements,
    textBoxes: [],
    backgroundColor: like.backgroundColor,
    gapPx: like.gapPx,
    marginPx: like.marginPx,
    flipped: false,
    isCover: false,
  }
}

/** Mirrors a spread's layout horizontally — doesn't touch the template definition, just flips
 *  how it reads when rendered. */
export function flipSpreadHorizontally(spread: Spread): Spread {
  return { ...spread, flipped: !spread.flipped }
}

/** Creates an empty spread with the single full-bleed template, ready for photos to be dropped
 *  in — "Add Blank Spread". */
export function createBlankSpread(order: number, appearance: SpreadAppearanceDefaults): Spread {
  const template = findTemplate('full-bleed')!
  const border = { width: appearance.borderWidth, color: appearance.borderColor }
  return {
    id: uuid(),
    order,
    pageSide: template.pageSide,
    templateId: template.id,
    placements: template.placeholders.map((ph) => defaultPlacement(ph.id, null, border)),
    textBoxes: [],
    backgroundColor: appearance.backgroundColor,
    gapPx: appearance.gapPx,
    marginPx: appearance.marginPx,
    flipped: false,
    isCover: false,
  }
}

/** Creates the album's front/spine/back cover — a separate, pinned-first spread (order -1) using
 *  a dedicated cover template so it's visually distinct from interior pages from the start. */
export function createCoverSpread(appearance: SpreadAppearanceDefaults): Spread {
  const template = findTemplate('cover-front-spine-back')!
  const border = { width: appearance.borderWidth, color: appearance.borderColor }
  return {
    id: uuid(),
    order: -1,
    pageSide: 'spread',
    templateId: template.id,
    placements: template.placeholders.map((ph) => defaultPlacement(ph.id, null, border)),
    textBoxes: [],
    backgroundColor: appearance.backgroundColor,
    gapPx: appearance.gapPx,
    marginPx: appearance.marginPx,
    flipped: false,
    isCover: true,
  }
}

/** Splits one spread into two independent pages (left/right), dividing its photos between them.
 *  Any text boxes on the original spread stay with the left page. */
export function splitSpreadIntoPages(spread: Spread): [Spread, Spread] {
  const photoIds = spread.placements.map((p) => p.photoId)
  const mid = Math.ceil(photoIds.length / 2)
  const left = buildSpreadFromPhotoIds(photoIds.slice(0, mid), 'left', spread)
  const right = buildSpreadFromPhotoIds(photoIds.slice(mid), 'right', spread)
  left.textBoxes = spread.textBoxes
  return [left, right]
}

/** Merges two adjacent spreads/pages back into a single full spread, combining their photos and text. */
export function mergeSpreads(a: Spread, b: Spread): Spread {
  const photoIds = [...a.placements, ...b.placements].map((p) => p.photoId)
  const merged = buildSpreadFromPhotoIds(photoIds, 'spread', a)
  merged.textBoxes = [...a.textBoxes, ...b.textBoxes]
  return merged
}
