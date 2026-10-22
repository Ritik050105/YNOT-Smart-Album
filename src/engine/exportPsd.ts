import { writePsdUint8Array, Layer, Psd } from 'ag-psd'
import { PhotoAsset, Spread, AlbumSize } from '@/types'
import { DESIGN_WIDTH, computePlaceholderBoxes } from './layoutMath'
import { drawPlacement, drawTextBox, drawSpreadBackground, renderSpreadToCanvas } from './renderSpread'

/** Cached raster layers preserve the preview; text descriptors also keep text editable. */
export async function buildSpreadPsdBytes(
  spread: Spread,
  photosById: Map<string, PhotoAsset>,
  size: AlbumSize,
  pixelsPerInch: number
): Promise<Uint8Array> {
  size = spread.size ?? size
  const width = Math.round(size.widthIn * pixelsPerInch)
  const height = Math.round(size.heightIn * pixelsPerInch)
  const scale = width / DESIGN_WIDTH
  const layers: Layer[] = []

  async function addLayer(name: string, left: number, top: number, right: number, bottom: number,
    draw: (ctx: CanvasRenderingContext2D) => void | Promise<void>) {
    left = Math.max(0, Math.floor(left))
    top = Math.max(0, Math.floor(top))
    right = Math.min(width, Math.ceil(right))
    bottom = Math.min(height, Math.ceil(bottom))
    if (right <= left || bottom <= top) return
    const canvas = document.createElement('canvas')
    canvas.width = right - left
    canvas.height = bottom - top
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    ctx.translate(-left, -top)
    await draw(ctx)
    const layer: Layer = { name, left, top, right, bottom, canvas }
    layers.push(layer)
    return layer
  }

  await addLayer('Background', 0, 0, width, height, (ctx) => drawSpreadBackground(ctx, spread, width, height))
  for (const box of computePlaceholderBoxes(spread, width, height)) {
    const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
    const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
    if (!photo || !placement) continue
    const angle = placement.rotationDeg * Math.PI / 180
    const padding = placement.frameStyle === 'shadow' ? Math.max(box.width, box.height) * 0.15 : 1
    const rotatedW = Math.abs(Math.cos(angle)) * box.width + Math.abs(Math.sin(angle)) * box.height
    const rotatedH = Math.abs(Math.sin(angle)) * box.width + Math.abs(Math.cos(angle)) * box.height
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await addLayer(photo.fileName, cx - rotatedW / 2 - padding, cy - rotatedH / 2 - padding,
      cx + rotatedW / 2 + padding, cy + rotatedH / 2 + padding,
      (ctx) => drawPlacement(ctx, box, placement, photo, scale))
  }
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = measureCanvas.height = 1
  const measureContext = measureCanvas.getContext('2d')
  if (!measureContext) throw new Error('2D canvas context unavailable')
  for (const text of spread.textBoxes) {
    const textHeight = await drawTextBox(measureContext, text, width, height)
    const layer = await addLayer(text.text.slice(0, 30) || 'Text', text.x * width, text.y * height,
      (text.x + text.width) * width, Math.max((text.y + text.height) * height, text.y * height + textHeight),
      async (ctx) => { await drawTextBox(ctx, text, width, height) })
    if (!layer) continue
    measureContext.fillStyle = text.color
    measureContext.fillRect(0, 0, 1, 1)
    const [r, g, b] = measureContext.getImageData(0, 0, 1, 1).data
    const fontNames: Record<string, string> = { Arial: 'ArialMT', 'Times New Roman': 'TimesNewRomanPSMT', 'Courier New': 'CourierNewPSMT' }
    layer.text = {
      text: text.text,
      transform: [1, 0, 0, 1, text.x * width, text.y * height],
      shapeType: 'box',
      boxBounds: [0, 0, text.width * width, Math.max(text.height * height, textHeight)],
      style: {
        font: { name: fontNames[text.fontFamily] ?? text.fontFamily.replace(/\s/g, '') },
        fontSize: text.fontSize * scale, fillColor: { r, g, b }, fauxBold: text.bold, fauxItalic: text.italic,
        autoLeading: false, leading: text.fontSize * scale,
      },
      paragraphStyle: { justification: text.align },
    }
  }
  const composite = await renderSpreadToCanvas(spread, photosById, size, pixelsPerInch)
  const psd: Psd = { width, height, canvas: composite, children: layers }
  return writePsdUint8Array(psd)
}
