import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { ALBUM_SIZES, ALBUM_SIZE_CATEGORIES } from '@/engine/albumSizes'
import {
  exportAlbumToPdf,
  exportAlbumToJpegs,
  exportAlbumToPngs,
  exportAlbumToPsds,
  exportAlbumToProofingGallery,
} from '@/engine/exportAlbum'
import { saveProjectToFile, openProjectFromFile } from '@/engine/projectFile'

type ExportFormat = 'pdf' | 'jpg' | 'png' | 'psd' | 'proofing'

export default function TopBar() {
  const project = useProjectStore((s) => s.project)
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const renameProject = useProjectStore((s) => s.renameProject)
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const newProjectFile = useProjectStore((s) => s.newProjectFile)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const [exporting, setExporting] = useState(false)
  const [projectBusy, setProjectBusy] = useState<'save' | 'open' | null>(null)
  const [format, setFormat] = useState<ExportFormat>('pdf')

  function setSize(id: string) {
    const size = ALBUM_SIZES.find((s) => s.id === id)
    if (size) useProjectStore.setState((s) => ({ project: { ...s.project, size } }))
  }

  async function handleExport() {
    setExporting(true)
    try {
      if (format === 'pdf') await exportAlbumToPdf(project)
      else if (format === 'jpg') await exportAlbumToJpegs(project)
      else if (format === 'png') await exportAlbumToPngs(project)
      else if (format === 'psd') await exportAlbumToPsds(project)
      else if (format === 'proofing') await exportAlbumToProofingGallery(project)
    } finally {
      setExporting(false)
    }
  }

  async function handleSaveProject() {
    setProjectBusy('save')
    try {
      await saveProjectToFile(project, userTemplates)
    } finally {
      setProjectBusy(null)
    }
  }

  async function handleOpenProject() {
    setProjectBusy('open')
    try {
      const file = await openProjectFromFile()
      if (file) loadProjectFile(file)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open that project file.')
    } finally {
      setProjectBusy(null)
    }
  }

  function handleNewProject() {
    if (project.spreads.length > 0 || project.photos.length > 0) {
      const ok = confirm('Start a new album? Unsaved changes to the current one will be lost.')
      if (!ok) return
    }
    newProjectFile()
  }

  return (
    <header className="topbar">
      <div className="topbar__brand">Album Studio</div>
      <button className="btn" onClick={handleNewProject}>
        New
      </button>
      <button className="btn" disabled={projectBusy !== null} onClick={handleOpenProject}>
        {projectBusy === 'open' ? 'Opening…' : 'Open'}
      </button>
      <button className="btn" disabled={projectBusy !== null} onClick={handleSaveProject}>
        {projectBusy === 'save' ? 'Saving…' : 'Save'}
      </button>
      <input
        className="topbar__title"
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
      />
      <select value={project.size.id} onChange={(e) => setSize(e.target.value)} className="topbar__size">
        {ALBUM_SIZE_CATEGORIES.map((category) => (
          <optgroup key={category} label={category}>
            {ALBUM_SIZES.filter((s) => s.category === category).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="topbar__spacer" />
      <button className="btn" disabled={history.length === 0} onClick={undo}>
        Undo
      </button>
      <button className="btn" disabled={future.length === 0} onClick={redo}>
        Redo
      </button>
      <select className="topbar__size" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
        <option value="pdf">PDF (album)</option>
        <option value="jpg">JPG (per spread)</option>
        <option value="png">PNG (per spread)</option>
        <option value="psd">PSD (per spread, layered)</option>
        <option value="proofing">Proofing Gallery (HTML)</option>
      </select>
      <button
        className="btn btn--primary"
        disabled={exporting || project.spreads.length === 0}
        onClick={handleExport}
      >
        {exporting ? 'Exporting…' : 'Export'}
      </button>
    </header>
  )
}
