export interface FontOption {
  family: string
  category: 'local' | 'cloud'
  /** Google Fonts css2 family query param, e.g. "Playfair+Display:wght@400;700". */
  googleFontParam?: string
}

/** Common system fonts assumed present on most Windows/Mac machines. */
export const LOCAL_FONTS: FontOption[] = [
  { family: 'Georgia', category: 'local' },
  { family: 'Helvetica', category: 'local' },
  { family: 'Arial', category: 'local' },
  { family: 'Times New Roman', category: 'local' },
  { family: 'Courier New', category: 'local' },
  { family: 'Verdana', category: 'local' },
]

/** A curated set of Google Fonts, loaded on demand so the app isn't shipping font files itself. */
export const CLOUD_FONTS: FontOption[] = [
  { family: 'Playfair Display', category: 'cloud', googleFontParam: 'Playfair+Display:wght@400;700' },
  { family: 'Montserrat', category: 'cloud', googleFontParam: 'Montserrat:wght@400;700' },
  { family: 'Great Vibes', category: 'cloud', googleFontParam: 'Great+Vibes' },
  { family: 'Cormorant Garamond', category: 'cloud', googleFontParam: 'Cormorant+Garamond:wght@400;600' },
  { family: 'Pacifico', category: 'cloud', googleFontParam: 'Pacifico' },
  { family: 'Oswald', category: 'cloud', googleFontParam: 'Oswald:wght@400;600' },
  { family: 'Dancing Script', category: 'cloud', googleFontParam: 'Dancing+Script:wght@400;700' },
  { family: 'Marcellus', category: 'cloud', googleFontParam: 'Marcellus' },
]

export const ALL_FONTS: FontOption[] = [...LOCAL_FONTS, ...CLOUD_FONTS]

const loadedFontLinks = new Set<string>()

/** Injects a <link> for a cloud font the first time it's used, and returns once the browser
 *  reports it loaded (or immediately for local fonts / already-loaded cloud fonts). */
export async function ensureFontLoaded(family: string): Promise<void> {
  const font = CLOUD_FONTS.find((f) => f.family === family)
  if (!font) return

  if (!loadedFontLinks.has(family)) {
    loadedFontLinks.add(family)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFontParam}&display=swap`
    document.head.appendChild(link)
  }

  try {
    if ('fonts' in document) {
      await document.fonts.load(`16px "${family}"`)
    }
  } catch {
    // Offline or blocked — text will render with the browser's fallback font instead.
  }
}
