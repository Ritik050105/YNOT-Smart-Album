import { FOLD_FREE_COUNT, Mode, modeWord, photosWord } from './showcaseLayouts'

/** Every way a set of photographs can be shared out over a spread, each one a family of templates.
 *
 *  The photographs go on the left page, the right page, both pages (the first k on the left, the rest on the right) or across the whole
 *  spread; and each page, or the spread, is set one of three ways: "full" (the photographs run to the trim), "fill" (they fill it to the
 *  album's margin) or "loose" (they sit on it with white round them, named with the page alone). That is nine families for every count:
 *  three for the spread, three for everything on the left page, three for everything on the right, and nine for each of the n-1 splits
 *  between the pages, 9n in all. A family has as many templates as there are different ways to tile the photographs it holds. */
export interface Combination {
  /** The count of photographs. */
  count: number
  kind: 'spread' | 'left' | 'right' | 'split'
  /** Photographs on the left page of a split (the rest are on the right). */
  split?: number
  left?: Mode
  right?: Mode
  spread?: Mode
  label: string
  /** Across the fold: only offered up to a few photographs, so the families that put photographs across it stop there. */
  acrossFold: boolean
}

const MODES: Mode[] = ['full', 'fill', 'loose']

export function combinationsFor(count: number): Combination[] {
  const out: Combination[] = []
  for (const mode of MODES) out.push({ count, kind: 'spread', spread: mode, label: `${photosWord(count)} ${modeWord(mode)}spread`, acrossFold: true })
  for (const mode of MODES) out.push({ count, kind: 'left', left: mode, label: `${photosWord(count)} ${modeWord(mode)}left`, acrossFold: false })
  for (const mode of MODES) out.push({ count, kind: 'right', right: mode, label: `${photosWord(count)} ${modeWord(mode)}right`, acrossFold: false })
  for (let k = 1; k < count; k++) for (const l of MODES) for (const r of MODES) out.push({ count, kind: 'split', split: k, left: l, right: r, label: `${photosWord(k)} ${modeWord(l)}left · ${photosWord(count - k)} ${modeWord(r)}right`, acrossFold: false })
  return out
}

/** Whether the fold rule allows this family for this many photographs. */
export const allowedAtCount = (c: Combination) => !c.acrossFold || c.count <= FOLD_FREE_COUNT
