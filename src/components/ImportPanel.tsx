import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { describeImportSummary } from '@/engine/importWorkflow'
import { useImportPhotos } from '@/engine/useImportPhotos'
import { autoBuildTargetPhotoIds } from '@/engine/autoBuildTarget'
import AutoBuildModal from './AutoBuildModal'
import Icon from './Icon'
import SliderField from './SliderField'

export default function ImportPanel() {
  const photos = useProjectStore((s) => s.project.photos)
  const spreads = useProjectStore((s) => s.project.spreads)
  const selectedPhotoIds = useProjectStore((s) => s.selectedPhotoIds)
  const options = useProjectStore((s) => s.autoLayoutOptions)
  const setOptions = useProjectStore((s) => s.setAutoLayoutOptions)
  const [isDragging, setIsDragging] = useState(false)
  const [autoBuildOpen, setAutoBuildOpen] = useState(false)
  const { handleFiles, importing, progress, lastSummary } = useImportPhotos()
  const dragDepth = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const autoBuildTargets = autoBuildTargetPhotoIds(photos, spreads, selectedPhotoIds)

  const hasIssues = !!lastSummary && (lastSummary.failures.length > 0 || lastSummary.rejected.length > 0)

  // Lets File > Import Images… (and its Ctrl+I shortcut) open the same file picker as clicking
  // the dropzone, without lifting this panel's local input ref into the store.
  useEffect(() => {
    function onImportImages() {
      if (!importing) inputRef.current?.click()
    }
    window.addEventListener('album-studio:import-images', onImportImages)
    return () => window.removeEventListener('album-studio:import-images', onImportImages)
  }, [importing])

  return (
    <div className="panel import-panel">
      <h3>
        <Icon name="image" size={14} />
        Import Photos
      </h3>
      <div
        className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${importing ? 'dropzone--busy' : ''}`}
        // Counting enter/leave (instead of a plain boolean) avoids the classic flicker bug where
        // dragging over a child element inside the dropzone fires dragleave on the parent.
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation() // owns this drag — keeps GlobalDropZone's window-wide overlay out of the way
          dragDepth.current++
          if (!importing) setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setIsDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepth.current = 0
          setIsDragging(false)
          if (!importing) void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => !importing && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error -- non-standard but widely supported attribute for folder picking
          webkitdirectory=""
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Icon name="upload" size={22} />
        {importing ? (
          <>
            Importing {progress!.done} of {progress!.total}…
            <div className="dropzone__progress">
              <div className="dropzone__progress-bar" style={{ width: `${(progress!.done / Math.max(1, progress!.total)) * 100}%` }} />
            </div>
          </>
        ) : (
          'Drop photos (or a whole folder) here, or click to browse'
        )}
      </div>
      <button
        className="btn btn--tiny btn--block"
        style={{ marginTop: 6 }}
        disabled={importing}
        onClick={() => folderInputRef.current?.click()}
      >
        <Icon name="folder" size={11} />
        Import Entire Folder
      </button>

      {lastSummary && (
        <p className={`import-summary ${hasIssues ? 'import-summary--warn' : 'import-summary--ok'}`}>
          <Icon name={hasIssues ? 'info' : 'check'} size={12} />
          {describeImportSummary(lastSummary)}
          {lastSummary.failures.length > 0 && (
            <span className="import-summary__detail">
              {' '}
              ({lastSummary.failures.slice(0, 3).map((f) => f.fileName).join(', ')}
              {lastSummary.failures.length > 3 ? '…' : ''})
            </span>
          )}
        </p>
      )}

      <p className="muted" style={{ marginTop: 8 }}>
        {photos.length} photo{photos.length === 1 ? '' : 's'} total in your pool
      </p>

      <div className="auto-layout-controls">
        <button
          className="btn btn--primary btn--block"
          disabled={autoBuildTargets.length === 0}
          onClick={() => setAutoBuildOpen(true)}
        >
          <Icon name="sparkles" size={14} />
          Auto-Build Album
        </button>
        <details className="auto-layout-controls__advanced">
          <summary>Auto-Build settings</summary>
          <SliderField
            label="Story sensitivity"
            value={options.gapMinutes}
            min={1}
            max={180}
            suffix="m"
            onChange={(v) => setOptions({ gapMinutes: v })}
          />
          <SliderField
            label="Max photos per spread"
            value={options.maxPhotosPerSpread}
            min={1}
            max={30}
            onChange={(v) => setOptions({ maxPhotosPerSpread: v })}
          />
        </details>
      </div>

      {autoBuildOpen && <AutoBuildModal photoIds={autoBuildTargets} onClose={() => setAutoBuildOpen(false)} />}
    </div>
  )
}
