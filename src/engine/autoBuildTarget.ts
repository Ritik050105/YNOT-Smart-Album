import { PhotoAsset, Spread } from '@/types'

/** Which photos an "Auto Build" click should act on — the reference app requires selecting at
 *  least 2 photos in the dock first; this keeps that power-user path (drive it from a deliberate
 *  selection) while still being usable with a single click: with fewer than 2 photos selected it
 *  falls back to every unplaced photo instead of refusing outright. */
export function autoBuildTargetPhotoIds(photos: PhotoAsset[], spreads: Spread[], selectedPhotoIds: string[]): string[] {
  if (selectedPhotoIds.length >= 2) return selectedPhotoIds
  const placedIds = new Set(spreads.flatMap((s) => s.placements.map((p) => p.photoId).filter((id): id is string => !!id)))
  return photos.filter((p) => !placedIds.has(p.id)).map((p) => p.id)
}
