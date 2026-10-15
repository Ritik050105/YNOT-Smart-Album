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
}

const bridge: AlbumStudioBridge = {
  isElectron: true,
  saveFile: (args) => ipcRenderer.invoke('export:saveFile', args),
  pickDirectory: () => ipcRenderer.invoke('export:pickDirectory'),
  writeFileInDir: (args) => ipcRenderer.invoke('export:writeFileInDir', args),
}

contextBridge.exposeInMainWorld('albumStudio', bridge)
