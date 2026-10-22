import { PhotoAsset } from '@/types'
import { importPhotoFiles, ImportFailure } from './importPhotos'
import { blobUrlToDataUrl } from './projectFile'

export interface ImportSummary {
  importedCount: number
  duplicateCount: number
  failures: ImportFailure[]
  rejected: ImportFailure[]
}

/** A filename collision alone must never discard a different camera's photo. */
export async function dedupeImportedAssets(assets: PhotoAsset[], existingPhotos: PhotoAsset[]) {
  const known = [...existingPhotos]
  const newAssets: PhotoAsset[] = []
  const matchedAssets: PhotoAsset[] = []
  const sources = new Map<string, Promise<string | null>>()
  function source(photo: PhotoAsset) {
    if (!sources.has(photo.id)) sources.set(photo.id, blobUrlToDataUrl(photo.src).catch(() => null))
    return sources.get(photo.id)!
  }
  for (const asset of assets) {
    let match: PhotoAsset | undefined
    for (const candidate of known.filter((photo) => photo.fileName === asset.fileName && photo.width === asset.width && photo.height === asset.height)) {
      const [incoming, existing] = await Promise.all([source(asset), source(candidate)])
      if (incoming !== null && incoming === existing) { match = candidate; break }
    }
    if (!match) { newAssets.push(asset); known.push(asset) }
    else if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src)
    matchedAssets.push(match ?? asset)
  }
  return { newAssets, matchedAssets }
}

/** Shared by the photo dock, file drops and the Designer's frame picker. */
export async function importAndDedupe(
  files: File[],
  existingPhotos: PhotoAsset[],
  onProgress?: (done: number, total: number) => void
): Promise<{ newAssets: PhotoAsset[]; matchedAssets: PhotoAsset[]; summary: ImportSummary }> {
  const { assets, failures, rejected } = await importPhotoFiles(files, onProgress)
  const { newAssets, matchedAssets } = await dedupeImportedAssets(assets, existingPhotos)
  const duplicateCount = assets.length - newAssets.length
  return {
    newAssets,
    matchedAssets,
    summary: { importedCount: newAssets.length, duplicateCount, failures, rejected },
  }
}

/** One-line human summary for a toast/status message after an import finishes. */
export function describeImportSummary(summary: ImportSummary): string {
  const parts: string[] = []
  parts.push(`${summary.importedCount} photo${summary.importedCount === 1 ? '' : 's'} imported`)
  if (summary.duplicateCount > 0) parts.push(`${summary.duplicateCount} duplicate${summary.duplicateCount === 1 ? '' : 's'} skipped`)
  if (summary.rejected.length > 0) parts.push(`${summary.rejected.length} non-image file${summary.rejected.length === 1 ? '' : 's'} skipped`)
  if (summary.failures.length > 0) parts.push(`${summary.failures.length} failed`)
  return parts.join(' · ')
}
