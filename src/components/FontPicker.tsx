import { useEffect, useRef, useState } from 'react'
import { LOCAL_FONTS, CLOUD_FONTS, getLocalFonts, ensureFontLoaded, loadUploadedFont } from '@/engine/fonts'
import { useProjectStore } from '@/state/projectStore'
import Modal from './Modal'

export default function FontPicker({value,onChange}:{value:string;onChange:(family:string)=>void}) {
  const [fonts,setFonts]=useState(LOCAL_FONTS),[open,setOpen]=useState(false),[search,setSearch]=useState(''),[error,setError]=useState('')
  const custom=useProjectStore(s=>s.project.customFonts)
  const input=useRef<HTMLInputElement>(null)
  useEffect(()=>{void getLocalFonts().then(setFonts)},[])
  useEffect(()=>{if(open) for(const font of CLOUD_FONTS) void ensureFontLoaded(font.family).catch(()=>{})},[open])
  const options=[...new Set([...fonts,...CLOUD_FONTS,...custom??[]].map(f=>f.family))].sort()
  return <div className="font-picker">
    <button className="btn font-picker__current" onClick={()=>setOpen(true)} style={{fontFamily:value}}> {value || 'Choose a font'} <span>⌄</span></button>
    <button className="btn" onClick={()=>input.current?.click()}>Upload a font…</button>
    <input ref={input} hidden type="file" accept=".ttf,.otf,.woff,.woff2" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return
      const projectId=useProjectStore.getState().project.id
      setError('')
      try {
        if(!/\.(ttf|otf|woff2?)$/i.test(file.name)||file.size>10*1024*1024)throw new Error('Choose a TTF, OTF, WOFF or WOFF2 font under 10 MB.')
        const family=file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').trim();if(!family)throw new Error('Give the font a readable filename.')
        const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Could not read font'));r.readAsDataURL(file)})
        await loadUploadedFont(family,dataUrl)
        const s=useProjectStore.getState();if(s.project.id!==projectId)return
        s.updateProjectSettings({customFonts:[...(s.project.customFonts??[]).filter(f=>f.family!==family),{family,dataUrl}]});onChange(family)
      }catch(e){setError(e instanceof Error?e.message:String(e))}
    }}/>
    {error&&<p role="alert">{error}</p>}
    {open&&<Modal title="Choose a typeface" onClose={()=>setOpen(false)} width={440}>
      <input aria-label="Search fonts" placeholder="Search fonts…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
      <div className="font-picker__list">{options.filter(f=>f.toLowerCase().includes(search.toLowerCase())).map(f=><button key={f} className={f===value?'is-selected':''} style={{fontFamily:f}} onMouseEnter={()=>void ensureFontLoaded(f)} onClick={()=>{void ensureFontLoaded(f);onChange(f);setOpen(false)}}>{f}<small>{custom?.some(x=>x.family===f)?'Uploaded':CLOUD_FONTS.some(x=>x.family===f)?'Cloud':'Installed'}</small></button>)}</div>
    </Modal>}
  </div>
}
