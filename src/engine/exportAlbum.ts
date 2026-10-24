import { PDFDocument } from 'pdf-lib'
import { Project, Spread, PhotoAsset } from '@/types'
import { renderSpreadToCanvas } from './renderSpread'
import { computePlaceholderBoxes, resolvePageInsetsPx, centerGutterInsetPx, edgeInsetToPx } from './layoutMath'
import { buildSpreadPsdBytes } from './exportPsd'
import { buildProofingGalleryHtml } from './exportProofing'
import { canvasToBytes, saveOneFile, saveManyFiles, projectFileBaseName } from './exportUtil'
import { savePdfX3 } from './pdfX'

interface PdfExportOptions { pdfX?: boolean; jpegQuality?: number }

/** Checks the album's interior page count against its size's optional min/max page range (an
 *  "album company" product's own printing constraints, set on a saved Custom preset) — the
 *  reference app's "According to the album company limitations, the album needs to have between
 *  X and Y pages..." export-time warning. */
export function checkPageLimits(project: Project): { violated: boolean; pageCount: number; min?: number; max?: number } {
  const interiorSpreads = project.spreads.filter((s) => !s.isCover)
  const pageCount = interiorSpreads.reduce((sum, s) => sum + (s.pageSide === 'spread' ? 2 : 1), 0)
  const { minPages, maxPages } = project.size
  const violated = (!!minPages && pageCount < minPages) || (!!maxPages && pageCount > maxPages)
  return { violated, pageCount, min: minPages, max: maxPages }
}

/** Returns spreads in album order, optionally narrowed to an "Output Range" selection of
 *  0-based indices (e.g. a parsed "1, 2, 5-7" field) — shared by every export path so range
 *  selection behaves identically for PDF, raster, PSD, and manual-proofing exports.
 *  Interior range numbers never include the cover; `includeCover` prepends it separately. */
export function selectSpreads(project: Project, spreadIndices?: number[], includeCover = true): Spread[] {
  const sorted = [...project.spreads].sort((a, b) => a.order - b.order)
  const interior = sorted.filter((s) => !s.isCover)
  const selected = spreadIndices
    ? [...new Set(spreadIndices)].filter((i) => Number.isInteger(i) && i >= 0 && i < interior.length).sort((a, b) => a - b).map((i) => interior[i])
    : interior
  return includeCover ? [...sorted.filter((s) => s.isCover), ...selected] : selected
}

async function buildSingleSpreadPdfBytes(project: Project, spread: Spread): Promise<Uint8Array> {
  const size = spread.size ?? project.size
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const canvas = await renderSpreadToCanvas(spread, photosById, size, size.dpi)
  const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', 0.97)
  const image = await pdf.embedJpg(jpegBytes)
  const page = pdf.addPage([size.widthIn * 72, size.heightIn * 72])
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  return pdf.save()
}

/** Exports spreads as a single multi-page, print-ready PDF (one page per spread), optionally
 *  narrowed to an Output Range. */
export async function exportAlbumToPdf(
  project: Project,
  spreadIndices?: number[],
  includeCover = true,
  options: PdfExportOptions = {}
): Promise<{ saved: boolean; filePath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pdf = await PDFDocument.create()
  const pixelsPerInch = project.size.dpi

  for (const spread of selectSpreads(project, spreadIndices, includeCover)) {
    const size = spread.size ?? project.size
    const canvas = await renderSpreadToCanvas(spread, photosById, size, size.dpi)
    const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', options.jpegQuality ?? 0.97)
    const image = await pdf.embedJpg(jpegBytes)
    const page = pdf.addPage([size.widthIn * 72, size.heightIn * 72])
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  }

  const bytes = options.pdfX ? await savePdfX3(pdf, project.name) : await pdf.save()
  const fileName = `${projectFileBaseName(project)}${options.pdfX ? '-PDFX3' : ''}.pdf`
  return saveOneFile(bytes, fileName, 'application/pdf', [{ name: 'PDF Document', extensions: ['pdf'] }], true)
}

