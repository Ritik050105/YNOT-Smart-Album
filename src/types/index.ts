export type PageSide = 'single' | 'left' | 'right' | 'spread'

export interface PhotoAsset {
  hasColorProfile?: boolean
  isBlackAndWhite?: boolean
  cameraModel?: string
  metadata?: Record<string,string>
  id: string
  fileName: string
  sourcePath?: string
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
  /** Named collections ("Bins" in Pixellu SmartAlbums) for organizing a big shoot — e.g.
   *  "Ceremony", "Reception", "Getting Ready". A photo can belong to any number of bins. */
  bins: string[]
  /** "Mark as Favorite" — the Photo Dock's heart-icon quick filter. */
  favorite: boolean
  /** Where the subject sits, 0-1, measured once at import. Frames start their crop here instead
   *  of dead centre, which is what used to cut the top off a group shot. */
  focusX?: number
  focusY?: number
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
  /** Rounded frame corners carried over from an imported design (measured from a PSD layer's own
   *  transparent corners), in the 900px-wide design space. Applied to the placement when the
   *  template is used, so the photo is drawn with the same corners the artwork had. */
  cornerRadiusPx?: number
  /** [topLeft, topRight, bottomRight, bottomLeft], when the artwork rounds its corners unevenly —
   *  a magazine layout often rounds one corner only. Falls back to cornerRadiusPx when absent. */
  cornerRadiiPx?: [number, number, number, number]
  /** This frame is authored full-bleed: its geometry is final, and the album margin and image
   *  gap do not apply to it. Without this a layout drawn flush to the page edge still ends up
   *  inset, leaving the white border the design exists to avoid. */
  bleed?: boolean
}

export interface TemplateDefinition {
  kind?: 'image' | 'mixed'
  category?: string
  subcategory?: string
  absoluteFrames?: boolean
  /** Page colour the design was drawn on — read from an imported PSD's background layer so the
   *  spread adopts it instead of staying white behind the artwork. */
  backgroundColor?: string
  textBoxes?: TextBox[]
  id: string
  name: string
  photoCount: number
  pageSide: PageSide
  placeholders: PlaceholderRect[]
  /** Built-in templates ship with the app; user templates are saved locally. */
  isBuiltIn: boolean
  createdAt: string
  thumbnailColor: string
  /** Optional reference image (data URL) shown instead of the solid-color swatch — set when a
   *  template is registered from an uploaded photo or saved from a spread with photos in it. */
  thumbnailImage?: string
}

export type FrameStyle = 'none' | 'rounded' | 'polaroid' | 'shadow'

export interface PlacedPhoto {
  imageRotationDeg?: number
  groupId?: string
  hidden?: boolean
  zIndex?: number
  locked?: boolean
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
  blackWhiteMix?: number[]
  /** "Art gallery" framing + a gentle tilt ("skew") for a scattered-print look. */
  frameStyle: FrameStyle
  rotationDeg: number
  /** Simulated relighting: a soft radial glow/shadow centered on the photo.
   *  Positive = add light, negative = add shadow/vignette, 0 = off. */
  relightIntensity: number
  /** Corner radius in px, used when frameStyle is 'rounded' (continuous control rather than a
   *  single fixed radius). */
  cornerRadiusPx: number
  /** Per-corner override carried over from an imported design: [tl, tr, br, bl]. The Radius slider
   *  sets cornerRadiusPx and clears this, so a manual edit always wins. */
  cornerRadiiPx?: [number, number, number, number]
  /** Frame menu's "Flip Image Horizontally/Vertically" — mirrors the photo within its own crop,
   *  independent of the spread-level "Flip Spread Horizontally". */
  flipHorizontal: boolean
  flipVertical: boolean
}

/** The subset of PlacedPhoto that "Copy/Paste Tone Adjustments" and multi-select batch editing
 *  operate on — everything about how a photo looks, not which photo or where it's cropped. */
export type ToneAdjustments = Pick<PlacedPhoto,'warmth'|'brightness'|'contrast'|'saturation'|'blackWhiteMix'|'relightIntensity'>

