import {useProjectStore} from '@/state/projectStore'
import {spreadLayers} from '@/engine/spreadLayers'
export function layerOrderItems(spreadId:string,kind:'image'|'text',id:string){
 const state=useProjectStore.getState(),spread=state.project.spreads.find(s=>s.id===spreadId)
 if(!spread)return []
 const layers=spreadLayers(spread),index=layers.findIndex(l=>l.kind===kind&&l.id===id)
 return ([['Bring to front',layers.length-1],['Bring forward',index+1],['Send backward',index-1],['Send to back',0]] as [string,number][]).map(([label,to])=>({label,disabled:index<0||!!layers[index]?.value.locked||to<0||to>=layers.length||to===index,onClick:()=>{const target=layers[to];if(target)state.moveLayer(spreadId,kind,id,target.kind,target.id)}}))
}
