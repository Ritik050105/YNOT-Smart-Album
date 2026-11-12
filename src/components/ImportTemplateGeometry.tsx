import {CSSProperties,PointerEvent as ReactPointerEvent,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {readPsd,Layer} from 'ag-psd'
import {TemplateDefinition,PlaceholderRect,TextBox} from '@/types'
import {imageFileSource,isImageFile,MAX_ARTWORK_BYTES,MAX_ARTWORK_LABEL,MAX_ARTWORK_PIXELS} from '@/engine/imageSource'
import {detectCornerRadius,detectTemplateFrames,maskVisibleBounds,opaqueBounds,vectorMaskGeometry} from '@/engine/templateGeometry'
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
 /** Frames left out because the artwork had more than the hundred a template can hold. */
 dropped:number
}

const hex=(c:{r:number;g:number;b:number})=>'#'+[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')

/** Photoshop's justification values carry extra spellings ("justify-left") that all mean left. */
function alignOf(justification:unknown):TextBox['align']{
 return justification==='center'||justification==='justify-center'?'center':justification==='right'||justification==='justify-right'?'right':'left'
}

/** The page colour behind an imported design: the most common colour among a layer's opaque pixels,
 *  not their average — a plate split between two tones averages to a muddy third colour that appears
 *  nowhere in the artwork. */
function flatColor(canvas:HTMLCanvasElement):string|undefined{
 const data=canvas.getContext('2d',{willReadFrequently:true})?.getImageData(0,0,canvas.width,canvas.height).data
 if(!data)return undefined
 // Sample at most ~8k pixels; a page plate is flat, so more would only cost time.
 const step=4*Math.max(1,Math.floor(data.length/4/8192))
 const buckets=new Map<number,{n:number;r:number;g:number;b:number}>()
 for(let i=0;i<data.length;i+=step){
  if(data[i+3]<128)continue
  const key=(data[i]>>3<<10)|(data[i+1]>>3<<5)|(data[i+2]>>3)
  const bucket=buckets.get(key)??{n:0,r:0,g:0,b:0}
  bucket.n++;bucket.r+=data[i];bucket.g+=data[i+1];bucket.b+=data[i+2];buckets.set(key,bucket)
 }
 const top=[...buckets.values()].sort((a,b)=>b.n-a.n)[0]
 return top?hex({r:top.r/top.n,g:top.g/top.n,b:top.b/top.n}):undefined
}

/** Reads a PSD's layer tree into photo frames, text boxes and a page colour. Text layers keep their
 *  Photoshop fill colour, size and alignment; photo layers keep any rounded corners their own alpha
 *  channel shows; and a layer that covers the page (or is named like one) becomes the background
 *  instead of a frame. */
function readPsdTemplate(bytes:ArrayBuffer):Omit<Detected,'preview'|'aspect'|'isPsd'|'dropped'>&{width:number;height:number}{
 // Read the header alone first: decoding every layer of an oversized PSD would exhaust memory
 // before the dimension check below ever ran.
 const header=readPsd(bytes,{skipThumbnail:true,skipLayerImageData:true,skipCompositeImageData:true})
 if(!header.width||!header.height||header.width*header.height>MAX_ARTWORK_PIXELS)throw new Error('PSD dimensions are too large.')
 const psd=readPsd(bytes,{skipCompositeImageData:true,skipThumbnail:true})
 if(!psd.width||!psd.height)throw new Error('PSD dimensions are too large.')
 // Each text layer comes in as its own layer. They used to share one groupId, which made the
 // whole caption block move and resize as a single object — fine for a font template, wrong for a
 // page design, where the headline and the body copy are placed independently.
 const frames:PlaceholderRect[]=[],textBoxes:TextBox[]=[]
 const backgrounds:HTMLCanvasElement[]=[]
 const area=psd.width*psd.height
 // "BG left page" inside a "Background" group is how designers mark the paper, and on a two-page
 // spread each plate covers only half the canvas, so area alone never catches them.
 const isBackgroundName=(name?:string)=>/\b(background|backdrop|bg)\b/i.test(name??'')
 function visit(layers:Layer[],inBackgroundGroup=false){for(const l of layers){
  if(l.hidden)continue
  if(l.children){visit(l.children,inBackgroundGroup||isBackgroundName(l.name));continue}
  if(!l.canvas)continue
  // A clipped layer is painted through the layer beneath it — a texture or colour wash, never a
  // frame of its own.
  if(l.clipping)continue
  // The layer's own origin, which may sit off-canvas — a cover photo often starts well left of the
  // page. Offsets into its canvas are measured from here, so clamping to the page has to come after
  // they are added, never before, or the frame lands as far off as the origin was.
  const originX=l.left??0,originY=l.top??0
  let x=Math.max(0,originX),y=Math.max(0,originY)
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
   textBoxes.push({id:crypto.randomUUID(),text,fontFamily,fontSize,color,bold,italic,
    align:alignOf(t.paragraphStyle?.justification??(style as {justification?:unknown}|undefined)?.justification),
    autoWidth:false,x:x/psd.width!,y:y/psd.height!,width:w/psd.width!,height:h/psd.height!,
    sourceArtwork:{src:l.canvas.toDataURL('image/png'),fontRatio:fontSize/(w/psd.width!*900),text,fontFamily,color,bold,italic}})
   continue
  }
  // A shape layer's rounding lives in its vector path, never in its pixels, so read the path when
  // there is one — that is where a magazine layout's rounded photo corners actually are.
  const toDesign=(v:number)=>Math.round(v/psd.width!*900)
  const vector=l.vectorMask?.paths?.length===1&&!l.vectorMask.paths[0].open?vectorMaskGeometry(l.vectorMask.paths[0].knots??[]):null
  let radii:[number,number,number,number]|undefined
  const rotationDeg=vector?.rotationDeg
  if(vector&&vector.radii.some(r=>r>0))radii=vector.radii.map(toDesign) as [number,number,number,number]
  const clip=(v:number,max:number)=>Math.max(0,Math.min(max,v))
  if(vector&&rotationDeg){
   // A turned frame is kept whole: clipping it to the page edges would square off the very
   // corners that make it slanted. It is only rejected if it lies outside the page altogether.
   x=vector.x;y=vector.y;w=vector.width;h=vector.height
   if(x+w<=0||y+h<=0||x>=psd.width!||y>=psd.height!)continue
  }else if(vector){
   const right=clip(vector.x+vector.width,psd.width!),bottom=clip(vector.y+vector.height,psd.height!)
   x=clip(vector.x,psd.width!);y=clip(vector.y,psd.height!);w=right-x;h=bottom-y
  }else{
   // Trim to the pixels the layer actually paints: a masked or oversized layer canvas otherwise
   // describes a frame far larger than the artwork shows, which is what made whole-page phantom
   // frames appear over real ones.
   const ink=opaqueBounds(l.canvas)
   if(!ink)continue
   const right=clip(originX+ink.x+ink.width,psd.width!),bottom=clip(originY+ink.y+ink.height,psd.height!)
   x=clip(originX+ink.x,psd.width!);y=clip(originY+ink.y,psd.height!);w=right-x;h=bottom-y
   const alpha=detectCornerRadius(l.canvas,ink)
   if(alpha>0){const r=toDesign(alpha);radii=[r,r,r,r]}
  }
  // A raster mask crops the layer without touching its pixels, so the frame has to be cut down to
  // what the mask leaves showing. Covers lean on this: a cover photo is usually one oversized image
  // masked back to its panel, and read without the mask it claims most of the spread.
  const mask=!rotationDeg&&l.mask&&!l.mask.disabled&&l.mask.canvas&&(l.mask.defaultColor??0)<128?l.mask:null
  if(mask){
   const visible=maskVisibleBounds(mask.canvas!)
   if(!visible)continue
   const mx=(mask.left??0)+visible.x,my=(mask.top??0)+visible.y
   const right=Math.min(clip(x+w,psd.width!),clip(mx+visible.width,psd.width!))
   const bottom=Math.min(clip(y+h,psd.height!),clip(my+visible.height,psd.height!))
   x=Math.max(x,clip(mx,psd.width!));y=Math.max(y,clip(my,psd.height!));w=right-x;h=bottom-y
  }
  if(w<=0||h<=0)continue
  // A layer named like the paper, or sitting in the group that holds it, is the paper. Covering the
  // whole page only means that when nothing has been read yet: PSD children arrive bottom first, so
  // a page-sized layer below everything else is a plate, while one above the plates is a full-bleed
  // photo — which is the whole design on some spreads.
  const bottomPlate=w*h>=area*0.9&&!backgrounds.length&&!frames.length
  if(bottomPlate||inBackgroundGroup||isBackgroundName(l.name)){backgrounds.push(l.canvas);continue}
  // Stray 1px strokes and specks are decoration, not frames.
  if(w*h<area*0.001)continue
  frames.push({id:crypto.randomUUID(),x:x/psd.width!,y:y/psd.height!,width:w/psd.width!,height:h/psd.height!,
   preferredOrientation:'any',rotationDeg,cornerRadiusPx:radii?Math.max(...radii)||undefined:undefined,
   cornerRadiiPx:radii&&new Set(radii).size>1?radii:undefined})
 }}
 visit(psd.children??[])
 // A full-page plate is a real full-bleed photo slot when the design has nothing else in it.
 if(!frames.length&&backgrounds.length===1)frames.push({id:crypto.randomUUID(),x:0,y:0,width:1,height:1,preferredOrientation:'any'})
 return {frames,textBoxes,backgroundColor:backgrounds.length?flatColor(backgrounds[0]):undefined,width:psd.width,height:psd.height}
}

