import { contextBridge, ipcRenderer } from 'electron'

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
  isElectron: true
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
  /** Main-window-only: fires when a New Project window round-trips its finished options back.
   *  Returns an unsubscribe function. */
  onNewProjectCreated: (cb: (opts: NewProjectPayload) => void) => () => void
}

const bridge: AlbumStudioBridge = {
  isElectron: true,
  saveFile: (args) => ipcRenderer.invoke('export:saveFile', args),
  pickDirectory: () => ipcRenderer.invoke('export:pickDirectory'),
  writeFileInDir: (args) => ipcRenderer.invoke('export:writeFileInDir', args),
  openProjectFile: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (filePath) => ipcRenderer.invoke('project:openPath', filePath),
  listLocalFonts: () => ipcRenderer.invoke('fonts:listLocal'),
  openNewProjectWindow: () => ipcRenderer.invoke('window:openNewProject'),
  submitNewProject: (opts) => ipcRenderer.invoke('new-project:submit', opts),
  closeCurrentWindow: () => ipcRenderer.invoke('window:closeSelf'),
  onNewProjectCreated: (cb) => {
    const listener = (_evt: unknown, opts: NewProjectPayload) => cb(opts)
    ipcRenderer.on('new-project:created', listener)
    return () => ipcRenderer.removeListener('new-project:created', listener)
  },
}

contextBridge.exposeInMainWorld('albumStudio', bridge)
