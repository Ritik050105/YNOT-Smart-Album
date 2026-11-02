import { createHash } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

export const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic)$/i
export const TEXT_KEY = /^[a-f0-9]{8,32}$/
export const FONT_EXT = /\.(ttf|otf|woff2?)$/i

export const cacheKey = (file: string, size: number, mtimeMs: number) => createHash('sha1').update(`${file}|${size}|${mtimeMs}`).digest('hex')

/** `ynot-img://<t|p|r|x|f|g>/<base64url path or file: URL | text key | "family|face">[?query]` → kind and payload. */
export function parseImgUrl(url: string): { kind: 't' | 'p' | 'r' | 'x' | 'f' | 'g'; value: string } | null {
  const m = /^ynot-img:\/\/([tprxfg])\/([A-Za-z0-9_-]+)(?:[?#].*)?$/i.exec(url)
  if (!m) return null
  const kind = m[1].toLowerCase() as 't' | 'p' | 'r' | 'x' | 'f' | 'g'
  if (kind === 'x') return TEXT_KEY.test(m[2]) ? { kind, value: m[2] } : null
  if (kind === 'f') { const value = Buffer.from(m[2], 'base64url').toString('utf8'); return /^[^|]+\|\d{1,3}$/.test(value) ? { kind, value } : null }
  let file = Buffer.from(m[2], 'base64url').toString('utf8')
  if (file.startsWith('file:')) { try { file = fileURLToPath(file) } catch { return null } }
  if (kind === 'g' && !FONT_EXT.test(file)) return null
  return path.isAbsolute(file) ? { kind, value: file } : null
}
