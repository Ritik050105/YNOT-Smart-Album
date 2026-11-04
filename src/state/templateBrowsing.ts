import {create} from 'zustand'
import {importedDesignTemplates,isFullSpreadTemplate,templatesForCount,TemplateFrameFilter} from '@/engine/templates'
import {templateCategory} from '@/engine/templateTransfer'
import {matchesCollection,readCollections} from '@/engine/templateCollections'
import {supportsUniformGap} from '@/engine/templateLayout'
import {pagePlacements} from '@/engine/pageTemplates'
import {Project,Spread} from '@/types'
export const useTemplateBrowsing=create<{categories:{reference:boolean;creative:boolean;generated:boolean};collection:string;favoritesOnly:boolean;setFavoritesOnly:(value:boolean)=>void;setCategories:(value:{reference:boolean;creative:boolean;generated:boolean})=>void;setCollection:(value:string)=>void}>(set=>({categories:{reference:true,creative:true,generated:false},collection:'',favoritesOnly:false,setFavoritesOnly:favoritesOnly=>set({favoritesOnly}),setCategories:categories=>set({categories}),setCollection:collection=>set({collection})}))
export function cyclingTemplates(project:Project,spread:Spread,filter:TemplateFrameFilter,favorites:string[],kind:'image'|'mixed'='image'){
 const size=spread.size??project.size,aspect=size.widthIn/size.heightIn,eligible=pagePlacements(spread,aspect,'spread'),count=eligible.filter(p=>p.photoId).length||eligible.length
 const {categories,collection,favoritesOnly}=useTemplateBrowsing.getState()
 return [...templatesForCount(count,project.enabledTemplateIds,filter,aspect),...importedDesignTemplates(count,project.enabledTemplateIds,filter,aspect)].filter(t=>(!favoritesOnly||favorites.includes(t.id))&&(kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)&&(kind!=='mixed'||templateCategory(t)!=='reference')&&(categories[templateCategory(t)]||(kind==='mixed'&&templateCategory(t)==='generated'))&&matchesCollection(t.id,collection,readCollections(),favorites)&&(templateCategory(t)!=='reference'||isFullSpreadTemplate(t)||supportsUniformGap(t.placeholders,aspect,spread.marginPx,spread.gapPx)))
}
