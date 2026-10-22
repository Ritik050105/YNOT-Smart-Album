import { AlbumSize } from '@/types'

export function validateCoverSize(size: AlbumSize, albumSize: AlbumSize): string | null {
  if (![size.widthIn, size.heightIn, size.dpi].every((n) => Number.isFinite(n) && n > 0)) return 'Enter a positive width, height, and DPI.'
  if (size.widthIn < albumSize.widthIn || size.heightIn < albumSize.heightIn) return 'The cover cannot be smaller than the album spread.'
  if (size.widthIn * size.dpi > 30000 || size.heightIn * size.dpi > 30000) return 'Cover output dimensions must be below 30,000 pixels per side.'
  return null
}