export type TextEffectName='stroke'|'dropShadow'|'outerGlow'|'innerShadow'|'innerGlow'|'bevel'|'satin'|'colorOverlay'|'gradientOverlay'|'patternOverlay'|'texture'
export interface TextEffect {
 enabled:boolean;color:string;color2?:string;size:number;opacity:number;angle:number;distance:number
 blendMode?:GlobalCompositeOperation;contour?:'linear'|'soft'|'sharp';antiAlias?:boolean;noise?:number
 position?:'inside'|'center'|'outside';fillType?:'color'|'gradient'|'pattern';spread?:number
 useGlobalLight?:boolean;knockout?:boolean;technique?:'smooth'|'chisel-hard'|'chisel-soft'|'softer'|'precise'
 source?:'edge'|'center';range?:number;jitter?:number;invert?:boolean
 bevelStyle?:'inner'|'outer'|'emboss'|'pillow';depth?:number;direction?:'up'|'down';soften?:number;altitude?:number
 highlightMode?:GlobalCompositeOperation;shadowMode?:GlobalCompositeOperation;highlightOpacity?:number;shadowOpacity?:number
 gradientStyle?:'linear'|'radial'|'angle'|'reflected'|'diamond';reverse?:boolean;dither?:boolean;scale?:number
 offsetX?:number;offsetY?:number;pattern?:'stripes'|'dots'|'checker';patternSrc?:string
}
export interface TextBox {
  /** Preview renders (font-template cards) fall back to a default font instead of failing when the real one can't be loaded. */
  previewOnly?: boolean
  sourceArtwork?: {fontRatio:number;src:string; text:string; fontFamily:string; color:string; bold:boolean; italic:boolean}

  fillOpacity?:number
  blendMode?:'source-over'|'multiply'|'screen'|'overlay'|'darken'|'lighten'
  shape?:'rectangle'|'circle'|'triangle'|'line'
  shapeRoundedEnds?:boolean
  shapeStrokeStyle?:'solid'|'dashed'|'short-dashed'|'dotted'
  shapeMode?:'fill'|'stroke'|'both'
  shapeStroke?:string
  shapeStrokeWidth?:number
  underline?:boolean
  strikeThrough?:boolean
  letterSpacing?:number
  lineHeight?:number
  opacity?:number
  effects?:Partial<Record<TextEffectName,TextEffect>>

  rotationDeg?: number
  /** Set on the copies a mixed template brings with it, so applying or cycling to another
   *  template replaces only its own captions and leaves text the designer wrote alone. */
  fromTemplate?: boolean
  /** New text fits its content until a manual width is chosen. */
  autoWidth?: boolean
  groupId?: string
  hidden?: boolean
  zIndex?: number
  locked?: boolean
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  fontFamily: string
  fontSize: number
  color: string
  /** The four justify values set every line flush to both edges; the suffix is how the last
   *  line of each paragraph is set, the way InDesign's four justify buttons work. */
  align: 'left' | 'center' | 'right' | 'justify' | 'justify-left' | 'justify-center' | 'justify-right'
  bold: boolean
  italic: boolean
}

export interface Spread {
  backgroundHidden?: boolean
  backgroundLocked?: boolean
  /** Keeps this spread's chosen layout fixed — template browsing/cycling/auto-rearrange can't
   *  change it, though photos within its frames can still be swapped freely. */
  templateLocked?: boolean
  backgroundPattern?: { name: string; src: string; tileSizePx: number; mode?: 'cover'; width?: number; height?: number; edits?: PlacedPhoto }
  /** Normalized frame positions after a layout is customized in Designer View. */
  customBoxes?: PlaceholderRect[]
  /** Cover artwork has lab dimensions independent of the interior spreads. */
  size?: AlbumSize
  coverDetails?: { wrapIn: number; spineIn: number; guideSrc?: string; guideName?: string; guidePixels?: { width: number; height: number }; reviewedPageCount: number }
  id: string
  order: number
  pageSide: PageSide
  templateId: string
  placements: PlacedPhoto[]
  textBoxes: TextBox[]
  backgroundColor: string
  /** Paper colour for one page only, when the two pages of a spread are coloured differently.
   *  Unset means that page takes `backgroundColor` like the rest of the sheet. */
  backgroundColorLeft?: string
  backgroundColorRight?: string
  gapPx: number
  marginPx: number
  /** Mirrors the template horizontally (x' = 1 - x - width) without needing a second copy of
   *  every template definition — "Flip Spread Horizontally". */
  flipped: boolean
  /** The album's front/spine/back cover, as opposed to an interior page spread — kept in the
   *  same `spreads` array (so every existing per-spread action just works on it unchanged) but
   *  shown in its own section of the Spreads panel, pinned first (order -1), and excluded from
   *  the interior page count. */
  isCover: boolean
  /** Photoshop/InDesign-style ruler guides — the View menu's "New Guide"/"Guides" — draggable
   *  reference lines that don't print, stored as 0-1 fractions of the canvas (horizontal = a
   *  horizontal line at that Y fraction, vertical = a vertical line at that X fraction). */
  guides: { horizontal: number[]; vertical: number[] }
}

