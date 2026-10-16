import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'

const isDev = !app.isPackaged

// Electron shows its own default File/Edit/View/Window/Help menu unless the app sets one
// explicitly — that was rendering as a second, redundant menu bar above the app's own in-page
// File/Edit/Spread/Templates/View/Help bar. The app owns all of that, so the native one is unset.
Menu.setApplicationMenu(null)

/** A small frameless splash window shown the instant the app launches, while Electron spins up
 *  the real window and (in dev) Vite/renderer boots — the same "app is opening" affordance the
 *  reference app shows, built as an inline data: URL so there's no extra file to package. */
function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 380,
    height: 340,
    frame: false,
    resizable: false,
    movable: false,
    show: true,
    center: true,
    backgroundColor: '#0c0c0d',
    webPreferences: { contextIsolation: true },
  })
  splash.setMenu(null)
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#0c0c0d;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-user-select:none;}
    .wrap{display:flex;flex-direction:column;align-items:center;gap:20px;}
    .mark{width:68px;height:68px;border-radius:18px;background:linear-gradient(145deg,#2b2b2e,#0c0c0d);display:flex;align-items:center;justify-content:center;border:1px solid #333;}
    .mark svg{width:36px;height:36px;}
    .title{color:#eef0f6;font-size:19px;font-weight:700;letter-spacing:0.02em;text-align:center;}
    .title span{display:block;color:#8d90a3;font-weight:400;font-size:12.5px;margin-top:3px;letter-spacing:0.08em;text-transform:uppercase;}
    .spinner{width:26px;height:26px;border-radius:50%;border:3px solid #363a4a;border-top-color:#7c8cff;animation:spin 0.85s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style></head><body>
    <div class="wrap">
      <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l8 8 8-8M12 12v8"/></svg></div>
      <div class="title">YNOT<span>Album Studio</span></div>
      <div class="spinner"></div>
    </div>
  </body></html>`
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  return splash
}

let mainWindow: BrowserWindow | null = null

function createWindow(splash?: BrowserWindow) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
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

/** Opens "New Project" as its own titled OS window (matching the reference app) instead of an
 *  in-app modal. It loads the same renderer bundle with a `?view=new-project` flag, which
 *  src/main.tsx uses to mount just the wizard instead of the full app shell. Since this window
 *  has its own isolated JS context (and thus its own separate Zustand store instance), it can't
 *  just call the store directly — it round-trips the finished options back to the main window via
 *  IPC (see 'new-project:submit' below) instead. */
function createNewProjectWindow() {
  const win = new BrowserWindow({
    width: 640,
    height: 760,
    minWidth: 560,
    minHeight: 600,
    title: 'New Project',
    parent: mainWindow ?? undefined,
    backgroundColor: '#f4f5f7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setMenu(null)
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
      defaultPath: args.defaultName,
      filters: args.filters,
    })
    if (canceled || !filePath) return { canceled: true as const }
    fs.writeFileSync(filePath, Buffer.from(args.data))
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
    fs.writeFileSync(target, Buffer.from(args.data))
    return { filePath: target }
  }
)

// Open an existing .ablm project file chosen via native dialog; contents are returned as text
// (project files are self-contained JSON with photos embedded as data URLs).
ipcMain.handle('project:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
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
