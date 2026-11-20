import {create} from 'zustand'
import {importedDesignTemplates,sequenceCandidates,showcaseCandidates,templateLibraryVersion,templatesForCount,TemplateFrameFilter} from '@/engine/templates'
import {templateCategory,mustHoldGap} from '@/engine/templateTransfer'
import {matchesAlbumSize,matchesCollection,readCollectionsShared} from '@/engine/templateCollections'
import {supportsUniformGap} from '@/engine/templateLayout'
import {offeredLayouts,varyPatterns} from '@/engine/layoutOffer'
import {pagePlacements} from '@/engine/pageTemplates'
import {defaultLayouts} from '@/engine/autoLayout'
import {photoShapeCodes} from '@/engine/templateMatching'
import {wantedTemplates} from '@/engine/templateCounts'
import {PhotoAsset,Project,Spread,TemplateDefinition} from '@/types'
export const useTemplateBrowsing=create<{categories:{reference:boolean;creative:boolean};collection:string;albumSize:string;setAlbumSize:(value:string)=>void;favoritesOnly:boolean;setFavoritesOnly:(value:boolean)=>void;setCategories:(value:{reference:boolean;creative:boolean})=>void;setCollection:(value:string)=>void}>(set=>({categories:{reference:true,creative:true},collection:'',albumSize:'',setAlbumSize:albumSize=>set({albumSize}),favoritesOnly:false,setFavoritesOnly:favoritesOnly=>set({favoritesOnly}),setCategories:categories=>set({categories}),setCollection:collection=>set({collection})}))
/** The layouts cycling offers a spread, remembered.
 *
 *  Pressing Next used to work the whole answer out again, twice: once to find the next layout and once more for the
 *  overview's enabled/disabled buttons, because the spread is a new object after every change. The answer depends
 *  only on how many photographs there are, their shapes in order, the album's shape, margin and gap, and the filters,
 *  none of which a change of layout alters, so holding the key down now costs a lookup after the first press. */
const cycleLists=new Map<string,{deps:unknown[];list:TemplateDefinition[]}>()
const photosById=new WeakMap<PhotoAsset[],Map<string,PhotoAsset>>()
function photoLookup(photos:PhotoAsset[]){let map=photosById.get(photos);if(!map){map=new Map(photos.map(p=>[p.id,p]));photosById.set(photos,map)}return map}
function cycleContext(project:Project,spread:Spread,filter:TemplateFrameFilter,kind:'image'|'mixed'){
 const size=spread.size??project.size,aspect=size.widthIn/size.heightIn,eligible=pagePlacements(spread,aspect,'spread'),count=eligible.filter(p=>p.photoId).length||eligible.length
 const state=useTemplateBrowsing.getState(),{categories,collection,albumSize,favoritesOnly}=state
 const lookup=photoLookup(project.photos)
 const photos=spread.placements.flatMap(pl=>{const photo=pl.photoId?lookup.get(pl.photoId):undefined;return photo?[photo]:[]})
 return {size,aspect,count,categories,collection,albumSize,favoritesOnly,photos,key:[kind,count,photos.length,photoShapeCodes(photos),aspect,spread.marginPx,spread.gapPx,filter,collection,albumSize,favoritesOnly].join('|')}
}
/** How many layouts cycling has for a spread, for the overview's enabled/disabled buttons, which ask on every
 *  render for every spread. The first answer for a set of photographs can take a second to work out (the shelf is
 *  drawn for those photographs), so a spread not worked out yet reads as "has some" and is worked out one at a
 *  time when the page is idle; the buttons settle on the next render. A press never waits on this: it asks for the list itself. */
const pending=new Map<string,()=>void>()
let drainTimer:ReturnType<typeof setTimeout>|undefined
/** Works the waiting spreads out one at a time, and only once the page has been quiet for a moment: each one can take a
 *  good part of a second, and run straight after a change they landed in the middle of whatever the user did next (a drag
 *  between spreads lost pointer moves to them). Every new request pushes the start back. */
function drainLater(delay:number){
 if(drainTimer)clearTimeout(drainTimer)
 drainTimer=setTimeout(()=>{
  drainTimer=undefined
  const next=pending.entries().next().value
  if(!next)return
  pending.delete(next[0])
  try{next[1]()}catch{/* The buttons simply stay enabled for this spread. */}
  if(pending.size)drainLater(250)
 },delay)
}
export function cyclingCount(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const {key}=cycleContext(project,spread,filter,kind),hit=cycleLists.get(key)
 if(hit&&hit.deps.every((v,i)=>v===[project.enabledTemplateIds,favorites,useTemplateBrowsing.getState().categories,templateLibraryVersion()][i]))return hit.list.length
 if(typeof setTimeout!=='function')return cyclingTemplates(project,spread,filter,favorites,kind).length
 if(!pending.has(key)){
  pending.set(key,()=>{cyclingTemplates(project,spread,filter,favorites,kind)})
  drainLater(1200)
 }
 return 2
}
export function cyclingTemplates(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const {size,aspect,count,categories,collection,albumSize,favoritesOnly,photos,key}=cycleContext(project,spread,filter,kind)
 const deps=[project.enabledTemplateIds,favorites,categories,templateLibraryVersion()]
 const hit=cycleLists.get(key)
 if(hit&&hit.deps.every((v,i)=>v===deps[i])){cycleLists.delete(key);cycleLists.set(key,hit);return hit.list}
 // A single page (a split spread) is offered what sits on its half: the same layouts a split or a drop starts it with.
 if(kind==='image'&&(spread.pageSide==='left'||spread.pageSide==='right')&&photos.length===count){
  const onPage=defaultLayouts(photos,spread.pageSide,aspect,spread.marginPx,spread.gapPx,project.enabledTemplateIds).filter(t=>categories[templateCategory(t)]&&matchesCollection(t.id,collection,readCollectionsShared(),favorites)&&matchesAlbumSize(t.id,albumSize,readCollectionsShared())&&(!favoritesOnly||favorites.includes(t.id)))
  cycleLists.set(key,{deps,list:onPage})
  return onPage
 }
 const collections=readCollectionsShared()
 const list=[...sequenceCandidates(photos,count,project.enabledTemplateIds,filter,aspect),...templatesForCount(count,project.enabledTemplateIds,filter,aspect),...showcaseCandidates(photos,count,project.enabledTemplateIds,filter,aspect),...importedDesignTemplates(count,project.enabledTemplateIds,filter,aspect)].filter(t=>(!favoritesOnly||favorites.includes(t.id))&&(kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)&&categories[templateCategory(t)]&&matchesCollection(t.id,collection,collections,favorites)&&matchesAlbumSize(t.id,albumSize,collections)&&(!mustHoldGap(t)||supportsUniformGap(t.placeholders,aspect,spread.marginPx,spread.gapPx)))
 const offered=varyPatterns(offeredLayouts(photos.length===count?photos:[],list,aspect,spread.marginPx,spread.gapPx,true,true),t=>t,aspect,photos.length===count?wantedTemplates(photos):undefined)
 cycleLists.set(key,{deps,list:offered})
 if(cycleLists.size>160)cycleLists.delete(cycleLists.keys().next().value!)
 return offered
}
