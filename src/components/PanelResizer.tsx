import { useEffect, useRef } from 'react'
/** `placed` is where the panel sits relative to its handle. A panel after the handle (below it, or to
 *  its right: the timeline, the photo dock, the right sidebar) grows when the handle is dragged back
 *  toward the start of the screen; a panel before it (above it: the template browser) grows when the
 *  handle is dragged away from it. The handle was written for the first kind only, so the second
 *  resized the wrong way — drag down to make it taller and it got shorter. */
export default function PanelResizer({axis,variable,label,initial,min,max,placed='after',storageKey}:{axis:'x'|'y';variable:string;label:string;initial:number;min:number;max:number;placed?:'before'|'after';storageKey?:string}) {
 const cleanup=useRef<(()=>void)|null>(null)
 useEffect(()=>()=>cleanup.current?.(),[])
 const sign=placed==='before'?-1:1
 // Where the size is remembered. It is the variable's own name unless a handle says otherwise —
 // which one does, to drop sizes saved while it was resizing the wrong way round.
 const key=storageKey??variable
 const limit=(v:number)=>Math.max(min,Math.min(v,max*(axis==='x'?innerWidth:innerHeight)))
 const apply=(v:number)=>{const value=limit(v);document.documentElement.style.setProperty(variable,value+'px');try{localStorage.setItem(key,String(value))}catch{};return value}
 useEffect(()=>{let saved=initial;try{saved=Number(localStorage.getItem(key))||initial}catch{};apply(saved);const resize=()=>apply(parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable))||initial);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[variable])
 return <div role="separator" tabIndex={0} aria-label={label} aria-orientation={axis==='x'?'vertical':'horizontal'} className={'panel-resizer panel-resizer--'+axis} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();apply((parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable))||initial)+sign*(['ArrowLeft','ArrowUp'].includes(e.key)?10:-10))}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();cleanup.current?.();e.currentTarget.setPointerCapture(e.pointerId);const start=axis==='x'?e.clientX:e.clientY;const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable))||initial;const move=(event:PointerEvent)=>apply(value+sign*(start-(axis==='x'?event.clientX:event.clientY)));const end=()=>{cleanup.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end)};cleanup.current=end;window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end)}} />
}
