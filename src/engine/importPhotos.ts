import exifr from 'exifr'
import { v4 as uuid } from 'uuid'
import { PhotoAsset } from '@/types'

const CONCURRENCY = 6

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
  const src = URL.createObjectURL(file)
  let capturedAt: string | null = null
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate', 'ModifyDate'])
    const date: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate
    if (date instanceof Date && !isNaN(date.getTime())) capturedAt = date.toISOString()
  } catch {
    // Not every format carries EXIF (e.g. plain PNG) — fall back below.
  }
  if (!capturedAt) {
    capturedAt = file.lastModified ? new Date(file.lastModified).toISOString() : new Date(Date.now() + fallbackOrder).toISOString()
  }

  const { width, height } = await loadImageDimensions(src)

  return {
    id: uuid(),
    fileName: file.name,
    src,
    width,
    height,
    capturedAt,
    orientation: orientationFor(width, height),
    megapixels: Math.round((width * height) / 1_000_000),
    mimeType: file.type || 'image/jpeg',
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
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  const rejected: ImportFailure[] = files
    .filter((f) => !f.type.startsWith('image/'))
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
