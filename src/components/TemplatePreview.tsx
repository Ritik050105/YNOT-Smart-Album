import {drawTextBox} from '@/engine/renderSpread'
import {usePreviewSource} from '@/engine/previewImage'
import { CSSProperties, useState, useEffect } from 'react'
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
  const preview=usePreviewSource(photo?.src??'',512)
  const crop = photo && photo.width > 0 && photo.height > 0
    ? computeCoverCrop(photo.width, photo.height, ph.width * aspect, ph.height, placement?.focalX, placement?.focalY, placement?.zoom)
    : undefined
  // A frame that runs to the trim is drawn without a border on that side. The border is there to
  // separate one photograph from the next; on the outer edge it is a hairline of panel colour
  // around a photograph that is meant to reach the paper's edge, which makes a full-spread layout
  // preview as an inset one — the single thing that tells the two apart at thumbnail size.
  const trim = (v: number) => v <= 0.001
  const edge = { left: trim(ph.x), top: trim(ph.y), right: trim(1 - ph.x - ph.width), bottom: trim(1 - ph.y - ph.height) }
  return (
    <span
      className="gallery-cell"
      style={{
        borderLeftWidth: edge.left ? 0 : undefined,
        borderTopWidth: edge.top ? 0 : undefined,
        borderRightWidth: edge.right ? 0 : undefined,
        borderBottomWidth: edge.bottom ? 0 : undefined,
        left: `${ph.x * 100}%`,
        top: `${ph.y * 100}%`,
        width: `${ph.width * 100}%`,
        height: `${ph.height * 100}%`,
        backgroundImage: photo ? `url(${JSON.stringify(preview)})` : undefined,
        backgroundSize: crop && photo ? `${photo.width / crop.cropWidth * 100}% ${photo.height / crop.cropHeight * 100}%` : undefined,
        backgroundPosition: crop && photo ? `${photo.width > crop.cropWidth ? crop.cropX / (photo.width - crop.cropWidth) * 100 : 50}% ${photo.height > crop.cropHeight ? crop.cropY / (photo.height - crop.cropHeight) * 100 : 50}%` : undefined,
        transform: placement ? `scale(${placement.flipHorizontal ? -1 : 1}, ${placement.flipVertical ? -1 : 1})` : undefined,
        borderRadius: ph.cornerRadiiPx ? ph.cornerRadiiPx.map(r => `${r / 900 * 100}cqw`).join(' ') : ph.cornerRadiusPx ? `${ph.cornerRadiusPx / 900 * 100}cqw` : undefined,
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
  const [textPreview,setTextPreview]=useState('')
  useEffect(()=>{let live=true;const canvas=document.createElement('canvas');canvas.width=360;canvas.height=Math.round(360/aspect);const ctx=canvas.getContext('2d')!;void(async()=>{for(const box of template.textBoxes??[])if(!box.hidden)await drawTextBox(ctx,box,canvas.width,canvas.height);if(live)setTextPreview(template.textBoxes?.length?canvas.toDataURL():'')})().catch(()=>{if(live)setTextPreview('')});return()=>{live=false}},[template.textBoxes,aspect])
  return (
    <div className={`template-thumb ${className ?? ''}`} style={{ aspectRatio: aspect, backgroundColor, '--preview-border-color': borderColor, '--preview-border-width': borderWidth === undefined ? undefined : `${borderWidth / 900 * 100}cqw` } as CSSProperties}>
      {/* An imported design's frames are absolute: re-flowing them to the album's margin/gap would
          slide every photo away from the text and artwork that were drawn around them, which is
          exactly what the editor does not do when the template is applied. */}
      {(template.absoluteFrames
        ? templateFramesInReadingOrder(template)
        : resolveTemplateFrames(templateFramesInReadingOrder(template), aspect, marginPx, gapPx)
      ).map((ph, i) => (
        <PreviewCell key={ph.id} ph={ph} photo={photos?.[i]} aspect={aspect} placement={placements?.find(p=>p.photoId===photos?.[i]?.id)} />
      ))}
      {textPreview&&<img alt="Template text composition" src={textPreview} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>}
    </div>
  )
}
