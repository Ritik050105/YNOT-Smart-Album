import {fontCombinations} from '@/engine/fontCombinations'
import {importTemplateArtwork} from '@/engine/importTemplateArtwork'
import {askTemplateCategory} from './ClassifyTemplate'
import {deleteQuote,saveQuote,useSavedQuotes,importQuotes,exportQuotes} from '@/engine/savedQuotes'
import {selectedKeys} from '@/engine/layerClipboard'
import {selectionGeometry} from '@/engine/spreadLayers'
import {useEffect,useState,useMemo,useRef} from 'react'
import {TextBox} from '@/types'
import {previewSource} from '@/engine/previewImage'
import {ensureFontLoaded} from '@/engine/fonts'
import {startFontTemplateDrag,endFontTemplateDrag} from '@/engine/fontTemplateDrag'
import {imgUrl} from '@/engine/imageUrl'
import {renderSpreadToCanvas} from '@/engine/renderSpread'
import {fitTextBoxSize} from '@/engine/textBoxSize'

import Modal from './Modal'
import ContextMenu from './ContextMenu'
import Icon from './Icon'
import {createPortal} from 'react-dom'
import {ReactNode} from 'react'
import quotes from '@/data/quoteGroups.json'
import {useProjectStore} from '@/state/projectStore'
function QuoteBrowser({children,onClose}:{children:ReactNode;onClose:()=>void}){
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose()}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[onClose])
 const host=document.getElementById('designer-font-template-browser')??document.getElementById('overview-font-template-browser')
 return host?createPortal(<section className="font-template-browser" aria-label="Font templates"><header><strong>Font templates</strong><button className="btn" onClick={onClose} aria-label="Close font templates">×</button></header>{children}</section>,host):<Modal title="Font templates" onClose={onClose} width={900}>{children}</Modal>
}
// fontCombinations()/quotes.json are static per aspect ratio, but every spread card on the
// timeline renders its own QuoteTemplates instance — without this cache each one was recomputing
// the whole font-combination + quote library from scratch, which was the normal window's lag.
const staticQuoteItemsCache=new Map<number,ReturnType<typeof buildStaticQuoteItems>>()
function buildStaticQuoteItems(aspect:number){
 return [...fontCombinations(aspect),...quotes.map(q=>({id:q.id,name:q.name,category:'Wedding',subcategory:'',title:true,content:true,boxes:groupedBoxes(q,aspect)}))]
}
function staticQuoteItems(aspect:number){
 let cached=staticQuoteItemsCache.get(aspect)
 if(!cached){cached=buildStaticQuoteItems(aspect);staticQuoteItemsCache.set(aspect,cached)}
 return cached
}
function groupedBoxes(q:typeof quotes[number],aspect:number):TextBox[]{
 const scale=Math.min(450/q.width,300/aspect/q.height),height=900/aspect,groupId=crypto.randomUUID()
 return q.layers.map(l=>({sourceArtwork:{fontRatio:l.fontSize/l.width,src:l.artwork,text:l.text,fontFamily:l.fontFamily,color:`rgb(${Math.round(l.color.r)},${Math.round(l.color.g)},${Math.round(l.color.b)})`,bold:l.bold,italic:l.italic},id:crypto.randomUUID(),groupId,text:l.text,fontFamily:l.fontFamily,fontSize:l.fontSize*scale,bold:l.bold,italic:l.italic,color:`rgb(${Math.round(l.color.r)},${Math.round(l.color.g)},${Math.round(l.color.b)})`,align:'left',autoWidth:false,x:(450-q.width*scale/2+l.x*scale)/900,y:(height/2-q.height*scale/2+l.y*scale)/height,width:l.width*scale/900,height:l.height*scale/height}))
}
/** Waits briefly for a template's fonts; false means some are still loading (the preview is then redrawn when they arrive). */
const warmFonts=async(boxes:TextBox[])=>{let ready=true;await Promise.race([Promise.all([...new Set(boxes.map(b=>b.fontFamily))].map(f=>ensureFontLoaded(f))).catch(()=>{ready=false}),new Promise<void>(r=>setTimeout(()=>{ready=false;r()},2500))]);return ready}
const hashText=(s:string)=>{let a=0x811c9dc5,b=0x1234567;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b+c,2654435761)^(b>>>13)}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')}
/** Template previews without photos depend only on the text boxes and spread size, so they are cached on disk by that hash and survive project edits and restarts. */
function QuotePreview({boxes,spreadId,withImages}:{boxes:TextBox[];spreadId:string;withImages:boolean}){
 const project=useProjectStore(s=>withImages?s.project:null),size=useProjectStore(s=>(s.project.spreads.find(p=>p.id===spreadId)?.size??s.project.size))
 const [src,setSrc]=useState(''),[visible,setVisible]=useState(false),[fontTick,setFontTick]=useState(0),host=useRef<HTMLSpanElement>(null)
 useEffect(()=>{const families=new Set(boxes.map(b=>b.fontFamily)),onFont=(e:Event)=>{if(families.has((e as CustomEvent<{family:string}>).detail?.family))setFontTick(t=>t+1)};window.addEventListener('album-studio:font-loaded',onFont);return()=>window.removeEventListener('album-studio:font-loaded',onFont)},[boxes])
 const key=useMemo(()=>hashText(JSON.stringify([boxes.map(({id,groupId,...rest})=>rest),size.widthIn,size.heightIn])),[boxes,size.widthIn,size.heightIn])
 const stored=!withImages&&!!window.albumStudio?.putTextPreview,[missed,setMissed]=useState(false)
 useEffect(()=>setMissed(false),[key])
 useEffect(()=>{const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:'160px'});if(host.current)observer.observe(host.current);return()=>observer.disconnect()},[])
 useEffect(()=>{if(!visible||(stored&&!missed))return;let live=true;const current=useProjectStore.getState().project,spread=current.spreads.find(s=>s.id===spreadId);if(!spread)return;const size=spread.size??current.size;let fontsReady=true;void Promise.all((project?.photos??[]).filter(p=>withImages&&spread.placements.some(l=>l.photoId===p.id)).map(async p=>[p.id,{...p,src:await previewSource(p.src,512)}] as const)).then(async photos=>{fontsReady=await warmFonts(boxes);return renderSpreadToCanvas(withImages?{...spread,backgroundColor:'#ffffff',textBoxes:boxes.map(b=>({...b,previewOnly:true}))}:{...spread,backgroundHidden:false,coverDetails:undefined,placements:[],backgroundPattern:undefined,backgroundColor:'#ffffff',textBoxes:boxes.map(b=>({...b,previewOnly:true}))},new Map(photos),size,220/size.widthIn)}).then(async c=>{if(!live)return;if(stored&&fontsReady){const blob=await new Promise<Blob|null>(r=>c.toBlob(r,'image/png'));if(blob)await window.albumStudio!.putTextPreview(key,new Uint8Array(await blob.arrayBuffer()))}if(live)setSrc(c.toDataURL())}).catch(()=>{if(live)setSrc('')});return()=>{live=false}},[project,spreadId,boxes,withImages,visible,stored,missed,key,fontTick])
 const shown=stored&&visible&&!missed?imgUrl('x',key):src
 return <span ref={host} style={{display:"block",minHeight:100}}>{shown?<img src={shown} alt="Quote composition on the current spread" draggable={false} onError={()=>{if(stored)setMissed(true)}}/>:<span>Preparing preview…</span>}</span>
}
const events=['Wedding','Engagement','Reception','Destination Wedding','Concert','Maternity','Puberty','Other']
/** `buttonsOnly` renders the two buttons and nothing else. The pair in the image-template panel's
 *  header has to work that way: opening the font browser closes that panel, so this instance is
 *  gone a moment later and the browser has to be rendered by one that stays — the spread card's. */
