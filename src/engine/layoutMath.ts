import { Spread } from '@/types'
import { findTemplate } from './templates'

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
  spread: Pick<Spread, 'templateId' | 'marginPx' | 'gapPx' | 'flipped'>,
  canvasWidthPx: number,
  canvasHeightPx: number
): PlaceholderBox[] {
  const template = findTemplate(spread.templateId)
  if (!template) return []

  const margin = spread.marginPx
  const gap = spread.gapPx
  const innerW = canvasWidthPx - margin * 2
  const innerH = canvasHeightPx - margin * 2

  return template.placeholders.map((ph) => {
    const x = spread.flipped ? 1 - ph.x - ph.width : ph.x
    return {
      placeholderId: ph.id,
      x: margin + x * innerW + gap / 2,
      y: margin + ph.y * innerH + gap / 2,
      width: ph.width * innerW - gap,
      height: ph.height * innerH - gap,
    }
  })
}
