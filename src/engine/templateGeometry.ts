import { PlaceholderRect } from '@/types'

/** Reads a layer's own alpha channel to tell a rounded rectangle from a square one. Walks in along
 *  the top-left diagonal until the pixel turns opaque: for a corner arc of radius r the diagonal
 *  meets it r - r/√2 from the corner, so the inset scales straight back up to the radius. Returns 0
 *  unless all four corners agree and the edge midpoints are solid — anything else is a cut-out or
 *  an irregular shape, not a rounded frame. */
export interface Bounds { x: number; y: number; width: number; height: number }

/** The box that actually has pixels in it. A Photoshop layer's canvas is often far larger than its
 *  artwork — a masked or clipped layer keeps the whole source image, and a shape layer carries the
 *  padding its effects need — so the raw layer bounds describe a frame much bigger than the design
 *  shows. Returns null when the layer is empty. */
export function opaqueBounds(canvas: HTMLCanvasElement): Bounds | null {
  const w = canvas.width, h = canvas.height
  if (!w || !h) return null
  const data = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, w, h).data
  if (!data) return null
  // A layer canvas is the size of the document, and a busy PSD has dozens of them, so reading
  // every pixel of every layer is what made importing a large design crawl. The box is found on a
  // coarse grid and then grown by one grid step, which can only ever overstate it — and a step is
  // well under a pixel once the document is scaled into the 900px design space.
  const step = Math.max(1, Math.floor(Math.max(w, h) / 1500))
  const alpha = new Uint32Array(data.buffer, data.byteOffset, w * h)
  // Little-endian RGBA: alpha is the top byte.
  const opaque = (i: number) => (alpha[i] & 0xff000000) >>> 24 > 16
  let left = w, right = -1, top = h, bottom = -1
  for (let y = 0; y < h; y += step) {
    const row = y * w
    for (let x = 0; x < w; x += step) {
      if (!opaque(row + x)) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  if (step > 1) {
    left = Math.max(0, left - step); top = Math.max(0, top - step)
    right = Math.min(w - 1, right + step); bottom = Math.min(h - 1, bottom + step)
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** Corner radii read from a Photoshop vector mask. A shape layer's pixels are a plain rectangle —
 *  the rounding lives only in the path — so the alpha probe below can never see it. Photoshop puts
 *  an anchor on each corner it leaves square, and two anchors `r` along the edges of each corner it
 *  rounds, which is exactly what this measures. Returns null for anything that is not a rectangle,
 *  since a star or a blob has no corner radius to speak of. Radii are [topLeft, topRight,
 *  bottomRight, bottomLeft], in the document's own pixels. */
/** A path whose four anchors form a rectangle turned off the horizontal: the angle of its first
 *  edge, with the box measured along that edge rather than along the page. Returns null unless the
 *  four points really are a rectangle — opposite sides equal and corners square — so an arbitrary
 *  quadrilateral is left to the upright reading below. */
function rotatedRectangle(anchors: { x: number; y: number }[]): (Bounds & { rotationDeg: number }) | null {
  if (anchors.length !== 4) return null
  const side = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y)
  const w = side(anchors[0], anchors[1]), h = side(anchors[1], anchors[2])
  if (w < 2 || h < 2) return null
  const tol = Math.max(1.5, Math.min(w, h) * 0.02)
  if (Math.abs(side(anchors[2], anchors[3]) - w) > tol || Math.abs(side(anchors[3], anchors[0]) - h) > tol) return null
  // Square corners: the diagonals of a rectangle are equal.
  if (Math.abs(side(anchors[0], anchors[2]) - side(anchors[1], anchors[3])) > tol) return null
  const angle = Math.atan2(anchors[1].y - anchors[0].y, anchors[1].x - anchors[0].x) * 180 / Math.PI
  // Already upright (or a quarter turn, which is the same rectangle): let the upright reading have it.
  const normalized = ((angle % 180) + 180) % 180
  if (Math.min(normalized, Math.abs(normalized - 90), Math.abs(normalized - 180)) < 0.75) return null
  const cx = anchors.reduce((sum, a) => sum + a.x, 0) / 4, cy = anchors.reduce((sum, a) => sum + a.y, 0) / 4
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rotationDeg: angle }
}

export function vectorMaskGeometry(knots: { points: number[] }[]): (Bounds & { radii: [number, number, number, number]; rotationDeg?: number }) | null {
  const anchors = knots.map(k => ({ x: k.points[2], y: k.points[3] })).filter(a => Number.isFinite(a.x) && Number.isFinite(a.y))
  if (anchors.length < 4) return null
  const turned = rotatedRectangle(anchors)
  if (turned) return { ...turned, radii: [0, 0, 0, 0] }
  const xs = anchors.map(a => a.x), ys = anchors.map(a => a.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = maxX - minX, height = maxY - minY
  if (width < 2 || height < 2) return null
  const tol = Math.max(1.5, Math.min(width, height) * 0.002)
  const onEdge = (a: { x: number; y: number }) =>
    Math.abs(a.x - minX) <= tol || Math.abs(a.x - maxX) <= tol || Math.abs(a.y - minY) <= tol || Math.abs(a.y - maxY) <= tol
  if (!anchors.every(onEdge)) return null
  const radii = ([[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]] as const).map(([cx, cy]) => {
    if (anchors.some(a => Math.abs(a.x - cx) <= tol && Math.abs(a.y - cy) <= tol)) return 0
    const along = Math.min(...anchors.filter(a => Math.abs(a.y - cy) <= tol).map(a => Math.abs(a.x - cx)))
    const down = Math.min(...anchors.filter(a => Math.abs(a.x - cx) <= tol).map(a => Math.abs(a.y - cy)))
    const r = Math.min(along, down)
    return Number.isFinite(r) && r > 1 ? r : 0
  }) as [number, number, number, number]
  return { x: minX, y: minY, width, height, radii }
}

/** The part of a layer a raster mask leaves showing. A mask renders as greyscale — white keeps the
 *  pixel, black hides it — so this is the box of the pixels bright enough to survive. Returns null
 *  when the mask hides the layer entirely. */
export function maskVisibleBounds(canvas: HTMLCanvasElement, threshold = 128): Bounds | null {
  const w = canvas.width, h = canvas.height
  if (!w || !h) return null
  const data = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, w, h).data
  if (!data) return null
  // Same coarse grid as opaqueBounds, for the same reason: one mask per layer, full document size.
  const step = Math.max(1, Math.floor(Math.max(w, h) / 1500))
  let left = w, right = -1, top = h, bottom = -1
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4
    // A mask carries its value in the colour channels; some encoders also leave it in alpha.
    if (data[i] <= threshold || data[i + 3] <= threshold) continue
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }
  if (right < 0) return null
  if (step > 1) {
    left = Math.max(0, left - step); top = Math.max(0, top - step)
    right = Math.min(w - 1, right + step); bottom = Math.min(h - 1, bottom + step)
  }
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

export function detectCornerRadius(canvas: HTMLCanvasElement, bounds?: Bounds | null): number {
  const box = bounds ?? { x: 0, y: 0, width: canvas.width, height: canvas.height }
  const w = box.width, h = box.height, limit = Math.floor(Math.min(w, h) / 2)
  if (limit < 4) return 0
  const image = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(box.x, box.y, w, h)
  if (!image) return 0
  const data = image.data
  const opaque = (x: number, y: number) => data[(y * w + x) * 4 + 3] > 128
  if (!opaque(Math.floor(w / 2), 0) || !opaque(0, Math.floor(h / 2))) return 0
  const insets = ([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).map(([sx, sy]) => {
    for (let d = 0; d < limit; d++) if (opaque(sx > 0 ? d : w - 1 - d, sy > 0 ? d : h - 1 - d)) return d
    return limit
  })
  const inset = Math.min(...insets)
  // A single clipped corner is artwork, not a frame radius.
  if (inset === 0 || Math.max(...insets) - inset > Math.max(2, inset * 0.5)) return 0
  return Math.min(limit, Math.round(inset / (1 - Math.SQRT1_2)))
}

/** Split a flattened layout at its background gutters; review ambiguous artwork before saving. */
export function detectTemplateFrames(data: Uint8ClampedArray, width: number, height: number): PlaceholderRect[] {
  const colors = new Map<string, number>()
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue
    const i = (y * width + x) * 4, key = [data[i], data[i+1], data[i+2]].map(v => Math.round(v / 16)).join(',')
    colors.set(key, (colors.get(key) ?? 0) + 1)
  }
  const bg = [...colors].sort((a,b) => b[1]-a[1])[0]?.[0].split(',').map(v => Number(v)*16) ?? [255,255,255]
  const mask = new Uint8Array(width*height)
  for (let i=0; i<mask.length; i++) mask[i] = data[i*4+3] > 32 && bg.some((v,c) => Math.abs(data[i*4+c]-v)>35) ? 1 : 0
  const frames: PlaceholderRect[] = []
  function split(x:number,y:number,w:number,h:number,depth:number) {
    if (depth>20 || frames.length>=100 || w<5 || h<5) return
    const rows = new Uint32Array(h), cols = new Uint32Array(w)
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(mask[(y+yy)*width+x+xx]){rows[yy]++;cols[xx]++}
    const left=cols.findIndex(v=>v>0),top=rows.findIndex(v=>v>0)
    if(left<0||top<0)return
    let right=w-1,bottom=h-1;while(!cols[right])right--;while(!rows[bottom])bottom--
    if(left||top||right<w-1||bottom<h-1){split(x+left,y+top,right-left+1,bottom-top+1,depth+1);return}
    for(const axis of ['x','y'] as const){const counts=axis==='x'?cols:rows
      for(let start=1;start<counts.length-1;start++)if(counts[start]===0){let end=start;while(end<counts.length&&counts[end]===0)end++
        if(end-start>=2 && end<counts.length){if(axis==='x'){split(x,y,start,h,depth+1);split(x+end,y,w-end,h,depth+1)}else{split(x,y,w,start,depth+1);split(x,y+end,w,h-end,depth+1)}return}start=end
      }
    }
    if(w*h<width*height*.002)return
    frames.push({id:crypto.randomUUID(),x:x/width,y:y/height,width:w/width,height:h/height,preferredOrientation:'any'})
  }
  split(0,0,width,height,0)
  return frames.sort((a,b)=>a.y-b.y||a.x-b.x)
}
