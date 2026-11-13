import {create} from 'zustand'
import {importedDesignTemplates,sequenceCandidates,templateLibraryVersion,templatesForCount,TemplateFrameFilter} from '@/engine/templates'
import {templateCategory} from '@/engine/templateTransfer'
import {matchesCollection,readCollectionsShared} from '@/engine/templateCollections'
import {supportsUniformGap} from '@/engine/templateLayout'
import {offeredLayouts} from '@/engine/layoutOffer'
import {pagePlacements} from '@/engine/pageTemplates'
import {photoShapeCodes} from '@/engine/templateMatching'
import {PhotoAsset,Project,Spread,TemplateDefinition} from '@/types'
export const useTemplateBrowsing=create<{categories:{reference:boolean;creative:boolean};collection:string;favoritesOnly:boolean;setFavoritesOnly:(value:boolean)=>void;setCategories:(value:{reference:boolean;creative:boolean})=>void;setCollection:(value:string)=>void}>(set=>({categories:{reference:true,creative:true},collection:'',favoritesOnly:false,setFavoritesOnly:favoritesOnly=>set({favoritesOnly}),setCategories:categories=>set({categories}),setCollection:collection=>set({collection})}))
/** The layouts cycling offers a spread, remembered.
 *
 *  Pressing Next used to work the whole answer out again, twice: once to find the next layout and once more for the
 *  overview's enabled/disabled buttons, because the spread is a new object after every change. The answer depends
 *  only on how many photographs there are, their shapes in order, the album's shape, margin and gap, and the filters,
 *  none of which a change of layout alters, so holding the key down now costs a lookup after the first press. */
const cycleLists=new Map<string,{deps:unknown[];list:TemplateDefinition[]}>()
const photosById=new WeakMap<PhotoAsset[],Map<string,PhotoAsset>>()
function photoLookup(photos:PhotoAsset[]){let map=photosById.get(photos);if(!map){map=new Map(photos.map(p=>[p.id,p]));photosById.set(photos,map)}return map}
export function cyclingCount(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 return cyclingTemplates(project,spread,filter,favorites,kind).length
}
export function cyclingTemplates(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const size=spread.size??project.size,aspect=size.widthIn/size.heightIn,eligible=pagePlacements(spread,aspect,'spread'),count=eligible.filter(p=>p.photoId).length||eligible.length
 const state=useTemplateBrowsing.getState(),{categories,collection,favoritesOnly}=state
 const lookup=photoLookup(project.photos)
 const photos=spread.placements.flatMap(pl=>{const photo=pl.photoId?lookup.get(pl.photoId):undefined;return photo?[photo]:[]})
 const key=[kind,count,photos.length,photoShapeCodes(photos),aspect,spread.marginPx,spread.gapPx,filter,collection,favoritesOnly].join('|')
 const deps=[project.enabledTemplateIds,favorites,categories,templateLibraryVersion()]
 const hit=cycleLists.get(key)
 if(hit&&hit.deps.every((v,i)=>v===deps[i])){cycleLists.delete(key);cycleLists.set(key,hit);return hit.list}
 const collections=readCollectionsShared()
 const list=[...sequenceCandidates(photos,count,project.enabledTemplateIds,filter,aspect),...templatesForCount(count,project.enabledTemplateIds,filter,aspect),...importedDesignTemplates(count,project.enabledTemplateIds,filter,aspect)].filter(t=>(!favoritesOnly||favorites.includes(t.id))&&(kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)&&categories[templateCategory(t)]&&matchesCollection(t.id,collection,collections,favorites)&&(templateCategory(t)!=='reference'||supportsUniformGap(t.placeholders,aspect,spread.marginPx,spread.gapPx)))
 const offered=offeredLayouts(photos.length===count?photos:[],list,aspect,spread.marginPx,spread.gapPx,true,true)
 cycleLists.set(key,{deps,list:offered})
 if(cycleLists.size>160)cycleLists.delete(cycleLists.keys().next().value!)
 return offered
}
