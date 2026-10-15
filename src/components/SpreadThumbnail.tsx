import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { BUILT_IN_TEMPLATES } from '@/engine/templates'

interface Props {
  spread: Spread
  photosById: Map<string, PhotoAsset>
  size: AlbumSize
  width: number
}

/** Lightweight CSS-only preview of a spread, used in the spreads strip and template picker
 *  (the full interactive render lives in DesignerCanvas / the Konva stage). */
export default function SpreadThumbnail({ spread, photosById, size, width }: Props) {
  const template = BUILT_IN_TEMPLATES.find((t) => t.id === spread.templateId)
  const height = width / (size.widthIn / size.heightIn)

  return (
    <div
      className="spread-thumb"
      style={{ width, height, background: spread.backgroundColor }}
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
