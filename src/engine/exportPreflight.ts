import { Project } from '@/types'
import { computePlaceholderBoxes, DESIGN_WIDTH } from './layoutMath'
import { computeCoverCrop, effectiveDpi } from './cropFit'
import { selectSpreads } from './exportAlbum'

export function exportPreflight(project: Project, indices?: number[], includeCover = false) {
  const photos = new Map(project.photos.map((photo) => [photo.id, photo]))
  const selected = selectSpreads(project, indices, includeCover)
  const lowResolution = selected.filter((spread) => {
    const size = spread.size ?? project.size
    return computePlaceholderBoxes(spread, DESIGN_WIDTH, DESIGN_WIDTH * size.heightIn / size.widthIn).some((box) => {
      const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
      const photo = placement?.photoId ? photos.get(placement.photoId) : undefined
      if (!photo || !placement) return false
      const crop = computeCoverCrop(photo.width, photo.height, box.width, box.height, placement.focalX, placement.focalY, placement.zoom)
      return effectiveDpi(photo.width, photo.height, crop, box.width * size.widthIn / DESIGN_WIDTH, box.height * size.widthIn / DESIGN_WIDTH) < size.dpi / 1.2
    })
  }).map((s) => s.id)
  const pageCount = project.spreads.filter((s) => !s.isCover).reduce((n, s) => n + (s.pageSide === 'spread' ? 2 : 1), 0)
  const coverNeedsReview = selected.some((s) => s.isCover && s.coverDetails && s.coverDetails.reviewedPageCount !== pageCount)
  return { lowResolution, coverNeedsReview }
}
