import { TextBox } from '@/types'

/** Previous / Next on a spread's font templates.
 *
 *  It replaces the template layer you are working on with the neighbouring template, and touches
 *  nothing else. Which layer that is comes from, in order: the layers that are selected (the ones the
 *  last placement or step selected, unless you picked another), the layers this panel last placed,
 *  then the template it last placed, then the first template on the spread.
 *
 *  Reaching a template that is already on the spread as another layer does not remove that layer: the
 *  stepped layer becomes a new layer of the template, set a little down and to the right of the
 *  others so it can be told apart, and every other layer stays exactly as it was. */
export interface StepTemplate { id: string; boxes: TextBox[] }

export interface StepInput {
  textBoxes: TextBox[]
  templates: StepTemplate[]
  direction: number
  /** Ids of the text layers selected now. */
  selectedIds: string[]
  /** Ids of the layers this panel placed last. */
  lastPlacedIds: string[]
  /** The template this panel placed last, if any. */
  activeId: string | null
  groupFor: (templateId: string) => string
  /** Fits a copy of a template's box to the spread, with a fresh id and the template's group. */
  copy: (box: TextBox, groupId: string) => TextBox
}

export interface StepResult { textBoxes: TextBox[]; placedIds: string[]; templateId: string }

export function stepFontTemplate(input: StepInput): StepResult | null {
  const { textBoxes, templates, direction, groupFor } = input
  if (!templates.length) return null
  // A layer's group is its template's group, with a number after it for a second and later layer of the
  // same template: layers of a group are selected and moved together, so two layers of one template must
  // not share one or picking the new layer would pick the old one too.
  const baseOf = (groupId: string) => groupId.split('#')[0]
  const groupToTemplate = new Map(templates.map(t => [groupFor(t.id), t.id]))
  const templateOf = (b: TextBox) => (b.groupId ? groupToTemplate.get(baseOf(b.groupId)) : undefined)
  const isTemplateLayer = (b: TextBox) => templateOf(b) !== undefined
  const ids = (list: TextBox[]) => new Set(list.map(b => b.id))

  // The layers to replace: the selected template layers if there are any, else the ones last placed.
  const selected = new Set(input.selectedIds)
  let owned = textBoxes.filter(b => selected.has(b.id) && isTemplateLayer(b))
  if (!owned.length) { const last = new Set(input.lastPlacedIds); owned = textBoxes.filter(b => last.has(b.id) && isTemplateLayer(b)) }
  const placedTemplates = new Set(textBoxes.filter(isTemplateLayer).map(templateOf))

  let current = owned.length ? templateOf(owned[0]) : undefined
  if (current === undefined) current = templates.find(t => t.id === input.activeId && placedTemplates.has(t.id))?.id ?? templates.find(t => placedTemplates.has(t.id))?.id
  const from = current === undefined ? -1 : templates.findIndex(t => t.id === current)
  const next = templates[from < 0 ? (direction > 0 ? 0 : templates.length - 1) : (from + direction + templates.length) % templates.length]

  // With nothing selected or remembered, the first layer of the current template is the one replaced.
  const replaced = owned.length ? ids(owned) : ids(current === undefined ? [] : textBoxes.filter(b => templateOf(b) === current).slice(0, templates.find(t => t.id === current)!.boxes.length))
  const kept = textBoxes.filter(b => !replaced.has(b.id))

  const base = groupFor(next.id)
  const taken = new Set(kept.map(b => b.groupId))
  let groupId = base, n = 2
  while (taken.has(groupId)) groupId = `${base}#${n++}`
  const copies = new Set(kept.filter(b => b.groupId && baseOf(b.groupId) === base).map(b => b.groupId)).size
  const nudge = Math.min(0.12, copies * 0.03)
  const boxes = next.boxes.map(b => {
    const fit = input.copy(b, groupId)
    return nudge ? { ...fit, x: Math.max(0, Math.min(1 - fit.width, fit.x + nudge)), y: Math.max(0, Math.min(1 - fit.height, fit.y + nudge)) } : fit
  })
  return { textBoxes: [...kept, ...boxes], placedIds: boxes.map(b => b.id), templateId: next.id }
}