/** Split two-page interiors at the gutter; covers retain their own complete artwork. */
export function singlePageCanvases(canvas: HTMLCanvasElement, spread: Pick<Spread, 'pageSide' | 'isCover'>): HTMLCanvasElement[] {
  if (spread.isCover || spread.pageSide !== 'spread') return [canvas]
  const cut = Math.floor(canvas.width / 2)
  return [0, cut].map((x, index) => {
    const page = document.createElement('canvas')
    page.width = index === 0 ? cut : canvas.width - cut
    page.height = canvas.height
    const ctx = page.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    ctx.drawImage(canvas, x, 0, page.width, page.height, 0, 0, page.width, page.height)
    return page
  })
}

/** One PDF per physical page, split at the gutter for full spreads. */
export async function exportAlbumToPdfPages(
  project: Project,
  spreadIndices?: number[],
  includeCover = true,
  options: PdfExportOptions = {}
): Promise<{ saved: boolean; dirPath?: string }> {
  const spreads = selectSpreads(project, spreadIndices, includeCover)
  const files = []
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  for (const spread of spreads) {
    const size = spread.size ?? project.size
    const canvas = await renderSpreadToCanvas(spread, photosById, size, size.dpi)
    for (const [index, pageCanvas] of singlePageCanvases(canvas, spread).entries()) {
      const pdf = await PDFDocument.create()
      const image = await pdf.embedJpg(await canvasToBytes(pageCanvas, 'image/jpeg', options.jpegQuality ?? 0.97))
      const page = pdf.addPage([size.widthIn * 72 * pageCanvas.width / canvas.width, size.heightIn * 72])
      page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
      files.push({ fileName: `${projectFileBaseName(project)}-${spread.isCover ? 'cover' : `spread-${String(spread.order + 1).padStart(2, '0')}-page-${index + 1}`}${options.pdfX ? '-PDFX3' : ''}.pdf`, bytes: options.pdfX ? await savePdfX3(pdf, project.name) : await pdf.save(), mime: 'application/pdf' })
    }
  }
  return saveManyFiles(files)
}

/** Exports each spread as an individual high-res JPEG, e.g. for lab upload or per-spread proofing. */
export async function exportAlbumToJpegs(
  project: Project,
  spreadIndices?: number[],
  includeCover = true,
  singlePages = false,
  quality = 0.97
): Promise<{ saved: boolean; dirPath?: string }> {
  return exportSpreadsAsRaster(project, 'image/jpeg', 'jpg', spreadIndices, includeCover, singlePages, quality)
}

/** Exports each spread as a lossless PNG (useful when a lab or print broker requires it). */
export async function exportAlbumToPngs(
  project: Project,
  spreadIndices?: number[],
  includeCover = true,
  singlePages = false
): Promise<{ saved: boolean; dirPath?: string }> {
  return exportSpreadsAsRaster(project, 'image/png', 'png', spreadIndices, includeCover, singlePages)
}

/** Exports each spread as a layered PSD (background + per-photo + per-text layers) for
 *  finishing in Photoshop — the "export as PSD" / deeper-customization workflow. */
export async function exportAlbumToPsds(
  project: Project,
  spreadIndices?: number[],
  includeCover = true
): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const spreads = selectSpreads(project, spreadIndices, includeCover)

  async function* files() {
    for (const spread of spreads) {
      const size = spread.size ?? project.size
      const bytes = await buildSpreadPsdBytes(spread, photosById, size, size.dpi)
      const spreadNumber = spread.order + 1
      yield { fileName: spread.isCover ? 'cover.psd' : `spread-${String(spreadNumber).padStart(2, '0')}.psd`, bytes, mime: 'image/vnd.adobe.photoshop' }
    }
  }
  return saveManyFiles(files())
}

/** Exports a self-contained proofing gallery (HTML, images embedded) to share with a client for
 *  review — see buildProofingGalleryHtml for what "cloud proofing" means without a backend. */
