import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { Project, PhotoAsset, Spread, TemplateDefinition, TextBox, ToneAdjustments, ProjectFile } from '@/types'
import {
  autoBuildSpreads,
  DEFAULT_AUTO_LAYOUT_OPTIONS,
  AutoLayoutOptions,
  retemplateSpread,
  splitSpreadIntoPages,
  mergeSpreads,
  flipSpreadHorizontally,
  createBlankSpread,
  createCoverSpread,
} from '@/engine/autoLayout'
import { BUILT_IN_TEMPLATES, findTemplate, setUserTemplateRegistry } from '@/engine/templates'
import { DEFAULT_ALBUM_SIZE } from '@/engine/albumSizes'
import { blobUrlToDataUrl } from '@/engine/projectFile'

const TEMPLATE_LIBRARY_KEY = 'albumstudio.templateLibrary'

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

export interface NewProjectOptions {
  name: string
  size: Project['size']
  units: Project['units']
  colorProfile: string
  defaultBackgroundColor: string
  defaultGapPx: number
  defaultMarginPx: number
  enabledTemplateIds: string[] | null
}

function newProject(opts: Partial<NewProjectOptions> & { name: string }): Project {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    name: opts.name,
    size: opts.size ?? DEFAULT_ALBUM_SIZE,
    photos: [],
    spreads: [],
    createdAt: now,
    updatedAt: now,
    eventType: 'Wedding',
    community: '',
    clientName: '',
    units: opts.units ?? 'in',
    colorProfile: opts.colorProfile ?? 'sRGB',
    defaultBackgroundColor: opts.defaultBackgroundColor ?? '#ffffff',
    defaultGapPx: opts.defaultGapPx ?? 8,
    defaultMarginPx: opts.defaultMarginPx ?? 24,
    enabledTemplateIds: opts.enabledTemplateIds ?? null,
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
  multiSelectedPlaceholderIds: string[]
  /** Photo dock multi-select, for the click-to-select / click-to-place workflow. */
  selectedPhotoIds: string[]
  lastClickedPhotoId: string | null
  toneClipboard: ToneAdjustments | null
  showGrid: boolean
  showPrintGuides: boolean
  /** Left (Import/Spreads), right (Inspector/Templates), and bottom (Photo Dock) panel
   *  visibility — pure UI chrome, not project data, but kept here alongside showGrid/
   *  showPrintGuides since the same components (MenuBar's View menu) need to read/toggle it. */
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  bottomPanelOpen: boolean
  autoLayoutOptions: AutoLayoutOptions
  history: Project[]
  future: Project[]

  addPhotos: (photos: PhotoAsset[]) => void
  runAutoBuild: () => void
  selectSpread: (id: string | null) => void
  selectPlaceholder: (id: string | null) => void
  selectTextBox: (id: string | null) => void
  toggleMultiSelectPlaceholder: (id: string) => void
  clearMultiSelect: () => void
  setSelectedPhotoIds: (ids: string[], lastClicked: string | null) => void
  togglePhotoSelection: (photoId: string, allPhotoIdsInOrder: string[], mode: 'single' | 'toggle' | 'range') => void
  toggleGrid: () => void
  togglePrintGuides: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleBottomPanel: () => void
  reorderSpreads: (fromIndex: number, toIndex: number) => void
  splitSpread: (spreadId: string) => void
  mergeWithNext: (spreadId: string) => void
  flipSpread: (spreadId: string) => void
  addBlankSpread: () => void
  addCoverSpread: () => void
  duplicateSpread: (spreadId: string) => void
  deleteSpread: (spreadId: string) => void
  applyTemplateToSpread: (spreadId: string, templateId: string) => void
  applyTemplateToAllSpreads: (templateId: string) => void
  updateSpread: (spreadId: string, patch: Partial<Spread>) => void
  setPlacementPhoto: (spreadId: string, placeholderId: string, photoId: string | null) => void
  swapPlacements: (spreadId: string, placeholderIdA: string, placeholderIdB: string) => void
  updatePlacement: (spreadId: string, placeholderId: string, patch: Partial<Spread['placements'][number]>) => void
  resetPlacementToOriginal: (spreadId: string, placeholderId: string) => void
  updateMultiplePlacements: (spreadId: string, placeholderIds: string[], patch: Partial<Spread['placements'][number]>) => void
  copyToneAdjustments: (spreadId: string, placeholderId: string) => void
  pasteToneAdjustments: (spreadId: string, placeholderIds: string[]) => void
  addTextBox: (spreadId: string, box: TextBox) => void
  updateTextBox: (spreadId: string, textBoxId: string, patch: Partial<TextBox>) => void
  removeTextBox: (spreadId: string, textBoxId: string) => void
  saveSpreadAsTemplate: (spreadId: string, name: string) => Promise<void>
  importTemplateFromPhoto: (name: string, baseTemplateId: string, photoDataUrl: string) => Promise<void>
  deleteUserTemplate: (id: string) => void
  setAutoLayoutOptions: (opts: Partial<AutoLayoutOptions>) => void
  allTemplates: () => TemplateDefinition[]
  undo: () => void
  redo: () => void
  renameProject: (name: string) => void
  updateProjectMeta: (patch: Partial<Pick<Project, 'eventType' | 'community' | 'clientName'>>) => void
  loadProjectFile: (file: ProjectFile) => void
  newProjectFile: () => void
  createProjectFromWizard: (opts: NewProjectOptions) => void
  setPhotoBins: (photoId: string, bins: string[]) => void
}

