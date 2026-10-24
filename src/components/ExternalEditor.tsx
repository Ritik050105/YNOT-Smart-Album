import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { getPreferences } from '@/state/preferences'
import { buildSpreadPsdBytes } from '@/engine/exportPsd'
import { renderSpreadToCanvas } from '@/engine/renderSpread'
import { canvasToBytes } from '@/engine/exportUtil'
import Modal from './Modal'
type Request={app:'photoshop'|'canva';spreadId?:string;src?:string;name?:string}
export const openInEditor=(request:Request)=>window.dispatchEvent(new CustomEvent('album-studio:external-editor',{detail:request}))
export default function ExternalEditor(){
 const [status,setStatus]=useState<{app:string;busy:boolean;file?:string;error?:string}|null>(null)
 useEffect(()=>{let active=true;let busy=false;const open=async(event:Event)=>{
 if(busy)return;busy=true
 const request=(event as CustomEvent<Request>).detail;setStatus({app:request.app,busy:true})
 try{
 if(!window.albumStudio?.openExternalEditor)throw new Error('External editors are available in the desktop application.')
 if(request.app==='photoshop'&&!getPreferences().photoshopPath)throw new Error('Choose Photoshop.exe under Tools → Preferences → Misc. first.')
 const p=useProjectStore.getState().project;let data:Uint8Array,name:string
 if(request.src){const img=new Image();img.src=request.src;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');if(!ctx)throw new Error('Image preparation failed.');ctx.drawImage(img,0,0);data=await canvasToBytes(c,'image/png');name=(request.name??'Image').replace(/\.[^.]+$/,'')+'.png'}
 else {const spread=p.spreads.find(s=>s.id===request.spreadId);if(!spread)throw new Error('Select a spread first.');const size=spread.size??p.size;const photos=new Map(p.photos.map(ph=>[ph.id,ph]));name=`${p.name}-${spread.isCover?'cover':`spread-${spread.order+1}`}.${request.app==='photoshop'?'psd':'png'}`;data=request.app==='photoshop'?await buildSpreadPsdBytes(spread,photos,size,size.dpi):await canvasToBytes(await renderSpreadToCanvas(spread,photos,size,size.dpi),'image/png')}
 const file=await window.albumStudio.openExternalEditor({app:request.app,photoshopPath:getPreferences().photoshopPath,name,data});if(active)setStatus({app:request.app,busy:false,file})
 }catch(e){if(active)setStatus({app:request.app,busy:false,error:e instanceof Error?e.message:String(e)})}finally{busy=false}
 };window.addEventListener('album-studio:external-editor',open);return()=>{active=false;window.removeEventListener('album-studio:external-editor',open)}},[])
 return status&&<Modal title={status.app==='photoshop'?'Open in Adobe Photoshop':'Open in Canva'} onClose={()=>{if(!status.busy)setStatus(null)}} footer={<button className="btn btn--primary" disabled={status.busy} onClick={()=>setStatus(null)}>Done</button>}>
 {status.busy?<p role="status">Preparing a full-resolution copy…</p>:status.error?<p role="alert">{status.error}</p>:<><p>{status.app==='canva'?'Canva is open. Choose Upload or Import file and select the file shown in Explorer.':'Your copy was sent to Photoshop.'}</p><p style={{overflowWrap:'anywhere'}}>{status.file}</p><p className="muted">The original album stays unchanged. Import your finished image back into YNOT when ready.</p></>}
 </Modal>
}
