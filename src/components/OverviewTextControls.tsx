import {selectionGeometry,transformLayerSelection} from '@/engine/spreadLayers'
import {useProjectStore} from '@/state/projectStore'
import {Spread,TextBox} from '@/types'
import {PointerEvent} from 'react'
export default function OverviewTextControls({spread}:{spread:Spread}){
 const state=useProjectStore(),selected=state.selectedSpreadId===spread.id?state.selectedTextBoxId:null
 // The overview only moves and resizes text — double-click opens the spread in the designer,
 // which is the one place text is written.
 const active=spread.textBoxes.find(t=>t.id===selected),group=active?.groupId?selectionGeometry(spread,['text:'+active.id],state.project.size):null
 function start(event:PointerEvent<HTMLDivElement>,box:TextBox,resize=false){
  event.stopPropagation();event.preventDefault();state.selectSpread(spread.id);state.selectTextBox(box.id)
  const geometry=selectionGeometry(spread,['text:'+box.id],state.project.size)
  if(box.locked||geometry?.members.some(m=>m.value.locked)){window.dispatchEvent(new CustomEvent('album-studio:preference-notice',{detail:'This text is locked. Select it and press Unlock in the top bar to move or edit it.'}));return}
  const surface=event.currentTarget.closest<HTMLElement>('.spread-thumb')!;surface.dataset.overviewDragging='true'
  const bounds=surface.getBoundingClientRect(),x=event.clientX,y=event.clientY
  const original=spread
  let next=original
  const move=(e:globalThis.PointerEvent)=>{const dx=(e.clientX-x)/bounds.width,dy=(e.clientY-y)/bounds.height;
   if(resize&&geometry){const sx=Math.max(.05,(geometry.width+dx)/geometry.width),sy=Math.max(.05,(geometry.height+dy)/geometry.height),scale=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;next=transformLayerSelection(spread,state.project.size,['text:'+box.id],{x:geometry.x,y:geometry.y,width:geometry.width*(box.shape&&!box.groupId?sx:scale),height:geometry.height*(box.shape&&!box.groupId?sy:scale)})}
   else if(geometry)next=transformLayerSelection(spread,state.project.size,['text:'+box.id],{x:geometry.x+dx,y:geometry.y+dy,width:geometry.width,height:geometry.height});
   useProjectStore.setState(s=>({project:{...s.project,spreads:s.project.spreads.map(p=>p.id===spread.id?next:p)}}))}

  const finish=(cancelled=false)=>{delete surface.dataset.overviewDragging;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key);useProjectStore.setState(s=>({project:{...s.project,spreads:s.project.spreads.map(p=>p.id===spread.id?original:p)}}));if(!cancelled&&next!==original){const base=useProjectStore.getState().project;useProjectStore.setState(s=>({project:{...base,spreads:base.spreads.map(p=>p.id===spread.id?next:p)},history:[...s.history,base].slice(-50),future:[],isDirty:true}))}}
  const up=()=>finish(),cancel=()=>finish(true),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();finish(true)}}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key)
 }
 // Both the text boxes and the group box around a selected composition carry
 // `data-overview-text`: that is the marker useTimelineDrag's window-level pointerdown listener
 // looks for to keep its hands off. Without it on the group box, grabbing the group's resize
 // handle also started a photo drag, and a ghost image trailed the cursor through the resize.
 return <>{spread.textBoxes.filter(t=>!t.hidden).map(box=><div key={box.id} data-overview-text tabIndex={0} role="button" aria-label={box.shape??box.text} onClick={e=>e.stopPropagation()} onPointerDown={e=>start(e,box)} onDoubleClick={e=>{e.stopPropagation();state.selectSpread(spread.id);state.selectTextBox(box.id);state.enterDesignerView(spread.id)}} style={{position:'absolute',left:box.x*100+'%',top:box.y*100+'%',width:box.width*100+'%',height:box.height*100+'%',transform:`rotate(${box.rotationDeg??0}deg)`,transformOrigin:'top left',border:selected===box.id&&!group?'1px solid var(--accent)':'1px solid transparent',cursor:box.locked?'default':'move',touchAction:'none'}}>{selected===box.id&&!group&&!box.locked&&<div role="button" aria-label="Resize text or shape" onPointerDown={e=>start(e,box,true)} style={{position:'absolute',right:-5,bottom:-5,width:10,height:10,borderRadius:'50%',background:'var(--accent)',cursor:'nwse-resize'}}/>}</div>)}{group&&active&&<div data-overview-text aria-label="Selected quote group" style={{position:'absolute',left:group.x*100+'%',top:group.y*100+'%',width:group.width*100+'%',height:group.height*100+'%',border:'1px solid var(--accent)',pointerEvents:'none'}}>{!group.members.some(m=>m.value.locked)&&<div role="button" aria-label="Resize quote group" onPointerDown={e=>start(e,active,true)} style={{position:'absolute',right:-5,bottom:-5,width:10,height:10,borderRadius:'50%',background:'var(--accent)',cursor:'nwse-resize',pointerEvents:'auto',touchAction:'none'}}/>}</div>}</>
}
