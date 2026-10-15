import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#1e1f22',
    title: 'Album Studio',
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
