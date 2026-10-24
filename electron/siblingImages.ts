import path from 'path'
import fs from 'fs/promises'

export async function readSiblingImage(locatedPath: string, fileName: string) {
  if (typeof locatedPath !== 'string' || !path.isAbsolute(locatedPath) || typeof fileName !== 'string' || !fileName || /[\\/]/.test(fileName) || !/\.(jpe?g|png|webp|gif|bmp|tiff?|psd|avif|heic)$/i.test(fileName)) throw new Error('Invalid image location')
  const folder = path.dirname(locatedPath)
  try {
    const matches = (await fs.readdir(folder, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase())
    if (matches.length !== 1) return null
    const sourcePath = path.join(folder, matches[0].name)
    const stat = await fs.stat(sourcePath)
    if (stat.size > 250 * 1024 * 1024) return null
    return { sourcePath, fileName: matches[0].name, lastModified: stat.mtimeMs, data: new Uint8Array(await fs.readFile(sourcePath)) }
  } catch { return null }
}