/** Exported so detection can be measured against real PSDs without driving the review dialog. */
export async function detectTemplate(file:File):Promise<Detected>{
 const isPsd=/\.psd$/i.test(file.name)
 let frames:PlaceholderRect[]=[],textBoxes:TextBox[]=[],backgroundColor:string|undefined
 if(isPsd){const read=readPsdTemplate(await file.arrayBuffer());frames=read.frames;textBoxes=read.textBoxes;backgroundColor=read.backgroundColor}
 const source=await imageFileSource(file)
 let preview:string,aspect:number
 try{
  const img=new Image();img.src=source;await img.decode()
  if(img.width*img.height>MAX_ARTWORK_PIXELS)throw new Error('Image dimensions are too large.')
  aspect=img.width/img.height
  const c=document.createElement('canvas')
  c.width=Math.max(1,Math.round(img.width*Math.min(1,900/Math.max(img.width,img.height))));c.height=Math.max(1,Math.round(c.width/aspect))
  const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0,c.width,c.height);preview=c.toDataURL('image/png')
  if(!frames.length&&!isPsd)frames=detectTemplateFrames(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height)
 }finally{if(source.startsWith('blob:'))URL.revokeObjectURL(source)}
 if(isPsd&&!frames.length&&!textBoxes.length)throw new Error('This PSD has no visible photo or text layers. Import a PNG export to detect frames from its flattened artwork.')
 // A busy design is not a broken one. Rather than refuse it, keep the hundred largest frames —
 // the ones a layout is actually built from — and say so, so the rest can be added back by hand.
 let dropped=0
 if(frames.length>100){const keep=new Set([...frames].sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,100).map(f=>f.id));dropped=frames.length-keep.size;frames=frames.filter(f=>keep.has(f.id))}
 return {frames,textBoxes,backgroundColor,preview,aspect,isPsd,dropped}
}

