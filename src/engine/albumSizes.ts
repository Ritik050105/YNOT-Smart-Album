import { AlbumSize, EdgeInset } from '@/types'

const BLEED_IN = 0.125
const SAFE_ZONE_IN = 0.25
const DPI = 300

export function uniformInset(valueIn: number): EdgeInset {
  return { leftRight: valueIn, topBottom: valueIn, inside: valueIn }
}

function size(id: string, label: string, category: AlbumSize['category'], widthIn: number, heightIn: number): AlbumSize {
  return { id, label, category, widthIn, heightIn, trim: uniformInset(BLEED_IN), safeZone: uniformInset(SAFE_ZONE_IN), dpi: DPI }
}

/**
 * A general-purpose library of common album/print dimensions, grouped by shape. These are
 * generic sizes with a standard 0.125" bleed and 300 DPI target — not sourced from any
 * specific print lab's published spec sheet. For an exact production run, confirm the final
 * trim size and bleed against the chosen lab's own requirements before sending files.
 */
export const ALBUM_SIZES: AlbumSize[] = [
  size('sq-5', '5" x 5" Square', 'Square', 5, 5),
  size('sq-6', '6" x 6" Square', 'Square', 6, 6),
  size('sq-8', '8" x 8" Square', 'Square', 8, 8),
  size('sq-10', '10" x 10" Square', 'Square', 10, 10),
  size('sq-12', '12" x 12" Square', 'Square', 12, 12),
  size('sq-14', '14" x 14" Square', 'Square', 14, 14),
  size('sq-16', '16" x 16" Square', 'Square', 16, 16),

  size('pt-5x7', '5" x 7" Portrait', 'Portrait', 5, 7),
  size('pt-8x10', '8" x 10" Portrait', 'Portrait', 8, 10),
  size('pt-11x14', '11" x 14" Portrait', 'Portrait', 11, 14),
  size('pt-12x16', '12" x 16" Portrait', 'Portrait', 12, 16),
  size('pt-16x20', '16" x 20" Portrait', 'Portrait', 16, 20),

  size('ls-7x5', '7" x 5" Landscape', 'Landscape', 7, 5),
  size('ls-10x8', '10" x 8" Landscape', 'Landscape', 10, 8),
  size('ls-14x11', '14" x 11" Landscape', 'Landscape', 14, 11),
  size('ls-16x12', '16" x 12" Landscape', 'Landscape', 16, 12),
  size('ls-20x16', '20" x 16" Landscape', 'Landscape', 20, 16),

  size('pan-12x6', '12" x 6" Panoramic', 'Panoramic', 12, 6),
  size('pan-18x6', '18" x 6" Panoramic', 'Panoramic', 18, 6),
  size('pan-20x8', '20" x 8" Panoramic', 'Panoramic', 20, 8),

  size('a4-portrait', 'A4 Portrait', 'Magazine', 8.27, 11.69),
  size('a4-landscape', 'A4 Landscape', 'Magazine', 11.69, 8.27),
  size('letter-portrait', 'US Letter Portrait', 'Magazine', 8.5, 11),
  size('letter-landscape', 'US Letter Landscape', 'Magazine', 11, 8.5),
]

export const ALBUM_SIZE_CATEGORIES: AlbumSize['category'][] = ['Square', 'Portrait', 'Landscape', 'Panoramic', 'Magazine']

export const DEFAULT_ALBUM_SIZE = ALBUM_SIZES.find((s) => s.id === 'sq-12')!
