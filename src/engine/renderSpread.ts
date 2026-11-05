import {effectPadding} from './blendingEffects'
import {drawBlendingEffects} from './drawBlendingEffects'
import { spreadLayers } from './spreadLayers'
import { getPreferences } from '@/state/preferences'
import { PhotoAsset, Spread, AlbumSize, PlacedPhoto, TextBox } from '@/types'
import { computeCoverCrop, rotationCoverScale } from './cropFit'
import { DESIGN_WIDTH, PlaceholderBox, computePlaceholderBoxes } from './layoutMath'
import { ensureFontLoaded } from './fonts'
import { imageToneFilter, applyBlackWhiteMix } from './imageTone'

/** The edge a text box is set against, with the four justify values reduced to the alignment
  * their last line falls back to. Anything that cannot justify — a single-word line, a Konva
  * node, a PSD paragraph — uses this. */
export function plainTextAlign(align: TextBox['align']): CanvasTextAlign {
  return align === 'center' || align === 'justify-center' ? 'center'
    : align === 'right' || align === 'justify-right' ? 'right'
    : 'left'
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Renders a spread onto a canvas at the given pixel size (pixelsPerInch * album size), for
 *  on-screen preview thumbnails and for rasterizing JPG/PDF export pages. */
export async function renderSpreadToCanvas(
  spread: Spread,
  photosById: Map<string, PhotoAsset>,
  size: AlbumSize,
  pixelsPerInch: number
): Promise<HTMLCanvasElement> {
  size = spread.size ?? size
  const widthPx = Math.round(size.widthIn * pixelsPerInch)
  const heightPx = Math.round(size.heightIn * pixelsPerInch)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.imageSmoothingQuality = 'high'

  await drawSpreadBackground(ctx, spread, widthPx, heightPx)

  const scale = widthPx / DESIGN_WIDTH
  const boxes = computePlaceholderBoxes(spread, widthPx, heightPx)

  for (const layer of spreadLayers(spread)) {
    if (layer.value.hidden) continue
    if (layer.kind === 'text') await drawTextBox(ctx, layer.value, widthPx, heightPx)
    else {
      const ph = boxes.find(b => b.placeholderId === layer.id)
      const photo = layer.value.photoId ? photosById.get(layer.value.photoId) : undefined
      if (ph && photo) await drawPlacement(ctx, ph, layer.value, photo, scale)
    }
  }

  const amount=({none:0,low:.15,medium:.3,high:.5} as Record<string,number>)[getPreferences().sharpening]??0
  if(amount && pixelsPerInch>=size.dpi){
    const image=ctx.getImageData(0,0,widthPx,heightPx),source=new Uint8ClampedArray(image.data)
    for(let y=1;y<heightPx-1;y++)for(let x=1;x<widthPx-1;x++){const i=(y*widthPx+x)*4;for(let k=0;k<3;k++)image.data[i+k]=source[i+k]*(1+4*amount)-amount*(source[i-4+k]+source[i+4+k]+source[i-widthPx*4+k]+source[i+widthPx*4+k])}
    ctx.putImageData(image,0,0)
  }
  return canvas
}

/** The paper colour of each half of a spread: the sheet's own colour unless that page has been
 *  given one of its own. A single page has no halves, so both answers are the same. */
export function spreadPageColors(spread: Pick<Spread, 'backgroundColor' | 'backgroundColorLeft' | 'backgroundColorRight' | 'backgroundHidden' | 'pageSide'>) {
  const base = spread.backgroundHidden ? '#ffffff' : spread.backgroundColor
  if (spread.backgroundHidden || spread.pageSide !== 'spread') return { left: base, right: base, split: false }
  const left = spread.backgroundColorLeft ?? base, right = spread.backgroundColorRight ?? base
  return { left, right, split: left !== right }
}

export async function drawSpreadBackground(ctx: CanvasRenderingContext2D, spread: Spread, width: number, height: number) {
  ctx.imageSmoothingQuality = 'high'
  const paper = spreadPageColors(spread)
  ctx.fillStyle = paper.left
  ctx.fillRect(0, 0, paper.split ? width / 2 : width, height)
  if (paper.split) { ctx.fillStyle = paper.right; ctx.fillRect(width / 2, 0, width - width / 2, height) }
  if (spread.backgroundHidden || !spread.backgroundPattern) return
  if (spread.backgroundPattern.mode === 'cover') {
    await drawPlacement(ctx, { placeholderId: 'background', x: 0, y: 0, width, height }, spread.backgroundPattern.edits, { src: spread.backgroundPattern.src }, width / DESIGN_WIDTH)
    return
  }
  const image = await loadImage(spread.backgroundPattern.src)
  const scale = spread.backgroundPattern.tileSizePx * width / DESIGN_WIDTH / image.naturalWidth
  const pattern = ctx.createPattern(image, 'repeat')
  if (!pattern || !(scale > 0)) return
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width / scale, height / scale)
  ctx.restore()
}

