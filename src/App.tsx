import TopBar from './components/TopBar'
import ImportPanel from './components/ImportPanel'
import PhotoBin from './components/PhotoBin'
import SpreadsPanel from './components/SpreadsPanel'
import ProjectInfoPanel from './components/ProjectInfoPanel'
import DesignerCanvas from './components/DesignerCanvas'
import Inspector from './components/Inspector'
import TemplateLibraryPanel from './components/TemplateLibraryPanel'
import WorkflowStepper from './components/WorkflowStepper'

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <aside className="app-sidebar app-sidebar--left">
          <div className="panel">
            <WorkflowStepper />
          </div>
          <ProjectInfoPanel />
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
