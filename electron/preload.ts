import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Mirrors state/projectStore.ts's NewProjectOptions. Kept as a structural shape (not imported)
// since this file compiles outside the renderer's tsconfig — it's just forwarded through IPC,
// never read field-by-field here, so the loose `size`/`units` typing is harmless.
export interface NewProjectPayload {
  name: string
  size: unknown
  units: unknown
  colorProfile: string
  defaultBackgroundColor: string
  defaultGapPx: number
  defaultMarginPx: number
  enabledTemplateIds: string[] | null
}

export interface AlbumStudioBridge {
  preferencesSystem: (action: 'cacheSize' | 'clearCache' | 'choosePhotoshop' | 'projectDirectory', value?: string) => Promise<string | number | null>
  openExternalEditor: (args: { app: 'photoshop' | 'canva'; photoshopPath: string; name: string; data: Uint8Array }) => Promise<string>

  isElectron: true
  getImagePath: (file: File) => string
  readSiblingImage: (locatedPath: string, fileName: string) => Promise<{ sourcePath: string; fileName: string; lastModified: number; data: Uint8Array } | null>
  missingImagePaths: (paths: string[]) => Promise<string[]>
  revealExportLocation: (location: string) => Promise<void>
  showImageFile: (filePath: string, reveal: boolean) => Promise<void>
  readRecovery: () => Promise<{ filePath: string | null; contents: string } | null>
  writeRecovery: (snapshot: { filePath: string | null; contents: string }) => Promise<void>
  clearRecovery: () => Promise<void>
  decodeTiff: (data: Uint8Array) => Promise<string>
  saveFile: (args: {
    defaultName: string
    filters: { name: string; extensions: string[] }[]
    data: Uint8Array
  }) => Promise<{ canceled: boolean; filePath?: string }>
  pickDirectory: () => Promise<{ canceled: boolean; dirPath?: string }>
  writeFileInDir: (args: { dirPath: string; fileName: string; data: Uint8Array }) => Promise<{ filePath: string }>
  openProjectFile: () => Promise<{ canceled: boolean; filePath?: string; contents?: string }>
  openProjectAtPath: (filePath: string) => Promise<{ ok: boolean; contents?: string }>
  listLocalFonts: () => Promise<{ fonts: string[] }>
  /** Opens the dedicated "New Project" OS window (Home screen / TopBar "New Album"). */
  openNewProjectWindow: () => Promise<void>
  /** Called from inside the New Project window once its form is complete; the main process
   *  relays the payload to the main window and closes the New Project window. */
  submitNewProject: (opts: NewProjectPayload) => Promise<void>
  /** Closes whichever window calls this — used by the New Project window's Cancel button. */
  closeCurrentWindow: () => Promise<void>
  onSaveBeforeClose: (cb: () => void) => () => void
  /** Main-window-only: fires when a New Project window round-trips its finished options back.
   *  Returns an unsubscribe function. */
  onNewProjectCreated: (cb: (opts: NewProjectPayload) => void) => () => void
}

const bridge: AlbumStudioBridge = {
  isElectron: true,
  getImagePath: file => webUtils.getPathForFile(file),
  preferencesSystem: (action, value) => ipcRenderer.invoke('preferences:system', action, value),
  openExternalEditor: (args) => ipcRenderer.invoke('editor:open', args),
  revealExportLocation: (location) => ipcRenderer.invoke('export:revealLocation', location),
  showImageFile: (filePath, reveal) => ipcRenderer.invoke('images:showFile', filePath, reveal),
  readSiblingImage: (locatedPath, fileName) => ipcRenderer.invoke('images:readSibling', locatedPath, fileName),
  missingImagePaths: (paths) => ipcRenderer.invoke('images:missingPaths', paths),
  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  writeRecovery: (snapshot) => ipcRenderer.invoke('recovery:write', snapshot),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),
  decodeTiff: (data) => ipcRenderer.invoke('images:decodeTiff', data),
  saveFile: (args) => ipcRenderer.invoke('export:saveFile', args),
  pickDirectory: () => ipcRenderer.invoke('export:pickDirectory'),
  writeFileInDir: (args) => ipcRenderer.invoke('export:writeFileInDir', args),
  openProjectFile: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (filePath) => ipcRenderer.invoke('project:openPath', filePath),
  listLocalFonts: () => ipcRenderer.invoke('fonts:listLocal'),
  openNewProjectWindow: () => ipcRenderer.invoke('window:openNewProject'),
  submitNewProject: (opts) => ipcRenderer.invoke('new-project:submit', opts),
  closeCurrentWindow: () => ipcRenderer.invoke('window:closeSelf'),
  onSaveBeforeClose: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('project:save-before-close', listener)
    return () => ipcRenderer.removeListener('project:save-before-close', listener)
  },
  onNewProjectCreated: (cb) => {
    const listener = (_evt: unknown, opts: NewProjectPayload) => cb(opts)
    ipcRenderer.on('new-project:created', listener)
    return () => ipcRenderer.removeListener('new-project:created', listener)
  },
}

contextBridge.exposeInMainWorld('albumStudio', bridge)
