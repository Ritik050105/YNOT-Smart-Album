import { Project, ProjectFile, TemplateDefinition } from '@/types'
import { saveOneFile, projectFileBaseName } from './exportUtil'

export function blobUrlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:')) return resolve(url)
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      .catch(reject)
  })
}

/** Serializes a project to a self-contained JSON string — photos are embedded as data URLs so
 *  the file opens correctly on any machine, even if the original source images have moved. */
export async function serializeProjectFile(project: Project, userTemplates: TemplateDefinition[], recovery = false): Promise<string> {
  const photos: Project['photos'] = []
  for (const photo of project.photos) {
    // Recovery and desktop package saves reference unchanged local originals.
    let src = photo.src
    // Cache URLs (RAW previews) point at the original file and are re-created on open, so they are saved as-is.
    if (src.startsWith('ynot-img:')) { photos.push({ ...photo, src }); continue }
    if (recovery && photo.sourcePath && (src.startsWith('blob:') || src.startsWith('file:')) && /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(photo.sourcePath)) {
      const normalized = photo.sourcePath.replace(/\\/g, '/').replace(/%/g, '%25').replace(/#/g, '%23').replace(/\?/g, '%3F')
      const url = new URL('file:///')
      if (normalized.startsWith('//')) {
        const slash = normalized.indexOf('/', 2)
        url.hostname = normalized.slice(2, slash)
        url.pathname = normalized.slice(slash)
      } else url.pathname = normalized
      src = url.href
    } else src = await blobUrlToDataUrl(src)
    photos.push({ ...photo, src })
  }
  const savedSources = new Map(project.photos.map((photo, index) => [photo.src, photos[index].src]))
  const file: ProjectFile = {
    formatVersion: 1,
    project: { ...project, photos, spreads: await Promise.all(project.spreads.map(async spread => ({
      ...spread,
      backgroundPattern: spread.backgroundPattern ? { ...spread.backgroundPattern, src: recovery && savedSources.get(spread.backgroundPattern.src) || await blobUrlToDataUrl(spread.backgroundPattern.src) } : undefined,
    }))) },
    userTemplates,
  }
  return JSON.stringify(file)
}

export function deserializeProjectFile(jsonText: string): ProjectFile {
  const parsed = JSON.parse(jsonText) as ProjectFile
  if (parsed?.formatVersion !== 1 || !parsed.project || !Array.isArray(parsed.project.photos) || !Array.isArray(parsed.project.spreads) || !parsed.project.size || !Array.isArray(parsed.userTemplates) || !parsed.project.spreads.every((s) => Array.isArray(s.placements) && Array.isArray(s.textBoxes))) {
    throw new Error('This file is not a valid YNOT ALBUM STUDIO project.')
  }
  return parsed
}

function fileNameFor(project: Project): string {
  return `${projectFileBaseName(project)}.ynot`
}

export async function saveProjectToFile(
  project: Project,
  userTemplates: TemplateDefinition[],
  filePath?: string | null
): Promise<{ saved: boolean; filePath?: string }> {
  if (window.albumStudio?.saveProjectPackage) {
    const contents = await serializeProjectFile(project, userTemplates, true)
    return window.albumStudio.saveProjectPackage({ contents, defaultName: fileNameFor(project), filePath: filePath ?? undefined })
  }
  const json = await serializeProjectFile(project, userTemplates)
  const bytes = new TextEncoder().encode(json)
  if (filePath && window.albumStudio?.isElectron) {
    const split = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
    if (split < 1) throw new Error('Invalid project path. Use Save As to choose a file.')
    await window.albumStudio.writeFileInDir({ dirPath: filePath.slice(0, split), fileName: filePath.slice(split + 1), data: bytes })
    return { saved: true, filePath }
  }
  return saveOneFile(bytes, fileNameFor(project), 'application/json', [
    { name: 'YNOT Album Studio Project', extensions: ['ynot', 'ablm', 'json'] },
  ])
}

/** Opens a project file via the native dialog (Electron) or a browser file picker, returning
 *  the parsed project (plus its on-disk path, when known, so callers can remember it for the
 *  Home screen's recent-albums list) — or null if the user canceled. */
export function openProjectFromFile(): Promise<{ file: ProjectFile; filePath?: string } | null> {
  if (window.albumStudio?.isElectron) {
    return window.albumStudio.openProjectFile().then((result) => {
      if (result.canceled || !result.contents) return null
      return { file: deserializeProjectFile(result.contents), filePath: result.filePath }
    })
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ynot,.ablm,.json,application/json'
    input.oncancel = () => resolve(null)
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => {
        try { resolve({ file: deserializeProjectFile(reader.result as string) }) }
        catch (err) { reject(err) }
      }
      reader.onerror = () => reject(new Error('Could not read that project file.'))
      reader.readAsText(file)
    }
    input.click()
  })
}

/** Re-opens a project at an exact file path with no dialog — the Home screen's recent-albums
 *  list. Electron-only (a browser file picker can't silently re-read an arbitrary path); returns
 *  null if unsupported or the file is missing/unreadable (e.g. moved or deleted since). */
export async function openProjectFromPath(filePath: string): Promise<ProjectFile | null> {
  if (!window.albumStudio?.isElectron) return null
  const result = await window.albumStudio.openProjectAtPath(filePath)
  if (!result.ok || !result.contents) return null
  try {
    return deserializeProjectFile(result.contents)
  } catch {
    return null
  }
}
