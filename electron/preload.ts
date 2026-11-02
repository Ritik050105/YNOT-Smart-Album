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
  importRevocation: () => Promise<void>
  preferencesSystem: (action: 'cacheSize' | 'clearCache' | 'choosePhotoshop' | 'chooseCanva' | 'projectDirectory', value?: string) => Promise<string | number | null>
  readExternalEdit: (file: string, revision?: string) => Promise<{data: Uint8Array; revision: string; sourcePath?: string} | null>
  openExternalEditor: (args: { app: 'photoshop' | 'canva'; photoshopPath: string; canvaPath?: string; originalPath?: string; name: string; data: Uint8Array }) => Promise<string>

  isElectron: true
  getImagePath: (file: File) => string
  readSiblingImage: (locatedPath: string, fileName: string) => Promise<{ sourcePath: string; fileName: string; lastModified: number; data: Uint8Array } | null>
  missingImagePaths: (paths: string[]) => Promise<string[]>
  revealExportLocation: (location: string) => Promise<void>
  showImageFile: (filePath: string, reveal: boolean) => Promise<void>
  readRecovery: () => Promise<{ filePath: string | null; contents: string } | null>
  writeRecovery: (snapshot: { filePath: string | null; contents: string }) => Promise<void>
  clearRecovery: () => Promise<void>
  imagePreview: (data: Uint8Array | string) => Promise<{width:number;height:number;src:string;thumb:string;isBlackAndWhite?:boolean;hasColorProfile:boolean}>
  decodeTiff: (data: Uint8Array) => Promise<string>
  saveProjectPackage: (args: { filePath?: string; defaultName: string; contents: string }) => Promise<{ saved: boolean; filePath?: string }>
  copyProjectPackage: (args: { defaultName: string; contents: string }) => Promise<{ saved: boolean; filePath?: string }>
  saveFile: (args: {
    defaultName: string
    filters: { name: string; extensions: string[] }[]
    data: Uint8Array
  }) => Promise<{ canceled: boolean; filePath?: string }>
  pickDirectory: () => Promise<{ canceled: boolean; dirPath?: string }>
  writeFileInDir: (args: { dirPath: string; fileName: string; data: Uint8Array }) => Promise<{ filePath: string }>
  takePendingProject: () => Promise<string | null>
  onProjectOpen: (callback: () => void) => () => void
  openProjectFile: () => Promise<{ canceled: boolean; filePath?: string; contents?: string }>
  openProjectAtPath: (filePath: string) => Promise<{ ok: boolean; contents?: string }>
  scanFonts: (action:'start'|'cancel'|'status') => Promise<{running:boolean;visited:number;skipped:number;fonts:{family:string;path:string}[]}>
  readCachedFont?: (family: string) => Promise<{data:Uint8Array;weight:string;style:string;unicodeRange:string}[] | null>
  readDiscoveredFont: (path:string) => Promise<string>
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
  importRevocation: () => ipcRenderer.invoke('license:import-revocation'),
  preferencesSystem: (action, value) => ipcRenderer.invoke('preferences:system', action, value),
  readExternalEdit: (file, revision) => ipcRenderer.invoke('editor:readEdit',file,revision),
  openExternalEditor: (args) => ipcRenderer.invoke('editor:open', args),
  revealExportLocation: (location) => ipcRenderer.invoke('export:revealLocation', location),
  showImageFile: (filePath, reveal) => ipcRenderer.invoke('images:showFile', filePath, reveal),
  readSiblingImage: (locatedPath, fileName) => ipcRenderer.invoke('images:readSibling', locatedPath, fileName),
  missingImagePaths: (paths) => ipcRenderer.invoke('images:missingPaths', paths),
  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  writeRecovery: (snapshot) => ipcRenderer.invoke('recovery:write', snapshot),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),
  imagePreview: (data) => ipcRenderer.invoke('images:preview', data),
  decodeTiff: (data) => ipcRenderer.invoke('images:decodeTiff', data),
  copyProjectPackage: args => ipcRenderer.invoke('project:copyPackage', args),
  saveProjectPackage: args => ipcRenderer.invoke('project:savePackage', args),
  saveFile: (args) => ipcRenderer.invoke('export:saveFile', args),
  pickDirectory: () => ipcRenderer.invoke('export:pickDirectory'),
  writeFileInDir: (args) => ipcRenderer.invoke('export:writeFileInDir', args),
  takePendingProject: () => ipcRenderer.invoke('project:pending'),
  onProjectOpen: (callback) => {const listener=()=>callback();ipcRenderer.on('project:requested',listener);return()=>ipcRenderer.removeListener('project:requested',listener)},
  openProjectFile: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (filePath) => ipcRenderer.invoke('project:openPath', filePath),
  scanFonts: action => ipcRenderer.invoke('fonts:scan',action),
  readCachedFont: family => ipcRenderer.invoke('fonts:cached',family),
  readDiscoveredFont: path => ipcRenderer.invoke('fonts:read',path),
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
