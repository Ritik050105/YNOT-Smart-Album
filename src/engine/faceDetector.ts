/** Real face detection for the editor. The model runs in a hidden window (see electron/faceWindow.ts and faceWorker.ts), so it can never
 *  stall the editor; this side sends it the picture and turns the faces it finds into the one face box a photograph keeps. Without the
 *  desktop bridge (a browser, the tests) nothing is detected and the caller keeps the skin-colour guess from subjectFocus.ts. */
import type { PhotoAsset } from '@/types'

export type FaceBox = Pick<PhotoAsset, 'focusX' | 'focusY' | 'focusW' | 'focusH'>

/** One face box from the faces found: the biggest face, joined by the faces nearly as big (a couple stays together in the crop), unless
 *  that join would be a large part of the picture (a crowd), when the biggest face alone is kept. Fractions of the picture; the point
 *  is the eyes, a little above the middle of the box. */
export function faceBoxFrom(faces: Array<{ x: number; y: number; width: number; height: number; score: number }>, imageWidth: number, imageHeight: number): FaceBox | null {
  const sure = faces.filter(f => f.score >= 0.5 && f.width > 0 && f.height > 0)
  if (!sure.length) return null
  const area = (f: { width: number; height: number }) => f.width * f.height
  const biggest = sure.reduce((a, b) => (area(b) * b.score > area(a) * a.score ? b : a))
  const band = sure.filter(f => area(f) >= area(biggest) * 0.5)
  const x0 = Math.min(...band.map(f => f.x)), x1 = Math.max(...band.map(f => f.x + f.width))
  const y0 = Math.min(...band.map(f => f.y)), y1 = Math.max(...band.map(f => f.y + f.height))
  const joined = (y1 - y0) / imageHeight <= 0.5 && (x1 - x0) / imageWidth <= 0.7
  const box = joined ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : biggest
  const eyes = joined && band.length > 1 ? box.y + box.height * 0.5 : box.y + box.height * 0.4
  return { focusX: (box.x + box.width / 2) / imageWidth, focusY: eyes / imageHeight, focusW: box.width / imageWidth, focusH: box.height / imageHeight }
}

/** The face box in a decoded picture. null: the detector could not run (keep the colour guess); { box: null }: it ran and saw no face. */
export async function detectFaceBox(image: HTMLImageElement): Promise<{ box: FaceBox | null } | null> {
  const detect = window.albumStudio?.detectFaces
  const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height
  if (!detect || !(w > 0 && h > 0)) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, w, h)
    const faces = await detect(canvas.toDataURL('image/jpeg', 0.9))
    return faces ? { box: faceBoxFrom(faces, w, h) } : null
  } catch { return null }
}
