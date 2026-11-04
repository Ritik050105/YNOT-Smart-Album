import fs from 'fs/promises'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { fileURLToPath, pathToFileURL } from 'url'
import { writeFileAtomic } from './files'

const prefix = 'ynot-asset:'
const assetName = /^[a-f0-9]{64}\.(jpe?g|png|webp|gif|bmp|avif|tiff?|psd|heic)$/i
const imageExtension = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?|psd|heic)$/i

function parse(contents: string) {
  const file = JSON.parse(contents)
  if (file?.formatVersion !== 1 || !Array.isArray(file.project?.photos) || !Array.isArray(file.project?.spreads) || !Array.isArray(file.userTemplates)) throw new Error('Invalid project.')
  return file
}

/** Copy originals without ever loading their bytes into the renderer or JSON. */
export async function saveProjectPackage(target: string, contents: string) {
  if (!path.isAbsolute(target) || !/\.(ynot|ablm|json)$/i.test(target)) throw new Error('Invalid project location.')
  const file = parse(contents)
  const directory = `${target}.assets`
  for (const photo of [...file.project.photos, ...file.project.spreads.map((spread: { backgroundPattern?: { src: string } }) => spread.backgroundPattern).filter(Boolean)]) {
    if (typeof photo.src !== 'string' || !photo.src.startsWith('file:')) continue
    const source = fileURLToPath(photo.src)
    if (!imageExtension.test(source)) throw new Error('Unsupported original image.')
    const before = await fs.stat(source)
    if (!before.isFile()) throw new Error('Original image is not a file.')
    const key = createHash('sha256').update(`${source}\0${before.size}\0${before.mtimeMs}\0${before.ctimeMs}`).digest('hex')
    const name = path.resolve(path.dirname(source)) === path.resolve(directory) && assetName.test(path.basename(source))
      ? path.basename(source) : `${key}${path.extname(source).toLowerCase()}`
    const destination = path.join(directory, name)
    await fs.mkdir(directory, { recursive: true })
    const existing = await fs.stat(destination).catch(() => null)
    if (!existing || existing.size !== before.size) {
      const temporary = `${destination}.${randomUUID()}.tmp`
      try {
        await fs.copyFile(source, temporary)
        const after = await fs.stat(source)
        if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) throw new Error('An original changed during Save. Retry once editing has finished.')
        const handle = await fs.open(temporary, 'r+')
        try { await handle.sync() } finally { await handle.close() }
        await fs.rename(temporary, destination)
      } finally { await fs.rm(temporary, { force: true }) }
    }
    photo.src = prefix + name
    // On reopen, the bundled original becomes the source; the old PC path is not portable.
    delete photo.sourcePath
  }
  // Publish metadata only after all originals are safely copied. Never delete older assets here.
  writeFileAtomic(target, Buffer.from(JSON.stringify(file)))
}

export async function readProjectPackage(target: string) {
  const contents = await fs.readFile(target, 'utf8')
  const file = parse(contents)
  for (const photo of [...file.project.photos, ...file.project.spreads.map((spread: { backgroundPattern?: { src: string } }) => spread.backgroundPattern).filter(Boolean)]) {
    if (typeof photo.src !== 'string' || !photo.src.startsWith(prefix)) continue
    const name = photo.src.slice(prefix.length)
    if (!assetName.test(name)) throw new Error('Invalid project asset reference.')
    photo.sourcePath = path.join(`${target}.assets`, name)
    photo.src = pathToFileURL(photo.sourcePath).href
  }
  return JSON.stringify(file)
}

/** Each copy gets its own folder, so an existing album is never overwritten. */
export async function copyProjectPackage(destination: string, defaultName: string, contents: string) {
  if (!path.isAbsolute(destination) || !(await fs.stat(destination)).isDirectory()) throw new Error('Choose a destination folder.')
  parse(contents)
  const name = path.basename(defaultName).replace(/\.ynot$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 80) || 'Album'
  const folder = await fs.mkdtemp(path.join(destination, `YNOT ${name} - `))
  const target = path.join(folder, 'Album.ynot')
  try {
    await saveProjectPackage(target, contents)
    await fs.writeFile(path.join(folder, 'OPEN PROJECT.txt'), 'Open Album.ynot in YNOT Album Studio.\nKeep this whole folder together when moving or backing it up.\nYour original photos are included in Album.ynot.assets.\n')
    return target
  } catch (error) {
    await fs.rm(folder, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}
