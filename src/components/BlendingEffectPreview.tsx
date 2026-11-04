import {useEffect,useRef} from 'react'
import {TextEffect,TextEffectName} from '@/types'
import {drawBlendingEffects} from '@/engine/drawBlendingEffects'
export default function BlendingEffectPreview({name,effect,enabled}:{name:TextEffectName;effect:TextEffect;enabled:boolean}){
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{let active=true;const result=document.createElement('canvas');result.width=280;result.height=150;const ctx=result.getContext('2d')!,mask=document.createElement('canvas');mask.width=280;mask.height=150;const m=mask.getContext('2d')!;m.fillStyle='#a4a4a4';m.fillRect(100,35,80,80);ctx.fillStyle='#252529';ctx.fillRect(0,0,280,150);void drawBlendingEffects(ctx,mask,{fillOpacity:1,effects:{[name]:{...effect,enabled:enabled&&effect.enabled}}} as import('@/types').TextBox,0,280,150,1).then(()=>{if(active&&ref.current){const k=ref.current.getContext('2d')!;k.clearRect(0,0,280,150);k.drawImage(result,0,0)}}).catch(()=>{});return()=>{active=false}},[name,effect,enabled])
 return <canvas className="effect-preview" ref={ref} width={280} height={150} aria-label="Live blending effect sample"/>
}