export type AlbumSizeCategory = 'Square' | 'Portrait' | 'Landscape' | 'Panoramic' | 'Magazine' | 'Custom'

/** A margin that can differ between a spread's outer edges and the "inside" edge next to its
 *  spine/fold — the New Project wizard's Custom tab shows exactly these three fields for both
 *  Safe Zone and Trim ("Left/right, top/bottom, inside"). */
export interface EdgeInset {
  leftRight: number
  topBottom: number
  inside: number
}

export interface AlbumSize {
  id: string
  label: string
  category: AlbumSizeCategory
  widthIn: number
  heightIn: number
  /** Bleed/trim — how far past the trim line artwork should extend. */
  trim: EdgeInset
  /** Safe zone — how far in from the trim line important content should stay clear of. */
  safeZone: EdgeInset
  dpi: number
  /** Optional page-count range (an "album company" product's own printing constraints) — Export
   *  warns ("...the album needs to have between X and Y pages...") when the current interior page
   *  count falls outside it. Undefined/0 means no limit. Set from the Custom tab or a saved preset. */
  minPages?: number
  maxPages?: number
}

export interface Project {
  customFonts?: { family: string; dataUrl: string }[]
  id: string
  name: string
  size: AlbumSize
  photos: PhotoAsset[]
  spreads: Spread[]
  createdAt: string
  updatedAt: string
  /** How this job is categorized in YNOT's own portfolio system (Wedding, Concert, etc.). */
  eventType: string
  /** Optional wedding-community tag (Brahmin, Kongu, Cross Culture, ...), blank if not applicable. */
  community: string
  /** Client / couple name for this job, shown on proofing galleries and exports. */
  clientName: string
  /** Display unit for size fields in the UI — storage stays in inches regardless. */
  units: 'in' | 'cm' | 'mm' | 'px'
  /** Metadata only (no real ICC conversion performed) — recorded so exports/handoff notes
   *  can say what color space the designer was working in, same as Pixellu's project setting. */
  colorProfile: string
  /** Defaults applied to newly created spreads (auto-build and "+ New Spread"). */
  defaultBackgroundColor: string
  defaultGapPx: number
  defaultMarginPx: number
  /** Defaults applied to newly placed photos (auto-build) — "Border around images" in the New
   *  Project wizard's Appearance step. */
  defaultBorderWidth: number
  defaultBorderColor: string
  /** When set, Smart Grid Suggestions only offers templates from this list (chosen when the
   *  project was created) — null means "all templates available". */
  enabledTemplateIds: string[] | null
  /** Whether Auto-Build may use two-page-wide ("full spread") templates for the album's very
   *  first / last interior spread, or must keep those as single pages — the New Project wizard's
   *  "Layout Type: Starts with / Ends with" setting. */
  layoutStart: 'spread' | 'single'
  layoutEnd: 'spread' | 'single'
  /** Whether Auto-Build's template pool includes full-spread (two-page) templates at all —
   *  the wizard's "Include full spread templates" checkbox. */
  includeFullSpreadTemplates: boolean
  /** What kind of project this is — mirrors the Home screen's Albums/Galleries/Slideshows tabs.
   *  Galleries and Slideshows skip the spread/template machinery entirely and use `photos`
   *  directly (as a flat proofing grid, or an ordered slide sequence) instead. Defaults to
   *  'album' so older saved projects (which predate this field) load unchanged. */
  kind: 'album' | 'gallery' | 'slideshow'
  /** Slideshow-only: how long each slide shows, in milliseconds, during Play preview. */
  slideDurationMs: number
}

/** On-disk project file format — self-contained (photos embedded as data URLs) so it opens
 *  on any machine without the original source images being present. */
export interface ProjectFile {
  formatVersion: 1
  project: Project
  userTemplates: TemplateDefinition[]
}
