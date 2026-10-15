import { PhotoAsset, Spread, AlbumSize } from '@/types'
import { computeCoverCrop } from './cropFit'
import { computePlaceholderBoxes } from './layoutMath'

function loadImage(src: string): Promise<HTMLImageElement> {
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
  const widthPx = Math.round(size.widthIn * pixelsPerInch)
  const heightPx = Math.round(size.heightIn * pixelsPerInch)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  ctx.fillStyle = spread.backgroundColor
  ctx.fillRect(0, 0, widthPx, heightPx)

  const margin = spread.marginPx
  const boxes = computePlaceholderBoxes(spread, widthPx, heightPx)

  for (const ph of boxes) {
    const placement = spread.placements.find((p) => p.placeholderId === ph.placeholderId)
    const boxX = ph.x
    const boxY = ph.y
    const boxW = ph.width
    const boxH = ph.height
    if (boxW <= 0 || boxH <= 0) continue

    const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined

    ctx.save()
    ctx.beginPath()
    ctx.rect(boxX, boxY, boxW, boxH)
    ctx.clip()

    if (photo) {
      const img = await loadImage(photo.src)
      const crop = computeCoverCrop(
        img.naturalWidth,
        img.naturalHeight,
        boxW,
        boxH,
        placement?.focalX ?? 0.5,
        placement?.focalY ?? 0.5,
        placement?.zoom ?? 1
      )

      const brightness = 1 + (placement?.brightness ?? 0) / 100
      const contrast = 1 + (placement?.contrast ?? 0) / 100
      const saturate = 1 + (placement?.saturation ?? 0) / 100
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`
      ctx.globalAlpha = placement?.opacity ?? 1

      ctx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, boxX, boxY, boxW, boxH)
      ctx.filter = 'none'
      ctx.globalAlpha = 1

      const warmth = placement?.warmth ?? 0
      if (warmth !== 0) {
        ctx.globalAlpha = Math.min(Math.abs(warmth) / 100, 0.35)
        ctx.fillStyle = warmth > 0 ? '#ffb347' : '#4aa3ff'
        ctx.globalCompositeOperation = 'overlay'
        ctx.fillRect(boxX, boxY, boxW, boxH)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }
    } else {
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(boxX, boxY, boxW, boxH)
    }
    ctx.restore()

    const borderWidth = placement?.borderWidth ?? 0
    if (borderWidth > 0) {
      ctx.strokeStyle = placement?.borderColor ?? '#ffffff'
      ctx.lineWidth = borderWidth
      ctx.strokeRect(boxX + borderWidth / 2, boxY + borderWidth / 2, boxW - borderWidth, boxH - borderWidth)
    }
  }

  const innerW = widthPx - margin * 2
  const innerH = heightPx - margin * 2
  for (const box of spread.textBoxes) {
    const x = margin + box.x * innerW
    const y = margin + box.y * innerH
    const w = box.width * innerW
    ctx.save()
    ctx.font = `${box.italic ? 'italic ' : ''}${box.bold ? 'bold ' : ''}${box.fontSize * (pixelsPerInch / 96)}px ${box.fontFamily}`
    ctx.fillStyle = box.color
    ctx.textAlign = box.align
    ctx.textBaseline = 'top'
    const tx = box.align === 'center' ? x + w / 2 : box.align === 'right' ? x + w : x
    wrapText(ctx, box.text, tx, y, w, box.fontSize * 1.3 * (pixelsPerInch / 96))
    ctx.restore()
  }

  return canvas
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/)
  let line = ''
  let cursorY = y
  for (const word of words) {
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
}
