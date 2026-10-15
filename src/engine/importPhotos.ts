import exifr from 'exifr'
import { v4 as uuid } from 'uuid'
import { PhotoAsset } from '@/types'

function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}

function orientationFor(width: number, height: number): PhotoAsset['orientation'] {
  if (Math.abs(width - height) / Math.max(width, height) < 0.03) return 'square'
  return width >= height ? 'landscape' : 'portrait'
}

/**
 * Reads EXIF capture time (falling back to file lastModified, then import order) and builds
 * a PhotoAsset per file. This is the data the timeline-based auto-layout sorts/groups on.
 */
export async function importPhotoFiles(files: File[]): Promise<PhotoAsset[]> {
  const results: PhotoAsset[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
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
      capturedAt = file.lastModified
        ? new Date(file.lastModified).toISOString()
        : new Date(Date.now() + i).toISOString()
    }

    const { width, height } = await loadImageDimensions(src)

    results.push({
      id: uuid(),
      fileName: file.name,
      src,
      width,
      height,
      capturedAt,
      orientation: orientationFor(width, height),
      megapixels: Math.round((width * height) / 1_000_000),
      mimeType: file.type || 'image/jpeg',
    })
  }
  return results
}
