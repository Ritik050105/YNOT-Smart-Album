import { createHash } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

export const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic)$/i
export const TEXT_KEY = /^[a-f0-9]{8,32}$/

export const cacheKey = (file: string, size: number, mtimeMs: number) => createHash('sha1').update(`${file}|${size}|${mtimeMs}`).digest('hex')

/** `ynot-img://<t|p|r|x>/<base64url path or file: URL | text key>[?query]` → kind and payload. */
export function parseImgUrl(url: string): { kind: 't' | 'p' | 'r' | 'x'; value: string } | null {
  const m = /^ynot-img:\/\/([tprx])\/([A-Za-z0-9_-]+)(?:[?#].*)?$/i.exec(url)
  if (!m) return null
  const kind = m[1].toLowerCase() as 't' | 'p' | 'r' | 'x'
  if (kind === 'x') return TEXT_KEY.test(m[2]) ? { kind, value: m[2] } : null
  let file = Buffer.from(m[2], 'base64url').toString('utf8')
  if (file.startsWith('file:')) { try { file = fileURLToPath(file) } catch { return null } }
  return path.isAbsolute(file) ? { kind, value: file } : null
}
