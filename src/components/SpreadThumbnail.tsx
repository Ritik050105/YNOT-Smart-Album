import OverviewTextControls from './OverviewTextControls'
import {previewSource} from '@/engine/previewImage'
import { usePreferences } from '@/state/preferences'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { renderSpreadToCanvas } from '@/engine/renderSpread'

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
  const shownBoxes=useRef(new Map<string,{x:number;y:number;width:number;height:number}>())
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
    // Where each photograph is on the card right now (0-1 of the spread, by photo), whether the card has
    // settled or a slide is half way. The next slide starts from here. It used to start from the last layout
    // that finished, so pressing Next again before a slide ended snapped the card back to where it began
    // and slid on from there: held down, that read as the card blinking.
    const shown = shownBoxes.current
    const prior = lastSeen.current, priorGeometry = lastGeometry.current
    lastSeen.current = spread
    void Promise.all([...photosById].filter(([id])=>spread.placements.some(p=>p.photoId===id)).map(async([id,p])=>[id,{...p,src:await previewSource(p.src)}] as const)).then(async entries=>{
      const geometry=JSON.stringify([spread.templateId,spread.customBoxes,spread.placements.map(p=>p.photoId)])
      lastGeometry.current=geometry
      // Presses that arrive faster than the screen redraws would each render a frame nobody sees: wait for the next frame, and
      // the effect of every press but the last has been cancelled by then.
      // (A window that is not being drawn does not run frames, so the wait gives up after a short while.)
      await Promise.race([new Promise(requestAnimationFrame),new Promise(resolve=>setTimeout(resolve,40))])
      if(cancelled)return null
      const dpi=(highResolution?renderWidth:Math.min(420,renderWidth))/size.widthIn
      const height=900*size.heightIn/size.widthIn
      const next=computePlaceholderBoxes(spread,900,height)
      const photoOf=(placeholderId:string)=>spread.placements.find(p=>p.placeholderId===placeholderId)?.photoId
      const settle=()=>{shown.clear();for(const b of next){const id=photoOf(b.placeholderId);if(id)shown.set(id,{x:b.x/900,y:b.y/height,width:b.width/900,height:b.height/height})}}
      let finished:HTMLCanvasElement|null=null
      // Layout-only key (template/box geometry, not which photo fills each box): a plain photo
      // swap keeps every box in place, so it must not trigger the morph animation below.
      const layoutChanged=prior&&(prior.templateId!==spread.templateId||prior.customBoxes!==spread.customBoxes)
      if(animations&&layoutChanged&&!canvasRef.current?.parentElement?.hasAttribute('data-overview-dragging')&&prior&&priorGeometry!==geometry&&prior.placements.length===spread.placements.length){
        const old=computePlaceholderBoxes(prior,900,height),start=performance.now()
        // Each box slides from where its photograph is now: where the card has drawn it, else where the layout it replaced had it.
        const from=new Map(next.map((b,i)=>{const id=photoOf(b.placeholderId),oldId=prior.placements.find(p=>p.photoId===id)?.placeholderId,o=old.find(x=>x.placeholderId===oldId)??old[i]??b;return [b.placeholderId,(id&&shown.get(id))||{x:o.x/900,y:o.y/height,width:o.width/900,height:o.height/height}] as const}))
        // Drawn at the resolution the finished card has, so the card does not change size (and visibly
        // re-sharpen) when the slide ends. Time-driven: a slow frame skips ahead instead of stretching the slide.
        const animDpi=dpi
        while(!cancelled){const t=Math.min(1,(performance.now()-start)/180),ease=1-Math.pow(1-t,3)
          const boxes=next.map(b=>{const a=from.get(b.placeholderId)!;return {id:b.placeholderId,x:a.x+(b.x/900-a.x)*ease,y:a.y+(b.y/height-a.y)*ease,width:a.width+(b.width/900-a.width)*ease,height:a.height+(b.height/height-a.height)*ease,preferredOrientation:'any' as const}})
          // The last step is the finished card itself, so it is not rendered a second time afterwards.
          const frame=t===1?await renderSpreadToCanvas(spread,new Map(entries),size,dpi,true):await renderSpreadToCanvas({...spread,flipped:false,customBoxes:boxes},new Map(entries),size,animDpi),canvas=canvasRef.current
          if(cancelled||!canvas)break
          drawFrame(canvas,frame)
          if(t===1){finished=frame;break}
          shown.clear();for(const b of boxes){const id=photoOf(b.id);if(id)shown.set(id,{x:b.x,y:b.y,width:b.width,height:b.height})}
          await new Promise(requestAnimationFrame)
        }
      }
      if(cancelled)return null
      const rendered=finished??await renderSpreadToCanvas(spread,new Map(entries),size,dpi,true)
      if(!cancelled)settle()
      return rendered
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
