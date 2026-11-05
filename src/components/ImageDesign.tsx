import {usePreviewSource} from '@/engine/previewImage'
import {computeCoverCrop,rotationCoverScale} from '@/engine/cropFit'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlacedPhoto, PhotoAsset } from '@/types'
import { drawPlacement } from '@/engine/renderSpread'
import { defaultBlackWhiteMix } from '@/engine/imageTone'
import { useProjectStore } from '@/state/projectStore'
import SliderField from './SliderField'
import ColorField from './ColorField'

export default function ImageDesign({ spreadId, placement, photo, width, height, update }: {
  spreadId?:string; placement: PlacedPhoto; photo?: PhotoAsset; width: number; height: number; update: (patch: Partial<PlacedPhoto>) => void
}) {
  const cancelDrag=useRef<(()=>void)|null>(null)
  useEffect(()=>()=>cancelDrag.current?.(),[])
  const previewSrc=usePreviewSource(photo?.src??'')
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mixer, setMixer] = useState<{left:number;top:number} | null>(null)
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMixer(null) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  const [error, setError] = useState('')
  /** Writes the drag straight into the project, with no history entry, so the spread on the canvas
   *  and in the timeline moves under the pointer. The commit below restores and re-applies it once
   *  through `update`, which is what undo sees. */
  const live=(patch:Partial<PlacedPhoto>)=>{
    if(!spreadId)return
    useProjectStore.setState(state=>({project:{...state.project,spreads:state.project.spreads.map(s=>s.id!==spreadId?s:
      {...s,placements:s.placements.map(p=>p.placeholderId===placement.placeholderId?{...p,...patch}:p)})}}))
  }
  // A drag fires a pointermove per frame, and redrawing the preview on each one leaves several
  // full re-renders in flight at once, so it lags a frame or two behind the pointer. Coalescing
  // them onto animation frames keeps the preview live under the cursor.
  useEffect(() => {
    let current = true
    const frame = requestAnimationFrame(() => {
      const preview = document.createElement('canvas')
      const scale = Math.min(600 / width, 420 / height)
      preview.width = Math.max(1, Math.round(width * scale)); preview.height = Math.max(1, Math.round(height * scale))
      const ctx = preview.getContext('2d')!
      setError('')
      void drawPlacement(ctx, { placeholderId: placement.placeholderId, x: 0, y: 0, width: preview.width, height: preview.height }, {...placement,rotationDeg:0}, photo?{...photo,src:previewSrc}:undefined, scale).then(() => {
        if (!current || !canvas.current) return
        canvas.current.width = preview.width; canvas.current.height = preview.height
        canvas.current.getContext('2d')!.drawImage(preview, 0, 0)
      }).catch(() => { if (current) setError('Image preview unavailable. Locate the original image to reconnect it.') })
    })
    return () => { current = false; cancelAnimationFrame(frame) }
  }, [placement, photo, previewSrc, width, height])
  const cropPreview=photo?computeCoverCrop(photo.width,photo.height,width,height,placement.focalX,placement.focalY,placement.zoom):null
  function slider(label: string, key: keyof PlacedPhoto, min: number, max: number, reset = 0, suffix = '', factor = 1) {
    const value = Number(placement[key] ?? reset) * factor
    return <div className="image-adjustment" key={key}><SliderField label={label} resetValue={reset*factor} value={Math.round(value * 100) / 100} min={min} max={max} suffix={suffix} onChange={v => update({ [key]: v / factor })}/><button className="adjustment-reset" aria-label={`Reset ${label}`} title={`Reset ${label}`} disabled={value === reset * factor} onClick={() => update({ [key]: reset })}>×</button></div>
  }
  const mix = placement.blackWhiteMix
  return <div className="image-design">
    <details className="inspector-group" open><summary>Design</summary>
      {photo && cropPreview && <div className="image-design__preview" style={{aspectRatio:`${photo.width} / ${photo.height}`}}>
        {/* The whole photo, dimmed, sets the size of the box — so the part of it that falls outside
            the frame has room of its own instead of spilling over the panel above. */}
        <img className="image-design__full" aria-hidden="true" src={previewSrc} style={{transformOrigin:`${(cropPreview.cropX+cropPreview.cropWidth/2)/photo.width*100}% ${(cropPreview.cropY+cropPreview.cropHeight/2)/photo.height*100}%`,transform:`rotate(${placement.imageRotationDeg??0}deg) scale(${rotationCoverScale(width,height,placement.imageRotationDeg??0)})`}}/>
        <div className="image-design__crop" style={{left:cropPreview.cropX/photo.width*100+'%',top:cropPreview.cropY/photo.height*100+'%',width:cropPreview.cropWidth/photo.width*100+'%',height:cropPreview.cropHeight/photo.height*100+'%'}}>
          <canvas ref={canvas} aria-label="Drag to reposition the image inside its frame" style={{touchAction:'none',cursor:placement.locked?'default':'grab'}} onPointerDown={e=>{
            if(e.button!==0||placement.locked)return;e.preventDefault();cancelDrag.current?.();const node=e.currentTarget,rect=node.getBoundingClientRect(),startX=e.clientX,startY=e.clientY
            const original={focalX:placement.focalX,focalY:placement.focalY};let next=original;node.setPointerCapture(e.pointerId)
            const crop=computeCoverCrop(photo.width,photo.height,rect.width,rect.height,placement.focalX,placement.focalY,placement.zoom),angle=(placement.imageRotationDeg??0)*Math.PI/180
            const clamp=(v:number,half:number)=>Math.max(half,Math.min(1-half,v))
            // A mouse reports moves far faster than the screen refreshes, and every live() write
            // re-renders this whole panel plus the canvas. One write per frame is all the screen
            // can show, and it is what keeps the preview under the pointer instead of behind it.
            let frame=0
            const move=(event:PointerEvent)=>{
              const dx=event.clientX-startX,dy=event.clientY-startY
              const localX=(dx*Math.cos(angle)+dy*Math.sin(angle))*(placement.flipHorizontal?-1:1),localY=(-dx*Math.sin(angle)+dy*Math.cos(angle))*(placement.flipVertical?-1:1)
              // The preview shows the whole photo with the frame's crop drawn on it, so the thing
              // under the cursor is the crop box and it moves with the cursor. (It used to show
              // only what the frame holds, where dragging moved the photo the other way.)
              next={focalX:clamp(placement.focalX+localX/rect.width*crop.cropWidth/photo.width,crop.cropWidth/photo.width/2),focalY:clamp(placement.focalY+localY/rect.height*crop.cropHeight/photo.height,crop.cropHeight/photo.height/2)}
              if(!frame)frame=requestAnimationFrame(()=>{frame=0;live(next)})
            }
            const cleanup=()=>{if(frame)cancelAnimationFrame(frame);frame=0;cancelDrag.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',commit);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape)}
            // The drag has been writing straight into the project so the spread moves with it; put
            // the original back before committing, so undo gets one entry for the whole drag.
            const commit=()=>{cleanup();live(original);if(next.focalX!==original.focalX||next.focalY!==original.focalY)update(next)}
            const cancel=()=>{cleanup();live(original)}
            const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cancel()}}
            cancelDrag.current=cancel;window.addEventListener('pointermove',move);window.addEventListener('pointerup',commit);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape)
          }}/>
          <div className="image-design__thirds" aria-hidden="true"/>
        </div>
      </div>}
      {error && <p role="status">{error}</p>}

      {slider('Scale', 'zoom', 100, 500, 1, '%', 100)}
      {slider('Frame angle', 'rotationDeg', -180, 180, 0, '°')}
      {slider('In-frame angle','imageRotationDeg',-180,180,0,'°')}
      {slider('Opacity', 'opacity', 0, 100, 1, '%', 100)}
      {slider('Border', 'borderWidth', 0, 60, 0, 'px')}
      <label>Border color<ColorField value={placement.borderColor} onChange={borderColor => update({borderColor})}/></label>
      <div className="image-adjustment"><SliderField label="Radius" value={placement.frameStyle === 'rounded' ? placement.cornerRadiusPx : 0} min={0} max={200} suffix="px" onChange={cornerRadiusPx => update({cornerRadiiPx:undefined,cornerRadiusPx, frameStyle:'rounded'})}/><button className="adjustment-reset" aria-label="Reset Radius" title="Reset Radius" disabled={placement.frameStyle!=='rounded'||!placement.cornerRadiusPx} onClick={() => update({cornerRadiusPx:0, frameStyle:placement.frameStyle === 'rounded' ? 'none' : placement.frameStyle})}>×</button></div>
      <label>Frame<select value={placement.frameStyle} onChange={e => update({frameStyle:e.target.value as PlacedPhoto['frameStyle']})}><option value="none">None</option><option value="rounded">Rounded</option><option value="polaroid">Polaroid</option><option value="shadow">Drop Shadow</option></select></label>
    </details>
    {photo && <details className="inspector-group" open><summary>Tone Adjustments</summary>
      {slider('Brightness', 'brightness', -100, 100)}
      {slider('Contrast', 'contrast', -100, 100)}
      {slider('Warmth', 'warmth', -100, 100)}
      {slider('Saturation', 'saturation', -100, 100)}
      {slider('Relight', 'relightIntensity', -100, 100)}
      <div className="image-design__bw"><label>Black &amp; White<select aria-label="Black & White preset" value={mix ? (!mixer && mix.every((v,i) => v === defaultBlackWhiteMix[i]) ? 'standard' : 'custom') : 'off'} onChange={e => { update({blackWhiteMix:e.target.value === 'off' ? undefined : [...defaultBlackWhiteMix], saturation:0}); setMixer(e.target.value === 'custom' ? {left:Math.max(12, innerWidth - 440),top:Math.max(12, Math.min(innerHeight - 380, e.currentTarget.getBoundingClientRect().top - 150))} : null) }}><option value="off">Off</option><option value="standard">Standard</option><option value="custom">Custom</option></select></label><button className="btn btn--tiny" aria-label="Black and white mixer" aria-expanded={!!mixer} onClick={e => { const rect=e.currentTarget.getBoundingClientRect(); setMixer(mixer ? null : {left:Math.max(12, rect.right - 420), top:Math.max(12, Math.min(innerHeight - 380, rect.top - 150))}) }}>☷</button><button className="adjustment-reset" aria-label="Reset Black and White" onClick={() => update({blackWhiteMix:undefined,saturation:0})}>×</button></div>
      {mixer && createPortal(<div className="image-mixer-backdrop" onMouseDown={() => setMixer(null)}><div className="image-design__mixer inspector" role="dialog" aria-label="Black and white color mixer" style={mixer} onMouseDown={e => e.stopPropagation()}><p>Black &amp; White <button className="adjustment-reset" aria-label="Close color mixer" onClick={() => setMixer(null)}>×</button></p>{['Reds','Yellows','Greens','Cyans','Blues','Magentas'].map((label,i) => <SliderField key={label} label={label} value={(mix ?? defaultBlackWhiteMix)[i]} min={-100} max={200} onChange={v => { const next = [...(mix ?? defaultBlackWhiteMix)]; next[i] = v; update({blackWhiteMix:next,saturation:0}) }}/>)}</div></div>, document.body)}
    </details>}
  </div>
}