export async function drawPlacement(ctx: CanvasRenderingContext2D, ph: PlaceholderBox, placement: PlacedPhoto | undefined, photo: Pick<PhotoAsset, 'src'> | undefined, scale: number) {
    const boxX = ph.x
    const boxY = ph.y
    const boxW = ph.width
    const boxH = ph.height
    if (boxW <= 0 || boxH <= 0) return

    const frameStyle = placement?.frameStyle ?? 'none'
    const rotation = ((placement?.rotationDeg ?? 0) * Math.PI) / 180

    ctx.save()
    if (rotation !== 0) {
      const cx = boxX + boxW / 2
      const cy = boxY + boxH / 2
      ctx.translate(cx, cy)
      ctx.rotate(rotation)
      ctx.translate(-cx, -cy)
    }

    if (frameStyle === 'shadow') {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = Math.max(boxW, boxH) * 0.04
      ctx.shadowOffsetY = Math.max(boxW, boxH) * 0.015
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      ctx.restore()
    }

    // The polaroid mat eats into the box, leaving extra room at the bottom for a caption strip.
    const matPad = frameStyle === 'polaroid' ? Math.min(boxW, boxH) * 0.06 : 0
    const matPadBottom = frameStyle === 'polaroid' ? boxH * 0.16 : 0
    const photoX = boxX + matPad
    const photoY = boxY + matPad
    const photoW = boxW - matPad * 2
    const photoH = boxH - matPad - matPadBottom

    if (frameStyle === 'polaroid') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(boxX, boxY, boxW, boxH)
    }

    ctx.save()
    ctx.beginPath()
    if (frameStyle === 'rounded') {
      roundedRectPath(ctx, boxX, boxY, boxW, boxH, scaleRadii(placementRadii(placement), scale))
    } else {
      ctx.rect(photoX, photoY, photoW, photoH)
    }
    ctx.clip()

    if (photo) {
      const img = await loadImage(photo.src)
      const crop = computeCoverCrop(
        img.naturalWidth,
        img.naturalHeight,
        photoW,
        photoH,
        placement?.focalX ?? 0.5,
        placement?.focalY ?? 0.5,
        placement?.zoom ?? 1
      )

      ctx.filter = imageToneFilter(placement ?? { brightness: 0, contrast: 0, saturation: 0 })
      ctx.globalAlpha = placement?.opacity ?? 1

      const flipH = placement?.flipHorizontal ?? false
      const flipV = placement?.flipVertical ?? false
      if (flipH || flipV || placement?.imageRotationDeg) {
        ctx.save()
        const cx = photoX + photoW / 2
        const cy = photoY + photoH / 2
        ctx.translate(cx, cy)
        ctx.rotate((placement?.imageRotationDeg??0)*Math.PI/180)
        ctx.scale((flipH ? -1 : 1)*rotationCoverScale(photoW,photoH,placement?.imageRotationDeg??0), (flipV ? -1 : 1)*rotationCoverScale(photoW,photoH,placement?.imageRotationDeg??0))
        ctx.translate(-cx, -cy)
      }
      if (placement?.blackWhiteMix) {
        const toned = document.createElement('canvas')
        toned.width = Math.max(1, Math.ceil(photoW)); toned.height = Math.max(1, Math.ceil(photoH))
        const toneCtx = toned.getContext('2d')!
        toneCtx.filter = ctx.filter
        toneCtx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, 0, 0, toned.width, toned.height)
        applyBlackWhiteMix(toneCtx, placement.blackWhiteMix)
        ctx.filter = 'none'
        ctx.drawImage(toned, photoX, photoY, photoW, photoH)
      } else {
        ctx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, photoX, photoY, photoW, photoH)
      }
      if (flipH || flipV || placement?.imageRotationDeg) ctx.restore()
      ctx.filter = 'none'
      ctx.globalAlpha = 1

      const warmth = placement?.warmth ?? 0
      if (warmth !== 0) {
        ctx.globalAlpha = Math.min(Math.abs(warmth) / 100, 0.35)
        ctx.fillStyle = warmth > 0 ? '#ffb347' : '#4aa3ff'
        ctx.globalCompositeOperation = 'overlay'
        ctx.fillRect(photoX, photoY, photoW, photoH)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }

      applyRelight(ctx, photoX, photoY, photoW, photoH, placement?.relightIntensity ?? 0)
    } else {
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(photoX, photoY, photoW, photoH)
    }
    ctx.restore()

    const borderWidth = (placement?.borderWidth ?? 0) * scale
    if (borderWidth > 0 && frameStyle !== 'polaroid') {
      ctx.strokeStyle = placement?.borderColor ?? '#ffffff'
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      if (frameStyle === 'rounded') roundedRectPath(ctx, photoX + borderWidth / 2, photoY + borderWidth / 2, Math.max(0, photoW - borderWidth), Math.max(0, photoH - borderWidth), scaleRadii(placementRadii(placement), scale, borderWidth / 2))
      else ctx.rect(photoX + borderWidth / 2, photoY + borderWidth / 2, photoW - borderWidth, photoH - borderWidth)
      ctx.stroke()
    }

    ctx.restore()
}

