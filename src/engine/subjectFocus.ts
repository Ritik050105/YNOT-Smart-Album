/** Where the subject of a photo sits, as a 0-1 focal point.
 *
 *  A frame almost never has the photo's aspect ratio, so something gets cropped away. Centring the
 *  crop is the safe default and the wrong one for the albums this app makes: a wedding photo is
 *  people, usually not dead centre, and a centred crop cuts heads off. This picks the point to keep
 *  by weighting skin tones and local detail — the two things that mark where the people are — and
 *  taking the centroid. It is deliberately cheap: a 64px pass over the one small thumbnail the
 *  importer decodes, shared with its black-and-white check. No model, no network. */

const SAMPLE = 64

/** Rec.601 luma, used for the detail pass. */
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** A broad skin-tone test across lighting and skin colour: warm, not too saturated, not too dark.
 *  Generous on purpose — a missed face costs far more here than a little background picked up. */
function skinLikelihood(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max < 48 || max > 250) return 0
  if (r <= g || g < b * 0.75) return 0
  const spread = max - min
  if (spread < 12 || spread > 130) return 0
  return 1
}

export interface SubjectFocus { focusX: number; focusY: number }

/** The face-sized patch of skin that most looks like the subject's head: its centre and its size,
 *  as fractions of the photograph. Neighbouring skin pixels are grouped, and of the groups big
 *  enough to be a face the highest one wins — heads sit above hands and arms. Null when nothing
 *  skin-coloured is large enough, which is the cue to fall back to the broader centroid. */
export interface SubjectBox extends SubjectFocus { width: number; height: number }

export function subjectBoxFromPixels(data: Uint8ClampedArray): SubjectBox | null {
  const skin = new Uint8Array(SAMPLE * SAMPLE)
  for (let i = 0; i < skin.length; i++) {
    const p = i * 4
    if (data[p + 3] >= 128 && skinLikelihood(data[p], data[p + 1], data[p + 2])) skin[i] = 1
  }
  let best: SubjectBox | null = null, bestScore = 0
  const stack: number[] = []
  for (let start = 0; start < skin.length; start++) {
    if (skin[start] !== 1) continue
    let area = 0, sumX = 0, sumY = 0, minX = SAMPLE, maxX = 0, minY = SAMPLE, maxY = 0
    skin[start] = 2; stack.push(start)
    while (stack.length) {
      const i = stack.pop()!, x = i % SAMPLE, y = (i - x) / SAMPLE
      area++; sumX += x + 0.5; sumY += y + 0.5
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
      for (const n of [i - 1, i + 1, i - SAMPLE, i + SAMPLE]) {
        const nx = n % SAMPLE
        if (n < 0 || n >= skin.length || Math.abs(nx - x) > 1 || skin[n] !== 1) continue
        skin[n] = 2; stack.push(n)
      }
    }
    // A face is at least a few cells across at this resolution; anything smaller is a speck.
    if (area < 8) continue
    const cy = sumY / area / SAMPLE
    const score = area * (1.5 - cy)
    if (score > bestScore) {
      bestScore = score
      best = { focusX: sumX / area / SAMPLE, focusY: sumY / area / SAMPLE, width: (maxX - minX + 1) / SAMPLE, height: (maxY - minY + 1) / SAMPLE }
    }
  }
  return best
}

/** The focal point from a SAMPLE x SAMPLE block of RGBA pixels, or null when nothing stands out.
 *  Takes pixels rather than an image so the caller can answer other questions from the same
 *  sample — the importer reads black-and-white off it too, and decodes the photo once. */
export function subjectFocusFromPixels(data: Uint8ClampedArray): SubjectFocus | null {
  // A found face is centred on exactly: the crop is clamped to the photograph afterwards, so
  // there is no need to hold the point back from the edges here.
  const face = subjectBoxFromPixels(data)
  if (face) return { focusX: Math.max(0.08, Math.min(0.92, face.focusX)), focusY: Math.max(0.08, Math.min(0.92, face.focusY)) }
  const at = (x: number, y: number) => (y * SAMPLE + x) * 4
  let totalWeight = 0, sumX = 0, sumY = 0
  for (let y = 1; y < SAMPLE - 1; y++) {
    for (let x = 1; x < SAMPLE - 1; x++) {
      const i = at(x, y)
      if (data[i + 3] < 128) continue
      const here = luma(data[i], data[i + 1], data[i + 2])
      // Local contrast stands in for detail: faces, hands and clothing edges carry it, while sky,
      // walls and bokeh do not.
      const right = at(x + 1, y), down = at(x, y + 1)
      const detail = Math.abs(here - luma(data[right], data[right + 1], data[right + 2]))
        + Math.abs(here - luma(data[down], data[down + 1], data[down + 2]))
      // Skin outweighs detail, so a busy background cannot drag the crop off the people.
      const weight = detail / 255 + 6 * skinLikelihood(data[i], data[i + 1], data[i + 2])
      if (weight <= 0) continue
      totalWeight += weight
      sumX += weight * (x + 0.5)
      sumY += weight * (y + 0.5)
    }
  }
  if (totalWeight <= 0) return null

  // Pulled back toward the middle, because a centroid overshoots: it answers "where is the weight"
  // when the question is "what must stay in frame". Then held away from the very edges, so the
  // crop never clings to one side of the photo.
  const clamp = (v: number) => Math.max(0.2, Math.min(0.8, 0.5 + (v / SAMPLE - 0.5) * 0.7))
  return { focusX: clamp(sumX / totalWeight), focusY: clamp(sumY / totalWeight) }
}

/** The focal point for an already-decoded image. */
export function subjectFocusFromImage(image: CanvasImageSource): SubjectFocus | null {
  const pixels = samplePixels(image)
  return pixels && subjectFocusFromPixels(pixels)
}

/** The subject's head box for an already-decoded image. */
export function subjectBoxFromImage(image: CanvasImageSource): SubjectBox | null {
  const pixels = samplePixels(image)
  return pixels && subjectBoxFromPixels(pixels)
}

/** The SAMPLE x SAMPLE RGBA block every measurement here works from. */
export function samplePixels(image: CanvasImageSource): Uint8ClampedArray | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE)
  return ctx.getImageData(0, 0, SAMPLE, SAMPLE).data
}
