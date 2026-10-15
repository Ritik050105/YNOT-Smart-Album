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
import Icon from './Icon'
import ynotMark from '@/assets/ynot-mark-white.png'
import { AlbumSize } from '@/types'

type ExportFormat = 'pdf' | 'jpg' | 'png' | 'psd' | 'proofing'
const CUSTOM_SIZE_OPTION = '__custom__'

function CustomSizeForm({
  initial,
  onCancel,
  onApply,
}: {
  initial: AlbumSize
  onCancel: () => void
  onApply: (widthIn: number, heightIn: number, dpi: number, bleedIn: number) => void
}) {
  const [widthIn, setWidthIn] = useState(initial.widthIn)
  const [heightIn, setHeightIn] = useState(initial.heightIn)
  const [dpi, setDpi] = useState(initial.dpi)
  const [bleedIn, setBleedIn] = useState(initial.bleedIn)

  return (
    <div className="custom-size-popover">
      <div className="custom-size-popover__row">
        <label>
          Width (in)
          <input type="number" min={1} max={60} step={0.1} value={widthIn} onChange={(e) => setWidthIn(Number(e.target.value))} />
        </label>
        <label>
          Height (in)
          <input type="number" min={1} max={60} step={0.1} value={heightIn} onChange={(e) => setHeightIn(Number(e.target.value))} />
        </label>
      </div>
      <div className="custom-size-popover__row">
        <label>
          DPI
          <input type="number" min={72} max={600} step={1} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
        </label>
        <label>
          Bleed (in)
          <input type="number" min={0} max={1} step={0.0625} value={bleedIn} onChange={(e) => setBleedIn(Number(e.target.value))} />
        </label>
      </div>
      <div className="custom-size-popover__actions">
        <button className="btn btn--tiny" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn--tiny btn--primary"
          onClick={() => onApply(widthIn, heightIn, dpi, bleedIn)}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

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
  const [customSizeOpen, setCustomSizeOpen] = useState(false)

  const isCustomSize = !ALBUM_SIZES.some((s) => s.id === project.size.id)

  function setSize(id: string) {
    if (id === CUSTOM_SIZE_OPTION) {
      setCustomSizeOpen(true)
      return
    }
    const size = ALBUM_SIZES.find((s) => s.id === id)
    if (size) useProjectStore.setState((s) => ({ project: { ...s.project, size } }))
  }

  function applyCustomSize(widthIn: number, heightIn: number, dpi: number, bleedIn: number) {
    useProjectStore.setState((s) => ({
      project: {
        ...s.project,
        size: {
          id: 'custom',
          label: `Custom ${widthIn}" x ${heightIn}"`,
          category: 'Custom',
          widthIn,
          heightIn,
          dpi,
          bleedIn,
        },
      },
    }))
    setCustomSizeOpen(false)
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
      <div className="topbar__brand">
        <span className="topbar__brand-mark">
          <img src={ynotMark} alt="YNOT Photography" />
        </span>
        <span className="topbar__brand-name">
          YNOT <span className="topbar__brand-sub">Album Studio</span>
        </span>
      </div>

      <button className="btn btn--icon" title="New Album" onClick={handleNewProject}>
        <Icon name="plus" />
      </button>
      <button className="btn btn--icon" title="Open Project" disabled={projectBusy !== null} onClick={handleOpenProject}>
        <Icon name="folder" />
      </button>
      <button className="btn btn--icon" title="Save Project" disabled={projectBusy !== null} onClick={handleSaveProject}>
        <Icon name="save" />
      </button>

      <div className="topbar__divider" />

      <input
        className="topbar__title"
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        title="Album name"
      />
      <div className="topbar__size-wrap">
        <select
          value={isCustomSize ? CUSTOM_SIZE_OPTION : project.size.id}
          onChange={(e) => setSize(e.target.value)}
          className="topbar__size"
        >
          {ALBUM_SIZE_CATEGORIES.map((category) => (
            <optgroup key={category} label={category}>
              {ALBUM_SIZES.filter((s) => s.category === category).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={CUSTOM_SIZE_OPTION}>{isCustomSize ? project.size.label : 'Custom size…'}</option>
        </select>
        {customSizeOpen && (
          <CustomSizeForm
            initial={project.size}
            onCancel={() => setCustomSizeOpen(false)}
            onApply={applyCustomSize}
          />
        )}
      </div>

      <div className="topbar__spacer" />

      <button className="btn btn--icon" title="Undo" disabled={history.length === 0} onClick={undo}>
        <Icon name="undo" />
      </button>
      <button className="btn btn--icon" title="Redo" disabled={future.length === 0} onClick={redo}>
        <Icon name="redo" />
      </button>

      <div className="topbar__divider" />

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
        <Icon name="download" size={14} />
        {exporting ? 'Exporting…' : 'Export'}
      </button>
    </header>
  )
}
