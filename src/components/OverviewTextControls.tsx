import {selectionGeometry,transformLayerSelection} from '@/engine/spreadLayers'
import {useProjectStore} from '@/state/projectStore'
import {Spread,TextBox} from '@/types'
import {PointerEvent,useState} from 'react'
export default function OverviewTextControls({spread}:{spread:Spread}){
 const state=useProjectStore(),selected=state.selectedSpreadId===spread.id?state.selectedTextBoxId:null
 // Double-click edits the text right on the spread; scale maps the box's design-size font to the thumbnail.
 const [editing,setEditing]=useState<{id:string;scale:number}|null>(null)
 const commitEdit=(box:TextBox,text:string)=>{setEditing(null);if(text!==box.text)state.updateTextBox(spread.id,box.id,{text})}
 const active=spread.textBoxes.find(t=>t.id===selected),group=active?.groupId?selectionGeometry(spread,['text:'+active.id],state.project.size):null
 function start(event:PointerEvent<HTMLDivElement>,box:TextBox,resize=false){
  event.stopPropagation();event.preventDefault();state.selectSpread(spread.id);state.selectTextBox(box.id)
  const geometry=selectionGeometry(spread,['text:'+box.id],state.project.size)
  if(box.locked||geometry?.members.some(m=>m.value.locked))return
  const surface=event.currentTarget.closest<HTMLElement>('.spread-thumb')!;surface.dataset.overviewDragging='true'
  const bounds=surface.getBoundingClientRect(),x=event.clientX,y=event.clientY
  const original=spread
  let next=original
  const move=(e:globalThis.PointerEvent)=>{const dx=(e.clientX-x)/bounds.width,dy=(e.clientY-y)/bounds.height;
   if(resize&&geometry){const sx=Math.max(.05,(geometry.width+dx)/geometry.width),sy=Math.max(.05,(geometry.height+dy)/geometry.height),scale=Math.min(sx,sy);next=transformLayerSelection(spread,state.project.size,['text:'+box.id],{x:geometry.x,y:geometry.y,width:geometry.width*(box.shape&&!box.groupId?sx:scale),height:geometry.height*(box.shape&&!box.groupId?sy:scale)})}
   else if(geometry)next=transformLayerSelection(spread,state.project.size,['text:'+box.id],{x:geometry.x+dx,y:geometry.y+dy,width:geometry.width,height:geometry.height});
   useProjectStore.setState(s=>({project:{...s.project,spreads:s.project.spreads.map(p=>p.id===spread.id?next:p)}}))}

  const finish=(cancelled=false)=>{delete surface.dataset.overviewDragging;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);useProjectStore.setState(s=>({project:{...s.project,spreads:s.project.spreads.map(p=>p.id===spread.id?original:p)}}));if(!cancelled&&next!==original){const base=useProjectStore.getState().project;useProjectStore.setState(s=>({project:{...base,spreads:base.spreads.map(p=>p.id===spread.id?next:p)},history:[...s.history,base].slice(-50),future:[],isDirty:true}))}}
  const up=()=>finish(),cancel=()=>finish(true),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();finish(true)}}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key)
 }
 return <>{spread.textBoxes.filter(t=>!t.hidden).map(box=><div key={box.id} data-overview-text tabIndex={0} role="button" aria-label={box.shape??box.text} onClick={e=>e.stopPropagation()} onPointerDown={e=>{if(editing?.id!==box.id)start(e,box)}} onDoubleClick={e=>{e.stopPropagation();state.selectSpread(spread.id);state.selectTextBox(box.id);if(!box.shape&&!box.locked){const surface=e.currentTarget.closest<HTMLElement>('.spread-thumb');setEditing({id:box.id,scale:(surface?.getBoundingClientRect().width??900)/900})}else useProjectStore.setState({rightPanelOpen:true})}} style={{position:'absolute',left:box.x*100+'%',top:box.y*100+'%',width:box.width*100+'%',height:box.height*100+'%',transform:`rotate(${box.rotationDeg??0}deg)`,transformOrigin:'top left',border:selected===box.id&&!group?'1px dashed var(--accent)':'1px solid transparent',cursor:box.locked?'default':'move',touchAction:'none'}}>{editing?.id===box.id&&<textarea autoFocus aria-label="Edit text" defaultValue={box.text} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onFocus={e=>e.currentTarget.select()} onBlur={e=>commitEdit(box,e.currentTarget.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();setEditing(null)}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();commitEdit(box,e.currentTarget.value)}}} style={{position:'absolute',inset:0,width:'100%',height:'100%',minHeight:'1.4em',resize:'none',overflow:'hidden',border:'1px solid var(--accent)',background:'rgba(255,255,255,.88)',color:box.color,textAlign:box.align,fontFamily:box.fontFamily,fontWeight:box.bold?700:400,fontStyle:box.italic?'italic':'normal',fontSize:box.fontSize*editing.scale+'px',lineHeight:box.lineHeight??1.2,padding:0,margin:0,outline:'none'}}/>}{selected===box.id&&!group&&!box.locked&&<div role="button" aria-label="Resize text or shape" onPointerDown={e=>start(e,box,true)} style={{position:'absolute',right:-5,bottom:-5,width:10,height:10,borderRadius:'50%',background:'var(--accent)',cursor:'nwse-resize'}}/>}</div>)}{group&&active&&<div aria-label="Selected quote group" style={{position:'absolute',left:group.x*100+'%',top:group.y*100+'%',width:group.width*100+'%',height:group.height*100+'%',border:'1px dashed var(--accent)',pointerEvents:'none'}}>{!group.members.some(m=>m.value.locked)&&<div role="button" aria-label="Resize quote group" onPointerDown={e=>start(e,active,true)} style={{position:'absolute',right:-5,bottom:-5,width:10,height:10,borderRadius:'50%',background:'var(--accent)',cursor:'nwse-resize',pointerEvents:'auto',touchAction:'none'}}/>}</div>}</>
}
