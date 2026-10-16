/** All sizes are stored in inches internally; this only affects what the UI displays/accepts.
 *  "px" needs a reference resolution to convert against — callers pass the project's own print
 *  DPI so e.g. a 12" side reads as 3600px at 300 DPI, matching what it'll actually render at. */
const IN_PER_CM = 1 / 2.54

export type DisplayUnit = 'in' | 'cm' | 'px'

export function inToDisplay(valueIn: number, unit: DisplayUnit, dpi = 300): number {
  if (unit === 'px') return Math.round(valueIn * dpi)
  const v = unit === 'cm' ? valueIn / IN_PER_CM : valueIn
  return Math.round(v * 100) / 100
}

export function displayToIn(value: number, unit: DisplayUnit, dpi = 300): number {
  if (unit === 'px') return value / dpi
  return unit === 'cm' ? value * IN_PER_CM : value
}
