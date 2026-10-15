export type PageSide = 'single' | 'left' | 'right' | 'spread'

export interface PhotoAsset {
  id: string
  fileName: string
  /** Object URL for display; in Electron this points at the original file on disk. */
  src: string
  width: number
  height: number
  /** ISO timestamp used for timeline-based sorting/grouping (EXIF capture date, falls back to file order). */
  capturedAt: string
  orientation: 'landscape' | 'portrait' | 'square'
  /** Native pixel resolution used to compute effective print DPI once placed. */
  megapixels: number
  /** MIME type, preserved so saved projects can reconstruct the right data-URL prefix. */
  mimeType: string
}

export interface PlaceholderRect {
  id: string
  /** Normalized 0-1 coordinates relative to the spread/page canvas. */
  x: number
  y: number
  width: number
  height: number
  /** Preferred photo orientation for this slot, used by auto-layout matching. */
  preferredOrientation: 'landscape' | 'portrait' | 'any'
}

export interface TemplateDefinition {
  id: string
  name: string
  photoCount: number
  pageSide: PageSide
  placeholders: PlaceholderRect[]
  /** Built-in templates ship with the app; user templates are saved locally. */
  isBuiltIn: boolean
  createdAt: string
  thumbnailColor: string
}

export type FrameStyle = 'none' | 'rounded' | 'polaroid' | 'shadow'

export interface PlacedPhoto {
  placeholderId: string
  photoId: string | null
  /** Pan/zoom of the photo within its cropped placeholder, 0-1 normalized focal point. */
  focalX: number
  focalY: number
  zoom: number
  /** Border + opacity + tone adjustments ("Enhance Any Image"). */
  borderWidth: number
  borderColor: string
  opacity: number
  warmth: number
  brightness: number
  contrast: number
  saturation: number
  /** "Art gallery" framing + a gentle tilt ("skew") for a scattered-print look. */
  frameStyle: FrameStyle
  rotationDeg: number
}

export interface TextBox {
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  fontFamily: string
  fontSize: number
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

export interface Spread {
  id: string
  order: number
  pageSide: PageSide
  templateId: string
  placements: PlacedPhoto[]
  textBoxes: TextBox[]
  backgroundColor: string
  gapPx: number
  marginPx: number
}

export interface AlbumSize {
  id: string
  label: string
  widthIn: number
  heightIn: number
  bleedIn: number
  dpi: number
}

export interface Project {
  id: string
  name: string
  size: AlbumSize
  photos: PhotoAsset[]
  spreads: Spread[]
  createdAt: string
  updatedAt: string
}

/** On-disk project file format — self-contained (photos embedded as data URLs) so it opens
 *  on any machine without the original source images being present. */
export interface ProjectFile {
  formatVersion: 1
  project: Project
  userTemplates: TemplateDefinition[]
}
