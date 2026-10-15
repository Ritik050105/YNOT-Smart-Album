import { PDFDocument } from 'pdf-lib'
import { Project, Spread } from '@/types'
import { renderSpreadToCanvas } from './renderSpread'
import { buildSpreadPsdBytes } from './exportPsd'
import { buildProofingGalleryHtml } from './exportProofing'
import { canvasToBytes, saveOneFile, saveManyFiles, projectFileBaseName } from './exportUtil'

/** Exports the whole album as a single multi-page, print-ready PDF (one page per spread). */
export async function exportAlbumToPdf(project: Project): Promise<{ saved: boolean; filePath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const pixelsPerInch = project.size.dpi

  for (const spread of [...project.spreads].sort((a, b) => a.order - b.order)) {
    const canvas = await renderSpreadToCanvas(spread, photosById, project.size, pixelsPerInch)
    const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', 0.92)
    const image = await pdf.embedJpg(jpegBytes)
    const page = pdf.addPage([project.size.widthIn * 72, project.size.heightIn * 72])
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  }

  const bytes = await pdf.save()
  const fileName = `${projectFileBaseName(project)}.pdf`
  return saveOneFile(bytes, fileName, 'application/pdf', [{ name: 'PDF Document', extensions: ['pdf'] }])
}

/** Exports each spread as an individual high-res JPEG, e.g. for lab upload or per-spread proofing. */
export async function exportAlbumToJpegs(project: Project): Promise<{ saved: boolean; dirPath?: string }> {
  return exportSpreadsAsRaster(project, 'image/jpeg', 'jpg')
}

/** Exports each spread as a lossless PNG (useful when a lab or print broker requires it). */
export async function exportAlbumToPngs(project: Project): Promise<{ saved: boolean; dirPath?: string }> {
  return exportSpreadsAsRaster(project, 'image/png', 'png')
}

/** Exports each spread as a layered PSD (background + per-photo + per-text layers) for
 *  finishing in Photoshop — the "export as PSD" / deeper-customization workflow. */
export async function exportAlbumToPsds(project: Project): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const sorted = [...project.spreads].sort((a, b) => a.order - b.order)

  const files = []
  for (let i = 0; i < sorted.length; i++) {
    const bytes = await buildSpreadPsdBytes(sorted[i], photosById, project.size, pixelsPerInch)
    files.push({ fileName: `spread-${String(i + 1).padStart(2, '0')}.psd`, bytes, mime: 'image/vnd.adobe.photoshop' })
  }
  return saveManyFiles(files)
}

/** Exports a self-contained proofing gallery (HTML, images embedded) to share with a client for
 *  review — see buildProofingGalleryHtml for what "cloud proofing" means without a backend. */
export async function exportAlbumToProofingGallery(project: Project): Promise<{ saved: boolean; filePath?: string }> {
  const html = await buildProofingGalleryHtml(project)
  const bytes = new TextEncoder().encode(html)
  const fileName = `${projectFileBaseName(project)}-proofing.html`
  return saveOneFile(bytes, fileName, 'text/html', [{ name: 'Proofing Gallery', extensions: ['html'] }])
}

/** Exports just one spread as a single-page PDF — for sending one page to a lab/client without
 *  the whole album ("Export Spread" in the reference app's spread context menu). */
export async function exportSingleSpreadToPdf(project: Project, spread: Spread): Promise<{ saved: boolean; filePath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const canvas = await renderSpreadToCanvas(spread, photosById, project.size, project.size.dpi)
  const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', 0.92)
  const image = await pdf.embedJpg(jpegBytes)
  const page = pdf.addPage([project.size.widthIn * 72, project.size.heightIn * 72])
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })

  const bytes = await pdf.save()
  const spreadNumber = spread.order + 1
  const fileName = `${projectFileBaseName(project)}-spread-${String(spreadNumber).padStart(2, '0')}.pdf`
  return saveOneFile(bytes, fileName, 'application/pdf', [{ name: 'PDF Document', extensions: ['pdf'] }])
}

async function exportSpreadsAsRaster(
  project: Project,
  mime: string,
  ext: string
): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const sorted = [...project.spreads].sort((a, b) => a.order - b.order)

  const files = []
  for (let i = 0; i < sorted.length; i++) {
    const canvas = await renderSpreadToCanvas(sorted[i], photosById, project.size, pixelsPerInch)
    const bytes = await canvasToBytes(canvas, mime, 0.92)
    files.push({ fileName: `spread-${String(i + 1).padStart(2, '0')}.${ext}`, bytes, mime })
  }
  return saveManyFiles(files)
}
