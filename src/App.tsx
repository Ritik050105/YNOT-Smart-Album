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
import WorkflowStepper from './components/WorkflowStepper'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import GlobalDropZone from './components/GlobalDropZone'
import HomeScreen from './components/HomeScreen'
import Icon from './components/Icon'
import NewProjectLoadingOverlay from './components/NewProjectLoadingOverlay'
import DesignerViewScreen from './components/DesignerViewScreen'
import TimelinePanel from './components/TimelinePanel'
import { useProjectStore } from '@/state/projectStore'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'

export default function App() {
  const [showHome, setShowHome] = useState(true)
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)
  const preparingProject = useProjectStore((s) => s.preparingProject)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const leftPanelOpen = useProjectStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleLeftPanel = useProjectStore((s) => s.toggleLeftPanel)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const hasPhotos = useProjectStore((s) => s.project.photos.length > 0)

  useEffect(() => {
    function onEnterEditor() {
      setShowHome(false)
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
  }, [])

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

  if (preparingProject) return <NewProjectLoadingOverlay />

  if (showHome) return <HomeScreen />

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
            <div className="panel">
              <WorkflowStepper />
            </div>
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
      {hasPhotos && (
        <div className="bottom-panel">
          <button
            className="panel-toggle panel-toggle--bottom"
            onClick={toggleBottomPanel}
            title={bottomPanelOpen ? 'Collapse photo dock' : 'Expand photo dock'}
          >
            <Icon name={bottomPanelOpen ? 'chevronDown' : 'chevronUp'} size={12} />
          </button>
          {bottomPanelOpen && <PhotoBin />}
        </div>
      )}
    </div>
  )
}
