import { useEffect, useState } from 'react'
import MenuBar from './components/MenuBar'
import TopBar from './components/TopBar'
import ImportPanel from './components/ImportPanel'
import PhotoBin from './components/PhotoBin'
import SpreadsPanel from './components/SpreadsPanel'
import DesignerCanvas from './components/DesignerCanvas'
import Inspector from './components/Inspector'
import TemplateLibraryPanel from './components/TemplateLibraryPanel'
import WorkflowStepper from './components/WorkflowStepper'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import GlobalDropZone from './components/GlobalDropZone'
import HomeScreen from './components/HomeScreen'
import { useProjectStore } from '@/state/projectStore'

export default function App() {
  const [showHome, setShowHome] = useState(true)
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)

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
      window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))
    })
  }, [createProjectFromWizard])

  if (showHome) return <HomeScreen />

  return (
    <div className="app-shell">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <MenuBar />
      <TopBar />
      <div className="app-body">
        <aside className="app-sidebar app-sidebar--left">
          <div className="panel">
            <WorkflowStepper />
          </div>
          <ImportPanel />
          <SpreadsPanel />
        </aside>
        <main className="app-main">
          <DesignerCanvas />
        </main>
        <aside className="app-sidebar app-sidebar--right">
          <Inspector />
          <TemplateLibraryPanel />
        </aside>
      </div>
      <PhotoBin />
    </div>
  )
}
