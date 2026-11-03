import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {readPsd,Layer} from 'ag-psd'
import {TemplateDefinition,PlaceholderRect,TextBox} from '@/types'
import {imageFileSource,isImageFile} from '@/engine/imageSource'
import {detectTemplateFrames} from '@/engine/templateGeometry'
import Modal from './Modal'

export async function importTemplateGeometry(file:File):Promise<TemplateDefinition|null>{
 if(!isImageFile(file)||file.size>128*1024*1024)throw new Error('Choose an image or PSD up to 128 MB.')
 const isPsd=/\.psd$/i.test(file.name)
 let frames:PlaceholderRect[]=[]
 const textBoxes:TextBox[]=[]
 if(isPsd){
  // Keep the real pixels so the geometry pass below can also pull text-layer canvases for sourceArtwork.
  const psd=readPsd(await file.arrayBuffer(),{skipCompositeImageData:true,skipThumbnail:true})
  if(psd.width*psd.height>100000000)throw new Error('PSD dimensions are too large.')
  const groupId=crypto.randomUUID()
  function visit(layers:Layer[]){for(const l of layers){if(l.hidden)continue;if(l.children){visit(l.children);continue}
   if(/\bbackground\b|\bbackdrop\b|^bg$/i.test(l.name??''))continue
   if(l.text){
    if(!l.canvas)continue
    const x=l.left??0,y=l.top??0,w=(l.right??x)-x,h=(l.bottom??y)-y;if(w<=0||h<=0)continue
    const t=l.text,style=t.style,text=t.text??'',fontFamily=style?.font?.name??'Arial',fontSize=Math.max(1,Math.min(1000,(style?.fontSize??30)*900/psd.width)),color='#222222',bold=!!style?.fauxBold,italic=!!style?.fauxItalic
    textBoxes.push({id:crypto.randomUUID(),groupId,text,fontFamily,fontSize,color,bold,italic,align:'left',autoWidth:false,x:x/psd.width,y:y/psd.height,width:w/psd.width,height:h/psd.height,sourceArtwork:{src:l.canvas.toDataURL('image/png'),fontRatio:fontSize/(w/psd.width*900),text,fontFamily,color,bold,italic}})
    continue
   }
   const x=Math.max(0,l.left??0),y=Math.max(0,l.top??0),w=Math.min(psd.width,l.right??0)-x,h=Math.min(psd.height,l.bottom??0)-y
   if(w>0&&h>0)frames.push({id:crypto.randomUUID(),x:x/psd.width,y:y/psd.height,width:w/psd.width,height:h/psd.height,preferredOrientation:'any'})
  }}visit(psd.children??[])
  // An unnamed layer that covers (almost) the whole canvas alongside other, smaller frames is a
  // background plate, not a photo slot — drop it, but keep it when it's the only frame (a real
  // full-bleed single-photo layout).
  if(frames.length>1)frames=frames.filter(f=>f.width*f.height<0.95)
 }
 const source=await imageFileSource(file)
 let preview:string,aspect:number
 try{const img=new Image();img.src=source;await img.decode();if(img.width*img.height>100000000)throw new Error('Image dimensions are too large.')
  aspect=img.width/img.height;const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*Math.min(1,900/Math.max(img.width,img.height))));c.height=Math.max(1,Math.round(c.width/aspect));const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0,c.width,c.height);preview=c.toDataURL('image/png');if(!frames.length&&!isPsd)frames=detectTemplateFrames(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height)
 }finally{if(source.startsWith('blob:'))URL.revokeObjectURL(source)}
 if(isPsd&&!frames.length)throw new Error('This PSD has no visible photo layers. Import a PNG export to detect frames from its flattened artwork.')
 if(frames.length>100)throw new Error('This template has more than 100 layers. Simplify it before importing.')
 if(isPsd)return {id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),kind:textBoxes.length?'mixed':'image',photoCount:frames.length,pageSide:'spread',placeholders:frames,textBoxes:textBoxes.length?textBoxes:undefined,isBuiltIn:false,absoluteFrames:true,createdAt:new Date().toISOString(),thumbnailColor:'#fff',thumbnailImage:preview}
 return new Promise(resolve=>{const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const finish=(value:TemplateDefinition|null)=>{resolve(value);setTimeout(()=>{root.unmount();host.remove()},0)}
 function Review(){const [boxes,setBoxes]=useState(frames),[selected,setSelected]=useState(0);const box=boxes[selected]
  const valid=boxes.length>0&&boxes.every(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.x>=0&&b.y>=0&&b.width>0&&b.height>0&&b.x+b.width<=1.00001&&b.y+b.height<=1.00001)
  return <Modal title="Review detected photo frames" width={760} className="frame-review" onClose={()=>finish(null)} footer={<><button className="btn" onClick={()=>finish(null)}>Cancel</button><button className="btn btn--primary" disabled={!valid} onClick={()=>finish({id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),photoCount:boxes.length,pageSide:'spread',placeholders:boxes,isBuiltIn:false,absoluteFrames:true,createdAt:new Date().toISOString(),thumbnailColor:'#fff',thumbnailImage:preview})}>Use {boxes.length} editable frames</button></>}>
   <p className="frame-review__hint">Check every frame against the reference. Click a frame to correct its position or size. Flattened images cannot reveal overlapping or hidden elements.</p>
   <div className="frame-review__canvas" style={{aspectRatio:aspect}}><img src={preview} alt="Imported artwork"/>{boxes.map((b,i)=><button key={b.id} aria-label={`Frame ${i+1}`} className={`frame-review__frame${i===selected?' is-selected':''}`} onClick={()=>setSelected(i)} style={{left:`${b.x*100}%`,top:`${b.y*100}%`,width:`${b.width*100}%`,height:`${b.height*100}%`}}><span className="frame-review__badge">{i+1}</span></button>)}</div>
   <div className="frame-review__fields">{box&&(['x','y','width','height'] as const).map(key=><label key={key}><span>{key} (%)</span><input aria-label={`Frame ${key}`} type="number" min={0} max={100} step={.1} value={Math.round(box[key]*10000)/100} onChange={e=>setBoxes(bs=>bs.map((b,i)=>i===selected?{...b,[key]:Number(e.target.value)/100}:b))}/></label>)}</div>
   <div className="frame-review__actions"><button className="btn" disabled={boxes.length>=100} onClick={()=>{setSelected(boxes.length);setBoxes([...boxes,{id:crypto.randomUUID(),x:.1,y:.1,width:.3,height:.3,preferredOrientation:'any'}])}}>Add frame</button><button className="btn" disabled={!box} onClick={()=>{setBoxes(boxes.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1))}}>Remove frame</button></div>{!valid&&<p role="alert">Add at least one frame and keep all frames inside the reference.</p>}
  </Modal>
 }root.render(<Review/>)} )
}
