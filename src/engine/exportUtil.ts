import { Project } from '@/types'

/** Base filename for exports — prefers the client/couple name (how a studio actually refers to
 *  a job) over the generic project title, falling back to it when no client name is set. */
export function projectFileBaseName(project: Project): string {
  const source = project.clientName.trim() || project.name
  return source.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'album'
}

function exportStamp(): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`
}

function uniqueExportName(fileName: string, stamp = exportStamp()): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? `${fileName.slice(0, dot)}-${stamp}${fileName.slice(dot)}` : `${fileName}-${stamp}`
}

/** Parses an "Output Range" field like "1, 2, 5-7" into 0-based spread indices, clamped to
 *  1..count and de-duplicated/sorted. Invalid or out-of-range tokens are silently dropped. */
export function parseSpreadRange(text: string, count: number): number[] {
  const indices = new Set<number>()
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      for (let n = Math.max(1, Math.min(start, end)); n <= Math.min(count, Math.max(start, end)); n++) {
        indices.add(n - 1)
      }
    } else {
      const n = Number(part)
      if (/^\d+$/.test(part) && Number.isInteger(n) && n >= 1 && n <= count) indices.add(n - 1)
    }
  }
  return Array.from(indices).sort((a, b) => a - b)
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
  filters: { name: string; extensions: string[] }[],
  uniqueExport = false
): Promise<{ saved: boolean; filePath?: string }> {
  if (uniqueExport) fileName = uniqueExportName(fileName)
  if (window.albumStudio?.isElectron) {
    const result = await window.albumStudio.saveFile({ defaultName: fileName, filters, data: bytes })
    return result.canceled ? { saved: false } : { saved: true, filePath: result.filePath }
  }
  downloadInBrowser(bytes, fileName, mime)
  return { saved: true }
}

/** Saves a batch of files into one directory (Electron), or downloads them one by one (browser preview). */
export async function saveManyFiles(
  files: Iterable<{ fileName: string; bytes: Uint8Array; mime: string }> | AsyncIterable<{ fileName: string; bytes: Uint8Array; mime: string }>
): Promise<{ saved: boolean; dirPath?: string }> {
  const stamp = exportStamp()
  if (window.albumStudio?.isElectron) {
    const dir = await window.albumStudio.pickDirectory()
    if (dir.canceled || !dir.dirPath) return { saved: false }
    for await (const f of files) {
      await window.albumStudio.writeFileInDir({ dirPath: dir.dirPath, fileName: uniqueExportName(f.fileName, stamp), data: f.bytes })
    }
    return { saved: true, dirPath: dir.dirPath }
  }
  for await (const f of files) downloadInBrowser(f.bytes, uniqueExportName(f.fileName, stamp), f.mime)
  return { saved: true }
}
