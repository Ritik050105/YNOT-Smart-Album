import {useEffect,useState} from 'react'
type Collections={categories:Record<string,string[]>;uses:Record<string,number>}
const key='ynot:template-collections:v1'
export function readCollections():Collections{try{const data=JSON.parse(localStorage.getItem(key)??'{}');return {categories:Object.fromEntries(Object.entries(data.categories??{}).filter(([name,ids])=>name.length<=100&&Array.isArray(ids)&&ids.every(id=>typeof id==='string')) as [string,string[]][]),uses:Object.fromEntries(Object.entries(data.uses??{}).filter(([,count])=>typeof count==='number'&&Number.isFinite(count)&&count>=0)) as Record<string,number>}}catch{return {categories:{},uses:{}}}}
function write(data:Collections){localStorage.setItem(key,JSON.stringify(data));window.dispatchEvent(new Event(key))}
export function useTemplateCollections(){const [data,set]=useState(readCollections);useEffect(()=>{const update=()=>set(readCollections());window.addEventListener(key,update);return()=>window.removeEventListener(key,update)},[]);return data}
export function classifyTemplates(ids:string[],category:string){const name=category.trim();if(!name||name.length>100||['__proto__','constructor','prototype','Favorites','Frequently used'].includes(name))throw new Error('Enter a category of 1–100 characters.');const data=readCollections();data.categories[name]=[...new Set([...(data.categories[name]??[]),...ids])];write(data)}
export function recordTemplateUse(id:string){const data=readCollections();data.uses[id]=(data.uses[id]??0)+1;write(data)}
export function matchesCollection(id:string,category:string,data:Collections,favorites:string[]){return !category||(category==='Favorites'?favorites.includes(id):category==='Frequently used'?(data.uses[id]??0)>0:(data.categories[category]??[]).includes(id))}
