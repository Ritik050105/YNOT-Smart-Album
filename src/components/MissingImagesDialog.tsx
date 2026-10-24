import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importPhotoFiles } from '@/engine/importPhotos'
import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import Modal from './Modal'

export default function MissingImagesDialog() {
  const photos = useProjectStore(s => s.project.photos)
  const projectId = useProjectStore(s => s.project.id)
  const [missing, setMissing] = useState<string[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const target = useRef<string | null>(null)
  const previousMissing = useRef<string[]>([])
  useEffect(() => { setDismissed(false); setMissing([]) }, [projectId])
  useEffect(() => {
    let active = true, checking = false
    async function check() {
      if (checking) return
      checking = true
      try {
        const paths = photos.flatMap(p => p.sourcePath ? [p.sourcePath] : [])
        const absent = new Set(await window.albumStudio?.missingImagePaths?.(paths) ?? [])
        const broken: string[] = []
        let cursor = 0
        await Promise.all(Array.from({length:Math.min(4,photos.length)}, async () => {
          while (cursor < photos.length) {
            const p = photos[cursor++]
            if (p.sourcePath && absent.has(p.sourcePath)) { broken.push(p.id); continue }
            const valid = await new Promise<boolean>(resolve => { const img = new Image(); const timer = window.setTimeout(()=>resolve(false),10000); const done=(ok:boolean)=>{window.clearTimeout(timer);resolve(ok)}; img.onload=()=>done(true); img.onerror=()=>done(false); img.src=p.src })
            if (!valid) broken.push(p.id)
          }
        }))
        if (active) {
          if (broken.some(id => !previousMissing.current.includes(id))) setDismissed(false)
          previousMissing.current = broken
          setMissing(broken)
        }
      } catch (e) { if (active) setError(String(e)) }
      finally { checking = false }
    }
    void check()
    window.addEventListener('focus', check)
    const manual = (e: Event) => { const id=(e as CustomEvent<string>).detail; if(photos.some(p=>p.id===id)){setMissing(ids=>[...new Set([...ids,id])]);setDismissed(false)} }
    window.addEventListener('album-studio:relink-photo',manual)
    return () => {active=false;window.removeEventListener('focus',check);window.removeEventListener('album-studio:relink-photo',manual)}
  }, [photos, projectId])
  if (!missing.length || dismissed) return null
  return <Modal title="Locate missing images" onClose={()=>setDismissed(true)} width={560}>
    <p>These original files were moved or cannot be loaded. Locate one image to also reconnect other missing images found in the same folder. Layouts, edits and bins are preserved.</p>
    <div className="missing-image-list">{photos.filter(p=>missing.includes(p.id)).map(p=><div key={p.id}><span title={p.sourcePath ?? p.fileName}>{p.fileName}<small>{p.sourcePath ?? 'Image preview unavailable'}</small></span><button className="btn" disabled={busy} onClick={()=>{target.current=p.id;picker.current?.click()}}>Locate…</button></div>)}</div>
    <input ref={picker} hidden type="file" accept={IMAGE_FILE_ACCEPT} onChange={async e=>{
      const file=e.target.files?.[0],id=target.current; e.target.value=''
      if(!file||!id)return
      setBusy(true);setError('')
      try {
        const result=await importPhotoFiles([file]); const photo=result.assets[0]
        if(!photo)throw new Error(result.failures[0]?.reason ?? 'This image could not be loaded.')
        if(useProjectStore.getState().project.id!==projectId)return
        const replacements = [{id, photo}]
        if (photo.sourcePath && window.albumStudio?.readSiblingImage) {
          for (const candidate of photos.filter(p=>p.id!==id && missing.includes(p.id))) {
            // Duplicate names from different original folders need an explicit choice.
            if (photos.filter(p=>missing.includes(p.id) && p.fileName.toLowerCase()===candidate.fileName.toLowerCase()).length>1) continue
            const sibling = await window.albumStudio.readSiblingImage(photo.sourcePath,candidate.fileName)
            if (!sibling || sibling.sourcePath.toLowerCase()===photo.sourcePath.toLowerCase()) continue
            const imported = await importPhotoFiles([new File([new Uint8Array(sibling.data)],sibling.fileName,{lastModified:sibling.lastModified})])
            if (imported.assets[0]) replacements.push({id:candidate.id,photo:{...imported.assets[0],sourcePath:sibling.sourcePath}})
          }
        }
        if(useProjectStore.getState().project.id!==projectId)return
        for (const replacement of replacements) useProjectStore.getState().relinkPhoto(replacement.id,replacement.photo)
        setMissing(ids=>ids.filter(x=>!replacements.some(r=>r.id===x)))
      }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
    }}/>
    {busy&&<p role="status">Reconnecting images and checking the folder…</p>}
    {error&&<p role="alert">{error}</p>}
    <button className="btn" onClick={()=>setDismissed(true)}>Continue for now</button>
  </Modal>
}
