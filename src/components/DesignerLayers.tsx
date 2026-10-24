import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { spreadLayers } from '@/engine/spreadLayers'
import { Spread } from '@/types'

export default function DesignerLayers({spread}:{spread:Spread}) {
 const state=useProjectStore()
 const [dragOver,setDragOver]=useState<string|null>(null)
 const rows=[...spreadLayers(spread).reverse().map(layer=>({id:layer.id,kind:layer.kind,label:layer.kind==='text' ? layer.value.text.trim()||'Text' : state.project.photos.find(a=>a.id===layer.value.photoId)?.fileName||`Empty frame ${spread.placements.findIndex(p=>p.placeholderId===layer.id)+1}`,locked:!!layer.value.locked,hidden:!!layer.value.hidden})),{id:'background',kind:'background' as const,label:'Background',locked:!!spread.backgroundLocked,hidden:!!spread.backgroundHidden}]
 return <details className="designer-layers" open><summary>Layers <span>{rows.length}</span></summary><p className="designer-layers__help">Drag to reorder · Top layer appears in front</p><div className="designer-layers__list">{rows.map((row,index)=><div className={`designer-layers__row${row.hidden?' is-hidden':''}${dragOver===row.kind+row.id?' is-drop-target':''}`} key={row.kind+row.id} data-layer-id={row.id} data-layer-kind={row.kind}
 onDragOver={e=>{if(row.kind!=='background' && e.dataTransfer.types.includes('application/ynot-layer')){e.preventDefault();e.dataTransfer.dropEffect='move';setDragOver(row.kind+row.id)}}}
 onDragLeave={()=>setDragOver(null)} onDrop={e=>{e.preventDefault();setDragOver(null);if(row.kind==='background')return;try{const data=JSON.parse(e.dataTransfer.getData('application/ynot-layer'));if(data.spreadId===spread.id&&(data.kind==='image'||data.kind==='text')&&typeof data.id==='string')state.moveLayer(spread.id,data.kind,data.id,row.kind,row.id)}catch{/* Ignore unrelated drags. */}}}>
 <button className="designer-layers__grip" aria-label={`Reorder ${row.label}`} title={row.kind==='background'?'Background stays at the bottom':row.locked?'Unlock to reorder':'Drag to reorder, or use Up and Down arrow keys'} disabled={row.kind==='background'||row.locked} draggable={row.kind!=='background'&&!row.locked}
 onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/ynot-layer',JSON.stringify({spreadId:spread.id,kind:row.kind,id:row.id}))}} onDragEnd={()=>setDragOver(null)}
 onKeyDown={e=>{const target=rows[index+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)];if(target&&target!==row&&row.kind!=='background'&&target.kind!=='background'){e.preventDefault();state.moveLayer(spread.id,row.kind,row.id,target.kind,target.id)}}}>⠿</button>
 <button className="designer-layers__select" title={row.label} aria-pressed={row.kind==='image'?state.selectedPlaceholderId===row.id:row.kind==='text'?state.selectedTextBoxId===row.id:false} onClick={()=>{if(row.kind==='image')state.selectPlaceholder(row.id);else state.selectTextBox(row.kind==='text'?row.id:null)}}>{row.label}</button>
 <button className="btn btn--tiny" aria-label={`${row.hidden?'Show':'Hide'} ${row.label}`} aria-pressed={row.hidden} onClick={()=>state.setLayerHidden(spread.id,row.kind,row.id,!row.hidden)}>{row.hidden?'Show':'Hide'}</button>
 <button className="btn btn--tiny" aria-label={`${row.locked?'Unlock':'Lock'} ${row.label}`} aria-pressed={row.locked} onClick={()=>state.setLayerLocked(spread.id,row.kind,row.id,!row.locked)}>{row.locked?'Unlock':'Lock'}</button>
 </div>)}</div></details>
}
