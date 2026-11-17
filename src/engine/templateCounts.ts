/** How many templates the browser offers for each photo combination: the numbers of "YNOT Album Templates Count.xlsx", as docs/template-counts.md.
 *
 *  A combination is the number of photographs and how many of them are horizontal (the rest are vertical). The sheet gives specific counts up to five
 *  photographs and 200 for every combination from six to twenty-four. A photograph is horizontal when it is at least as wide as it is tall. */
const UP_TO_FIVE: Record<string, number> = {
  // "photos:horizontal"
  '1:0': 27, '1:1': 36,
  '2:0': 33, '2:2': 62, '2:1': 60,
  '3:0': 43, '3:3': 41, '3:1': 78, '3:2': 98,
  '4:0': 68, '4:4': 100, '4:1': 143, '4:3': 160, '4:2': 147,
  '5:0': 65, '5:5': 100, '5:1': 183, '5:4': 165, '5:2': 172, '5:3': 161,
}
export const MANY_PHOTOS_TEMPLATES = 200
/** What a shelf is brought up to when the photographs are not known (a count with no photographs picked). */
export const DEFAULT_TEMPLATES = 30

/** The templates required for this many photographs, this many of them horizontal. */
export function templatesRequired(photos: number, horizontal: number): number {
  if (photos < 1) return 0
  return photos <= 5 ? UP_TO_FIVE[`${photos}:${horizontal}`] ?? DEFAULT_TEMPLATES : MANY_PHOTOS_TEMPLATES
}

/** The templates required for these photographs. */
export function wantedTemplates(photos: { width: number; height: number }[]): number {
  if (!photos.length) return DEFAULT_TEMPLATES
  return templatesRequired(photos.length, photos.filter(p => p.width >= p.height).length)
}
