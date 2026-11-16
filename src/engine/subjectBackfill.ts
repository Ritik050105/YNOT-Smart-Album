import { PhotoAsset, Project } from '@/types'
import { previewSource } from './previewImage'
import { subjectBoxFromImage, subjectFocusFromImage } from './subjectFocus'

/** Photographs imported before the face size was kept have a focal point but not the size of the face, which frames need to keep the
 *  whole head in the crop. This measures them again from the cached thumbnail, one at a time while the app is idle, so a layout change
 *  on an older album frames faces as well as a new import does. Nothing is changed but the photograph's own measurements. */
const tried = new Set<string>()

export async function measureSubject(photo: PhotoAsset): Promise<Pick<PhotoAsset, 'focusX' | 'focusY' | 'focusW' | 'focusH'> | null> {
  try {
    const thumbnail = await previewSource(photo.src, 512)
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = thumbnail })
    const box = subjectBoxFromImage(image), focus = subjectFocusFromImage(image)
    if (box) return { focusX: focus?.focusX ?? box.focusX, focusY: box.focusY, focusW: box.width, focusH: box.height }
    // No face found: still the point to keep (the head of an upright picture sits high), measured again with today's rules.
    return focus ? { focusX: focus.focusX, focusY: focus.focusY } : null
  } catch { return null }
}

/** The photographs of a project that still need measuring, once each per session. */
export function photosToMeasure(photos: PhotoAsset[]): PhotoAsset[] {
  return photos.filter(p => p.focusW === undefined && !tried.has(p.id) && p.width > 0)
}

export async function backfillSubjects(getPhotos: () => PhotoAsset[], apply: (id: string, patch: Partial<PhotoAsset>) => void, shouldStop: () => boolean) {
  for (const photo of photosToMeasure(getPhotos()).slice(0, 500)) {
    if (shouldStop()) return
    tried.add(photo.id)
    const found = await measureSubject(photo)
    if (found) apply(photo.id, found)
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}

/** The project with a photograph's new measurements, and with the crop of every frame that still has the photograph's old starting crop (never
 *  adjusted by hand: not locked, not zoomed, its point where the photograph's old point was) moved to the new point, so an album made before the
 *  subject was measured well shows its faces without anyone touching a layout. */
export function withMeasuredSubject(project: Project, id: string, patch: Partial<PhotoAsset>): Project {
  const old = project.photos.find(p => p.id === id)
  if (!old) return project
  const oldX = old.focusX ?? 0.5, oldY = old.focusY ?? 0.5, newX = patch.focusX ?? oldX, newY = patch.focusY ?? oldY
  const near = (a: number | undefined, b: number) => Math.abs((a ?? 0.5) - b) < 0.005
  const photos = project.photos.map(p => p.id === id ? { ...p, ...patch } : p)
  if (oldX === newX && oldY === newY) return { ...project, photos }
  const spreads = project.spreads.map(spread => {
    if (!spread.placements.some(pl => pl.photoId === id)) return spread
    return { ...spread, placements: spread.placements.map(pl => pl.photoId === id && !pl.locked && (pl.zoom ?? 1) === 1 && near(pl.focalX, oldX) && near(pl.focalY, oldY) ? { ...pl, focalX: newX, focalY: newY } : pl) }
  })
  return { ...project, photos, spreads }
}
