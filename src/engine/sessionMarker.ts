const STORAGE_KEY = 'albumstudio.openSession'

export interface OpenSessionMarker {
  projectId: string
  filePath: string
  name: string
  clientName: string
  sizeLabel: string
  spreadCount: number
}

/** Tracks "a project with unsaved changes is currently open" across app launches, so the app can
 *  offer to resume it next time instead of either always silently reopening the last project
 *  (regardless of whether anything would actually be lost) or never offering to at all.
 *
 *  Written whenever the open project becomes dirty, and cleared the moment it's saved or the user
 *  deliberately leaves it (back to Home) — so by the time the app launches again, a marker still
 *  being there means the project was last left with real unsaved work, whether that's because the
 *  window was closed without saving or the app/OS went down before a save happened. Either way,
 *  on next launch that's exactly the case worth asking "continue where you left off?" about. */
export function writeOpenSession(marker: OpenSessionMarker) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marker))
  } catch {
    // Storage unavailable — the app just won't be able to offer a resume prompt next launch.
  }
}

export function loadOpenSession(): OpenSessionMarker | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.filePath === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function clearOpenSession() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}