export async function exportAlbumToProofingGallery(project: Project): Promise<{ saved: boolean; filePath?: string }> {
  const html = await buildProofingGalleryHtml(project)
  const bytes = new TextEncoder().encode(html)
  const fileName = `${projectFileBaseName(project)}-proofing.html`
  return saveOneFile(bytes, fileName, 'text/html', [{ name: 'Proofing Gallery', extensions: ['html'] }], true)
}

/** Exports just one spread as a single-page PDF — for sending one page to a lab/client without
 *  the whole album ("Export Spread" in the reference app's spread context menu). */
export async function exportSingleSpreadToPdf(project: Project, spread: Spread): Promise<{ saved: boolean; filePath?: string }> {
  const bytes = await buildSingleSpreadPdfBytes(project, spread)
  const spreadNumber = spread.order + 1
  const fileName = `${projectFileBaseName(project)}-${spread.isCover ? 'cover' : `spread-${String(spreadNumber).padStart(2, '0')}`}.pdf`
  return saveOneFile(bytes, fileName, 'application/pdf', [{ name: 'PDF Document', extensions: ['pdf'] }], true)
}

async function exportSpreadsAsRaster(
  project: Project,
  mime: string,
  ext: string,
  spreadIndices?: number[],
  includeCover = true,
  singlePages = false,
  quality = 0.97
): Promise<{ saved: boolean; dirPath?: string }> {
  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const pixelsPerInch = project.size.dpi
  const spreads = selectSpreads(project, spreadIndices, includeCover)

  const files = []
  for (const spread of spreads) {
    const size = spread.size ?? project.size
    const canvas = await renderSpreadToCanvas(spread, photosById, size, size.dpi)
    const canvases = singlePages ? singlePageCanvases(canvas, spread) : [canvas]
    for (const [index, page] of canvases.entries()) {
      const bytes = await canvasToBytes(page, mime, Math.max(0.01, Math.min(1, quality)))
      const name = spread.isCover ? 'cover' : `spread-${String(spread.order + 1).padStart(2, '0')}${singlePages ? `-page-${index + 1}` : ''}`
      files.push({ fileName: `${name}.${ext}`, bytes, mime })
    }
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
  const size = spread.size ?? project.size
  const pxPerIn = width / size.widthIn

  if (options.includeTrimArea) {
    const trimPx = edgeInsetToPx(size.trim, pxPerIn)
    const safetyEdgeInset = {
      leftRight: size.trim.leftRight + size.safeZone.leftRight,
      topBottom: size.trim.topBottom + size.safeZone.topBottom,
      inside: size.trim.inside + size.safeZone.inside,
    }
    const safetyPx = edgeInsetToPx(safetyEdgeInset, pxPerIn)
    const trim = resolvePageInsetsPx(spread.pageSide, trimPx)
    const safety = resolvePageInsetsPx(spread.pageSide, safetyPx)
    ctx.save()
    ctx.strokeStyle = '#ffb347'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1.5
    ctx.strokeRect(trim.left, trim.top, width - trim.left - trim.right, height - trim.top - trim.bottom)
    ctx.strokeStyle = '#4fd6c0'
    ctx.setLineDash([3, 5])
    ctx.strokeRect(safety.left, safety.top, width - safety.left - safety.right, height - safety.top - safety.bottom)
    if (spread.pageSide === 'spread') {
      const centerX = width / 2
      const trimGutter = centerGutterInsetPx(trimPx)
      const safetyGutter = centerGutterInsetPx(safetyPx)
      ctx.strokeStyle = '#ffb347'
      ctx.setLineDash([6, 4])
      ;[centerX - trimGutter, centerX + trimGutter].forEach((x) => {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      })
      ctx.strokeStyle = '#4fd6c0'
      ctx.setLineDash([3, 5])
      ;[centerX - safetyGutter, centerX + safetyGutter].forEach((x) => {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      })
    }
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
    if (!photo || !placement || placement.hidden) continue

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
    const size = spread.size ?? project.size
    const canvas = await renderSpreadToCanvas(spread, photosById, size, options.widthPx / size.widthIn)
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
