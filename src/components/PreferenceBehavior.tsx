import { useEffect, useState } from 'react'
import { usePreferences } from '@/state/preferences'
import Modal from './Modal'
import { useProjectStore } from '@/state/projectStore'
export default function PreferenceBehavior(){
 const [notice,setNotice]=useState('')
 useEffect(()=>{const show=(e:Event)=>setNotice((e as CustomEvent<string>).detail);window.addEventListener('album-studio:preference-notice',show);return()=>window.removeEventListener('album-studio:preference-notice',show)},[])
 const p=usePreferences(s=>s.values)
 useEffect(()=>{const root=document.documentElement;root.dataset.spreadBar=p.spreadBar;root.dataset.animations=String(p.animations)
 const wheel=(e:WheelEvent)=>{if(e.ctrlKey||e.metaKey||!(e.target instanceof Element))return;const el=e.target.closest<HTMLElement>('.spreads-panel__row,.spreads-panel__timeline,.matching-templates__strip');if(!el||el.scrollWidth<=el.clientWidth)return;const delta=p.scrollAxis==='horizontal'?e.deltaX:p.scrollAxis==='vertical'?e.deltaY:e.deltaX||e.deltaY;if(delta){e.preventDefault();el.scrollLeft+=delta*p.scrollSpeed*(e.deltaMode===1?16:1)}}
 const titles=new Map<HTMLElement,string>();const hint=(e:Event)=>{if(p.hints||!(e.target instanceof Element))return;const el=e.target.closest<HTMLElement>('[title]');if(el){titles.set(el,el.title);el.removeAttribute('title')}}
 window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('pointerover',hint,true)
 return()=>{window.removeEventListener('wheel',wheel);window.removeEventListener('pointerover',hint,true);titles.forEach((title,el)=>el.title=title)}
 },[p])
 useEffect(()=>{if(p.gridMode!=='auto')useProjectStore.setState({showGrid:p.gridMode==='on'})},[p.gridMode])
 return notice?<Modal title="Image reuse" onClose={()=>setNotice('')} footer={<button className="btn btn--primary" onClick={()=>setNotice('')}>OK</button>}><p>{notice}</p></Modal>:null
}
