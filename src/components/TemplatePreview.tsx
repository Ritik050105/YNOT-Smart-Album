import { TemplateDefinition, PhotoAsset } from '@/types'

/** A single placeholder cell, filled with a real photo crop when one is available (so the
 *  preview shows what the layout will actually look like with real content) or a plain tinted
 *  box otherwise. Shared by every template thumbnail/preview in the app. */
export function PreviewCell({
  ph,
  photo,
}: {
  ph: TemplateDefinition['placeholders'][number]
  photo?: PhotoAsset
}) {
  return (
    <span
      className="gallery-cell"
      style={{
        left: `${ph.x * 100}%`,
        top: `${ph.y * 100}%`,
        width: `${ph.width * 100}%`,
        height: `${ph.height * 100}%`,
        backgroundImage: photo ? `url(${photo.src})` : undefined,
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
}: {
  template: TemplateDefinition
  photos?: (PhotoAsset | undefined)[]
  aspect: number
  className?: string
}) {
  return (
    <div className={`template-thumb ${className ?? ''}`} style={{ aspectRatio: aspect }}>
      {template.placeholders.map((ph, i) => (
        <PreviewCell key={ph.id} ph={ph} photo={photos?.[i]} />
      ))}
    </div>
  )
}
