import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import Modal from './Modal'
import TemplatePreview from './TemplatePreview'
import {TemplateDefinition} from '@/types'
import {ALBUM_SIZES} from '@/engine/albumSizes'
import {readCollections,setPendingAlbumSize} from '@/engine/templateCollections'

const NEW_CATEGORY='New category…',ANY_SIZE='Any album size',CUSTOM_SIZE='Custom size…'

/** Asks which category a template is filed under, and for which album size (any of the album sizes, or a custom one). The category is the answer; the album size is
 *  handed to the next `classifyTemplates`, which files the templates under it as well. */
export function askTemplateCategory(template?:TemplateDefinition):Promise<string|null>{
 return new Promise(resolve=>{
  setPendingAlbumSize('')
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
  const finish=(value:string|null)=>{resolve(value);setTimeout(()=>{root.unmount();host.remove()},0)}
  function Dialog(){
   const existing=Object.keys(readCollections().categories),[selected,setSelected]=useState(existing[0]??NEW_CATEGORY),[name,setName]=useState(''),[subcategory,setSubcategory]=useState('')
   const [size,setSize]=useState(ANY_SIZE),[width,setWidth]=useState(''),[height,setHeight]=useState('')
   const category=selected===NEW_CATEGORY?name.trim():selected
   const full=category+(subcategory.trim()?` / ${subcategory.trim()}`:'')
   // A custom size is its width and height in inches, written the way the library writes its own sizes.
   const customLabel=Number(width)>0&&Number(height)>0?`${Number(width)}" x ${Number(height)}" Custom`:''
   const sizeLabel=size===ANY_SIZE?'':size===CUSTOM_SIZE?customLabel:size
   const save=()=>{setPendingAlbumSize(sizeLabel);finish(full)}
   return <Modal className="save-template-dialog" width={420} title="Save template classification" onClose={()=>finish(null)} footer={<><button className="btn" onClick={()=>finish(null)}>Cancel</button><div className="footer-spacer"/>
     <button className="btn btn--primary" disabled={!category||full.length>100||(size===CUSTOM_SIZE&&!customLabel)} onClick={save}>Save</button></>}>
    {template&&<div className="save-template-dialog__preview"><span>Preview</span><TemplatePreview template={template} aspect={template.pageSide==='spread'?2:1}/></div>}
    <label className="field">Category<select value={selected} onChange={e=>setSelected(e.target.value)}>{[...existing,NEW_CATEGORY].map(c=><option key={c}>{c}</option>)}</select></label>
    {selected===NEW_CATEGORY&&<label className="field">New category<input autoFocus maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>}
    <label className="field">Subcategory (optional)<input maxLength={50} value={subcategory} onChange={e=>setSubcategory(e.target.value)}/></label>
    <label className="field">Album size<select aria-label="Album size" value={size} onChange={e=>setSize(e.target.value)}>{[ANY_SIZE,...ALBUM_SIZES.map(s=>s.label),CUSTOM_SIZE].map(s=><option key={s}>{s}</option>)}</select></label>
    {size===CUSTOM_SIZE&&<div className="field" role="group" aria-label="Custom album size in inches" style={{display:'flex',gap:8}}>
     <label style={{flex:1}}>Width (in)<input type="number" min={1} max={100} step={0.001} value={width} onChange={e=>setWidth(e.target.value)}/></label>
     <label style={{flex:1}}>Height (in)<input type="number" min={1} max={100} step={0.001} value={height} onChange={e=>setHeight(e.target.value)}/></label></div>}
   </Modal>}
  root.render(<Dialog/>)
 })
}
