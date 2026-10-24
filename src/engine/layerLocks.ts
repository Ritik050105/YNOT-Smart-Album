import { Project } from '@/types'
import { computePlaceholderBoxes, DESIGN_WIDTH } from './layoutMath'

// Check the saved geometry too: a template or margin edit can move an unchanged placement.
export function changesLockedLayer(before: Project, after: Project): boolean {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  return before.spreads.some(old => {
    if (!old.backgroundLocked && !old.placements.some(p=>p.locked) && !old.textBoxes.some(t=>t.locked)) return false
    const next=after.spreads.find(s=>s.id===old.id)
    if (!next) return true
    if (old.backgroundLocked && (!next.backgroundLocked || !same(old.backgroundPattern,next.backgroundPattern) || old.backgroundColor!==next.backgroundColor)) return true
    if (old.textBoxes.some(t=>t.locked && !same(t,next.textBoxes.find(n=>n.id===t.id)))) return true
    const oldSize=old.size??before.size, nextSize=next.size??after.size
    if (!same(oldSize,nextSize)) return true
    const a=computePlaceholderBoxes(old,DESIGN_WIDTH,DESIGN_WIDTH*oldSize.heightIn/oldSize.widthIn)
    const b=computePlaceholderBoxes(next,DESIGN_WIDTH,DESIGN_WIDTH*nextSize.heightIn/nextSize.widthIn)
    return old.placements.some(p=>p.locked && (!same(p,next.placements.find(n=>n.placeholderId===p.placeholderId)) || !same(a.find(n=>n.placeholderId===p.placeholderId),b.find(n=>n.placeholderId===p.placeholderId))))
  })
}
