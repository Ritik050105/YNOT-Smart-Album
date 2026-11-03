import {importTemplateGeometry} from './ImportTemplateGeometry'
import {askTemplateCategory} from './ClassifyTemplate'
import {classifyTemplates} from '@/engine/templateCollections'
import {useRef,useState} from 'react'
import {useProjectStore} from '@/state/projectStore'
import {parseTemplateTransfer} from '@/engine/templateTransfer'
export default function TemplateTransfer(){
 const input=useRef<HTMLInputElement>(null),kind=useProjectStore(s=>s.templateBrowseKind),all=useProjectStore(s=>s.userTemplates),templates=all.filter(t=>kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)
 const [busy,setBusy]=useState<'import'|'export'|null>(null)
 return <>
  <button className="btn btn--tiny" disabled={!templates.length||!!busy} onClick={()=>{setBusy('export');try{const blob=new Blob([JSON.stringify({format:'ynot-templates',version:1,templates})],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Creative-layouts.ynot-templates.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}finally{setBusy(null)}}}>{busy==='export'?'Exporting…':`Export ${kind} templates`}</button>
  <button className="btn btn--tiny" disabled={!!busy} onClick={()=>input.current?.click()}>{busy==='import'?'Importing…':`Import ${kind} templates`}</button>
  {busy&&<span className="template-transfer__spinner" role="status" aria-label={busy==='import'?'Importing template':'Exporting templates'}/>}
  <input hidden ref={input} type="file" accept=".json,image/*,.psd,.tif,.tiff" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy('import');try{
   const items=/\.json$/i.test(file.name)?parseTemplateTransfer(await file.text()):[await importTemplateGeometry(file)].filter((t):t is NonNullable<typeof t>=>!!t)
   if(!items.length)return
   const unclassified=items.filter(t=>!t.category)
   const category=unclassified.length?await askTemplateCategory(unclassified[0]):null
   if(unclassified.length&&!category)return
   for(const t of unclassified){t.category=category!.split(' / ')[0];t.subcategory=category!.split(' / ').slice(1).join(' / ')||undefined}
   useProjectStore.getState().addImportedTemplates(items)
   for(const t of items)classifyTemplates([t.id],[t.category,t.subcategory].filter(Boolean).join(' / '))
   const importedKind=items[0].textBoxes?.length?'mixed':'image'
   if(importedKind!==kind)useProjectStore.setState({templateBrowseKind:importedKind})
  }catch(error){window.alert(String(error))}finally{setBusy(null)}}}/>
 </>
}
