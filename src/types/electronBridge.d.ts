export interface NewProjectPayload {
  name: string
  size: unknown
  units: unknown
  colorProfile: string
  defaultBackgroundColor: string
  defaultGapPx: number
  defaultMarginPx: number
  defaultBorderWidth: number
  defaultBorderColor: string
  enabledTemplateIds: string[] | null
  layoutStart: 'spread' | 'single'
  layoutEnd: 'spread' | 'single'
  includeFullSpreadTemplates: boolean
}

export interface AlbumStudioBridge {
  getImagePath: (file: File) => string
  revealExportLocation: (location: string) => Promise<void>
  showImageFile: (filePath: string, reveal: boolean) => Promise<void>
  missingImagePaths: (paths: string[]) => Promise<string[]>
  isElectron: true
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
  openNewProjectWindow: () => Promise<void>
  submitNewProject: (opts: NewProjectPayload) => Promise<void>
  closeCurrentWindow: () => Promise<void>
  onSaveBeforeClose: (cb: () => void) => () => void
  onNewProjectCreated: (cb: (opts: NewProjectPayload) => void) => () => void
}

declare global {
  interface Window {
    albumStudio?: AlbumStudioBridge
  }
}
