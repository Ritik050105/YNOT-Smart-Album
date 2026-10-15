import { PDFDocument } from 'pdf-lib'
import { Project, Spread, PhotoAsset } from '@/types'
import { renderSpreadToCanvas } from './renderSpread'
import { computePlaceholderBoxes } from './layoutMath'
import { buildSpreadPsdBytes } from './exportPsd'
import { buildProofingGalleryHtml } from './exportProofing'
import { canvasToBytes, saveOneFile, saveManyFiles, projectFileBaseName } from './exportUtil'

/** Returns spreads in album order, optionally narrowed to an "Output Range" selection of
 *  0-based indices (e.g. a parsed "1, 2, 5-7" field) — shared by every export path so range
 *  selection behaves identically for PDF, raster, PSD, and manual-proofing exports. */
function selectSpreads(project: Project, spreadIndices?: number[]): Spread[] {
  const sorted = [...project.spreads].sort((a, b) => a.order - b.order)
  if (!spreadIndices) return sorted
  return spreadIndices.map((i) => sorted[i]).filter((s): s is Spread => !!s)
}

async function buildSingleSpreadPdfBytes(project: Project, spread: Spread): Promise<Uint8Array> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const canvas = await renderSpreadToCanvas(spread, photosById, project.size, project.size.dpi)
  const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', 0.92)
  const image = await pdf.embedJpg(jpegBytes)
  const page = pdf.addPage([project.size.widthIn * 72, project.size.heightIn * 72])
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  return pdf.save()
}

/** Exports spreads as a single multi-page, print-ready PDF (one page per spread), optionally
 *  narrowed to an Output Range. */
