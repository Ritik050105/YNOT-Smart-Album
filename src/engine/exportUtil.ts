import { Project } from '@/types'

/** Base filename for exports — prefers the client/couple name (how a studio actually refers to
 *  a job) over the generic project title, falling back to it when no client name is set. */
export function projectFileBaseName(project: Project): string {
  const source = project.clientName.trim() || project.name
  return source.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'album'
}

export function canvasToBytes(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error(`Failed to encode ${mime}`))
        resolve(new Uint8Array(await blob.arrayBuffer()))
      },
      mime,
      quality
    )
  })
}

export function downloadInBrowser(data: Uint8Array, fileName: string, mime: string) {
  const blob = new Blob([data as unknown as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Saves one file via the native Save dialog in Electron, or triggers a browser download otherwise. */
export async function saveOneFile(
  bytes: Uint8Array,
  fileName: string,
  mime: string,
  filters: { name: string; extensions: string[] }[]
): Promise<{ saved: boolean; filePath?: string }> {
  if (window.albumStudio?.isElectron) {
    const result = await window.albumStudio.saveFile({ defaultName: fileName, filters, data: bytes })
    return result.canceled ? { saved: false } : { saved: true, filePath: result.filePath }
  }
  downloadInBrowser(bytes, fileName, mime)
  return { saved: true }
}

/** Saves a batch of files into one directory (Electron), or downloads them one by one (browser preview). */
export async function saveManyFiles(
  files: { fileName: string; bytes: Uint8Array; mime: string }[]
): Promise<{ saved: boolean; dirPath?: string }> {
  if (window.albumStudio?.isElectron) {
    const dir = await window.albumStudio.pickDirectory()
    if (dir.canceled || !dir.dirPath) return { saved: false }
    for (const f of files) {
      await window.albumStudio.writeFileInDir({ dirPath: dir.dirPath, fileName: f.fileName, data: f.bytes })
    }
    return { saved: true, dirPath: dir.dirPath }
  }
  for (const f of files) downloadInBrowser(f.bytes, f.fileName, f.mime)
  return { saved: true }
}
