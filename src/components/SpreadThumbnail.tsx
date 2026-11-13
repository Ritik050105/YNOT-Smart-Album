import OverviewTextControls from './OverviewTextControls'
import {previewSource} from '@/engine/previewImage'
import { usePreferences } from '@/state/preferences'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { renderSpreadToCanvas } from '@/engine/renderSpread'
import { slideDirection } from '@/engine/slideDirection'

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

/** How long a slide takes. Short, so holding the button down keeps up with the key. */
const SLIDE_MS=170

/** A copy of what a canvas shows now. */
function snapshotOf(canvas:HTMLCanvasElement){
  const copy=document.createElement('canvas')
  copy.width=canvas.width;copy.height=canvas.height
  copy.getContext('2d')?.drawImage(canvas,0,0)
  return copy
}

/** One step of a slide: the leaving picture and the arriving one side by side, shifted by `progress` (0-1) of the card's width. */
function drawSlide(canvas:HTMLCanvasElement,leaving:HTMLCanvasElement,arriving:HTMLCanvasElement,direction:1|-1,progress:number){
  if(canvas.width!==arriving.width||canvas.height!==arriving.height){canvas.width=arriving.width;canvas.height=arriving.height}
  const ctx=canvas.getContext('2d')
  if(!ctx)return
  const w=canvas.width,h=canvas.height,shift=Math.round(w*progress)
  ctx.clearRect(0,0,w,h)
  ctx.drawImage(leaving,-direction*shift,0,w,h)
  ctx.drawImage(arriving,direction*(w-shift),0,w,h)
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
  const lastGeometry=useRef<string>()
  const previousSpread=useRef<Spread>()
  const lastSeen=useRef<Spread>()
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
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    const prior = lastSeen.current, priorGeometry = lastGeometry.current
    lastSeen.current = spread
    // What the card shows right now, kept as it is: the layout it is leaving. If a slide is half done (a key held down), this is
    // that half-done picture, so the next slide carries on from it instead of jumping back to where the last one began.
    const mayChangeLayout = !!prior && (prior.templateId !== spread.templateId || prior.customBoxes !== spread.customBoxes)
    const leaving = mayChangeLayout && canvasRef.current && canvasRef.current.width > 0 ? snapshotOf(canvasRef.current) : null
    void Promise.all([...photosById].filter(([id])=>spread.placements.some(p=>p.photoId===id)).map(async([id,p])=>[id,{...p,src:await previewSource(p.src)}] as const)).then(async entries=>{
      const geometry=JSON.stringify([spread.templateId,spread.customBoxes,spread.placements.map(p=>p.photoId)])
      lastGeometry.current=geometry
      const dpi=(highResolution?renderWidth:Math.min(420,renderWidth))/size.widthIn
      // Presses that arrive faster than the screen redraws would each render a picture nobody sees: wait for the next frame, and
      // the effect of every press but the last has been cancelled by then. (A window that is not being drawn does not run
      // frames, so the wait gives up after a short while.)
      await Promise.race([new Promise(requestAnimationFrame),new Promise(resolve=>setTimeout(resolve,40))])
      if(cancelled)return null
      const rendered=await renderSpreadToCanvas(spread,new Map(entries),size,dpi,true)
      if(cancelled)return null
      // A change of layout slides: the old picture moves out one side and the new one in from the other, each keeping its own
      // size. (Frames that grew out of a point, or shrank into one, to reach their new places are gone: nothing is scaled.)
      const layoutChanged=prior&&(prior.templateId!==spread.templateId||prior.customBoxes!==spread.customBoxes)
      if(animations&&leaving&&layoutChanged&&priorGeometry!==geometry&&!canvasRef.current?.parentElement?.hasAttribute('data-overview-dragging')){
        const direction=slideDirection(),start=performance.now()
        while(!cancelled){
          const canvas=canvasRef.current
          if(!canvas)return null
          const t=Math.min(1,(performance.now()-start)/SLIDE_MS)
          drawSlide(canvas,leaving,rendered,direction,1-Math.pow(1-t,3))
          if(t===1)break
          await new Promise(requestAnimationFrame)
        }
      }
      return cancelled?null:rendered
    }).then((rendered) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas || !rendered) return
      previousSpread.current=spread
      drawFrame(canvas,rendered)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [spread, photosById, size, renderWidth, highResolution])

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
