import {readPsd,Layer} from 'ag-psd'
import {TextBox} from '@/types'
import {imageFileSource,isImageFile,MAX_ARTWORK_BYTES,MAX_ARTWORK_LABEL,MAX_ARTWORK_PIXELS} from './imageSource'

export async function importTemplateArtwork(file:File):Promise<TextBox[]>{
 if(!isImageFile(file)||file.size>MAX_ARTWORK_BYTES)throw new Error(`Choose an image or PSD up to ${MAX_ARTWORK_LABEL}.`)
 const groupId=crypto.randomUUID()
 if(/\.psd$/i.test(file.name)){
  const bytes=await file.arrayBuffer(),header=readPsd(bytes,{skipThumbnail:true,skipLayerImageData:true,skipCompositeImageData:true})
  if(!header.width||!header.height||header.width*header.height>MAX_ARTWORK_PIXELS)throw new Error('PSD dimensions are too large.')
  const psd=readPsd(bytes,{skipThumbnail:true})
  const boxes:TextBox[]=[]
  function visit(layers:Layer[]){for(const layer of layers){if(layer.hidden)continue;if(layer.children){visit(layer.children);continue}if(!layer.canvas)continue
   const x=layer.left??0,y=layer.top??0,w=(layer.right??x)-x,h=(layer.bottom??y)-y;if(w<=0||h<=0)continue
   const t=layer.text,style=t?.style,text=t?.text??'',fontFamily=style?.font?.name??'Arial',fontSize=Math.max(1,Math.min(1000,(style?.fontSize??30)*900/psd.width)),color='#222222',bold=!!style?.fauxBold,italic=!!style?.fauxItalic
   boxes.push({id:crypto.randomUUID(),groupId,text,fontFamily,fontSize,color,bold,italic,align:'left',autoWidth:false,x:x/psd.width,y:y/psd.height,width:w/psd.width,height:h/psd.height,sourceArtwork:{src:layer.canvas.toDataURL('image/png'),fontRatio:fontSize/(w/psd.width*900),text,fontFamily,color,bold,italic}})
  }}visit(psd.children??[]);if(boxes.length)return boxes
 }
 const source=await imageFileSource(file)
 try{const image=new Image();image.src=source;await image.decode();if(image.width*image.height>MAX_ARTWORK_PIXELS)throw new Error('Image dimensions are too large.');const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d')!.drawImage(image,0,0);const src=canvas.toDataURL('image/png');return [{id:crypto.randomUUID(),groupId,text:'',fontFamily:'Arial',fontSize:30,color:'#222222',bold:false,italic:false,align:'left',autoWidth:false,x:0,y:0,width:1,height:1,sourceArtwork:{src,fontRatio:30/900,text:'',fontFamily:'Arial',color:'#222222',bold:false,italic:false}}]}
 finally{if(source.startsWith('blob:'))URL.revokeObjectURL(source)}
}
