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
}

declare global {
  interface Window {
    albumStudio?: AlbumStudioBridge
  }
}
