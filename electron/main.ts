import { app, BrowserWindow, ipcMain, dialog, Menu, screen, shell } from 'electron'
import path from 'path'
import { randomUUID } from 'crypto'
import { findPhotoshop, findCanva, ExternalEditFiles } from './externalEdits'
import fs from 'fs'
import { execFile, spawn } from 'child_process'
import { writeFileAtomic } from './files'
import { decodeTiff } from './images'
import { readSiblingImage } from './siblingImages'
import { readRecovery, writeRecovery, clearRecovery } from './recovery'
import { fitWindowSize } from './windowSizing'

ipcMain.handle('images:showFile', async (_event, filePath: string, reveal: boolean) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || !/\.(jpe?g|png|webp|gif|bmp|tiff?|psd|avif|heic)$/i.test(filePath) || !fs.statSync(filePath).isFile()) throw new Error('The original image is unavailable. Replace the image to reconnect its file.')
  if (reveal) shell.showItemInFolder(filePath)
  else { const error = await shell.openPath(filePath); if (error) throw new Error(error) }
})

ipcMain.handle('export:revealLocation', async (_event, location: string) => {
  if (typeof location !== 'string' || !path.isAbsolute(location)) throw new Error('Invalid export location')
  const info = await fs.promises.stat(location).catch(() => null)
  if (!info) throw new Error('The exported file or folder has moved or is unavailable.')
  if (info.isDirectory()) {
    const error = await shell.openPath(location)
    if (error) throw new Error(error)
  } else if (info.isFile()) shell.showItemInFolder(location)
  else throw new Error('This export location cannot be opened.')
})

const isDev = !app.isPackaged
ipcMain.handle('images:missingPaths', async (_event, paths: string[]) => {
  if (!Array.isArray(paths) || paths.length > 100000 || paths.some(p => typeof p !== 'string' || !path.isAbsolute(p))) throw new Error('Invalid image paths')
  const missing: string[] = []
  for (const file of paths) { try { if (!(await fs.promises.stat(file)).isFile()) missing.push(file) } catch { missing.push(file) } }
  return missing
})
ipcMain.handle('images:readSibling', (_event, locatedPath: string, fileName: string) => readSiblingImage(locatedPath, fileName))
ipcMain.handle('images:decodeTiff', (_event, data: Uint8Array) => decodeTiff(data))

// Electron shows its own default File/Edit/View/Window/Help menu unless the app sets one
// explicitly — that was rendering as a second, redundant menu bar above the app's own in-page
// File/Edit/Spread/Templates/View/Help bar. The app owns all of that, so the native one is unset.
Menu.setApplicationMenu(null)

