import { fitTextBoxSize } from '@/engine/textBoxSize'
import { spreadLayers, layerMembers, transformLayerSelection, arrangeLayerSelection, LayerAlignment, LayerAlignmentTarget, GapAnchor } from '@/engine/spreadLayers'
import { changesLockedLayer } from '@/engine/layerLocks'
import { getPreferences } from './preferences'
import { applyPageTemplate, pagePlacements, TemplateScope } from '@/engine/pageTemplates'
import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { Project, PhotoAsset, Spread, TemplateDefinition, TextBox, ToneAdjustments, ProjectFile } from '@/types'
import {
  autoBuildSpreads,
  buildSpreadsFromGroups,
  DEFAULT_AUTO_LAYOUT_OPTIONS,
  AutoLayoutOptions,
  splitSpreadIntoPages,
  mergeSpreads,
  flipSpreadHorizontally,
  createBlankSpread,
  createCoverSpread,
  defaultPlacement,
  buildSpreadFromPlacements,
} from '@/engine/autoLayout'
import { BUILT_IN_TEMPLATES, uniqueTemplates, findTemplate, setUserTemplateRegistry, templatesForCount, TemplateFrameFilter } from '@/engine/templates'
import { DEFAULT_ALBUM_SIZE, uniformInset } from '@/engine/albumSizes'
import { blobUrlToDataUrl } from '@/engine/projectFile'
import { computeAutoAdjust } from '@/engine/autoAdjust'
import { validateCoverSize } from '@/engine/cover'
import { DESIGN_WIDTH, boundedFrameRect, computePlaceholderBoxes } from '@/engine/layoutMath'
import { AlbumSize, EdgeInset } from '@/types'

/** Older saved project files stored a single `bleedIn`/`safeZoneIn` number per album size instead
 *  of today's per-edge `trim`/`safeZone` — this reads either shape and always returns the new one,
 *  so opening an old `.ablm` file doesn't crash the UI that reads `size.trim.leftRight` etc. */
function migrateAlbumSize(raw: AlbumSize & { bleedIn?: number; safeZoneIn?: number }): AlbumSize {
  const trim: EdgeInset = raw.trim ?? uniformInset(raw.bleedIn ?? 0.125)
  const safeZone: EdgeInset = raw.safeZone ?? uniformInset(raw.safeZoneIn ?? 0.25)
  return { ...raw, trim, safeZone }
}

const TEMPLATE_LIBRARY_KEY = 'albumstudio.templateLibrary'
const TEMPLATE_FAVORITES_KEY = 'albumstudio.templateFavorites'
function loadTemplateFavorites(): string[] {
  try { const ids = JSON.parse(localStorage.getItem(TEMPLATE_FAVORITES_KEY) ?? '[]'); return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [] } catch { return [] }
}

function loadUserTemplates(): TemplateDefinition[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_LIBRARY_KEY)
    return raw ? (JSON.parse(raw) as TemplateDefinition[]) : []
  } catch {
    return []
  }
}

// Every engine function that resolves a template by id (layout math, retemplating, thumbnails)
// looks it up through templates.ts's own registry rather than reaching back into this store, so
// that registry has to be kept in sync with userTemplates whenever it changes.
function saveUserTemplates(templates: TemplateDefinition[]) {
  setUserTemplateRegistry(templates)
  try {
    localStorage.setItem(TEMPLATE_LIBRARY_KEY, JSON.stringify(templates))
  } catch {
    // Storage unavailable (e.g. private mode) — template library just won't persist across sessions.
  }
}

setUserTemplateRegistry(loadUserTemplates())

const PHOTO_DOCK_ZOOM_KEY = 'albumstudio.photoDockZoom'
const PHOTO_DOCK_ZOOM_MIN = 56
const PHOTO_DOCK_ZOOM_MAX = 160
// The reference app's own Image Browser shows noticeably larger, more prominent thumbnails than
// our old 84px default (measured off its own documentation screenshots at roughly 150-170px) —
// started closer to the top of our existing 56-160 range instead, rather than a bare minimum.
const PHOTO_DOCK_ZOOM_DEFAULT = 120

