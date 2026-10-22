import exifr from 'exifr'
import { v4 as uuid } from 'uuid'
import { PhotoAsset } from '@/types'
import { imageFileSource, isImageFile } from './imageSource'

const CONCURRENCY = 6

async function detectBlackAndWhite(src: string): Promise<boolean | undefined> {
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = src })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 48
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return undefined
    ctx.drawImage(img, 0, 0, 48, 48)
    const { data } = ctx.getImageData(0, 0, 48, 48)
    let colored = 0
    let visible = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      visible++
      if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 12) colored++
    }
    return visible > 0 ? colored / visible < 0.015 : undefined
  } catch { return undefined }
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
  const src = await imageFileSource(file)
  let capturedAt: string | null = null
  let cameraModel: string | undefined
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Make', 'Model'])
    cameraModel = [exif?.Make, exif?.Model].filter(Boolean).join(' ') || undefined
    const date: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate
    if (date instanceof Date && !isNaN(date.getTime())) capturedAt = date.toISOString()
  } catch {
    // Not every format carries EXIF (e.g. plain PNG) — fall back below.
  }
  if (!capturedAt) {
    capturedAt = file.lastModified ? new Date(file.lastModified).toISOString() : new Date(Date.now() + fallbackOrder).toISOString()
  }

  const { width, height } = await loadImageDimensions(src)
  const isBlackAndWhite = await detectBlackAndWhite(src)

  return {
    id: uuid(),
    fileName: file.name,
    src,
    width,
    height,
    capturedAt,
    cameraModel,
    isBlackAndWhite,
    orientation: orientationFor(width, height),
    megapixels: Math.round((width * height) / 1_000_000),
    mimeType: /\.(psd|tiff?)$/i.test(file.name) ? 'image/png' : file.type || 'image/jpeg',
    bins: [],
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
