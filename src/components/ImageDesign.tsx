import {usePreviewSource} from '@/engine/previewImage'
import {computeCoverCrop,rotationCoverScale} from '@/engine/cropFit'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlacedPhoto, PhotoAsset } from '@/types'
import { drawPlacement } from '@/engine/renderSpread'
import { defaultBlackWhiteMix } from '@/engine/imageTone'
import SliderField from './SliderField'
import ColorField from './ColorField'

export default function ImageDesign({ placement, photo, width, height, update }: {
  spreadId?:string; placement: PlacedPhoto; photo?: PhotoAsset; width: number; height: number; update: (patch: Partial<PlacedPhoto>) => void
}) {
  const cancelDrag=useRef<(()=>void)|null>(null)
  useEffect(()=>()=>cancelDrag.current?.(),[])
  const previewSrc=usePreviewSource(photo?.src??'')
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mixer, setMixer] = useState<{left:number;top:number} | null>(null)
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMixer(null) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  const [draft,setDraft]=useState<Partial<PlacedPhoto>|null>(null)
  const rendered=draft?{...placement,...draft}:placement
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const preview = document.createElement('canvas')
    const scale = Math.min(600 / width, 420 / height)
    preview.width = Math.max(1, Math.round(width * scale)); preview.height = Math.max(1, Math.round(height * scale))
    const ctx = preview.getContext('2d')!
    setError('')
    void drawPlacement(ctx, { placeholderId: placement.placeholderId, x: 0, y: 0, width: preview.width, height: preview.height }, {...rendered,rotationDeg:0}, photo?{...photo,src:previewSrc}:undefined, scale).then(() => {
      if (!current || !canvas.current) return
      canvas.current.width = preview.width; canvas.current.height = preview.height
      canvas.current.getContext('2d')!.drawImage(preview, 0, 0)
    }).catch(() => { if (current) setError('Image preview unavailable. Locate the original image to reconnect it.') })
    return () => { current = false }
  }, [placement, draft, photo, previewSrc, width, height])
  const cropPreview=photo?computeCoverCrop(photo.width,photo.height,width,height,rendered.focalX,rendered.focalY,rendered.zoom):null
  function slider(label: string, key: keyof PlacedPhoto, min: number, max: number, reset = 0, suffix = '', factor = 1) {
    const value = Number(placement[key] ?? reset) * factor
    return <div className="image-adjustment" key={key}><SliderField label={label} resetValue={reset*factor} value={Math.round(value * 100) / 100} min={min} max={max} suffix={suffix} onChange={v => update({ [key]: v / factor })}/><button className="adjustment-reset" aria-label={`Reset ${label}`} title={`Reset ${label}`} disabled={value === reset * factor} onClick={() => update({ [key]: reset })}>×</button></div>
  }
  const mix = placement.blackWhiteMix
  return <div className="image-design">
    <details className="inspector-group" open><summary>Design</summary>
      {photo && <div className="image-design__preview" style={{maxWidth:width / height * 240, marginInline:'auto',overflow:'visible',isolation:'isolate'}}>{photo&&cropPreview&&<img aria-hidden="true" src={previewSrc} style={{position:'absolute',pointerEvents:'none',zIndex:-1,opacity:.25,maxWidth:'none',width:photo.width/cropPreview.cropWidth*100+'%',height:photo.height/cropPreview.cropHeight*100+'%',left:-cropPreview.cropX/cropPreview.cropWidth*100+'%',top:-cropPreview.cropY/cropPreview.cropHeight*100+'%',transformOrigin:`${(cropPreview.cropX+cropPreview.cropWidth/2)/photo.width*100}% ${(cropPreview.cropY+cropPreview.cropHeight/2)/photo.height*100}%`,transform:`rotate(${rendered.imageRotationDeg??0}deg) scale(${rotationCoverScale(width,height,rendered.imageRotationDeg??0)})`}}/>}<canvas ref={canvas} aria-label="Drag to reposition the image inside its frame" style={{touchAction:'none',cursor:'grab'}} onPointerDown={e=>{
       if(e.button!==0||placement.locked)return;e.preventDefault();cancelDrag.current?.();const node=e.currentTarget,rect=node.getBoundingClientRect(),startX=e.clientX,startY=e.clientY;let next={focalX:placement.focalX,focalY:placement.focalY};node.setPointerCapture(e.pointerId)
       const crop=computeCoverCrop(photo.width,photo.height,rect.width,rect.height,placement.focalX,placement.focalY,placement.zoom),angle=(placement.imageRotationDeg??0)*Math.PI/180
       const clamp=(v:number,half:number)=>Math.max(half,Math.min(1-half,v))
       const move=(event:PointerEvent)=>{const dx=event.clientX-startX,dy=event.clientY-startY,localX=(dx*Math.cos(angle)+dy*Math.sin(angle))*(placement.flipHorizontal?-1:1),localY=(-dx*Math.sin(angle)+dy*Math.cos(angle))*(placement.flipVertical?-1:1);next={focalX:clamp(placement.focalX-localX/rect.width*crop.cropWidth/photo.width,crop.cropWidth/photo.width/2),focalY:clamp(placement.focalY-localY/rect.height*crop.cropHeight/photo.height,crop.cropHeight/photo.height/2)};setDraft(next)}
       const cleanup=()=>{cancelDrag.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',commit);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',escape);setDraft(null)}
       const commit=()=>{cleanup();if(next.focalX!==placement.focalX||next.focalY!==placement.focalY)update(next)}
       const cancel=()=>cleanup();const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();cleanup()}}
       cancelDrag.current=cleanup;window.addEventListener('pointermove',move);window.addEventListener('pointerup',commit);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',escape)
      }}/><div className="image-design__thirds" aria-hidden="true"/>{error && <p role="status">{error}</p>}</div>}
      {slider('Scale', 'zoom', 100, 500, 1, '%', 100)}
      {slider('Frame angle', 'rotationDeg', -180, 180, 0, '°')}
      {slider('In-frame angle','imageRotationDeg',-180,180,0,'°')}
      {slider('Opacity', 'opacity', 0, 100, 1, '%', 100)}
      {slider('Border', 'borderWidth', 0, 60, 0, 'px')}
      <label>Border color<ColorField value={placement.borderColor} onChange={borderColor => update({borderColor})}/></label>
      <div className="image-adjustment"><SliderField label="Radius" value={placement.frameStyle === 'rounded' ? placement.cornerRadiusPx : 0} min={0} max={200} suffix="px" onChange={cornerRadiusPx => update({cornerRadiiPx:undefined,cornerRadiusPx, frameStyle:'rounded'})}/><button className="adjustment-reset" aria-label="Reset Radius" onClick={() => update({cornerRadiusPx:0, frameStyle:placement.frameStyle === 'rounded' ? 'none' : placement.frameStyle})}>×</button></div>
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
