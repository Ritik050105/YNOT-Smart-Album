const STORAGE_KEY = 'albumstudio.openSession'

export interface OpenSessionMarker {
  projectId: string
  filePath: string | null
  hasRecovery?: boolean
  name: string
  clientName: string
  sizeLabel: string
  spreadCount: number
}

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
    return parsed && (parsed.filePath === null || typeof parsed.filePath === 'string') ? parsed : null
  } catch {
    return null
  }
}

let recoveryGeneration = 0
export function invalidateRecovery() { recoveryGeneration++ }

export async function persistRecovery(contents: Promise<string>, marker: OpenSessionMarker) {
  const generation = ++recoveryGeneration
  const serialized = await contents
  if (generation !== recoveryGeneration) return
  await window.albumStudio?.writeRecovery({ filePath: marker.filePath, contents: serialized })
  if (generation === recoveryGeneration) writeOpenSession({ ...marker, hasRecovery: true })
}

export function clearOpenSession() {
  invalidateRecovery()
  void window.albumStudio?.clearRecovery().catch((error) => {
    window.dispatchEvent(new CustomEvent('album-studio:recovery-error', { detail: String(error) }))
  })
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage isn't available in the first place.
  }
}
