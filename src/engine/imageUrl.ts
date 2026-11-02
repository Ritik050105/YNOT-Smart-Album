/** Bare `ynot-img://` URLs served by the main process image cache (see electron/imageCache.ts). */
export const RAW_FILE = /\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|rwl|pef|srw|raw|3fr|erf|mef|mos|mrw|x3f|kdc|dcr|iiq|fff|cap)$/i
const CACHEABLE = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic)$/i

export const cacheAvailable = () => !!window.albumStudio?.prepareImage
export const cacheable = (pathOrUrl: string) => CACHEABLE.test(pathOrUrl) || RAW_FILE.test(pathOrUrl)

export function imgUrl(kind: 't' | 'p' | 'r' | 'x', value: string) {
  if (kind === 'x') return `ynot-img://x/${value}`
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return `ynot-img://${kind}/${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/** Thumb/preview URL for a photo's file (or `file:` URL), or '' when the cache can't serve it. */
export function cachedPreviewUrl(kind: 't' | 'p', pathOrUrl: string | undefined) {
  return cacheAvailable() && pathOrUrl && cacheable(pathOrUrl) ? imgUrl(kind, pathOrUrl) : ''
}

/** Starts background generation of thumbnails/previews so the gallery and timeline are already cached when shown. */
export function warmPhotos(photos: { src: string; sourcePath?: string }[]) {
  const paths = photos.map(p => p.sourcePath || (p.src.startsWith('file:') ? p.src : '')).filter(p => p && cacheable(p))
  if (paths.length && cacheAvailable()) void window.albumStudio!.warmImages(paths).catch(() => {})
}
