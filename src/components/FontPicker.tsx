import { useEffect, useMemo, useRef, useState } from 'react'
import { isBundledFont, LOCAL_FONTS, CLOUD_FONTS, getLocalFonts, ensureFontLoaded, loadUploadedFont, registerDiscoveredFonts, discoveredFontData } from '@/engine/fonts'
import { useProjectStore } from '@/state/projectStore'

/** The styles a family is offered in. Every family can be set in all four — the renderer and the
 *  canvas synthesise bold and italic where the font has no real face for them — so this mirrors
 *  the type panel in Illustrator or Photoshop rather than claiming to list installed faces. */
export const FONT_STYLES = [
  { label: 'Regular', bold: false, italic: false },
  { label: 'Italic', bold: false, italic: true },
  { label: 'Bold', bold: true, italic: false },
  { label: 'Bold Italic', bold: true, italic: true },
] as const

export type FontStyleChoice = { bold: boolean; italic: boolean }

/** " Bold Italic" etc., or nothing at all for Regular — the family name alone reads better. */
const styleLabel = (bold: boolean, italic: boolean) =>
  bold || italic ? ' ' + FONT_STYLES.find(s => s.bold === bold && s.italic === italic)!.label : ''

const FONT_LIST_LIMIT=150
export default function FontPicker({value,onChange,scanEnabled=true,bold=false,italic=false}:{value:string;onChange:(family:string,style?:FontStyleChoice)=>void;scanEnabled?:boolean;bold?:boolean;italic?:boolean}) {
  // Which family's styles are expanded in the list; one at a time, like the Adobe panel.
  const [expanded,setExpanded]=useState<string|null>(null)
  const [fonts,setFonts]=useState(LOCAL_FONTS),[open,setOpen]=useState(false),[search,setSearch]=useState(''),[error,setError]=useState('')
  const [scan,setScan]=useState<{running:boolean;visited:number;skipped:number;count?:number;fonts:{family:string;path:string}[]}|null>(null)
  const refreshScan=async(action:'start'|'cancel'|'status')=>{
    try{const result=await window.albumStudio?.scanFonts(action);if(result){
      // A running scan reports only its count: the fonts already known stay registered until it has finished and sends the whole list.
      if(!result.running||result.fonts.length)registerDiscoveredFonts(result.fonts)
      setScan(prev=>result.running&&!result.fonts.length?{...result,fonts:prev?.fonts??[]}:result)}}catch(e){setError(String(e))}
  }
  useEffect(()=>{if(scanEnabled)void refreshScan('status')},[scanEnabled])
  useEffect(()=>{if(!scanEnabled||!scan?.running)return;const timer=setInterval(()=>void refreshScan('status'),1000);return()=>clearInterval(timer)},[scanEnabled,scan?.running])
  const choose=async(family:string,style?:FontStyleChoice)=>{
    try{
      const dataUrl=await discoveredFontData(family)
      if(dataUrl){await loadUploadedFont(family,dataUrl);const state=useProjectStore.getState(),merged=new Map((state.project.customFonts??[]).map(f=>[f.family,f]));merged.set(family,{family,dataUrl});state.updateProjectSettings({customFonts:[...merged.values()]})}
      else await ensureFontLoaded(family)
      onChange(family,style)
    }catch(e){setError(String(e))}
  }
  const custom=useProjectStore(s=>s.project.customFonts)
  const textBoxId=useProjectStore(s=>s.selectedTextBoxId)
  const pointer=useRef<{x:number;y:number}|null>(null)
  const previewFont=(family:string)=>{
    if(textBoxId)useProjectStore.setState({fontPreview:{textBoxId,family}})
    void ensureFontLoaded(family).catch(()=>{})
  }
  useEffect(()=>()=>{useProjectStore.setState({fontPreview:null})},[open,textBoxId])
  const input=useRef<HTMLInputElement>(null)
  const picker=useRef<HTMLDivElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  useEffect(()=>{
    if(!open)return
    const dismiss=(e:PointerEvent)=>{if(!picker.current?.contains(e.target as Node))setOpen(false)}
    document.addEventListener('pointerdown',dismiss)
    return()=>document.removeEventListener('pointerdown',dismiss)
  },[open])
  useEffect(()=>{void getLocalFonts().then(setFonts)},[])
  // Warm the list's fonts four at a time and stop when it closes; firing ~1900 loads at once froze the renderer.
  useEffect(()=>{if(!open)return;let live=true;const queue=[...CLOUD_FONTS];const worker=async()=>{while(live&&queue.length)await ensureFontLoaded(queue.shift()!.family).catch(()=>{})};for(let i=0;i<4;i++)void worker();return()=>{live=false}},[open])
  const folder=useRef<HTMLInputElement>(null)
  const upload=async(files:File[])=>{
      if(!files.length)return
      const projectId=useProjectStore.getState().project.id
      setError('')
      const imported:{family:string;dataUrl:string}[]=[], failures:string[]=[]
      for(const file of files)try {
        if(!/\.(ttf|otf|woff2?)$/i.test(file.name)||file.size>10*1024*1024)throw new Error('Choose a TTF, OTF, WOFF or WOFF2 font under 10 MB.')
        const family=file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').trim();if(!family)throw new Error('Give the font a readable filename.')
        const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Could not read font'));r.readAsDataURL(file)})
        await loadUploadedFont(family,dataUrl)
        imported.push({family,dataUrl})
      }catch(e){failures.push(`${file.name}: ${e instanceof Error?e.message:String(e)}`)}
      const state=useProjectStore.getState();if(state.project.id!==projectId)return
      if(imported.length){const merged=new Map((state.project.customFonts??[]).map(f=>[f.family,f]));for(const font of imported)merged.set(font.family,font);state.updateProjectSettings({customFonts:[...merged.values()]});onChange(imported[0].family)}
      setError(failures.join(' · '))

  }
  // Installed fonts, the families the bundled templates use, anything this project embeds — plus
  // whatever is already selected, so an album that predates this list never shows a blank picker.
  const options=useMemo(()=>[...new Set([...fonts,...CLOUD_FONTS,...(custom??[]),...(scan?.fonts??[])].map(f=>f.family).concat(value?[value]:[]))].sort(),[fonts,custom,scan?.fonts,value])
  // Every font in the list is drawn in its own face, and a scanned computer can have thousands: only the first few hundred matches are drawn (search narrows the rest).
  const matching=open?options.filter(f=>f.toLowerCase().includes(search.toLowerCase())):[]
  return <div className="font-picker" ref={picker} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{
    e.stopPropagation()
    if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus()}
    if(open&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
      e.preventDefault()
      const buttons=Array.from(picker.current?.querySelectorAll<HTMLButtonElement>('.font-picker__list button')??[])
      const index=buttons.indexOf(document.activeElement as HTMLButtonElement)
      buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()
    }
  }}>
    <div className="font-picker__anchor">
    <button ref={trigger} aria-expanded={open} aria-label="Choose a font" className="btn font-picker__current" onClick={()=>{setSearch('');setOpen(!open)}} style={{fontFamily:value,fontWeight:bold?700:400,fontStyle:italic?'italic':'normal'}}> {value ? `${value}${styleLabel(bold,italic)}` : 'Choose a font'} <span>⌄</span></button>
    {open&&<div className="font-picker__dropdown">
      <input aria-label="Search fonts" placeholder="Search fonts…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
      <div className="font-picker__list" onPointerMove={e=>{pointer.current={x:e.clientX,y:e.clientY}}} onMouseLeave={()=>{pointer.current=null;useProjectStore.setState({fontPreview:null})}} onScroll={()=>{
        const point=pointer.current
        const button=point&&document.elementFromPoint(point.x,point.y)?.closest<HTMLButtonElement>('button[data-font]')
        if(button?.dataset.font)previewFont(button.dataset.font)
      }}>{matching.slice(0,FONT_LIST_LIMIT).flatMap(f=>[
        // Picking a family both applies it and opens its styles underneath, the way the Adobe type
        // panel does. A nested expander button inside this one only ever stole the click.
        <button key={f} data-font={f} className={f===value?'is-selected':''} style={{fontFamily:f}} onMouseEnter={()=>previewFont(f)} onFocus={()=>previewFont(f)}
          aria-expanded={expanded===f} onClick={()=>{setExpanded(expanded===f?null:f);void choose(f,{bold,italic})}}>
          <span className="font-picker__expand" aria-hidden="true">{expanded===f?'⌄':'›'}</span>
          <span className="font-picker__name">{f}</span>
          <small>{custom?.some(x=>x.family===f)?'Local · uploaded':CLOUD_FONTS.some(x=>x.family===f)?(isBundledFont(f)?'Google Fonts · offline':'Google Fonts · download on use'):'Local'}</small>
        </button>,
        ...(expanded===f?FONT_STYLES.map(style=>
          <button key={f+':'+style.label} data-font={f} className={`font-picker__style ${f===value&&bold===style.bold&&italic===style.italic?'is-selected':''}`}
            style={{fontFamily:f,fontWeight:style.bold?700:400,fontStyle:style.italic?'italic':'normal'}}
            onMouseEnter={()=>previewFont(f)} onFocus={()=>previewFont(f)}
            onClick={()=>void choose(f,{bold:style.bold,italic:style.italic})}>{style.label}<small>Sample</small></button>):[]),
      ]).concat(matching.length>FONT_LIST_LIMIT?[<p key="more" className="muted" style={{padding:'6px 10px'}}>Showing the first {FONT_LIST_LIMIT} of {matching.length} fonts. Type in the search box to narrow them down.</p>]:[])}</div>
    </div>}
    </div>
    <button className="btn" onClick={()=>void getLocalFonts(true).then(setFonts)}>Refresh local fonts</button><button className="btn" onClick={()=>input.current?.click()}>Upload fonts…</button>
    <input ref={input} hidden type="file" multiple accept=".ttf,.otf,.woff,.woff2" onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';void upload(files)}}/>
    <button className="btn" onClick={()=>folder.current?.click()}>Import font folder…</button>
    <input hidden ref={folder} type="file" multiple {...{webkitdirectory:''}} onChange={e=>{const files=Array.from(e.target.files??[]).filter(f=>/\.(ttf|otf|woff2?)$/i.test(f.name));e.target.value='';if(!files.length)setError('No supported font files found in this folder.');else void upload(files)}}/>
    {scanEnabled&&window.albumStudio?.scanFonts&&<div className="font-scan"><button className="btn" onClick={()=>void refreshScan(scan?.running?'cancel':'start')}>{scan?.running?'Stop font scan':'Scan PC & connected drives'}</button>{scan&&<p role="status">{scan.running?'Scanning… ':'Scan idle · '}{scan.count??scan.fonts.length} font files · {scan.visited} folders checked{scan.skipped?` · ${scan.skipped} inaccessible folders`:''}. Selected fonts are embedded in this project.</p>}</div>}
    {error&&<p role="alert">{error}</p>}

  </div>
}
