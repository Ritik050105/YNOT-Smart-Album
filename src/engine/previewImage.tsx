import {useEffect,useState,useRef,ImgHTMLAttributes} from 'react'
const cache=new Map<string,Promise<string>>()
const seeds=new Map<string,string>()
const thumbs=new Map<string,string>()
const paths=new Map<string,string>()
export function seedPreview(src:string,preview:string,thumb?:string,sourcePath?:string){seeds.set(src,preview);if(thumb)thumbs.set(src,thumb);if(sourcePath)paths.set(src,sourcePath);if(seeds.size>256)seeds.delete(seeds.keys().next().value!)}
// Decoding happens in the main process; a few at a time keeps hundreds of large originals from piling up.
let active=0;const waiting:(()=>void)[]=[]
async function pooled<T>(job:()=>Promise<T>):Promise<T>{if(active>=3)await new Promise<void>(resolve=>waiting.push(resolve));active++;try{return await job()}finally{active--;waiting.shift()?.()}}
function viaMain(src:string,max:number):Promise<string>|undefined{
 if(!window.albumStudio?.imagePreview)return
 const from=paths.get(src)??(src.startsWith('file:')?src:'')
 if(!from)return
 return pooled(async()=>{const r=await window.albumStudio!.imagePreview(from);seedPreview(src,r.src,r.thumb);return max<=512?r.thumb:r.src})
}
let queue=Promise.resolve()
export function previewSource(src:string,max=1600):Promise<string>{if(!src)return Promise.resolve('');if(max===1600&&seeds.has(src))return Promise.resolve(seeds.get(src)!);if(max<=512&&thumbs.has(src))return Promise.resolve(thumbs.get(src)!);const key=max+':'+src;const old=cache.get(key);if(old)return old
const main=viaMain(src,max);if(main){cache.set(key,main);main.catch(()=>cache.delete(key));return main}
const task=queue.then(async()=>{if(src.startsWith('file:')&&window.albumStudio?.imagePreview&&!seeds.has(src)){const result=await window.albumStudio.imagePreview(src);seedPreview(src,result.src)}return new Promise<string>((resolve,reject)=>{const image=new Image();image.onload=()=>{const scale=Math.min(1,max/Math.max(image.width,image.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));const ctx=c.getContext('2d')!;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,c.width,c.height);resolve(c.toDataURL('image/webp',.88));image.src=''};image.onerror=()=>reject(new Error('Image preview could not be loaded'));if(seeds.has(src)){image.src=seeds.get(src)!}else if(max<1600&&cache.has('1600:'+src)){void cache.get('1600:'+src)!.then(v=>{image.src=v},reject)}else image.src=src})});queue=task.then(()=>{},()=>{});cache.set(key,task);if(cache.size>180)cache.delete(cache.keys().next().value!);task.catch(()=>cache.delete(key));return task}
export function usePreviewSource(src:string,max=1600){const [value,setValue]=useState('');useEffect(()=>{let live=true;setValue('');void previewSource(src,max).then(v=>{if(live)setValue(v)}).catch(()=>{});return()=>{live=false}},[src,max]);return value}
export function PreviewImage({src='',...props}:ImgHTMLAttributes<HTMLImageElement>){
 const ref=useRef<HTMLImageElement>(null)
 const [visible,setVisible]=useState(false)
 useEffect(()=>{
  const node=ref.current
  if(!node)return
  if(typeof IntersectionObserver==='undefined'){setVisible(true);return}
  const observer=new IntersectionObserver(entries=>setVisible(entries.some(entry=>entry.isIntersecting)),{rootMargin:'200px'})
  observer.observe(node)
  return()=>observer.disconnect()
 },[])
 const preview=usePreviewSource(visible?src:'',512)
 return <img {...props} ref={ref} src={preview||undefined} loading="lazy"/>
}
