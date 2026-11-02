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
  importRevocation: () => Promise<void>
  preferencesSystem: (action: 'cacheSize' | 'clearCache' | 'choosePhotoshop' | 'chooseCanva' | 'projectDirectory', value?: string) => Promise<string | number | null>
  readExternalEdit: (file: string, revision?: string) => Promise<{data: Uint8Array; revision: string; sourcePath?: string} | null>
  openExternalEditor: (args: { app: 'photoshop' | 'canva'; photoshopPath: string; canvaPath?: string; originalPath?: string; name: string; data: Uint8Array }) => Promise<string>

  getImagePath: (file: File) => string
  revealExportLocation: (location: string) => Promise<void>
  showImageFile: (filePath: string, reveal: boolean) => Promise<void>
  readSiblingImage: (locatedPath: string, fileName: string) => Promise<{ sourcePath: string; fileName: string; lastModified: number; data: Uint8Array } | null>
  missingImagePaths: (paths: string[]) => Promise<string[]>
  isElectron: true
  readRecovery: () => Promise<{ filePath: string | null; contents: string } | null>
  writeRecovery: (snapshot: { filePath: string | null; contents: string }) => Promise<void>
  clearRecovery: () => Promise<void>
  imagePreview: (data: Uint8Array | string) => Promise<{width:number;height:number;src:string;thumb:string;isBlackAndWhite?:boolean;hasColorProfile:boolean}>
  prepareImage: (path: string) => Promise<{width:number;height:number;hasColorProfile:boolean;isBlackAndWhite?:boolean}>
  warmImages: (paths: string[]) => Promise<void>
  putTextPreview: (key: string, bytes: Uint8Array) => Promise<void>
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
  readCachedFont?: (family: string) => Promise<{url:string;weight:string;style:string;unicodeRange:string}[] | null>
  storeFontFaces?: (family: string, faces: {data:Uint8Array;weight:string;style:string;unicodeRange:string}[]) => Promise<void>
  scanFonts: (action:'start'|'cancel'|'status') => Promise<{running:boolean;visited:number;skipped:number;fonts:{family:string;path:string}[]}>
  readDiscoveredFont: (path:string) => Promise<string>
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
