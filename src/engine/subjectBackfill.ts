import { PhotoAsset } from '@/types'
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
    const box = subjectBoxFromImage(image)
    if (!box) return null
    const focus = subjectFocusFromImage(image)
    return { focusX: focus?.focusX ?? box.focusX, focusY: box.focusY, focusW: box.width, focusH: box.height }
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
