import { v4 as uuid } from 'uuid'
import { PhotoAsset, Spread, PlacedPhoto, TextBox } from '@/types'
import { suggestTemplate, findTemplate, templatesForCount, TemplateFrameFilter } from './templates'
import { rankTemplates, templateFramesInReadingOrder } from './templateMatching'

export interface AutoLayoutOptions {
  groupBlackAndWhite?: boolean
  groupMetadata?: boolean
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

export function sortPhotosByCapturedAt(photos: PhotoAsset[]): PhotoAsset[] {
  const time = (photo: PhotoAsset) => { const value = Date.parse(photo.capturedAt); return Number.isFinite(value) ? value : Infinity }
  return [...photos].sort((a, b) => time(a) - time(b) || 0)
}

/** Groups photos into "moments" by elapsed time between consecutive shots, then caps group size. */
export function groupPhotosIntoMoments(photos: PhotoAsset[], options: AutoLayoutOptions): PhotoAsset[][] {
  const sorted = sortPhotosByCapturedAt(photos)
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
    const colorChanged = options.groupBlackAndWhite && photo.isBlackAndWhite !== undefined && prev.isBlackAndWhite !== undefined && photo.isBlackAndWhite !== prev.isBlackAndWhite
    const cameraChanged = options.groupMetadata && photo.cameraModel && prev.cameraModel && photo.cameraModel !== prev.cameraModel
    if (gapMin > options.gapMinutes || colorChanged || cameraChanged || current.length >= options.maxPhotosPerSpread) {
      groups.push(current)
      current = [photo]
    } else {
      current.push(photo)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups
}

export function suggestAutoBuildSpreadCount(photos: PhotoAsset[], options: AutoLayoutOptions): number {
  const moments = groupPhotosIntoMoments(photos, { ...options, groupBlackAndWhite: false, groupMetadata: false })
  return Math.max(moments.length, Math.ceil(photos.length / 4))
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
  aspect?: number
  frameFilter?: TemplateFrameFilter
}

export const DEFAULT_AUTO_BUILD_LAYOUT: AutoBuildLayoutOptions = {
  start: 'spread',
  end: 'spread',
  includeFullSpreadTemplates: true,
}

/** Splits `photos` (in whatever order the caller wants kept) into exactly `count` roughly-equal,
 *  contiguous groups — the reference app's Auto Build dialog lets you drag a "Number of spreads"
 *  slider to override the smart-grouping suggestion; this is that override's grouping. */
export function splitPhotosIntoGroups(photos: PhotoAsset[], count: number): PhotoAsset[][] {
  if (photos.length === 0) return []
  const n = Math.max(1, Math.min(Number.isFinite(count) ? Math.round(count) : 1, photos.length))
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

/** Respect the requested range whenever the photo count permits it. */
export function spreadCountRange(photoCount: number, minPhotos: number, maxPhotos: number) {
  const max = Math.max(1, Math.min(30, Math.floor(maxPhotos) || 1))
  const min = Math.max(1, Math.min(max, Math.floor(minPhotos) || 1))
  const minSpreads = Math.max(1, Math.ceil(photoCount / max))
  return { min: minSpreads, max: Math.max(minSpreads, Math.floor(photoCount / min)) }
}

/** Keep meaningful cuts when a user changes the count, instead of flattening smart groups. */
export function groupPhotosForCount(photos: PhotoAsset[], count: number, options: AutoLayoutOptions, min = 1, max = 30, canGroup?: (size: number, index: number) => boolean): PhotoAsset[][] {
  if (!photos.length) return []
  max = Math.max(1, Math.min(30, Math.floor(max) || 1))
  min = Math.max(1, Math.min(max, Math.floor(min) || 1))
  const sorted = sortPhotosByCapturedAt(photos)
  const range = spreadCountRange(sorted.length, min, max)
  const n = Math.max(range.min, Math.min(range.max, Math.round(count) || range.min))
  const minimum = sorted.length >= n * min ? min : 1
  const boundaries = new Map<number, number>()
  let offset = 0
  for (const group of groupPhotosIntoMoments(sorted, { ...options, maxPhotosPerSpread: Math.min(max, options.maxPhotosPerSpread) })) {
    offset += group.length
    boundaries.set(offset, 0.5)
  }
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1], photo = sorted[i]
    const minutes = Math.max(0, (Date.parse(photo.capturedAt) - Date.parse(previous.capturedAt)) / 60000)
    let weight = boundaries.get(i) ?? 0
    if (Number.isFinite(minutes) && Number.isFinite(options.gapMinutes)) weight += Math.log1p(minutes / Math.max(1, options.gapMinutes))
    if (options.groupBlackAndWhite && previous.isBlackAndWhite !== undefined && photo.isBlackAndWhite !== undefined && previous.isBlackAndWhite !== photo.isBlackAndWhite) weight += 4
    if (options.groupMetadata && previous.cameraModel && photo.cameraModel && previous.cameraModel !== photo.cameraModel) weight += 2
    boundaries.set(i, weight)
  }
  const preferredCount = Math.max(range.min, Math.min(range.max, suggestAutoBuildSpreadCount(sorted, options)))
  const preserveRecommendation = n !== preferredCount && (Number.isFinite(options.gapMinutes) || options.groupBlackAndWhite || options.groupMetadata)
  // A count adjustment should retain the recommended cuts when the new bounds and library allow it.
  if (preserveRecommendation) {
    let cut = 0
    for (const group of groupPhotosForCount(sorted, preferredCount, options, min, max)) {
      cut += group.length
      boundaries.set(cut, (boundaries.get(cut) ?? 0) + 0.5)
    }
  }
  let previousCosts = new Float64Array(sorted.length + 1).fill(Infinity)
  // Group lengths are bounded to 30, so one byte per cut is sufficient for large albums.
  const cuts = Array.from({ length: n + 1 }, () => new Uint8Array(sorted.length + 1))
  previousCosts[0] = 0
  for (let groups = 1; groups <= n; groups++) {
    const costs = new Float64Array(sorted.length + 1).fill(Infinity)
    for (let end = Math.max(groups * minimum, sorted.length - (n - groups) * max); end <= Math.min(sorted.length - (n - groups) * minimum, groups * max); end++) {
      for (let start = Math.max((groups - 1) * minimum, end - max); start <= end - minimum; start++) {
        if (!Number.isFinite(previousCosts[start]) || (canGroup && !canGroup(end - start, groups - 1))) continue
        const cost = previousCosts[start] + 0.02 * (end - start - sorted.length / n) ** 2 - (boundaries.get(start) ?? 0)
        if (cost < costs[end] || (preserveRecommendation && cost <= costs[end] + 1e-9)) { costs[end] = cost; cuts[groups][end] = end - start }
      }
    }
    previousCosts = costs
  }
  const result: PhotoAsset[][] = []
  let end = sorted.length
  for (let groups = n; groups > 0; groups--) {
    const length = cuts[groups][end]
    if (!length) {
      if (canGroup) throw new Error('The enabled templates cannot group these images into the requested number of spreads. Change the spread count, image range or template filters.')
      return splitPhotosIntoGroups(sorted, n)
    }
    const start = end - length
    result.unshift(sorted.slice(start, end))
    end = start
  }
  return result
}

export function autoBuildTemplates(count: number, enabledTemplateIds: string[] | null, layout: AutoBuildLayoutOptions, single = false) {
  const candidates = templatesForCount(count, enabledTemplateIds, layout.frameFilter, layout.aspect)
  return single || layout.includeFullSpreadTemplates ? candidates : candidates.filter((template) => template.placeholders.every((frame) => frame.x + frame.width <= 0.50001 || frame.x >= 0.49999))
}

export function autoBuildGroupFilter(spreadCount: number, enabledTemplateIds: string[] | null, layout: AutoBuildLayoutOptions) {
  const available = new Map<string, boolean>()
  return (count: number, index: number) => {
    const single = (index === 0 && layout.start === 'single') || (index === spreadCount - 1 && layout.end === 'single')
    const key = `${count}:${single}`
    if (!available.has(key)) available.set(key, autoBuildTemplates(count, enabledTemplateIds, layout, single).length > 0)
    return available.get(key)!
  }
}

export function autoBuildSpreadCounts(photoCount: number, preferred: number, enabledTemplateIds: string[] | null, layout: AutoBuildLayoutOptions, min = 1, max = 30) {
  const sizes = Array.from({ length: 30 }, (_, i) => i + 1).filter((size) => size >= min && size <= max && (autoBuildTemplates(size, enabledTemplateIds, layout).length || ((layout.start === 'single' || layout.end === 'single') && autoBuildTemplates(size, enabledTemplateIds, layout, true).length)))
  if (!sizes.length) throw new Error('No enabled template matches the current image range, frame and layout filters.')
  const divisor = sizes.reduce((a, b) => { while (b) { const remainder = a % b; a = b; b = remainder } return a })
  if (photoCount % divisor) throw new Error('The enabled templates cannot group these images. Change the template filters or image selection.')
  const range = spreadCountRange(photoCount, Math.min(...sizes), Math.max(...sizes))
  return Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))
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
  allowTemplateRepeats = false,
  templateReuse: 'low' | 'medium' | 'high' = allowTemplateRepeats ? 'high' : 'medium'
): Spread[] {
  const border = { width: appearance.borderWidth, color: appearance.borderColor }
  let lastTemplateId: string | undefined
  const uses = new Map<string, number>()
  return groups.map((group, index) => {
    const forceSingle = (index === 0 && layout.start === 'single') || (index === groups.length - 1 && layout.end === 'single')
    let candidates = autoBuildTemplates(group.length, enabledTemplateIds, layout, forceSingle)
    if (!candidates.length) throw new Error(`No enabled template matches ${group.length} images with the current frame and layout filters. Change the filters or images per spread.`)
    if (templateReuse === 'low' && candidates.length) {
      const leastUsed = Math.min(...candidates.map((t) => uses.get(t.id) ?? 0))
      candidates = candidates.filter((t) => (uses.get(t.id) ?? 0) === leastUsed)
    }
    const ranked = rankTemplates(group, candidates, layout.aspect ?? 1, matchTimelineOrder, appearance.marginPx, appearance.gapPx)
    if (templateReuse === 'medium') ranked.sort((a, b) => (a.score + (a.template.id === lastTemplateId ? 0.02 : 0)) - (b.score + (b.template.id === lastTemplateId ? 0.02 : 0)))
    const { template, photos: assigned, score } = ranked[0]
    if (!Number.isFinite(score) || score >= 1) throw new Error('No matching template has usable frame dimensions. Reduce the margin or gap.')
    uses.set(template.id, (uses.get(template.id) ?? 0) + 1)
    lastTemplateId = template.id
    const placements: PlacedPhoto[] = template.placeholders.map((ph, i) =>
      defaultPlacement(ph.id, assigned[i]?.id ?? null, border)
    )
    const readingOrder = templateFramesInReadingOrder(template)
    placements.sort((a, b) => readingOrder.findIndex(frame => frame.id === a.placeholderId) - readingOrder.findIndex(frame => frame.id === b.placeholderId))
    const textBoxes: TextBox[] = []
    return {
      id: uuid(),
      order: index,
      pageSide: forceSingle ? (index === 0 ? 'right' : 'left') : template.pageSide,
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
  if (!photos.length) return []
  const counts = autoBuildSpreadCounts(photos.length, suggestAutoBuildSpreadCount(photos, options), enabledTemplateIds, layout)
  let groups: PhotoAsset[][] | undefined
  for (const count of counts) {
    try { groups = groupPhotosForCount(photos, count, options, 1, 30, autoBuildGroupFilter(count, enabledTemplateIds, layout)); break }
    catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('The enabled templates cannot group')) throw error
    }
  }
  if (!groups) throw new Error('The enabled templates cannot group these images. Change the template filters or image selection.')
  return buildSpreadsFromGroups(groups, appearance, enabledTemplateIds, layout, options.matchTimelineOrder)
}

/** Rebuilds a single spread's placements against a different template, keeping as many existing photos as possible. */
export function retemplateSpread(spread: Spread, templateId: string, photos?: PhotoAsset[], aspect = 1, keepOrder = true): Spread {
  const template = findTemplate(templateId)
  if (!template) return spread
  const existing = spread.placements.filter((p) => p.photoId)
  if (existing.length > template.placeholders.length) return spread
  let ordered = existing
  if (!keepOrder && photos && existing.length === template.photoCount) {
    const assets = existing.map(p => photos.find(photo => photo.id === p.photoId)).map(photo => photo ? { ...photo } : undefined)
    if (assets.every((photo): photo is PhotoAsset => !!photo)) {
      const match = rankTemplates(assets, [template], aspect, false, spread.marginPx, spread.gapPx)[0]
      const assigned = match.photos.map(photo => existing[assets.indexOf(photo)])
      ordered = templateFramesInReadingOrder(template).map(frame => assigned[template.placeholders.indexOf(frame)])
    }
  }
  const placements = templateFramesInReadingOrder(template).map((ph, i) => ordered[i] ? { ...ordered[i], placeholderId: ph.id } : defaultPlacement(ph.id, null))
  return { ...spread, templateId: template.id, customBoxes: undefined, placements }
}

export function buildSpreadFromPlacements(source: PlacedPhoto[], pageSide: Spread['pageSide'], like: Spread): Spread {
  const template = suggestTemplate(Math.max(source.length, 1))
  const columns = Math.max(1, Math.ceil(Math.sqrt(source.length)))
  const rows = Math.ceil(source.length / columns)
  const customBoxes = source.length > 30 ? source.map((_, i) => ({ id: uuid(), x: (i % columns) / columns, y: Math.floor(i / columns) / rows, width: 1 / columns, height: 1 / rows, preferredOrientation: 'any' as const })) : undefined
  const frames = customBoxes ?? template.placeholders
  const placements = frames.map((ph, i) => source[i] ? { ...source[i], placeholderId: ph.id } : defaultPlacement(ph.id, null))
  return {
    id: uuid(),
    order: like.order,
    pageSide,
    templateId: template.id,
    customBoxes,
    placements,
    textBoxes: [],
    backgroundColor: like.backgroundColor,
    backgroundPattern: like.backgroundPattern,
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
export function splitSpreadIntoPages(spread: Spread, cutIndex?: number): [Spread, Spread] {
  const mid = cutIndex ?? Math.ceil(spread.placements.length / 2)
  const left = buildSpreadFromPlacements(spread.placements.slice(0, mid), cutIndex === undefined ? 'left' : 'spread', spread)
  left.id = spread.id
  const right = buildSpreadFromPlacements(spread.placements.slice(mid), cutIndex === undefined ? 'right' : 'spread', spread)
  left.textBoxes = spread.textBoxes
  return [left, right]
}

/** Merges two adjacent spreads/pages back into a single full spread, combining their photos and text. */
export function mergeSpreads(a: Spread, b: Spread): Spread {
  const merged = buildSpreadFromPlacements([...a.placements, ...b.placements], 'spread', a)
  merged.id = a.id
  merged.textBoxes = [...a.textBoxes, ...b.textBoxes]
  return merged
}
