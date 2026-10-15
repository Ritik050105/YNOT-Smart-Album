import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { ALBUM_SIZES } from '@/engine/albumSizes'
import { exportAlbumToPdf, exportAlbumToJpegs } from '@/engine/exportAlbum'

export default function TopBar() {
  const project = useProjectStore((s) => s.project)
  const renameProject = useProjectStore((s) => s.renameProject)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const [exporting, setExporting] = useState<string | null>(null)

  function setSize(id: string) {
    const size = ALBUM_SIZES.find((s) => s.id === id)
    if (size) useProjectStore.setState((s) => ({ project: { ...s.project, size } }))
  }

  async function handleExportPdf() {
    setExporting('pdf')
    try {
      await exportAlbumToPdf(project)
    } finally {
      setExporting(null)
    }
  }

  async function handleExportJpegs() {
    setExporting('jpg')
    try {
      await exportAlbumToJpegs(project)
    } finally {
      setExporting(null)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">Album Studio</div>
      <input
        className="topbar__title"
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
      />
      <select value={project.size.id} onChange={(e) => setSize(e.target.value)} className="topbar__size">
        {ALBUM_SIZES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <div className="topbar__spacer" />
      <button className="btn" disabled={history.length === 0} onClick={undo}>
        Undo
      </button>
      <button className="btn" disabled={future.length === 0} onClick={redo}>
        Redo
      </button>
      <button className="btn" disabled={exporting !== null || project.spreads.length === 0} onClick={handleExportJpegs}>
        {exporting === 'jpg' ? 'Exporting…' : 'Export JPGs'}
      </button>
      <button
        className="btn btn--primary"
        disabled={exporting !== null || project.spreads.length === 0}
        onClick={handleExportPdf}
      >
        {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
      </button>
    </header>
  )
}
