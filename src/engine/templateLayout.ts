import { PlaceholderRect } from '@/types'

export const GAP = 0.02

/** Normalized display geometry shared by crop ranking, previews, editor and export. */
export function resolveTemplateFrames(frames: PlaceholderRect[], aspect: number, marginPx = 0, gapPx = 0): PlaceholderRect[] {
  // Collapse small authored gutters to shared boundaries before applying the album gap.
  // Wide editorial whitespace and overlapping designs retain their intended geometry.
  frames=frames.map(p=>{
    let left=p.x,right=p.x+p.width,top=p.y,bottom=p.y+p.height
    for(const q of frames){if(q===p)continue
      if(Math.min(p.y+p.height,q.y+q.height)-Math.max(p.y,q.y)>.001){
        const before=p.x-q.x-q.width,after=q.x-p.x-p.width
        if(before>=0&&before<=.04)left=Math.min(left,p.x-before/2)
        if(after>=0&&after<=.04)right=Math.max(right,p.x+p.width+after/2)
      }
      if(Math.min(p.x+p.width,q.x+q.width)-Math.max(p.x,q.x)>.001){
        const before=p.y-q.y-q.height,after=q.y-p.y-p.height
        if(before>=0&&before<=.04)top=Math.min(top,p.y-before/2)
        if(after>=0&&after<=.04)bottom=Math.max(bottom,p.y+p.height+after/2)
      }
    }
    return {...p,x:left,y:top,width:right-left,height:bottom-top}
  })
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

/** Reference-style suggestions must preserve the chosen gap across neighboring frames. */
export function supportsUniformGap(frames:PlaceholderRect[],aspect:number,marginPx:number,gapPx:number){
 const resolved=resolveTemplateFrames(frames,aspect,marginPx,gapPx).map(p=>({x:p.x*900,y:p.y*900/aspect,width:p.width*900,height:p.height*900/aspect}))
 if(resolved.some(p=>p.width<=0||p.height<=0))return false
 for(const axis of ['x','y'] as const){
  const dim=axis==='x'?'width':'height',cross=axis==='x'?'y':'x',crossDim=axis==='x'?'height':'width'
  for(const a of resolved)for(const b of resolved){
   const low=Math.max(a[cross],b[cross]),high=Math.min(a[cross]+a[crossDim],b[cross]+b[crossDim]),from=a[axis]+a[dim],gap=b[axis]-from
   if(a===b||high-low<.1||gap<-.1)continue
   if(resolved.some(c=>c!==a&&c!==b&&c[axis]<b[axis]-.1&&c[axis]+c[dim]>from+.1&&c[cross]<high-.1&&c[cross]+c[crossDim]>low+.1))continue
   if(Math.abs(gap-gapPx)>.1)return false
  }
 }
 return true
}
