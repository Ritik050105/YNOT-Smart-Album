import {effectPadding} from '@/engine/blendingEffects'
import {forwardRef,useEffect,useState} from 'react'
import {Text,KonvaNodeEvents} from 'react-konva'
import Konva from 'konva'
import {TextBox} from '@/types'
import {drawTextBox} from '@/engine/renderSpread'
export default forwardRef<Konva.Text,Konva.TextConfig & KonvaNodeEvents & {box:TextBox}>(function StyledText({box:rawBox,...props},ref){
 const box=rawBox as TextBox
 const [liveSize,setLiveSize]=useState<{width:number;height:number;fontSize:number}|null>(null)
 useEffect(()=>setLiveSize(null),[box])
 const [texture,setTexture]=useState<{canvas:HTMLCanvasElement;pad:number}|null>(null)
 useEffect(()=>{let live=true;const canvas=document.createElement('canvas'),pad=Math.ceil(Math.max((box.shape?box.shapeStrokeWidth??2:box.fontSize*3),effectPadding(box.effects))),w=liveSize?.width??Number(props.width),h=liveSize?.height??Number(props.height);canvas.width=Math.ceil(w+pad*2);canvas.height=Math.ceil(h+pad*2);void drawTextBox(canvas.getContext('2d')!,{...box,fontSize:liveSize?.fontSize??box.fontSize,x:pad/900,y:pad/900,width:w/900,height:h/900,rotationDeg:0,blendMode:'source-over',fontFamily:String(props.fontFamily??box.fontFamily)},900,900).then(()=>{if(live)setTexture({canvas,pad})});return()=>{live=false}},[box,props.width,props.height,props.fontFamily,liveSize])
 return <Text {...props} ref={ref} onTransform={e=>{props.onTransform?.(e);const node=e.target as Konva.Text;setLiveSize({width:node.width(),height:node.height(),fontSize:node.fontSize()})}} globalCompositeOperation={box.blendMode??'source-over'} sceneFunc={(context,node)=>{if(texture){context.save();context.scale(node.width()/(liveSize?.width??Number(props.width)),node.height()/(liveSize?.height??Number(props.height)));context.drawImage(texture.canvas,-texture.pad,-texture.pad,texture.canvas.width,texture.canvas.height);context.restore()}}} hitFunc={(context,node)=>{context.beginPath();context.rect(0,0,node.width(),node.height());context.closePath();context.fillStrokeShape(node)}}/>
})
