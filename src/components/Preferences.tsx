import { useEffect, useState } from 'react'
import { Preferences as Values, usePreferences } from '@/state/preferences'
import { applyTheme, getStoredTheme, Theme } from '@/engine/theme'
import Modal from './Modal'
const tabs=['General','Interaction','Inspector','Image Quality','Performance','Misc.']
export const metadataFields=['Color profile','Dimensions','Shutter speed','Aperture','ISO','Exposure compensation','Focal length','Date taken','Camera model','Lens model','Flash fired']
export default function Preferences({onClose}:{onClose:()=>void}) {
 const saved=usePreferences(s=>s.values),save=usePreferences(s=>s.save)
 const [draft,setDraft]=useState({...saved}),[tab,setTab]=useState('General'),[error,setError]=useState(''),[cache,setCache]=useState<number|null>(null),[theme,setTheme]=useState<Theme>(getStoredTheme)
 const set=<K extends keyof Values>(key:K,value:Values[K])=>setDraft(d=>({...d,[key]:value}))
 const run=(action:()=>Promise<unknown>)=>void action().catch(e=>setError(String(e.message??e)))
 useEffect(()=>{if(window.albumStudio?.preferencesSystem)run(async()=>setCache(Number(await window.albumStudio!.preferencesSystem('cacheSize'))))},[])
 const check=(key:keyof Values,label:string)=><label className="preferences-check"><input type="checkbox" checked={Boolean(draft[key])} onChange={e=>set(key,e.target.checked as never)}/>{label}</label>
 const choice=(key:keyof Values,label:string,options:[string,string][])=><fieldset><legend>{label}</legend>{options.map(([value,text])=><label key={value} className="preferences-check"><input type="radio" name={key} checked={draft[key]===value} onChange={()=>set(key,value as never)}/>{text}</label>)}</fieldset>
 return <Modal title="Preferences" width={860} className="preferences-dialog" onClose={onClose} headerContent={<div className="preferences-tabs" role="tablist">{tabs.map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>} footer={<><span role="alert">{error}</span><div className="footer-spacer"/><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn--primary" onClick={()=>run(async()=>{if(draft.projectDirectory&&window.albumStudio)await window.albumStudio.preferencesSystem('projectDirectory',draft.projectDirectory);save(draft);applyTheme(theme);onClose()})}>OK</button></>}>
 {tab==='General'&&<>
 <label className="field">Default project directory<div className="preferences-path"><input readOnly value={draft.projectDirectory} placeholder="System default"/><button className="btn" disabled={!window.albumStudio} onClick={()=>run(async()=>{const result=await window.albumStudio!.pickDirectory();if(result.dirPath)set('projectDirectory',result.dirPath)})}>Choose</button></div></label>
 <div className="preferences-path"><span>Cached images: {cache===null?'unavailable':`${(cache/1048576).toFixed(1)} MB`}</span><button className="btn" disabled={!window.albumStudio} onClick={()=>run(async()=>setCache(Number(await window.albumStudio!.preferencesSystem('clearCache'))))}>Clear cache</button></div>
 <div className="preferences-columns"><label className="field">Language<select disabled><option>English</option></select></label><label className="field">Theme<select value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="light">Light</option><option value="dark">Dark</option></select></label></div>
 {check('autoBins','Automatically create bins for imported folders')}{check('reuseImages','Allow images to be used more than once in the project')}{check('revealExport','Open destination directory after export')}
 <label className="preferences-check"><input type="checkbox" disabled/>Send crash reports <small>Not collected by YNOT</small></label>
 {check('classicHome','Use compact classic Home screen')}
 </>}
 {tab==='Interaction'&&<>{check('autoRearrange','Allow automatic image rearrangement to find matching templates')}<div className="preferences-columns"><div>
 {choice('scrollAxis','Spread and timeline mouse scrolling',[['auto','Autodetect horizontal scroll'],['vertical','Use vertical scroll wheel'],['horizontal','Use horizontal scroll wheel']])}
 <label className="field">Scroll speed · {draft.scrollSpeed}×<input type="range" min="0.25" max="3" step="0.25" value={draft.scrollSpeed} onChange={e=>set('scrollSpeed',+e.target.value)}/></label>
 {check('navigateNew','Switch to newly created spreads')}
 {choice('gridMode','Rule-of-thirds grid',[['auto','Show while moving or resizing (or use the grid toggle)'],['on','Always on'],['off','Always off']])}
 </div><div>{choice('altDrop','Alt key when dropping an image',[['add','Add image to spread'],['replace','Replace image under pointer']])}
 {choice('spreadBar','Display spread bar',[['spread','When pointer is over spread'],['bar','Only when pointer is over toolbar']])}
 {check('hints','Show application hints')}{check('showCover','Show Go to Cover button')}
 </div></div></>}
 {tab==='Inspector'&&<><p>Display these image metadata fields when available:</p><div className="preferences-metadata">{metadataFields.map(field=><label className="preferences-check" key={field}><input type="checkbox" checked={draft.metadata.includes(field)} onChange={e=>set('metadata',e.target.checked?[...draft.metadata,field]:draft.metadata.filter(f=>f!==field))}/>{field}</label>)}</div></>}
 {tab==='Image Quality'&&<><label className="field">Default JPEG output quality · {draft.jpegQuality}%<input type="range" min="1" max="100" value={draft.jpegQuality} onChange={e=>set('jpegQuality',+e.target.value)}/></label><label className="field">Export sharpening<select value={draft.sharpening} onChange={e=>set('sharpening',e.target.value)}>{['none','low','medium','high'].map(s=><option key={s}>{s}</option>)}</select></label><label className="field">Image resolution warning threshold · {draft.scalingThreshold}%<input type="range" min="100" max="300" value={draft.scalingThreshold} onChange={e=>set('scalingThreshold',+e.target.value)}/></label></>}
 {tab==='Performance'&&<><p>Turn these off to reduce preview work. Export resolution stays unchanged.</p>{check('animations','Enable interface and template change animations')}{check('highResolution','Use high-resolution spread previews')}</>}
 {tab==='Misc.'&&<><label className="field">Adobe Photoshop location<div className="preferences-path"><input readOnly value={draft.photoshopPath} placeholder="Detected automatically, or choose the Photoshop application"/><button className="btn" disabled={!window.albumStudio} onClick={()=>run(async()=>{const value=await window.albumStudio!.preferencesSystem('choosePhotoshop');if(typeof value==='string')set('photoshopPath',value)})}>Choose</button></div></label><p className="muted">Photoshop is detected automatically. Save the same file to sync edits while the album is open; spread saves return as a full-resolution composite. Canva uses its desktop application. To bring changes back, export a PNG from Canva and replace the prepared file. Cloud autosaves alone do not update YNOT.</p><label className="field">Canva Desktop location<div className="preferences-path"><input readOnly value={draft.canvaPath} placeholder="Detected automatically, or choose the Canva application"/><button className="btn" disabled={!window.albumStudio} onClick={()=>run(async()=>{const value=await window.albumStudio!.preferencesSystem('chooseCanva');if(typeof value==='string')set('canvaPath',value)})}>Choose Canva</button></div></label></>}
 </Modal>
}
