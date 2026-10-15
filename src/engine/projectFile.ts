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
export async function serializeProjectFile(project: Project, userTemplates: TemplateDefinition[]): Promise<string> {
  const photos = await Promise.all(
    project.photos.map(async (photo) => ({ ...photo, src: await blobUrlToDataUrl(photo.src) }))
  )
  const file: ProjectFile = {
    formatVersion: 1,
    project: { ...project, photos },
    userTemplates,
  }
  return JSON.stringify(file)
}

export function deserializeProjectFile(jsonText: string): ProjectFile {
  const parsed = JSON.parse(jsonText) as ProjectFile
  if (parsed.formatVersion !== 1 || !parsed.project) {
    throw new Error('This file is not a valid YNOT Album Studio project.')
  }
  return parsed
}

function fileNameFor(project: Project): string {
  return `${projectFileBaseName(project)}.ablm.json`
}

export async function saveProjectToFile(
  project: Project,
  userTemplates: TemplateDefinition[]
): Promise<{ saved: boolean; filePath?: string }> {
  const json = await serializeProjectFile(project, userTemplates)
  const bytes = new TextEncoder().encode(json)
  return saveOneFile(bytes, fileNameFor(project), 'application/json', [
    { name: 'YNOT Album Studio Project', extensions: ['ablm', 'json'] },
  ])
}

/** Opens a project file via the native dialog (Electron) or a browser file picker, returning
 *  the parsed project — or null if the user canceled. */
export function openProjectFromFile(): Promise<ProjectFile | null> {
  if (window.albumStudio?.isElectron) {
    return window.albumStudio.openProjectFile().then((result) => {
      if (result.canceled || !result.contents) return null
      return deserializeProjectFile(result.contents)
    })
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ablm,.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = () => resolve(deserializeProjectFile(reader.result as string))
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })
}
