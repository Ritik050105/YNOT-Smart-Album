import { Text } from 'konva/lib/shapes/Text'
import { AlbumSize, TextBox } from '@/types'
import { DESIGN_WIDTH } from './layoutMath'

/** Match Designer text layout; manual widths remain fixed for wrapping. */
export function fitTextBoxSize(box: TextBox, size: AlbumSize): TextBox {
  const node = new Text({ text: box.text || ' ', width: box.autoWidth ? undefined : Math.max(1, box.width * DESIGN_WIDTH), fontFamily: box.fontFamily, fontSize: box.fontSize, fontStyle: `${box.bold ? 'bold' : ''} ${box.italic ? 'italic' : ''}`.trim() || 'normal' })
  const width = box.autoWidth ? Math.min(1, Math.max(12, Math.ceil(node.width()) + 1) / DESIGN_WIDTH) : box.width
  node.width(width * DESIGN_WIDTH)
  const shift = box.align === 'center' ? (box.width - width) / 2 : box.align === 'right' ? box.width - width : 0
  const x = box.autoWidth ? Math.max(0, Math.min(1 - width, box.x + shift)) : box.x
  const height = node.height() / (DESIGN_WIDTH * size.heightIn / size.widthIn)
  node.destroy()
  return { ...box, x, width, height }
}

export function textAutoFitSummary(boxes: TextBox[], ids: string[]): string {
  const selected = boxes.filter(box => ids.includes(box.id))
  const eligible = selected.filter(box => !box.locked && !box.hidden).length
  const locked = selected.filter(box => box.locked).length
  const hidden = selected.filter(box => box.hidden && !box.locked).length
  return `${eligible} to auto-fit · ${locked} locked (skipped)${hidden ? ` · ${hidden} hidden (skipped)` : ''}`
}
