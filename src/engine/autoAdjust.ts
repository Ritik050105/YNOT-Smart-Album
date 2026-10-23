/** "Auto Adjust" — a one-click automatic tone correction, computed from the photo's own pixels
 *  rather than a fixed preset: samples a downscaled copy of the image, measures its mean
 *  luminance and contrast spread, and nudges brightness/contrast/saturation back toward a
 *  healthy exposure instead of leaving a dark or washed-out photo untouched. */

const SAMPLE_SIZE = 64

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => reject(new Error('Image took too long to load. Locate the original file and try again.')), 15000)
    img.onload = () => { window.clearTimeout(timer); resolve(img) }
    img.onerror = () => { window.clearTimeout(timer); reject(new Error('Could not load this image. Locate the original file and try again.')) }
    img.src = src
  })
}

export interface AutoAdjustResult {
  brightness: number
  contrast: number
  saturation: number
}

/** Analyzes the photo and returns the brightness/contrast/saturation values (-100..100, same
 *  scale as the Inspector's sliders) that would correct it — a real histogram-based auto-levels
 *  pass, not a canned "add some contrast" guess. */
export async function computeAutoAdjust(src: string): Promise<AutoAdjustResult> {
  const img = await loadImageElement(src)
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return { brightness: 0, contrast: 0, saturation: 0 }
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)

  let sumLum = 0
  let sumLumSq = 0
  let sumSat = 0
  const n = SAMPLE_SIZE * SAMPLE_SIZE

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    sumLum += lum
    sumLumSq += lum * lum
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    sumSat += max === 0 ? 0 : (max - min) / max
  }

  const meanLum = sumLum / n
  const variance = Math.max(0, sumLumSq / n - meanLum * meanLum)
  const stdDev = Math.sqrt(variance)
  const meanSat = sumSat / n

  // Target: mid-gray exposure (~128), a healthy tonal spread (~62 std dev), and moderate color
  // saturation (~0.42) — photos already close to these targets get little or no adjustment.
  const brightness = clamp(Math.round(((128 - meanLum) / 128) * 55), -55, 55)
  const contrast = clamp(Math.round(((62 - stdDev) / 62) * 35), -10, 35)
  const saturation = clamp(Math.round((0.42 - meanSat) * 110), -10, 30)

  return { brightness, contrast, saturation }
}
