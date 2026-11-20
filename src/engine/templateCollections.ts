import {useEffect,useState} from 'react'
type Collections={categories:Record<string,string[]>;/** Album size (its label, or a custom 'W" x H"') to the ids of the templates saved for it. */sizes:Record<string,string[]>;uses:Record<string,number>}
const key='ynot:template-collections:v1'
export function readCollections():Collections{try{const data=JSON.parse(localStorage.getItem(key)??'{}');const lists=(raw:unknown)=>Object.fromEntries(Object.entries((raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>).filter(([name,ids])=>name.length<=100&&Array.isArray(ids)&&ids.every(id=>typeof id==='string')) as [string,string[]][]);return {sizes:lists(data.sizes),categories:Object.fromEntries(Object.entries(data.categories??{}).filter(([name,ids])=>name.length<=100&&Array.isArray(ids)&&ids.every(id=>typeof id==='string')) as [string,string[]][]),uses:Object.fromEntries(Object.entries(data.uses??{}).filter(([,count])=>typeof count==='number'&&Number.isFinite(count)&&count>=0)) as Record<string,number>}}catch{return {categories:{},sizes:{},uses:{}}}}
let sharedRaw:string|null=null,sharedValue:Collections|null=null
/** The saved collections for reading only, parsed once per change of the stored text. Offering layouts asks for them once per
 *  template, and parsing the stored JSON that often was a visible part of every press of Next. */
export function readCollectionsShared():Collections{let raw='{}';try{raw=localStorage.getItem(key)??'{}'}catch{}if(sharedValue&&raw===sharedRaw)return sharedValue;sharedValue=readCollections();sharedRaw=raw;return sharedValue}
function write(data:Collections){localStorage.setItem(key,JSON.stringify(data));window.dispatchEvent(new Event(key))}
export function useTemplateCollections(){const [data,set]=useState(readCollections);useEffect(()=>{const update=()=>set(readCollections());window.addEventListener(key,update);return()=>window.removeEventListener(key,update)},[]);return data}
/** The album size asked for along with the category in the save dialog; the next classifyTemplates files the templates under it too. */
let pendingAlbumSize='',pendingSince=0
export function setPendingAlbumSize(size:string){pendingAlbumSize=size.trim().slice(0,100);pendingSince=Date.now()}
export function tagAlbumSize(ids:string[],size:string){const name=size.trim();if(!name||name.length>100||['__proto__','constructor','prototype'].includes(name))return;const data=readCollections();data.sizes[name]=[...new Set([...(data.sizes[name]??[]),...ids])];write(data)}
export function matchesAlbumSize(id:string,size:string,data:Collections){return !size||(data.sizes[size]??[]).includes(id)}
export function classifyTemplates(ids:string[],category:string){const name=category.trim();if(!name||name.length>100||['__proto__','constructor','prototype','Favorites','Frequently used'].includes(name))throw new Error('Enter a category of 1–100 characters.');const data=readCollections();data.categories[name]=[...new Set([...(data.categories[name]??[]),...ids])];// (Kept for the whole batch an import files one by one, and for ten minutes at most: a size asked for once is not carried into some later, unrelated filing.)
if(pendingAlbumSize&&Date.now()-pendingSince<600000){const size=pendingAlbumSize;if(!['__proto__','constructor','prototype'].includes(size))data.sizes[size]=[...new Set([...(data.sizes[size]??[]),...ids])]}write(data)}
export function recordTemplateUse(id:string){const data=readCollections();data.uses[id]=(data.uses[id]??0)+1;write(data)}
export function matchesCollection(id:string,category:string,data:Collections,favorites:string[]){return !category||(category==='Favorites'?favorites.includes(id):category==='Frequently used'?(data.uses[id]??0)>0:(data.categories[category]??[]).includes(id))}
