import { useRef } from 'react'
import { PhotoAsset, Spread } from '@/types'
import { pagePlacements, TemplateScope } from '@/engine/pageTemplates'
import { useProjectStore } from '@/state/projectStore'

export type ExclusionFilter='excluded'|'locked'|'hidden'|'background'
export default function ExcludedTemplatePhotos({spread,photos,aspect,scope,filter,onClose}:{spread:Spread;photos:PhotoAsset[];aspect:number;scope:TemplateScope;filter:ExclusionFilter;onClose:()=>void}){
  const closeButton=useRef<HTMLButtonElement>(null)
  const lock=useProjectStore(s=>s.setLayerLocked),hide=useProjectStore(s=>s.setLayerHidden)
  const rows=pagePlacements(spread,aspect,scope,true).filter(p=>p.photoId&&(filter==='excluded'?(p.locked||p.hidden):filter==='locked'?p.locked:filter==='hidden'?p.hidden:false)).map(p=>{
    const photo=photos.find(photo=>photo.id===p.photoId)
    return {id:p.placeholderId,kind:'image' as 'image'|'background',name:photo?.fileName||`Photo ${p.photoId}`,src:photo?.src,locked:p.locked,hidden:p.hidden}
  })
  const bg=spread.backgroundPattern
  if(bg?.mode==='cover'&&(filter==='excluded'||filter==='background'))rows.push({id:'background',kind:'background',name:bg.name||'Background photo',src:bg.src,locked:spread.backgroundLocked,hidden:spread.backgroundHidden})
  return <section className="matching-templates__excluded" aria-label="Excluded photo details">
    <header><strong>{filter==='excluded'?'All excluded photos':filter==='background'?'Background photos':filter==='locked'?'Locked photos':'Hidden photos'} ({rows.length})</strong><button type="button" className="btn btn--tiny" ref={closeButton} autoFocus onClick={onClose}>Close</button></header>
    <div className="matching-templates__excluded-list">
      {!rows.length&&<p role="status">No photos in this category.</p>}
      {rows.map(row=><article key={row.kind+row.id} data-excluded-layer={row.kind+':'+row.id}>
        {row.src?<img src={row.src} alt=""/>:<span className="matching-templates__missing-thumb">No preview</span>}
        <div><strong title={row.name}>{row.name}</strong><small>{[row.kind==='background'?'Background':null,row.locked?'Locked':null,row.hidden?'Hidden':null].filter(Boolean).join(' · ')}</small>
          <div className="matching-templates__excluded-actions">{row.locked&&<button type="button" className="btn btn--tiny" aria-label={`Unlock ${row.name}`} onClick={()=>{lock(spread.id,row.kind,row.id,false);closeButton.current?.focus()}}>Unlock</button>}{row.hidden&&<button type="button" className="btn btn--tiny" aria-label={`Show ${row.name}`} onClick={()=>{hide(spread.id,row.kind,row.id,false);closeButton.current?.focus()}}>Show</button>}</div>
          {row.kind==='background'&&<small>Background photos stay excluded from templates.</small>}
        </div>
      </article>)}
    </div>
  </section>
}
