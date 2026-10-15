/** All sizes are stored in inches internally; this only affects what the UI displays/accepts. */
const IN_PER_CM = 1 / 2.54

export function inToDisplay(valueIn: number, unit: 'in' | 'cm'): number {
  const v = unit === 'cm' ? valueIn / IN_PER_CM : valueIn
  return Math.round(v * 100) / 100
}

export function displayToIn(value: number, unit: 'in' | 'cm'): number {
  return unit === 'cm' ? value * IN_PER_CM : value
}
