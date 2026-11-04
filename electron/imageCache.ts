import sharp from 'sharp'
import exifr from 'exifr'
import { app, protocol } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { RAW_EXT, extractRawJpegFromFile } from './rawPreview'
import { IMG_EXT, FONT_EXT, cacheKey, parseImgUrl, TEXT_KEY } from './imageKeys'

sharp.cache(false) // libvips otherwise keeps source files open, so Windows can't replace or delete originals (external edits, relink)

export interface PreparedImage { width: number; height: number; hasColorProfile: boolean; isBlackAndWhite?: boolean }

const MAX_BYTES = 512 * 1024 * 1024
const MAX_CACHE = 3 * 1024 ** 3
const PIXELS = { limitInputPixels: 400_000_000 }
const imageDir = () => path.join(app.getPath('userData'), 'cache', 'images')
const textDir = () => path.join(app.getPath('userData'), 'cache', 'text')
const fontDir = () => path.join(app.getPath('userData'), 'cache', 'fonts')
// Fonts the installer pre-downloaded; the download cache below is checked second.
const installerFontDir = () => path.join(app.getPath('appData'), 'YNOT Album Studio', 'google-fonts')
const safeFamily = (family: string) => family.replace(/[^A-Za-z0-9]+/g, '_')

/** Only font files found by the font scan may be served from arbitrary paths. */
let scannedFontAllowed: (file: string) => Promise<boolean> = async () => false
export const allowScannedFonts = (check: (file: string) => Promise<boolean>) => { scannedFontAllowed = check }

type FaceMeta = { file: string; weight: string; style: string; unicodeRange: string }
async function readFaces(family: string): Promise<{ dir: string; faces: FaceMeta[] } | null> {
  for (const dir of [path.join(installerFontDir(), safeFamily(family)), path.join(fontDir(), safeFamily(family))]) {
    try { const faces: FaceMeta[] = JSON.parse(await fs.promises.readFile(path.join(dir, 'faces.json'), 'utf8')); if (Array.isArray(faces) && faces.length) return { dir, faces } } catch { /* try the next folder */ }
  }
  return null
}

/** Cached faces of a Google font as `ynot-img://f/…` URLs (no font bytes cross IPC). */
export async function cachedFontFaces(family: string) {
  if (typeof family !== 'string') return null
  const found = await readFaces(family)
  if (!found) return null
  return found.faces.map((f, i) => ({ url: `ynot-img://f/${Buffer.from(`${family}|${i}`).toString('base64url')}`, weight: f.weight, style: f.style, unicodeRange: f.unicodeRange }))
}

/** Saves faces the renderer just downloaded so later loads (and restarts) are served from disk. */
export async function storeFontFaces(family: string, faces: { data: Uint8Array; weight: string; style: string; unicodeRange: string }[]) {
  if (typeof family !== 'string' || !family.trim() || !Array.isArray(faces) || !faces.length || faces.length > 60) throw new Error('Invalid font')
  const dir = path.join(fontDir(), safeFamily(family))
  await fs.promises.mkdir(dir, { recursive: true })
  const meta: FaceMeta[] = []
  for (const [i, face] of faces.entries()) {
    if (!(face.data instanceof Uint8Array) || face.data.byteLength > 12 * 1024 * 1024) throw new Error('Invalid font data')
    const file = `face-${i}.woff2`
    await write(path.join(dir, file), face.data)
    meta.push({ file, weight: String(face.weight), style: String(face.style), unicodeRange: String(face.unicodeRange) })
  }
  await write(path.join(dir, 'faces.json'), Buffer.from(JSON.stringify(meta))) // last: marks the entry complete
}

/** Must run before app ready. */
export function registerImageScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'ynot-img', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } }])
}

// At most 3 decodes at once; the same file asked for twice shares one job.
let active = 0
const waiting: (() => void)[] = []
const inflight = new Map<string, Promise<PreparedImage>>()
async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try { return await job() } finally { active--; waiting.shift()?.() }
}

async function write(file: string, data: Uint8Array) {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.promises.writeFile(tmp, data)
  await fs.promises.rename(tmp, file)
}

async function baseFor(file: string) {
  if (!path.isAbsolute(file) || !(IMG_EXT.test(file) || RAW_EXT.test(file))) throw new Error('Invalid image path')
  const info = await fs.promises.stat(file)
  if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Invalid image file')
  return path.join(imageDir(), cacheKey(file, info.size, info.mtimeMs))
}

async function generate(file: string, base: string): Promise<PreparedImage> {
  await fs.promises.mkdir(imageDir(), { recursive: true })
  let source: string | Buffer = file
  if (RAW_EXT.test(file)) {
    const jpeg = await extractRawJpegFromFile(file)
    if (!jpeg) throw new Error('No embedded preview found in this RAW file.')
    let out: Buffer = jpeg
    if (!(await sharp(jpeg, PIXELS).metadata()).orientation) { // the camera JPEG carries no rotation, so take it from the RAW container
      const turn = ({ 3: 180, 6: 90, 8: 270 } as Record<number, number>)[(await exifr.orientation(file).catch(() => 1)) ?? 1]
      if (turn) out = await sharp(jpeg, PIXELS).rotate(turn).jpeg({ quality: 95 }).toBuffer()
    }
    await write(`${base}.r.jpg`, out)
    source = out
  }
  const input = sharp(source, PIXELS)
  const meta = await input.metadata()
  const rotated = (meta.orientation ?? 1) >= 5
  const preview = await input.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, effort: 2 }).toBuffer()
  // Thumbnail and B/W check come from the small preview, so the huge original is decoded only once.
  const small = sharp(preview)
  const thumb = await small.clone().resize(480, 480, { fit: 'inside' }).webp({ quality: 78, effort: 2 }).toBuffer()
  const { data: pixels } = await small.clone().resize(48, 48, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let colored = 0, visible = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    visible++
    if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 12) colored++
  }
  const prepared: PreparedImage = { width: rotated ? meta.height! : meta.width!, height: rotated ? meta.width! : meta.height!, hasColorProfile: !!meta.icc, isBlackAndWhite: visible > 0 ? colored / visible < 0.015 : undefined }
  await write(`${base}.t.webp`, thumb)
  await write(`${base}.p.webp`, preview)
  await write(`${base}.json`, Buffer.from(JSON.stringify(prepared))) // written last: its presence means the entry is complete
  return prepared
}