function loadPhotoDockZoom(): number {
  try {
    const raw = localStorage.getItem(PHOTO_DOCK_ZOOM_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? Math.max(PHOTO_DOCK_ZOOM_MIN, Math.min(PHOTO_DOCK_ZOOM_MAX, n)) : PHOTO_DOCK_ZOOM_DEFAULT
  } catch {
    return PHOTO_DOCK_ZOOM_DEFAULT
  }
}

export interface NewProjectOptions {
  name: string
  size: Project['size']
  units: Project['units']
  colorProfile: string
  defaultBackgroundColor: string
  defaultGapPx: number
  defaultMarginPx: number
  defaultBorderWidth: number
  defaultBorderColor: string
  enabledTemplateIds: string[] | null
  layoutStart: Project['layoutStart']
  layoutEnd: Project['layoutEnd']
  includeFullSpreadTemplates: boolean
}

function newProject(opts: Partial<NewProjectOptions> & { name: string; kind?: Project['kind']; clientName?: string }): Project {
  const now = new Date().toISOString()
  const kind = opts.kind ?? 'album'
  const defaultBackgroundColor = opts.defaultBackgroundColor ?? '#ffffff'
  const defaultGapPx = opts.defaultGapPx ?? 8
  const defaultMarginPx = opts.defaultMarginPx ?? 24
  const defaultBorderWidth = opts.defaultBorderWidth ?? 0
  const defaultBorderColor = opts.defaultBorderColor ?? '#ffffff'
  // Matches the reference app: a brand-new album starts with zero spreads — they only appear
  // once photos come in (Auto-Build, or Spread > Add Blank Spread), not pre-seeded on creation.
  const spreads: Spread[] = []
  return {
    id: uuid(),
    name: opts.name,
    size: opts.size ?? DEFAULT_ALBUM_SIZE,
    photos: [],
    spreads,
    createdAt: now,
    updatedAt: now,
    eventType: 'Wedding',
    community: '',
    clientName: opts.clientName ?? '',
    units: opts.units ?? 'in',
    colorProfile: opts.colorProfile ?? 'sRGB',
    defaultBackgroundColor,
    defaultGapPx,
    defaultMarginPx,
    defaultBorderWidth,
    defaultBorderColor,
    enabledTemplateIds: opts.enabledTemplateIds ?? null,
    layoutStart: opts.layoutStart ?? 'spread',
    layoutEnd: opts.layoutEnd ?? 'spread',
    includeFullSpreadTemplates: opts.includeFullSpreadTemplates ?? true,
    kind,
    slideDurationMs: 4000,
  }
}

interface ProjectState {
  project: Project
  userTemplates: TemplateDefinition[]
  selectedSpreadId: string | null
  selectedPlaceholderId: string | null
  selectedTextBoxId: string | null
  /** Canvas multi-select (shift/ctrl+click on placed photos within the current spread), for
   *  batch tone/border editing — see updateMultiplePlacements. */
  pickingGapAnchor: boolean
  setPickingGapAnchor: (picking: boolean) => void
  gapAnchor: GapAnchor
  setGapAnchor: (anchor: GapAnchor) => void
  selectedLayerKeys: string[]
  setLayerSelection: (keys: string[]) => void
  multiSelectedPlaceholderIds: string[]
  /** Photo dock multi-select, for the click-to-select / click-to-place workflow. */
  selectedPhotoIds: string[]
  lastClickedPhotoId: string | null
  toneClipboard: ToneAdjustments | null
  showGrid: boolean
  showPrintGuides: boolean
  /** View menu's "Guides" toggle — ruler guides (Spread.guides) are hidden when off, same as
   *  Illustrator/InDesign's own show/hide guides. */
  showGuides: boolean
  /** Left (Import Photos), right (Album Info / Inspector / Templates), and bottom (Photo Dock)
   *  panel visibility — pure UI chrome, not project data, but kept here alongside
   *  showGrid/showPrintGuides since the same components (MenuBar's View menu, TopBar) need to
   *  read/toggle it. All three default closed and only auto-open once they're actually useful
   *  (see revealLeftPanel/revealRightPanel) rather than eating canvas space from the start. */
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  bottomPanelOpen: boolean
  /** The bottom Photo Dock's thumbnail size in px — shared between its own zoom slider and the
   *  drag-to-resize handle on the panel's top edge (see `setPhotoDockZoom`), and persisted across
   *  sessions so a resized dock stays the size the user left it. */
  photoDockZoom: number
  /** True for the brief "Preparing template libraries…" beat between finishing the New Project
   *  wizard and landing in the editor — matches the reference app's own loading transition. */
  preparingProject: boolean
  /** Whether the current project has edits since it was last saved (or since it was opened/
   *  created, if never saved) — drives the "continue where you left off?" prompt on next launch
   *  (see engine/sessionMarker.ts) and could back an unsaved-changes indicator later. Every
   *  project-content mutation goes through withHistory, which sets this true; explicit saves and
   *  freshly loaded/created projects set it back to false. */
  isDirty: boolean
  /** The on-disk path of the current project, once known (set after a successful save or open) —
   *  only ever populated in Electron, where projects are real files. Cleared when a project with
   *  no file yet is created/opened or when returning to Home. Lets App.tsx know where to reopen
   *  this exact project from if it's left with unsaved changes (see engine/sessionMarker.ts). */
  currentFilePath: string | null
  /** Canvas interaction mode — "pan" sticks the canvas in pan-and-drag mode (the TopBar's hand-tool
   *  button) as an alternative to holding Space, matching the reference app's Select/Pan toolbar
   *  icons. */
  canvasTool: 'select' | 'pan' | 'frame' | 'text' | 'zoom'
  /** The Templates menu's frame-ratio filter (All/no-square/only-3x2) — shared between the menu
   *  bar and the Inspector's "Smart Grid Suggestions" picker so both reflect the same choice. */
  templateFrameFilter: TemplateFrameFilter
  /** Edit menu's Copy/Cut/Paste — holds the copied placement's photoId (and its full tone/crop,
   *  so Paste restores a real copy, not just the bare photo reference). */
  photoClipboard: { photoId: string; placement: Omit<Spread['placements'][number], 'placeholderId'> } | null
  /** View menu's "Show File Names in Image Browser" — shows each Photo Dock thumbnail's filename. */
  showPhotoFileNames: boolean
  /** A spread's own Cut/Copy/Paste clipboard (the Spread context menu) — separate from
   *  `photoClipboard`, which copies one placed photo rather than a whole spread's layout. */
  spreadClipboard: Pick<Spread, 'templateId' | 'placements' | 'textBoxes' | 'backgroundColor' | 'backgroundPattern' | 'backgroundHidden' | 'gapPx' | 'marginPx' | 'pageSide' | 'customBoxes' | 'flipped' | 'guides'> | null
  /** A read-only mirror of DesignerCanvas's own local zoom/pan state, written there on every
   *  change — lets Designer View's ruler and "1:1" zoom readout reflect the live canvas view
   *  without lifting that interaction-critical state (and its Figma-style wheel/keyboard
   *  handling) out of the component that actually owns it. */
  canvasZoom: number
  canvasPan: { x: number; y: number }
  /** Set while the reference app's focused single-spread "Designer View" is open (reached by
   *  double-clicking a spread in the all-spreads overview, or Spread > Edit in Designer View) —
   *  a dedicated zoomed-in editing mode with its own ruler and tool rail, separate from the
   *  overview's row of spread cards. */
  designerViewSpreadId: string | null
  matchingTemplatesOpen: boolean
  fontPreview: { textBoxId: string; family: string } | null
  templatePreview: Spread | null
  favoriteTemplateIds: string[]
  openMatchingTemplates: (spreadId: string) => void
  closeMatchingTemplates: () => void
  previewMatchingTemplate: (templateId: string | null, keepOrder?: boolean, scope?: TemplateScope) => void
  toggleTemplateFavorite: (templateId: string) => void
  autoLayoutOptions: AutoLayoutOptions
  history: Project[]
  future: Project[]

  addPhotos: (photos: PhotoAsset[]) => void
  runAutoBuild: () => void
  /** The Auto Build dialog's "Auto Build" button — appends new spreads built from `groups`
   *  (each a photo-id array, one per new spread) to the END of the existing album, leaving any
   *  spreads already there untouched. Unlike `runAutoBuild`, which replaces the whole album. */
  runAutoBuildFromGroups: (groups: string[][], opts?: { allowTemplateRepeats?: boolean; matchTimelineOrder?: boolean; templateReuse?: 'low' | 'medium' | 'high' }) => void
  selectSpread: (id: string | null) => void
  selectPlaceholder: (id: string | null) => void
  selectTextBox: (id: string | null) => void
  toggleMultiSelectPlaceholder: (id: string) => void
  clearMultiSelect: () => void
  setSelectedPhotoIds: (ids: string[], lastClicked: string | null) => void
  togglePhotoSelection: (photoId: string, allPhotoIdsInOrder: string[], mode: 'single' | 'toggle' | 'range') => void
  toggleGrid: () => void
  togglePrintGuides: () => void
  toggleGuides: () => void
  addGuide: (spreadId: string, axis: 'horizontal' | 'vertical', position: number) => void
  moveGuide: (spreadId: string, axis: 'horizontal' | 'vertical', index: number, position: number) => void
  removeGuide: (spreadId: string, axis: 'horizontal' | 'vertical', index: number) => void
  toggleLeftPanel: () => void
  toggleBottomPanel: () => void
  /** Forces the left panel open (never closed) — used to auto-expand it the moment it becomes
   *  useful (entering the editor, where Import Photos is the first thing you need), without
   *  fighting a manual collapse: this never *closes* a panel the user already collapsed. */
  revealLeftPanel: () => void
  toggleRightPanel: () => void
  /** Forces the right panel open (never closed) — used to auto-expand it the moment the user
   *  starts actually editing a frame or text box, same "reveal, never close" pattern as the left
   *  panel. */
  revealRightPanel: () => void
  setPhotoDockZoom: (v: number) => void
  setPreparingProject: (v: boolean) => void
  /** Clears the dirty flag — called after a successful save, and after loading/creating a
   *  project (which starts clean relative to its own just-loaded/just-created state). */
  markSaved: () => void
  setCurrentFilePath: (path: string | null) => void
  setCanvasTool: (tool: 'select' | 'pan' | 'frame' | 'text' | 'zoom') => void
  setTemplateFrameFilter: (f: TemplateFrameFilter) => void
  toggleShowPhotoFileNames: () => void
  enterDesignerView: (spreadId: string) => void
  exitDesignerView: (keepEmpty?: boolean) => void
  setCanvasViewportMirror: (zoom: number, pan: { x: number; y: number }) => void
  copyPlacement: (spreadId: string, placeholderId: string) => void
  pastePlacement: (spreadId: string, placeholderIds: string[]) => void
  cutPlacement: (spreadId: string, placeholderId: string) => void
  copySpread: (spreadId: string) => void
  pasteSpreadAfter: (afterSpreadId: string) => void
  cutSpread: (spreadId: string) => void
  convertSpreadPageType: (spreadId: string) => void
  reorderSpreads: (fromIndex: number, toIndex: number) => void
  splitSpread: (spreadId: string, cutIndex?: number) => void
  moveTimelinePhoto: (sourceSpreadId: string, frameId: string, targetSpreadId: string | null, beforeFrameId?: string) => void
  insertTimelinePhotos: (photoIds: string[], targetSpreadId: string | null, beforeFrameId?: string) => void
  mergeWithNext: (spreadId: string) => void
  flipSpread: (spreadId: string) => void
  addBlankSpread: () => void
  addCoverSpread: () => void
  configureCover: (size: AlbumSize, details: NonNullable<Spread['coverDetails']>, photoIds?: string[]) => void
  duplicateSpread: (spreadId: string) => void
  deleteSpread: (spreadId: string) => void
  applyTemplateToSpread: (spreadId: string, templateId: string, keepOrder?: boolean, scope?: TemplateScope) => void
  cycleSpreadTemplate: (spreadId: string, direction: -1 | 1) => void
  applyTemplateToAllSpreads: (templateId: string) => void
  updateSpread: (spreadId: string, patch: Partial<Spread>) => void
  applyBackgroundToAllSpreads: (spreadId: string, pattern?: Spread['backgroundPattern']) => void
  makePhotoBackground: (spreadId: string, frameId: string) => void
  detachBackground: (spreadId: string) => void
  applyExternalSpread: (spreadId: string, photo: PhotoAsset) => void
  relinkPhoto: (photoId: string, replacement: PhotoAsset) => void
  addImageFrame: (spreadId: string, rect: { x: number; y: number; width: number; height: number }, photoId?: string) => void
  updateImageFrame: (spreadId: string, frameId: string, rect: { x: number; y: number; width: number; height: number }) => void
  groupLayers: (spreadId: string, keys: string[]) => void
  ungroupLayers: (spreadId: string, groupId: string) => void
  transformSelection: (spreadId: string, keys: string[], rect: {x:number;y:number;width:number;height:number}) => void
  arrangeSelection: (spreadId: string, keys: string[], mode: LayerAlignment, target?: LayerAlignmentTarget, exactGap?: number, anchor?: GapAnchor) => void
  transformGroup: (spreadId: string, groupId: string, rect: {x:number;y:number;width:number;height:number}) => void
  clearLayerFlags: (spreadId: string, layers: {kind:'image'|'text'|'background';id:string}[], flag:'locked'|'hidden') => void
  setLayerHidden: (spreadId: string, kind: 'image' | 'text' | 'background', id: string, hidden: boolean) => void
  moveLayer: (spreadId: string, kind: 'image' | 'text', id: string, targetKind: 'image' | 'text', targetId: string) => void
  setLayerLocked: (spreadId: string, kind: 'image' | 'text' | 'background', id: string, locked: boolean) => void
  removeImageFrame: (spreadId: string, frameId: string) => void
  setPlacementPhoto: (spreadId: string, placeholderId: string, photoId: string | null) => void
  swapPlacements: (spreadId: string, placeholderIdA: string, placeholderIdB: string) => void
  updatePlacement: (spreadId: string, placeholderId: string, patch: Partial<Spread['placements'][number]>) => void
  resetPlacementToOriginal: (spreadId: string, placeholderId: string) => void
  updateMultiplePlacements: (spreadId: string, placeholderIds: string[], patch: Partial<Spread['placements'][number]>) => void
  copyToneAdjustments: (spreadId: string, placeholderId: string) => void
  pasteToneAdjustments: (spreadId: string, placeholderIds: string[]) => void
  /** "Auto Align" — recenters the photo's focal point and resets its zoom, so it sits centered
   *  and fully covering its frame with no manual panning needed. */
  autoAlignPlacement: (spreadId: string, placeholderId: string) => void
  /** "Auto Adjust" — analyzes the placed photo's own pixels and applies a corrective
   *  brightness/contrast/saturation pass (see engine/autoAdjust.ts). */
  autoAdjustPlacement: (spreadId: string, placeholderId: string) => Promise<void>
  autoEnhanceImages: (targets: { spreadId: string; frameId?: string }[]) => Promise<void>
  unlockTextBoxes: (spreadId: string, textIds: string[]) => void
  autoFitTextBoxes: (spreadId: string, textIds: string[]) => void
  addTextBox: (spreadId: string, box: TextBox) => void
  updateTextBox: (spreadId: string, textBoxId: string, patch: Partial<TextBox>) => void
  removeTextBox: (spreadId: string, textBoxId: string) => void
  saveSpreadAsTemplate: (spreadId: string, name: string) => Promise<void>
  importTemplateFromPhoto: (name: string, baseTemplateId: string, photoDataUrl: string) => Promise<void>
  deleteUserTemplate: (id: string) => void
  setAutoLayoutOptions: (opts: Partial<AutoLayoutOptions>) => void
  allTemplates: () => TemplateDefinition[]
  undo: (keepTemplateBrowser?: boolean) => void
  redo: (keepTemplateBrowser?: boolean) => void
  renameProject: (name: string) => void
  updateProjectMeta: (patch: Partial<Pick<Project, 'eventType' | 'community' | 'clientName'>>) => void
  updateProjectSettings: (patch: Partial<Pick<Project, 'colorProfile' | 'units' | 'size' | 'customFonts'>>) => void
  loadProjectFile: (file: ProjectFile) => void
  newProjectFile: () => void
  createProjectFromWizard: (opts: NewProjectOptions) => void
  /** Creates a minimal Gallery or Slideshow project — these skip the Album wizard entirely
   *  (no spreads/templates to configure) and just need a name/client before landing in their
   *  own dedicated screen. */
  createSimpleProject: (kind: 'gallery' | 'slideshow', name: string, clientName: string) => void
  setPhotoBins: (photoId: string, bins: string[]) => void
  setPhotoFavorite: (photoId: string, favorite: boolean) => void
  /** Slideshow-only: reorders the flat `photos` array itself (there's no separate "slide" list —
   *  the photo pool's own order IS the slide order). */
  reorderPhotos: (fromIndex: number, toIndex: number) => void
  setSlideDuration: (ms: number) => void
}

function withHistory(set: (fn: (s: ProjectState) => Partial<ProjectState>) => void, mutate: (p: Project) => Project, changingLock = false, keepTemplateBrowser = false) {
  set((s) => {
    const mutated = mutate(s.project)
    if (mutated === s.project) return {}
    if (!changingLock && changesLockedLayer(s.project, mutated)) {
      queueMicrotask(()=>window.dispatchEvent(new CustomEvent('album-studio:preference-notice',{detail:'Unlock the affected layer in Designer View → Layers before editing it.'})))
      return {}
    }
    if(!getPreferences().reuseImages){
      const counts=(p:Project)=>{const map=new Map<string,number>();for(const spread of p.spreads){for(const pl of spread.placements)if(pl.photoId)map.set(pl.photoId,(map.get(pl.photoId)??0)+1);const id=spread.backgroundPattern?.edits?.photoId;if(id)map.set(id,(map.get(id)??0)+1)}return map}
      const old=counts(s.project)
      if([...counts(mutated)].some(([id,count])=>count>1&&count>(old.get(id)??0))){queueMicrotask(()=>window.dispatchEvent(new CustomEvent('album-studio:preference-notice',{detail:'This image is already used. Enable image reuse in Tools → Preferences → General to place another copy.'})));return {}}
    }
    const added=getPreferences().navigateNew?mutated.spreads.find(spread=>!s.project.spreads.some(old=>old.id===spread.id)):undefined
    const nextProject = { ...mutated, updatedAt: new Date().toISOString() }
    return {
      project: nextProject,
      ...(added?{selectedSpreadId:added.id}:{}),
      fontPreview: null,
      templatePreview: null,
      matchingTemplatesOpen: keepTemplateBrowser ? s.matchingTemplatesOpen : false,
      history: [...s.history, s.project].slice(-50),
      future: [],
      isDirty: true,
    }
  })
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: newProject({ name: 'Untitled Album' }),
  userTemplates: loadUserTemplates(),
  selectedSpreadId: null,
  selectedPlaceholderId: null,
  selectedTextBoxId: null,
  pickingGapAnchor: false,
  setPickingGapAnchor: (pickingGapAnchor) => set({pickingGapAnchor}),
  gapAnchor: 'first',
  setGapAnchor: (gapAnchor) => set({gapAnchor,pickingGapAnchor:false}),
  selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
  selectedPhotoIds: [],
  lastClickedPhotoId: null,
  toneClipboard: null,
  showGrid: false,
  showPrintGuides: true,
  showGuides: true,
  // Collapsed by default — App.tsx reveals it on entering the editor (Import Photos is the
  // first useful action), rather than always eating canvas width up front.
  leftPanelOpen: false,
  rightPanelOpen: false,
  bottomPanelOpen: true,
  photoDockZoom: loadPhotoDockZoom(),
  preparingProject: false,
  isDirty: false,
  currentFilePath: null,
  canvasTool: 'select',
  templateFrameFilter: 'all',
  photoClipboard: null,
  spreadClipboard: null,
  showPhotoFileNames: false,
  canvasZoom: 1,
  canvasPan: { x: 0, y: 0 },
  designerViewSpreadId: null,
  matchingTemplatesOpen: false,
  fontPreview: null,
  templatePreview: null,
  favoriteTemplateIds: loadTemplateFavorites(),
  openMatchingTemplates: (spreadId) => {
    const spread = get().project.spreads.find(s => s.id === spreadId && !s.isCover)
    if (spread) set({ selectedSpreadId: spreadId, selectedPlaceholderId: null, selectedTextBoxId: null, selectedLayerKeys: [], multiSelectedPlaceholderIds: [], matchingTemplatesOpen: true, templatePreview: null })
  },
  closeMatchingTemplates: () => set({ matchingTemplatesOpen: false, templatePreview: null }),
  previewMatchingTemplate: (templateId, keepOrder = true, scope = 'spread') => {
    const { project, selectedSpreadId, templateFrameFilter } = get()
    const spread = project.spreads.find(s => s.id === selectedSpreadId && !s.isCover)
    if (!spread || !templateId) { set({ templatePreview: null }); return }
    const size = spread.size ?? project.size
    const selected = pagePlacements(spread, size.widthIn / size.heightIn, scope)
    const count = selected.filter(p => p.photoId).length || selected.length
    if(!count){set({templatePreview:null});return}
    if (!templatesForCount(count, project.enabledTemplateIds, templateFrameFilter, size.widthIn / size.heightIn / (scope === 'spread' ? 1 : 2)).some(t => t.id === templateId)) return
    set({ templatePreview: applyPageTemplate(spread, templateId, project.photos, size.widthIn / size.heightIn, keepOrder, scope) })
  },
  toggleTemplateFavorite: (templateId) => {
    const ids = get().favoriteTemplateIds
    const favoriteTemplateIds = ids.includes(templateId) ? ids.filter(id => id !== templateId) : [...ids, templateId]
    try { localStorage.setItem(TEMPLATE_FAVORITES_KEY, JSON.stringify(favoriteTemplateIds)) } catch { /* Keep favorites usable for this session if storage is full. */ }
    set({ favoriteTemplateIds })
  },
  autoLayoutOptions: DEFAULT_AUTO_LAYOUT_OPTIONS,
  history: [],
  future: [],

  addPhotos: (photos) =>
    withHistory(set, (p) => ({ ...p, photos: [...p.photos, ...photos] })),

  runAutoBuild: () => {
    const { project, autoLayoutOptions } = get()
    const appearance = {
      backgroundColor: project.defaultBackgroundColor,
      gapPx: project.defaultGapPx,
      marginPx: project.defaultMarginPx,
      borderWidth: project.defaultBorderWidth,
      borderColor: project.defaultBorderColor,
    }
    const layout = {
      start: project.spreads.some((spread) => !spread.isCover) ? 'spread' : project.layoutStart,
      end: project.layoutEnd,
      includeFullSpreadTemplates: project.includeFullSpreadTemplates,
      aspect: project.size.widthIn / project.size.heightIn,
      frameFilter: get().templateFrameFilter,
    }
    const spreads = autoBuildSpreads(project.photos, autoLayoutOptions, appearance, project.enabledTemplateIds, layout)
    withHistory(set, (p) => ({ ...p, spreads }))
    // Jump straight to the first built spread instead of leaving the canvas on its empty
    // "select a spread" placeholder — otherwise the drop-to-build flow looks like it did
    // nothing, and the Inspector's template-switching panel (which only renders for a
    // selected spread) never appears.
    const first = spreads.find((s) => !s.isCover) ?? spreads[0]
    if (first) {
      set({
        selectedSpreadId: first.id,
        selectedPlaceholderId: null,
        selectedTextBoxId: null,
        selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      })
    }
  },

  runAutoBuildFromGroups: (groups, opts) => {
    const { project, autoLayoutOptions } = get()
    const photosById = new Map(project.photos.map((p) => [p.id, p]))
    if (groups.some(ids => ids.some(id => !photosById.has(id)))) throw new Error('Some selected images are no longer available. Reopen Auto Build and select the images again.')
    const photoGroups = groups
      .map((ids) => ids.map((id) => photosById.get(id)).filter((p): p is PhotoAsset => !!p))
      .filter((g) => g.length > 0)
      .flatMap((group) => Array.from({ length: Math.ceil(group.length / 30) }, (_, i) => group.slice(i * 30, (i + 1) * 30)))
    if (photoGroups.length === 0) return
    const appearance = {
      backgroundColor: project.defaultBackgroundColor,
      gapPx: project.defaultGapPx,
      marginPx: project.defaultMarginPx,
      borderWidth: project.defaultBorderWidth,
      borderColor: project.defaultBorderColor,
    }
    const layout = {
      start: project.spreads.some((spread) => !spread.isCover) ? 'spread' : project.layoutStart,
      end: project.layoutEnd,
      includeFullSpreadTemplates: project.includeFullSpreadTemplates,
      aspect: project.size.widthIn / project.size.heightIn,
      frameFilter: get().templateFrameFilter,
    }
    const newSpreads = buildSpreadsFromGroups(
      photoGroups,
      appearance,
      project.enabledTemplateIds,
      layout,
      opts?.matchTimelineOrder ?? autoLayoutOptions.matchTimelineOrder,
      opts?.allowTemplateRepeats ?? false,
      opts?.templateReuse
    )
    const maxOrder = project.spreads.reduce((m, s) => Math.max(m, s.order), -1)
    const appended = newSpreads.map((s, i) => ({ ...s, order: maxOrder + 1 + i }))
    withHistory(set, (p) => ({ ...p, spreads: [...p.spreads, ...appended] }))
    const first = appended[0]
    if (first && getPreferences().navigateNew && get().project.spreads.some(s => s.id === first.id)) {
      set({
        selectedSpreadId: first.id,
        selectedPlaceholderId: null,
        selectedTextBoxId: null,
        selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      })
    }
  },

  selectSpread: (id) =>
    set({
      matchingTemplatesOpen: false,
      fontPreview: null,
      templatePreview: null,
      selectedSpreadId: id,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
    }),
  selectPlaceholder: (id) =>
    set((s) => ({
      selectedPlaceholderId: id,
      selectedTextBoxId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      rightPanelOpen: id ? true : s.rightPanelOpen,
    })),
  selectTextBox: (id) =>
    set((s) => ({
      selectedTextBoxId: id,
      selectedPlaceholderId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      rightPanelOpen: id ? true : s.rightPanelOpen,
    })),

  setLayerSelection: (keys) => set(s=>{
    const spread=s.project.spreads.find(sp=>sp.id===s.selectedSpreadId)
    if(!spread)return {}
    const members=spreadLayers(spread).filter(l=>keys.includes(l.kind+':'+l.id)).flatMap(l=>layerMembers(spread,l.kind,l.id))
    const valid=[...new Set(members.filter(l=>!l.value.locked&&!l.value.hidden).map(l=>l.kind+':'+l.id))]
    return {selectedLayerKeys:valid,multiSelectedPlaceholderIds:spread.placements.filter(p=>valid.includes('image:'+p.placeholderId)).map(p=>p.placeholderId),selectedPlaceholderId:null,selectedTextBoxId:null,rightPanelOpen:valid.length?true:s.rightPanelOpen}
  }),
  toggleMultiSelectPlaceholder: (id) =>
    set((s) => {
      const has = s.multiSelectedPlaceholderIds.includes(id)
      // Starting a multi-select from a single selection folds that selection in as the first member.
      const base = s.multiSelectedPlaceholderIds.length > 0 ? s.multiSelectedPlaceholderIds : s.selectedPlaceholderId ? [s.selectedPlaceholderId] : []
      const next = has ? base.filter((x) => x !== id) : [...base, id]
      return { selectedLayerKeys: [], multiSelectedPlaceholderIds: next, selectedPlaceholderId: null, selectedTextBoxId: null }
    }),
  clearMultiSelect: () => set({ selectedLayerKeys: [], multiSelectedPlaceholderIds: [] }),

  setSelectedPhotoIds: (ids, lastClicked) => set({ selectedPhotoIds: ids, lastClickedPhotoId: lastClicked }),
  togglePhotoSelection: (photoId, allPhotoIdsInOrder, mode) =>
    set((s) => {
      if (mode === 'single') {
        return { selectedPhotoIds: [photoId], lastClickedPhotoId: photoId }
      }
      if (mode === 'toggle') {
        const has = s.selectedPhotoIds.includes(photoId)
        return {
          selectedPhotoIds: has ? s.selectedPhotoIds.filter((id) => id !== photoId) : [...s.selectedPhotoIds, photoId],
          lastClickedPhotoId: photoId,
        }
      }
      // range: select everything between the last-clicked photo and this one (inclusive).
      const anchor = s.lastClickedPhotoId ?? photoId
      const from = allPhotoIdsInOrder.indexOf(anchor)
      const to = allPhotoIdsInOrder.indexOf(photoId)
      if (from === -1 || to === -1) return { selectedPhotoIds: [photoId], lastClickedPhotoId: photoId }
      const [lo, hi] = from <= to ? [from, to] : [to, from]
      return { selectedPhotoIds: allPhotoIdsInOrder.slice(lo, hi + 1), lastClickedPhotoId: photoId }
    }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  togglePrintGuides: () => set((s) => ({ showPrintGuides: !s.showPrintGuides })),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),

  addGuide: (spreadId, axis, position) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : { ...s, guides: { ...s.guides, [axis]: [...s.guides[axis], Math.min(1, Math.max(0, position))] } }
      ),
    })),

  moveGuide: (spreadId, axis, index, position) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : {
              ...s,
              guides: {
                ...s.guides,
                [axis]: s.guides[axis].map((v, i) => (i === index ? Math.min(1, Math.max(0, position)) : v)),
              },
            }
      ),
    })),

  removeGuide: (spreadId, axis, index) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId ? s : { ...s, guides: { ...s.guides, [axis]: s.guides[axis].filter((_, i) => i !== index) } }
      ),
    })),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  revealLeftPanel: () => set((s) => (s.leftPanelOpen ? s : { leftPanelOpen: true })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  revealRightPanel: () => set((s) => (s.rightPanelOpen ? s : { rightPanelOpen: true })),
  setPhotoDockZoom: (v) => {
    const clamped = Math.max(PHOTO_DOCK_ZOOM_MIN, Math.min(PHOTO_DOCK_ZOOM_MAX, Math.round(v)))
    set({ photoDockZoom: clamped })
    try {
      localStorage.setItem(PHOTO_DOCK_ZOOM_KEY, String(clamped))
    } catch {
      // Storage unavailable — the resized dock just won't persist across sessions.
    }
  },
  setPreparingProject: (v) => set({ preparingProject: v }),
  markSaved: () => set({ isDirty: false }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setCanvasTool: (tool) => set({ canvasTool: tool }),
  setTemplateFrameFilter: (f) => set({ templateFrameFilter: f }),
  toggleShowPhotoFileNames: () => set((s) => ({ showPhotoFileNames: !s.showPhotoFileNames })),
  enterDesignerView: (spreadId) => set({ designerViewSpreadId: spreadId, selectedSpreadId: spreadId, selectedPlaceholderId: null, selectedTextBoxId: null, selectedLayerKeys: [], multiSelectedPlaceholderIds: [], canvasTool: 'select', matchingTemplatesOpen: false, templatePreview: null }),
  exitDesignerView: (keepEmpty = false) => {
    const spread = get().project.spreads.find((s) => s.id === get().designerViewSpreadId)
    if (!keepEmpty && spread?.isCover && !spread.placements.some((p) => p.photoId) && !spread.textBoxes.some((t) => t.text.trim())) {
      window.dispatchEvent(new CustomEvent('album-studio:empty-cover'))
      return
    }
    set({ designerViewSpreadId: null })
  },
  setCanvasViewportMirror: (zoom, pan) => set({ canvasZoom: zoom, canvasPan: pan }),

  copyPlacement: (spreadId, placeholderId) => {
    const spread = get().project.spreads.find((s) => s.id === spreadId)
    const placement = spread?.placements.find((p) => p.placeholderId === placeholderId)
    if (!placement || !placement.photoId) return
    const { placeholderId: _ignored, ...rest } = placement
    set({ photoClipboard: { photoId: placement.photoId, placement: rest } })
  },

  pastePlacement: (spreadId, placeholderIds) => {
    const clip = get().photoClipboard
    if (!clip) return
    get().updateMultiplePlacements(spreadId, placeholderIds, { ...clip.placement, photoId: clip.photoId })
  },

  cutPlacement: (spreadId, placeholderId) => {
    get().copyPlacement(spreadId, placeholderId)
    get().setPlacementPhoto(spreadId, placeholderId, null)
  },

  copySpread: (spreadId) => {
    const spread = get().project.spreads.find((s) => s.id === spreadId)
    if (!spread || spread.isCover) return
    const { templateId, placements, textBoxes, backgroundColor, backgroundPattern, backgroundHidden, gapPx, marginPx, pageSide, customBoxes, flipped, guides } = spread
    set({ spreadClipboard: { templateId, placements, textBoxes, backgroundColor, backgroundPattern, backgroundHidden, gapPx, marginPx, pageSide, customBoxes, flipped, guides } })
  },

  pasteSpreadAfter: (afterSpreadId) =>
    withHistory(set, (p) => {
      const clip = get().spreadClipboard
      const target = p.spreads.find((s) => s.id === afterSpreadId)
      if (!clip || !target || target.isCover) return p
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      const index = interior.findIndex((s) => s.id === afterSpreadId)
      const pasted: Spread = {
        id: uuid(),
        order: 0,
        pageSide: clip.pageSide,
        templateId: clip.templateId,
        placements: clip.placements.map((pl) => ({ ...pl })),
        textBoxes: clip.textBoxes.map((t) => ({ ...t, id: uuid() })),
        backgroundColor: clip.backgroundColor,
        backgroundPattern: clip.backgroundPattern,
        backgroundHidden: clip.backgroundHidden,
        gapPx: clip.gapPx,
        marginPx: clip.marginPx,
        customBoxes: clip.customBoxes?.map((box) => ({ ...box })),
        flipped: clip.flipped,
        isCover: false,
        guides: { horizontal: [...clip.guides.horizontal], vertical: [...clip.guides.vertical] },
      }
      interior.splice(index + 1, 0, pasted)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      const cover = p.spreads.find((s) => s.isCover)
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    }),

  cutSpread: (spreadId) => {
    get().copySpread(spreadId)
    get().deleteSpread(spreadId)
  },

  // "Convert to Single Page/Side" in the reference app's Spread context menu — toggles between a
  // two-page spread and treating it as one single page, reusing the Inspector's own "Page side"
  // setting rather than being a separate feature.
  convertSpreadPageType: (spreadId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id === spreadId ? { ...s, pageSide: s.pageSide === 'spread' ? 'single' : 'spread' } : s
      ),
    })),

  // The cover (if any) is excluded from all three of these — it's pinned at order -1 and never
  // renumbered or moved by interior-page operations. Indices here are positions within the
  // interior (non-cover) list, matching what the Spreads panel's own draggable list shows.
  reorderSpreads: (fromIndex, toIndex) =>
    withHistory(set, (p) => {
      const cover = p.spreads.find((s) => s.isCover)
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
        if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= interior.length || toIndex >= interior.length || fromIndex === toIndex) return p
      const [moved] = interior.splice(fromIndex, 1)
      interior.splice(toIndex, 0, moved)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    }),

  splitSpread: (spreadId, cutIndex) =>
    withHistory(set, (p) => {
      const cover = p.spreads.find((s) => s.isCover)
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      const index = interior.findIndex((s) => s.id === spreadId)
      if (index === -1) return p
      if (cutIndex !== undefined && (!Number.isInteger(cutIndex) || cutIndex < 1 || cutIndex >= interior[index].placements.length)) return p
      const [left, right] = splitSpreadIntoPages(interior[index], cutIndex)
      interior.splice(index, 1, left, right)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    }),

  moveTimelinePhoto: (sourceSpreadId, frameId, targetSpreadId, beforeFrameId) => withHistory(set, (p) => {
    const source = p.spreads.find((s) => s.id === sourceSpreadId && !s.isCover)
    const target = targetSpreadId === null && source ? buildSpreadFromPlacements([], 'spread', source) : p.spreads.find((s) => s.id === targetSpreadId && !s.isCover)
    const placement = source?.placements.find((pl) => pl.placeholderId === frameId)
    if (!source || !target || !placement?.photoId || (source === target && beforeFrameId === frameId)) return p
    if (beforeFrameId && !target.placements.some((pl) => pl.placeholderId === beforeFrameId)) return p
    const allSpreads = targetSpreadId === null ? [...p.spreads, { ...target, order: p.spreads.filter((s) => !s.isCover).length }] : p.spreads
    let changed = targetSpreadId === null
    const spreads = allSpreads.map((s) => {
      if (s.id !== sourceSpreadId && s.id !== target.id) return s
      const next = s.placements.filter((pl) => pl.photoId && !(s.id === sourceSpreadId && pl.placeholderId === frameId))
      if (s.id === target.id) {
        const index = beforeFrameId ? next.findIndex((pl) => pl.placeholderId === beforeFrameId) : -1
        next.splice(index < 0 ? next.length : index, 0, placement)
      }
      if (next.length === s.placements.length && next.every((pl, i) => pl === s.placements[i])) return s
      changed = true
      return { ...buildSpreadFromPlacements(next, s.pageSide, s), id: s.id, textBoxes: s.textBoxes, order: s.order }
    })
    return changed ? { ...p, spreads } : p
  }),

  insertTimelinePhotos: (photoIds, targetSpreadId, beforeFrameId) => withHistory(set, (p) => {
    const validIds = [...new Set(photoIds)].filter((id) => p.photos.some((photo) => photo.id === id))
    if (!validIds.length) return p
    const target = targetSpreadId === null ? createBlankSpread(p.spreads.filter((s) => !s.isCover).length, {
      backgroundColor: p.defaultBackgroundColor, gapPx: p.defaultGapPx, marginPx: p.defaultMarginPx,
      borderWidth: p.defaultBorderWidth, borderColor: p.defaultBorderColor,
    }) : p.spreads.find((s) => s.id === targetSpreadId && !s.isCover)
    if (!target || (beforeFrameId && !target.placements.some((pl) => pl.placeholderId === beforeFrameId))) return p
    const placements = target.placements.filter((pl) => pl.photoId)
    const at = beforeFrameId ? placements.findIndex((pl) => pl.placeholderId === beforeFrameId) : placements.length
    placements.splice(at < 0 ? placements.length : at, 0, ...validIds.map((id) => defaultPlacement(uuid(), id, { width: p.defaultBorderWidth, color: p.defaultBorderColor })))
    const updated = { ...buildSpreadFromPlacements(placements, target.pageSide, target), id: target.id, order: target.order, textBoxes: target.textBoxes }
    return { ...p, spreads: targetSpreadId === null ? [...p.spreads, updated] : p.spreads.map((s) => s.id === target.id ? updated : s) }
  }),

  mergeWithNext: (spreadId) =>
    withHistory(set, (p) => {
      const cover = p.spreads.find((s) => s.isCover)
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      const index = interior.findIndex((s) => s.id === spreadId)
      if (index === -1 || index === interior.length - 1) return p
      const merged = mergeSpreads(interior[index], interior[index + 1])
      interior.splice(index, 2, merged)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    }),

  flipSpread: (spreadId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? flipSpreadHorizontally(s) : s)),
    })),

  addBlankSpread: () =>
    withHistory(set, (p) => {
      const appearance = {
        backgroundColor: p.defaultBackgroundColor,
        gapPx: p.defaultGapPx,
        marginPx: p.defaultMarginPx,
        borderWidth: p.defaultBorderWidth,
        borderColor: p.defaultBorderColor,
      }
      const interiorCount = p.spreads.filter((s) => !s.isCover).length
      const spread = createBlankSpread(interiorCount, appearance)
      return { ...p, spreads: [...p.spreads, spread] }
    }),

  addCoverSpread: () =>
    withHistory(set, (p) => {
      if (p.spreads.some((s) => s.isCover)) return p
      const appearance = {
        backgroundColor: p.defaultBackgroundColor,
        gapPx: p.defaultGapPx,
        marginPx: p.defaultMarginPx,
        borderWidth: p.defaultBorderWidth,
        borderColor: p.defaultBorderColor,
      }
      return { ...p, spreads: [createCoverSpread(appearance), ...p.spreads] }
    }),

  configureCover: (size, details, photoIds = []) => {
    const error = validateCoverSize(size, get().project.size)
    if (error) throw new Error(error)
    if (![details.wrapIn, details.spineIn].every((n) => Number.isFinite(n) && n >= 0) || details.wrapIn * 2 >= Math.min(size.widthIn, size.heightIn) || details.spineIn >= size.widthIn - details.wrapIn * 2) throw new Error('Wrap and spine must fit within the cover dimensions.')
    withHistory(set, (p) => {
      const existing = p.spreads.find((s) => s.isCover)
      const cover = existing ?? createCoverSpread({ backgroundColor: p.defaultBackgroundColor, gapPx: p.defaultGapPx, marginPx: p.defaultMarginPx, borderWidth: p.defaultBorderWidth, borderColor: p.defaultBorderColor })
      const validIds = photoIds.filter((id) => p.photos.some((photo) => photo.id === id))
      const seed = (!existing || cover.placements.length === 0) && validIds.length > 0 ? {
        customBoxes: validIds.map((_, i) => ({ id: uuid(), x: i / validIds.length, y: 0, width: 1 / validIds.length, height: 1, preferredOrientation: 'any' as const })),
      } : null
      const placements = seed ? seed.customBoxes.map((box, i) => defaultPlacement(box.id, validIds[i])) : cover.placements.map((pl, i) => validIds[i] ? { ...pl, photoId: validIds[i] } : pl)
      const updated = { ...cover, size, coverDetails: details, placements, ...seed, ...(!existing && validIds.length === 0 ? { customBoxes: [], placements: [] } : {}) }
      return { ...p, spreads: [updated, ...p.spreads.filter((s) => !s.isCover)] }
    })
    const cover = get().project.spreads.find((s) => s.isCover)
    if (cover) get().enterDesignerView(cover.id)
  },

  duplicateSpread: (spreadId) =>
    withHistory(set, (p) => {
      const source = p.spreads.find((s) => s.id === spreadId)
      if (!source || source.isCover) return p
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      const index = interior.findIndex((s) => s.id === spreadId)
      const copy: Spread = {
        ...source,
        id: uuid(),
        placements: source.placements.map((pl) => ({ ...pl })),
        textBoxes: source.textBoxes.map((t) => ({ ...t, id: uuid() })),
      }
      interior.splice(index + 1, 0, copy)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      const cover = p.spreads.find((s) => s.isCover)
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    }),

  deleteSpread: (spreadId) => {
    withHistory(set, (p) => {
      const target = p.spreads.find((s) => s.id === spreadId)
      if (!target) return p
      if (target.isCover) return { ...p, spreads: p.spreads.filter((s) => s.id !== spreadId) }
      const interior = p.spreads.filter((s) => !s.isCover && s.id !== spreadId).sort((a, b) => a.order - b.order)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      const cover = p.spreads.find((s) => s.isCover)
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    })
    if (get().selectedSpreadId === spreadId) {
      set({ selectedSpreadId: null, selectedPlaceholderId: null, selectedTextBoxId: null, selectedLayerKeys: [], multiSelectedPlaceholderIds: [] })
    }
  },

  applyTemplateToSpread: (spreadId, templateId, keepOrder = true, scope = 'spread') =>
    withHistory(set, (p) => {
      const spreads = p.spreads.map((s) => (s.id === spreadId ? applyPageTemplate(s, templateId, p.photos, (s.size ?? p.size).widthIn / (s.size ?? p.size).heightIn, keepOrder, scope) : s))
      return spreads.some((spread, i) => spread !== p.spreads[i]) ? { ...p, spreads } : p
    }),

  cycleSpreadTemplate: (spreadId, direction) => {
    const { project, userTemplates, templateFrameFilter } = get()
    const spread = project.spreads.find((item) => item.id === spreadId)
    if (!spread || spread.isCover || !spread.placements.length) return
    const eligible=pagePlacements(spread,(spread.size??project.size).widthIn/(spread.size??project.size).heightIn,'spread')
    const count=eligible.filter(p=>p.photoId).length||eligible.length
    if(!count)return
    const candidates = [...templatesForCount(count, project.enabledTemplateIds, templateFrameFilter, (spread.size ?? project.size).widthIn / (spread.size ?? project.size).heightIn)]
    if (candidates.length < 2) return
    const current = candidates.findIndex((template) => template.id === spread.templateId)
    const next = current < 0 ? (direction > 0 ? 0 : candidates.length - 1) : (current + direction + candidates.length) % candidates.length
    get().applyTemplateToSpread(spreadId, candidates[next].id)
    if (get().selectedSpreadId === spreadId) set({ selectedPlaceholderId: null, selectedTextBoxId: null, selectedLayerKeys: [], multiSelectedPlaceholderIds: [] })
  },

  applyTemplateToAllSpreads: (templateId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => s.isCover ? s : applyPageTemplate(s,templateId,p.photos,(s.size??p.size).widthIn/(s.size??p.size).heightIn,true,'spread')),
    })),

  updateSpread: (spreadId, patch) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? { ...s, ...patch } : s)),
    })),

  applyBackgroundToAllSpreads: (spreadId, pattern) => withHistory(set, (p) => {
    const source = p.spreads.find((s) => s.id === spreadId)
    if (!source) return p
    return { ...p, spreads: p.spreads.map((s) => s.isCover ? s : { ...s, backgroundColor: source.backgroundColor, backgroundPattern: pattern ?? source.backgroundPattern }) }
  }),

  makePhotoBackground: (spreadId, frameId) => {
    withHistory(set, p => {
      const photos = [...p.photos]
      const spreads = p.spreads.map(s => {
        if (s.id !== spreadId) return s
        const selected = s.placements.find(pl => pl.placeholderId === frameId)
        const photo = photos.find(photo => photo.id === selected?.photoId)
        if (!photo || !selected) return s
        const previous = s.backgroundPattern?.mode === 'cover' ? s.backgroundPattern : undefined
        let previousPhoto = previous && (photos.find(p => p.id === previous.edits?.photoId) ?? photos.find(p => p.src === previous.src))
        if (previous && !previousPhoto) {
          const width = previous.width ?? photo.width, height = previous.height ?? photo.height
          previousPhoto = { ...photo, id: uuid(), src: previous.src, fileName: previous.name, sourcePath: undefined, width, height, megapixels: width * height / 1000000, orientation: width === height ? 'square' : width > height ? 'landscape' : 'portrait', bins: [], favorite: false }
          photos.push(previousPhoto)
        }
        const backgroundPattern = { name: photo.fileName, src: photo.src, tileSizePx: DESIGN_WIDTH, mode: 'cover' as const, width: photo.width, height: photo.height, edits: { ...selected } }
        if (previousPhoto) return { ...s, backgroundPattern, placements: s.placements.map(pl => pl.placeholderId === frameId ? { ...defaultPlacement(frameId, previousPhoto.id), ...previous?.edits, placeholderId: frameId, photoId: previousPhoto.id } : pl) }
        const size = s.size ?? p.size, height = DESIGN_WIDTH * size.heightIn / size.widthIn
        return { ...s, backgroundPattern, flipped: false,
          customBoxes: computePlaceholderBoxes(s, DESIGN_WIDTH, height).filter(b => b.placeholderId !== frameId).map(b => ({ id: b.placeholderId, x: b.x / DESIGN_WIDTH, y: b.y / height, width: b.width / DESIGN_WIDTH, height: b.height / height, preferredOrientation: 'any' as const })),
          placements: s.placements.filter(pl => pl.placeholderId !== frameId) }
        })
      return { ...p, photos, spreads }
    })
    get().selectPlaceholder(null)
  },

  detachBackground: (spreadId) => withHistory(set, p => {
    const photos = [...p.photos]
    const spreads = p.spreads.map(s => {
      const bg = s.backgroundPattern
      if (s.id !== spreadId || bg?.mode !== 'cover') return s
      let photo = photos.find(a => a.id === bg.edits?.photoId) ?? photos.find(a => a.src === bg.src)
      if (!photo) {
        const width = bg.width ?? 1, height = bg.height ?? 1
        photo = { id: uuid(), src: bg.src, fileName: bg.name, width, height, megapixels: width*height/1000000, orientation: width===height?'square':width>height?'landscape':'portrait', bins: [], favorite: false, mimeType: 'image/jpeg', capturedAt: new Date().toISOString() }
        photos.push(photo)
      }
      const id = uuid(), size = s.size ?? p.size, height = DESIGN_WIDTH*size.heightIn/size.widthIn
      const boxes = computePlaceholderBoxes(s, DESIGN_WIDTH, height).map(b => ({id:b.placeholderId,x:b.x/DESIGN_WIDTH,y:b.y/height,width:b.width/DESIGN_WIDTH,height:b.height/height,preferredOrientation:'any' as const}))
      return {...s, backgroundPattern:undefined, flipped:false, customBoxes:[{id,x:0,y:0,width:1,height:1,preferredOrientation:'any' as const},...boxes], placements:[{...defaultPlacement(id,photo.id),...bg.edits,placeholderId:id,photoId:photo.id},...s.placements]}
    })
    return {...p,photos,spreads}
  }),
  applyExternalSpread: (spreadId, photo) => withHistory(set, p => {
    if (!p.spreads.some(s => s.id === spreadId)) return p
    const frameId = uuid()
    return {...p, photos:[...p.photos,photo], spreads:p.spreads.map(s => s.id !== spreadId ? s : {...s,
      flipped:false, marginPx:0, gapPx:0, backgroundPattern:undefined, textBoxes:[],
      customBoxes:[{id:frameId,x:0,y:0,width:1,height:1,preferredOrientation:'any' as const}],
      placements:[defaultPlacement(frameId,photo.id)]})}
  }),
  relinkPhoto: (photoId, replacement) => withHistory(set, p => {
    const original = p.photos.find(a => a.id === photoId)
    if (!original) return p
    return {...p, photos:p.photos.map(a => a.id===photoId?{...replacement,id:photoId,bins:a.bins,favorite:a.favorite}:a), spreads:p.spreads.map(s => s.backgroundPattern?.mode==='cover' && (s.backgroundPattern.edits?.photoId===photoId || (!s.backgroundPattern.edits?.photoId && s.backgroundPattern.src===original.src)) ? {...s,backgroundPattern:{...s.backgroundPattern,src:replacement.src,name:replacement.fileName,width:replacement.width,height:replacement.height}}:s)}
  }),
  addImageFrame: (spreadId, rect, photoId) => {
    const frameId = uuid()
    const bounded = boundedFrameRect(rect)
    withHistory(set, (p) => ({ ...p, spreads: p.spreads.map((s) => {
      if (s.id !== spreadId) return s
      const size = s.size ?? p.size
      const height = DESIGN_WIDTH * size.heightIn / size.widthIn
      const existing = computePlaceholderBoxes(s, DESIGN_WIDTH, height).map((box) => ({ id: box.placeholderId, x: box.x / DESIGN_WIDTH, y: box.y / height, width: box.width / DESIGN_WIDTH, height: box.height / height, preferredOrientation: 'any' as const }))
      return { ...s, flipped: false, customBoxes: [...existing, { id: frameId, ...bounded, preferredOrientation: 'any' as const }], placements: [...s.placements, { ...defaultPlacement(frameId, photoId && p.photos.some((photo) => photo.id === photoId) ? photoId : null) }] }
    }) }))
    get().selectPlaceholder(frameId)
  },

  updateImageFrame: (spreadId, frameId, rect) => {
    const bounded = boundedFrameRect(rect)
    withHistory(set, (p) => ({ ...p, spreads: p.spreads.map((s) => {
      if (s.id !== spreadId) return s
      const size = s.size ?? p.size
      const height = DESIGN_WIDTH * size.heightIn / size.widthIn
      const customBoxes = computePlaceholderBoxes(s, DESIGN_WIDTH, height).map((box) => ({ id: box.placeholderId, ...(box.placeholderId === frameId ? bounded : { x: box.x / DESIGN_WIDTH, y: box.y / height, width: box.width / DESIGN_WIDTH, height: box.height / height }), preferredOrientation: 'any' as const }))
      return { ...s, flipped: false, customBoxes }
    }) }))
  },

  groupLayers: (spreadId, keys) => {
    const groupId=uuid()
    withHistory(set,p=>{
      const spread=p.spreads.find(s=>s.id===spreadId)
      if(!spread)return p
      const selected=spreadLayers(spread).filter(l=>keys.includes(l.kind+':'+l.id))
      const groups=new Set(selected.map(l=>l.value.groupId).filter(Boolean))
      const members=spreadLayers(spread).filter(l=>keys.includes(l.kind+':'+l.id)||(l.value.groupId&&groups.has(l.value.groupId)))
      if(members.length<2||members.some(l=>l.value.locked||l.value.hidden))return p
      const all=spreadLayers(spread), top=Math.max(...members.map(l=>all.findIndex(a=>a.kind===l.kind&&a.id===l.id)))
      const memberKeys=new Set(members.map(l=>l.kind+':'+l.id))
      const order=[...all.slice(0,top+1).filter(l=>!memberKeys.has(l.kind+':'+l.id)),...members,...all.slice(top+1)]
      const patch=(kind:string,id:string)=>({zIndex:order.findIndex(l=>l.kind===kind&&l.id===id),...(memberKeys.has(kind+':'+id)?{groupId}:{})})
      return {...p,spreads:p.spreads.map(s=>s.id!==spreadId?s:{...s,placements:s.placements.map(l=>({...l,...patch('image',l.placeholderId)})),textBoxes:s.textBoxes.map(l=>({...l,...patch('text',l.id)}))})}
    },true)
    const updated=get().project.spreads.find(s=>s.id===spreadId)
    const first=updated&&spreadLayers(updated).find(l=>l.value.groupId===groupId)
    if(first)first.kind==='image'?get().selectPlaceholder(first.id):get().selectTextBox(first.id)
  },
  ungroupLayers: (spreadId, groupId) => withHistory(set,p=>({...p,spreads:p.spreads.map(s=>s.id!==spreadId?s:{...s,placements:s.placements.map(l=>l.groupId===groupId?{...l,groupId:undefined}:l),textBoxes:s.textBoxes.map(l=>l.groupId===groupId?{...l,groupId:undefined}:l)})})),
  transformGroup: (spreadId, groupId, rect) => {
    const spread=get().project.spreads.find(s=>s.id===spreadId)
    if(spread)get().transformSelection(spreadId,spreadLayers(spread).filter(l=>l.value.groupId===groupId).map(l=>l.kind+':'+l.id),rect)
  },
  transformSelection: (spreadId, keys, rect) => withHistory(set,p=>{
    const spread=p.spreads.find(s=>s.id===spreadId)
    if(!spread||!Object.values(rect).every(Number.isFinite)||rect.width<=0||rect.height<=0)return p
    const updated=transformLayerSelection(spread,p.size,keys,boundedFrameRect(rect))
    return updated===spread?p:{...p,spreads:p.spreads.map(s=>s.id===spreadId?updated:s)}
  }),
  arrangeSelection: (spreadId, keys, mode, target, exactGap, anchor) => withHistory(set,p=>{
    const spread=p.spreads.find(s=>s.id===spreadId)
    if(!spread)return p
    const updated=arrangeLayerSelection(spread,p.size,keys,mode,target,exactGap,anchor)
    return updated===spread?p:{...p,spreads:p.spreads.map(s=>s.id===spreadId?updated:s)}
  }),
  clearLayerFlags: (spreadId, layers, flag) => withHistory(set,p=>{
    const spread=p.spreads.find(s=>s.id===spreadId)
    if(!spread||!layers.length)return p
    const members=layers.flatMap(l=>layerMembers(spread,l.kind,l.id))
    const background=layers.some(l=>l.kind==='background')
    const backgroundFlag=flag==='locked'?'backgroundLocked':'backgroundHidden'
    if(!members.some(l=>l.value[flag])&&!(background&&spread[backgroundFlag]))return p
    const updated={...spread,
      ...(background?{[backgroundFlag]:false}:{}),
      placements:spread.placements.map(l=>l[flag]&&members.some(m=>m.kind==='image'&&m.id===l.placeholderId)?{...l,[flag]:false}:l),
      textBoxes:spread.textBoxes.map(l=>l[flag]&&members.some(m=>m.kind==='text'&&m.id===l.id)?{...l,[flag]:false}:l),
    }
    return {...p,spreads:p.spreads.map(s=>s.id===spreadId?updated:s)}
  },true,true),
  setLayerHidden: (spreadId, kind, id, hidden) => {
    withHistory(set, p => ({...p,spreads:p.spreads.map(s=>{
      if(s.id!==spreadId)return s
      if(kind==='background')return {...s,backgroundHidden:hidden}
      const members=layerMembers(s,kind,id)
      return {...s,placements:s.placements.map(l=>members.some(m=>m.kind==='image'&&m.id===l.placeholderId)?{...l,hidden}:l),textBoxes:s.textBoxes.map(l=>members.some(m=>m.kind==='text'&&m.id===l.id)?{...l,hidden}:l)}
    })}),true,true)
    if (hidden) set({selectedPlaceholderId:null, selectedTextBoxId:null, selectedLayerKeys:[], multiSelectedPlaceholderIds:[]})
  },
  moveLayer: (spreadId, kind, id, targetKind, targetId) => withHistory(set, p => {
    const spread = p.spreads.find(s => s.id === spreadId)
    if (!spread) return p
    const layers = spreadLayers(spread)
    const from = layers.findIndex(l => l.kind === kind && l.id === id)
    const to = layers.findIndex(l => l.kind === targetKind && l.id === targetId)
    if (from < 0 || to < 0 || from === to || layers[from].value.locked) return p
    const moving=layerMembers(spread,kind,id),targets=layerMembers(spread,targetKind,targetId)
    if(moving.some(l=>l.value.locked)||targets.some(t=>moving.some(m=>m.kind===t.kind&&m.id===t.id)))return p
    const rest=layers.filter(l=>!moving.some(m=>m.kind===l.kind&&m.id===l.id))
    const targetIndices=rest.map((l,i)=>targets.some(t=>t.kind===l.kind&&t.id===l.id)?i:-1).filter(i=>i>=0)
    rest.splice(from<to?Math.max(...targetIndices)+1:Math.min(...targetIndices),0,...moving)
    layers.splice(0,layers.length,...rest)
    return {...p, spreads:p.spreads.map(s => s.id !== spreadId ? s : {...s,
      placements:s.placements.map(pl=>({...pl,zIndex:layers.findIndex(l=>l.kind==='image'&&l.id===pl.placeholderId)})),
      textBoxes:s.textBoxes.map(t=>({...t,zIndex:layers.findIndex(l=>l.kind==='text'&&l.id===t.id)})),
    })}
  }, true),
  setLayerLocked: (spreadId, kind, id, locked) => withHistory(set,p=>({...p,spreads:p.spreads.map(s=>{
    if(s.id!==spreadId)return s
    if(kind==='background')return {...s,backgroundLocked:locked}
    const members=layerMembers(s,kind,id)
    return {...s,placements:s.placements.map(l=>members.some(m=>m.kind==='image'&&m.id===l.placeholderId)?{...l,locked}:l),textBoxes:s.textBoxes.map(l=>members.some(m=>m.kind==='text'&&m.id===l.id)?{...l,locked}:l)}
  })}),true,true),
  removeImageFrame: (spreadId, frameId) => {
    withHistory(set, (p) => ({ ...p, spreads: p.spreads.map((s) => {
      if (s.id !== spreadId) return s
      const size = s.size ?? p.size
      const height = DESIGN_WIDTH * size.heightIn / size.widthIn
      return { ...s, flipped: false, customBoxes: computePlaceholderBoxes(s, DESIGN_WIDTH, height).filter((box) => box.placeholderId !== frameId).map((box) => ({ id: box.placeholderId, x: box.x / DESIGN_WIDTH, y: box.y / height, width: box.width / DESIGN_WIDTH, height: box.height / height, preferredOrientation: 'any' as const })), placements: s.placements.filter((pl) => pl.placeholderId !== frameId) }
    }) }))
    get().selectPlaceholder(null)
  },

  setPlacementPhoto: (spreadId, placeholderId, photoId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : {
              ...s,
              placements: s.placements.map((pl) => (pl.placeholderId === placeholderId ? { ...pl, photoId } : pl)),
            }
      ),
    })),

  swapPlacements: (spreadId, placeholderIdA, placeholderIdB) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => {
        if (s.id !== spreadId) return s
        const a = s.placements.find((pl) => pl.placeholderId === placeholderIdA)
        const b = s.placements.find((pl) => pl.placeholderId === placeholderIdB)
        if (!a || !b) return s
        return {
          ...s,
          placements: s.placements.map((pl) => {
            if (pl.placeholderId === placeholderIdA) return { ...b, placeholderId: placeholderIdA }
            if (pl.placeholderId === placeholderIdB) return { ...a, placeholderId: placeholderIdB }
            return pl
          }),
        }
      }),
    })),

  updatePlacement: (spreadId, placeholderId, patch) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : {
              ...s,
              placements: s.placements.map((pl) =>
                pl.placeholderId === placeholderId ? { ...pl, ...patch } : pl
              ),
            }
      ),
    })),

  resetPlacementToOriginal: (spreadId, placeholderId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : {
              ...s,
              placements: s.placements.map((pl) =>
                pl.placeholderId !== placeholderId
                  ? pl
                  : {
                      ...pl,
                      focalX: 0.5,
                      focalY: 0.5,
                      zoom: 1,
                      borderWidth: 0,
                      borderColor: '#ffffff',
                      opacity: 1,
                      warmth: 0,
                      brightness: 0,
                      contrast: 0,
                      saturation: 0,
                      frameStyle: 'none',
                      rotationDeg: 0,
                      relightIntensity: 0,
                      cornerRadiusPx: 24,
                      blackWhiteMix: undefined,
                      flipHorizontal: false,
                      flipVertical: false,
                    }
              ),
            }
      ),
    })),

  updateMultiplePlacements: (spreadId, placeholderIds, patch) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : {
              ...s,
              placements: s.placements.map((pl) =>
                placeholderIds.includes(pl.placeholderId) ? { ...pl, ...patch } : pl
              ),
            }
      ),
    })),

  copyToneAdjustments: (spreadId, placeholderId) => {
    const spread = get().project.spreads.find((s) => s.id === spreadId)
    const placement = spread?.placements.find((pl) => pl.placeholderId === placeholderId)
    if (!placement) return
    const {
      opacity,
      warmth,
      brightness,
      contrast,
      saturation,
      relightIntensity,
      borderWidth,
      borderColor,
      frameStyle,
      rotationDeg,
      cornerRadiusPx,
    } = placement
    set({
      toneClipboard: {
        blackWhiteMix: placement.blackWhiteMix,
        opacity,
        warmth,
        brightness,
        contrast,
        saturation,
        relightIntensity,
        borderWidth,
        borderColor,
        frameStyle,
        rotationDeg,
        cornerRadiusPx,
      },
    })
  },

  pasteToneAdjustments: (spreadId, placeholderIds) => {
    const clip = get().toneClipboard
    if (!clip) return
    get().updateMultiplePlacements(spreadId, placeholderIds, clip)
  },

  autoAlignPlacement: (spreadId, placeholderId) =>
    get().updatePlacement(spreadId, placeholderId, { focalX: 0.5, focalY: 0.5, zoom: 1 }),

  autoAdjustPlacement: (spreadId, placeholderId) => get().autoEnhanceImages([{spreadId,frameId:placeholderId}]),

  autoEnhanceImages: async (targets) => {
    const project = get().project
    const corrections = new Map<string, Awaited<ReturnType<typeof computeAutoAdjust>>>()
    const changes: {spreadId:string;frameId?:string;adjustment:Awaited<ReturnType<typeof computeAutoAdjust>>}[] = []
    for (const target of targets) {
      const spread = project.spreads.find(s => s.id === target.spreadId)
      const placement = spread?.placements.find(p => p.placeholderId === target.frameId)
      const background = !target.frameId && spread?.backgroundPattern?.mode === 'cover' ? spread.backgroundPattern : undefined
      const src = background?.src ?? project.photos.find(p => p.id === placement?.photoId)?.src
      if (!src) continue
      if (!corrections.has(src)) corrections.set(src, await computeAutoAdjust(src))
      changes.push({...target, adjustment: corrections.get(src)!})
    }
    if (get().project !== project) throw new Error('The album changed while enhancing. Please try again.')
    if (!changes.length) return
    withHistory(set, p => ({...p, spreads:p.spreads.map(s => {
      const edits = changes.filter(c => c.spreadId === s.id)
      const bg = edits.find(c => !c.frameId)
      return {...s, placements:s.placements.map(pl => {
        const edit = edits.find(c => c.frameId === pl.placeholderId)
        return edit ? {...pl,...edit.adjustment} : pl
      }), backgroundPattern:bg && s.backgroundPattern ? {...s.backgroundPattern,edits:{...defaultPlacement('background',null),...s.backgroundPattern.edits,...bg.adjustment}} : s.backgroundPattern}
    })}))
  },

  unlockTextBoxes: (spreadId, textIds) => withHistory(set, p => {
    const spread = p.spreads.find(s => s.id === spreadId)
    if (!spread?.textBoxes.some(t => textIds.includes(t.id) && t.locked)) return p
    return { ...p, spreads: p.spreads.map(s => s.id !== spreadId ? s : { ...s, textBoxes: s.textBoxes.map(t => textIds.includes(t.id) ? { ...t, locked: false } : t) }) }
  }, true),

  autoFitTextBoxes: (spreadId, textIds) =>
    withHistory(set, p => ({ ...p, spreads: p.spreads.map(s => s.id !== spreadId ? s : {
      ...s, textBoxes: s.textBoxes.map(t => textIds.includes(t.id) && !t.locked && !t.hidden
        ? fitTextBoxSize({ ...t, autoWidth: true }, s.size ?? p.size) : t),
    }) })),

  addTextBox: (spreadId, box) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? { ...s, textBoxes: [...s.textBoxes, fitTextBoxSize({ ...box, autoWidth: box.autoWidth ?? true }, s.size ?? p.size)] } : s)),
    })),

  updateTextBox: (spreadId, textBoxId, patch) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : { ...s, textBoxes: s.textBoxes.map((t) => (t.id === textBoxId ? (['text', 'fontFamily', 'fontSize', 'bold', 'italic', 'width', 'autoWidth'].some(key => key in patch) ? fitTextBoxSize({ ...t, ...patch, autoWidth: 'width' in patch ? false : patch.autoWidth ?? t.autoWidth }, s.size ?? p.size) : { ...t, ...patch }) : t)) }
      ),
    })),

  removeTextBox: (spreadId, textBoxId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId ? s : { ...s, textBoxes: s.textBoxes.filter((t) => t.id !== textBoxId) }
      ),
    })),

  saveSpreadAsTemplate: async (spreadId, name) => {
    const { project } = get()
    const spread = project.spreads.find((s) => s.id === spreadId)
    if (!spread) return
    const base = findTemplate(spread.templateId)
    const placeholders = spread.customBoxes ?? (base
      ? base.placeholders
      : spread.placements.map((pl) => ({
          id: pl.placeholderId,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          preferredOrientation: 'any' as const,
        })))

    const firstPhotoId = spread.placements.find((pl) => pl.photoId)?.photoId
    const firstPhoto = firstPhotoId ? project.photos.find((p) => p.id === firstPhotoId) : undefined
    const thumbnailImage = firstPhoto ? await blobUrlToDataUrl(firstPhoto.src).catch(() => undefined) : undefined

    const template: TemplateDefinition = {
      id: uuid(),
      name,
      photoCount: spread.placements.length,
      pageSide: spread.pageSide,
      placeholders,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      thumbnailColor: '#8a6fd1',
      thumbnailImage,
    }
    const next = [...get().userTemplates, template]
    saveUserTemplates(next)
    set({ userTemplates: next })
  },

  importTemplateFromPhoto: async (name, baseTemplateId, photoDataUrl) => {
    const base = findTemplate(baseTemplateId)
    if (!base) return
    const template: TemplateDefinition = {
      id: uuid(),
      name,
      photoCount: base.photoCount,
      pageSide: base.pageSide,
      placeholders: base.placeholders,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      thumbnailColor: '#8a6fd1',
      thumbnailImage: photoDataUrl,
    }
    const next = [...get().userTemplates, template]
    saveUserTemplates(next)
    set({ userTemplates: next })
  },

  deleteUserTemplate: (id) => {
    const next = get().userTemplates.filter((t) => t.id !== id)
    saveUserTemplates(next)
    set({ userTemplates: next })
  },

  setAutoLayoutOptions: (opts) => set((s) => ({ autoLayoutOptions: { ...s.autoLayoutOptions, ...opts } })),

  allTemplates: () => uniqueTemplates([...BUILT_IN_TEMPLATES, ...get().userTemplates]),

  undo: (keepTemplateBrowser = false) =>
    set((s) => {
      if (s.history.length === 0) return s
      const prev = s.history[s.history.length - 1]
      return { project: prev, history: s.history.slice(0, -1), future: [s.project, ...s.future], isDirty: true, matchingTemplatesOpen: keepTemplateBrowser && s.matchingTemplatesOpen, templatePreview: null }
    }),

  redo: (keepTemplateBrowser = false) =>
    set((s) => {
      if (s.future.length === 0) return s
      const [next, ...rest] = s.future
      return { project: next, history: [...s.history, s.project], future: rest, isDirty: true, matchingTemplatesOpen: keepTemplateBrowser && s.matchingTemplatesOpen, templatePreview: null }
    }),

  renameProject: (name) => withHistory(set, (p) => ({ ...p, name })),
  updateProjectMeta: (patch) => withHistory(set, (p) => ({ ...p, ...patch })),
  updateProjectSettings: (patch) => withHistory(set, (p) => ({ ...p, ...patch })),

  loadProjectFile: (file) => {
    get().closeMatchingTemplates()
    saveUserTemplates(file.userTemplates)
    // Older saved project files predate these fields — default them so opening one doesn't
    // crash the UI that reads them.
    const project: Project = {
      ...file.project,
      eventType: file.project.eventType ?? 'Wedding',
      community: file.project.community ?? '',
      clientName: file.project.clientName ?? '',
      units: file.project.units ?? 'in',
      colorProfile: file.project.colorProfile ?? 'sRGB',
      defaultBackgroundColor: file.project.defaultBackgroundColor ?? '#ffffff',
      defaultGapPx: file.project.defaultGapPx ?? 8,
      defaultMarginPx: file.project.defaultMarginPx ?? 24,
      defaultBorderWidth: file.project.defaultBorderWidth ?? 0,
      defaultBorderColor: file.project.defaultBorderColor ?? '#ffffff',
      enabledTemplateIds: file.project.enabledTemplateIds ?? null,
      layoutStart: file.project.layoutStart ?? 'spread',
      layoutEnd: file.project.layoutEnd ?? 'spread',
      includeFullSpreadTemplates: file.project.includeFullSpreadTemplates ?? true,
      kind: file.project.kind ?? 'album',
      slideDurationMs: file.project.slideDurationMs ?? 4000,
      size: migrateAlbumSize(file.project.size),
      photos: file.project.photos.map((photo) => ({ ...photo, bins: photo.bins ?? [], favorite: photo.favorite ?? false })),
      spreads: file.project.spreads.map((spread) => ({
        ...spread,
        flipped: spread.flipped ?? false,
        isCover: spread.isCover ?? false,
        guides: spread.guides ?? { horizontal: [], vertical: [] },
        placements: spread.placements.map((p) => ({
          ...p,
          cornerRadiusPx: p.cornerRadiusPx ?? 24,
          flipHorizontal: p.flipHorizontal ?? false,
          flipVertical: p.flipVertical ?? false,
        })),
      })),
    }
    set({
      project,
      userTemplates: file.userTemplates,
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
      // A just-opened project has no edits yet relative to the file it came from. The caller
      // (wherever it knows the on-disk path — loadProjectFile itself isn't handed one) follows up
      // with setCurrentFilePath once it does.
      isDirty: false,
      currentFilePath: null,
    })
  },

  newProjectFile: () =>
    set({
      matchingTemplatesOpen: false,
      fontPreview: null,
      templatePreview: null,
      project: newProject({ name: 'Untitled Album' }),
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
      isDirty: false,
      currentFilePath: null,
    }),

  createProjectFromWizard: (opts) => {
    get().closeMatchingTemplates()
    const project = newProject(opts)
    set({
      project,
      leftPanelOpen: false,
      rightPanelOpen: false,
      bottomPanelOpen: false,
      designerViewSpreadId: null,
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
      // Starts dirty — it exists only in memory until the New Project flow's immediate save
      // prompt (finishNewProjectSetup) succeeds and calls markSaved()/setCurrentFilePath().
      isDirty: true,
      currentFilePath: null,
    })
  },

  createSimpleProject: (kind, name, clientName) =>
    set({
      matchingTemplatesOpen: false,
      fontPreview: null,
      templatePreview: null,
      project: newProject({ name, kind, clientName }),
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      selectedLayerKeys: [], multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
      isDirty: false,
      currentFilePath: null,
    }),

  reorderPhotos: (fromIndex, toIndex) =>
    withHistory(set, (p) => {
      const photos = [...p.photos]
      const [moved] = photos.splice(fromIndex, 1)
      photos.splice(toIndex, 0, moved)
      return { ...p, photos }
    }),

  setSlideDuration: (ms) => withHistory(set, (p) => ({ ...p, slideDurationMs: Math.max(500, ms) })),

  setPhotoBins: (photoId, bins) =>
    withHistory(set, (p) => ({
      ...p,
      photos: p.photos.map((photo) => (photo.id === photoId ? { ...photo, bins } : photo)),
    })),

  setPhotoFavorite: (photoId, favorite) =>
    withHistory(set, (p) => ({
      ...p,
      photos: p.photos.map((photo) => (photo.id === photoId ? { ...photo, favorite } : photo)),
    })),
}))
