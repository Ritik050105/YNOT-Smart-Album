import { create } from 'zustand'
export const preferenceDefaults = {
  projectDirectory:'', photoshopPath:'', canvaPath:'', autoBins:true, reuseImages:true, revealExport:false,
  autoRearrange:true, scrollAxis:'auto', scrollSpeed:1, navigateNew:true, gridMode:'auto',
  altDrop:'add', spreadBar:'spread', hints:true, showCover:true,
  jpegQuality:100, sharpening:'none', scalingThreshold:120, animations:true, highResolution:true, classicHome:false,
  gapPercentPresets:[-25,-10,10,25], gapPresetPast:[] as number[][], gapPresetFuture:[] as number[][],
  gapImportPast:[] as string[], gapImportFuture:[] as string[],
  metadata:['Color profile','Dimensions','Shutter speed','Aperture','ISO','Focal length','Date taken'],
}
export type Preferences = typeof preferenceDefaults
const validPresets=(value:unknown):value is number[]=>Array.isArray(value)&&value.length===4&&value.every(p=>typeof p==='number'&&Number.isFinite(p)&&p>=-100)&&new Set(value).size===4
export function normalizePreferences(value: unknown): Preferences {
  const result={...preferenceDefaults}; if(!value || typeof value!=='object')return result
  const input=value as Record<string,unknown>
  for(const key of Object.keys(result) as (keyof Preferences)[]) {
    if(typeof input[key]===typeof result[key] && !Array.isArray(result[key])) (result as Record<string,unknown>)[key]=input[key]
  }
  for(const [key,values] of Object.entries({scrollAxis:['auto','vertical','horizontal'],gridMode:['auto','on','off'],altDrop:['add','replace'],spreadBar:['spread','bar'],sharpening:['none','low','medium','high']})) if(!values.includes(String((result as Record<string,unknown>)[key]))) (result as Record<string,unknown>)[key]=(preferenceDefaults as Record<string,unknown>)[key]
  for(const [key,min,max]of [['scrollSpeed',.25,3],['jpegQuality',1,100],['scalingThreshold',100,300]] as const) result[key]=Number.isFinite(result[key])?Math.max(min,Math.min(max,result[key])):preferenceDefaults[key]
  if(Array.isArray(input.metadata))result.metadata=input.metadata.filter((s):s is string=>typeof s==='string')
  if(validPresets(input.gapPercentPresets))result.gapPercentPresets=[...input.gapPercentPresets]
  for(const key of ['gapPresetPast','gapPresetFuture'] as const){const stack=input[key];if(Array.isArray(stack)&&stack.every(validPresets))result[key]=stack.map(values=>[...values])}
  for(const key of ['gapImportPast','gapImportFuture'] as const){const stack=input[key];if(Array.isArray(stack)&&stack.every(entry=>{if(typeof entry!=='string')return false;try{importGapPresets(entry,true);return true}catch{return false}}))result[key]=[...stack]}
  return result
}
function load(){try{return normalizePreferences(JSON.parse(localStorage.getItem('albumstudio.preferences')??'null'))}catch{return {...preferenceDefaults}}}
export const usePreferences=create<{values:Preferences;save:(values:Preferences)=>void}>(set=>({values:load(),save:values=>{const clean=normalizePreferences(values);localStorage.setItem('albumstudio.preferences',JSON.stringify(clean));set({values:clean})}}))
export const getPreferences=()=>usePreferences.getState().values

export function exportGapPresets(preferences:Preferences,includeImportHistory=true):string {
  return JSON.stringify({format:'ynot-gap-presets',version:1,presets:preferences.gapPercentPresets,past:preferences.gapPresetPast,future:preferences.gapPresetFuture,...(includeImportHistory?{version:2,importPast:preferences.gapImportPast,importFuture:preferences.gapImportFuture}:{})},null,2)
}
export function importGapPresets(text:string,snapshotOnly=false):Pick<Preferences,'gapPercentPresets'|'gapPresetPast'|'gapPresetFuture'>&Partial<Pick<Preferences,'gapImportPast'|'gapImportFuture'>> {
  let data:unknown
  try{data=JSON.parse(text)}catch{throw new Error('This file is not valid JSON.')}
  const file=data as Record<string,unknown>|null
  if(!file||file.format!=='ynot-gap-presets'||(file.version!==1&&(snapshotOnly||file.version!==2)))throw new Error('Choose a supported YNOT percentage presets export.')
  if(!validPresets(file.presets)||!Array.isArray(file.past)||!file.past.every(validPresets)||!Array.isArray(file.future)||!file.future.every(validPresets))throw new Error('The presets or their history are invalid. Nothing was imported.')
  let history:Partial<Pick<Preferences,'gapImportPast'|'gapImportFuture'>>={}
  if(file.version===2){
    const validStack=(stack:unknown):stack is string[]=>Array.isArray(stack)&&stack.every(entry=>{if(typeof entry!=='string')return false;try{importGapPresets(entry,true);return true}catch{return false}})
    if(!validStack(file.importPast)||!validStack(file.importFuture))throw new Error('The import Undo/Redo history is invalid. Nothing was imported.')
    history={gapImportPast:[...file.importPast],gapImportFuture:[...file.importFuture]}
  }
  return {gapPercentPresets:[...file.presets],gapPresetPast:file.past.map(values=>[...values]),gapPresetFuture:file.future.map(values=>[...values]),...history}
}