async function ensure(file: string): Promise<{ base: string; meta: PreparedImage }> {
  const base = await baseFor(file)
  try { return { base, meta: JSON.parse(await fs.promises.readFile(`${base}.json`, 'utf8')) } } catch { /* not cached yet */ }
  let job = inflight.get(base)
  if (!job) {
    job = limited(() => generate(file, base)).finally(() => inflight.delete(base))
    inflight.set(base, job)
  }
  return { base, meta: await job }
}

const asPath = (file: string) => (file.startsWith('file:') ? fileURLToPath(file) : file)

export const prepareImage = async (file: string) => (await ensure(asPath(file))).meta

export function warmImages(files: string[]) {
  if (!Array.isArray(files)) return
  for (const file of files.slice(0, 5000)) if (typeof file === 'string') ensure(asPath(file)).catch(() => {})
}

export async function putTextPreview(key: string, bytes: Uint8Array) {
  if (typeof key !== 'string' || !TEXT_KEY.test(key) || !(bytes instanceof Uint8Array) || bytes.byteLength > 8 * 1024 * 1024) throw new Error('Invalid text preview')
  await fs.promises.mkdir(textDir(), { recursive: true })
  await write(path.join(textDir(), `${key}.png`), bytes)
}

const CORS = { 'access-control-allow-origin': '*' }
export function registerImageProtocol() {
  protocol.handle('ynot-img', async request => {
    const parsed = parseImgUrl(request.url)
    const miss = () => new Response(null, { status: 404, headers: { ...CORS, 'cache-control': 'no-store' } })
    if (!parsed) return miss()
    try {
      if (parsed.kind === 'f' || parsed.kind === 'g') {
        let file: string
        if (parsed.kind === 'g') {
          if (!(await scannedFontAllowed(parsed.value))) return miss()
          file = parsed.value
        } else {
          const at = parsed.value.lastIndexOf('|'), found = await readFaces(parsed.value.slice(0, at)), face = found?.faces[Number(parsed.value.slice(at + 1))]
          if (!found || !face) return miss()
          file = path.join(found.dir, path.basename(face.file))
        }
        const info = await fs.promises.stat(file)
        if (!info.isFile() || info.size > 12 * 1024 * 1024) return miss()
        const ext = path.extname(file).slice(1).toLowerCase()
        return new Response(await fs.promises.readFile(file), { headers: { ...CORS, 'content-type': ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'otf' ? 'font/otf' : 'font/ttf', 'cache-control': 'max-age=31536000' } })
      }
      if (parsed.kind === 'x') {
        const data = await fs.promises.readFile(path.join(textDir(), `${parsed.value}.png`))
        return new Response(data, { headers: { ...CORS, 'content-type': 'image/png', 'cache-control': 'no-store' } })
      }
      const { base } = await ensure(parsed.value)
      const [suffix, type] = { t: ['t.webp', 'image/webp'], p: ['p.webp', 'image/webp'], r: ['r.jpg', 'image/jpeg'] }[parsed.kind]
      const data = await fs.promises.readFile(`${base}.${suffix}`)
      return new Response(data, { headers: { ...CORS, 'content-type': type, 'cache-control': 'max-age=31536000' } })
    } catch { return miss() }
  })
}

/** Deletes the least recently used cached images until the folder is back under ~3 GB. */
/** Bytes held by the app's own on-disk caches — the rendered image, text-preview and font
 *  caches under userData. Chromium's HTTP cache is near empty here because every image is served
 *  from disk through the ynot-img:// protocol, so reporting that instead always read 0 MB. */
export async function cacheBytes() {
  let total = 0
  for (const dir of [imageDir(), textDir(), fontDir()]) {
    try {
      for (const entry of await fs.promises.readdir(dir, { withFileTypes: true, recursive: true })) {
        if (!entry.isFile()) continue
        total += (await fs.promises.stat(path.join(entry.parentPath ?? dir, entry.name))).size
      }
    } catch { /* that cache folder does not exist yet */ }
  }
  return total
}

/** Empties those same caches. Everything in them is re-derived from the originals on next use. */
export async function clearCaches() {
  for (const dir of [imageDir(), textDir(), fontDir()]) await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {})
  return cacheBytes()
}

export async function pruneImageCache() {
  try {
    const names = await fs.promises.readdir(imageDir())
    const files = (await Promise.all(names.map(async name => { const p = path.join(imageDir(), name); const s = await fs.promises.stat(p); return { p, size: s.size, t: s.mtimeMs } }))).sort((a, b) => a.t - b.t)
    let total = files.reduce((n, f) => n + f.size, 0)
    for (const f of files) { if (total <= MAX_CACHE) break; await fs.promises.unlink(f.p).catch(() => {}); total -= f.size }
  } catch { /* no cache folder yet */ }
}
