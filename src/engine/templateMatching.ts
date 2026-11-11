import { PhotoAsset, TemplateDefinition } from '@/types'
import { resolveTemplateFrames } from './templateLayout'
import { shapeOf } from './layoutMath'

export function templateFramesInReadingOrder(template: TemplateDefinition) {
  return [...template.placeholders].sort((a, b) => a.x - b.x || a.y - b.y)
}

/** Minimum crop loss, with timeline order fixed or an optimal one-to-one frame assignment. */
export function matchTemplatePhotos(photos: PhotoAsset[], template: TemplateDefinition, aspect = 1, keepOrder = true, marginPx = 0, gapPx = 0) {
  const ratios = resolveTemplateFrames(template.placeholders, aspect, marginPx, gapPx).map(frame => frame.width > 0 && frame.height > 0 ? frame.width * aspect / frame.height : NaN)
  const costs = ratios.map((ratio) => photos.map((photo) => {
    if (!(ratio > 0) || !Number.isFinite(ratio)) return 1000
    const photoRatio = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : photo.orientation === 'portrait' ? 2 / 3 : photo.orientation === 'landscape' ? 1.5 : 1
    return 1 - Math.min(ratio / photoRatio, photoRatio / ratio)
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
  return { photos: assignment.map((index) => photos[index]), score: assignment.reduce((sum, index, frame) => sum + costs[frame][index], 0) / Math.max(1, photos.length) }
}

/** The shape of each photo, using its real pixels and falling back to the orientation recorded at
 *  import when a photo has not been measured. */
function photoShapes(photos: PhotoAsset[]): ('landscape' | 'portrait' | 'square')[] {
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
  const frameShapes = frames.map((frame) => shapeOf(frame.width * aspect, frame.height))
  const count = (list: string[], shape: string) => list.filter((value) => value === shape).length
  const portraitShort = Math.max(0, count(shapes, 'portrait') - count(frameShapes, 'portrait'))
  const landscapeShort = Math.max(0, count(shapes, 'landscape') - count(frameShapes, 'landscape'))
  // Square frames are the give in the system: they take any photograph, so they soak up whichever
  // shape the layout is short of before anything counts as a mismatch.
  return Math.max(0, portraitShort + landscapeShort - count(frameShapes, 'square'))
}

export function rankTemplates(photos: PhotoAsset[], templates: TemplateDefinition[], aspect = 1, keepOrder = true, marginPx = 0, gapPx = 0) {
  return templates.map((template) => ({ template, ...matchTemplatePhotos(photos, template, aspect, keepOrder, marginPx, gapPx) }))
    .sort((a, b) => a.score - b.score)
}
