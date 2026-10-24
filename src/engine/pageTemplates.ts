import { PhotoAsset, Spread } from '@/types'
import { computePlaceholderBoxes, DESIGN_WIDTH } from './layoutMath'
import { retemplateSpread } from './autoLayout'

export type TemplateScope = 'spread' | 'left' | 'right'

export function pagePlacements(spread: Spread, aspect: number, scope: TemplateScope) {
  if (scope === 'spread') return spread.placements
  const boxes = computePlaceholderBoxes(spread, DESIGN_WIDTH, DESIGN_WIDTH / aspect)
  return spread.placements.filter(p => {
    const box = boxes.find(b => b.placeholderId === p.placeholderId)
    return box && (scope === 'left' ? box.x + box.width <= DESIGN_WIDTH / 2 + .01 : box.x >= DESIGN_WIDTH / 2 - .01)
  })
}

export function applyPageTemplate(spread: Spread, templateId: string, photos: PhotoAsset[], aspect: number, keepOrder: boolean, scope: TemplateScope) {
  if (scope === 'spread') return retemplateSpread(spread, templateId, photos, aspect, keepOrder)
  if (spread.pageSide !== 'spread' || spread.isCover) return spread
  const selected = pagePlacements(spread, aspect, scope)
  const selectedIds = new Set(selected.map(p => p.placeholderId))
  const page = retemplateSpread({...spread, flipped:false, placements:selected, marginPx:spread.marginPx * 2, gapPx:spread.gapPx * 2}, templateId, photos, aspect / 2, keepOrder)
  if (page.templateId !== templateId || page.customBoxes) return spread
  const height = DESIGN_WIDTH / aspect
  const original = computePlaceholderBoxes(spread, DESIGN_WIDTH, height)
  const pageBoxes = computePlaceholderBoxes(page, DESIGN_WIDTH, height * 2)
  const preserved = original.filter(b => !selectedIds.has(b.placeholderId)).map(b => ({id:b.placeholderId,x:b.x / DESIGN_WIDTH,y:b.y / height,width:b.width / DESIGN_WIDTH,height:b.height / height,preferredOrientation:'any' as const}))
  const usedIds = new Set(preserved.map(b=>b.id))
  const ids = new Map(pageBoxes.map(b => {
    let id = `page-${scope}-${templateId}-${b.placeholderId}`
    while (usedIds.has(id)) id += '-new'
    usedIds.add(id)
    return [b.placeholderId, id]
  }))
  const replacement = pageBoxes.map(b => ({id:ids.get(b.placeholderId)!,x:(scope === 'left' ? 0 : .5) + b.x / DESIGN_WIDTH / 2,y:b.y / (height * 2),width:b.width / DESIGN_WIDTH / 2,height:b.height / (height * 2),preferredOrientation:'any' as const}))
  return {...spread,flipped:false,customBoxes:[...preserved,...replacement],placements:[...spread.placements.filter(p=>!selectedIds.has(p.placeholderId)),...page.placements.map(p=>({...p,placeholderId:ids.get(p.placeholderId)!}))]}
}