export async function exportAlbumToPdf(
  project: Project,
  spreadIndices?: number[]
): Promise<{ saved: boolean; filePath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const pixelsPerInch = project.size.dpi

  for (const spread of selectSpreads(project, spreadIndices)) {
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

/** "Export as single pages" for PDF — one PDF file per spread instead of one combined document,
 *  saved into a chosen directory in one go. */
export async function exportAlbumToPdfPages(
  project: Project,
  spreadIndices?: number[]
): Promise<{ saved: boolean; dirPath?: string }> {
  const spreads = selectSpreads(project, spreadIndices)
  const files = []
  for (const spread of spreads) {
    const bytes = await buildSingleSpreadPdfBytes(project, spread)
    const spreadNumber = spread.order + 1
    files.push({
      fileName: `${projectFileBaseName(project)}-spread-${String(spreadNumber).padStart(2, '0')}.pdf`,
      bytes,
      mime: 'application/pdf',
    })
  }
  return saveManyFiles(files)
}

/** Exports each spread as an individual high-res JPEG, e.g. for lab upload or per-spread proofing. */
export async function exportAlbumToJpegs(
  project: Project,
  spreadIndices?: number[]
): Promise<{ saved: boolean; dirPath?: string }> {
  return exportSpreadsAsRaster(project, 'image/jpeg', 'jpg', spreadIndices)
}

/** Exports each spread as a lossless PNG (useful when a lab or print broker requires it). */
export async function exportAlbumToPngs(
  project: Project,
  spreadIndices?: number[]
): Promise<{ saved: boolean; dirPath?: string }> {
  return exportSpreadsAsRaster(project, 'image/png', 'png', spreadIndices)
}

/** Exports each spread as a layered PSD (background + per-photo + per-text layers) for
 *  finishing in Photoshop — the "export as PSD" / deeper-customization workflow. */
export async function exportAlbumToPsds(
  project: Project,
  spreadIndices?: number[]
): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const spreads = selectSpreads(project, spreadIndices)

  const files = []
  for (const spread of spreads) {
    const bytes = await buildSpreadPsdBytes(spread, photosById, project.size, pixelsPerInch)
    const spreadNumber = spread.order + 1
    files.push({ fileName: `spread-${String(spreadNumber).padStart(2, '0')}.psd`, bytes, mime: 'image/vnd.adobe.photoshop' })
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
  const bytes = await buildSingleSpreadPdfBytes(project, spread)
  const spreadNumber = spread.order + 1
  const fileName = `${projectFileBaseName(project)}-spread-${String(spreadNumber).padStart(2, '0')}.pdf`
  return saveOneFile(bytes, fileName, 'application/pdf', [{ name: 'PDF Document', extensions: ['pdf'] }])
}

async function exportSpreadsAsRaster(
  project: Project,
  mime: string,
  ext: string,
  spreadIndices?: number[]
): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const spreads = selectSpreads(project, spreadIndices)

  const files = []
  for (const spread of spreads) {
    const canvas = await renderSpreadToCanvas(spread, photosById, project.size, pixelsPerInch)
    const bytes = await canvasToBytes(canvas, mime, 0.92)
    const spreadNumber = spread.order + 1
    files.push({ fileName: `spread-${String(spreadNumber).padStart(2, '0')}.${ext}`, bytes, mime })
  }
  return saveManyFiles(files)
}

export interface ManualProofingOptions {
  /** Output width in pixels; height is derived from the album's aspect ratio. */
  widthPx: number
  /** Draws a thin center line marking the binding gutter on full spreads. */
  includeGutterLine: boolean
  /** Bakes the bleed/safe-zone guides into the exported image. */
  includeTrimArea: boolean
  includeSpreadNumbers: boolean
  includeFileNames: boolean
  includeImageNumbers: boolean
  /** Whether "image numbers" restart at 1 on every spread, or count up across the whole album. */
  numberingMode: 'spread' | 'album'
  includeWatermark: boolean
  watermarkText: string
}

/** Assigns each placed photo a sequential number, keyed by spread id + placeholder id since
 *  deterministic auto-generated template ids can repeat placeholder ids across spreads. */
function computeImageNumbers(sortedSpreads: Spread[], mode: 'spread' | 'album'): Map<string, number> {
  const map = new Map<string, number>()
  let albumCounter = 1
  for (const spread of sortedSpreads) {
    let spreadCounter = 1
    for (const placement of spread.placements) {
      if (!placement.photoId) continue
      map.set(`${spread.id}|${placement.placeholderId}`, mode === 'album' ? albumCounter : spreadCounter)
      albumCounter++
      spreadCounter++
    }
  }
  return map
}

function drawManualProofingOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  project: Project,
  spread: Spread,
  photosById: Map<string, PhotoAsset>,
  imageNumbers: Map<string, number>,
  spreadNumber: number,
  options: ManualProofingOptions
) {
  const boxes = computePlaceholderBoxes(spread, width, height)
  const pxPerIn = width / project.size.widthIn

  if (options.includeTrimArea) {
    const bleed = project.size.bleedIn * pxPerIn
    const safety = bleed + project.size.safeZoneIn * pxPerIn
    ctx.save()
    ctx.strokeStyle = '#ffb347'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1.5
    ctx.strokeRect(bleed, bleed, width - bleed * 2, height - bleed * 2)
    ctx.strokeStyle = '#4fd6c0'
    ctx.setLineDash([3, 5])
    ctx.strokeRect(safety, safety, width - safety * 2, height - safety * 2)
    ctx.restore()
  }

  if (options.includeGutterLine && spread.pageSide === 'spread') {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()
    ctx.restore()
  }

  for (const box of boxes) {
    const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
    const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
    if (!photo || !placement) continue

    if (options.includeImageNumbers) {
      const n = imageNumbers.get(`${spread.id}|${box.placeholderId}`)
      if (n !== undefined) {
        const r = Math.max(11, Math.min(box.width, box.height) * 0.035)
        ctx.save()
        ctx.beginPath()
        ctx.arc(box.x + r + 6, box.y + r + 6, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = `${Math.round(r * 1.1)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(n), box.x + r + 6, box.y + r + 7)
        ctx.restore()
      }
    }

    if (options.includeFileNames) {
      ctx.save()
      const labelH = Math.max(16, box.height * 0.045)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(box.x, box.y + box.height - labelH, box.width, labelH)
      ctx.fillStyle = '#ffffff'
      ctx.font = `${Math.round(labelH * 0.62)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(photo.fileName, box.x + 6, box.y + box.height - labelH / 2, box.width - 12)
      ctx.restore()
    }
  }

  if (options.includeSpreadNumbers) {
    ctx.save()
    const labelH = Math.max(18, height * 0.03)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(width / 2 - 60, height - labelH, 120, labelH)
    ctx.fillStyle = '#ffffff'
    ctx.font = `${Math.round(labelH * 0.6)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Spread ${spreadNumber}`, width / 2, height - labelH / 2)
    ctx.restore()
  }

  if (options.includeWatermark && options.watermarkText.trim()) {
    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    const fontSize = Math.max(22, width * 0.045)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-Math.PI / 8)
    const stepX = fontSize * options.watermarkText.length * 0.62
    const stepY = fontSize * 2.2
    for (let y = -height; y < height; y += stepY) {
      for (let x = -width; x < width; x += stepX) {
        ctx.fillText(options.watermarkText, x, y)
      }
    }
    ctx.restore()
  }
}

/** Exports spreads as annotated low-res JPEGs for manual client/lab review — the reference
 *  app's "Manual Proofing": custom output size plus reference marks (gutter line, bleed/safe
 *  guides, spread numbers, file names, numbered badges, and an optional watermark) baked
 *  directly into the image so nothing relies on a hosted proofing backend. */
export async function exportAlbumForManualProofing(
  project: Project,
  options: ManualProofingOptions,
  spreadIndices?: number[]
): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const allSorted = [...project.spreads].sort((a, b) => a.order - b.order)
  const imageNumbers = computeImageNumbers(allSorted, options.numberingMode)
  const spreads = selectSpreads(project, spreadIndices)
  const effectiveDpi = options.widthPx / project.size.widthIn

  const files = []
  for (const spread of spreads) {
    const canvas = await renderSpreadToCanvas(spread, photosById, project.size, effectiveDpi)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const spreadNumber = spread.order + 1
      drawManualProofingOverlays(ctx, canvas.width, canvas.height, project, spread, photosById, imageNumbers, spreadNumber, options)
    }
    const bytes = await canvasToBytes(canvas, 'image/jpeg', 0.85)
    const spreadNumber = spread.order + 1
    files.push({ fileName: `${projectFileBaseName(project)}-proof-${String(spreadNumber).padStart(2, '0')}.jpg`, bytes, mime: 'image/jpeg' })
  }
  return saveManyFiles(files)
}
