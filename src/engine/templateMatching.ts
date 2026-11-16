import { PhotoAsset, TemplateDefinition } from '@/types'
import { resolveTemplateFramesShared as resolveTemplateFrames } from './templateLayout'
import { SQUARISH_MAX, SQUARISH_MIN, shapeFitsStrictly, shapeOf } from './layoutMath'

/** Frames in the order photographs fill them: by left edge, then top edge. Remembered per template, since it is
 *  asked of every candidate on every press of Next; the array is shared, so it is read, never changed. */
const readingOrders = new WeakMap<TemplateDefinition['placeholders'], TemplateDefinition['placeholders']>()
export function templateFramesInReadingOrder(template: TemplateDefinition) {
  let order = readingOrders.get(template.placeholders)
  if (!order) readingOrders.set(template.placeholders, order = [...template.placeholders].sort((a, b) => a.x - b.x || a.y - b.y))
  return order
}

/** Minimum crop loss, with timeline order fixed or an optimal one-to-one frame assignment. */
export function matchTemplatePhotos(photos: PhotoAsset[], template: TemplateDefinition, aspect = 1, keepOrder = true, marginPx = 0, gapPx = 0) {
  const ratios = resolveTemplateFrames(template.placeholders, aspect, marginPx, gapPx).map(frame => frame.width > 0 && frame.height > 0 ? frame.width * aspect / frame.height : NaN)
  const crops = ratios.map((ratio) => photos.map((photo) => {
    if (!(ratio > 0) || !Number.isFinite(ratio)) return 1000
    const photoRatio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : photo.orientation === 'portrait' ? 2 / 3 : photo.orientation === 'landscape' ? 1.5 : 1
    return 1 - Math.min(ratio / photoRatio, photoRatio / ratio)
  }))
  // The assignment is chosen on these costs, which add to the crop loss a heavy charge for a photograph in a frame of the opposite
  // shape: a wrong-shaped frame is worth far more than any crop saving elsewhere, so the assignment gives every photograph a frame
  // of its own shape whenever there is a way to. The score reported is still the crop loss alone.
  const costs = crops.map((row, f) => row.map((crop, p) => {
    if (crop >= 1000) return crop
    const photo = photos[p], photoRatio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : photo.orientation === 'portrait' ? 2 / 3 : photo.orientation === 'landscape' ? 1.5 : 1
    return shapeFitsStrictly(shapeOf(photoRatio, 1), ratios[f], 1) ? crop : crop + 4
  }))
  if (ratios.length !== photos.length) return { photos, score: Infinity }
  let assignment = photos.map((_, index) => index)
  if (keepOrder) templateFramesInReadingOrder(template).forEach((frame, index) => { assignment[template.placeholders.indexOf(frame)] = index })
  if (!keepOrder && photos.length) {
    // Hungarian assignment avoids a greedy early frame stealing a later frame's only good fit.
    const n = photos.length, u = Array(n + 1).fill(0), v = Array(n + 1).fill(0), p = Array(n + 1).fill(0), way = Array(n + 1).fill(0)
    for (let i = 1; i <= n; i++) {
      p[0] = i
      let j0 = 0
      const min = Array(n + 1).fill(Infinity), used = Array(n + 1).fill(false)
      do {
        used[j0] = true
        const i0 = p[j0]
        let delta = Infinity, j1 = 0
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cost = costs[i0 - 1][j - 1] - u[i0] - v[j]
          if (cost < min[j]) { min[j] = cost; way[j] = j0 }
          if (min[j] < delta) { delta = min[j]; j1 = j }
        }
        for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta } else min[j] -= delta
        j0 = j1
      } while (p[j0] !== 0)
      do { const previous = way[j0]; p[j0] = p[previous]; j0 = previous } while (j0 !== 0)
    }
    assignment = Array(n).fill(0)
    for (let j = 1; j <= n; j++) assignment[p[j] - 1] = j - 1
  }
  return { photos: assignment.map((index) => photos[index]), score: assignment.reduce((sum, index, frame) => sum + crops[frame][index], 0) / Math.max(1, photos.length) }
}

/** The shape of each photo, using its real pixels and falling back to the orientation recorded at
 *  import when a photo has not been measured. */
