import {seedPreview,previewSource,registerPath} from './previewImage'
import { RAW_FILE, imgUrl } from './imageUrl'
import { getPreferences } from '@/state/preferences'
import { v4 as uuid } from 'uuid'
import { PhotoAsset } from '@/types'
import { imageFileSource, isImageFile } from './imageSource'
import { hasColorProfile } from './colorProfile'
import { SubjectFocus, samplePixels, subjectFocusFromImage } from './subjectFocus'

const CONCURRENCY = 3

function blackAndWhiteFromPixels(data: Uint8ClampedArray): boolean | undefined {
  let colored = 0, visible = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    visible++
    if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 12) colored++
  }
  return visible > 0 ? colored / visible < 0.015 : undefined
}

/** Both of the things the importer measures from the pixels, from a single decode of the cached
 *  512px thumbnail rather than of the 1600px preview. Neither answer is worth failing an
 *  import over, so an unreadable preview gives nothing back instead of throwing. */
async function analysePreview(src: string): Promise<{ blackAndWhite?: boolean; focus?: SubjectFocus }> {
  try {
    const thumbnail = await previewSource(src, 512)
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = thumbnail })
    const pixels = samplePixels(image)
    if (!pixels) return {}
    return { blackAndWhite: blackAndWhiteFromPixels(pixels), focus: subjectFocusFromImage(image) ?? undefined }
  } catch { return {} }
}

export interface ImportFailure {
  fileName: string
  reason: string
}

export interface ImportResult {
  assets: PhotoAsset[]
  failures: ImportFailure[]
  /** Files skipped before processing even started because they weren't image files. */
  rejected: ImportFailure[]
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not decode this image — it may be corrupted or an unsupported format.'))
    img.src = src
  })
}

function orientationFor(width: number, height: number): PhotoAsset['orientation'] {
  if (Math.abs(width - height) / Math.max(width, height) < 0.03) return 'square'
  return width >= height ? 'landscape' : 'portrait'
}

async function importOneFile(file: File, fallbackOrder: number): Promise<PhotoAsset> {
  const sourcePath = window.albumStudio?.getImagePath?.(file) || undefined
  const isRaw = RAW_FILE.test(file.name)
  const cached = !!(window.albumStudio?.prepareImage && sourcePath && (isRaw || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(file.name)))
  if (isRaw && !cached) throw new Error('RAW photos can be imported in the desktop application only.')
  // RAW photos use the camera's embedded JPEG (served by the image cache) as their source; the original stays referenced by sourcePath.
  const src = isRaw ? imgUrl('r', sourcePath!) : await imageFileSource(file)
  let capturedAt: string | null = null
  let cameraModel: string | undefined
  let metadata: Record<string,string> = {}
  try {
    const { default: exifr } = await import('exifr') // on demand: 75 kB the home screen does not need
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Make', 'Model','ColorSpace','ExposureTime','FNumber','ISO','ExposureCompensation','FocalLength','LensModel','Flash'])
    if(exif)for(const [label,key] of Object.entries({'Color profile':'ColorSpace','Shutter speed':'ExposureTime','Aperture':'FNumber','ISO':'ISO','Exposure compensation':'ExposureCompensation','Focal length':'FocalLength','Lens model':'LensModel','Flash fired':'Flash'})){if(exif[key]!=null)metadata[label]=label === 'Color profile' && exif[key] === 1 ? 'sRGB' : String(exif[key])}
    cameraModel = [exif?.Make, exif?.Model].filter(Boolean).join(' ') || undefined
    const date: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate
    if (date instanceof Date && !isNaN(date.getTime())) capturedAt = date.toISOString()
  } catch {
    // Not every format carries EXIF (e.g. plain PNG) — fall back below.
  }
  if (!capturedAt) {
    capturedAt = file.lastModified ? new Date(file.lastModified).toISOString() : new Date(Date.now() + fallbackOrder).toISOString()
  }

  const fast = cached ? await window.albumStudio!.prepareImage(sourcePath!) : null
  if (fast && sourcePath) registerPath(src, sourcePath)
  const legacy = !fast && window.albumStudio?.imagePreview && /\.(jpe?g|png|webp|gif|tiff?|avif|heic)$/i.test(file.name)
    ? await window.albumStudio.imagePreview(sourcePath ?? new Uint8Array(await file.arrayBuffer())) : null
  if (legacy) seedPreview(src,legacy.src,legacy.thumb,sourcePath)
  const prepared = fast ?? (legacy || null)
  const { width, height } = prepared ?? await loadImageDimensions(src)
  // The desktop path already worked the black-and-white flag out in the main process; the focal
  // point is only measured here, so one small decode covers whatever is still missing.
  const analysed = await analysePreview(src)
  const isBlackAndWhite = prepared ? prepared.isBlackAndWhite : analysed.blackAndWhite
  const focus = analysed.focus

  return {
    id: uuid(),
    fileName: file.name,
    sourcePath,
    hasColorProfile: prepared?.hasColorProfile ?? await hasColorProfile(file),
    src,
    width,
    height,
    capturedAt,
    cameraModel, metadata,
    isBlackAndWhite,
    orientation: orientationFor(width, height),
    megapixels: Math.round((width * height) / 1_000_000),
    mimeType: /\.(psd|tiff?)$/i.test(file.name) ? 'image/png' : isRaw ? 'image/jpeg' : file.type || 'image/jpeg',
    focusX: focus?.focusX,
    focusY: focus?.focusY,
    bins: getPreferences().autoBins && (file.webkitRelativePath ?? '').includes('/') ? [file.webkitRelativePath.split('/').slice(-2,-1)[0]] : [],
    favorite: false,
  }
}

/** Runs `tasks` with at most `limit` in flight at once — keeps a big batch of large photos from
 *  loading all simultaneously (which can stall the renderer) while still being much faster than
 *  the old strictly-sequential loop. */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0
  async function runner() {
    while (next < items.length) {
      const index = next++
      await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner))
}

/**
 * Reads EXIF capture time (falling back to file lastModified, then import order) and builds a
 * PhotoAsset per file. Resilient to a bad file in the batch — one corrupted/unreadable photo is
 * reported in `failures` instead of aborting the whole import, and non-image files are reported
 * in `rejected` up front. Processes several files concurrently so large batches (a full shoot)
 * import in a reasonable time instead of one-at-a-time.
 */
export async function importPhotoFiles(files: File[], onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const imageFiles = files.filter(isImageFile)
  const rejected: ImportFailure[] = files
    .filter((f) => !isImageFile(f))
    .map((f) => ({ fileName: f.name, reason: 'Not an image file' }))

  const assets: PhotoAsset[] = new Array(imageFiles.length)
  const failures: ImportFailure[] = []
  let done = 0

  await runWithConcurrency(imageFiles, CONCURRENCY, async (file, index) => {
    try {
      assets[index] = await importOneFile(file, index)
    } catch (err) {
      failures.push({ fileName: file.name, reason: err instanceof Error ? err.message : 'Import failed' })
    } finally {
      done++
      onProgress?.(done, imageFiles.length)
    }
  })

  return { assets: assets.filter((a): a is PhotoAsset => !!a), failures, rejected }
}
