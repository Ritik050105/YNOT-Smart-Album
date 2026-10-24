import { useProjectStore } from '@/state/projectStore'
import { Spread } from '@/types'

export default function DesignerLayers({spread}:{spread:Spread}) {
 const state=useProjectStore()
 const rows=[...spread.textBoxes.map(t=>({id:t.id,kind:'text' as const,label:t.text.trim()||'Text',locked:!!t.locked})).reverse(),...spread.placements.map((p,i)=>({id:p.placeholderId,kind:'image' as const,label:state.project.photos.find(a=>a.id===p.photoId)?.fileName||`Empty frame ${i+1}`,locked:!!p.locked})).reverse(),{id:'background',kind:'background' as const,label:'Background',locked:!!spread.backgroundLocked}]
 return <details className="designer-layers" open><summary>Layers <span>{rows.length}</span></summary><div className="designer-layers__list">{rows.map(row=><div className="designer-layers__row" key={row.kind+row.id}>
 <button className="designer-layers__select" title={row.label} aria-pressed={row.kind==='image'?state.selectedPlaceholderId===row.id:row.kind==='text'?state.selectedTextBoxId===row.id:false} onClick={()=>{if(row.kind==='image')state.selectPlaceholder(row.id);else state.selectTextBox(row.kind==='text'?row.id:null)}}>{row.label}</button>
 <button className="btn btn--tiny" aria-label={`${row.locked?'Unlock':'Lock'} ${row.label}`} aria-pressed={row.locked} onClick={()=>state.setLayerLocked(spread.id,row.kind,row.id,!row.locked)}>{row.locked?'Unlock':'Lock'}</button>
 </div>)}</div></details>
}
