import { useEffect, useState } from 'react'
import MenuBar from './components/MenuBar'
import TopBar from './components/TopBar'
import ImportPanel from './components/ImportPanel'
import PhotoBin from './components/PhotoBin'
import SpreadsPanel from './components/SpreadsPanel'
import DesignerCanvas from './components/DesignerCanvas'
import Inspector from './components/Inspector'
import TemplateLibraryPanel from './components/TemplateLibraryPanel'
import AlbumInfoPanel from './components/AlbumInfoPanel'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import GlobalDropZone from './components/GlobalDropZone'
import HomeScreen from './components/HomeScreen'
import Icon from './components/Icon'
import NewProjectLoadingOverlay from './components/NewProjectLoadingOverlay'
import DesignerViewScreen from './components/DesignerViewScreen'
import TimelinePanel from './components/TimelinePanel'
import GalleryScreen from './components/GalleryScreen'
import SlideshowScreen from './components/SlideshowScreen'
import { useProjectStore } from '@/state/projectStore'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'
import { useBottomDockResize } from '@/engine/useBottomDockResize'
import { loadRecentProjects } from '@/engine/recentProjects'
import { openProjectFromPath } from '@/engine/projectFile'

export default function App() {
  // Electron only: stays true while we check for (and try to reopen) the last project that was
  // open, so relaunching the app resumes where you left off instead of landing on a blank Home
  // screen. The browser dev preview has no on-disk project to reopen, so it skips straight past.
  const [restoringSession, setRestoringSession] = useState(() => !!window.albumStudio?.isElectron)
  const [showHome, setShowHome] = useState(true)
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const preparingProject = useProjectStore((s) => s.preparingProject)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const leftPanelOpen = useProjectStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const toggleLeftPanel = useProjectStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const revealLeftPanel = useProjectStore((s) => s.revealLeftPanel)
  const revealRightPanel = useProjectStore((s) => s.revealRightPanel)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const projectKind = useProjectStore((s) => s.project.kind)
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

  // The right panel (Album Info / Inspector / Template Library) has nothing to show until a
  // spread, placed photo, or text box is selected — reveal it the moment one is, rather than
  // always reserving canvas width for it. Keyed off the *id values themselves* (not just
  // "truthy"), so picking a different spread/photo/text box re-reveals a panel the user had
  // since collapsed, while re-clicking the same already-selected thing doesn't fight that choice.
  useEffect(() => {
    if (selectedSpreadId || selectedPlaceholderId || selectedTextBoxId) revealRightPanel()
  }, [selectedSpreadId, selectedPlaceholderId, selectedTextBoxId, revealRightPanel])

  // The main window is the one true store — a separate "New Project" OS window hands its
  // finished options back here over IPC instead of creating the project in its own isolated store.
  useEffect(() => {
    if (!window.albumStudio) return
    return window.albumStudio.onNewProjectCreated((opts) => {
      createProjectFromWizard(opts as never)
      setPreparingProject(true)
      const { project, userTemplates } = useProjectStore.getState()
      void finishNewProjectSetup(project, userTemplates).then(() => {
        setPreparingProject(false)
        window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))
      })
    })
  }, [createProjectFromWizard, setPreparingProject])

  // Resume the last project that was open, instead of always landing back on a blank Home
  // screen — the most recently updated recent-project entry with a known on-disk path (only ever
  // set in Electron) is reopened silently, same as clicking it from Home's Recent list.
  useEffect(() => {
    if (!window.albumStudio?.isElectron) return
    const last = loadRecentProjects()
      .filter((e) => e.filePath)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
    if (!last?.filePath) {
      setRestoringSession(false)
      return
    }
    let cancelled = false
    void openProjectFromPath(last.filePath).then((file) => {
      if (cancelled) return
      if (file) {
        loadProjectFile(file)
        setShowHome(false)
        revealLeftPanel()
      }
      setRestoringSession(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadProjectFile, revealLeftPanel])

  if (restoringSession) return <NewProjectLoadingOverlay title="Restoring your last session…" subtitle="Reopening where you left off." />

  if (preparingProject) return <NewProjectLoadingOverlay />

  if (showHome) return <HomeScreen />

  if (projectKind === 'gallery') return <GalleryScreen />

  if (projectKind === 'slideshow') return <SlideshowScreen />

  if (designerViewSpreadId) return <DesignerViewScreen />

  return (
    <div className="app-shell">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <MenuBar />
      <TopBar />
      <div className="app-body">
        {leftPanelOpen && (
          <aside className="app-sidebar app-sidebar--left">
            <ImportPanel />
            <SpreadsPanel />
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
          <div className="app-main__stack">
            <TimelinePanel />
            <DesignerCanvas />
          </div>
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
            <Inspector />
            <TemplateLibraryPanel />
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
