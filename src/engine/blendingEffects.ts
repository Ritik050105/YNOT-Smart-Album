import {TextEffect,TextEffectName} from '@/types'
export const effectNames:Record<TextEffectName,string>={bevel:'Bevel & emboss',texture:'Texture',stroke:'Stroke',innerShadow:'Inner shadow',innerGlow:'Inner glow',satin:'Satin',colorOverlay:'Color overlay',gradientOverlay:'Gradient overlay',patternOverlay:'Pattern overlay',outerGlow:'Outer glow',dropShadow:'Drop shadow'}
/** The effects offered in the panel. Texture, inner shadow, inner glow and satin are no longer offered;
 *  the drawing code keeps them so an album saved with one still looks the way it did. */
export const offeredEffects:TextEffectName[]=['bevel','stroke','colorOverlay','gradientOverlay','patternOverlay','outerGlow','dropShadow']
export function effectDefault(name:TextEffectName):TextEffect {
 const glow=name==='innerGlow'||name==='outerGlow',shadow=name==='innerShadow'||name==='dropShadow'
 return {enabled:false,color:glow||name==='bevel'?'#ffffff':'#242424',color2:'#000000',size:2,opacity:shadow||glow?.35:1,angle:30,distance:1,blendMode:glow?'screen':shadow||name==='satin'?'multiply':'source-over',contour:'linear',antiAlias:true,range:50,scale:100,depth:100,altitude:30,highlightOpacity:.5,shadowOpacity:.5,highlightMode:'screen',shadowMode:'multiply',knockout:true,...(name==='satin'?{size:19,distance:12,angle:90,opacity:.5,invert:true}:{}),...(name==='stroke'?{size:4}:{}),...(name==='texture'?{pattern:'dots' as const}:{}),...(name==='gradientOverlay'?{angle:90}: {})}
}
const storageKey='ynot-blending-effect-defaults-v1'
export function savedEffectDefault(name:TextEffectName):TextEffect {try {const e=JSON.parse(localStorage.getItem(storageKey)||'{}')[name];return {...effectDefault(name),...e,enabled:false}}catch{return effectDefault(name)}}
export function saveEffectDefault(name:TextEffectName,e:TextEffect){let saved:Record<string,TextEffect>={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{};localStorage.setItem(storageKey,JSON.stringify({...saved,[name]:e}))}

export function effectPadding(effects:Partial<Record<TextEffectName,TextEffect>>|undefined){return Math.max(2,...Object.entries(effects??{}).map(([name,e])=>e?.enabled?(name==='bevel'?e.size*(e.depth??100)/100+(e.soften??0)*3:e.size*3+e.distance):0))}
