import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importAndDedupe, describeImportSummary, ImportSummary } from '@/engine/importWorkflow'
import Icon from './Icon'

function dragHasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')
}

/** Lets photos be dropped anywhere on the window, not just the small Import panel box — the
 *  natural expectation in a desktop app. Window-level listeners only react to real OS file drags
 *  (dataTransfer.types includes "Files"), so this never interferes with the app's own internal
 *  drags (photo-dock → canvas placeholder, which carries a custom "application/x-photo-id" type
 *  instead). A depth counter avoids the classic flicker where dragging over a child element fires
 *  dragleave on its parent. */
export default function GlobalDropZone() {
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const runAutoBuild = useProjectStore((s) => s.runAutoBuild)
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const depth = useRef(0)
  const importing = progress !== null

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!dragHasFiles(e)) return
      e.preventDefault()
      depth.current++
      setActive(true)
    }
    function onDragOver(e: DragEvent) {
      if (!dragHasFiles(e)) return
      e.preventDefault()
    }
    function onDragLeave(e: DragEvent) {
      if (!dragHasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }
    // Capture phase, so this always fires and clears the overlay first — regardless of whether
    // a more specific drop target (ImportPanel, a canvas frame) stopped the event from bubbling
    // back up here. Without this, a drop handled entirely inside a nested target would leave the
    // "drop anywhere" overlay stuck on screen since nothing would ever tell it the drag ended.
    function onDropCapture(e: DragEvent) {
      if (!dragHasFiles(e)) return
      depth.current = 0
      setActive(false)
    }
    async function onDrop(e: DragEvent) {
      if (!dragHasFiles(e)) return
      // A nested target (ImportPanel's dropzone, a canvas frame) already called preventDefault
      // and handled this drop itself — importing again here would double it.
      if (e.defaultPrevented) return
      e.preventDefault()
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : []
      if (files.length === 0) return
      setSummary(null)
      setProgress({ done: 0, total: files.length })
      const { newAssets, summary: result } = await importAndDedupe(
        files,
        useProjectStore.getState().project.photos,
        (done, total) => setProgress({ done, total })
      )
      if (newAssets.length > 0) {
        addPhotos(newAssets)
        // First-ever drop with nothing laid out yet — go straight to a spread instead of leaving
        // the photos sitting in the pool waiting for a separate "Auto-Build" click.
        if (useProjectStore.getState().project.spreads.length === 0) runAutoBuild()
      }
      setProgress(null)
      setSummary(result)
      window.setTimeout(() => setSummary(null), 5000)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDropCapture, true)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDropCapture, true)
      window.removeEventListener('drop', onDrop)
    }
  }, [addPhotos, runAutoBuild])

  const hasIssues = !!summary && (summary.failures.length > 0 || summary.rejected.length > 0)

  return (
    <>
      {(active || importing) && (
        <div className="global-drop-overlay">
          <div className="global-drop-overlay__card">
            <Icon name="upload" size={32} />
            <p>{importing ? `Importing ${progress!.done} of ${progress!.total}…` : 'Drop photos anywhere to import'}</p>
          </div>
        </div>
      )}
      {summary && (
        <div className={`global-drop-toast ${hasIssues ? 'global-drop-toast--warn' : ''}`}>
          <Icon name={hasIssues ? 'info' : 'check'} size={14} />
          {describeImportSummary(summary)}
        </div>
      )}
    </>
  )
}
