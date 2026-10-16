import { contextBridge, ipcRenderer } from 'electron'

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
}

const bridge: AlbumStudioBridge = {
  isElectron: true,
  saveFile: (args) => ipcRenderer.invoke('export:saveFile', args),
  pickDirectory: () => ipcRenderer.invoke('export:pickDirectory'),
  writeFileInDir: (args) => ipcRenderer.invoke('export:writeFileInDir', args),
  openProjectFile: () => ipcRenderer.invoke('project:open'),
  openProjectAtPath: (filePath) => ipcRenderer.invoke('project:openPath', filePath),
  listLocalFonts: () => ipcRenderer.invoke('fonts:listLocal'),
}

contextBridge.exposeInMainWorld('albumStudio', bridge)
