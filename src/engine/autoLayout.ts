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
  /** The reference app's "Match Timeline Order" — on (the default) keeps each spread's photos in
   *  strict chronological order even if that leaves a portrait photo in a landscape-preferred
   *  slot; off lets Auto-Build reorder photos *within* a spread (only within it — spreads
   *  themselves stay chronological) to better match each slot's preferred orientation. Only makes
   *  a visible difference when a spread's photos are a mix of orientations. */
  matchTimelineOrder: boolean
}

export const DEFAULT_AUTO_LAYOUT_OPTIONS: AutoLayoutOptions = {
  gapMinutes: 20,
  maxPhotosPerSpread: 6,
  matchTimelineOrder: true,
}

/** Assigns `group`'s photos to `placeholders` greedily by each slot's `preferredOrientation`,
 *  while otherwise keeping photos in their original (chronological) relative order — used when
 *  "Match Timeline Order" is off. For each slot in turn, picks the earliest still-unassigned
 *  photo whose orientation matches (or any orientation, for an 'any' slot); falls back to the
 *  earliest unassigned photo of any orientation if none matches, so every slot still gets filled. */
function matchGroupToPlaceholders<T extends { orientation: PhotoAsset['orientation'] }>(
  group: T[],
  placeholders: { preferredOrientation: 'landscape' | 'portrait' | 'any' }[]
): (T | null)[] {
  const remaining = group.map((photo, index) => ({ photo, index }))
  return placeholders.map((ph) => {
    if (remaining.length === 0) return null
    const preferred = ph.preferredOrientation
    const matchIndex =
      preferred === 'any'
        ? 0
        : remaining.findIndex(
            (r) => r.photo.orientation === preferred || (preferred === 'landscape' && r.photo.orientation === 'square')
          )
    const pick = remaining.splice(matchIndex === -1 ? 0 : matchIndex, 1)[0]
    return pick.photo
  })
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

/** Splits `photos` (in whatever order the caller wants kept) into exactly `count` roughly-equal,
 *  contiguous groups — the reference app's Auto Build dialog lets you drag a "Number of spreads"
 *  slider to override the smart-grouping suggestion; this is that override's grouping. */
export function splitPhotosIntoGroups(photos: PhotoAsset[], count: number): PhotoAsset[][] {
  const n = Math.max(1, Math.min(count, photos.length || 1))
  const groups: PhotoAsset[][] = []
  const base = Math.floor(photos.length / n)
  let extra = photos.length % n
  let i = 0
  for (let g = 0; g < n; g++) {
    const size = base + (extra > 0 ? 1 : 0)
    if (extra > 0) extra--
    groups.push(photos.slice(i, i + size))
    i += size
  }
  return groups
}

/** Builds full Spread records (template + placements) from already-grouped photos — the shared
 *  tail end of both `autoBuildSpreads` (time-based "Smart Grouping") and a manual grouping
 *  (the Auto Build dialog's spread-count override / "Specify range"). `enabledTemplateIds`
 *  narrows the 1-6 photo template pool to whatever was chosen in the New Project wizard's
 *  Template Library step (null = every built-in available). `layout` is that same wizard's
 *  "Layout Type" setting. `allowTemplateRepeats` is the Auto Build dialog's "Template reuse:
 *  High" — normally consecutive spreads avoid repeating the same template, which this skips. */
export function buildSpreadsFromGroups(
  groups: PhotoAsset[][],
  appearance: SpreadAppearanceDefaults = FALLBACK_APPEARANCE_DEFAULTS,
  enabledTemplateIds: string[] | null = null,
  layout: AutoBuildLayoutOptions = DEFAULT_AUTO_BUILD_LAYOUT,
  matchTimelineOrder = true,
  allowTemplateRepeats = false
): Spread[] {
  const pool = layout.includeFullSpreadTemplates ? enabledTemplateIds : narrowToSinglePage(enabledTemplateIds)
  const border = { width: appearance.borderWidth, color: appearance.borderColor }
  let lastTemplateId: string | undefined
  return groups.map((group, index) => {
    const forceSingle = (index === 0 && layout.start === 'single') || (index === groups.length - 1 && layout.end === 'single')
    const candidatePool = forceSingle ? narrowToSinglePage(pool) : pool
    const template = suggestTemplate(group.length, allowTemplateRepeats ? undefined : lastTemplateId, candidatePool)
    lastTemplateId = template.id
    const assigned = matchTimelineOrder ? group : matchGroupToPlaceholders(group, template.placeholders)
    const placements: PlacedPhoto[] = template.placeholders.map((ph, i) =>
      defaultPlacement(ph.id, assigned[i]?.id ?? null, border)
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
      guides: { horizontal: [], vertical: [] },
    }
  })
}

/** Builds full Spread records (template + placements) from timeline-grouped photos. "Auto-Build"
 *  entry point. See `buildSpreadsFromGroups` for what `enabledTemplateIds`/`layout` do. */
export function autoBuildSpreads(
  photos: PhotoAsset[],
  options: AutoLayoutOptions = DEFAULT_AUTO_LAYOUT_OPTIONS,
  appearance: SpreadAppearanceDefaults = FALLBACK_APPEARANCE_DEFAULTS,
  enabledTemplateIds: string[] | null = null,
  layout: AutoBuildLayoutOptions = DEFAULT_AUTO_BUILD_LAYOUT
): Spread[] {
  const groups = groupPhotosIntoMoments(photos, options)
  return buildSpreadsFromGroups(groups, appearance, enabledTemplateIds, layout, options.matchTimelineOrder)
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
    guides: { horizontal: [], vertical: [] },
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
    guides: { horizontal: [], vertical: [] },
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
    guides: { horizontal: [], vertical: [] },
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
