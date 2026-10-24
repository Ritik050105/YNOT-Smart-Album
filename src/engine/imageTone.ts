import { PlacedPhoto } from '@/types'

export function imageToneFilter(tone: Pick<PlacedPhoto, 'brightness' | 'contrast' | 'saturation'>) {
  return `brightness(${1 + tone.brightness / 100}) contrast(${1 + tone.contrast / 100}) saturate(${1 + tone.saturation / 100})`
}

export const defaultBlackWhiteMix = [40, 60, 40, 60, 20, 80]

/** Interpolate the six hue channels, preserving neutral pixels and alpha. */
export function applyBlackWhiteMix(ctx: CanvasRenderingContext2D, mix?: number[]) {
  if (!mix) return
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const weights = defaultBlackWhiteMix.map((fallback, i) => Number.isFinite(mix[i]) ? Math.max(-100, Math.min(200, mix[i])) / 100 : fallback / 100)
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i], g = image.data[i + 1], b = image.data[i + 2]
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), delta = hi - lo
    let hue = delta === 0 ? 0 : hi === r ? (g - b) / delta : hi === g ? 2 + (b - r) / delta : 4 + (r - g) / delta
    hue = (hue + 6) % 6
    const channel = Math.floor(hue), fraction = hue - channel
    const gray = lo + delta * (weights[channel] * (1 - fraction) + weights[(channel + 1) % 6] * fraction)
    image.data[i] = image.data[i + 1] = image.data[i + 2] = gray
  }
  ctx.putImageData(image, 0, 0)
}
