import sharp from 'sharp'
import exifr from 'exifr'
import { app, protocol } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { RAW_EXT, extractRawJpegFromFile } from './rawPreview'
import { IMG_EXT, cacheKey, parseImgUrl, TEXT_KEY } from './imageKeys'

export interface PreparedImage { width: number; height: number; hasColorProfile: boolean; isBlackAndWhite?: boolean }

const MAX_BYTES = 512 * 1024 * 1024
const MAX_CACHE = 3 * 1024 ** 3
const PIXELS = { limitInputPixels: 400_000_000 }
const imageDir = () => path.join(app.getPath('userData'), 'cache', 'images')
const textDir = () => path.join(app.getPath('userData'), 'cache', 'text')

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
export async function pruneImageCache() {
  try {
    const names = await fs.promises.readdir(imageDir())
    const files = (await Promise.all(names.map(async name => { const p = path.join(imageDir(), name); const s = await fs.promises.stat(p); return { p, size: s.size, t: s.mtimeMs } }))).sort((a, b) => a.t - b.t)
    let total = files.reduce((n, f) => n + f.size, 0)
    for (const f of files) { if (total <= MAX_CACHE) break; await fs.promises.unlink(f.p).catch(() => {}); total -= f.size }
  } catch { /* no cache folder yet */ }
}
