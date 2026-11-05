import React,{useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useProjectStore} from '@/state/projectStore'
import {selectedKeys,duplicateLayers,deleteLayers,layerEditItems} from '@/engine/layerClipboard'
import {selectionGeometry} from '@/engine/spreadLayers'
import ContextMenu from './ContextMenu'
import Icon from './Icon'

export default function SelectionActions({floating=false,transform}:{floating?:boolean;transform?:{x:number;y:number;scale:number;width:number;height:number}}){
 const state=useProjectStore(),keys=selectedKeys(),spread=state.project.spreads.find(s=>s.id===state.selectedSpreadId)
 const geometry=spread?selectionGeometry(spread,keys,state.project.size):null
 const [point,setPoint]=useState<{x:number;y:number}|null>(null),[more,setMore]=useState<{x:number;y:number}|null>(null)
 // Where the user has dragged the bar away from the spot it picks for itself. Kept until the
 // selection changes, so it does not drift back under the pointer mid-edit.
 const [offset,setOffset]=useState<{x:number;y:number}|null>(null)
 useEffect(()=>setOffset(null),[keys.join('|')])
 // Ends a drag in progress, so a selection that disappears mid-drag does not leave the window
 // listening and writing to a toolbar that is gone.
 const endDrag=useRef<(()=>void)|null>(null)
 useEffect(()=>()=>endDrag.current?.(),[])
 const drag=(event:React.PointerEvent)=>{
  if(event.button!==0)return
  event.preventDefault();event.stopPropagation()
  endDrag.current?.()
  const start={x:event.clientX,y:event.clientY},from=offset??{x:0,y:0}
  const move=(e:PointerEvent)=>setOffset({x:from.x+e.clientX-start.x,y:from.y+e.clientY-start.y})
  const stop=()=>{endDrag.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop)}
  endDrag.current=stop
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop)
 }
 useEffect(()=>{
  if(!floating||!geometry||!spread)return
  const measure=()=>{
   const node=transform?document.querySelector('.designer-canvas'):document.querySelector(`[data-overview-spread="${CSS.escape(spread.id)}"] .spreads-panel__card`)
   if(!node)return setPoint(null)
   const r=node.getBoundingClientRect(),x=r.left+(transform?.x??0)+(geometry.x+geometry.width/2)*(transform?transform.width*transform.scale:r.width),y=r.top+(transform?.y??0)+geometry.y*(transform?transform.height*transform.scale:r.height)
   const viewport=transform?node.closest('.designer-canvas-viewport'):node.closest('.spreads-panel')
   const v=viewport?.getBoundingClientRect()??r
   // Leave room for the rotation handle above the selection.
   const above=y-104,bottom=y+geometry.height*(transform?transform.height*transform.scale:r.height)
   const toolbarY=above>=v.top+8?above:bottom+20
   setPoint({x:Math.max(160,Math.min(window.innerWidth-160,x)),y:Math.max(v.top+8,Math.min(v.bottom-48,toolbarY))})
  };measure();window.addEventListener('resize',measure);document.addEventListener('scroll',measure,true)
  return()=>{window.removeEventListener('resize',measure);document.removeEventListener('scroll',measure,true)}
 },[floating,spread,keys.join('|'),transform?.x,transform?.y,transform?.scale,transform?.width,transform?.height])
 if(!spread||!geometry)return null
 const members=geometry.members,groups=[...new Set(members.map(m=>m.value.groupId).filter((id):id is string=>!!id))],locked=members.every(m=>m.value.locked),hasLocked=members.some(m=>m.value.locked),selected=new Set(members.map(m=>m.kind+':'+m.id))
 const ungroup=()=>{state.updateSpread(spread.id,{placements:spread.placements.map(m=>m.groupId&&groups.includes(m.groupId)?{...m,groupId:undefined}:m),textBoxes:spread.textBoxes.map(m=>m.groupId&&groups.includes(m.groupId)?{...m,groupId:undefined}:m)});state.setLayerSelection([...selected])}
 const lock=()=>state.setLayersLocked(spread.id,[...selected],!locked)
 const content=<div className={floating?'selection-actions selection-actions--floating':'selection-actions'} role="toolbar" aria-label={floating?'Selected element actions':'Selection actions'} style={floating?{position:'fixed',left:Math.max(90,Math.min(window.innerWidth-90,(point?.x??0)+(offset?.x??0))),top:Math.max(4,Math.min(window.innerHeight-48,(point?.y??0)+(offset?.y??0))),visibility:point?'visible':'hidden'}:undefined} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
 {floating&&<span className="selection-actions__grip" role="button" tabIndex={0} aria-label="Drag to move this toolbar" title="Drag to move this toolbar" onPointerDown={drag}><Icon name="grip" size={14}/></span>}
 <button className="btn" disabled={members.length<2||hasLocked} title="Group selected elements (Ctrl+G)" onClick={()=>state.groupLayers(spread.id,keys)}>Group</button>
 <button className="btn" disabled={!groups.length||hasLocked} title="Ungroup (Ctrl+Shift+G)" onClick={ungroup}>Ungroup</button>
 <button className="btn" aria-pressed={locked} onClick={lock}>{locked?'Unlock':'Lock'}</button>
 {floating&&<><span className="selection-actions__divider"/><button className="btn" aria-label="Duplicate selected elements" title="Duplicate" onClick={()=>duplicateLayers(spread.id,keys)}><Icon name="copy" size={17}/></button><button className="btn" aria-label="Delete selected elements" disabled={locked} title="Delete" onClick={()=>deleteLayers(spread.id,keys)}><Icon name="trash" size={17}/></button><button className="btn" aria-label="More selected element actions" onClick={e=>setMore({x:e.clientX,y:e.clientY})}>⋯</button></>}
 {more&&<ContextMenu {...more} onClose={()=>setMore(null)} items={layerEditItems(spread.id,keys)}/>}
 </div>
 return floating?createPortal(content,document.body):content
}