export function photoShapes(photos: PhotoAsset[]): ('landscape' | 'portrait' | 'square')[] {
  return photos.map((photo) => {
    const ratio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height
      : photo.orientation === 'portrait' ? 2 / 3 : photo.orientation === 'landscape' ? 1.5 : 1
    return shapeOf(ratio, 1)
  })
}

/** Whether every photo can have a frame of its own shape.
 *
 *  A portrait photo in a landscape frame loses the top and bottom of the picture — the subject's
 *  head, usually — and no amount of cropping gets it back, so a layout that would force that is not
 *  offered for this set of photos at all. Square frames are the give in the system: they take any
 *  photo, so they soak up whichever shape the layout is short of. */
export function templateShapesFit(photos: PhotoAsset[], template: TemplateDefinition, aspect = 1, marginPx = 0, gapPx = 0): boolean {
  return templateShapeMismatches(photos, template, aspect, marginPx, gapPx) === 0
}

/** How many photographs this layout cannot give a frame of their own shape, which is zero for a
 *  layout that fits. A count rather than a yes-or-no, because a mixed drop of uprights and
 *  landscapes often has no layout that suits every one of them, and the honest answer then is the
 *  layout that suits the most — not whichever happened to rank first among all the wrong ones. */
export function templateShapeMismatches(photos: PhotoAsset[], template: TemplateDefinition, aspect = 1, marginPx = 0, gapPx = 0): number {
  const frames = resolveTemplateFrames(template.placeholders, aspect, marginPx, gapPx)
  if (frames.length !== photos.length) return photos.length
  const shapes = photoShapes(photos)
  // Which frames each photograph may take, by the strict rule, and the most photographs that can be given a frame at once (a
  // maximum matching: a photograph that fits several frames must not take the only one another fits).
  const takes = shapes.map(shape => frames.map((frame, f) => (frame.width > 0 && frame.height > 0 && shapeFitsStrictly(shape, frame.width * aspect, frame.height) ? f : -1)).filter(f => f >= 0))
  const owner = new Array<number>(frames.length).fill(-1)
  const place = (photo: number, seen: boolean[]): boolean => {
    for (const f of takes[photo]) {
      if (seen[f]) continue
      seen[f] = true
      if (owner[f] < 0 || place(owner[f], seen)) { owner[f] = photo; return true }
    }
    return false
  }
  let framed = 0
  // The photographs with the fewest choices first.
  for (const photo of shapes.map((_, i) => i).sort((a, b) => takes[a].length - takes[b].length)) if (place(photo, new Array(frames.length).fill(false))) framed++
  return photos.length - framed
}

/** The same count as templateShapeMismatches, for when the photographs keep their order: photo k
 *  goes into the k-th frame in reading order, so a layout that has the right number of upright and
 *  landscape frames can still put a panorama in a tall frame. This checks the frame each photo would
 *  really get. */
export function templateOrderMismatches(photos: PhotoAsset[], template: TemplateDefinition, aspect = 1, marginPx = 0, gapPx = 0): number {
  const frames = resolveTemplateFrames(template.placeholders, aspect, marginPx, gapPx)
  if (frames.length !== photos.length) return photos.length
  return templateFramesInReadingOrder(template).reduce((count, placeholder, k) => {
    const frame = frames[template.placeholders.indexOf(placeholder)], photo = photos[k]
    return count + (shapeFitsStrictly(photoShapes([photo])[0], frame.width * aspect, frame.height) ? 0 : 1)
  }, 0)
}

export function rankTemplates(photos: PhotoAsset[], templates: TemplateDefinition[], aspect = 1, keepOrder = true, marginPx = 0, gapPx = 0) {
  return templates.map((template) => ({ template, ...matchTemplatePhotos(photos, template, aspect, keepOrder, marginPx, gapPx) }))
    .sort((a, b) => a.score - b.score)
}

/** One letter per photograph (L, P or S) for its shape: what a layout's fit depends on, and a short key to remember answers by. */
export function photoShapeCodes(photos: PhotoAsset[]): string {
  return photoShapes(photos).map((shape) => (shape === 'landscape' ? 'L' : shape === 'portrait' ? 'P' : 'S')).join('')
}
