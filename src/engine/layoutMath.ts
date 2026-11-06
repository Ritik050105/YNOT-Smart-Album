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

/** Landscape, portrait, or square — with a deadband, so a frame or photo that is only slightly
 *  off square counts as square and fits anywhere. */
export function shapeOf(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  if (!(width > 0) || !(height > 0)) return 'square'
  const ratio = width / height
  return ratio > 1.15 ? 'landscape' : ratio < 1 / 1.15 ? 'portrait' : 'square'
}

/** Whether a photo belongs in a frame of this shape. A portrait photo in a landscape frame — or a
 *  landscape photo in a portrait one — throws away most of the subject to fill the frame, so both
 *  are refused by default and the designer has to ask for them. A square frame, or a roughly
 *  square photo, takes anything. */
export function orientationFits(photo: { width: number; height: number }, frame: { width: number; height: number }) {
  const p = shapeOf(photo.width, photo.height), target = shapeOf(frame.width, frame.height)
  return p === target || p === 'square' || target === 'square'
}

export function boundedFrameRect(rect: { x: number; y: number; width: number; height: number }) {
  if (!Object.values(rect).every(Number.isFinite)) throw new Error('Frame coordinates must be finite numbers.')
  return { x: rect.x, y: rect.y, width: Math.max(0.002, rect.width), height: Math.max(0.002, rect.height) }
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
