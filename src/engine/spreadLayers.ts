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
  return selectionGeometry(spread, spreadLayers(spread).filter(l=>l.value.groupId===groupId).map(l=>l.kind+':'+l.id), albumSize)
}

export function selectionGeometry(spread: Spread, keys: string[], albumSize: AlbumSize) {
  const size = spread.size ?? albumSize
  const height = DESIGN_WIDTH * size.heightIn / size.widthIn
  const boxes = computePlaceholderBoxes(spread, DESIGN_WIDTH, height)
  const selected=spreadLayers(spread).filter(l=>keys.includes(l.kind+':'+l.id))
  const groups=new Set(selected.map(l=>l.value.groupId).filter(Boolean))
  const members = spreadLayers(spread).filter(l=>keys.includes(l.kind+':'+l.id)||(l.value.groupId&&groups.has(l.value.groupId))).flatMap(l=>{
    const box = l.kind==='image' ? boxes.find(b=>b.placeholderId===l.id) : undefined
    const rect = l.kind==='text' ? l.value : box ? {x:box.x/DESIGN_WIDTH,y:box.y/height,width:box.width/DESIGN_WIDTH,height:box.height/height} : null
    return rect ? [{...l,rect}] : []
  })
  if (!members.length) return null
  const x=Math.min(...members.map(l=>l.rect.x)), y=Math.min(...members.map(l=>l.rect.y))
  return {members,x,y,width:Math.max(...members.map(l=>l.rect.x+l.rect.width))-x,height:Math.max(...members.map(l=>l.rect.y+l.rect.height))-y}
}

type LayerRect = {x:number;y:number;width:number;height:number}
export type LayerAlignment = 'left'|'center'|'right'|'top'|'middle'|'bottom'|'horizontal'|'vertical'

function applyLayerRects(spread:Spread,size:AlbumSize,rects:Map<string,LayerRect>) {
  const height=DESIGN_WIDTH*(spread.size??size).heightIn/(spread.size??size).widthIn
  const customBoxes=computePlaceholderBoxes(spread,DESIGN_WIDTH,height).map(b=>({id:b.placeholderId,...(rects.get('image:'+b.placeholderId)??{x:b.x/DESIGN_WIDTH,y:b.y/height,width:b.width/DESIGN_WIDTH,height:b.height/height}),preferredOrientation:'any' as const}))
  return {...spread,customBoxes,flipped:false,textBoxes:spread.textBoxes.map(t=>{
    const r=rects.get('text:'+t.id)
    return r?{...t,...r,fontSize:t.fontSize*Math.min(r.width/t.width,r.height/t.height)}:t
  })}
}

export function transformLayerSelection(spread:Spread,size:AlbumSize,keys:string[],target:LayerRect) {
  const g=selectionGeometry(spread,keys,size)
  if(!g||!g.width||!g.height||g.members.some(l=>l.value.locked||l.value.hidden)||!Object.values(target).every(Number.isFinite)||target.width<=0||target.height<=0)return spread
  const sx=target.width/g.width,sy=target.height/g.height
  return applyLayerRects(spread,size,new Map(g.members.map(l=>[l.kind+':'+l.id,{x:target.x+(l.rect.x-g.x)*sx,y:target.y+(l.rect.y-g.y)*sy,width:l.rect.width*sx,height:l.rect.height*sy}])))
}

/** Existing groups act as one unit, preserving the spacing inside each group. */
export function arrangeLayerSelection(spread:Spread,size:AlbumSize,keys:string[],mode:LayerAlignment) {
  const g=selectionGeometry(spread,keys,size)
  if(!g||g.members.some(l=>l.value.locked||l.value.hidden))return spread
  const ids=[...new Set(g.members.map(l=>l.value.groupId??l.kind+':'+l.id))]
  const units=ids.map(id=>{const members=g.members.filter(l=>(l.value.groupId??l.kind+':'+l.id)===id);return selectionGeometry(spread,members.map(l=>l.kind+':'+l.id),size)!})
  const distribute=mode==='horizontal'||mode==='vertical'
  if(units.length<(distribute?3:2))return spread
  const horizontal=['left','center','right','horizontal'].includes(mode),axis=horizontal?'x':'y',dimension=horizontal?'width':'height'
  units.sort((a,b)=>a[axis]-b[axis])
  const start=distribute?units[0][axis]:g[axis]
  const end=distribute?units.at(-1)![axis]+units.at(-1)![dimension]:g[axis]+g[dimension]
  const gap=(end-start-units.reduce((n,u)=>n+u[dimension],0))/(units.length-1)
  let cursor=start
  const rects=new Map<string,LayerRect>()
  for(const unit of units){
    const position=distribute?cursor:['left','top'].includes(mode)?start:['right','bottom'].includes(mode)?end-unit[dimension]:(start+end-unit[dimension])/2
    for(const l of unit.members)rects.set(l.kind+':'+l.id,{...l.rect,[axis]:l.rect[axis]+position-unit[axis]})
    cursor+=unit[dimension]+gap
  }
  return applyLayerRects(spread,size,rects)
}