/** Simulated "relighting": a soft radial glow (positive) or vignette/shadow (negative) centered
 *  on the photo, blended with soft-light so it reads as changed lighting rather than a flat tint. */
export function applyRelight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity: number) {
  if (intensity === 0) return
  const cx = x + w / 2
  const cy = y + h / 2
  const radius = Math.max(w, h) * 0.75
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  const strength = Math.min(Math.abs(intensity) / 100, 1)
  if (intensity > 0) {
    gradient.addColorStop(0, `rgba(255,255,255,${0.65 * strength})`)
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
  } else {
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(1, `rgba(0,0,0,${0.55 * strength})`)
  }
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

/** `r` is one radius for every corner, or [topLeft, topRight, bottomRight, bottomLeft]. */
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  const cap = (v: number) => Math.max(0, Math.min(v, w / 2, h / 2))
  const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map(cap)
  ctx.moveTo(x + tl, y)
  ctx.arcTo(x + w, y, x + w, y + h, tr)
  ctx.arcTo(x + w, y + h, x, y + h, br)
  ctx.arcTo(x, y + h, x, y, bl)
  ctx.arcTo(x, y, x + w, y, tl)
  ctx.closePath()
}

/** Scales one radius, or a set of four, into device pixels — optionally insetting for a border. */
export function scaleRadii(r: number | number[], scale: number, inset = 0): number | number[] {
  return Array.isArray(r) ? r.map(v => Math.max(0, v * scale - inset)) : Math.max(0, r * scale - inset)
}

/** The radii a placement draws with: its own per-corner set, else its uniform radius. */
export function placementRadii(placement?: Pick<PlacedPhoto, 'cornerRadiusPx' | 'cornerRadiiPx'>, fallback = 24): number | number[] {
  return placement?.cornerRadiiPx ?? placement?.cornerRadiusPx ?? fallback
}

