import { Spread } from '@/types'
import { computePlaceholderBoxes } from './layoutMath'

/** Keep the dragged selection in dock order; an unselected image drags alone. */
export function draggedPhotoIds(photoId: string, selectedIds: string[], visibleIds: string[]): string[] {
  return selectedIds.includes(photoId) ? visibleIds.filter((id) => selectedIds.includes(id)) : [photoId]
}

export function readDraggedPhotoIds(data: Pick<DataTransfer, 'getData'>, validIds: string[]): string[] {
  const single = data.getData('application/x-photo-id')
  let ids: unknown = [single]
  try {
    const multiple = data.getData('application/x-photo-ids')
    if (multiple) ids = JSON.parse(multiple)
  } catch {
    return []
  }
  return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && validIds.includes(id)))] : []
}
export function readTimelineFrame(transfer: Pick<DataTransfer, 'getData'>): { spreadId: string; frameId: string } | null {
  try {
    const value = JSON.parse(transfer.getData('application/x-album-frame'))
    return typeof value?.spreadId === 'string' && typeof value?.frameId === 'string' ? value : null
  } catch { return null }
}

/** Hit-test the visible photo, not the whole overview card underneath it. */
export function overviewPhotoAt(spread:Spread,x:number,y:number,width:number,height:number) {
  return computePlaceholderBoxes(spread,width,height).reverse().find(box=>{
    const placement=spread.placements.find(p=>p.placeholderId===box.placeholderId)
    if(!placement?.photoId||placement.hidden)return false
    const angle=-(placement.rotationDeg??0)*Math.PI/180,dx=x-box.x-box.width/2,dy=y-box.y-box.height/2
    return Math.abs(dx*Math.cos(angle)-dy*Math.sin(angle))<=box.width/2&&Math.abs(dx*Math.sin(angle)+dy*Math.cos(angle))<=box.height/2
  })
}

/** Use the decoded thumbnail, without the gallery's used-photo dimming. */
export function setPhotoDragPreview(data: Pick<DataTransfer, 'setDragImage'>, image: HTMLImageElement | null) {
  if (!image?.complete || !image.naturalWidth) return
  const scale = Math.min(1, 150 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  data.setDragImage(canvas, canvas.width / 2, canvas.height / 2)
}
