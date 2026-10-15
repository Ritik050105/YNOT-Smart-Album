import { useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importPhotoFiles } from '@/engine/importPhotos'
import Icon from './Icon'

export default function ImportPanel() {
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const runAutoBuild = useProjectStore((s) => s.runAutoBuild)
  const photos = useProjectStore((s) => s.project.photos)
  const options = useProjectStore((s) => s.autoLayoutOptions)
  const setOptions = useProjectStore((s) => s.setAutoLayoutOptions)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setImporting(true)
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    const assets = await importPhotoFiles(files)
    addPhotos(assets)
    setImporting(false)
  }

  return (
    <div className="panel import-panel">
      <h3>
        <Icon name="image" size={14} />
        Import Photos
      </h3>
      <div
        className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <Icon name="upload" size={22} />
        {importing ? 'Reading photos…' : 'Drop photos here or click to browse'}
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        {photos.length} photo{photos.length === 1 ? '' : 's'} imported
      </p>

      <div className="auto-layout-controls">
        <label>
          <span className="row">
            Story sensitivity
            <span className="value-pill">{options.gapMinutes}m</span>
          </span>
          <input
            type="range"
            min={2}
            max={120}
            value={options.gapMinutes}
            onChange={(e) => setOptions({ gapMinutes: Number(e.target.value) })}
          />
        </label>
        <label>
          <span className="row">
            Max photos per spread
            <span className="value-pill">{options.maxPhotosPerSpread}</span>
          </span>
          <input
            type="range"
            min={1}
            max={6}
            value={options.maxPhotosPerSpread}
            onChange={(e) => setOptions({ maxPhotosPerSpread: Number(e.target.value) })}
          />
        </label>
        <button className="btn btn--primary btn--block" disabled={photos.length === 0} onClick={() => runAutoBuild()}>
          <Icon name="sparkles" size={14} />
          Auto-Build Album
        </button>
      </div>
    </div>
  )
}
