import OverviewTextControls from './OverviewTextControls'
import {previewSource} from '@/engine/previewImage'
import { usePreferences } from '@/state/preferences'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { DESIGN_WIDTH, computePlaceholderBoxes } from '@/engine/layoutMath'
import { Rect, frameRects, placementKeys } from '@/engine/moveRects'
import { drawPlacement, drawSpreadBackground, drawTextBox, drawUnusedPage, renderSpreadToCanvas } from '@/engine/renderSpread'

interface Props {
  spread: Spread
  photosById: Map<string, PhotoAsset>
  size: AlbumSize
  width?: number
  responsive?: boolean
  dropPlaceholderId?: string | null
  /** The hovered frame will refuse this photo for its shape, so it is drawn as a warning. */
  dropRefused?: boolean
  selectedPlaceholderId?: string | null
}

/** How long photographs take to move to their places in the new layout. */
const MOVE_MS=260

/** One step of the move: every photograph that is in both layouts is drawn, from its own picture, in the frame it has got to on
 *  the way from its old place to its new one. The picture is cropped to the frame as it is at that moment, so a photograph
 *  changing shape on the way keeps showing the same subject and nothing fades; photographs that were not on the spread
 *  fade in. `t` is 0-1 along the way, already eased. Returns where each one was drawn. */
async function drawMove(canvas:HTMLCanvasElement,stage:HTMLCanvasElement,base:HTMLCanvasElement,spread:Spread,photos:Map<string,PhotoAsset>,from:Map<string,Rect>,to:Map<string,Rect>,t:number){
  if(stage.width!==base.width||stage.height!==base.height){stage.width=base.width;stage.height=base.height}
  const ctx=stage.getContext('2d')
  const shown=new Map<string,Rect>()
  if(!ctx)return shown
  // As the final render is drawn, so the last step of the move and the finished picture match.
  ctx.imageSmoothingQuality='high'
  const W=stage.width,H=stage.height,scale=W/DESIGN_WIDTH,keys=placementKeys(spread)
  ctx.globalAlpha=1
  ctx.drawImage(base,0,0)
  // In the order the spread layers them. Each photograph is drawn straight onto the card (its picture was loaded for the
  // final render, so this never waits on the network), except one that was not there before, which fades in from its own sheet.
  for(const pl of spread.placements){
    const key=keys.get(pl.placeholderId),end=key?to.get(key):undefined,photo=pl.photoId?photos.get(pl.photoId):undefined
    if(!key||!end||!photo||pl.hidden)continue
    const start=from.get(key),here:Rect=start?{x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,w:start.w+(end.w-start.w)*t,h:start.h+(end.h-start.h)*t}:end
    const box={placeholderId:pl.placeholderId,x:here.x*W,y:here.y*H,width:here.w*W,height:here.h*H}
    if(start)await drawPlacement(ctx,box,pl,photo,scale)
    else{
      const sheet=document.createElement('canvas')
      sheet.width=W;sheet.height=H
      const sheetContext=sheet.getContext('2d')
      if(sheetContext)await drawPlacement(sheetContext,box,pl,photo,scale)
      ctx.globalAlpha=Math.min(1,t*3);ctx.drawImage(sheet,0,0);ctx.globalAlpha=1
    }
    shown.set(key,here)
  }
  // Captions and other text do not travel, but they are there throughout, so they do not appear at the end.
  for(const box of spread.textBoxes??[])if(!box.hidden)await drawTextBox(ctx,box,W,H)
  drawUnusedPage(ctx,spread,W,H)
  // The whole frame goes to the card at once: whatever was waited for while drawing it, the card never shows a half-drawn one.
  if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
  const visible=canvas.getContext('2d')
  if(visible){visible.clearRect(0,0,W,H);visible.drawImage(stage,0,0)}
  return shown
}

/** Puts a rendered frame on the card's canvas. The canvas is only resized when the frame's size really differs:
 *  assigning a width, even the same one, drops the canvas's bitmap and allocates it again, and a slide does that
 *  for every frame. */