export async function importTemplateGeometry(file:File):Promise<TemplateDefinition|null>{
 if(!isImageFile(file)||file.size>MAX_ARTWORK_BYTES)throw new Error(`Choose an image or PSD up to ${MAX_ARTWORK_LABEL}.`)
 const found=await detectTemplate(file)
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
 const stage=useRef<HTMLDivElement>(null)
 // Frames are dragged and resized on the artwork itself. The number fields stay for exact values,
 // but nobody positions a frame over a photograph by typing percentages at it.
 const endDrag=useRef<(()=>void)|null>(null)
 function grab(event:ReactPointerEvent,index:number,corner?:'nw'|'ne'|'se'|'sw'){
  if(event.button!==0)return
  event.preventDefault();event.stopPropagation()
  endDrag.current?.()
  setSelected(index)
  const art=stage.current?.getBoundingClientRect()
  if(!art||!art.width||!art.height)return
  const start=boxes[index],startX=event.clientX,startY=event.clientY
  const move=(e:globalThis.PointerEvent)=>{
   const dx=(e.clientX-startX)/art.width,dy=(e.clientY-startY)/art.height
   setBoxes(bs=>bs.map((b,i)=>{
    if(i!==index)return b
    if(!corner)return {...b,x:start.x+dx,y:start.y+dy}
    // The dragged corner moves and the opposite one stays put, so a resize never shifts the frame.
    const left=corner==='nw'||corner==='sw',top=corner==='nw'||corner==='ne'
    const x1=left?start.x+dx:start.x,x2=left?start.x+start.width:start.x+start.width+dx
    const y1=top?start.y+dy:start.y,y2=top?start.y+start.height:start.y+start.height+dy
    return {...b,x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.max(0.01,Math.abs(x2-x1)),height:Math.max(0.01,Math.abs(y2-y1))}
   }))
  }
  const stop=()=>{endDrag.current=null;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop)}
  endDrag.current=stop
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop)
 }
 const [textIds,setTextIds]=useState(found.textBoxes.map(t=>t.id))
 const [useBackground,setUseBackground]=useState(!!found.backgroundColor)
 const [selected,setSelected]=useState(0)
 const [pickedText,setPickedText]=useState<string|null>(null)
 const box=boxes[selected]
 const texts=found.textBoxes.filter(t=>textIds.includes(t.id))
 // A frame drawn at an angle is measured unrotated, so its upright box can poke past the artwork
 // while the frame itself sits inside it. Those are judged on their centre instead.
 const inside=(b:PlaceholderRect)=>b.rotationDeg
  ?b.x+b.width/2>=0&&b.y+b.height/2>=0&&b.x+b.width/2<=1&&b.y+b.height/2<=1
  :b.x>=-0.00001&&b.y>=-0.00001&&b.x+b.width<=1.00001&&b.y+b.height<=1.00001
 const valid=boxes.length>0&&boxes.every(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0&&inside(b))
 const rounded=boxes.filter(b=>b.cornerRadiusPx).length
 const turned=boxes.filter(b=>b.rotationDeg).length
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
    <div ref={stage} className="frame-review__canvas" style={{'--art-aspect':found.aspect,background:useBackground&&found.backgroundColor?found.backgroundColor:undefined} as CSSProperties}>
     <img src={found.preview} alt="Imported artwork"/>
     {texts.map(t=><span key={t.id} className={`frame-review__text${pickedText===t.id?' is-picked':''}`} style={{left:`${t.x*100}%`,top:`${t.y*100}%`,width:`${t.width*100}%`,height:`${t.height*100}%`}}/>)}
     {boxes.map((b,i)=><div key={b.id} role="button" tabIndex={0} aria-label={`Frame ${i+1}${b.rotationDeg?`, turned ${Math.round(b.rotationDeg)} degrees`:''}`} aria-pressed={i===selected}
      className={`frame-review__frame${i===selected?' is-selected':''}`} onPointerDown={e=>grab(e,i)}
      onKeyDown={e=>{const step=e.shiftKey?0.05:0.005;const by=(dx:number,dy:number)=>{e.preventDefault();setSelected(i);setBoxes(bs=>bs.map((v,j)=>j===i?{...v,x:v.x+dx,y:v.y+dy}:v))};
       if(e.key==='ArrowLeft')by(-step,0);else if(e.key==='ArrowRight')by(step,0);else if(e.key==='ArrowUp')by(0,-step);else if(e.key==='ArrowDown')by(0,step)}}
      style={{left:`${b.x*100}%`,top:`${b.y*100}%`,width:`${b.width*100}%`,height:`${b.height*100}%`,transform:b.rotationDeg?`rotate(${b.rotationDeg}deg)`:undefined,
       borderRadius:b.cornerRadiiPx?b.cornerRadiiPx.map(r=>`${r/900*100}%`).join(' '):b.cornerRadiusPx?`${b.cornerRadiusPx/900*100}%`:undefined}}>
      <span className="frame-review__badge">{i+1}</span>
      {i===selected&&(['nw','ne','se','sw'] as const).map(corner=><span key={corner} role="button" tabIndex={-1} aria-label={`Resize frame ${i+1} from its ${corner==="nw"?"top left":corner==="ne"?"top right":corner==="se"?"bottom right":"bottom left"} corner`}
       className={`frame-review__handle frame-review__handle--${corner}`} onPointerDown={e=>grab(e,i,corner)}/>)}
     </div>)}
    </div>
    {/* Which shelf of the library this lands on: the browser only ever offers a template to a
        spread holding this many photos, so it is the one number worth stating up front. */}
    <p className="frame-review__filed" role="status">Filed as a <strong>{boxes.length} photo {texts.length?'mixed':'image'} template</strong>{texts.length?` with ${texts.length} text layer${texts.length===1?'':'s'}`:''} — offered on spreads of {boxes.length} photo{boxes.length===1?'':'s'}.</p>
    <p className="frame-review__hint">Drag a frame to move it, or drag a corner to resize it. A flattened image cannot reveal overlapping or hidden elements.</p>
   </div>
   <aside className="frame-review__side">
    <section className="frame-review__group">
     <h3>Detected</h3>
     <ul className="frame-review__summary">
      <li><Icon name="image" size={13}/><span>{boxes.length} photo {boxes.length===1?'frame':'frames'}</span></li>
      <li><Icon name="type" size={13}/><span>{found.textBoxes.length} text {found.textBoxes.length===1?'layer':'layers'}</span></li>
      <li><Icon name="rectangle" size={13}/><span>{[rounded?`${rounded} rounded`:'Square corners',turned?`${turned} turned`:''].filter(Boolean).join(' · ')}</span></li>
      <li><Icon name="droplet" size={13}/><span>{found.backgroundColor?`Background ${found.backgroundColor}`:'No background layer'}</span></li>
     </ul>
     {found.dropped>0&&<p className="frame-review__note" role="status">This artwork had {found.dropped+boxes.length} shapes — the {boxes.length} largest were kept, since a template holds at most 100. Add any that are missing below.</p>}
     {!found.isPsd&&<p className="frame-review__note">Frames were traced from the flattened artwork. Import the layered PSD to carry text, rounded corners and the background across too.</p>}
    </section>
    <section className="frame-review__group">
     <h3>Layers</h3>
     {/* Topmost first, the way a layers panel reads: text over photo frames over the page colour. */}
     <ul className="frame-review__layers" aria-label="Layers">
      {found.textBoxes.map(t=><li key={t.id} className={pickedText===t.id?'is-selected':undefined}>
       <input type="checkbox" aria-label={`Keep text layer ${t.text.trim()||'Untitled text'}`} checked={textIds.includes(t.id)} onChange={e=>setTextIds(ids=>e.target.checked?[...ids,t.id]:ids.filter(id=>id!==t.id))}/>
       <button type="button" className="frame-review__layer" onClick={()=>setPickedText(pickedText===t.id?null:t.id)} title={t.text}>
        <span className="frame-review__swatch" style={{background:t.color}}/>
        <span className="frame-review__layer-name">{t.text.trim()||'Untitled text'}</span>
        <span className="frame-review__text-meta">{t.fontFamily} · {Math.round(t.fontSize)}px</span></button></li>)}
      {boxes.map((b,i)=><li key={b.id} className={i===selected&&!pickedText?'is-selected':undefined}>
       <span className="frame-review__layer-icon"><Icon name="image" size={12}/></span>
       <button type="button" className="frame-review__layer" onClick={()=>{setSelected(i);setPickedText(null)}}>
        <span className="frame-review__thumb" style={{backgroundImage:`url(${found.preview})`,backgroundSize:`${100/b.width}% ${100/b.height}%`,backgroundPosition:`${b.width>=1?0:b.x/(1-b.width)*100}% ${b.height>=1?0:b.y/(1-b.height)*100}%`}}/>
        <span className="frame-review__layer-name">Photo frame {i+1}</span>
        <span className="frame-review__text-meta">{Math.round(b.width*100)}×{Math.round(b.height*100)}%</span></button>
       <button type="button" className="btn btn--tiny" aria-label={`Remove frame ${i+1}`} title="Remove this frame" onClick={()=>{setBoxes(boxes.filter((_,j)=>j!==i));setSelected(Math.max(0,i<=selected?selected-1:selected))}}>×</button></li>)}
      {found.backgroundColor&&<li><input type="checkbox" aria-label="Use the page colour" checked={useBackground} onChange={e=>setUseBackground(e.target.checked)}/>
       <span className="frame-review__layer"><span className="frame-review__swatch" style={{background:found.backgroundColor}}/><span className="frame-review__layer-name">Background</span><span className="frame-review__text-meta">{found.backgroundColor}</span></span></li>}
     </ul>
    </section>
    <section className="frame-review__group">
     <h3>Selected frame</h3>
     {box?<>
      <div className="frame-review__fields">{(['x','y','width','height'] as const).map(key=><label key={key}>
       <span>{key} (%)</span>
       <input aria-label={`Frame ${key}`} type="number" min={0} max={100} step={.1} value={Math.round(box[key]*10000)/100}
        onChange={e=>setBoxes(bs=>bs.map((b,i)=>i===selected?{...b,[key]:Number(e.target.value)/100}:b))}/>
      </label>)}</div>
      <label className="frame-review__radius"><span>Corner radius (px)</span>
       <input aria-label="Frame corner radius" title={box.cornerRadiiPx?`Corners from the artwork: ${box.cornerRadiiPx.join(' / ')} — typing here rounds all four`:undefined} type="number" min={0} max={200} step={1} value={box.cornerRadiusPx??0}
        onChange={e=>setBoxes(bs=>bs.map((b,i)=>i===selected?{...b,cornerRadiusPx:Number(e.target.value)||undefined,cornerRadiiPx:undefined}:b))}/>
      </label>
      <label className="frame-review__radius"><span>Rotation (°)</span>
       <input aria-label="Frame rotation" title="Read from the artwork when the layer was drawn at an angle." type="number" min={-180} max={180} step={1} value={Math.round(box.rotationDeg??0)}
        onChange={e=>setBoxes(bs=>bs.map((b,i)=>i===selected?{...b,rotationDeg:Number(e.target.value)||undefined}:b))}/>
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
