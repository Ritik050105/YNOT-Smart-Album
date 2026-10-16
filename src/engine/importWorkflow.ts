import { PhotoAsset } from '@/types'
import { importPhotoFiles, ImportFailure } from './importPhotos'

export interface ImportSummary {
  importedCount: number
  duplicateCount: number
  failures: ImportFailure[]
  rejected: ImportFailure[]
}

/** Imports `files`, then drops any whose filename already exists in the project (the common case
 *  of re-dragging the same folder) before handing back what's actually new to add. Shared by the
 *  Import panel, the window-wide drop zone, and dropping a photo straight onto a canvas frame, so
 *  all three entry points behave identically. */
export async function importAndDedupe(
  files: File[],
  existingPhotos: PhotoAsset[],
  onProgress?: (done: number, total: number) => void
): Promise<{ newAssets: PhotoAsset[]; summary: ImportSummary }> {
  const existingNames = new Set(existingPhotos.map((p) => p.fileName))
  const { assets, failures, rejected } = await importPhotoFiles(files, onProgress)
  const newAssets = assets.filter((a) => !existingNames.has(a.fileName))
  const duplicateCount = assets.length - newAssets.length
  return {
    newAssets,
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
