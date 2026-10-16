import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyTheme, getStoredTheme } from './engine/theme'
import './styles/app.css'

// Applied before the first paint so there's no flash of the wrong theme.
applyTheme(getStoredTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
