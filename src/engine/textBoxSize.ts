import { Text } from 'konva/lib/shapes/Text'
import { AlbumSize, TextBox } from '@/types'
import { DESIGN_WIDTH } from './layoutMath'

/** Match the Designer text layout while retaining the chosen wrapping width. */
export function fitTextBoxHeight(box: TextBox, size: AlbumSize): TextBox {
  const node = new Text({ text: box.text || ' ', width: Math.max(1, box.width * DESIGN_WIDTH), fontFamily: box.fontFamily, fontSize: box.fontSize, fontStyle: `${box.bold ? 'bold' : ''} ${box.italic ? 'italic' : ''}`.trim() || 'normal' })
  const height = node.height() / (DESIGN_WIDTH * size.heightIn / size.widthIn)
  node.destroy()
  return { ...box, height }
}
