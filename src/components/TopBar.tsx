import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { ALBUM_SIZES, ALBUM_SIZE_CATEGORIES } from '@/engine/albumSizes'
import { saveProjectToFile, openProjectFromFile } from '@/engine/projectFile'
import { Theme, applyTheme, getStoredTheme } from '@/engine/theme'
import { DisplayUnit } from '@/engine/units'
import { recordRecentProject } from '@/engine/recentProjects'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'
import Icon from './Icon'
import Modal from './Modal'
import ExportModal from './ExportModal'
import CustomSizeModal from './CustomSizeModal'
import NewProjectWizard from './NewProjectWizard'
import ProjectInfoPanel from './ProjectInfoPanel'
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
  const leftPanelOpen = useProjectStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleLeftPanel = useProjectStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasTool = useProjectStore((s) => s.setCanvasTool)
  const [projectBusy, setProjectBusy] = useState<'save' | 'open' | null>(null)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    setTheme(next)
  }

  const isCustomSize = !ALBUM_SIZES.some((s) => s.id === project.size.id)

  function setSize(id: string) {
    if (id === CUSTOM_SIZE_OPTION) {
      setCustomSizeOpen(true)
      return
    }
    const size = ALBUM_SIZES.find((s) => s.id === id)
    if (size) useProjectStore.setState((s) => ({ project: { ...s.project, size } }))
  }

  function applyCustomSize(size: typeof project.size, units: DisplayUnit) {
    useProjectStore.setState((s) => ({ project: { ...s.project, size, units } }))
    setCustomSizeOpen(false)
  }

  async function handleSaveProject() {
    setProjectBusy('save')
    try {
      const result = await saveProjectToFile(project, userTemplates)
      if (result.saved) {
        recordRecentProject({
          projectId: project.id,
          name: project.name,
          clientName: project.clientName,
          sizeLabel: project.size.label,
          filePath: result.filePath,
          spreadCount: project.spreads.filter((s) => !s.isCover).length,
          kind: project.kind,
        })
      }
    } finally {
      setProjectBusy(null)
    }
  }

  async function handleOpenProject() {
    setProjectBusy('open')
    try {
      const opened = await openProjectFromFile()
      if (opened) {
        loadProjectFile(opened.file)
        recordRecentProject({
          projectId: opened.file.project.id,
          name: opened.file.project.name,
          clientName: opened.file.project.clientName,
          sizeLabel: opened.file.project.size.label,
          filePath: opened.filePath,
          spreadCount: opened.file.project.spreads.filter((s) => !s.isCover).length,
          kind: opened.file.project.kind,
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open that project file.')
    } finally {
      setProjectBusy(null)
    }
  }

  function openNewProjectUI() {
    // In Electron this opens a genuinely separate OS window (matching the reference app); the
    // in-page modal is kept only as a fallback for the browser dev preview, which can't open
    // real OS windows.
    if (window.albumStudio?.isElectron) {
      void window.albumStudio.openNewProjectWindow()
    } else {
      setNewProjectOpen(true)
    }
  }

  async function handleAlbumCreated() {
    setPreparingProject(true)
    const { project, userTemplates } = useProjectStore.getState()
    await finishNewProjectSetup(project, userTemplates)
    setPreparingProject(false)
  }

  function handleNewProjectClick() {
    if (project.spreads.length > 0 || project.photos.length > 0) {
      setConfirmDiscard(true)
      return
    }
    openNewProjectUI()
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
      <button
        className="topbar__brand"
        title="Back to Home"
        onClick={() => window.dispatchEvent(new CustomEvent('album-studio:go-home'))}
      >
        <span className="topbar__brand-mark">
          <img src={ynotMark} alt="YNOT Photography" />
        </span>
        <span className="topbar__brand-name">
          YNOT <span className="topbar__brand-sub">Album Studio</span>
        </span>
      </button>

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

      <button
        className={`btn btn--icon ${canvasTool === 'select' ? 'is-active' : ''}`}
        title="Select tool (V)"
        onClick={() => setCanvasTool('select')}
      >
        <Icon name="cursor" size={14} />
      </button>
      <button
        className={`btn btn--icon ${canvasTool === 'pan' ? 'is-active' : ''}`}
        title="Pan tool (H) — or just hold Space"
        onClick={() => setCanvasTool('pan')}
      >
        <Icon name="hand" size={14} />
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
      <button className="btn btn--icon" title="Project Details" onClick={() => setInfoOpen(true)}>
        <Icon name="info" size={14} />
      </button>

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
      <button
        className="btn btn--icon"
        title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        onClick={toggleTheme}
      >
        <Icon name={theme === 'light' ? 'moon' : 'sun'} />
      </button>

      <div className="topbar__divider" />

      <button
        className={`btn btn--icon ${leftPanelOpen ? 'is-active' : ''}`}
        title={leftPanelOpen ? 'Hide left panel' : 'Show left panel'}
        onClick={toggleLeftPanel}
      >
        <Icon name="panelLeft" size={14} />
      </button>
      <button
        className={`btn btn--icon ${rightPanelOpen ? 'is-active' : ''}`}
        title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
        onClick={toggleRightPanel}
      >
        <Icon name="panelRight" size={14} />
      </button>
      <button
        className={`btn btn--icon ${bottomPanelOpen ? 'is-active' : ''}`}
        title={bottomPanelOpen ? 'Hide photo dock' : 'Show photo dock'}
        onClick={toggleBottomPanel}
      >
        <Icon name="panelBottom" size={14} />
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
      {newProjectOpen && (
        <NewProjectWizard onClose={() => setNewProjectOpen(false)} onCreated={() => void handleAlbumCreated()} />
      )}
      {infoOpen && <ProjectInfoPanel onClose={() => setInfoOpen(false)} />}
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
                  openNewProjectUI()
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
