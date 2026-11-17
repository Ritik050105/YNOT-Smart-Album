import { BrowserWindow } from 'electron'
import path from 'path'

/** A hidden window that finds faces for the editor.
 *
 *  Running the face model inside the editor's own window froze it for about six seconds the first time it ran (the graphics card compiles
 *  the model's programs on the page's one thread). This window loads the same renderer bundle with `?view=face-worker`, which only runs
 *  the model, so any stall is its own. It is opened on the first request, closes itself when it has been idle for a minute, and is
 *  closed with the app. A failure or a slow answer gives null, and the editor keeps its colour guess. */
const IDLE_MS = 60_000
const ANSWER_MS = 90_000

let worker: BrowserWindow | null = null
let ready: Promise<BrowserWindow> | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined

export function closeFaceWindow() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = undefined
  const win = worker
  worker = null
  ready = null
  if (win && !win.isDestroyed()) win.destroy()
}

function open(isDev: boolean, preload: string): Promise<BrowserWindow> {
  if (ready) return ready
  const win = new BrowserWindow({
    show: false, width: 400, height: 300, skipTaskbar: true,
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  })
  worker = win
  win.on('closed', () => { if (worker === win) { worker = null; ready = null } })
  ready = new Promise<BrowserWindow>((resolve, reject) => {
    win.webContents.once('did-fail-load', () => reject(new Error('The face window did not load.')))
    win.webContents.once('did-finish-load', () => resolve(win))
  })
  if (isDev) void win.loadURL('http://localhost:5173/?view=face-worker')
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { search: 'view=face-worker' })
  ready.catch(closeFaceWindow)
  return ready
}

/** The faces in a picture (a data URL), as boxes in its own pixels, or null when they could not be found. */
export async function findFaces(dataUrl: string, isDev: boolean, preload: string): Promise<unknown[] | null> {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > 8_000_000) return null
  try {
    const win = await open(isDev, preload)
    if (idleTimer) clearTimeout(idleTimer)
    const answer = win.webContents.executeJavaScript(`window.__findFaces(${JSON.stringify(dataUrl)})`)
    const found = await Promise.race([answer, new Promise<null>(resolve => setTimeout(() => resolve(null), ANSWER_MS))])
    idleTimer = setTimeout(closeFaceWindow, IDLE_MS)
    return Array.isArray(found) ? found : null
  } catch {
    closeFaceWindow()
    return null
  }
}
