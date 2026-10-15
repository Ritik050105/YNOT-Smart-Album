import { writePsdUint8Array, Layer, Psd } from 'ag-psd'
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

/** Builds a layered PSD for one spread — a background layer, one raster layer per placed photo,
 *  and one raster layer per text box — so it opens in Photoshop with movable, editable-position
 *  layers for deeper customization ("export as PSD to finish in Photoshop"). */
export async function buildSpreadPsdBytes(
  spread: Spread,
  photosById: Map<string, PhotoAsset>,
  size: AlbumSize,
  pixelsPerInch: number
): Promise<Uint8Array> {
  const widthPx = Math.round(size.widthIn * pixelsPerInch)
  const heightPx = Math.round(size.heightIn * pixelsPerInch)
  const boxes = computePlaceholderBoxes(spread, widthPx, heightPx)
  const layers: Layer[] = []

  const bgCanvas = document.createElement('canvas')
  bgCanvas.width = widthPx
  bgCanvas.height = heightPx
  const bgCtx = bgCanvas.getContext('2d')
  if (!bgCtx) throw new Error('2D canvas context unavailable')
  bgCtx.fillStyle = spread.backgroundColor
  bgCtx.fillRect(0, 0, widthPx, heightPx)
  layers.push({ name: 'Background', left: 0, top: 0, right: widthPx, bottom: heightPx, canvas: bgCanvas })

  for (const box of boxes) {
    const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
    const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
    if (!photo || !placement) continue

    const w = Math.max(1, Math.round(box.width))
    const h = Math.max(1, Math.round(box.height))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    const img = await loadImage(photo.src)
    const crop = computeCoverCrop(img.naturalWidth, img.naturalHeight, w, h, placement.focalX, placement.focalY, placement.zoom)
    ctx.filter = `brightness(${1 + placement.brightness / 100}) contrast(${1 + placement.contrast / 100}) saturate(${1 + placement.saturation / 100})`
    ctx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, 0, 0, w, h)

    layers.push({
      name: photo.fileName,
      left: Math.round(box.x),
      top: Math.round(box.y),
      right: Math.round(box.x) + w,
      bottom: Math.round(box.y) + h,
      canvas,
      opacity: Math.round(placement.opacity * 255),
    })
  }

  for (const t of spread.textBoxes) {
    await ensureFontLoaded(t.fontFamily)
    const x = t.x * widthPx
    const y = t.y * heightPx
    const w = Math.max(1, Math.round(t.width * widthPx))
    const h = Math.max(1, Math.round(Math.max(t.height * heightPx, t.fontSize * 1.6)))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.fontSize}px ${t.fontFamily}`
    ctx.fillStyle = t.color
    ctx.textAlign = t.align
    ctx.textBaseline = 'top'
    const tx = t.align === 'center' ? w / 2 : t.align === 'right' ? w : 0
    ctx.fillText(t.text, tx, 0)

    layers.push({
      name: t.text.slice(0, 30) || 'Text',
      left: Math.round(x),
      top: Math.round(y),
      right: Math.round(x) + w,
      bottom: Math.round(y) + h,
      canvas,
    })
  }

  const psd: Psd = { width: widthPx, height: heightPx, children: layers }
  return writePsdUint8Array(psd)
}
