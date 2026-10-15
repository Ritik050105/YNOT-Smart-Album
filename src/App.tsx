import TopBar from './components/TopBar'
import ImportPanel from './components/ImportPanel'
import PhotoBin from './components/PhotoBin'
import SpreadsPanel from './components/SpreadsPanel'
import DesignerCanvas from './components/DesignerCanvas'
import Inspector from './components/Inspector'

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <aside className="app-sidebar app-sidebar--left">
          <ImportPanel />
          <PhotoBin />
          <SpreadsPanel />
        </aside>
        <main className="app-main">
          <DesignerCanvas />
        </main>
        <aside className="app-sidebar app-sidebar--right">
          <Inspector />
        </aside>
      </div>
    </div>
  )
}
