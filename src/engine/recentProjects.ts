const STORAGE_KEY = 'albumstudio.recentProjects'
const MAX_RECENT = 24

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
  const existing = loadRecentProjects().filter((e) => e.projectId !== entry.projectId)
  const next = [{ ...entry, updatedAt: new Date().toISOString() }, ...existing]
  saveRecentProjects(next)
  return next
}

export function removeRecentProject(projectId: string): RecentProjectEntry[] {
  const next = loadRecentProjects().filter((e) => e.projectId !== projectId)
  saveRecentProjects(next)
  return next
}
