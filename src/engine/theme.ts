export type Theme = 'light' | 'dark' | 'classic'

const STORAGE_KEY = 'albumstudio.theme'

/** Classic Graphite & Gold is the app's default: it is YNOT's own livery, and the first thing a
 *  photographer should see is the brand, not a generic blue. Any other theme is only used when the
 *  user chose it themselves and it is still in storage. */
export function getStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'classic') return raw
  } catch {
    // Storage unavailable (e.g. private mode) — default below.
  }
  return 'classic'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Non-fatal — theme just won't persist across restarts.
  }
}
