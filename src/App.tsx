import { useEffect, useState } from 'react'
import MenuBar from './components/MenuBar'
import TopBar from './components/TopBar'
import ImportPanel from './components/ImportPanel'
import AlbumInfoPanel from './components/AlbumInfoPanel'
import PhotoBin from './components/PhotoBin'
import SpreadsPanel from './components/SpreadsPanel'
import MatchingTemplatesPanel from './components/MatchingTemplatesPanel'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import GlobalDropZone from './components/GlobalDropZone'
import MissingColorProfileDialog from './components/MissingColorProfileDialog'
import HomeScreen from './components/HomeScreen'
import Icon from './components/Icon'
import NewProjectLoadingOverlay from './components/NewProjectLoadingOverlay'
import DesignerViewScreen from './components/DesignerViewScreen'
import GalleryScreen from './components/GalleryScreen'
import SlideshowScreen from './components/SlideshowScreen'
import { useProjectStore } from '@/state/projectStore'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'
import { useBottomDockResize } from '@/engine/useBottomDockResize'
import { deserializeProjectFile, serializeProjectFile, openProjectFromPath } from '@/engine/projectFile'
import { loadOpenSession, persistRecovery, invalidateRecovery, clearOpenSession, OpenSessionMarker } from '@/engine/sessionMarker'
import { ProjectFile } from '@/types'
import ContinueSessionPrompt from './components/ContinueSessionPrompt'
import CoverSetup from './components/CoverSetup'
import Modal from './components/Modal'
import { confirmDiscardUnsaved } from '@/engine/unsavedChanges'

