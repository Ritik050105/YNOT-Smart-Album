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

/** Use the export renderer so crops, text, flips and adjustments survive leaving Designer View. */
/** Memoised: rendering a spread means drawing it to a canvas, which is far too expensive to redo
 *  because something elsewhere in the panel changed. The props are all stable values or memoised
 *  maps, so an unchanged spread costs nothing. */
function SpreadThumbnail({ spread, photosById, size, width = 420, responsive, selectedPlaceholderId, dropPlaceholderId, dropRefused }: Props) {
  const animations=usePreferences(s=>s.values.animations)
  const previousGeometry=useRef<string>()
  const previousSpread=useRef<Spread>()
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
    void Promise.all([...photosById].filter(([id])=>spread.placements.some(p=>p.photoId===id)).map(async([id,p])=>[id,{...p,src:await previewSource(p.src)}] as const)).then(async entries=>{
      const prior=previousSpread.current
      const geometry=JSON.stringify([spread.templateId,spread.customBoxes,spread.placements.map(p=>p.photoId)])
      const dpi=(highResolution?renderWidth:Math.min(420,renderWidth))/size.widthIn
      // Layout-only key (template/box geometry, not which photo fills each box): a plain photo
      // swap keeps every box in place, so it must not trigger the morph animation below.
      const layoutChanged=prior&&(prior.templateId!==spread.templateId||prior.customBoxes!==spread.customBoxes)
      if(animations&&layoutChanged&&!canvasRef.current?.parentElement?.hasAttribute('data-overview-dragging')&&prior&&previousGeometry.current!==geometry&&prior.placements.length===spread.placements.length){
        const height=900*size.heightIn/size.widthIn,old=computePlaceholderBoxes(prior,900,height),next=computePlaceholderBoxes(spread,900,height),start=performance.now()
        const animDpi=Math.min(dpi,420/size.widthIn)
        while(!cancelled){const t=Math.min(1,(performance.now()-start)/220),ease=1-Math.pow(1-t,3)
          const boxes=next.map((b,i)=>{const photoId=spread.placements.find(p=>p.placeholderId===b.placeholderId)?.photoId,oldId=prior.placements.find(p=>p.photoId===photoId)?.placeholderId;const a=old.find(o=>o.placeholderId===oldId)??old[i]??b;return {id:b.placeholderId,x:(a.x+(b.x-a.x)*ease)/900,y:(a.y+(b.y-a.y)*ease)/height,width:(a.width+(b.width-a.width)*ease)/900,height:(a.height+(b.height-a.height)*ease)/height,preferredOrientation:'any' as const}})
          const frame=await renderSpreadToCanvas({...spread,flipped:false,customBoxes:boxes},new Map(entries),size,animDpi),canvas=canvasRef.current
          if(cancelled||!canvas)break
          canvas.width=frame.width;canvas.height=frame.height;canvas.getContext('2d')?.drawImage(frame,0,0)
          if(t===1)break
          await new Promise(requestAnimationFrame)
        }
      }
      return renderSpreadToCanvas(spread,new Map(entries),size,dpi,true)
    }).then((rendered) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      const geometry=JSON.stringify([spread.templateId,spread.customBoxes,spread.placements.map(p=>p.photoId)])
      previousGeometry.current=geometry
      previousSpread.current=spread
      canvas.width = rendered.width
      canvas.height = rendered.height
      canvas.getContext('2d')?.drawImage(rendered, 0, 0)
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
