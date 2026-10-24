import { create } from 'zustand'
export const preferenceDefaults = {
  projectDirectory:'', photoshopPath:'', canvaPath:'', autoBins:true, reuseImages:true, revealExport:false,
  autoRearrange:true, scrollAxis:'auto', scrollSpeed:1, navigateNew:true, gridMode:'auto',
  altDrop:'add', spreadBar:'spread', hints:true, showCover:true,
  jpegQuality:100, sharpening:'none', scalingThreshold:120, animations:true, highResolution:true, classicHome:false,
  gapPercentPresets:[-25,-10,10,25], gapPresetPast:[] as number[][], gapPresetFuture:[] as number[][],
  metadata:['Color profile','Dimensions','Shutter speed','Aperture','ISO','Focal length','Date taken'],
}
export type Preferences = typeof preferenceDefaults
export function normalizePreferences(value: unknown): Preferences {
  const result={...preferenceDefaults}; if(!value || typeof value!=='object')return result
  const input=value as Record<string,unknown>
  for(const key of Object.keys(result) as (keyof Preferences)[]) {
    if(typeof input[key]===typeof result[key] && !Array.isArray(result[key])) (result as Record<string,unknown>)[key]=input[key]
  }
  for(const [key,values] of Object.entries({scrollAxis:['auto','vertical','horizontal'],gridMode:['auto','on','off'],altDrop:['add','replace'],spreadBar:['spread','bar'],sharpening:['none','low','medium','high']})) if(!values.includes(String((result as Record<string,unknown>)[key]))) (result as Record<string,unknown>)[key]=(preferenceDefaults as Record<string,unknown>)[key]
  for(const [key,min,max]of [['scrollSpeed',.25,3],['jpegQuality',1,100],['scalingThreshold',100,300]] as const) result[key]=Number.isFinite(result[key])?Math.max(min,Math.min(max,result[key])):preferenceDefaults[key]
  if(Array.isArray(input.metadata))result.metadata=input.metadata.filter((s):s is string=>typeof s==='string')
  const validPresets=(value:unknown):value is number[]=>Array.isArray(value)&&value.length===4&&value.every(p=>typeof p==='number'&&Number.isFinite(p)&&p>=-100)&&new Set(value).size===4
  if(validPresets(input.gapPercentPresets))result.gapPercentPresets=[...input.gapPercentPresets]
  for(const key of ['gapPresetPast','gapPresetFuture'] as const){const stack=input[key];if(Array.isArray(stack)&&stack.every(validPresets))result[key]=stack.map(values=>[...values])}
  return result
}
function load(){try{return normalizePreferences(JSON.parse(localStorage.getItem('albumstudio.preferences')??'null'))}catch{return {...preferenceDefaults}}}
export const usePreferences=create<{values:Preferences;save:(values:Preferences)=>void}>(set=>({values:load(),save:values=>{const clean=normalizePreferences(values);localStorage.setItem('albumstudio.preferences',JSON.stringify(clean));set({values:clean})}}))
export const getPreferences=()=>usePreferences.getState().values
