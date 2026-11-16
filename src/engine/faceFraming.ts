import { PhotoAsset, PlacedPhoto, Spread } from '@/types'
import { computeCoverCrop } from './cropFit'
import { DESIGN_WIDTH, computePlaceholderBoxes } from './layoutMath'

/** Where to put a photograph in a frame so the subject's face is kept whole and well placed.
 *
 *  A frame is almost never the photograph's shape, so part of the picture is cut away. Centring the cut loses heads, and in a wide
 *  frame it loses the top of the picture, where faces are. This centres the crop on the face (the eyes, as the importer measured
 *  them), then moves it the least that keeps the whole head, with room above it, inside the crop. Where the face is tiny in a big
 *  frame it also comes in a little (never past 1.4x, so a partner beside the subject is not cropped away). Photographs with no
 *  measured subject are left as they were. */
export interface FaceFraming { focalX: number; focalY: number; zoom: number }

const MAX_ZOOM = 1.4
const TINY_FACE = 0.12

export function faceFraming(photo: Pick<PhotoAsset, 'width' | 'height' | 'focusX' | 'focusY' | 'focusW' | 'focusH'>, frameRatio: number): FaceFraming {
  const fx = photo.focusX ?? 0.5
  const fy = photo.focusY ?? 0.5
  if (!(photo.width > 0 && photo.height > 0) || !(frameRatio > 0)) return { focalX: fx, focalY: fy, zoom: 1 }
  const fw = photo.focusW, fh = photo.focusH
  if (!fw || !fh) return { focalX: fx, focalY: fy, zoom: 1 }
  const base = computeCoverCrop(photo.width, photo.height, frameRatio, 1, fx, fy, 1)
  const cropH = base.cropHeight / photo.height
  // The face is small next to the crop: come in a little, so the person fills the frame rather than being a speck in it.
  const zoom = fh / cropH < TINY_FACE ? Math.min(MAX_ZOOM, Math.max(1, TINY_FACE / (fh / cropH))) : 1
  const crop = computeCoverCrop(photo.width, photo.height, frameRatio, 1, fx, fy, zoom)
  const cw = crop.cropWidth / photo.width, ch = crop.cropHeight / photo.height
  // The head: the eyes sit 45% down the face; hair and headroom above add another quarter of its height.
  const top = fy - fh * 0.7, bottom = fy + fh * 0.55, left = fx - fw * 0.65, right = fx + fw * 0.65
  let focalX = fx, focalY = fy
  const cropLeft = Math.min(Math.max(fx - cw / 2, 0), Math.max(0, 1 - cw)), cropTop = Math.min(Math.max(fy - ch / 2, 0), Math.max(0, 1 - ch))
  if (right - left <= cw) {
    if (left < cropLeft) focalX -= cropLeft - left
    else if (right > cropLeft + cw) focalX += right - (cropLeft + cw)
  }
  if (bottom - top <= ch) {
    if (top < cropTop) focalY -= cropTop - top
    else if (bottom > cropTop + ch) focalY += bottom - (cropTop + ch)
  }
  return { focalX: Math.min(1, Math.max(0, focalX)), focalY: Math.min(1, Math.max(0, focalY)), zoom: Math.round(zoom * 100) / 100 }
}

/** The photographs of a spread placed for their faces in the frames the spread's layout gives them. Frames the designer locked, and
 *  photographs that cannot be found, are left alone. */
export function applyFaceFraming(spread: Spread, photos: PhotoAsset[] | undefined, aspect: number): Spread {
  if (!photos?.length || !(aspect > 0) || !spread.placements.some(p => p.photoId)) return spread
  const byId = new Map(photos.map(p => [p.id, p]))
  const boxes = new Map(computePlaceholderBoxes(spread, DESIGN_WIDTH, DESIGN_WIDTH / aspect).map(b => [b.placeholderId, b]))
  let changed = false
  const placements = spread.placements.map((pl): PlacedPhoto => {
    const photo = pl.photoId ? byId.get(pl.photoId) : undefined, box = boxes.get(pl.placeholderId)
    // Only a photograph whose face was measured is reframed; any other keeps the crop and zoom it already has.
    if (!photo || !photo.focusW || !photo.focusH || !box || pl.locked || !(box.width > 0 && box.height > 0)) return pl
    const framing = faceFraming(photo, box.width / box.height)
    if (framing.focalX === pl.focalX && framing.focalY === pl.focalY && framing.zoom === pl.zoom) return pl
    changed = true
    return { ...pl, ...framing }
  })
  return changed ? { ...spread, placements } : spread
}
