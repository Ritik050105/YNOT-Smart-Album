import { PhotoAsset, Spread, AlbumSize } from '@/types'
import { computeCoverCrop } from './cropFit'
import { computePlaceholderBoxes } from './layoutMath'
import { ensureFontLoaded } from './fonts'

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
      roundedRectPath(ctx, boxX, boxY, boxW, boxH, Math.min(boxW, boxH) * 0.06)
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

      const brightness = 1 + (placement?.brightness ?? 0) / 100
      const contrast = 1 + (placement?.contrast ?? 0) / 100
      const saturate = 1 + (placement?.saturation ?? 0) / 100
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`
      ctx.globalAlpha = placement?.opacity ?? 1

      ctx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, photoX, photoY, photoW, photoH)
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

    const borderWidth = placement?.borderWidth ?? 0
    if (borderWidth > 0 && frameStyle !== 'polaroid') {
      ctx.strokeStyle = placement?.borderColor ?? '#ffffff'
      ctx.lineWidth = borderWidth
      ctx.strokeRect(photoX + borderWidth / 2, photoY + borderWidth / 2, photoW - borderWidth, photoH - borderWidth)
    }

    ctx.restore()
  }

  const innerW = widthPx - margin * 2
  const innerH = heightPx - margin * 2
  for (const box of spread.textBoxes) {
    await ensureFontLoaded(box.fontFamily)
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
