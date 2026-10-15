import { AlbumSize } from '@/types'

/** A starter set of standard album/print sizes with print-safe bleed + target DPI (stand-ins for the
 *  170+ print-lab spec presets the production app would ship with). */
export const ALBUM_SIZES: AlbumSize[] = [
  { id: '10x10', label: '10" x 10" Square', widthIn: 10, heightIn: 10, bleedIn: 0.125, dpi: 300 },
  { id: '12x12', label: '12" x 12" Square', widthIn: 12, heightIn: 12, bleedIn: 0.125, dpi: 300 },
  { id: '8x10', label: '8" x 10" Portrait', widthIn: 8, heightIn: 10, bleedIn: 0.125, dpi: 300 },
  { id: '10x8', label: '10" x 8" Landscape', widthIn: 10, heightIn: 8, bleedIn: 0.125, dpi: 300 },
  { id: '11x14', label: '11" x 14" Portrait', widthIn: 11, heightIn: 14, bleedIn: 0.125, dpi: 300 },
  { id: 'a4-landscape', label: 'A4 Landscape (Magazine)', widthIn: 11.69, heightIn: 8.27, bleedIn: 0.125, dpi: 300 },
]

export const DEFAULT_ALBUM_SIZE = ALBUM_SIZES[1]