function withHistory(set: (fn: (s: ProjectState) => Partial<ProjectState>) => void, mutate: (p: Project) => Project) {
  set((s) => {
    const nextProject = { ...mutate(s.project), updatedAt: new Date().toISOString() }
    return {
      project: nextProject,
      history: [...s.history, s.project].slice(-50),
      future: [],
    }
  })
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: newProject({ name: 'Untitled Album' }),
  userTemplates: loadUserTemplates(),
  selectedSpreadId: null,
  selectedPlaceholderId: null,
  selectedTextBoxId: null,
  multiSelectedPlaceholderIds: [],
  selectedPhotoIds: [],
  lastClickedPhotoId: null,
  toneClipboard: null,
  showGrid: false,
  showPrintGuides: true,
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: true,
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
    }
    const spreads = autoBuildSpreads(project.photos, autoLayoutOptions, appearance, project.enabledTemplateIds)
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
        multiSelectedPlaceholderIds: [],
      })
    }
  },

  selectSpread: (id) =>
    set({
      selectedSpreadId: id,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      multiSelectedPlaceholderIds: [],
    }),
  selectPlaceholder: (id) =>
    set({ selectedPlaceholderId: id, selectedTextBoxId: null, multiSelectedPlaceholderIds: [] }),
  selectTextBox: (id) => set({ selectedTextBoxId: id, selectedPlaceholderId: null, multiSelectedPlaceholderIds: [] }),

  toggleMultiSelectPlaceholder: (id) =>
    set((s) => {
      const has = s.multiSelectedPlaceholderIds.includes(id)
      // Starting a multi-select from a single selection folds that selection in as the first member.
      const base = s.multiSelectedPlaceholderIds.length > 0 ? s.multiSelectedPlaceholderIds : s.selectedPlaceholderId ? [s.selectedPlaceholderId] : []
      const next = has ? base.filter((x) => x !== id) : [...base, id]
      return { multiSelectedPlaceholderIds: next, selectedPlaceholderId: null, selectedTextBoxId: null }
    }),
  clearMultiSelect: () => set({ multiSelectedPlaceholderIds: [] }),

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
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),

  // The cover (if any) is excluded from all three of these — it's pinned at order -1 and never
  // renumbered or moved by interior-page operations. Indices here are positions within the
  // interior (non-cover) list, matching what the Spreads panel's own draggable list shows.
  reorderSpreads: (fromIndex, toIndex) =>
    withHistory(set, (p) => {
      const cover = p.spreads.find((s) => s.isCover)
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      const [moved] = interior.splice(fromIndex, 1)
      interior.splice(toIndex, 0, moved)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
    }),

  splitSpread: (spreadId) =>
    withHistory(set, (p) => {
      const cover = p.spreads.find((s) => s.isCover)
      const interior = p.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      const index = interior.findIndex((s) => s.id === spreadId)
      if (index === -1) return p
      const [left, right] = splitSpreadIntoPages(interior[index])
      interior.splice(index, 1, left, right)
      const reordered = interior.map((s, i) => ({ ...s, order: i }))
      return { ...p, spreads: cover ? [cover, ...reordered] : reordered }
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
      }
      return { ...p, spreads: [createCoverSpread(appearance), ...p.spreads] }
    }),

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
      set({ selectedSpreadId: null, selectedPlaceholderId: null, selectedTextBoxId: null, multiSelectedPlaceholderIds: [] })
    }
  },

  applyTemplateToSpread: (spreadId, templateId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? retemplateSpread(s, templateId) : s)),
    })),

  applyTemplateToAllSpreads: (templateId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => retemplateSpread(s, templateId)),
    })),

  updateSpread: (spreadId, patch) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? { ...s, ...patch } : s)),
    })),

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
            if (pl.placeholderId === placeholderIdA) return { ...pl, photoId: b.photoId }
            if (pl.placeholderId === placeholderIdB) return { ...pl, photoId: a.photoId }
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

  addTextBox: (spreadId, box) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? { ...s, textBoxes: [...s.textBoxes, box] } : s)),
    })),

  updateTextBox: (spreadId, textBoxId, patch) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) =>
        s.id !== spreadId
          ? s
          : { ...s, textBoxes: s.textBoxes.map((t) => (t.id === textBoxId ? { ...t, ...patch } : t)) }
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
    const placeholders = base
      ? base.placeholders
      : spread.placements.map((pl) => ({
          id: pl.placeholderId,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          preferredOrientation: 'any' as const,
        }))

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

  allTemplates: () => [...BUILT_IN_TEMPLATES, ...get().userTemplates],

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s
      const prev = s.history[s.history.length - 1]
      return { project: prev, history: s.history.slice(0, -1), future: [s.project, ...s.future] }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const [next, ...rest] = s.future
      return { project: next, history: [...s.history, s.project], future: rest }
    }),

  renameProject: (name) => withHistory(set, (p) => ({ ...p, name })),
  updateProjectMeta: (patch) => withHistory(set, (p) => ({ ...p, ...patch })),

  loadProjectFile: (file) => {
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
      enabledTemplateIds: file.project.enabledTemplateIds ?? null,
      size: { ...file.project.size, safeZoneIn: file.project.size.safeZoneIn ?? 0.25 },
      photos: file.project.photos.map((photo) => ({ ...photo, bins: photo.bins ?? [] })),
      spreads: file.project.spreads.map((spread) => ({
        ...spread,
        flipped: spread.flipped ?? false,
        isCover: spread.isCover ?? false,
        placements: spread.placements.map((p) => ({ ...p, cornerRadiusPx: p.cornerRadiusPx ?? 24 })),
      })),
    }
    set({
      project,
      userTemplates: file.userTemplates,
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
    })
  },

  newProjectFile: () =>
    set({
      project: newProject({ name: 'Untitled Album' }),
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
    }),

  createProjectFromWizard: (opts) =>
    set({
      project: newProject(opts),
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      multiSelectedPlaceholderIds: [],
      selectedPhotoIds: [],
      history: [],
      future: [],
    }),

  setPhotoBins: (photoId, bins) =>
    withHistory(set, (p) => ({
      ...p,
      photos: p.photos.map((photo) => (photo.id === photoId ? { ...photo, bins } : photo)),
    })),
}))
