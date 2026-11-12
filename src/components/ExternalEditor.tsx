import {importEditedPsd} from '@/engine/importEditedPsd'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { getPreferences } from '@/state/preferences'
import { buildSpreadPsdBytes } from '@/engine/exportPsd'
import { loadImage, renderSpreadToCanvas } from '@/engine/renderSpread'
import { canvasToBytes } from '@/engine/exportUtil'
import Modal from './Modal'
import { imageFileSource } from '@/engine/imageSource'
import { PhotoAsset } from '@/types'
type Request={app:'photoshop'|'canva';spreadId?:string;photoId?:string;src?:string;name?:string}
export const openInEditor=(request:Request)=>window.dispatchEvent(new CustomEvent('album-studio:external-editor',{detail:request}))
const savedWatches = new Map<string,{app:'photoshop'|'canva';projectId:string;photoId?:string;spreadId?:string;baseline:string;revision?:string}>()
export default function ExternalEditor(){
 const watches = useRef(savedWatches)
 const [syncNotice,setSyncNotice]=useState('')
 const [watchedFile,setWatchedFile]=useState('')
 const [status,setStatus]=useState<{app:string;busy:boolean;file?:string;error?:string}|null>(null)
 useEffect(()=>{let active=true;let busy=false;const open=async(event:Event)=>{
 if(busy)return;busy=true
 const request=(event as CustomEvent<Request>).detail;setStatus({app:request.app,busy:true})
 try{
 if(!window.albumStudio?.openExternalEditor)throw new Error('External editors are available in the desktop application.')
 const p=useProjectStore.getState().project;let data:Uint8Array,name:string
 if(request.src){const img=await loadImage(request.src);const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');if(!ctx)throw new Error('Image preparation failed.');ctx.drawImage(img,0,0);data=await canvasToBytes(c,'image/png');name=(request.name??'Image').replace(/\.[^.]+$/,'')+'.png'}
 else {const spread=p.spreads.find(s=>s.id===request.spreadId);if(!spread)throw new Error('Select a spread first.');const size=spread.size??p.size;const photos=new Map(p.photos.map(ph=>[ph.id,ph]));name=`${p.name}-${spread.isCover?'cover':`spread-${spread.order+1}`}.${request.app==='photoshop'?'psd':'png'}`;data=request.app==='photoshop'?await buildSpreadPsdBytes(spread,photos,size,size.dpi):await canvasToBytes(await renderSpreadToCanvas(spread,photos,size,size.dpi),'image/png')}
 const photoId=request.photoId ?? (request.src ? p.photos.find(ph=>ph.src===request.src)?.id : undefined)
 const baseline=request.src ? p.photos.find(ph=>ph.id===photoId)?.src : JSON.stringify(p.spreads.find(s=>s.id===request.spreadId))
 const file=await window.albumStudio.openExternalEditor({app:request.app,photoshopPath:getPreferences().photoshopPath,canvaPath:getPreferences().canvaPath,name,data,originalPath:request.src ? p.photos.find(ph=>ph.id===photoId)?.sourcePath : undefined});if(baseline) { for(const [previous,entry] of watches.current) if(entry.projectId===p.id && (photoId ? entry.photoId===photoId : entry.spreadId===request.spreadId)) watches.current.delete(previous); watches.current.set(file,{app:request.app,projectId:p.id,photoId,spreadId:request.src?undefined:request.spreadId,baseline}) }
 if(active){setWatchedFile(file);setStatus(request.app==='canva'?{app:request.app,busy:false,file}:null);setSyncNotice(request.app==='photoshop'?'Photoshop is open. Watching the same file for saved edits.':'Canva Desktop is open. Download your edited PNG to Downloads using the prepared filename; YNOT detects it automatically, including numbered copies. Ctrl+S in Canva does not replace this PNG.')}
 }catch(e){if(active)setStatus({app:request.app,busy:false,error:e instanceof Error?e.message:String(e)})}finally{busy=false}
 };window.addEventListener('album-studio:external-editor',open);return()=>{active=false;window.removeEventListener('album-studio:external-editor',open)}},[])
 useEffect(()=>{
   let active=true, running=false
   const timer=window.setInterval(async()=>{
     if(running || !window.albumStudio?.readExternalEdit)return
     running=true
     try { for(const [file,entry] of watches.current){
       const state=useProjectStore.getState()
       if(state.project.id!==entry.projectId)continue
       try {
         const result=await window.albumStudio.readExternalEdit(file,entry.revision)
         if(!result || !active)continue
         const current=useProjectStore.getState(),project=current.project
         if(project.id!==entry.projectId)continue
         const original=project.photos.find(p=>p.id===entry.photoId)
         const before=entry.photoId?original?.src:JSON.stringify(project.spreads.find(s=>s.id===entry.spreadId))
         if(before!==entry.baseline){watches.current.delete(file);setSyncNotice(`${entry.app==='canva'?'Canva':'Photoshop'} save preserved. This image or spread changed in YNOT; reopen it in the editor to start a new sync session.`);continue}
         if(entry.spreadId && /\.psd$/i.test(file)) {
           const layers=await importEditedPsd(new Uint8Array(result.data))
           current.applyExternalPsd(entry.spreadId,layers)
           entry.baseline=JSON.stringify(useProjectStore.getState().project.spreads.find(s=>s.id===entry.spreadId))
           entry.revision=result.revision
           setSyncNotice(`Photoshop save applied as ${layers.length} separate layers. Undo restores the previous spread.`)
           continue
         }
         const source=await imageFileSource(new File([new Uint8Array(result.data)],file.split(/[\\/]/).pop()!))
         let dataUrl:string,width:number,height:number
         try { const img=await loadImage(source);width=img.naturalWidth;height=img.naturalHeight
           const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d')!.drawImage(img,0,0);dataUrl=canvas.toDataURL('image/png')
         } finally { if(source.startsWith('blob:'))URL.revokeObjectURL(source) }
         if(!active)continue
         if(useProjectStore.getState().project!==project)continue
         const photo:PhotoAsset={...original,id:crypto.randomUUID(),fileName:original?.fileName ?? `${entry.app} edited spread.png`,sourcePath:result.sourcePath??file,src:dataUrl,width,height,capturedAt:original?.capturedAt ?? new Date().toISOString(),orientation:width===height?'square':width>height?'landscape':'portrait',megapixels:width*height/1000000,mimeType:'image/png',bins:original?.bins ?? [],favorite:original?.favorite ?? false}
         if(entry.photoId)current.relinkPhoto(entry.photoId,photo)
         else current.applyExternalSpread(entry.spreadId!,photo)
         const updated=useProjectStore.getState().project
         entry.baseline=entry.photoId?updated.photos.find(p=>p.id===entry.photoId)!.src:JSON.stringify(updated.spreads.find(s=>s.id===entry.spreadId))
         entry.revision=result.revision
         setSyncNotice(`${entry.app==='canva'?'Canva':'Photoshop'} save applied. Use Undo to restore the previous version.`)
       }catch(error){if(active)setSyncNotice(`Could not sync ${entry.app==='canva'?'Canva':'Photoshop'} save: ${error instanceof Error?error.message:String(error)}. ${entry.app==='canva'?'Export a PNG from Canva and replace the same prepared file.':'Save the same file again; PSD files need Maximize Compatibility enabled.'}`)}
     }}finally{running=false}
   },2000)
   return()=>{active=false;clearInterval(timer)}
 },[])
 return <>{syncNotice && <div className="external-edit-notice" role="status">{syncNotice}{watchedFile&&<button className="btn btn--tiny" onClick={()=>void window.albumStudio?.revealExportLocation(watchedFile).catch(e=>setSyncNotice(String(e)))}>Show watched file</button>}<button aria-label="Dismiss external editor sync message" onClick={()=>setSyncNotice('')}>×</button></div>}{status&&<Modal title={status.app==='photoshop'?'Open in Adobe Photoshop':'Open in Canva'} onClose={()=>{if(!status.busy)setStatus(null)}} footer={<button className="btn btn--primary" disabled={status.busy} onClick={()=>setStatus(null)}>Done</button>}>
 {status.busy?<p role="status">{status.app==='canva'?'Preparing a full-resolution copy for Canva Desktop…':'Preparing a full-resolution copy…'}</p>:status.error?<p role="alert">{status.error}</p>:<><p>{status.app==='canva'?'Your copy was sent to Canva Desktop. If Canva shows its home screen, use its Open file command to select the prepared PNG.':'Your copy was sent to Photoshop.'}</p><div className="text-style-row"><button className="btn btn--tiny" onClick={()=>{if(status.file)void window.albumStudio?.revealExportLocation(status.file).catch(e=>setSyncNotice(String(e)))}}>Show watched file</button><button className="btn btn--tiny" onClick={()=>{if(status.file)void navigator.clipboard.writeText(status.file).catch(e=>setSyncNotice(String(e)))}}>Copy file path</button></div><p style={{overflowWrap:'anywhere'}}>{status.file}</p><p className="muted">{status.app==='photoshop'?'Save this same file in Photoshop to update YNOT automatically while this album is open. Layered PSD saves return as separate image layers; Undo restores the layout.':'In Canva Desktop, choose Share → Download → PNG, then save to Downloads using the same filename (numbered copies are supported), or replace this exact file. Keep this album open; YNOT detects the completed save automatically. Ctrl+S saves the Canva design, not this local PNG. Spread updates return as one image; Undo restores the layout.'}</p></>}
 </Modal>}</>
}
