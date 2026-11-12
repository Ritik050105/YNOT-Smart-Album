import {loadGoogleFont} from './googleFontCache'
import bundledFonts from '@/assets/google-fonts/manifest.json'
import bundledFontUrls from './bundledFontAssets'
import {imgUrl} from './imageUrl'
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

/** Licensed Google Fonts bundled for offline use; licenses accompany each family. Only these are
 *  offered in the font list — the full 1900-family Google catalog was a wall of names that are not
 *  installed on the machine and that no template uses, so it stays a load-on-demand fallback for
 *  albums that already reference one of those families. */
export const CLOUD_FONTS: FontOption[] = bundledFonts.map(font=>({family:font.family,category:'cloud'}))

export const ALL_FONTS: FontOption[] = [...LOCAL_FONTS, ...CLOUD_FONTS]

let localFontsCache: FontOption[] | null = null
const discoveredFonts=new Map<string,string>()
export function registerDiscoveredFonts(fonts:{family:string;path:string}[]){
  discoveredFonts.clear()
  for(const font of fonts)if(!discoveredFonts.has(font.family))discoveredFonts.set(font.family,font.path)
}
export async function discoveredFontData(family:string){
  const path=discoveredFonts.get(family)
  return path&&window.albumStudio?window.albumStudio.readDiscoveredFont(path):undefined
}
let localFontsPending: Promise<FontOption[]> | null = null

/** Returns the fonts actually installed on this machine (via Electron's main process), falling
 *  back to the curated LOCAL_FONTS list when running in a browser preview or detection fails.
 *  Result is cached for the life of the app — fonts don't change mid-session. */
export function getLocalFonts(refresh=false): Promise<FontOption[]> {
  if(refresh){localFontsCache=null;localFontsPending=null}
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

const bundledLoads = new Map<string,Promise<void>>()
const scannedLoads = new Map<string,Promise<void>>()
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
  if(discoveredFonts.has(family)){
    if(uploadedFaces.has(family)||scannedLoads.has(family))return scannedLoads.get(family)
    if(window.albumStudio?.isElectron){
      // Scanned files load straight from disk through the font protocol — no base64 over IPC.
      const load=new FontFace(family,`url(${JSON.stringify(imgUrl('g',discoveredFonts.get(family)!))})`).load().then(face=>{document.fonts.add(face);window.dispatchEvent(new CustomEvent('album-studio:font-loaded',{detail:{family}}))}).catch(error=>{scannedLoads.delete(family);throw error})
      scannedLoads.set(family,load)
      return load
    }
    const data=await discoveredFontData(family);if(data)await loadUploadedFont(family,data)
    return
  }
  const font = bundledFonts.find(f=>f.family===family)
  if(!font){if((await import('@/data/googleFontsCatalog.json')).default.some(f=>f.family===family))await loadGoogleFont(family);return}
  if(!bundledLoads.has(family)){
    const pending=Promise.all(font.files.map(async file=>{
      const url=(bundledFontUrls as Record<string,string>)['../assets/google-fonts/'+file]
      if(!url)throw new Error('Bundled font unavailable: '+family)
      const face=await new FontFace(family,`url(${JSON.stringify(url)})`,{weight:file.includes('wght')?'100 900':'400',style:/italic/i.test(file)?'italic':'normal'}).load()
      document.fonts.add(face)
    })).then(()=>{window.dispatchEvent(new CustomEvent('album-studio:font-loaded',{detail:{family}}))}).catch(error=>{bundledLoads.delete(family);throw error})
    bundledLoads.set(family,pending)
  }
  await bundledLoads.get(family)
}

export function isBundledFont(family:string){return bundledFonts.some(f=>f.family===family)}