export async function drawTextBox(ctx:CanvasRenderingContext2D,box:TextBox,widthPx:number,heightPx:number){
 const scale=widthPx/DESIGN_WIDTH,x=box.x*widthPx,y=box.y*heightPx,w=box.width*widthPx,h=box.height*heightPx
 ctx.save();ctx.translate(x,y);ctx.rotate((box.rotationDeg??0)*Math.PI/180);ctx.globalAlpha*=box.opacity??1;ctx.globalCompositeOperation=box.blendMode??'source-over'
 if(box.shape){
  ctx.fillStyle=box.color;ctx.strokeStyle=box.shapeStroke??'#222222';ctx.lineWidth=(box.shapeStrokeWidth??2)*scale
  const stroke=ctx.lineWidth
  ctx.setLineDash(box.shapeStrokeStyle==='dotted'?[.01,stroke*3]:box.shapeStrokeStyle==='dashed'?[stroke*4,stroke*3]:box.shapeStrokeStyle==='short-dashed'?[stroke*2,stroke*2]:[])
  ctx.lineCap=box.shapeStrokeStyle==='dotted'||box.shapeRoundedEnds?'round':'butt'
  if(box.shape==='line'){ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);if(stroke>0)ctx.stroke()}
  else if(box.shape==='circle'||box.shape==='triangle'){
   const inset=box.shapeMode==='fill'?0:stroke/2;ctx.beginPath()
   if(box.shape==='circle')ctx.ellipse(w/2,h/2,Math.max(0,w/2-inset),Math.max(0,h/2-inset),0,0,Math.PI*2)
   else {ctx.moveTo(w/2,inset);ctx.lineTo(w-inset,h-inset);ctx.lineTo(inset,h-inset);ctx.closePath()}
   if(box.shapeMode!=='stroke')ctx.fill();if(box.shapeMode!=='fill'&&stroke>0)ctx.stroke()
  }
  else {if(box.shapeMode!=='stroke')ctx.fillRect(0,0,w,h);if(box.shapeMode!=='fill'&&stroke>0)ctx.strokeRect(stroke/2,stroke/2,Math.max(0,w-stroke),Math.max(0,h-stroke))}
  ctx.restore();return h
 }
 const art=box.sourceArtwork
 // Original glyph pixels preserve PSD typography until the user edits its content or styling.
 if(art && Math.abs(box.fontSize/(box.width*900)-art.fontRatio)<.00001 && art.text===box.text && art.fontFamily===box.fontFamily && art.color===box.color && art.bold===box.bold && art.italic===box.italic && !box.underline && !box.strikeThrough && !box.letterSpacing && !Object.values(box.effects??{}).some(e=>e?.enabled)){
   ctx.globalAlpha*=box.fillOpacity??1;ctx.drawImage(await loadImage(art.src),0,0,w,h);ctx.restore();return h
 }
 // Previews never wait on a download: use the font if it is ready, a fallback otherwise.
 if(box.previewOnly)await Promise.race([ensureFontLoaded(box.fontFamily).catch(()=>{}),new Promise<void>(r=>setTimeout(r,30))]);else await ensureFontLoaded(box.fontFamily)
 const pad=Math.ceil(Math.max(box.fontSize*3,effectPadding(box.effects))*scale),mask=document.createElement('canvas');mask.width=Math.ceil(w+2*pad);mask.height=Math.ceil(h+2*pad);const m=mask.getContext('2d')!
 // A justified line is drawn word by word, so it is always laid out from the left edge; the
 // fallback below is what the last line of each paragraph falls back to.
 const justified=box.align.startsWith('justify')
 const base=plainTextAlign(box.align)
 const lastLine:CanvasTextAlign|'justify'=box.align==='justify'?'justify':base
 m.font=`${box.italic?'italic ':''}${box.bold?'bold ':''}${box.fontSize*scale}px ${box.fontFamily}`;m.textBaseline='top';m.fillStyle=box.color;m.letterSpacing=`${(box.letterSpacing??0)*scale}px`
 m.textAlign=justified?'left':base
 const lineStep=box.fontSize*scale*(box.lineHeight??1.2);let cy=pad
 const originFor=(align:CanvasTextAlign)=>pad+(align==='center'?w/2:align==='right'?w:0)
 const decorate=(startX:number,width:number)=>{
  if(box.underline)m.fillRect(startX,cy+box.fontSize*scale,width,Math.max(1,scale))
  if(box.strikeThrough)m.fillRect(startX,cy+box.fontSize*scale*.55,width,Math.max(1,scale))
 }
 /** One laid-out line. `last` marks the final line of its paragraph, which is the only one the
  *  justify variants treat differently. */
 const line=(text:string,last=false)=>{
  const align:CanvasTextAlign|'justify'=justified?(last?lastLine:'justify'):base
  if(align==='justify'){
   // Spread the leftover width evenly between the words. A single word has nowhere to put it,
   // so it stays flush left rather than being stretched letter by letter.
   const words=text.split(' ').filter(Boolean)
   if(words.length>1){
    const total=words.reduce((sum,word)=>sum+m.measureText(word).width,0)
    const gap=(w-total)/(words.length-1)
    let x=pad
    for(const word of words){m.fillText(word,x,cy);x+=m.measureText(word).width+gap}
    decorate(pad,w)
    cy+=lineStep
    return
   }
  }
  const plain:CanvasTextAlign=align==='justify'?'left':align
  m.textAlign=plain
  const tx=originFor(plain)
  m.fillText(text,tx,cy)
  if(box.underline||box.strikeThrough){const width=m.measureText(text).width;decorate(tx-(plain==='center'?width/2:plain==='right'?width:0),width)}
  m.textAlign=justified?'left':base
  cy+=lineStep
 }
 for(const paragraph of box.text.split(/\r?\n/)){
   const lines:string[]=[]
   let text=''
   for(const word of paragraph.split(/\s+/)){
     const next=text?text+' '+word:word
     if(m.measureText(next).width<=w){text=next;continue}
     if(text){lines.push(text);text=''}
     for(const char of Array.from(word)){if(text&&m.measureText(text+char).width>w){lines.push(text);text=''}text+=char}
   }
   lines.push(text)
   lines.forEach((value,i)=>line(value,i===lines.length-1))
 }
 await drawBlendingEffects(ctx,mask,box,pad,w,h,scale)
 ctx.restore();return cy-pad
}

