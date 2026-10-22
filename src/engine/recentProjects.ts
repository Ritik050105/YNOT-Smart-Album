const STORAGE_KEY = 'albumstudio.recentProjects'
const MAX_RECENT = 24

export const ALBUM_STATUSES = ['Waiting for feedback', 'Feedback submitted', 'Unpublished draft', 'Approved', 'Archived'] as const
export type AlbumStatus = typeof ALBUM_STATUSES[number]
export type ProjectSort = 'modified' | 'name' | 'created-asc' | 'created-desc'

export interface RecentProjectEntry {
  /** The project's own id (Project.id) — used to update an existing entry instead of duplicating
   *  it when the same project is saved/opened again. */
  projectId: string
  name: string
  clientName: string
  sizeLabel: string
  /** Only set on Electron, where a project can be silently reopened by path; absent in the
   *  browser preview, where the entry is still shown but can't be reopened without a picker. */
  filePath?: string
  spreadCount: number
  updatedAt: string
  createdAt?: string
  /** Local organization label, not a synced client-proofing status. */
  status?: AlbumStatus
  /** Which Home-screen tab this belongs under — absent on entries recorded before this field
   *  existed, which are treated as 'album'. */
  kind?: 'album' | 'gallery' | 'slideshow'
}

export function loadRecentProjects(): RecentProjectEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveRecentProjects(entries: RecentProjectEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)))
  } catch {
    // Storage unavailable — the Home screen just won't remember recent albums this session.
  }
}

/** Records (or updates) a project in the recent-albums list, most-recent first — called after a
 *  successful Save or Open so the Home screen reflects what's actually been touched. */
export function recordRecentProject(entry: Omit<RecentProjectEntry, 'updatedAt'>): RecentProjectEntry[] {
  const entries = loadRecentProjects()
  const previous = entries.find((e) => e.projectId === entry.projectId)
  const existing = entries.filter((e) => e.projectId !== entry.projectId)
  const now = new Date().toISOString()
  const next = [{ ...entry, createdAt: entry.createdAt ?? previous?.createdAt ?? previous?.updatedAt ?? now,
    status: previous?.status ?? entry.status ?? 'Unpublished draft', updatedAt: now }, ...existing] as RecentProjectEntry[]
  saveRecentProjects(next)
  return next
}

export function setRecentProjectStatus(projectId: string, status: AlbumStatus): RecentProjectEntry[] {
  if (!ALBUM_STATUSES.includes(status)) return loadRecentProjects()
  const next = loadRecentProjects().map(entry => entry.projectId === projectId ? { ...entry, status } : entry)
  saveRecentProjects(next)
  return next
}

export function browseRecentProjects(entries: RecentProjectEntry[], kind: NonNullable<RecentProjectEntry['kind']>, search: string, statuses: AlbumStatus[], sort: ProjectSort) {
  const query = search.trim().toLocaleLowerCase()
  const time = (value: string) => Date.parse(value) || 0
  return entries.filter(entry => (entry.kind ?? 'album') === kind)
    .filter(entry => !query || `${entry.name} ${entry.clientName ?? ''}`.toLocaleLowerCase().includes(query))
    .filter(entry => kind !== 'album' || !statuses.length || statuses.includes(entry.status ?? 'Unpublished draft'))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      : sort === 'modified' ? time(b.updatedAt) - time(a.updatedAt)
      : (time(a.createdAt ?? a.updatedAt) - time(b.createdAt ?? b.updatedAt)) * (sort === 'created-asc' ? 1 : -1))
}

export function removeRecentProject(projectId: string): RecentProjectEntry[] {
  const next = loadRecentProjects().filter((e) => e.projectId !== projectId)
  saveRecentProjects(next)
  return next
}
