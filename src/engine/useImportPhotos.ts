import { useEffect, useState, useSyncExternalStore } from 'react'
import { PhotoAsset } from '@/types'
import { useProjectStore } from '@/state/projectStore'
import { importAndDedupe, ImportSummary } from './importWorkflow'
import { isMissingColorProfileDialogHidden } from './colorProfile'

/** Shared "pick/drop files, dedupe, add to the pool" logic behind every import entry point
 *  (the Import panel's dropzone, and the photo dock's own Import Images/Import Favorites
 *  buttons — the reference app exposes import from both places, not just a collapsible side
 *  panel). `markFavorite` is "Import Favorites": the same import, with every newly added photo
 *  starred on the way in. */
/** Imports run one at a time, across every entry point in the app.
 *
 *  Deduping compares the incoming files against the photos the project holds AT THE MOMENT THE
 *  IMPORT STARTS. Two imports that overlap — a drop that reaches two handlers, or a second drop
 *  before the first has finished decoding — therefore both measure against the same photo list,
 *  neither sees the other's additions, and the same file is added twice. Queuing them means the
 *  second one dedupes against a list that already has the first one's photos in it. */
let importQueue: Promise<unknown> = Promise.resolve()

/** How far the running import has got, shared by every component that asks.
 *
 *  This used to be component state inside the hook, which meant each caller had a progress of its
 *  own: a drop from Explorer is handled by GlobalDropZone, so only GlobalDropZone knew about it
 *  and the photo dock's bar — the one place an import reports itself — stayed empty. That is why
 *  dropping files used to put a card over the whole window saying "Importing 3 of 12": it was the
 *  only component that could see the number. One import, one progress, read wherever it is
 *  wanted. */
let importProgress: { done: number; total: number } | null = null
const progressWatchers = new Set<() => void>()
function setImportProgress(next: { done: number; total: number } | null) {
  importProgress = next
  for (const watch of progressWatchers) watch()
}
function watchImportProgress(onChange: () => void) {
  progressWatchers.add(onChange)
  return () => { progressWatchers.delete(onChange) }
}

export function useImportPhotos() {
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const setPhotoFavorite = useProjectStore((s) => s.setPhotoFavorite)
  const progress = useSyncExternalStore(watchImportProgress, () => importProgress, () => importProgress)
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null)
  useEffect(() => {
    if (!lastSummary) return
    const timer = window.setTimeout(() => setLastSummary(null), lastSummary.failures.length ? 12000 : 4000)
    return () => window.clearTimeout(timer)
  }, [lastSummary])

  function handleFiles(fileList: FileList | File[] | null, opts?: { markFavorite?: boolean }) {
    const files = fileList ? Array.from(fileList) : []
    if (files.length === 0) return Promise.resolve([] as PhotoAsset[])
    const queued = importQueue.then(() => runImport(files, opts), () => runImport(files, opts))
    importQueue = queued.catch(() => {})
    return queued
  }

  async function runImport(files: File[], opts?: { markFavorite?: boolean }) {
    setLastSummary(null)
    setImportProgress({ done: 0, total: files.length })
    const projectId = useProjectStore.getState().project.id
    try {
    const { newAssets, matchedAssets, summary } = await importAndDedupe(files, useProjectStore.getState().project.photos, (done, total) => setImportProgress({ done, total }))
    if (useProjectStore.getState().project.id !== projectId) {
      newAssets.forEach((asset) => { if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src) })
      setImportProgress(null)
      return []
    }
    if (newAssets.length > 0) {
      addPhotos(newAssets)
      useProjectStore.setState({ bottomPanelOpen: true })

      // Importing only fills the photo pool — matching the reference app, spreads are only
      // created once the user explicitly runs Auto Build (or adds a blank spread by hand).
      if (!isMissingColorProfileDialogHidden()) {
        const missing = newAssets.filter(a => a.hasColorProfile === false).map(a => a.fileName)
        if (missing.length > 0) {
          window.dispatchEvent(new CustomEvent('album-studio:missing-color-profile', { detail: { fileNames: missing } }))
        }
      }
    }
    if (opts?.markFavorite) matchedAssets.filter((a) => !a.favorite).forEach((a) => setPhotoFavorite(a.id, true))
    setImportProgress(null)
    setLastSummary(summary)
    return matchedAssets
    } finally { setImportProgress(null) }
  }

  return { handleFiles, importing: progress !== null, progress, lastSummary }
}
