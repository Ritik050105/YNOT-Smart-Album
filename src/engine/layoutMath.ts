import { EdgeInset, PageSide, Spread } from '@/types'
import { findTemplate } from './templates'
import { resolveTemplateFrames } from './templateLayout'

export const DESIGN_WIDTH = 900

export interface PlaceholderBox {
  placeholderId: string
  x: number
  y: number
  width: number
  height: number
}

/** Converts a spread's normalized template placeholders into pixel boxes for a canvas of
 *  the given size, applying the spread's margin + gap. Shared by the live editor canvas and
 *  the export rasterizer so what you see is exactly what you print. */
export function computePlaceholderBoxes(
  spread: Pick<Spread, 'templateId' | 'marginPx' | 'gapPx' | 'flipped' | 'customBoxes'>,
  canvasWidthPx: number,
  canvasHeightPx: number
): PlaceholderBox[] {
  if (spread.customBoxes) return spread.customBoxes.map((box) => ({ placeholderId: box.id,
    x: (spread.flipped ? 1 - box.x - box.width : box.x) * canvasWidthPx, y: box.y * canvasHeightPx,
    width: box.width * canvasWidthPx, height: box.height * canvasHeightPx }))
  const template = findTemplate(spread.templateId)
  if (!template) return []

  return resolveTemplateFrames(template.placeholders, canvasWidthPx / canvasHeightPx, spread.marginPx, spread.gapPx).map((ph) => {
    const x = spread.flipped ? 1 - ph.x - ph.width : ph.x
    return {
      placeholderId: ph.id,
      x: x * canvasWidthPx,
      y: ph.y * canvasHeightPx,
      width: ph.width * canvasWidthPx,
      height: ph.height * canvasHeightPx,
    }
  })
}

export function boundedFrameRect(rect: { x: number; y: number; width: number; height: number }) {
  if (!Object.values(rect).every(Number.isFinite)) throw new Error('Frame coordinates must be finite numbers.')
  const x = Math.max(0, Math.min(0.998, rect.x))
  const y = Math.max(0, Math.min(0.998, rect.y))
  return { x, y, width: Math.max(0.002, Math.min(1 - x, rect.width)), height: Math.max(0.002, Math.min(1 - y, rect.height)) }
}

/** Resolves a per-edge trim/safe-zone inset (inches, already converted to px) into independent
 *  left/right/top/bottom distances for a single page-side's print guide — "inside" applies to
 *  the edge next to the spine/fold instead of "leftRight" there, since a bound page's gutter edge
 *  reasonably needs a different (usually larger) clearance than its outer edge. A standalone
 *  'single' page has no fold, so both its edges use leftRight. A 'spread' page's fold runs down
 *  its own horizontal center rather than along either outer edge — see `centerGutterInsetPx`. */
export function resolvePageInsetsPx(
  pageSide: PageSide,
  insetPx: { leftRight: number; topBottom: number; inside: number }
): { left: number; right: number; top: number; bottom: number } {
  const { leftRight, topBottom, inside } = insetPx
  if (pageSide === 'left') return { left: leftRight, right: inside, top: topBottom, bottom: topBottom }
  if (pageSide === 'right') return { left: inside, right: leftRight, top: topBottom, bottom: topBottom }
  return { left: leftRight, right: leftRight, top: topBottom, bottom: topBottom }
}

/** For a two-page 'spread', the "inside" clearance straddles the fold at the canvas's horizontal
 *  center rather than either outer edge — this is the half-width of that center gutter band, in
 *  px, for drawing the two extra guide lines flanking it (see DesignerCanvas / exportAlbum). */
export function centerGutterInsetPx(insetPx: { inside: number }): number {
  return insetPx.inside
}

export function edgeInsetToPx(inset: EdgeInset, pxPerIn: number): { leftRight: number; topBottom: number; inside: number } {
  return { leftRight: inset.leftRight * pxPerIn, topBottom: inset.topBottom * pxPerIn, inside: inset.inside * pxPerIn }
}
