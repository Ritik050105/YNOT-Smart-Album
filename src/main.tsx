import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Only the separate New Project window needs the wizard and the template library behind it.
const NewProjectWindowApp = lazy(() => import('./components/NewProjectWindowApp'))
import { applyTheme, getStoredTheme } from './engine/theme'
import './styles/app.css'
import './styles/editor.css'

// Applied before the first paint so there's no flash of the wrong theme.
applyTheme(getStoredTheme())

// The dedicated "New Project" OS window loads this same bundle with a `?view=new-project` flag
// (see electron/main.ts's createNewProjectWindow) and mounts just the wizard instead of the full
// app shell — it's a genuinely separate window, not an in-app modal.
const view = new URLSearchParams(window.location.search).get('view')
const isNewProjectWindow = view === 'new-project'

// The hidden window that runs the face model (electron/faceWindow.ts): no interface, only the detector.
if (view === 'face-worker') {
  // Defined at once, so the main process can call it as soon as the page has loaded; the model code is fetched on the first call.
  ;(window as unknown as { __findFaces: (dataUrl: string) => Promise<unknown> }).__findFaces = async dataUrl => (await import('./engine/faceWorker')).findFacesIn(dataUrl)
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {isNewProjectWindow ? <Suspense fallback={null}><NewProjectWindowApp /></Suspense> : <App />}
    </React.StrictMode>
  )
}
