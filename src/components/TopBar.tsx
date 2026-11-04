import SelectionActions from './SelectionActions'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { ALBUM_SIZES, ALBUM_SIZE_CATEGORIES } from '@/engine/albumSizes'
import { serializeProjectFile, saveProjectToFile, openProjectFromFile, openProjectFromPath } from '@/engine/projectFile'
import { Theme, applyTheme, getStoredTheme } from '@/engine/theme'
import { DisplayUnit } from '@/engine/units'
import { recordRecentProject } from '@/engine/recentProjects'
import { clearOpenSession } from '@/engine/sessionMarker'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'
import { confirmDiscardUnsaved } from '@/engine/unsavedChanges'
import Icon from './Icon'
import Modal from './Modal'
import ExportModal from './ExportModal'
import CustomSizeModal from './CustomSizeModal'
import NewProjectWizard from './NewProjectWizard'
import ProjectInfoPanel from './ProjectInfoPanel'

const CUSTOM_SIZE_OPTION = '__custom__'

export default function TopBar({ actionsOnly = false }: { actionsOnly?: boolean }) {
  const settingsRef=useRef<HTMLDetailsElement>(null)
  useEffect(()=>{const close=(e:Event)=>{if(settingsRef.current&&!settingsRef.current.contains(e.target as Node))settingsRef.current.open=false};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&settingsRef.current)settingsRef.current.open=false};document.addEventListener('pointerdown',close,true);document.addEventListener('focusin',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('focusin',close);document.removeEventListener('keydown',key)}},[])
  const project = useProjectStore((s) => s.project)
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const renameProject = useProjectStore((s) => s.renameProject)
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const markSaved = useProjectStore((s) => s.markSaved)
  const setCurrentFilePath = useProjectStore((s) => s.setCurrentFilePath)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasTool = useProjectStore((s) => s.setCanvasTool)
  const [projectBusy, setProjectBusy] = useState<'save' | 'open' | 'copy' | null>(null)
  const [copyStatus, setCopyStatus] = useState<{ busy?: boolean; filePath?: string; error?: string } | null>(null)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  useEffect(() => { const observer = new MutationObserver(() => setTheme(getStoredTheme())); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); return () => observer.disconnect() }, [])



  const isCustomSize = !ALBUM_SIZES.some((s) => s.id === project.size.id)

  function setSize(id: string) {
    if (id === CUSTOM_SIZE_OPTION) {
      setCustomSizeOpen(true)
      return
    }
    const size = ALBUM_SIZES.find((s) => s.id === id)
    if (size) useProjectStore.getState().updateProjectSettings({ size })
  }

  function applyCustomSize(size: typeof project.size, units: DisplayUnit) {
    useProjectStore.getState().updateProjectSettings({ size, units })
    setCustomSizeOpen(false)
  }

  async function handleCopyProject() {
    if (projectBusy !== null || !window.albumStudio?.copyProjectPackage) return
    const { project, userTemplates } = useProjectStore.getState()
    setProjectBusy('copy')
    setCopyStatus({ busy: true })
    try {
      const contents = await serializeProjectFile(project, userTemplates, true)
      const result = await window.albumStudio.copyProjectPackage({ defaultName: project.name, contents })
      setCopyStatus(result.saved ? { filePath: result.filePath } : null)
    } catch (error) {
      setCopyStatus({ error: `Could not finish the copy. Your original project is unchanged. ${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setProjectBusy(null)
    }
  }

  async function handleSaveProject(saveAs = false, closeAfterSave = false) {
    const { project, userTemplates } = useProjectStore.getState()
    setProjectBusy('save')
    try {
      const result = await saveProjectToFile(project, userTemplates, saveAs ? null : useProjectStore.getState().currentFilePath)
      if (result.saved) {
        recordRecentProject({
          projectId: project.id,
        createdAt: project.createdAt,
          name: project.name,
          clientName: project.clientName,
          sizeLabel: project.size.label,
          filePath: result.filePath,
          spreadCount: project.spreads.filter((s) => !s.isCover).length,
          kind: project.kind,
        })
        const current = useProjectStore.getState()
        const unchanged = current.project === project && current.userTemplates === userTemplates
        if (current.project.id === project.id) setCurrentFilePath(result.filePath ?? null)
        if (unchanged) {
          markSaved()
          clearOpenSession()
          if (closeAfterSave) await window.albumStudio?.closeCurrentWindow()
        } else if (closeAfterSave) {
          alert('The album changed while saving. Your latest edits are still open; save them before closing.')
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save the project. Your edits are still open.')
    } finally {
      setProjectBusy(null)
    }
  }

  async function handleOpenProject(filePath?: string) {
    setProjectBusy('open')
    try {
      const file = filePath ? await openProjectFromPath(filePath) : null
      const opened = filePath ? (file ? { file, filePath } : null) : await openProjectFromFile()
      if (opened) {
        if (!confirmDiscardUnsaved(useProjectStore.getState().isDirty)) return
        loadProjectFile(opened.file)
        recordRecentProject({
          projectId: opened.file.project.id,
        createdAt: opened.file.project.createdAt,
          name: opened.file.project.name,
          clientName: opened.file.project.clientName,
          sizeLabel: opened.file.project.size.label,
          filePath: opened.filePath,
          spreadCount: opened.file.project.spreads.filter((s) => !s.isCover).length,
          kind: opened.file.project.kind,
        })
        setCurrentFilePath(opened.filePath ?? null)
        // A freshly opened project has no unsaved edits yet.
        clearOpenSession()
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
    function onSaveAs() {
      if (projectBusy === null) void handleSaveProject(true)
    }
    function onOpenExport() {
      if (project.spreads.length > 0) setExportOpen(true)
    }
    function onNewProject() {
      handleNewProjectClick()
    }
    function onOpenProject(event: Event) {
      if (projectBusy === null) void handleOpenProject((event as CustomEvent<{ filePath?: string }>).detail?.filePath)
    }
    const unsubscribeClose = window.albumStudio?.onSaveBeforeClose(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      if (projectBusy === null) void handleSaveProject(false, true)
    })
    const onCopy = () => { void handleCopyProject() }
    window.addEventListener('album-studio:copy-project', onCopy)
    window.addEventListener('album-studio:save-project', onSave)
    window.addEventListener('album-studio:save-project-as', onSaveAs)
    window.addEventListener('album-studio:open-export', onOpenExport)
    window.addEventListener('album-studio:new-project', onNewProject)
    window.addEventListener('album-studio:open-project', onOpenProject)
    return () => {
      unsubscribeClose?.()
      window.removeEventListener('album-studio:copy-project', onCopy)
      window.removeEventListener('album-studio:save-project', onSave)
      window.removeEventListener('album-studio:save-project-as', onSaveAs)
      window.removeEventListener('album-studio:open-export', onOpenExport)
      window.removeEventListener('album-studio:new-project', onNewProject)
      window.removeEventListener('album-studio:open-project', onOpenProject)
    }
  })

  return (
    <header className="topbar" style={actionsOnly ? { display: 'contents' } : undefined}>
      {!actionsOnly && <>
      <button className="btn btn--icon" title="Back to Home" onClick={() => window.dispatchEvent(new CustomEvent('album-studio:go-home'))}><Icon name="home" /></button>
      <button className={`btn btn--icon ${canvasTool === 'select' ? 'is-active' : ''}`} title="Select tool (V)" onClick={() => setCanvasTool('select')}><Icon name="cursor" /></button>
      <button className={`btn btn--icon ${canvasTool === 'pan' ? 'is-active' : ''}`} title="Pan tool (H)" onClick={() => setCanvasTool('pan')}><Icon name="hand" /></button>
      <SelectionActions/><div className="topbar__stats">
        {project.spreads.filter((s) => !s.isCover).length} spreads ({project.spreads.filter((s) => !s.isCover).reduce((n, s) => n + (s.pageSide === 'spread' ? 2 : 1), 0)} pages), {new Set(project.spreads.flatMap((s) => s.placements.flatMap((p) => p.photoId ? [p.photoId] : []))).size}/{project.photos.length} images used
        <div className="topbar__format" aria-label="Album format and size">{project.size.category} · {project.size.widthIn} × {project.size.heightIn} in</div>
      </div>
      <details ref={settingsRef} className="topbar__settings"><summary className="btn" title="Album settings">Album <Icon name="chevronDown" size={12} /></summary><div className="topbar__settings-panel">
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


        <button className="btn" onClick={handleNewProjectClick}>New Album</button>
        <button className="btn" disabled={projectBusy !== null} onClick={() => void handleOpenProject()}>Open Project</button>
        <button className="btn" disabled={projectBusy !== null} onClick={() => void handleSaveProject()}>Save Project</button>
        {window.albumStudio?.copyProjectPackage && <button className="btn" disabled={projectBusy !== null} onClick={() => void handleCopyProject()}>Copy project…</button>}
        <button className="btn" disabled={history.length === 0} onClick={() => undo()}>Undo</button>
        <button className="btn" disabled={future.length === 0} onClick={() => redo()}>Redo</button>
        <label>Theme preset<select value={theme} onChange={e=>{const value=e.target.value as Theme;setTheme(value);applyTheme(value)}}><option value="light">Sapphire Light</option><option value="dark">Crimson Black</option><option value="classic">Classic Graphite &amp; Gold</option></select></label>
      </div></details>
      <button className={`btn btn--icon ${bottomPanelOpen ? 'is-active' : ''}`} title={bottomPanelOpen ? 'Hide image browser' : 'Show image browser'} aria-label={bottomPanelOpen ? 'Hide image browser' : 'Show image browser'} aria-expanded={bottomPanelOpen} onClick={toggleBottomPanel}><Icon name="panelBottom" /></button>
      <button className={`btn btn--icon ${rightPanelOpen ? 'is-active' : ''}`} title={rightPanelOpen ? 'Hide album sidebar' : 'Show album sidebar'} aria-label={rightPanelOpen ? 'Hide album sidebar' : 'Show album sidebar'} aria-expanded={rightPanelOpen} onClick={toggleRightPanel}><Icon name="panelRight" /></button>
      <button className="btn btn--primary" disabled={project.spreads.length === 0} onClick={() => setExportOpen(true)}><Icon name="download" size={14} />Export</button>

      </>}
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
      {copyStatus && <Modal title={copyStatus.busy ? 'Copying your project' : copyStatus.error ? 'Project copy incomplete' : 'Your project copy is ready'} onClose={() => setCopyStatus(null)} footer={<>
        {copyStatus.filePath && <button className="btn" onClick={() => { void window.albumStudio?.revealExportLocation(copyStatus.filePath!).catch(error => setCopyStatus({ ...copyStatus, error: String(error) })) }}>Show folder</button>}
        <button className="btn" onClick={() => setCopyStatus(null)}>{copyStatus.busy ? 'Keep working' : 'Done'}</button>
      </>}>
        {copyStatus.busy && <div role="status"><progress aria-label="Copying project and original photos" /><p>Choose a destination folder. YNOT will copy your project and its original photos together.</p><p className="muted">Large albums can take a few minutes. Keep YNOT open and the destination drive connected until the copy is ready.</p></div>}
        {copyStatus.filePath && <><p>Your project and photos are together in a new folder. Open Album.ynot to continue on another computer with YNOT installed.</p><p style={{ overflowWrap: 'anywhere' }}>{copyStatus.filePath}</p><p className="muted">This copy contains the project as it was when copying started. Your current project stays open.</p></>}
        {copyStatus.error && <p role="alert">{copyStatus.error}</p>}
      </Modal>}
    </header>
  )
}
