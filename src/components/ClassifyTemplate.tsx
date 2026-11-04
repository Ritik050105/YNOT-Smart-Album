import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import Modal from './Modal'
import TemplatePreview from './TemplatePreview'
import {TemplateDefinition} from '@/types'
import {readCollections} from '@/engine/templateCollections'
export function askTemplateCategory(template?:TemplateDefinition):Promise<string|null>{
 return new Promise(resolve=>{const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const finish=(value:string|null)=>{resolve(value);setTimeout(()=>{root.unmount();host.remove()},0)}
 function Dialog(){const existing=Object.keys(readCollections().categories),[selected,setSelected]=useState(existing[0]??'New category…'),[name,setName]=useState(''),[subcategory,setSubcategory]=useState('');const category=selected==='New category…'?name.trim():selected
 return <Modal title="Save template classification" onClose={()=>finish(null)} footer={<><button className="btn" onClick={()=>finish(null)}>Cancel</button><button className="btn btn--primary" disabled={!category||(category+(subcategory.trim()?` / ${subcategory.trim()}`:``)).length>100} onClick={()=>finish(subcategory.trim()?`${category} / ${subcategory.trim()}`:category)}>Save</button></>}>
 {template&&<div style={{maxWidth:240,margin:'0 auto 20px'}}><TemplatePreview template={template} aspect={2}/></div>}
 <label className="field">Category<select value={selected} onChange={e=>setSelected(e.target.value)}>{[...existing,'New category…'].map(c=><option key={c}>{c}</option>)}</select></label>{selected==='New category…'&&<label className="field">New category<input autoFocus maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>}<label className="field">Subcategory (optional)<input maxLength={50} value={subcategory} onChange={e=>setSubcategory(e.target.value)}/></label></Modal>}
 root.render(<Dialog/>)} )
}
