import {readPsd,Layer} from 'ag-psd'
import {PhotoAsset,PlaceholderRect} from '@/types'

export interface EditedPsdLayer {photo:PhotoAsset;frame:PlaceholderRect;hidden:boolean;opacity:number;groupId?:string}
export function importEditedPsd(bytes:Uint8Array):EditedPsdLayer[]{
 const header=readPsd(bytes,{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true})
 if(header.width*header.height>100000000)throw new Error('PSD is too large for layered return (100 megapixel limit).')
 const psd=readPsd(bytes,{skipCompositeImageData:true,skipThumbnail:true}),layers:EditedPsdLayer[]=[]
 function visit(children:Layer[],hidden=false,opacity=1,groupId?:string){for(const layer of children){
  const invisible=hidden||!!layer.hidden,alpha=opacity*(layer.opacity??1)
  if(layer.children){visit(layer.children,invisible,alpha,crypto.randomUUID());continue}
  if(!layer.canvas||!layer.canvas.width||!layer.canvas.height)continue
  // shortcut: Photoshop text/effects stay in their raster layer appearance; native PSD typography editing stays in Photoshop.
  if(layer.blendMode&&layer.blendMode!=='normal')throw new Error(`Layer "${layer.name??'Untitled'}" uses ${layer.blendMode}. Set its blend mode to Normal in Photoshop before returning it. The YNOT spread was not changed.`)
  const canvas=layer.canvas,width=canvas.width,height=canvas.height,id=crypto.randomUUID()
  layers.push({frame:{id,x:(layer.left??0)/psd.width,y:(layer.top??0)/psd.height,width:width/psd.width,height:height/psd.height,preferredOrientation:'any'},hidden:invisible,opacity:alpha,groupId,
   photo:{id:crypto.randomUUID(),fileName:layer.name??'Photoshop layer',src:canvas.toDataURL('image/png'),width,height,megapixels:width*height/1e6,orientation:width===height?'square':width>height?'landscape':'portrait',mimeType:'image/png',capturedAt:new Date().toISOString(),bins:[],favorite:false}})
 }}visit(psd.children??[])
 if(!layers.length)throw new Error('This PSD has no readable image layers. Save it as a layered PSD in Photoshop.')
 if(layers.length>500)throw new Error('This PSD has more than 500 layers. Reduce the layer count before returning it.')
 return layers
}
