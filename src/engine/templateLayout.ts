import { PlaceholderRect } from '@/types'

export const GAP = 0.02

/** Normalized display geometry shared by crop ranking, previews, editor and export. */
export function resolveTemplateFrames(frames: PlaceholderRect[], aspect: number, marginPx = 0, gapPx = 0): PlaceholderRect[] {
  const width = 900, height = width / aspect
  const innerW = width - marginPx * 2, innerH = height - marginPx * 2
  const smallestCell = Math.min(...frames.flatMap(p => [p.width * innerW, p.height * innerH]))
  // Dense layouts retain at least half of every cell instead of letting spacing swallow photos.
  const gap = smallestCell > 0 ? Math.min(gapPx, smallestCell / 2) : gapPx
  return frames.map(p => ({ ...p,
    x: (marginPx + p.x * innerW + gap / 2) / width,
    y: (marginPx + p.y * innerH + gap / 2) / height,
    width: (p.width * innerW - gap) / width,
    height: (p.height * innerH - gap) / height,
  }))
}

export function rect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  preferredOrientation: PlaceholderRect['preferredOrientation'] = 'any'
): PlaceholderRect {
  return { id, x, y, width, height, preferredOrientation }
}

/** Splits `total` into `parts` buckets as evenly as possible (e.g. 10 into 3 -> [4,3,3]). */
export function distributeEvenly(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total % parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}

/** Picks the preferred-orientation hint from a rect's own aspect ratio. */
export function orientationFor(width: number, height: number): PlaceholderRect['preferredOrientation'] {
  const r = width / height
  if (r > 1.15) return 'landscape'
  if (r < 0.87) return 'portrait'
  return 'any'
}

/** Lays `count` placeholders into a "justified" grid (balanced rows, no ragged gaps — the same
 *  approach photo apps like Google/Apple Photos use) inside the sub-rectangle (x0,y0,w,h).
 *  `idOffset` keeps placeholder ids unique when this is combined with other placeholders (e.g.
 *  a hero cell). `rows` lets a caller force a specific row count instead of the auto-picked one
 *  (used by the template generator to produce multiple distinct grid shapes per photo count). */
export function placeGridInRect(
  idOffset: number,
  count: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rows?: number
): PlaceholderRect[] {
  const rowCount = Math.max(1, Math.min(count, rows ?? Math.round(Math.sqrt((count * h) / w))))
  const rowCounts = distributeEvenly(count, rowCount)
  const rowH = h / rowCount
  const placeholders: PlaceholderRect[] = []
  let idx = idOffset
  for (let r = 0; r < rowCount; r++) {
    const cols = rowCounts[r]
    if (cols === 0) continue
    const colW = w / cols
    for (let c = 0; c < cols; c++) {
      const px = x0 + c * colW + GAP / 2
      const py = y0 + r * rowH + GAP / 2
      const pw = colW - GAP
      const ph = rowH - GAP
      placeholders.push({ id: `p${idx}`, x: px, y: py, width: pw, height: ph, preferredOrientation: orientationFor(pw, ph) })
      idx++
    }
  }
  return placeholders
}

/** Signature used to dedupe templates whose geometry ends up identical (e.g. a forced row count
 *  that collapses to the same shape as the auto-picked one) — rounded so float noise doesn't
 *  produce false "unique" entries. */
export function geometrySignature(placeholders: PlaceholderRect[]): string {
  return placeholders
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.width.toFixed(3)},${p.height.toFixed(3)}`)
    .sort()
    .join('|')
}
