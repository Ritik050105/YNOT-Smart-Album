import {importTemplateGeometry} from './ImportTemplateGeometry'
import {askTemplateCategory} from './ClassifyTemplate'
import {classifyTemplates} from '@/engine/templateCollections'
import {useRef,useState} from 'react'
import {useProjectStore} from '@/state/projectStore'
import {parseTemplateTransfer} from '@/engine/templateTransfer'

/** Null total = we know it is working but not yet how much there is to do. */
type Progress={kind:'import'|'export';label:string;done:number;total:number|null}

/** Lets the browser paint before a long synchronous step, so the progress line is actually seen
 *  rather than set and cleared inside one React batch. */
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)))

export default function TemplateTransfer(){
 const input=useRef<HTMLInputElement>(null),kind=useProjectStore(s=>s.templateBrowseKind),all=useProjectStore(s=>s.userTemplates)
 const templates=all.filter(t=>kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)
 const [progress,setProgress]=useState<Progress|null>(null)
 const [result,setResult]=useState<{text:string;failed?:boolean}|null>(null)
 const busy=!!progress

 async function exportTemplates(){
  setResult(null)
  setProgress({kind:'export',label:`Preparing ${templates.length} ${kind} template${templates.length===1?'':'s'}`,done:0,total:templates.length})
  try{
   await paint()
   const blob=new Blob([JSON.stringify({format:'ynot-templates',version:1,templates})],{type:'application/json'})
   setProgress({kind:'export',label:'Saving file',done:templates.length,total:templates.length})
   await paint()
   const url=URL.createObjectURL(blob),a=document.createElement('a')
   a.href=url;a.download=`YNOT-${kind}-templates.ynot-templates.json`;a.click()
   setTimeout(()=>URL.revokeObjectURL(url),1000)
   setResult({text:`Exported ${templates.length} ${kind} template${templates.length===1?'':'s'}.`})
  }catch(error){setResult({text:String(error),failed:true})}
  finally{setProgress(null)}
 }

 async function importTemplates(file:File){
  setResult(null)
  setProgress({kind:'import',label:`Reading ${file.name}`,done:0,total:null})
  try{
   await paint()
   const items=/\.json$/i.test(file.name)
    ?parseTemplateTransfer(await file.text())
    :[await importTemplateGeometry(file)].filter((t):t is NonNullable<typeof t>=>!!t)
   if(!items.length){setResult({text:'Import cancelled.'});return}
   const unclassified=items.filter(t=>!t.category)
   let category:string|null=null
   if(unclassified.length){
    // The category dialog is the designer's turn, not ours — stop claiming progress behind it.
    setProgress(null)
    category=await askTemplateCategory(unclassified[0])
    if(!category){setResult({text:'Import cancelled.'});return}
   }
   for(const t of unclassified){t.category=category!.split(' / ')[0];t.subcategory=category!.split(' / ').slice(1).join(' / ')||undefined}
   setProgress({kind:'import',label:'Adding templates',done:0,total:items.length})
   await paint()
   useProjectStore.getState().addImportedTemplates(items)
   let done=0
   for(const t of items){
    classifyTemplates([t.id],[t.category,t.subcategory].filter(Boolean).join(' / '))
    done++
    // Repaint every few templates so a large file shows the count climbing, not one frozen frame.
    if(done%5===0||done===items.length){setProgress({kind:'import',label:'Adding templates',done,total:items.length});await paint()}
   }
   const importedKind=items[0].textBoxes?.length?'mixed':'image'
   if(importedKind!==kind)useProjectStore.setState({templateBrowseKind:importedKind})
   setResult({text:`Imported ${items.length} ${importedKind} template${items.length===1?'':'s'}.`})
  }catch(error){setResult({text:String(error),failed:true})}
  finally{setProgress(null)}
 }

 return <>
  <button className="btn btn--tiny" disabled={!templates.length||busy} onClick={exportTemplates}>Export {kind} templates</button>
  <button className="btn btn--tiny" disabled={busy} onClick={()=>input.current?.click()}>Import {kind} templates</button>
  {progress&&<span className="template-transfer__progress" role="status">
   <span className="template-transfer__spinner"/>
   <span className="template-transfer__label">{progress.label}{progress.total!==null&&progress.total>1?` · ${progress.done} of ${progress.total}`:''}…</span>
   {progress.total!==null&&<span className="template-transfer__bar"><span style={{width:`${Math.round(progress.done/Math.max(1,progress.total)*100)}%`}}/></span>}
  </span>}
  {!progress&&result&&<span className={`template-transfer__result${result.failed?' is-failed':''}`} role="status">{result.text}</span>}
  <input hidden ref={input} type="file" accept=".json,image/*,.psd,.tif,.tiff" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importTemplates(file)}}/>
 </>
}
