import { spreadLayers } from './spreadLayers'
import { getPreferences } from '@/state/preferences'
import { PhotoAsset, Spread, AlbumSize, PlacedPhoto, TextBox } from '@/types'
import { computeCoverCrop } from './cropFit'
import { DESIGN_WIDTH, PlaceholderBox, computePlaceholderBoxes } from './layoutMath'
import { ensureFontLoaded } from './fonts'
import { imageToneFilter, applyBlackWhiteMix } from './imageTone'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Renders a spread onto a canvas at the given pixel size (pixelsPerInch * album size), for
 *  on-screen preview thumbnails and for rasterizing JPG/PDF export pages. */
export async function renderSpreadToCanvas(
  spread: Spread,
  photosById: Map<string, PhotoAsset>,
  size: AlbumSize,
  pixelsPerInch: number
): Promise<HTMLCanvasElement> {
  size = spread.size ?? size
  const widthPx = Math.round(size.widthIn * pixelsPerInch)
  const heightPx = Math.round(size.heightIn * pixelsPerInch)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.imageSmoothingQuality = 'high'

  await drawSpreadBackground(ctx, spread, widthPx, heightPx)

  const scale = widthPx / DESIGN_WIDTH
  const boxes = computePlaceholderBoxes(spread, widthPx, heightPx)

  for (const layer of spreadLayers(spread)) {
    if (layer.value.hidden) continue
    if (layer.kind === 'text') await drawTextBox(ctx, layer.value, widthPx, heightPx)
    else {
      const ph = boxes.find(b => b.placeholderId === layer.id)
      const photo = layer.value.photoId ? photosById.get(layer.value.photoId) : undefined
      if (ph && photo) await drawPlacement(ctx, ph, layer.value, photo, scale)
    }
  }

  const amount=({none:0,low:.15,medium:.3,high:.5} as Record<string,number>)[getPreferences().sharpening]??0
  if(amount && pixelsPerInch>=size.dpi){
    const image=ctx.getImageData(0,0,widthPx,heightPx),source=new Uint8ClampedArray(image.data)
    for(let y=1;y<heightPx-1;y++)for(let x=1;x<widthPx-1;x++){const i=(y*widthPx+x)*4;for(let k=0;k<3;k++)image.data[i+k]=source[i+k]*(1+4*amount)-amount*(source[i-4+k]+source[i+4+k]+source[i-widthPx*4+k]+source[i+widthPx*4+k])}
    ctx.putImageData(image,0,0)
  }
  return canvas
}

export async function drawSpreadBackground(ctx: CanvasRenderingContext2D, spread: Spread, width: number, height: number) {
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = spread.backgroundHidden ? '#ffffff' : spread.backgroundColor
  ctx.fillRect(0, 0, width, height)
  if (spread.backgroundHidden || !spread.backgroundPattern) return
  if (spread.backgroundPattern.mode === 'cover') {
    await drawPlacement(ctx, { placeholderId: 'background', x: 0, y: 0, width, height }, spread.backgroundPattern.edits, { src: spread.backgroundPattern.src }, width / DESIGN_WIDTH)
    return
  }
  const image = await loadImage(spread.backgroundPattern.src)
  const scale = spread.backgroundPattern.tileSizePx * width / DESIGN_WIDTH / image.naturalWidth
  const pattern = ctx.createPattern(image, 'repeat')
  if (!pattern || !(scale > 0)) return
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width / scale, height / scale)
  ctx.restore()
}

