import { v4 as uuid } from 'uuid'
import { PhotoAsset, Spread, PlacedPhoto, TextBox } from '@/types'
import { suggestTemplate, BUILT_IN_TEMPLATES } from './templates'

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

export function defaultPlacement(placeholderId: string, photoId: string | null): PlacedPhoto {
  return {
    placeholderId,
    photoId,
    focalX: 0.5,
    focalY: 0.5,
    zoom: 1,
    borderWidth: 0,
    borderColor: '#ffffff',
    opacity: 1,
    warmth: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    frameStyle: 'none',
    rotationDeg: 0,
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

/** Builds full Spread records (template + placements) from timeline-grouped photos. "Auto-Build" entry point. */
export function autoBuildSpreads(photos: PhotoAsset[], options: AutoLayoutOptions = DEFAULT_AUTO_LAYOUT_OPTIONS): Spread[] {
  const groups = groupPhotosIntoMoments(photos, options)
  let lastTemplateId: string | undefined
  return groups.map((group, index) => {
    const template = suggestTemplate(group.length, lastTemplateId)
    lastTemplateId = template.id
    const placements: PlacedPhoto[] = template.placeholders.map((ph, i) =>
      defaultPlacement(ph.id, group[i]?.id ?? null)
    )
    const textBoxes: TextBox[] = []
    return {
      id: uuid(),
      order: index,
      pageSide: template.pageSide,
      templateId: template.id,
      placements,
      textBoxes,
      backgroundColor: '#ffffff',
      gapPx: 8,
      marginPx: 24,
    }
  })
}

/** Rebuilds a single spread's placements against a different template, keeping as many existing photos as possible. */
export function retemplateSpread(spread: Spread, templateId: string): Spread {
  const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId)
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
