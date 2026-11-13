import { PlaceholderRect } from '@/types'

export const GAP = 0.02

/** Normalized display geometry shared by crop ranking, previews, editor and export. */
export function resolveTemplateFrames(frames: PlaceholderRect[], aspect: number, marginPx = 0, gapPx = 0): PlaceholderRect[] {
  // Collapse small authored gutters to shared boundaries before applying the album gap.
  // Wide editorial whitespace and overlapping designs retain their intended geometry.
  frames=frames.map(p=>{
    // An authored full-bleed frame is final. It also already meets its neighbours exactly, and the
    // widening below measures the gap to every other frame, not just the adjacent one, so on a
    // flush grid of small cells it would swallow half a cell in each direction.
    if(p.bleed)return p
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
  // A frame authored full-bleed keeps its outer edges: the album margin is what would put a white
  // border round a design meant to run off the page. The gap still applies where it meets another
  // frame, though — a photo running to the edge of the sheet and a photo beside it are two
  // photographs, and the space the designer asked for between photographs belongs there.
  const gx = gap / 2 / width, gy = gap / 2 / height
  const bleedFrame = (p: PlaceholderRect) => {
    const left = p.x > 0.001 ? p.x + gx : p.x
    const top = p.y > 0.001 ? p.y + gy : p.y
    const right = p.x + p.width < 0.999 ? p.x + p.width - gx : p.x + p.width
    const bottom = p.y + p.height < 0.999 ? p.y + p.height - gy : p.y + p.height
    return { ...p, x: left, y: top, width: Math.max(0.002, right - left), height: Math.max(0.002, bottom - top) }
  }
  return frames.map(p => p.bleed ? bleedFrame(p) : ({ ...p,
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
   // The right gap is the common case, so test it first and only look for a frame in between when it is wrong.
   if(Math.abs(gap-gapPx)<=.1)continue
   if(resolved.some(c=>c!==a&&c!==b&&c[axis]<b[axis]-.1&&c[axis]+c[dim]>from+.1&&c[cross]<high-.1&&c[cross]+c[crossDim]>low+.1))continue
   return false
  }
 }
 return true
}

/** Whether the page is framed evenly: the blank edge round the layout is the same on all four
 *  sides, so the border reads as one margin rather than a wider strip on one side. Measured on the
 *  frames as they are drawn, with the album's own margin and gap applied. */
export function hasEvenMargins(frames:PlaceholderRect[],aspect:number,marginPx:number,gapPx:number){
 const resolved=resolveTemplateFrames(frames,aspect,marginPx,gapPx),height=900/aspect
 if(!resolved.length)return false
 const sides=[Math.min(...resolved.map(p=>p.x))*900,(1-Math.max(...resolved.map(p=>p.x+p.width)))*900,Math.min(...resolved.map(p=>p.y))*height,(1-Math.max(...resolved.map(p=>p.y+p.height)))*height]
 return Math.max(...sides)-Math.min(...sides)<=1
}

/** The largest frame over the smallest, by area. A layout past about 6 is one hero and a scatter of
 *  postage stamps, which is what reads as uneven rather than designed. */
export function frameSizeSpread(frames:PlaceholderRect[]){
 const areas=frames.map(p=>p.width*p.height).filter(a=>a>0)
 return areas.length?Math.max(...areas)/Math.min(...areas):Infinity
}

/** Re-spaces frames that were stored as absolute boxes when the album's margin or gap changes.
 *
 *  A spread keeps `customBoxes` as soon as anything moves a frame by hand, and an imported design
 *  arrives with them already set. Those boxes are final coordinates, so `computePlaceholderBoxes`
 *  returns them untouched — which is right for the artwork, and wrong for the two controls whose
 *  whole job is to re-space the page. Changing Gap simply did nothing on such a spread.
 *
 *  The frames are re-spaced the way `resolveTemplateFrames` spaces a template: the layout is
 *  mapped from the old inner rectangle into the new one for the margin, and half the gap change is
 *  taken off each interior edge. An edge sitting on the trim stays on the trim — a photograph run
 *  to the paper's edge is not holding a gap against anything. */
export function respaceBoxes(
  boxes: PlaceholderRect[], aspect: number,
  from: { marginPx: number; gapPx: number }, to: { marginPx: number; gapPx: number },
): PlaceholderRect[] {
  const width = 900, height = width / aspect
  const onTrim = (v: number, edge: number) => Math.abs(v - edge) < 0.004
  const map = (value: number, span: number, oldMargin: number, newMargin: number) =>
    (newMargin + (value * span - oldMargin) * (span - newMargin * 2) / Math.max(1e-6, span - oldMargin * 2)) / span
  const dx = (to.gapPx - from.gapPx) / 2 / width, dy = (to.gapPx - from.gapPx) / 2 / height
  return boxes.map((p) => {
    const edges = { left: onTrim(p.x, 0), top: onTrim(p.y, 0), right: onTrim(p.x + p.width, 1), bottom: onTrim(p.y + p.height, 1) }
    let left = edges.left ? 0 : map(p.x, width, from.marginPx, to.marginPx) + dx
    let top = edges.top ? 0 : map(p.y, height, from.marginPx, to.marginPx) + dy
    let right = edges.right ? 1 : map(p.x + p.width, width, from.marginPx, to.marginPx) - dx
    let bottom = edges.bottom ? 1 : map(p.y + p.height, height, from.marginPx, to.marginPx) - dy
    // Never let spacing eat a frame: a gap wider than the cell leaves it at a tenth of its size
    // rather than inverted or gone.
    if (right - left < p.width * 0.1) { const mid = (left + right) / 2, half = p.width * 0.05; left = mid - half; right = mid + half }
    if (bottom - top < p.height * 0.1) { const mid = (top + bottom) / 2, half = p.height * 0.05; top = mid - half; bottom = mid + half }
    return { ...p, x: left, y: top, width: right - left, height: bottom - top }
  })
}
