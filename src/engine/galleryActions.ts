import { useProjectStore } from '@/state/projectStore'
import { importPhotoFiles } from './importPhotos'
import { IMAGE_FILE_ACCEPT } from './imageSource'
import { defaultPlacement } from './autoLayout'
import { copyGalleryPhotos } from './layerClipboard'
import { openInEditor } from '@/components/ExternalEditor'
import type { ContextMenuItem } from '@/components/ContextMenu'

export function galleryActions(ids:string[], remove:(ids:string[])=>void):ContextMenuItem[] {
  const state=useProjectStore.getState(),photos=state.project.photos.filter(p=>ids.includes(p.id)),photo=photos[0]
  if(!photo)return []
  const single=photos.length===1,spread=state.project.spreads.find(s=>s.id===state.selectedSpreadId)
  const locked=photos.some(p=>state.project.spreads.some(s=>s.placements.some(pl=>pl.photoId===p.id&&pl.locked)||(s.backgroundPattern?.edits?.photoId===p.id&&s.backgroundLocked)))
  const run=(action:()=>Promise<unknown>)=>{void action().catch(e=>window.alert(e instanceof Error?e.message:String(e)))}
  const replace=async(file:File,sourcePath?:string)=>{
    const result=await importPhotoFiles([file]);if(!result.assets[0])throw new Error(result.failures[0]?.reason??'Could not import image')
    if(useProjectStore.getState().project.id!==state.project.id)return
    state.relinkPhoto(photo.id,{...result.assets[0],sourcePath:sourcePath??result.assets[0].sourcePath})
  }
  return [
    {label:'Copy',shortcut:'Ctrl+C',onClick:()=>copyGalleryPhotos(ids)},
    {label:'Copy Filename(s)',onClick:()=>run(()=>navigator.clipboard.writeText(photos.map(p=>p.fileName).join('\n')))},
    {label:'Delete',shortcut:'Delete',danger:true,onClick:()=>remove(ids)},
    {label:'Make Background Image of Current Spread',separator:true,disabled:!single||locked||!spread||spread.backgroundLocked,onClick:()=>{if(spread)state.updateSpread(spread.id,{backgroundPattern:{name:photo.fileName,src:photo.src,mode:'cover',tileSizePx:900,width:photo.width,height:photo.height,edits:defaultPlacement(crypto.randomUUID(),photo.id)}})}},
    {label:'Open in Photo Viewer',separator:true,disabled:!single||!photo.sourcePath||!window.albumStudio,onClick:()=>run(()=>window.albumStudio!.showImageFile(photo.sourcePath!,false))},
    {label:navigator.platform.includes('Mac')?'Show in Finder':'Show in Explorer',disabled:!photo.sourcePath||!window.albumStudio,onClick:()=>run(()=>window.albumStudio!.showImageFile(photo.sourcePath!,true))},
    {label:'Edit in Adobe Photoshop',separator:true,shortcut:'Ctrl+E',disabled:!single||locked,onClick:()=>openInEditor({app:'photoshop',src:photo.src,name:photo.fileName,photoId:photo.id})},
    {label:'Open in Canva',disabled:!single||locked,onClick:()=>openInEditor({app:'canva',src:photo.src,name:photo.fileName,photoId:photo.id})},
    {label:'Reload from Original',shortcut:'Ctrl+R',disabled:!single||locked||!photo.sourcePath||!window.albumStudio,onClick:()=>run(async()=>{
      const file=await window.albumStudio!.readSiblingImage(photo.sourcePath!,photo.sourcePath!.split(/[\\/]/).pop()!)
      if(!file)throw new Error('Original file is missing. Use Relink Missing File.')
      await replace(new File([file.data as BlobPart],photo.fileName,{type:photo.mimeType,lastModified:file.lastModified}),file.sourcePath)
    })},
    {label:'Replace Image',shortcut:'Ctrl+Shift+R',disabled:!single||locked,onClick:()=>{const input=document.createElement('input');input.type='file';input.accept=IMAGE_FILE_ACCEPT;input.onchange=()=>{const file=input.files?.[0];if(file)run(()=>replace(file))};input.click()}},
    {label:'Relink Missing File…',disabled:!single||locked,onClick:()=>window.dispatchEvent(new CustomEvent('album-studio:relink-photo',{detail:{photoId:photo.id}}))},
  ]
}
