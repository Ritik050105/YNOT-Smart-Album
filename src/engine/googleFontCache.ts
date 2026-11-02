import catalog from '@/data/googleFontsCatalog.json'

type Face = {data:BufferSource;weight:string;style:string;unicodeRange:string}
const pending = new Map<string,Promise<void>>()
function database():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('ynot-google-fonts',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('families')
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}
async function cached(family:string,faces?:Face[]):Promise<Face[]|undefined>{
  const db=await database()
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('families',faces?'readwrite':'readonly'),store=tx.objectStore('families')
    const request=faces?store.put(faces,family):store.get(family)
    tx.oncomplete=()=>resolve(faces??request.result)
    tx.onerror=()=>reject(tx.error)
  })}finally{db.close()}
}
export async function prepareGoogleFont(family:string):Promise<void>{ await googleFontFaces(family) }
async function googleFontFaces(family:string):Promise<Face[]>{
    const entry=catalog.find(font=>font.family===family)
    if(!entry)throw new Error('Unknown Google font')
    let faces=(await window.albumStudio?.readCachedFont?.(family).catch(()=>null) as Face[]|null|undefined)??await cached(family)
    if(!faces){
      const variants=entry.variants.map(v=>[v.endsWith('i')?1:0,parseInt(v,10)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])
      const query=family.replace(/ /g,'+')+':ital,wght@'+variants.map(v=>v.join(',')).join(';')
      const response=await fetch('https://fonts.googleapis.com/css2?family='+query+'&display=swap',{signal:AbortSignal.timeout(30000)})
      if(!response.ok)throw new Error('Connect to the internet to download '+family+' for first use.')
      const css=await response.text()
      faces=[]
      for(const block of css.match(/@font-face\s*\{[^}]+\}/g)??[]){
        const url=block.match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g,'')
        const parsed=(()=>{try{return url?new URL(url):null}catch{return null}})()
        if(!parsed||parsed.hostname!=='fonts.gstatic.com'||parsed.protocol!=='https:')throw new Error('Invalid Google font source: '+(url??'(none)').slice(0,120))
        const file=await fetch(parsed.href,{signal:AbortSignal.timeout(30000)})
        if(!file.ok)throw new Error('Font download failed: '+family)
        faces.push({data:await file.arrayBuffer(),weight:block.match(/font-weight:\s*([^;]+)/)?.[1]??'400',style:block.match(/font-style:\s*([^;]+)/)?.[1]??'normal',unicodeRange:block.match(/unicode-range:\s*([^;]+)/)?.[1]??'U+0-10FFFF'})
      }
      if(!faces.length)throw new Error('No font files returned for '+family)
      await cached(family,faces)
    }
    return faces
}
export function loadGoogleFont(family:string):Promise<void>{
  if(!pending.has(family))pending.set(family,(async()=>{
    const faces=await googleFontFaces(family)
    const loaded=await Promise.all(faces.map(face=>new FontFace(family,face.data,{weight:face.weight,style:face.style,unicodeRange:face.unicodeRange}).load()))
    loaded.forEach(face=>document.fonts.add(face))
    window.dispatchEvent(new CustomEvent('album-studio:font-loaded',{detail:{family}}))
  })().catch(error=>{pending.delete(family);throw error}))
  return pending.get(family)!
}
