export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'albumstudio.theme'

/** Light is the app's default — only switches to dark if the user explicitly chose it before. */
export function getStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // Storage unavailable (e.g. private mode) — default below.
  }
  return 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Non-fatal — theme just won't persist across restarts.
  }
}
