import {create} from 'zustand'
import {importedDesignTemplates,runsToTheTrim,templatesForCount,TemplateFrameFilter} from '@/engine/templates'
import {templateCategory} from '@/engine/templateTransfer'
import {matchesCollection,readCollections} from '@/engine/templateCollections'
import {supportsUniformGap} from '@/engine/templateLayout'
import {pagePlacements} from '@/engine/pageTemplates'
import {Project,Spread} from '@/types'
export const useTemplateBrowsing=create<{categories:{reference:boolean;creative:boolean};collection:string;favoritesOnly:boolean;setFavoritesOnly:(value:boolean)=>void;setCategories:(value:{reference:boolean;creative:boolean})=>void;setCollection:(value:string)=>void}>(set=>({categories:{reference:true,creative:true},collection:'',favoritesOnly:false,setFavoritesOnly:favoritesOnly=>set({favoritesOnly}),setCategories:categories=>set({categories}),setCollection:collection=>set({collection})}))
/** How many layouts cycling offers a spread. The overview asks this four times per spread on every render, and a
 *  render happens each time the drop target changes during a drag; filtering the whole library that often was the
 *  lag. The answer only changes when the spread or one of the inputs does, so it is kept per spread. */
const cycleCounts=new WeakMap<Spread,{inputs:unknown[];values:Map<string,number>}>()
export function cyclingCount(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const inputs=[project.size,project.enabledTemplateIds,filter,favorites,useTemplateBrowsing.getState()]
 let entry=cycleCounts.get(spread)
 if(!entry||entry.inputs.some((v,i)=>v!==inputs[i])){entry={inputs,values:new Map()};cycleCounts.set(spread,entry)}
 let count=entry.values.get(kind)
 if(count===undefined){count=cyclingTemplates(project,spread,filter,favorites,kind).length;entry.values.set(kind,count)}
 return count
}
export function cyclingTemplates(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const size=spread.size??project.size,aspect=size.widthIn/size.heightIn,eligible=pagePlacements(spread,aspect,'spread'),count=eligible.filter(p=>p.photoId).length||eligible.length
 const {categories,collection,favoritesOnly}=useTemplateBrowsing.getState()
 return [...templatesForCount(count,project.enabledTemplateIds,filter,aspect),...importedDesignTemplates(count,project.enabledTemplateIds,filter,aspect)].filter(t=>(!favoritesOnly||favorites.includes(t.id))&&(kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)&&categories[templateCategory(t)]&&matchesCollection(t.id,collection,readCollections(),favorites)&&(templateCategory(t)!=='reference'||runsToTheTrim(t)||supportsUniformGap(t.placeholders,aspect,spread.marginPx,spread.gapPx)))
}
