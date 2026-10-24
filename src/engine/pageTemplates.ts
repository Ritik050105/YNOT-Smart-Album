import { PhotoAsset, Spread } from '@/types'
import { computePlaceholderBoxes, DESIGN_WIDTH } from './layoutMath'
import { retemplateSpread } from './autoLayout'

export type TemplateScope = 'spread' | 'left' | 'right'

export function pagePlacements(spread: Spread, aspect: number, scope: TemplateScope) {
  if (scope === 'spread') return spread.placements.filter(p=>!p.locked)
  const boxes = computePlaceholderBoxes(spread, DESIGN_WIDTH, DESIGN_WIDTH / aspect)
  return spread.placements.filter(p => {
    if(p.locked)return false
    const box = boxes.find(b => b.placeholderId === p.placeholderId)
    return box && (scope === 'left' ? box.x + box.width <= DESIGN_WIDTH / 2 + .01 : box.x >= DESIGN_WIDTH / 2 - .01)
  })
}

export function applyPageTemplate(spread: Spread, templateId: string, photos: PhotoAsset[], aspect: number, keepOrder: boolean, scope: TemplateScope) {
  if (scope !== 'spread' && (spread.pageSide !== 'spread' || spread.isCover)) return spread
  const selected = pagePlacements(spread, aspect, scope)
  if(!selected.length)return spread
  if(scope==='spread'&&selected.length===spread.placements.length)return retemplateSpread(spread,templateId,photos,aspect,keepOrder)
  const factor=scope==='spread'?1:2
  const selectedIds = new Set(selected.map(p => p.placeholderId))
  const page = retemplateSpread({...spread, flipped:false, placements:selected, marginPx:spread.marginPx * factor, gapPx:spread.gapPx * factor}, templateId, photos, aspect / factor, keepOrder)
  if (page.templateId !== templateId || page.customBoxes) return spread
  const height = DESIGN_WIDTH / aspect
  const original = computePlaceholderBoxes(spread, DESIGN_WIDTH, height)
  const pageBoxes = computePlaceholderBoxes(page, DESIGN_WIDTH, height * factor)
  const preserved = original.filter(b => !selectedIds.has(b.placeholderId)).map(b => ({id:b.placeholderId,x:b.x / DESIGN_WIDTH,y:b.y / height,width:b.width / DESIGN_WIDTH,height:b.height / height,preferredOrientation:'any' as const}))
  const usedIds = new Set(preserved.map(b=>b.id))
  const ids = new Map(pageBoxes.map(b => {
    let id = `page-${scope}-${templateId}-${b.placeholderId}`
    while (usedIds.has(id)) id += '-new'
    usedIds.add(id)
    return [b.placeholderId, id]
  }))
  const replacement = pageBoxes.map(b => ({id:ids.get(b.placeholderId)!,x:(scope === 'right' ? .5 : 0) + b.x / DESIGN_WIDTH / factor,y:b.y / (height * factor),width:b.width / DESIGN_WIDTH / factor,height:b.height / (height * factor),preferredOrientation:'any' as const}))
  const replacements=page.placements.map(p=>({...p,placeholderId:ids.get(p.placeholderId)!}))
  let cursor=0
  const placements=spread.placements.flatMap(p=>!selectedIds.has(p.placeholderId)?[p]:cursor<replacements.length?[replacements[cursor++]]:[])
  placements.push(...replacements.slice(cursor))
  return {...spread,templateId:scope==='spread'?templateId:spread.templateId,flipped:false,customBoxes:[...preserved,...replacement],placements}

}
