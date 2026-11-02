import { TextBox } from '@/types'
import { useProjectStore } from '@/state/projectStore'

const MIME = 'application/x-font-template'
// dataTransfer can only carry strings, so the boxes being dragged live here for the duration of the drag.
let dragged: TextBox[] | null = null

export function startFontTemplateDrag(data: DataTransfer, boxes: TextBox[]) {
  dragged = boxes
  data.setData(MIME, '1')
  data.effectAllowed = 'copy'
}
export const endFontTemplateDrag = () => { dragged = null }
export const isFontTemplateDrag = (data: DataTransfer) => !!dragged && Array.from(data.types).includes(MIME)

/** Adds the dragged font template to a spread as one new group, centred on (nx, ny) in 0–1 spread coordinates and kept on the page. */
export function dropFontTemplate(spreadId: string, nx: number, ny: number) {
  const source = dragged
  dragged = null
  if (!source?.length) return false
  const spread = useProjectStore.getState().project.spreads.find(s => s.id === spreadId)
  if (!spread) return false
  const left = Math.min(...source.map(b => b.x)), top = Math.min(...source.map(b => b.y))
  const width = Math.max(...source.map(b => b.x + b.width)) - left, height = Math.max(...source.map(b => b.y + b.height)) - top
  const dx = Math.max(0, Math.min(1 - width, nx - width / 2)) - left
  const dy = Math.max(0, Math.min(1 - height, ny - height / 2)) - top
  const groupId = crypto.randomUUID()
  const boxes = source.map(b => ({ ...b, id: crypto.randomUUID(), groupId, x: b.x + dx, y: b.y + dy }))
  useProjectStore.getState().updateSpread(spreadId, { textBoxes: [...spread.textBoxes, ...boxes] })
  useProjectStore.getState().setLayerSelection(boxes.map(b => 'text:' + b.id))
  return true
}
