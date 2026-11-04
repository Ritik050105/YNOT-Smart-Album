import {TextBox,TextEffect,TextEffectName} from '@/types'
import {effectDefault} from './blendingEffects'
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function copy(source:HTMLCanvasElement){const c=canvas(source.width,source.height);c.getContext('2d')!.drawImage(source,0,0);return c}
function tint(source:HTMLCanvasElement,color:string){const c=copy(source),k=c.getContext('2d')!;k.globalCompositeOperation='source-in';k.fillStyle=color;k.fillRect(0,0,c.width,c.height);return c}
function combine(a:HTMLCanvasElement,b:HTMLCanvasElement,op:GlobalCompositeOperation,x=0,y=0){const c=copy(a),k=c.getContext('2d')!;k.globalCompositeOperation=op;k.drawImage(b,x,y);return c}
function blur(source:HTMLCanvasElement,r:number){if(r<=0)return copy(source);const c=canvas(source.width,source.height),k=c.getContext('2d')!;k.filter=`blur(${r}px)`;k.drawImage(source,0,0);return c}
function expand(source:HTMLCanvasElement,r:number){if(r<=0)return copy(source);const c=copy(source),k=c.getContext('2d')!;for(let i=0;i<32;i++){const a=i*Math.PI/16;k.drawImage(source,Math.cos(a)*r,Math.sin(a)*r)}return c}
function inverse(source:HTMLCanvasElement){const c=canvas(source.width,source.height),k=c.getContext('2d')!;k.fillRect(0,0,c.width,c.height);k.globalCompositeOperation='destination-out';k.drawImage(source,0,0);return c}
function quality(source:HTMLCanvasElement,e:TextEffect){
 if(!e.noise&&!e.jitter&&(e.contour??'linear')==='linear'&&e.antiAlias!==false&&(e.range??50)===50)return source
 const k=source.getContext('2d')!,data=k.getImageData(0,0,source.width,source.height),d=data.data
 for(let i=3;i<d.length;i+=4){let a=d[i]/255;if(!a)continue;a=Math.min(1,a*50/(e.range??50));if(e.contour==='soft')a=a*a*(3-2*a);if(e.contour==='sharp')a=Math.sqrt(a);const n=((Math.imul(i+1,1664525)+1013904223)>>>0)/4294967295;a*=1-n*((e.noise??0)+(e.jitter??0))/200;if(e.antiAlias===false)a=Math.round(a);d[i]=a*255}k.putImageData(data,0,0);return source
}
async function paint(source:HTMLCanvasElement,e:TextEffect,pad:number,w:number,h:number,scale:number,kind='color'){
 if(kind==='color')return tint(source,e.color)
 const c=canvas(source.width,source.height),k=c.getContext('2d')!,a=e.angle*Math.PI/180,factor=(e.scale??100)/100
 if(kind==='gradient'){
  const cx=pad+w/2+(e.offsetX??0)*w/100,cy=pad+h/2+(e.offsetY??0)*h/100,r=Math.max(1,(Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*h)*factor/2)
  let g:CanvasGradient
  if(e.gradientStyle==='radial')g=k.createRadialGradient(cx,cy,0,cx,cy,r)
  else if(e.gradientStyle==='angle')g=k.createConicGradient(a,cx,cy)
  else g=k.createLinearGradient(cx-Math.cos(a)*r,cy-Math.sin(a)*r,cx+Math.cos(a)*r,cy+Math.sin(a)*r)
  const start=e.reverse?e.color2??'#fff':e.color,end=e.reverse?e.color:e.color2??'#fff'
  g.addColorStop(0,start);if(e.gradientStyle==='reflected'){g.addColorStop(.5,end);g.addColorStop(1,start)}else g.addColorStop(1,end)
  if(e.gradientStyle==='diamond'){
   const rgb=(color:string)=>{const hex=color.replace('#','');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16))},s=rgb(start),t=rgb(end),image=k.createImageData(c.width,c.height)
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const dx=x-cx,dy=y-cy,v=Math.min(1,(Math.abs(dx*Math.cos(a)+dy*Math.sin(a))+Math.abs(-dx*Math.sin(a)+dy*Math.cos(a)))/r),i=(y*c.width+x)*4;for(let j=0;j<3;j++)image.data[i+j]=s[j]*(1-v)+t[j]*v;image.data[i+3]=255}k.putImageData(image,0,0)
  }else{k.fillStyle=g;k.fillRect(0,0,c.width,c.height)}
  if(e.dither){const data=k.getImageData(0,0,c.width,c.height);for(let i=0;i<data.data.length;i+=4){const n=(i%12)/4-1;for(let j=0;j<3;j++)data.data[i+j]+=n}k.putImageData(data,0,0)}
 }else{
  let tile:CanvasImageSource
  if(e.patternSrc){tile=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Invalid pattern image'));img.src=e.patternSrc!})}
  else {const t=canvas(32,32),q=t.getContext('2d')!;q.fillStyle=e.color2??'#fff';q.fillRect(0,0,32,32);q.fillStyle=e.color;if(e.pattern==='dots'){q.beginPath();q.arc(16,16,5,0,Math.PI*2);q.fill()}else if(e.pattern==='checker'){q.fillRect(0,0,16,16);q.fillRect(16,16,16,16)}else q.fillRect(0,0,8,32);tile=t}
  const p=k.createPattern(tile,'repeat')!;const tileScale=Math.max(.01,(e.size||12)*scale/32*factor);p.setTransform(new DOMMatrix().translate(pad+(e.offsetX??0)*w/100,pad+(e.offsetY??0)*h/100).rotate(e.angle).scale(tileScale));k.fillStyle=p;k.fillRect(0,0,c.width,c.height)
 }
 k.globalCompositeOperation='destination-in';k.drawImage(source,0,0);return c
}
// shortcut: Canvas masks approximate Photoshop contours and bevel lighting; use a PSD engine for pixel-identical Photoshop output.
export async function drawBlendingEffects(ctx:CanvasRenderingContext2D,mask:HTMLCanvasElement,box:TextBox,pad:number,w:number,h:number,scale:number){
 const get=(name:TextEffectName)=>({...effectDefault(name),...box.effects?.[name]}),draw=(c:HTMLCanvasElement,e:TextEffect)=>{ctx.save();ctx.globalCompositeOperation=e.blendMode??'source-over';ctx.globalAlpha*=e.opacity;ctx.drawImage(c,-pad,-pad);ctx.restore()}
 for(const name of ['dropShadow','outerGlow'] as const){const e=get(name);if(!e.enabled)continue;const radius=e.size*scale,spread=radius*(e.spread??0)/100;let c=blur(expand(mask,spread),Math.max(0,radius-spread)/(e.technique==='precise'?4:2));if(name==='dropShadow'){const shifted=canvas(mask.width,mask.height);shifted.getContext('2d')!.drawImage(c,Math.cos(e.angle*Math.PI/180)*e.distance*scale,Math.sin(e.angle*Math.PI/180)*e.distance*scale);c=shifted;if(e.knockout)c=combine(c,mask,'destination-out')}else c=combine(c,mask,'destination-out');draw(await paint(quality(c,e),e,pad,w,h,scale,name==='outerGlow'?e.fillType:'color'),e)}
 ctx.save();ctx.globalAlpha*=box.fillOpacity??1;ctx.drawImage(mask,-pad,-pad);ctx.restore()
 for(const name of ['colorOverlay','gradientOverlay','patternOverlay','texture','innerShadow','innerGlow','satin','bevel','stroke'] as const){
  const e=get(name);if(!e.enabled)continue;const radius=e.size*scale,a=e.angle*Math.PI/180,dx=Math.cos(a)*e.distance*scale,dy=Math.sin(a)*e.distance*scale
  if(name==='bevel'){
   const amount=radius*(e.depth??100)/100,sign=e.direction==='down'?-1:1,bx=Math.cos(a)*amount*sign,by=Math.sin(a)*amount*sign
   let hi=combine(mask,mask,'destination-out',bx,by),lo=combine(mask,mask,'destination-out',-bx,-by)
   if(e.bevelStyle==='outer'||e.bevelStyle==='emboss'||e.bevelStyle==='pillow'){const rim=combine(expand(mask,radius),mask,'destination-out');if(e.bevelStyle==='outer'){hi=combine(rim,mask,'destination-in',bx,by);lo=combine(rim,mask,'destination-in',-bx,-by)}else{hi=combine(hi,combine(rim,mask,'destination-in',bx,by),'source-over');lo=combine(lo,combine(rim,mask,'destination-in',-bx,-by),'source-over');if(e.bevelStyle==='pillow')[hi,lo]=[lo,hi]}}
   const softness=((e.soften??0)+(e.technique==='chisel-hard'?0:e.technique==='chisel-soft'?.5:1))*scale,light=Math.sin((e.altitude??30)*Math.PI/180)
   draw(tint(quality(blur(hi,softness),e),e.color),{...e,opacity:(e.highlightOpacity??.5)*light,blendMode:e.highlightMode??'screen'});draw(tint(quality(blur(lo,softness),e),e.color2??'#000'),{...e,opacity:(e.shadowOpacity??.5)*(1-light/2),blendMode:e.shadowMode??'multiply'});continue
  }
  let c=copy(mask),kind='color'
  if(name==='stroke'){
   const position=e.position??'outside',r=position==='center'?radius/2:radius
   const outer=combine(expand(mask,r),mask,'destination-out'),inner=combine(mask,expand(inverse(mask),r),'destination-in');c=position==='inside'?inner:position==='outside'?outer:combine(outer,inner,'source-over');kind=e.fillType??'color'
  }else if(name==='innerShadow'){
   const holes=expand(inverse(mask),radius*(e.spread??0)/100);c=combine(mask,blur(holes,radius/2),'destination-in',dx,dy)
  }else if(name==='innerGlow'){
   c=combine(mask,blur(expand(inverse(mask),radius*(e.spread??0)/100),radius/(e.technique==='precise'?4:2)),'destination-in');if(e.source==='center')c=combine(mask,c,'destination-out');kind=e.fillType??'color'
  }else if(name==='satin'){
   const shifted=canvas(mask.width,mask.height),k=shifted.getContext('2d')!;k.drawImage(mask,dx,dy);k.globalCompositeOperation='xor';k.drawImage(mask,-dx,-dy);c=combine(mask,blur(shifted,radius/2),e.invert?'destination-out':'destination-in')
  }else if(name==='gradientOverlay')kind='gradient'
  else if(name==='patternOverlay'||name==='texture')kind='pattern'
  draw(await paint(quality(c,e),e,pad,w,h,scale,kind),e)
 }
}
