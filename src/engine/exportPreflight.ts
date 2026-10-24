import { getPreferences } from '@/state/preferences'
import { Project } from '@/types'
import { computePlaceholderBoxes, DESIGN_WIDTH } from './layoutMath'
import { computeCoverCrop, effectiveDpi } from './cropFit'
import { selectSpreads } from './exportAlbum'

export function exportPreflight(project: Project, indices?: number[], includeCover = false) {
  const photos = new Map(project.photos.map((photo) => [photo.id, photo]))
  const selected = selectSpreads(project, indices, includeCover)
  const lowResolution = selected.filter((spread) => {
    const size = spread.size ?? project.size
    const background = spread.backgroundPattern
    if (!spread.backgroundHidden && background?.mode === 'cover' && background.width && background.height) {
      const crop = computeCoverCrop(background.width, background.height, size.widthIn, size.heightIn, background.edits?.focalX, background.edits?.focalY, background.edits?.zoom)
      if (effectiveDpi(background.width, background.height, crop, size.widthIn, size.heightIn) < size.dpi / (getPreferences().scalingThreshold / 100)) return true
    }
    return computePlaceholderBoxes(spread, DESIGN_WIDTH, DESIGN_WIDTH * size.heightIn / size.widthIn).some((box) => {
      const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
      if (placement?.hidden) return false
      const photo = placement?.photoId ? photos.get(placement.photoId) : undefined
      if (!photo || !placement) return false
      const crop = computeCoverCrop(photo.width, photo.height, box.width, box.height, placement.focalX, placement.focalY, placement.zoom)
      return effectiveDpi(photo.width, photo.height, crop, box.width * size.widthIn / DESIGN_WIDTH, box.height * size.widthIn / DESIGN_WIDTH) < size.dpi / (getPreferences().scalingThreshold / 100)
    })
  }).map((s) => s.id)
  const pageCount = project.spreads.filter((s) => !s.isCover).reduce((n, s) => n + (s.pageSide === 'spread' ? 2 : 1), 0)
  const coverNeedsReview = selected.some((s) => s.isCover && s.coverDetails && s.coverDetails.reviewedPageCount !== pageCount)
  return { lowResolution, coverNeedsReview }
}
