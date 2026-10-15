import { PDFDocument } from 'pdf-lib'
import { Project } from '@/types'
import { renderSpreadToCanvas } from './renderSpread'

declare global {
  interface Window {
    albumStudio?: {
      isElectron: true
      saveFile: (args: {
        defaultName: string
        filters: { name: string; extensions: string[] }[]
        data: Uint8Array
      }) => Promise<{ canceled: boolean; filePath?: string }>
      pickDirectory: () => Promise<{ canceled: boolean; dirPath?: string }>
      writeFileInDir: (args: { dirPath: string; fileName: string; data: Uint8Array }) => Promise<{ filePath: string }>
    }
  }
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error('Failed to encode JPEG'))
        resolve(new Uint8Array(await blob.arrayBuffer()))
      },
      'image/jpeg',
      quality
    )
  })
}

function downloadInBrowser(data: Uint8Array, fileName: string, mime: string) {
  const blob = new Blob([data as unknown as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Exports the whole album as a single multi-page, print-ready PDF (one page per spread). */
export async function exportAlbumToPdf(project: Project): Promise<{ saved: boolean; filePath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const pixelsPerInch = project.size.dpi

  for (const spread of [...project.spreads].sort((a, b) => a.order - b.order)) {
    const canvas = await renderSpreadToCanvas(spread, photosById, project.size, pixelsPerInch)
    const jpegBytes = await canvasToJpegBytes(canvas)
    const image = await pdf.embedJpg(jpegBytes)
    const page = pdf.addPage([project.size.widthIn * 72, project.size.heightIn * 72])
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  }

  const bytes = await pdf.save()
  const fileName = `${project.name.replace(/[^a-z0-9_\- ]/gi, '_')}.pdf`

  if (window.albumStudio?.isElectron) {
    const result = await window.albumStudio.saveFile({
      defaultName: fileName,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      data: bytes,
    })
    return result.canceled ? { saved: false } : { saved: true, filePath: result.filePath }
  }

  downloadInBrowser(bytes, fileName, 'application/pdf')
  return { saved: true }
}

/** Exports each spread as an individual high-res JPEG, e.g. for lab upload or per-spread proofing. */
export async function exportAlbumToJpegs(project: Project): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const sorted = [...project.spreads].sort((a, b) => a.order - b.order)

  if (window.albumStudio?.isElectron) {
    const dir = await window.albumStudio.pickDirectory()
    if (dir.canceled || !dir.dirPath) return { saved: false }
    for (let i = 0; i < sorted.length; i++) {
      const canvas = await renderSpreadToCanvas(sorted[i], photosById, project.size, pixelsPerInch)
      const bytes = await canvasToJpegBytes(canvas)
      await window.albumStudio.writeFileInDir({
        dirPath: dir.dirPath,
        fileName: `spread-${String(i + 1).padStart(2, '0')}.jpg`,
        data: bytes,
      })
    }
    return { saved: true, dirPath: dir.dirPath }
  }

  for (let i = 0; i < sorted.length; i++) {
    const canvas = await renderSpreadToCanvas(sorted[i], photosById, project.size, pixelsPerInch)
    const bytes = await canvasToJpegBytes(canvas)
    downloadInBrowser(bytes, `spread-${String(i + 1).padStart(2, '0')}.jpg`, 'image/jpeg')
  }
  return { saved: true }
}
