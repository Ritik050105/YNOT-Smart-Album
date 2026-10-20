import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { findTemplate } from '@/engine/templates'

interface Props {
  spread: Spread
  photosById: Map<string, PhotoAsset>
  size: AlbumSize
  /** Fixed pixel width (e.g. for a horizontal filmstrip where every thumbnail is the same size
   *  regardless of its container). Ignored when `responsive` is set. */
  width?: number
  /** Fills 100% of the container's width instead, keeping the album's own aspect ratio via CSS —
   *  for a responsive grid cell whose actual width isn't known ahead of time (e.g. the Spreads
   *  panel's left-to-right grid, which adapts to the sidebar's width). */
  responsive?: boolean
}

/** Lightweight CSS-only preview of a spread, used in the spreads strip and template picker
 *  (the full interactive render lives in DesignerCanvas / the Konva stage). */
export default function SpreadThumbnail({ spread, photosById, size, width, responsive }: Props) {
  const template = findTemplate(spread.templateId)
  const aspect = size.widthIn / size.heightIn

  return (
    <div
      className="spread-thumb"
      style={
        responsive
          ? { width: '100%', aspectRatio: aspect, background: spread.backgroundColor }
          : { width, height: (width ?? 0) / aspect, background: spread.backgroundColor }
      }
    >
      {template?.placeholders.map((ph) => {
        const placement = spread.placements.find((p) => p.placeholderId === ph.id)
        const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
        return (
          <div
            key={ph.id}
            className="spread-thumb__box"
            style={{
              left: `${ph.x * 100}%`,
              top: `${ph.y * 100}%`,
              width: `${ph.width * 100}%`,
              height: `${ph.height * 100}%`,
              backgroundImage: photo ? `url(${photo.src})` : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
