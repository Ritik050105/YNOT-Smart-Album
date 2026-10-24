import { computePlaceholderBoxes, DESIGN_WIDTH } from './layoutMath'
import { Spread, AlbumSize } from '@/types'

/** Bottom to top. Older albums retain image-first, text-on-top stacking. */
export function spreadLayers(spread: Spread) {
  const layers = [
    ...spread.placements.map(value => ({ kind: 'image' as const, id: value.placeholderId, value })),
    ...spread.textBoxes.map(value => ({ kind: 'text' as const, id: value.id, value })),
  ]
  const next = Math.max(-1, ...layers.map(l => l.value.zIndex ?? -1)) + 1
  return layers.map((layer, i) => ({ ...layer, rank: layer.value.zIndex ?? next + i }))
    .sort((a, b) => a.rank - b.rank)
}

export function layerMembers(spread: Spread, kind: string, id: string) {
  const layers = spreadLayers(spread)
  const selected = layers.find(l=>l.kind===kind&&l.id===id)
  return selected?.value.groupId ? layers.filter(l=>l.value.groupId===selected.value.groupId) : layers.filter(l=>l===selected)
}

export function groupGeometry(spread: Spread, groupId: string, albumSize: AlbumSize) {
  const size = spread.size ?? albumSize
  const height = DESIGN_WIDTH * size.heightIn / size.widthIn
  const boxes = computePlaceholderBoxes(spread, DESIGN_WIDTH, height)
  const members = spreadLayers(spread).filter(l=>l.value.groupId===groupId).flatMap(l=>{
    const box = l.kind==='image' ? boxes.find(b=>b.placeholderId===l.id) : undefined
    const rect = l.kind==='text' ? l.value : box ? {x:box.x/DESIGN_WIDTH,y:box.y/height,width:box.width/DESIGN_WIDTH,height:box.height/height} : null
    return rect ? [{...l,rect}] : []
  })
  if (!members.length) return null
  const x=Math.min(...members.map(l=>l.rect.x)), y=Math.min(...members.map(l=>l.rect.y))
  return {members,x,y,width:Math.max(...members.map(l=>l.rect.x+l.rect.width))-x,height:Math.max(...members.map(l=>l.rect.y+l.rect.height))-y}
}
