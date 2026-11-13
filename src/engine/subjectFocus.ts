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

/** A skin-tone test in the YCbCr colour space, where skin of every complexion sits in one narrow band
 *  of chroma (Cb 77-127, Cr 133-173) and only the lightness changes. The old test compared red, green
 *  and blue directly, which let a grey-violet studio backdrop through as "skin": it then made the
 *  whole photograph one skin-coloured region and the subject was reported as the middle of the page. */
function skinLikelihood(r: number, g: number, b: number): number {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  if (y < 45 || y > 245) return 0
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  if (cb < 77 || cb > 127 || cr < 138 || cr > 173) return 0
  // Skin is warmer than it is green or blue: red leads, green sits between.
  if (r < g || g < b * 0.8) return 0
  return 1
}

export interface SubjectFocus { focusX: number; focusY: number }

/** The face-sized patch of skin that most looks like the subject's head: its centre and its size,
 *  as fractions of the photograph. Neighbouring skin pixels are grouped, and of the groups big
 *  enough to be a face the highest one wins — heads sit above hands and arms. Null when nothing
 *  skin-coloured is large enough, which is the cue to fall back to the broader centroid. */
export interface SubjectBox extends SubjectFocus { width: number; height: number }

export function subjectBoxFromPixels(data: Uint8ClampedArray, width = SAMPLE, height = SAMPLE): SubjectBox | null {
  const skin = new Uint8Array(width * height)
  for (let i = 0; i < skin.length; i++) {
    const p = i * 4
    if (data[p + 3] >= 128 && skinLikelihood(data[p], data[p + 1], data[p + 2])) skin[i] = 1
  }
  let best: SubjectBox | null = null, bestScore = 0
  const stack: number[] = []
  for (let start = 0; start < skin.length; start++) {
    if (skin[start] !== 1) continue
    const cells: number[] = []
    let minX = width, maxX = 0, minY = height, maxY = 0
    skin[start] = 2; stack.push(start)
    while (stack.length) {
      const i = stack.pop()!, x = i % width, y = (i - x) / width
      cells.push(i)
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
      for (const n of [i - 1, i + 1, i - width, i + width]) {
        const nx = n % width
        if (n < 0 || n >= skin.length || Math.abs(nx - x) > 1 || skin[n] !== 1) continue
        skin[n] = 2; stack.push(n)
      }
    }
    const area = cells.length
    // A face is at least a few cells across at this resolution; anything smaller is a speck.
    if (area < 8) continue
    const bw = maxX - minX + 1, bh = maxY - minY + 1
    // A region that fills most of the picture is a backdrop or a wall the colour test let through, not a
    // face; one that is a thin strip or full of holes is not a face either. What is left is judged by
    // how much it looks like a head (not much wider than tall, solid) and how high on the page it sits.
    if (area > width * height * 0.5) continue
    // Skin does not stop at the chin: the neck and chest are joined to the face and come out as one tall
    // region. The face is the top of it — as tall as 1.4 times its own width — so the region is cut
    // where it would run past that, measured on the widest row in its upper part.
    // Measured by how far each row reaches, not by how many cells it has: hair across the forehead and
    // the eyes punch holes in a face's skin, and counting cells made a face look half as wide as it is.
    const left = new Array<number>(bh).fill(width), right = new Array<number>(bh).fill(-1)
    for (const i of cells) { const r = Math.floor(i / width) - minY, x = i % width; if (x < left[r]) left[r] = x; if (x > right[r]) right[r] = x }
    const reach = Array.from({ length: Math.max(1, Math.ceil(bh * 0.45)) }, (_, r) => right[r] >= left[r] ? right[r] - left[r] + 1 : 0).sort((p, q) => p - q)
    const faceWidth = reach[Math.min(reach.length - 1, Math.floor(reach.length * 0.8))]
    const faceHeight = Math.min(bh, Math.max(3, Math.round(faceWidth * 1.5)))
    let sumX = 0, count = 0
    for (const i of cells) { const y = Math.floor(i / width) - minY; if (y < faceHeight) { sumX += (i % width) + 0.5; count++ } }
    if (!count) continue
    const aspect = faceHeight / Math.max(1, faceWidth), solid = count / Math.max(1, faceWidth * faceHeight)
    const shape = Math.min(1, aspect < 0.7 ? aspect / 0.7 : aspect > 1.8 ? 1.8 / aspect : 1) * Math.min(1, solid / 0.5)
    const cy = (minY + faceHeight / 2) / height
    const score = count * shape * (1.5 - cy)
    if (score > bestScore) {
      bestScore = score
      // The point to keep is the eyes: a little above the middle of the face, which is where a crop that
      // has to lose something should lose it from the top and bottom evenly around.
      best = { focusX: sumX / count / width, focusY: (minY + faceHeight * 0.45) / height, width: faceWidth / width, height: faceHeight / height }
    }
  }
  return best
}

/** The focal point from a block of RGBA pixels (a SAMPLE x SAMPLE block unless a size is given), or null
 *  when nothing stands out. Takes pixels rather than an image so the caller can answer other questions
 *  from the same sample. */
export function subjectFocusFromPixels(data: Uint8ClampedArray, width = SAMPLE, height = SAMPLE): SubjectFocus | null {
  // A found face is centred on exactly: the crop is clamped to the photograph afterwards, so
  // there is no need to hold the point back from the edges here.
  const face = subjectBoxFromPixels(data, width, height)
  if (face) return { focusX: Math.max(0.08, Math.min(0.92, face.focusX)), focusY: Math.max(0.08, Math.min(0.92, face.focusY)) }
  const at = (x: number, y: number) => (y * width + x) * 4
  let totalWeight = 0, sumX = 0, sumY = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
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
  const clamp = (v: number, span: number) => Math.max(0.2, Math.min(0.8, 0.5 + (v / span - 0.5) * 0.7))
  return { focusX: clamp(sumX / totalWeight, width), focusY: clamp(sumY / totalWeight, height) }
}

/** The focal point for an already-decoded image. */
export function subjectFocusFromImage(image: CanvasImageSource): SubjectFocus | null {
  const sample = sampleKeepingShape(image)
  return sample && subjectFocusFromPixels(sample.data, sample.width, sample.height)
}

/** The subject's head box for an already-decoded image. */
export function subjectBoxFromImage(image: CanvasImageSource): SubjectBox | null {
  const sample = sampleKeepingShape(image)
  return sample && subjectBoxFromPixels(sample.data, sample.width, sample.height)
}

/** The SAMPLE x SAMPLE RGBA block the black-and-white check works from (the photograph squashed square). */
export function samplePixels(image: CanvasImageSource): Uint8ClampedArray | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE)
  return ctx.getImageData(0, 0, SAMPLE, SAMPLE).data
}

/** The photograph at a small size with its own proportions. Faces are judged by shape, and a photograph
 *  squashed square makes every face in a landscape or portrait picture the wrong shape. */
const LONG_SIDE = 96
export function sampleKeepingShape(image: CanvasImageSource): { data: Uint8ClampedArray; width: number; height: number } | null {
  const source = image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
  const iw = source.naturalWidth || source.width || 0, ih = source.naturalHeight || source.height || 0
  // A source that cannot say how big it is is sampled square, as before.
  const known = iw > 0 && ih > 0
  const scale = known ? LONG_SIDE / Math.max(iw, ih) : 1
  const width = known ? Math.max(8, Math.round(iw * scale)) : SAMPLE, height = known ? Math.max(8, Math.round(ih * scale)) : SAMPLE
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, width, height)
  return { data: ctx.getImageData(0, 0, width, height).data, width, height }
}
