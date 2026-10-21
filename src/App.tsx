import { useEffect, useState } from 'react'
import MenuBar from './components/MenuBar'
import TopBar from './components/TopBar'
import ImportPanel from './components/ImportPanel'
import AlbumInfoPanel from './components/AlbumInfoPanel'
import PhotoBin from './components/PhotoBin'
import SpreadsPanel from './components/SpreadsPanel'
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
import { openProjectFromPath } from '@/engine/projectFile'
import { loadOpenSession, writeOpenSession, clearOpenSession, OpenSessionMarker } from '@/engine/sessionMarker'
import ContinueSessionPrompt from './components/ContinueSessionPrompt'

export default function App() {
  // Electron only, and only when the last session genuinely ended with unsaved work still open
  // (see engine/sessionMarker.ts) — reading localStorage is synchronous, so this is known up
  // front rather than resolved async. Holding a marker here just means "ask"; nothing is opened
  // until the user actually chooses to.
  const [resumePrompt, setResumePrompt] = useState<OpenSessionMarker | null>(() =>
    window.albumStudio?.isElectron ? loadOpenSession() : null
  )
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
    function onEnterEditor() {
      setShowHome(false)
      // Import Photos / Spreads is the first thing you need in a fresh or just-opened project —
      // reveal it right away rather than making the user hunt for the collapsed panel's toggle.
      revealLeftPanel()
    }
    function onGoHome() {
      setShowHome(true)
    }
    window.addEventListener('album-studio:enter-editor', onEnterEditor)
    window.addEventListener('album-studio:go-home', onGoHome)
    return () => {
      window.removeEventListener('album-studio:enter-editor', onEnterEditor)
      window.removeEventListener('album-studio:go-home', onGoHome)
    }
  }, [revealLeftPanel])

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

  // Keeps the "open session" marker in sync with the current project's dirty/saved state (see
  // engine/sessionMarker.ts) — written while there's unsaved work tied to a real file on disk,
  // cleared the moment that's no longer true. What actually offers to resume it is the `resumePrompt`
  // state above, read once at launch; this effect just keeps the marker accurate for *next* launch.
  useEffect(() => {
    if (!window.albumStudio?.isElectron) return
    // Leave the marker alone until the resume prompt is answered — it still describes the
    // session the prompt is asking about, and the default/empty store state present while it's
    // showing (nothing's loaded yet) would otherwise wipe that marker before the user can decide.
    if (resumePrompt) return
    if (isDirty && currentFilePath) {
      writeOpenSession({
        projectId: project.id,
        filePath: currentFilePath,
        name: project.name,
        clientName: project.clientName,
        sizeLabel: project.size.label,
        spreadCount: project.spreads.filter((s) => !s.isCover).length,
      })
    } else {
      clearOpenSession()
    }
  }, [isDirty, currentFilePath, project, resumePrompt])

  async function handleContinueSession() {
    if (!resumePrompt) return
    setResuming(true)
    const file = await openProjectFromPath(resumePrompt.filePath)
    setResuming(false)
    setResumePrompt(null)
    if (file) {
      loadProjectFile(file)
      setCurrentFilePath(resumePrompt.filePath)
      setShowHome(false)
      revealLeftPanel()
    }
    // Whether or not it was found, the prompt about it is resolved either way — a missing file
    // falls through to the ordinary Home screen, same as a broken Recent entry does there.
  }

  function handleStartFresh() {
    clearOpenSession()
    setResumePrompt(null)
  }

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
    <div className="app-shell">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <MissingColorProfileDialog />
      <MenuBar />
      <TopBar />
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
      <div className="bottom-panel">
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
