import { TemplateDefinition } from '@/types'

/** The kind of pattern a layout is, ignoring mirroring and exact proportions: how the page is first cut (a
 *  straight line top to bottom, side to side, both, or neither), whether one frame dominates, evenly sized
 *  frames or a mix of sizes, and how many grid lines it is built on. A layout and its mirror, or the same cut at
 *  another size, share a class; a rows layout, a columns layout, a feature-and-grid and a pinwheel do not. */
const classes = new WeakMap<TemplateDefinition['placeholders'], string>()
export function patternClass(t: TemplateDefinition): string {
  let hit = classes.get(t.placeholders)
  if (hit) return hit
  const f = t.placeholders, tol = 0.03
  const lines = (edges: number[]) => { const out: number[] = []; for (const v of [...edges].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > tol) out.push(v); return out }
  const xs = lines(f.flatMap(p => [p.x, p.x + p.width])), ys = lines(f.flatMap(p => [p.y, p.y + p.height]))
  const cuts = (list: number[], from: 'x' | 'y', size: 'width' | 'height') => list.filter(v => v > tol && v < 1 - tol && f.every(p => p[from] + p[size] <= v + tol || p[from] >= v - tol)).length
  const across = cuts(xs, 'x', 'width'), down = cuts(ys, 'y', 'height')
  const areas = f.map(p => p.width * p.height), big = Math.max(...areas), small = Math.min(...areas)
  const weight = big >= 0.4 ? 'H' : big / small <= 1.6 ? 'E' : 'M'
  hit = `${across && down ? '+' : across ? '|' : down ? '-' : '@'}${weight}${xs.length}x${ys.length}`
  classes.set(t.placeholders, hit)
  return hit
}

