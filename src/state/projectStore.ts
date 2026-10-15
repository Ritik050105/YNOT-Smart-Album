import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { Project, PhotoAsset, Spread, TemplateDefinition, TextBox, ProjectFile } from '@/types'
import {
  autoBuildSpreads,
  DEFAULT_AUTO_LAYOUT_OPTIONS,
  AutoLayoutOptions,
  retemplateSpread,
  splitSpreadIntoPages,
  mergeSpreads,
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

function newProject(name: string): Project {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    name,
    size: DEFAULT_ALBUM_SIZE,
    photos: [],
    spreads: [],
    createdAt: now,
    updatedAt: now,
    eventType: 'Wedding',
    community: '',
    clientName: '',
  }
}

interface ProjectState {
  project: Project
  userTemplates: TemplateDefinition[]
  selectedSpreadId: string | null
  selectedPlaceholderId: string | null
  selectedTextBoxId: string | null
  showGrid: boolean
  showPrintGuides: boolean
  autoLayoutOptions: AutoLayoutOptions
  history: Project[]
  future: Project[]

  addPhotos: (photos: PhotoAsset[]) => void
  runAutoBuild: () => void
  selectSpread: (id: string | null) => void
  selectPlaceholder: (id: string | null) => void
  selectTextBox: (id: string | null) => void
  toggleGrid: () => void
  togglePrintGuides: () => void
  reorderSpreads: (fromIndex: number, toIndex: number) => void
  splitSpread: (spreadId: string) => void
  mergeWithNext: (spreadId: string) => void
  applyTemplateToSpread: (spreadId: string, templateId: string) => void
  updateSpread: (spreadId: string, patch: Partial<Spread>) => void
  setPlacementPhoto: (spreadId: string, placeholderId: string, photoId: string | null) => void
  swapPlacements: (spreadId: string, placeholderIdA: string, placeholderIdB: string) => void
  updatePlacement: (spreadId: string, placeholderId: string, patch: Partial<Spread['placements'][number]>) => void
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
  project: newProject('Untitled Album'),
  userTemplates: loadUserTemplates(),
  selectedSpreadId: null,
  selectedPlaceholderId: null,
  selectedTextBoxId: null,
  showGrid: false,
  showPrintGuides: true,
  autoLayoutOptions: DEFAULT_AUTO_LAYOUT_OPTIONS,
  history: [],
  future: [],

  addPhotos: (photos) =>
    withHistory(set, (p) => ({ ...p, photos: [...p.photos, ...photos] })),

  runAutoBuild: () => {
    const { project, autoLayoutOptions } = get()
    withHistory(set, (p) => ({ ...p, spreads: autoBuildSpreads(project.photos, autoLayoutOptions) }))
  },

  selectSpread: (id) => set({ selectedSpreadId: id, selectedPlaceholderId: null, selectedTextBoxId: null }),
  selectPlaceholder: (id) => set({ selectedPlaceholderId: id, selectedTextBoxId: null }),
  selectTextBox: (id) => set({ selectedTextBoxId: id, selectedPlaceholderId: null }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  togglePrintGuides: () => set((s) => ({ showPrintGuides: !s.showPrintGuides })),

  reorderSpreads: (fromIndex, toIndex) =>
    withHistory(set, (p) => {
      const spreads = [...p.spreads]
      const [moved] = spreads.splice(fromIndex, 1)
      spreads.splice(toIndex, 0, moved)
      return { ...p, spreads: spreads.map((s, i) => ({ ...s, order: i })) }
    }),

  splitSpread: (spreadId) =>
    withHistory(set, (p) => {
      const index = p.spreads.findIndex((s) => s.id === spreadId)
      if (index === -1) return p
      const [left, right] = splitSpreadIntoPages(p.spreads[index])
      const spreads = [...p.spreads]
      spreads.splice(index, 1, left, right)
      return { ...p, spreads: spreads.map((s, i) => ({ ...s, order: i })) }
    }),

  mergeWithNext: (spreadId) =>
    withHistory(set, (p) => {
      const index = p.spreads.findIndex((s) => s.id === spreadId)
      if (index === -1 || index === p.spreads.length - 1) return p
      const merged = mergeSpreads(p.spreads[index], p.spreads[index + 1])
      const spreads = [...p.spreads]
      spreads.splice(index, 2, merged)
      return { ...p, spreads: spreads.map((s, i) => ({ ...s, order: i })) }
    }),

  applyTemplateToSpread: (spreadId, templateId) =>
    withHistory(set, (p) => ({
      ...p,
      spreads: p.spreads.map((s) => (s.id === spreadId ? retemplateSpread(s, templateId) : s)),
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
    // Older saved project files predate eventType/community/clientName — default them so
    // opening one doesn't crash the UI that reads these fields.
    const project: Project = {
      ...file.project,
      eventType: file.project.eventType ?? 'Wedding',
      community: file.project.community ?? '',
      clientName: file.project.clientName ?? '',
    }
    set({
      project,
      userTemplates: file.userTemplates,
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      history: [],
      future: [],
    })
  },

  newProjectFile: () =>
    set({
      project: newProject('Untitled Album'),
      selectedSpreadId: null,
      selectedPlaceholderId: null,
      selectedTextBoxId: null,
      history: [],
      future: [],
    }),
}))