/** Match the reference's light, logo-only launch screen without delaying startup. */
function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    ...fitWindowSize(screen.getPrimaryDisplay().workAreaSize, { width: 1440, height: 900 }, { width: 720, height: 480 }),
    title: 'YNOT Album Studio',
    resizable: false,
    show: true,
    center: true,
    backgroundColor: '#fafafa',
    webPreferences: { contextIsolation: true },
  })
  splash.setMenu(null)
  const logo = fs.readFileSync(path.join(app.getAppPath(), 'src', 'assets', 'ynot-mark-dark.png')).toString('base64')
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#fafafa;}
    body{display:grid;place-items:center;-webkit-user-select:none;}
    .mark{width:64px;height:64px;max-width:16vmin;max-height:16vmin;display:grid;place-items:center;}
    img{width:100%;height:100%;object-fit:contain;}
  </style></head><body><div class="mark" role="status" aria-label="Loading YNOT Album Studio"><img src="data:image/png;base64,${logo}" alt="YNOT Photography"></div></body></html>`
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  return splash
}
let mainWindow: BrowserWindow | null = null

function createWindow(splash?: BrowserWindow) {
  const win = new BrowserWindow({
    ...fitWindowSize(screen.getPrimaryDisplay().workAreaSize, { width: 1440, height: 900 }, { width: 720, height: 480 }),
    backgroundColor: '#1e1f22',
    title: 'YNOT Album Studio',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow = win
  const owner=win.webContents.id
  win.webContents.once('destroyed',()=>externalEditFiles.forget(owner))
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', title: 'Unsaved Album', message: 'Do you want to save your changes before closing?',
      detail: 'Your changes will be lost if you do not save them.',
      buttons: ['Save', 'Discard Changes', 'Cancel'], defaultId: 0, cancelId: 2,
    })
    if (choice === 0) win.webContents.send('project:save-before-close')
    if (choice === 1) {
      try { clearRecovery(recoveryPath()) } catch (error) {
        dialog.showErrorBox('Could not discard recovery copy', `Keep editing or save the album before closing. ${String(error)}`)
        return
      }
      event.preventDefault()
    }
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.once('ready-to-show', () => {
    splash?.close()
    win.show()
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

let newProjectWindow: BrowserWindow | null = null

/** Opens "New Project" as its own titled OS window (matching the reference app) instead of an
 *  in-app modal. It loads the same renderer bundle with a `?view=new-project` flag, which
 *  src/main.tsx uses to mount just the wizard instead of the full app shell. Since this window
 *  has its own isolated JS context (and thus its own separate Zustand store instance), it can't
 *  just call the store directly — it round-trips the finished options back to the main window via
 *  IPC (see 'new-project:submit' below) instead.
 *
 *  Stays hidden (like the main window) until its first paint is actually ready, and focuses the
 *  existing window instead of stacking a second one if it's somehow asked for twice — both guard
 *  against the same class of "window shows before it has anything to show" blank-window flash. */
function createNewProjectWindow() {
  if (newProjectWindow && !newProjectWindow.isDestroyed()) {
    newProjectWindow.focus()
    return newProjectWindow
  }

  const workArea = screen.getDisplayMatching(mainWindow?.getBounds() ?? screen.getPrimaryDisplay().bounds).workAreaSize
  const win = new BrowserWindow({
    ...fitWindowSize(workArea, { width: 1060, height: 840 }, { width: 560, height: 480 }),
    title: 'New Project',
    parent: mainWindow ?? undefined,
    backgroundColor: '#292b2e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  newProjectWindow = win
  win.on('closed', () => {
    if (newProjectWindow === win) newProjectWindow = null
  })
  win.setMenu(null)
  win.once('ready-to-show', () => win.show())
  if (isDev) {
    win.loadURL('http://localhost:5173/?view=new-project')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { search: 'view=new-project' })
  }
  return win
}

app.whenReady().then(() => {
  const splash = createSplash()
  createWindow(splash)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Save a single exported file (PDF/JPG/PNG/etc.) chosen via native dialog.
ipcMain.handle(
  'export:saveFile',
  async (_evt, args: { defaultName: string; filters: { name: string; extensions: string[] }[]; data: Uint8Array }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: /\.ablm(?:\.json)?$/i.test(args.defaultName) && desktopPreferences().projectDirectory ? path.join(desktopPreferences().projectDirectory!,path.basename(args.defaultName)) : args.defaultName,
      filters: args.filters,
    })
    if (canceled || !filePath) return { canceled: true as const }
      writeFileAtomic(filePath, Buffer.from(args.data))
    return { canceled: false as const, filePath }
  }
)

// Pick a folder/output directory for a multi-file export (e.g. one JPG per spread).
ipcMain.handle('export:pickDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  if (canceled || filePaths.length === 0) return { canceled: true as const }
  return { canceled: false as const, dirPath: filePaths[0] }
})

ipcMain.handle(
  'export:writeFileInDir',
  async (_evt, args: { dirPath: string; fileName: string; data: Uint8Array }) => {
    const target = path.join(args.dirPath, args.fileName)
      writeFileAtomic(target, Buffer.from(args.data))
    return { filePath: target }
  }
)

// Open an existing .ablm project file chosen via native dialog; contents are returned as text
// (project files are self-contained JSON with photos embedded as data URLs).
ipcMain.handle('project:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    defaultPath: desktopPreferences().projectDirectory,
    properties: ['openFile'],
    filters: [{ name: 'YNOT Album Studio Project', extensions: ['ablm', 'json'] }],
  })
  if (canceled || filePaths.length === 0) return { canceled: true as const }
  const contents = fs.readFileSync(filePaths[0], 'utf-8')
  return { canceled: false as const, filePath: filePaths[0], contents }
})

// Re-opens a project at an exact path with no dialog — used by the Home screen's recent-albums
// list. Falls back to "missing" (rather than throwing) if the file was moved/deleted since it was
// last opened, so a stale recent entry degrades gracefully instead of crashing the renderer.
ipcMain.handle('project:openPath', async (_evt, filePath: string) => {
  try {
    const contents = fs.readFileSync(filePath, 'utf-8')
    return { ok: true as const, contents }
  } catch {
    return { ok: false as const }
  }
})

// Opens the dedicated "New Project" window (see createNewProjectWindow above).
ipcMain.handle('window:openNewProject', () => {
  createNewProjectWindow()
})

// The New Project window hands its finished options back here; relay them to the main window's
// own store and close the New Project window, same as a modal's "Create" button would.
ipcMain.handle('new-project:submit', (evt, opts) => {
  mainWindow?.webContents.send('new-project:created', opts)
  BrowserWindow.fromWebContents(evt.sender)?.close()
})

// Generic "close the window that asked" — used by the New Project window's Cancel/Back button.
ipcMain.handle('window:closeSelf', (evt) => {
  BrowserWindow.fromWebContents(evt.sender)?.close()
})

// Lists fonts actually installed on this machine, so the font picker reflects what's really
// available rather than a hardcoded guess. Windows only for now (reads the registry via
// PowerShell, read-only, no shell interpolation of user input).
ipcMain.handle('fonts:listLocal', async (): Promise<{ fonts: string[] }> => {
  if (process.platform !== 'win32') return { fonts: [] }

  const script = `
    $names = @()
    foreach ($regPath in 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts','HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts') {
      if (Test-Path $regPath) {
        $props = Get-ItemProperty -Path $regPath
        foreach ($p in $props.PSObject.Properties) {
          if ($p.Name -notmatch '^PS') { $names += $p.Name }
        }
      }
    }
    $names | Sort-Object -Unique | ConvertTo-Json -Compress
  `

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { maxBuffer: 2 * 1024 * 1024, timeout: 10_000 },
      (err, stdout) => {
        if (err || !stdout) return resolve({ fonts: [] })
        try {
          const parsed: unknown = JSON.parse(stdout)
          const raw = Array.isArray(parsed) ? parsed : [parsed]
          const cleaned = Array.from(
            new Set(
              raw
                .filter((n): n is string => typeof n === 'string')
                .map((n) => n.replace(/\s*\(.*?\)\s*$/, '').trim())
                .filter(Boolean)
            )
          ).sort((a, b) => a.localeCompare(b))
          resolve({ fonts: cleaned })
        } catch {
          resolve({ fonts: [] })
        }
      }
    )
  })
})

function recoveryPath() { return path.join(app.getPath('userData'), 'album-recovery.json') }
for (const [channel, handler] of Object.entries({
  'recovery:read': () => readRecovery(recoveryPath()),
  'recovery:write': (snapshot: unknown) => writeRecovery(recoveryPath(), snapshot),
  'recovery:clear': () => clearRecovery(recoveryPath()),
})) {
  ipcMain.handle(channel, (event, snapshot) => {
    if (event.sender !== mainWindow?.webContents) throw new Error('Recovery is only available in the album window.')
    return handler(snapshot)
  })
}

const preferenceFile = () => path.join(app.getPath('userData'), 'desktop-preferences.json')
function desktopPreferences(): {projectDirectory?:string} { try{return JSON.parse(fs.readFileSync(preferenceFile(),'utf8'))}catch{return {}} }
ipcMain.handle('preferences:system', async (event, action: string, value?:string) => {
  if(action==='cacheSize')return event.sender.session.getCacheSize()
  if(action==='clearCache'){await event.sender.session.clearCache();return event.sender.session.getCacheSize()}
  if(action==='choosePhotoshop'||action==='chooseCanva'){
    const editor=action==='chooseCanva'?'Canva':'Photoshop'
    const result=await dialog.showOpenDialog({title:`Choose ${editor}`,properties:['openFile'],filters:[{name:editor,extensions:['exe']}]})
    if(result.canceled)return null
    const file=result.filePaths[0];if(path.basename(file).toLowerCase()!==editor.toLowerCase()+'.exe')throw new Error(`Choose ${editor}.exe from its installation folder.`)
    return file
  }
  if(action==='projectDirectory'){
    if(typeof value!=='string'||!path.isAbsolute(value)||!fs.statSync(value).isDirectory())throw new Error('Choose an existing project folder.')
    writeFileAtomic(preferenceFile(),Buffer.from(JSON.stringify({projectDirectory:value})));return value
  }
  throw new Error('Unsupported preference action')
})
ipcMain.handle('editor:open', async (_event,args:{app:string;photoshopPath:string;canvaPath?:string;name:string;originalPath?:string;data:Uint8Array})=>{
  if(!args || !['photoshop','canva'].includes(args.app) || typeof args.name!=='string' || !/\.(png|psd)$/i.test(args.name) || !(args.data instanceof Uint8Array) || args.data.length>512*1024*1024)throw new Error('Invalid editor file.')
  const executable = args.app==='photoshop' ? await findPhotoshop(args.photoshopPath) : await findCanva(args.canvaPath)
  let bytes=Buffer.from(args.data),name=args.name
  if(args.app==='photoshop' && args.originalPath && path.isAbsolute(args.originalPath) && /\.(png|jpe?g|tiff?|psd|bmp|webp)$/i.test(args.originalPath)) {
    const original=await fs.promises.stat(args.originalPath).catch(()=>null)
    if(original?.isFile()) { if(original.size>512*1024*1024)throw new Error('The original image exceeds the 512 MB limit.'); bytes=await fs.promises.readFile(args.originalPath); name=path.basename(args.originalPath) }
  }
  const folder=path.join(app.getPath('documents'),'YNOT External Edits');await fs.promises.mkdir(folder,{recursive:true})
  const file=path.join(folder,`${Date.now()}-${randomUUID().slice(0,8)}-${path.basename(name).replace(/[^a-z0-9_.-]/gi,'_')}`)
  writeFileAtomic(file,bytes)
  await externalEditFiles.register(file,_event.sender.id)
  await new Promise<void>((resolve,reject)=>{const child=spawn(executable,[file],{detached:true,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve()})})
  return file
})

const externalEditFiles = new ExternalEditFiles()
ipcMain.handle('editor:readEdit', (event,file:string,revision?:string) => externalEditFiles.read(file,event.sender.id,revision))