export default function QuoteTemplates({spreadId,compact=false,saveHost,buttonsOnly=false}:{spreadId:string;compact?:boolean;saveHost?:string;buttonsOnly?:boolean}){
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[])
 const saved=useSavedQuotes(),project=useProjectStore(s=>s.project),selectedSpreadId=useProjectStore(s=>s.selectedSpreadId),matchingOpen=useProjectStore(s=>s.matchingTemplatesOpen)
 const spread=project.spreads.find(p=>p.id===spreadId),size=spread?.size??project.size
 const [localTemplates,setLocalTemplates]=useState(true),[inspiredTemplates,setInspiredTemplates]=useState(true)
 const [withImages,setWithImages]=useState(false),[menu,setMenu]=useState<{x:number;y:number;id:string}|null>(null)
 const open=useProjectStore(s=>s.fontBrowserSpreadId)===spreadId
 const setOpen=(next:boolean)=>useProjectStore.setState({fontBrowserSpreadId:next?spreadId:null})
 const [saving,setSaving]=useState(false),[search,setSearch]=useState(''),[active,setActive]=useState<string|null>(null),[notice,setNotice]=useState('')
 const [subcategory,setSubcategory]=useState(''),[subfilter,setSubfilter]=useState('')
 const [category,setCategory]=useState('Wedding'),[custom,setCustom]=useState(''),[title,setTitle]=useState(true),[content,setContent]=useState(true)
 const [filter,setFilter]=useState(false),[event,setEvent]=useState('All events'),[titles,setTitles]=useState(true),[contents,setContents]=useState(true)
 const items=useMemo(()=>[...staticQuoteItems(size.widthIn/size.heightIn),...saved.map(q=>({...q,name:q.boxes.map(b=>b.text).join(' · '),title:q.title??true,content:q.content??true,boxes:q.boxes.map(b=>({...b,id:crypto.randomUUID(),locked:false,hidden:false,groupId:q.id}))}))],[saved,size.widthIn,size.heightIn])
 const visible=items.filter(q=>(q.id.startsWith('ynot-combination-')?inspiredTemplates:localTemplates)&&(q.name.toLowerCase().includes(search.toLowerCase()))&&(!filter||((event==='All events'||q.category===event)&&(!subfilter||q.subcategory===subfilter)&&((titles&&q.title)||(contents&&q.content)))))
 // Hovering previews, exactly as the image-template strip does. Clicking places the composition on
 // the spread for real and clicking again takes it off, so several can be stacked at once — which
 // is the only way to build a layered title out of two templates.
 const [hovered,setHovered]=useState<string|null>(null)
 // Which templates are on this spread is read off the spread itself, through a group id derived
 // from the template. Keeping a separate list meant a template deleted from the canvas — or an
 // undo — left its card still showing as placed.
 const groupFor=(quoteId:string)=>'quote:'+quoteId
 const isPlaced=(quoteId:string)=>!!spread?.textBoxes.some(b=>b.groupId===groupFor(quoteId))
 const chosen=isPlaced(hovered??'')?undefined:visible.find(q=>q.id===hovered)
 const place=(quote:typeof visible[number])=>{
  const state=useProjectStore.getState(),current=state.project.spreads.find(p=>p.id===spreadId)
  if(!current)return
  const size=current.size??state.project.size
  const groupId=groupFor(quote.id)
  if(current.textBoxes.some(b=>b.groupId===groupId)){
   state.updateSpread(spreadId,{textBoxes:current.textBoxes.filter(b=>b.groupId!==groupId)})
   // The boxes are gone, so anything still pointing at them is a selection of nothing.
   state.setLayerSelection([])
   state.selectTextBox(null)
   setActive(null)
   return
  }
  // Each box is re-fitted to its own text: the stored width and height come from the design the
  // template was drawn at, and left alone they leave the box floating around the words.
  const boxes=quote.boxes.map(b=>fitTextBoxSize({...b,id:crypto.randomUUID(),groupId},size))
  state.updateSpread(spreadId,{textBoxes:[...current.textBoxes,...boxes]})
  state.setLayerSelection(boxes.map(b=>'text:'+b.id))
  setActive(quote.id)
 }
 useEffect(()=>{if(compact&&selectedSpreadId!==spreadId)setOpen(false)},[compact,selectedSpreadId,spreadId])
 useEffect(()=>{if(matchingOpen)setOpen(false)},[matchingOpen])
 useEffect(()=>{if(buttonsOnly)return;if(open&&chosen&&spread)useProjectStore.setState({templatePreview:{...spread,textBoxes:[...spread.textBoxes,...chosen.boxes]}});else if(open)useProjectStore.setState({templatePreview:null});return()=>{if(useProjectStore.getState().templatePreview?.id===spreadId)useProjectStore.setState({templatePreview:null})}},[open,chosen,spread,spreadId,buttonsOnly])
 // Previous / Next replace the template on the spread with its neighbour in the list, as one undo step.
 // They used to move a highlight that nothing read, so pressing them appeared to do nothing.
 const step=(direction:number)=>{
  if(!visible.length)return
  const placed=visible.find(q=>q.id===active&&isPlaced(q.id))??visible.find(q=>isPlaced(q.id))
  const from=placed?visible.indexOf(placed):-1
  const next=visible[from<0?(direction>0?0:visible.length-1):(from+direction+visible.length)%visible.length]
  const state=useProjectStore.getState(),current=state.project.spreads.find(p=>p.id===spreadId)
  if(!current)return
  const fitted=state.project.spreads.find(p=>p.id===spreadId)?.size??state.project.size
  const groupId=groupFor(next.id)
  const kept=current.textBoxes.filter(b=>!(placed&&b.groupId===groupFor(placed.id))&&b.groupId!==groupId)
  const boxes=next.boxes.map(b=>fitTextBoxSize({...b,id:crypto.randomUUID(),groupId},fitted))
  state.updateSpread(spreadId,{textBoxes:[...kept,...boxes]})
  state.setLayerSelection(boxes.map(b=>'text:'+b.id))
  setActive(next.id);setHovered(null)
  requestAnimationFrame(()=>document.querySelector('.font-template-browser .quote-template-card[aria-pressed="true"]')?.scrollIntoView({inline:'nearest',block:'nearest'}))
 }
 const openBrowser=(direction?:number)=>{const state=useProjectStore.getState();if(state.selectedSpreadId!==spreadId)state.selectSpread(spreadId);state.closeMatchingTemplates();setOpen(true);if(direction)step(direction)}
 const save=()=>{try{const state=useProjectStore.getState(),spread=state.project.spreads.find(p=>p.id===spreadId);const members=spread?selectionGeometry(spread,selectedKeys(),state.project.size)?.members:[];saveQuote(category==='Custom…'?custom:category,(members??[]).flatMap(m=>m.kind==='text'&&!m.value.shape?[m.value]:[]),{title,content,subcategory:subcategory.trim()||undefined});setSaving(false);setNotice('Font template saved.')}catch(error){setNotice(String(error))}}
 return <>{compact?<div className="spread-card-controls__quotes" role="group" aria-label="Text templates"><button aria-label="Previous text template preview" onClick={()=>openBrowser(-1)}><Icon name="chevronLeft" size={12}/></button><button aria-label="Browse text templates" onClick={()=>openBrowser()}><Icon name="text" size={14}/></button><button aria-label="Next text template preview" onClick={()=>openBrowser(1)}><Icon name="chevronRight" size={12}/></button></div>:<><button className="btn" aria-pressed={open} onClick={()=>open?setOpen(false):openBrowser()}>Browse Font Templates</button>{mounted&&saveHost&&document.getElementById(saveHost)?createPortal(<button className="btn" onClick={()=>{setNotice('');setSaving(true)}}>Save Font Templates</button>,document.getElementById(saveHost)!):<button className="btn" onClick={()=>{setNotice('');setSaving(true)}}>Save Font Templates</button>}</>}
 {open&&!buttonsOnly&&<QuoteBrowser onClose={()=>setOpen(false)}><div className="quote-browser-tools"><label><input type="checkbox" checked={inspiredTemplates} onChange={e=>setInspiredTemplates(e.target.checked)}/> Canva templates</label><label><input type="checkbox" checked={localTemplates} onChange={e=>setLocalTemplates(e.target.checked)}/> Local font templates</label><input aria-label="Search quote compositions" placeholder="Search quotes…" value={search} onChange={e=>setSearch(e.target.value)}/><label><input type="checkbox" checked={filter} onChange={e=>setFilter(e.target.checked)}/> Filter by classification</label>{filter&&<><select aria-label="Filter quote event" value={event} onChange={e=>{setEvent(e.target.value);setSubfilter('')}}>{['All events',...new Set([...events,'Font combinations',...saved.map(q=>q.category)])].map(e=><option key={e}>{e}</option>)}</select><select aria-label="Filter font subcategory" value={subfilter} onChange={e=>setSubfilter(e.target.value)}><option value="">All subcategories</option>{[...new Set(items.filter(q=>event==='All events'||q.category===event).map(q=>q.subcategory).filter(Boolean))].map(v=><option key={v}>{v}</option>)}</select><label><input type="checkbox" checked={titles} onChange={e=>setTitles(e.target.checked)}/> Title</label><label><input type="checkbox" checked={contents} onChange={e=>setContents(e.target.checked)}/> Content</label></>}<button className="btn" onClick={()=>{setNotice('');setSaving(true)}}>Save font template</button><button className="btn" onClick={exportQuotes} disabled={!saved.length}>Export quote templates</button><label className="btn">Import quote templates<input type="file" accept=".json,image/*,.psd,.tif,.tiff" onChange={async e=>{const f=e.target.files?.[0];try{if(f){if(/\.json$/i.test(f.name))importQuotes(await f.text());else{const boxes=await importTemplateArtwork(f),category=await askTemplateCategory();if(category)saveQuote(category,boxes)}}}catch(error){setNotice(String(error))}e.target.value=''}}/></label><label><input type="checkbox" checked={withImages} onChange={e=>setWithImages(e.target.checked)}/> Preview with spread images</label></div><p className="muted">Canva templates: original YNOT-created, Canva-inspired combinations. This is not Canva’s official or complete catalog. Click a composition to preview it on the spread. Apply keeps it; closing cancels the preview.</p>{notice&&<p role="status">{notice}</p>}<div className="quote-template-grid">{visible.map(q=><button className="btn quote-template-card" draggable title="Click to preview, or drag onto a spread" onDragStart={e=>startFontTemplateDrag(e.dataTransfer,q.boxes)} onDragEnd={endFontTemplateDrag} aria-pressed={isPlaced(q.id)} key={q.id} onKeyDown={e=>{e.stopPropagation();if((e.key==='Delete'||e.key==='Backspace')&&saved.some(t=>t.id===q.id)){e.preventDefault();deleteQuote(q.id)}}} onContextMenu={e=>{if(saved.some(t=>t.id===q.id)){e.preventDefault();e.stopPropagation();setMenu({x:e.clientX,y:e.clientY,id:q.id})}}} onMouseEnter={()=>setHovered(q.id)} onMouseLeave={()=>setHovered(h=>h===q.id?null:h)} onFocus={()=>setHovered(q.id)} onBlur={()=>setHovered(h=>h===q.id?null:h)} onMouseDown={e=>e.preventDefault()} onClick={()=>place(q)}><QuotePreview spreadId={spreadId} boxes={q.boxes} withImages={withImages}/><span>{q.name}</span></button>)}</div>{!visible.length&&<p>No font templates match these filters.</p>}<button className="btn btn-primary" onClick={()=>setOpen(false)}>Done</button></QuoteBrowser>}
 {menu&&<ContextMenu x={menu.x} y={menu.y} onClose={()=>setMenu(null)} items={[{label:'Delete font template',danger:true,onClick:()=>{deleteQuote(menu.id);setMenu(null)}}]}/>}
 {saving&&<Modal className="save-template-dialog" width={420} title="Save font template" onClose={()=>setSaving(false)} footer={<><button className="btn" onClick={()=>setSaving(false)}>Cancel</button><div className="footer-spacer"/><button className="btn btn--primary" disabled={!title&&!content} onClick={save}>Save font template</button></>}><p className="muted">The selected text layers are saved together as one composition.</p><label className="field">Event<select value={category} onChange={e=>setCategory(e.target.value)}>{[...new Set([...events,...saved.map(q=>q.category)]),'Custom…'].map(e=><option key={e}>{e}</option>)}</select></label>{category==='Custom…'&&<label className="field">Custom event<input autoFocus aria-label="Custom event" value={custom} onChange={e=>setCustom(e.target.value)}/></label>}<label className="field"><span>Subcategory <span className="save-template-dialog__hint">optional</span></span><input list="quote-subcategories" maxLength={100} value={subcategory} onChange={e=>setSubcategory(e.target.value)}/><datalist id="quote-subcategories">{[...new Set(saved.filter(q=>q.category===category).map(q=>q.subcategory).filter(Boolean))].map(v=><option key={v} value={v}/>)}</datalist></label><div className="field save-template-dialog__kinds"><span>Save it as</span><div><label><input type="checkbox" checked={title} onChange={e=>setTitle(e.target.checked)}/>Title</label><label><input type="checkbox" checked={content} onChange={e=>setContent(e.target.checked)}/>Content</label></div>{!title&&!content&&<small>Pick at least one.</small>}</div>{notice&&<p className="save-template-dialog__notice" role="status">{notice}</p>}</Modal>}</>
}