function drawFrame(canvas:HTMLCanvasElement,frame:HTMLCanvasElement){
  if(canvas.width!==frame.width||canvas.height!==frame.height){canvas.width=frame.width;canvas.height=frame.height}
  const ctx=canvas.getContext('2d')
  if(!ctx)return
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.drawImage(frame,0,0)
}

/** Use the export renderer so crops, text, flips and adjustments survive leaving Designer View. */
/** Memoised: rendering a spread means drawing it to a canvas, which is far too expensive to redo
 *  because something elsewhere in the panel changed. The props are all stable values or memoised
 *  maps, so an unchanged spread costs nothing. */
function SpreadThumbnail({ spread, photosById, size, width = 420, responsive, selectedPlaceholderId, dropPlaceholderId, dropRefused }: Props) {
  const animations=usePreferences(s=>s.values.animations)
  /** The layout the card last finished drawing. A move is measured from this, not from whichever spread object came just before:
   *  a layout change is often followed at once by a second update to the spread (a crop settling, a flag set), and measured from
   *  that one the card would see "no change of layout", drop the move in progress and jump to the end. */
  const settled=useRef<{spread:Spread;geometry:string}>()
  const photosRef=useRef(photosById)
  photosRef.current=photosById
  /** Where each photograph is drawn on the card right now, so a move begun mid-move carries on from there. */
  const shownRects=useRef<Map<string,Rect>>()
  const highResolution=usePreferences(s=>s.values.highResolution)
  size = spread.size ?? size
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [renderWidth, setRenderWidth] = useState(width)
  useEffect(() => {
    const element = canvasRef.current?.parentElement
    if (!responsive || !element) { setRenderWidth(width); return }
    const observer = new ResizeObserver(() => setRenderWidth(Math.min(2400, Math.max(width, Math.ceil(element.clientWidth * window.devicePixelRatio)))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [responsive, width])
  // What this card draws depends on the photographs it shows, not on the rest of the project's: a change to any other photograph
  // (one more finished importing, a subject found) used to restart every card's drawing, and cut short a move in progress.
  const usedPhotos = spread.placements.map(p => p.photoId ? `${p.photoId}:${photosById.get(p.photoId)?.src ?? ''}` : '').join('|')
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    const photosById = photosRef.current
    const prior = settled.current?.spread, priorGeometry = settled.current?.geometry
    const geometry = JSON.stringify([spread.templateId, spread.customBoxes, spread.placements.map(p => p.photoId)])
    // Whether the card shows something to move away from. If a move is half done (a key held down), the next one carries on from
    // where each photograph has got to (shownRects), instead of jumping back to where the last one began.
    const inMotion = !!shownRects.current
    const layoutDiffers = !!prior && (prior.templateId !== spread.templateId || prior.customBoxes !== spread.customBoxes) && priorGeometry !== geometry
    // Also when a move is under way and is asked to go back to where it began (Next then Previous quickly): the layout then equals the
    // settled one, but the photographs are somewhere between, and must travel back rather than jump.
    const leaving = (layoutDiffers || inMotion) && !!canvasRef.current && canvasRef.current.width > 0
    void Promise.all([...photosById].filter(([id])=>spread.placements.some(p=>p.photoId===id)).map(async([id,p])=>[id,{...p,src:await previewSource(p.src)}] as const)).then(async entries=>{
      const dpi=(highResolution?renderWidth:Math.min(420,renderWidth))/size.widthIn
      // Presses that arrive faster than the screen redraws would each render a picture nobody sees: wait for the next frame, and
      // the effect of every press but the last has been cancelled by then. (A window that is not being drawn does not run
      // frames, so the wait gives up after a short while.)
      await Promise.race([new Promise(requestAnimationFrame),new Promise(resolve=>setTimeout(resolve,40))])
      if(cancelled)return null
      const rendered=await renderSpreadToCanvas(spread,new Map(entries),size,dpi,true)
      if(cancelled)return null
      // A change of layout moves the photographs: each one that is in both layouts glides from its old frame to its new one,
      // growing or shrinking on the way, as the pictures take their new places on the spread.
      if(animations&&leaving&&prior&&!canvasRef.current?.parentElement?.hasAttribute('data-overview-dragging')){
        const previewHeight=100*size.heightIn/size.widthIn
        const to=frameRects(spread,previewHeight)
        const from=new Map(frameRects(prior,previewHeight));for(const [id,rect] of shownRects.current??[])if(to.has(id))from.set(id,rect)
        // Adding or taking away photographs is not a change of layout: most of what is now on the card was not there a moment ago, so
        // there is nothing to carry across, and the picture is simply the new one (not two photographs travelling, the rest fading in).
        const carried=[...to.keys()].filter(id=>from.has(id)).length
        if(to.size&&carried<to.size*0.8)return rendered
        // The background (and anything drawn behind the photographs) is made once; the photographs are drawn over it every step.
        const base=document.createElement('canvas')
        base.width=rendered.width;base.height=rendered.height
        const baseContext=base.getContext('2d')
        if(baseContext)await drawSpreadBackground(baseContext,spread,base.width,base.height)
        const photos=new Map(entries.map(([id,p])=>[id,p as PhotoAsset]))
        const stage=document.createElement('canvas')
        const start=performance.now()
        while(!cancelled){
          const canvas=canvasRef.current
          if(!canvas)return null
          const k=Math.min(1,(performance.now()-start)/MOVE_MS),t=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2
          const shown=await drawMove(canvas,stage,base,spread,photos,from,to,t)
          if(cancelled)return null
          shownRects.current=shown
          if(k===1)break
          await new Promise(requestAnimationFrame)
        }
      }
      return cancelled?null:rendered
    }).then((rendered) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas || !rendered) return
      settled.current={spread,geometry}
      shownRects.current=undefined
      drawFrame(canvas,rendered)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [spread, usedPhotos, size, renderWidth, highResolution])

  const previewHeight = 100 * size.heightIn / size.widthIn
  // Once per card, not twice per render. Every card in the overview runs this, and resolving a
  // template is not free — it was being paid again on every hover and every drag frame.
  const previewBoxes = useMemo(() => computePlaceholderBoxes(spread, 100, previewHeight),
    [spread.templateId, spread.customBoxes, spread.marginPx, spread.gapPx, spread.flipped, previewHeight])
  const dropBox = previewBoxes.find(box => box.placeholderId === dropPlaceholderId)
  const selectedBox = previewBoxes.find(box => box.placeholderId === selectedPlaceholderId)
  const selectedPlacement = spread.placements.find(p => p.placeholderId === selectedPlaceholderId)

  return (
    <div className="spread-thumb" style={{ width: responsive ? '100%' : width, aspectRatio: size.widthIn / size.heightIn, background: spread.backgroundHidden ? '#fff' : spread.backgroundColor }}>
      <canvas ref={canvasRef} role="img" aria-label="Spread preview" style={{ width: '100%', height: '100%', display: 'block' }} />
      {!spread.isCover && spread.pageSide === 'spread' && <span className="spread-thumb__fold" aria-hidden="true" />}
      {selectedBox && !selectedPlacement?.hidden && <span className="spread-thumb__selection" aria-hidden="true" style={{ left: `${selectedBox.x}%`, top: `${selectedBox.y / previewHeight * 100}%`, width: `${selectedBox.width}%`, height: `${selectedBox.height / previewHeight * 100}%`, transform: `rotate(${selectedPlacement?.rotationDeg ?? 0}deg)` }} />}
      {dropBox&&<span className={`spread-drop-replace${dropRefused?' is-refused':''}`} style={{position:'absolute',pointerEvents:'none',background:dropRefused?'#d4452f55':'#7779',outline:`3px solid ${dropRefused?'#d4452f':'var(--accent)'}`,left:dropBox.x+'%',top:dropBox.y/previewHeight*100+'%',width:dropBox.width+'%',height:dropBox.height/previewHeight*100+'%'}}/>}
      {responsive&&<OverviewTextControls spread={spread}/>}
      {failed && <span role="status">Preview unavailable</span>}
    </div>
  )
}

export default memo(SpreadThumbnail)
