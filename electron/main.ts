import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#1e1f22',
    title: 'YNOT Album Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

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