export default function App() {
  const matchingTemplatesOpen = useProjectStore(s => s.matchingTemplatesOpen)
  const [resumePrompt, setResumePrompt] = useState<OpenSessionMarker | null>(null)
  const [recoveryFile, setRecoveryFile] = useState<ProjectFile | null>(null)
  const [recoveryChecked, setRecoveryChecked] = useState(!window.albumStudio?.isElectron)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryRetry, setRecoveryRetry] = useState(0)
  useEffect(() => {
    if (!window.albumStudio?.isElectron) return
    let active = true
    void window.albumStudio.readRecovery().then((snapshot) => {
      if (!active) return
      const legacy = loadOpenSession()
      if (snapshot) {
        const file = deserializeProjectFile(snapshot.contents)
        setRecoveryFile(file)
        setResumePrompt({ projectId: file.project.id, filePath: snapshot.filePath,
          name: file.project.name, clientName: file.project.clientName, sizeLabel: file.project.size.label,
          spreadCount: file.project.spreads.filter((spread) => !spread.isCover).length, hasRecovery: true })
      } else if (legacy && !legacy.hasRecovery) setResumePrompt(legacy)
      setRecoveryError('')
      setRecoveryChecked(true)
    }).catch((error) => { if (active) setRecoveryError(`Could not read the recovery copy: ${String(error)}`) })
    return () => { active = false }
  }, [recoveryRetry])
  useEffect(() => {
    const onError = (event: Event) => setRecoveryError((event as CustomEvent<string>).detail)
    window.addEventListener('album-studio:recovery-error', onError)
    return () => window.removeEventListener('album-studio:recovery-error', onError)
  }, [])
  useEffect(() => { if (recoveryChecked && recoveryError) window.alert(recoveryError) }, [recoveryChecked, recoveryError])
  const [resuming, setResuming] = useState(false)
  const [showHome, setShowHome] = useState(true)
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const preparingProject = useProjectStore((s) => s.preparingProject)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const markSaved = useProjectStore((s) => s.markSaved)
  const isDirty = useProjectStore((s) => s.isDirty)
  const currentFilePath = useProjectStore((s) => s.currentFilePath)
  const setCurrentFilePath = useProjectStore((s) => s.setCurrentFilePath)
  const project = useProjectStore((s) => s.project)
  const leftPanelOpen = useProjectStore((s) => s.leftPanelOpen)
  const toggleLeftPanel = useProjectStore((s) => s.toggleLeftPanel)
  const revealLeftPanel = useProjectStore((s) => s.revealLeftPanel)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const projectKind = project.kind
  const { bottomPanelOpen, handleMouseDown: handleBottomHandleMouseDown } = useBottomDockResize()
  useEffect(() => {
    const preventUnsavedClose = (event: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnsavedClose)
    return () => window.removeEventListener('beforeunload', preventUnsavedClose)
  }, [])

  useEffect(() => {
    function onEnterEditor() {
      setShowHome(false)
    }
    function onGoHome() {
      if (!confirmDiscardUnsaved(useProjectStore.getState().isDirty)) return
      useProjectStore.getState().markSaved()
      setShowHome(true)
    }
    window.addEventListener('album-studio:enter-editor', onEnterEditor)
    window.addEventListener('album-studio:go-home', onGoHome)
    return () => {
      window.removeEventListener('album-studio:enter-editor', onEnterEditor)
      window.removeEventListener('album-studio:go-home', onGoHome)
    }
  }, [])

  // The main window is the one true store — a separate "New Project" OS window hands its
  // finished options back here over IPC instead of creating the project in its own isolated store.
  useEffect(() => {
    if (!window.albumStudio) return
    return window.albumStudio.onNewProjectCreated((opts) => {
      createProjectFromWizard(opts as never)
      setPreparingProject(true)
      const { project: created, userTemplates } = useProjectStore.getState()
      void finishNewProjectSetup(created, userTemplates).then(({ filePath }) => {
        if (filePath) {
          markSaved()
          setCurrentFilePath(filePath)
        }
        setPreparingProject(false)
        window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))
      })
    })
  }, [createProjectFromWizard, setPreparingProject, markSaved, setCurrentFilePath])

  const userTemplates = useProjectStore((s) => s.userTemplates)
  useEffect(() => {
    if (!window.albumStudio?.isElectron || !recoveryChecked || resumePrompt) return
    if (!isDirty) { clearOpenSession(); return }
    const timer = window.setTimeout(() => {
      void persistRecovery(serializeProjectFile(project, userTemplates), {
        projectId: project.id, filePath: currentFilePath, name: project.name,
        clientName: project.clientName, sizeLabel: project.size.label,
        spreadCount: project.spreads.filter((spread) => !spread.isCover).length,
      }).then(() => setRecoveryError('')).catch((error) => setRecoveryError(`Recovery copy could not be updated. Save your album: ${String(error)}`))
    }, 1000)
    return () => { window.clearTimeout(timer); invalidateRecovery() }
  }, [isDirty, currentFilePath, project, userTemplates, resumePrompt, recoveryChecked])

  async function handleContinueSession() {
    if (!resumePrompt) return
    setResuming(true)
    try {
      const file = recoveryFile ?? (resumePrompt.filePath ? await openProjectFromPath(resumePrompt.filePath) : null)
      if (!file) throw new Error('The saved album could not be found.')
      loadProjectFile(file)
      setCurrentFilePath(resumePrompt.filePath)
      if (recoveryFile) useProjectStore.setState({ isDirty: true })
      setResumePrompt(null)
      setRecoveryFile(null)
      setShowHome(false)
      revealLeftPanel()
    } catch (error) { window.alert(String(error)) }
    finally { setResuming(false) }
  }

  function handleStartFresh() {
    clearOpenSession()
    setResumePrompt(null)
    setRecoveryFile(null)
  }

  if (!recoveryChecked) return recoveryError ? (
    <Modal title="Album recovery needs attention" onClose={() => setRecoveryRetry((value) => value + 1)}
      footer={<>
        <button className="btn" onClick={() => setRecoveryRetry((value) => value + 1)}>Retry Recovery</button>
        <button className="btn" onClick={() => { clearOpenSession(); setRecoveryError(''); setRecoveryChecked(true) }}>Discard Recovery Copy</button>
      </>}>
      <p role="alert">{recoveryError}</p>
    </Modal>
  ) : <NewProjectLoadingOverlay />

  if (resumePrompt) {
    return (
      <ContinueSessionPrompt
        marker={resumePrompt}
        busy={resuming}
        onContinue={() => void handleContinueSession()}
        onStartFresh={handleStartFresh}
      />
    )
  }

  if (preparingProject) return <NewProjectLoadingOverlay />

  if (showHome) return <HomeScreen />

  if (projectKind === 'gallery') return <GalleryScreen />

  if (projectKind === 'slideshow') return <SlideshowScreen />

  if (designerViewSpreadId) return <DesignerViewScreen />

  return (
    <div className="app-shell album-editor">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <CoverSetup />
      <MissingColorProfileDialog />
      <MenuBar />
      <TopBar />
      <MatchingTemplatesPanel />
      <div className="app-body">
        {leftPanelOpen && (
          <aside className="app-sidebar app-sidebar--left">
            <ImportPanel />
          </aside>
        )}
        <button
          className="panel-toggle panel-toggle--left"
          onClick={toggleLeftPanel}
          title={leftPanelOpen ? 'Collapse left panel' : 'Expand left panel'}
        >
          <Icon name={leftPanelOpen ? 'chevronLeft' : 'chevronRight'} size={12} />
        </button>
        <main className="app-main">
          <SpreadsPanel />
        </main>
        <button
          className="panel-toggle panel-toggle--right"
          onClick={toggleRightPanel}
          title={rightPanelOpen ? 'Collapse right panel' : 'Expand right panel'}
        >
          <Icon name={rightPanelOpen ? 'chevronRight' : 'chevronLeft'} size={12} />
        </button>
        {rightPanelOpen && (
          <aside className="app-sidebar app-sidebar--right">
            <AlbumInfoPanel />
          </aside>
        )}
      </div>
      <div className="bottom-panel" hidden={matchingTemplatesOpen}>
        <button
          className="panel-toggle panel-toggle--bottom"
          onMouseDown={handleBottomHandleMouseDown}
          title={bottomPanelOpen ? 'Drag to resize, click to collapse the photo dock' : 'Expand photo dock'}
        >
          <Icon name={bottomPanelOpen ? 'chevronDown' : 'chevronUp'} size={12} />
        </button>
        {bottomPanelOpen && <PhotoBin />}
      </div>
    </div>
  )
}
