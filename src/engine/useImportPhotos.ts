import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importAndDedupe, ImportSummary } from './importWorkflow'
import { hasColorProfile, isMissingColorProfileDialogHidden } from './colorProfile'

/** Shared "pick/drop files, dedupe, add to the pool" logic behind every import entry point
 *  (the Import panel's dropzone, and the photo dock's own Import Images/Import Favorites
 *  buttons — the reference app exposes import from both places, not just a collapsible side
 *  panel). `markFavorite` is "Import Favorites": the same import, with every newly added photo
 *  starred on the way in. */
export function useImportPhotos() {
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const setPhotoFavorite = useProjectStore((s) => s.setPhotoFavorite)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null)

  async function handleFiles(fileList: FileList | File[] | null, opts?: { markFavorite?: boolean }) {
    const files = fileList ? Array.from(fileList) : []
    if (files.length === 0) return []
    setLastSummary(null)
    setProgress({ done: 0, total: files.length })
    const projectId = useProjectStore.getState().project.id
    const { newAssets, matchedAssets, summary } = await importAndDedupe(files, useProjectStore.getState().project.photos, (done, total) => setProgress({ done, total }))
    if (useProjectStore.getState().project.id !== projectId) {
      newAssets.forEach((asset) => { if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src) })
      setProgress(null)
      return []
    }
    if (newAssets.length > 0) {
      addPhotos(newAssets)
      useProjectStore.setState({ bottomPanelOpen: true })

      // Importing only fills the photo pool — matching the reference app, spreads are only
      // created once the user explicitly runs Auto Build (or adds a blank spread by hand).
      if (!isMissingColorProfileDialogHidden()) {
        const fileByName = new Map(files.map((f) => [f.name, f]))
        const missing = (
          await Promise.all(
            newAssets.map(async (a) => {
              const f = fileByName.get(a.fileName)
              return f && !(await hasColorProfile(f)) ? a.fileName : null
            })
          )
        ).filter((n): n is string => !!n)
        if (missing.length > 0) {
          window.dispatchEvent(new CustomEvent('album-studio:missing-color-profile', { detail: { fileNames: missing } }))
        }
      }
    }
    if (opts?.markFavorite) matchedAssets.filter((a) => !a.favorite).forEach((a) => setPhotoFavorite(a.id, true))
    setProgress(null)
    setLastSummary(summary)
    return matchedAssets
  }

  return { handleFiles, importing: progress !== null, progress, lastSummary }
}
