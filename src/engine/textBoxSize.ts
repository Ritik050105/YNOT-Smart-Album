import { Text } from 'konva/lib/shapes/Text'
import { AlbumSize, TextBox } from '@/types'
import { DESIGN_WIDTH } from './layoutMath'
import { plainTextAlign } from './renderSpread'

/** Match Designer text layout; manual widths remain fixed for wrapping. */
export function fitTextBoxSize(box: TextBox, size: AlbumSize): TextBox {
  if(box.shape)return box
  // Preserve PSD glyph bounds while its original artwork is still used by the renderer.
  const art=box.sourceArtwork
  if(art&&!box.autoWidth&&Math.abs(box.fontSize/(box.width*900)-art.fontRatio)<.00001&&art.text===box.text&&art.fontFamily===box.fontFamily&&art.bold===box.bold&&art.italic===box.italic&&art.color===box.color&&!box.underline&&!box.strikeThrough&&!box.letterSpacing&&!Object.values(box.effects??{}).some(e=>e?.enabled))return box
  const node = new Text({ text: box.text || ' ', letterSpacing:box.letterSpacing??0,lineHeight:box.lineHeight??1.2, width: box.autoWidth ? undefined : Math.max(1, box.width * DESIGN_WIDTH), fontFamily: box.fontFamily, fontSize: box.fontSize, fontStyle: `${box.bold ? 'bold' : ''} ${box.italic ? 'italic' : ''}`.trim() || 'normal' })
  const width = box.autoWidth ? Math.min(1, Math.max(12, Math.ceil(node.width()) + 1) / DESIGN_WIDTH) : box.width
  node.width(width * DESIGN_WIDTH)
  const edge = plainTextAlign(box.align)
  const shift = edge === 'center' ? (box.width - width) / 2 : edge === 'right' ? box.width - width : 0
  const x = box.autoWidth ? Math.max(0, Math.min(1 - width, box.x + shift)) : box.x
  const height = node.height() / (DESIGN_WIDTH * size.heightIn / size.widthIn)
  node.destroy()
  return { ...box, x, width, height }
}
