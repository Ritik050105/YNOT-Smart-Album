import { useEffect, useRef, useState } from 'react'
import { describeImportSummary } from '@/engine/importWorkflow'
import { useImportPhotos } from '@/engine/useImportPhotos'
import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
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
  const [active, setActive] = useState(false)
  const { handleFiles, importing, progress, lastSummary: summary } = useImportPhotos()
  const depth = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFilesRef = useRef(handleFiles)
  handleFilesRef.current = handleFiles
  const importingRef = useRef(importing)
  importingRef.current = importing
  useEffect(() => {
    const onImport = () => { if (!importingRef.current) inputRef.current?.click() }
    window.addEventListener('album-studio:import-images', onImport)
    return () => window.removeEventListener('album-studio:import-images', onImport)
  }, [])

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
      if (importingRef.current) return
      await handleFilesRef.current(files)
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
  }, [])

  const hasIssues = !!summary && (summary.failures.length > 0 || summary.rejected.length > 0)

  return (
    <>
      <input ref={inputRef} type="file" accept={IMAGE_FILE_ACCEPT} multiple hidden
        onChange={(event) => { void handleFiles(event.target.files); event.target.value = '' }} />
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
