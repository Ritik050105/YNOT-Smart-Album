import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { ALBUM_SIZES, ALBUM_SIZE_CATEGORIES } from '@/engine/albumSizes'
import { saveProjectToFile, openProjectFromFile } from '@/engine/projectFile'
import Icon from './Icon'
import Modal from './Modal'
import ExportModal from './ExportModal'
import CustomSizeModal from './CustomSizeModal'
import NewProjectWizard from './NewProjectWizard'
import ynotMark from '@/assets/ynot-mark-white.png'

const CUSTOM_SIZE_OPTION = '__custom__'

export default function TopBar() {
  const project = useProjectStore((s) => s.project)
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const renameProject = useProjectStore((s) => s.renameProject)
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const [projectBusy, setProjectBusy] = useState<'save' | 'open' | null>(null)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isCustomSize = !ALBUM_SIZES.some((s) => s.id === project.size.id)

  function setSize(id: string) {
    if (id === CUSTOM_SIZE_OPTION) {
      setCustomSizeOpen(true)
      return
    }
    const size = ALBUM_SIZES.find((s) => s.id === id)
    if (size) useProjectStore.setState((s) => ({ project: { ...s.project, size } }))
  }

  function applyCustomSize(size: typeof project.size, units: 'in' | 'cm') {
    useProjectStore.setState((s) => ({ project: { ...s.project, size, units } }))
    setCustomSizeOpen(false)
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

  function handleNewProjectClick() {
    if (project.spreads.length > 0 || project.photos.length > 0) {
      setConfirmDiscard(true)
      return
    }
    setNewProjectOpen(true)
  }

  // Lets the global Ctrl/Cmd+S and Ctrl/Cmd+E keyboard shortcuts (KeyboardShortcuts.tsx) trigger
  // the same save/export flows as their toolbar buttons, without lifting this component's state.
  useEffect(() => {
    function onSave() {
      if (projectBusy === null) void handleSaveProject()
    }
    function onOpenExport() {
      if (project.spreads.length > 0) setExportOpen(true)
    }
    function onNewProject() {
      handleNewProjectClick()
    }
    function onOpenProject() {
      if (projectBusy === null) void handleOpenProject()
    }
    window.addEventListener('album-studio:save-project', onSave)
    window.addEventListener('album-studio:open-export', onOpenExport)
    window.addEventListener('album-studio:new-project', onNewProject)
    window.addEventListener('album-studio:open-project', onOpenProject)
    return () => {
      window.removeEventListener('album-studio:save-project', onSave)
      window.removeEventListener('album-studio:open-export', onOpenExport)
      window.removeEventListener('album-studio:new-project', onNewProject)
      window.removeEventListener('album-studio:open-project', onOpenProject)
    }
  })

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

      <button className="btn btn--icon" title="New Album" onClick={handleNewProjectClick}>
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

      <div className="topbar__spacer" />

      <button className="btn btn--icon" title="Undo" disabled={history.length === 0} onClick={undo}>
        <Icon name="undo" />
      </button>
      <button className="btn btn--icon" title="Redo" disabled={future.length === 0} onClick={redo}>
        <Icon name="redo" />
      </button>
      <button
        className="btn btn--icon"
        title="Keyboard & Mouse Shortcuts (?)"
        onClick={() => window.dispatchEvent(new CustomEvent('album-studio:toggle-shortcuts-help'))}
      >
        <Icon name="info" />
      </button>

      <div className="topbar__divider" />

      <button
        className="btn btn--primary"
        disabled={project.spreads.length === 0}
        onClick={() => setExportOpen(true)}
      >
        <Icon name="download" size={14} />
        Export
      </button>

      {customSizeOpen && (
        <CustomSizeModal
          initial={project.size}
          initialUnits={project.units}
          onCancel={() => setCustomSizeOpen(false)}
          onApply={applyCustomSize}
        />
      )}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      {newProjectOpen && <NewProjectWizard onClose={() => setNewProjectOpen(false)} />}
      {confirmDiscard && (
        <Modal
          title="Start a new album?"
          onClose={() => setConfirmDiscard(false)}
          width={380}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDiscard(false)}>
                Cancel
              </button>
              <div className="footer-spacer" />
              <button
                className="btn btn--danger"
                onClick={() => {
                  setConfirmDiscard(false)
                  setNewProjectOpen(true)
                }}
              >
                Discard & Continue
              </button>
            </>
          }
        >
          <p className="muted">Unsaved changes to the current album will be lost. Save first if you want to keep them.</p>
        </Modal>
      )}
    </header>
  )
}
