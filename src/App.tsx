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

export default function App() {
  const [showHome, setShowHome] = useState(true)

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
