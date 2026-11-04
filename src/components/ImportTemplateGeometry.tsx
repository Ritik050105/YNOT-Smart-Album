import {CSSProperties,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {readPsd,Layer} from 'ag-psd'
import {TemplateDefinition,PlaceholderRect,TextBox} from '@/types'
import {imageFileSource,isImageFile} from '@/engine/imageSource'
import {detectCornerRadius,detectTemplateFrames,opaqueBounds} from '@/engine/templateGeometry'
import Modal from './Modal'
import Icon from './Icon'

/** What a PSD or flattened image was read as, before the designer confirms it. */
type Detected = {
 frames:PlaceholderRect[]
 textBoxes:TextBox[]
 backgroundColor?:string
 preview:string
 aspect:number
 isPsd:boolean
}

const hex=(c:{r:number;g:number;b:number})=>'#'+[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')

/** Photoshop's justification values carry extra spellings ("justify-left") that all mean left. */
function alignOf(justification:unknown):TextBox['align']{
 return justification==='center'||justification==='justify-center'?'center':justification==='right'||justification==='justify-right'?'right':'left'
}

/** Average colour of a layer's opaque pixels — used for the page colour behind an imported design. */
function flatColor(canvas:HTMLCanvasElement):string|undefined{
 const data=canvas.getContext('2d',{willReadFrequently:true})?.getImageData(0,0,canvas.width,canvas.height).data
 if(!data)return undefined
 // Sample at most ~4k pixels; a page plate is flat, so more would only cost time.
 const step=4*Math.max(1,Math.floor(data.length/4/4096))
 let r=0,g=0,b=0,n=0
 for(let i=0;i<data.length;i+=step){if(data[i+3]<128)continue;r+=data[i];g+=data[i+1];b+=data[i+2];n++}
 return n?hex({r:r/n,g:g/n,b:b/n}):undefined
}

/** Reads a PSD's layer tree into photo frames, text boxes and a page colour. Text layers keep their
 *  Photoshop fill colour, size and alignment; photo layers keep any rounded corners their own alpha
 *  channel shows; and a layer that covers the page (or is named like one) becomes the background
 *  instead of a frame. */
function readPsdTemplate(bytes:ArrayBuffer):Omit<Detected,'preview'|'aspect'|'isPsd'>&{width:number;height:number}{
 // Read the header alone first: decoding every layer of an oversized PSD would exhaust memory
 // before the dimension check below ever ran.
 const header=readPsd(bytes,{skipThumbnail:true,skipLayerImageData:true,skipCompositeImageData:true})
 if(!header.width||!header.height||header.width*header.height>100000000)throw new Error('PSD dimensions are too large.')
 const psd=readPsd(bytes,{skipCompositeImageData:true,skipThumbnail:true})
 if(!psd.width||!psd.height)throw new Error('PSD dimensions are too large.')
 const frames:PlaceholderRect[]=[],textBoxes:TextBox[]=[],groupId=crypto.randomUUID()
 const backgrounds:HTMLCanvasElement[]=[]
 const area=psd.width*psd.height
 function visit(layers:Layer[]){for(const l of layers){
  if(l.hidden)continue
  if(l.children){visit(l.children);continue}
  if(!l.canvas)continue
  // A clipped layer is painted through the layer beneath it — a texture or colour wash, never a
  // frame of its own.
  if(l.clipping)continue
  let x=Math.max(0,l.left??0),y=Math.max(0,l.top??0)
  let w=Math.min(psd.width!,l.right??0)-x,h=Math.min(psd.height!,l.bottom??0)-y
  if(w<=0||h<=0)continue
  if(l.text){
   const t=l.text,style=t.style,text=t.text??''
   const fontSize=Math.max(1,Math.min(1000,(style?.fontSize??30)*900/psd.width!))
   const fill=style?.fillColor as {r:number;g:number;b:number}|undefined
   const color=fill&&typeof fill.r==='number'?hex(fill):'#222222'
   const fontFamily=style?.font?.name??'Arial'
   const bold=!!style?.fauxBold||/bold|black|heavy/i.test(fontFamily)
   const italic=!!style?.fauxItalic||/italic|oblique/i.test(fontFamily)
   textBoxes.push({id:crypto.randomUUID(),groupId,text,fontFamily,fontSize,color,bold,italic,
    align:alignOf(t.paragraphStyle?.justification??(style as {justification?:unknown}|undefined)?.justification),
    autoWidth:false,x:x/psd.width!,y:y/psd.height!,width:w/psd.width!,height:h/psd.height!,
    sourceArtwork:{src:l.canvas.toDataURL('image/png'),fontRatio:fontSize/(w/psd.width!*900),text,fontFamily,color,bold,italic}})
   continue
  }
  // Trim to the pixels the layer actually paints: a masked or oversized layer canvas otherwise
  // describes a frame far larger than the artwork shows, which is what made whole-page phantom
  // frames appear over real ones.
  const ink=opaqueBounds(l.canvas)
  if(!ink)continue
  const clip=(v:number,max:number)=>Math.max(0,Math.min(max,v))
  const right=clip(x+ink.x+ink.width,psd.width!),bottom=clip(y+ink.y+ink.height,psd.height!)
  x=clip(x+ink.x,psd.width!);y=clip(y+ink.y,psd.height!);w=right-x;h=bottom-y
  if(w<=0||h<=0)continue
  // A page-sized plate, or one named like one, is the paper the design sits on, not a photo slot.
  if(w*h>=area*0.9||/\bbackground\b|\bbackdrop\b|^bg$/i.test(l.name??'')){backgrounds.push(l.canvas);continue}
  // Stray 1px strokes and specks are decoration, not frames.
  if(w*h<area*0.001)continue
  frames.push({id:crypto.randomUUID(),x:x/psd.width!,y:y/psd.height!,width:w/psd.width!,height:h/psd.height!,
   preferredOrientation:'any',cornerRadiusPx:Math.round(detectCornerRadius(l.canvas,ink)/psd.width!*900)||undefined})
 }}
 visit(psd.children??[])
 // A full-page plate is a real full-bleed photo slot when the design has nothing else in it.
 if(!frames.length&&backgrounds.length===1)frames.push({id:crypto.randomUUID(),x:0,y:0,width:1,height:1,preferredOrientation:'any'})
 return {frames,textBoxes,backgroundColor:backgrounds.length?flatColor(backgrounds[0]):undefined,width:psd.width,height:psd.height}
}

async function detect(file:File):Promise<Detected>{
 const isPsd=/\.psd$/i.test(file.name)
 let frames:PlaceholderRect[]=[],textBoxes:TextBox[]=[],backgroundColor:string|undefined
 if(isPsd){const read=readPsdTemplate(await file.arrayBuffer());frames=read.frames;textBoxes=read.textBoxes;backgroundColor=read.backgroundColor}
 const source=await imageFileSource(file)
 let preview:string,aspect:number
 try{
  const img=new Image();img.src=source;await img.decode()
  if(img.width*img.height>100000000)throw new Error('Image dimensions are too large.')
  aspect=img.width/img.height
  const c=document.createElement('canvas')
  c.width=Math.max(1,Math.round(img.width*Math.min(1,900/Math.max(img.width,img.height))));c.height=Math.max(1,Math.round(c.width/aspect))
  const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0,c.width,c.height);preview=c.toDataURL('image/png')
  if(!frames.length&&!isPsd)frames=detectTemplateFrames(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height)
 }finally{if(source.startsWith('blob:'))URL.revokeObjectURL(source)}
 if(isPsd&&!frames.length&&!textBoxes.length)throw new Error('This PSD has no visible photo or text layers. Import a PNG export to detect frames from its flattened artwork.')
 if(frames.length>100)throw new Error('This template has more than 100 layers. Simplify it before importing.')
 return {frames,textBoxes,backgroundColor,preview,aspect,isPsd}
}

export async function importTemplateGeometry(file:File):Promise<TemplateDefinition|null>{
 if(!isImageFile(file)||file.size>128*1024*1024)throw new Error('Choose an image or PSD up to 128 MB.')
 const found=await detect(file)
 const name=file.name.replace(/\.[^.]+$/,'')
 return new Promise(resolve=>{
  const host=document.createElement('div');document.body.append(host)
  const root=createRoot(host)
  const finish=(value:TemplateDefinition|null)=>{resolve(value);setTimeout(()=>{root.unmount();host.remove()},0)}
  root.render(<Review found={found} name={name} onFinish={finish}/>)
 })
}

function Review({found,name,onFinish}:{found:Detected;name:string;onFinish:(t:TemplateDefinition|null)=>void}){
 const [boxes,setBoxes]=useState(found.frames)
 const [textIds,setTextIds]=useState(found.textBoxes.map(t=>t.id))
 const [useBackground,setUseBackground]=useState(!!found.backgroundColor)
 const [selected,setSelected]=useState(0)
 const box=boxes[selected]
 const texts=found.textBoxes.filter(t=>textIds.includes(t.id))
 const valid=boxes.length>0&&boxes.every(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.x>=0&&b.y>=0&&b.width>0&&b.height>0&&b.x+b.width<=1.00001&&b.y+b.height<=1.00001)
 const rounded=boxes.filter(b=>b.cornerRadiusPx).length
 function save(){
  onFinish({id:crypto.randomUUID(),name,kind:texts.length?'mixed':'image',photoCount:boxes.length,pageSide:'spread',
   placeholders:boxes,textBoxes:texts.length?texts:undefined,backgroundColor:useBackground?found.backgroundColor:undefined,
   isBuiltIn:false,absoluteFrames:true,createdAt:new Date().toISOString(),thumbnailColor:'#fff',thumbnailImage:found.preview})
 }
 return <Modal title="Review imported template" subtitle={name} width={960} className="frame-review" onClose={()=>onFinish(null)}
  footer={<><span className="frame-review__valid" role={valid?undefined:'alert'}>{valid?`${boxes.length} photo ${boxes.length===1?'frame':'frames'}${texts.length?`, ${texts.length} text ${texts.length===1?'layer':'layers'}`:''}`:'Add at least one frame and keep every frame inside the artwork.'}</span>
   <button className="btn" onClick={()=>onFinish(null)}>Cancel</button>
   <button className="btn btn--primary" disabled={!valid} onClick={save}>Add {texts.length?'mixed':'image'} template</button></>}>
  <div className="frame-review__layout">
   <div className="frame-review__stage">
    <div className="frame-review__canvas" style={{'--art-aspect':found.aspect,background:useBackground&&found.backgroundColor?found.backgroundColor:undefined} as CSSProperties}>
     <img src={found.preview} alt="Imported artwork"/>
     {texts.map(t=><span key={t.id} className="frame-review__text" style={{left:`${t.x*100}%`,top:`${t.y*100}%`,width:`${t.width*100}%`,height:`${t.height*100}%`}}/>)}
     {boxes.map((b,i)=><button key={b.id} aria-label={`Frame ${i+1}`} aria-pressed={i===selected}
      className={`frame-review__frame${i===selected?' is-selected':''}`} onClick={()=>setSelected(i)}
      style={{left:`${b.x*100}%`,top:`${b.y*100}%`,width:`${b.width*100}%`,height:`${b.height*100}%`,borderRadius:b.cornerRadiusPx?`${b.cornerRadiusPx/900*100}%`:undefined}}>
      <span className="frame-review__badge">{i+1}</span>
     </button>)}
    </div>
    {/* Which shelf of the library this lands on: the browser only ever offers a template to a
        spread holding this many photos, so it is the one number worth stating up front. */}
    <p className="frame-review__filed" role="status">Filed as a <strong>{boxes.length} photo {texts.length?'mixed':'image'} template</strong>{texts.length?` with ${texts.length} text layer${texts.length===1?'':'s'}`:''} — offered on spreads of {boxes.length} photo{boxes.length===1?'':'s'}.</p>
    <p className="frame-review__hint">Click a frame to correct its position or size. A flattened image cannot reveal overlapping or hidden elements.</p>
   </div>
   <aside className="frame-review__side">
    <section className="frame-review__group">
     <h3>Detected</h3>
     <ul className="frame-review__summary">
      <li><Icon name="image" size={13}/><span>{boxes.length} photo {boxes.length===1?'frame':'frames'}</span></li>
      <li><Icon name="type" size={13}/><span>{found.textBoxes.length} text {found.textBoxes.length===1?'layer':'layers'}</span></li>
      <li><Icon name="rectangle" size={13}/><span>{rounded?`${rounded} rounded`:'Square corners'}</span></li>
      <li><Icon name="droplet" size={13}/><span>{found.backgroundColor?`Background ${found.backgroundColor}`:'No background layer'}</span></li>
     </ul>
     {found.backgroundColor&&<label className="frame-review__toggle"><input type="checkbox" checked={useBackground} onChange={e=>setUseBackground(e.target.checked)}/>
      <span className="frame-review__swatch" style={{background:found.backgroundColor}}/>Use this page colour</label>}
     {!found.isPsd&&<p className="frame-review__note">Frames were traced from the flattened artwork. Import the layered PSD to carry text, rounded corners and the background across too.</p>}
    </section>
    {!!found.textBoxes.length&&<section className="frame-review__group">
     <h3>Text layers</h3>
     <ul className="frame-review__texts">{found.textBoxes.map(t=><li key={t.id}>
      <label><input type="checkbox" checked={textIds.includes(t.id)} onChange={e=>setTextIds(ids=>e.target.checked?[...ids,t.id]:ids.filter(id=>id!==t.id))}/>
       <span className="frame-review__swatch" style={{background:t.color}} title={t.color}/>
       <span className="frame-review__text-name" title={t.text}>{t.text.trim()||'Untitled text'}</span></label>
      <span className="frame-review__text-meta">{t.fontFamily} · {Math.round(t.fontSize)}px · {t.align}</span>
     </li>)}</ul>
    </section>}
    <section className="frame-review__group">
     <h3>Selected frame</h3>
     {box?<>
      <div className="frame-review__fields">{(['x','y','width','height'] as const).map(key=><label key={key}>
       <span>{key} (%)</span>
       <input aria-label={`Frame ${key}`} type="number" min={0} max={100} step={.1} value={Math.round(box[key]*10000)/100}
        onChange={e=>setBoxes(bs=>bs.map((b,i)=>i===selected?{...b,[key]:Number(e.target.value)/100}:b))}/>
      </label>)}</div>
      <label className="frame-review__radius"><span>Corner radius (px)</span>
       <input aria-label="Frame corner radius" type="number" min={0} max={200} step={1} value={box.cornerRadiusPx??0}
        onChange={e=>setBoxes(bs=>bs.map((b,i)=>i===selected?{...b,cornerRadiusPx:Number(e.target.value)||undefined}:b))}/>
      </label>
     </>:<p className="frame-review__note">No frames yet. Add one to start.</p>}
     <div className="frame-review__actions">
      <button className="btn btn--tiny" disabled={boxes.length>=100} onClick={()=>{setSelected(boxes.length);setBoxes([...boxes,{id:crypto.randomUUID(),x:.1,y:.1,width:.3,height:.3,preferredOrientation:'any'}])}}>Add frame</button>
      <button className="btn btn--tiny" disabled={!box} onClick={()=>{setBoxes(boxes.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1))}}>Remove frame</button>
     </div>
    </section>
   </aside>
  </div>
 </Modal>
}
