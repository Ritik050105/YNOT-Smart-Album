import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlacedPhoto, PhotoAsset } from '@/types'
import { drawPlacement } from '@/engine/renderSpread'
import { defaultBlackWhiteMix } from '@/engine/imageTone'
import SliderField from './SliderField'
import ColorField from './ColorField'

export default function ImageDesign({ placement, photo, width, height, update }: {
  placement: PlacedPhoto; photo?: PhotoAsset; width: number; height: number; update: (patch: Partial<PlacedPhoto>) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [mixer, setMixer] = useState<{left:number;top:number} | null>(null)
  useEffect(() => { const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMixer(null) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [])
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const preview = document.createElement('canvas')
    const scale = Math.min(600 / width, 420 / height)
    preview.width = Math.max(1, Math.round(width * scale)); preview.height = Math.max(1, Math.round(height * scale))
    const ctx = preview.getContext('2d')!
    setError('')
    void drawPlacement(ctx, { placeholderId: placement.placeholderId, x: 0, y: 0, width: preview.width, height: preview.height }, placement, photo, scale).then(() => {
      if (!current || !canvas.current) return
      canvas.current.width = preview.width; canvas.current.height = preview.height
      canvas.current.getContext('2d')!.drawImage(preview, 0, 0)
    }).catch(() => { if (current) setError('Image preview unavailable. Locate the original image to reconnect it.') })
    return () => { current = false }
  }, [placement, photo, width, height])
  function slider(label: string, key: keyof PlacedPhoto, min: number, max: number, reset = 0, suffix = '', factor = 1) {
    const value = Number(placement[key] ?? reset) * factor
    return <div className="image-adjustment" key={key}><SliderField label={label} value={Math.round(value * 100) / 100} min={min} max={max} suffix={suffix} onChange={v => update({ [key]: v / factor })}/><button className="adjustment-reset" aria-label={`Reset ${label}`} title={`Reset ${label}`} disabled={value === reset * factor} onClick={() => update({ [key]: reset })}>×</button></div>
  }
  const mix = placement.blackWhiteMix
  return <div className="image-design">
    <details className="inspector-group" open><summary>Design</summary>
      {photo && <div className="image-design__preview" style={{maxWidth:width / height * 240, marginInline:'auto'}}><canvas ref={canvas} aria-label="Selected image live preview"/><div className="image-design__thirds" aria-hidden="true"/>{error && <p role="status">{error}</p>}</div>}
      {slider('Scale', 'zoom', 100, 500, 1, '%', 100)}
      {slider('Angle', 'rotationDeg', -180, 180, 0, '°')}
      {slider('Opacity', 'opacity', 0, 100, 1, '%', 100)}
      {slider('Border', 'borderWidth', 0, 60, 0, 'px')}
      <label>Border color<ColorField value={placement.borderColor} onChange={borderColor => update({borderColor})}/></label>
      <div className="image-adjustment"><SliderField label="Radius" value={placement.frameStyle === 'rounded' ? placement.cornerRadiusPx : 0} min={0} max={200} suffix="px" onChange={cornerRadiusPx => update({cornerRadiusPx, frameStyle:'rounded'})}/><button className="adjustment-reset" aria-label="Reset Radius" onClick={() => update({cornerRadiusPx:0, frameStyle:placement.frameStyle === 'rounded' ? 'none' : placement.frameStyle})}>×</button></div>
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
