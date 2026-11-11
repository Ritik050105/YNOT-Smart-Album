import {create} from 'zustand'
import {importedDesignTemplates,runsToTheTrim,templatesForCount,TemplateFrameFilter} from '@/engine/templates'
import {templateCategory} from '@/engine/templateTransfer'
import {matchesCollection,readCollections} from '@/engine/templateCollections'
import {supportsUniformGap} from '@/engine/templateLayout'
import {pagePlacements} from '@/engine/pageTemplates'
import {Project,Spread} from '@/types'
export const useTemplateBrowsing=create<{categories:{reference:boolean;creative:boolean};collection:string;favoritesOnly:boolean;setFavoritesOnly:(value:boolean)=>void;setCategories:(value:{reference:boolean;creative:boolean})=>void;setCollection:(value:string)=>void}>(set=>({categories:{reference:true,creative:true},collection:'',favoritesOnly:false,setFavoritesOnly:favoritesOnly=>set({favoritesOnly}),setCategories:categories=>set({categories}),setCollection:collection=>set({collection})}))
export function cyclingTemplates(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const size=spread.size??project.size,aspect=size.widthIn/size.heightIn,eligible=pagePlacements(spread,aspect,'spread'),count=eligible.filter(p=>p.photoId).length||eligible.length
 const {categories,collection,favoritesOnly}=useTemplateBrowsing.getState()
 return [...templatesForCount(count,project.enabledTemplateIds,filter,aspect),...importedDesignTemplates(count,project.enabledTemplateIds,filter,aspect)].filter(t=>(!favoritesOnly||favorites.includes(t.id))&&(kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)&&categories[templateCategory(t)]&&matchesCollection(t.id,collection,readCollections(),favorites)&&(templateCategory(t)!=='reference'||runsToTheTrim(t)||supportsUniformGap(t.placeholders,aspect,spread.marginPx,spread.gapPx)))
}