export async function drawPlacement(ctx: CanvasRenderingContext2D, ph: PlaceholderBox, placement: PlacedPhoto | undefined, photo: Pick<PhotoAsset, 'src'> | undefined, scale: number) {
    const boxX = ph.x
    const boxY = ph.y
    const boxW = ph.width
    const boxH = ph.height
    if (boxW <= 0 || boxH <= 0) return

    const frameStyle = placement?.frameStyle ?? 'none'
    const rotation = ((placement?.rotationDeg ?? 0) * Math.PI) / 180

    ctx.save()
    if (rotation !== 0) {
      const cx = boxX + boxW / 2
      const cy = boxY + boxH / 2
      ctx.translate(cx, cy)
      ctx.rotate(rotation)
      ctx.translate(-cx, -cy)
    }

    if (frameStyle === 'shadow') {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = Math.max(boxW, boxH) * 0.04
      ctx.shadowOffsetY = Math.max(boxW, boxH) * 0.015
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      ctx.restore()
    }

    // The polaroid mat eats into the box, leaving extra room at the bottom for a caption strip.
    const matPad = frameStyle === 'polaroid' ? Math.min(boxW, boxH) * 0.06 : 0
    const matPadBottom = frameStyle === 'polaroid' ? boxH * 0.16 : 0
    const photoX = boxX + matPad
    const photoY = boxY + matPad
    const photoW = boxW - matPad * 2
    const photoH = boxH - matPad - matPadBottom

    if (frameStyle === 'polaroid') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(boxX, boxY, boxW, boxH)
    }

    ctx.save()
    ctx.beginPath()
    if (frameStyle === 'rounded') {
      roundedRectPath(ctx, boxX, boxY, boxW, boxH, (placement?.cornerRadiusPx ?? 24) * scale)
    } else {
      ctx.rect(photoX, photoY, photoW, photoH)
    }
    ctx.clip()

    if (photo) {
      const img = await loadImage(photo.src)
      const crop = computeCoverCrop(
        img.naturalWidth,
        img.naturalHeight,
        photoW,
        photoH,
        placement?.focalX ?? 0.5,
        placement?.focalY ?? 0.5,
        placement?.zoom ?? 1
      )

      ctx.filter = imageToneFilter(placement ?? { brightness: 0, contrast: 0, saturation: 0 })
      ctx.globalAlpha = placement?.opacity ?? 1

      const flipH = placement?.flipHorizontal ?? false
      const flipV = placement?.flipVertical ?? false
      if (flipH || flipV) {
        ctx.save()
        const cx = photoX + photoW / 2
        const cy = photoY + photoH / 2
        ctx.translate(cx, cy)
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
        ctx.translate(-cx, -cy)
      }
      if (placement?.blackWhiteMix) {
        const toned = document.createElement('canvas')
        toned.width = Math.max(1, Math.ceil(photoW)); toned.height = Math.max(1, Math.ceil(photoH))
        const toneCtx = toned.getContext('2d')!
        toneCtx.filter = ctx.filter
        toneCtx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, 0, 0, toned.width, toned.height)
        applyBlackWhiteMix(toneCtx, placement.blackWhiteMix)
        ctx.filter = 'none'
        ctx.drawImage(toned, photoX, photoY, photoW, photoH)
      } else {
        ctx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, photoX, photoY, photoW, photoH)
      }
      if (flipH || flipV) ctx.restore()
      ctx.filter = 'none'
      ctx.globalAlpha = 1

      const warmth = placement?.warmth ?? 0
      if (warmth !== 0) {
        ctx.globalAlpha = Math.min(Math.abs(warmth) / 100, 0.35)
        ctx.fillStyle = warmth > 0 ? '#ffb347' : '#4aa3ff'
        ctx.globalCompositeOperation = 'overlay'
        ctx.fillRect(photoX, photoY, photoW, photoH)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }

      applyRelight(ctx, photoX, photoY, photoW, photoH, placement?.relightIntensity ?? 0)
    } else {
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(photoX, photoY, photoW, photoH)
    }
    ctx.restore()

    const borderWidth = (placement?.borderWidth ?? 0) * scale
    if (borderWidth > 0 && frameStyle !== 'polaroid') {
      ctx.strokeStyle = placement?.borderColor ?? '#ffffff'
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      if (frameStyle === 'rounded') roundedRectPath(ctx, photoX + borderWidth / 2, photoY + borderWidth / 2, Math.max(0, photoW - borderWidth), Math.max(0, photoH - borderWidth), Math.max(0, (placement?.cornerRadiusPx ?? 24) * scale - borderWidth / 2))
      else ctx.rect(photoX + borderWidth / 2, photoY + borderWidth / 2, photoW - borderWidth, photoH - borderWidth)
      ctx.stroke()
    }

    ctx.restore()
}

/** Simulated "relighting": a soft radial glow (positive) or vignette/shadow (negative) centered
 *  on the photo, blended with soft-light so it reads as changed lighting rather than a flat tint. */
export function applyRelight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity: number) {
  if (intensity === 0) return
  const cx = x + w / 2
  const cy = y + h / 2
  const radius = Math.max(w, h) * 0.75
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  const strength = Math.min(Math.abs(intensity) / 100, 1)
  if (intensity > 0) {
    gradient.addColorStop(0, `rgba(255,255,255,${0.65 * strength})`)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
  } else {
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${0.55 * strength})`)
  }
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let cursorY = y
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const testLine = line ? `${line} ${word}` : word
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY)
        line = word
        cursorY += lineHeight
      } else {
        line = testLine
      }
    }
    if (line) ctx.fillText(line, x, cursorY)
    cursorY += lineHeight
  }
  return cursorY - y
}

export async function drawTextBox(ctx: CanvasRenderingContext2D, box: TextBox, widthPx: number, heightPx: number) {
  const scale = widthPx / DESIGN_WIDTH

    await ensureFontLoaded(box.fontFamily)
    const x = box.x * widthPx
    const y = box.y * heightPx
    const w = box.width * widthPx
    ctx.save()
    ctx.font = `${box.italic ? 'italic ' : ''}${box.bold ? 'bold ' : ''}${box.fontSize * scale}px ${box.fontFamily}`
    ctx.fillStyle = box.color
    ctx.textAlign = box.align
    ctx.textBaseline = 'top'
    const tx = box.align === 'center' ? x + w / 2 : box.align === 'right' ? x + w : x
    const height = wrapText(ctx, box.text, tx, y, w, box.fontSize * scale)
    ctx.restore()
    return height
}
