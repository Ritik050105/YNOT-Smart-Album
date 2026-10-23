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

/** A curated set of Google Fonts, loaded on demand so the app isn't shipping font files itself.
 *  EB Garamond leads the list — it's the typeface YNOT Photography's own branding uses. */
export const CLOUD_FONTS: FontOption[] = [
  { family: 'EB Garamond', category: 'cloud', googleFontParam: 'EB+Garamond:wght@400;500;600' },
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

let localFontsCache: FontOption[] | null = null
let localFontsPending: Promise<FontOption[]> | null = null

/** Returns the fonts actually installed on this machine (via Electron's main process), falling
 *  back to the curated LOCAL_FONTS list when running in a browser preview or detection fails.
 *  Result is cached for the life of the app — fonts don't change mid-session. */
export function getLocalFonts(): Promise<FontOption[]> {
  if (localFontsCache) return Promise.resolve(localFontsCache)
  if (localFontsPending) return localFontsPending

  localFontsPending = (async () => {
    if (window.albumStudio?.isElectron) {
      try {
        const { fonts } = await window.albumStudio.listLocalFonts()
        if (fonts.length > 0) {
          localFontsCache = fonts.map((family) => ({ family, category: 'local' as const }))
          return localFontsCache
        }
      } catch {
        // Fall through to the curated list below.
      }
    }
    localFontsCache = LOCAL_FONTS
    return localFontsCache
  })()

  return localFontsPending
}

const loadedFontLinks = new Set<string>()
let projectFonts: {family:string;dataUrl:string}[] = []
const uploadedFaces = new Map<string, {dataUrl:string; face:FontFace}>()
export function registerProjectFonts(fonts: typeof projectFonts) {
  projectFonts = fonts
  for (const [family, entry] of uploadedFaces) if (!fonts.some(f=>f.family===family&&f.dataUrl===entry.dataUrl)) { document.fonts.delete(entry.face); uploadedFaces.delete(family) }
}
export async function loadUploadedFont(family:string,dataUrl:string) {
  if (!/^data:(?:font\/[^;,]+|application\/[^;,]+|);base64,/i.test(dataUrl) || dataUrl.length>15000000) throw new Error('Invalid font file')
  if (uploadedFaces.get(family)?.dataUrl===dataUrl) return
  const face = await new FontFace(family,`url(${dataUrl})`).load()
  const old = uploadedFaces.get(family); if(old)document.fonts.delete(old.face)
  document.fonts.add(face); uploadedFaces.set(family,{dataUrl,face})
  window.dispatchEvent(new CustomEvent('album-studio:font-loaded',{detail:{family}}))
}

/** Injects a <link> for a cloud font the first time it's used, and returns once the browser
 *  reports it loaded (or immediately for local fonts / already-loaded cloud fonts). */
export async function ensureFontLoaded(family: string): Promise<void> {
  const uploaded = projectFonts.find(f=>f.family===family)
  if (uploaded) return loadUploadedFont(uploaded.family,uploaded.dataUrl)
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
      // Canvas-based renderers (Konva) don't repaint on their own once a web font finishes
      // loading after the initial draw — nothing about their props changed. Let listeners
      // (the designer canvas) know it's safe to redraw with the real typeface now.
      window.dispatchEvent(new CustomEvent('album-studio:font-loaded', { detail: { family } }))
    }
  } catch {
    // Offline or blocked — text will render with the browser's fallback font instead.
  }
}
