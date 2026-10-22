import { CSSProperties } from 'react'
import { TemplateDefinition, PhotoAsset, PlacedPhoto } from '@/types'
import { templateFramesInReadingOrder } from '@/engine/templateMatching'
import { resolveTemplateFrames } from '@/engine/templateLayout'
import { computeCoverCrop } from '@/engine/cropFit'

/** A single placeholder cell, filled with a real photo crop when one is available (so the
 *  preview shows what the layout will actually look like with real content) or a plain tinted
 *  box otherwise. Shared by every template thumbnail/preview in the app. */
export function PreviewCell({
  ph,
  photo,
  placement,
  aspect = 1,
}: {
  ph: TemplateDefinition['placeholders'][number]
  photo?: PhotoAsset
  placement?: PlacedPhoto
  aspect?: number
}) {
  const crop = photo && photo.width > 0 && photo.height > 0
    ? computeCoverCrop(photo.width, photo.height, ph.width * aspect, ph.height, placement?.focalX, placement?.focalY, placement?.zoom)
    : undefined
  return (
    <span
      className="gallery-cell"
      style={{
        left: `${ph.x * 100}%`,
        top: `${ph.y * 100}%`,
        width: `${ph.width * 100}%`,
        height: `${ph.height * 100}%`,
        backgroundImage: photo ? `url(${photo.src})` : undefined,
        backgroundSize: crop && photo ? `${photo.width / crop.cropWidth * 100}% ${photo.height / crop.cropHeight * 100}%` : undefined,
        backgroundPosition: crop && photo ? `${photo.width > crop.cropWidth ? crop.cropX / (photo.width - crop.cropWidth) * 100 : 50}% ${photo.height > crop.cropHeight ? crop.cropY / (photo.height - crop.cropHeight) * 100 : 50}%` : undefined,
        transform: placement ? `scale(${placement.flipHorizontal ? -1 : 1}, ${placement.flipVertical ? -1 : 1})` : undefined,
      }}
    />
  )
}

/** Renders a template's actual placeholder shape — not a flat color swatch — scaled to the given
 *  aspect ratio (pass the current project's spread aspect so previews always match the album's
 *  real proportions instead of assuming square). Used for both small quick-pick swatches and the
 *  larger hover/gallery preview panes, so a template looks the same shape everywhere it appears. */
export default function TemplateThumb({
  template,
  photos,
  aspect,
  className,
  marginPx = 0,
  gapPx = 0,
  placements,
  backgroundColor,
  borderColor,
  borderWidth,
}: {
  template: TemplateDefinition
  photos?: (PhotoAsset | undefined)[]
  aspect: number
  className?: string
  marginPx?: number
  gapPx?: number
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  placements?: PlacedPhoto[]
}) {
  return (
    <div className={`template-thumb ${className ?? ''}`} style={{ aspectRatio: aspect, backgroundColor, '--preview-border-color': borderColor, '--preview-border-width': borderWidth === undefined ? undefined : `${borderWidth / 900 * 100}cqw` } as CSSProperties}>
      {resolveTemplateFrames(templateFramesInReadingOrder(template), aspect, marginPx, gapPx).map((ph, i) => (
        <PreviewCell key={ph.id} ph={ph} photo={photos?.[i]} aspect={aspect} placement={placements?.find(p=>p.photoId===photos?.[i]?.id)} />
      ))}
    </div>
  )
}
