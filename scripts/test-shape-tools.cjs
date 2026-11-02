const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-editor-update-qa');await fs.mkdir(out,{recursive:true})
 const source=`window.confirm=()=>true;import {rotateTextAroundCenter} from './src/engine/textRotation';window.rotateTextAroundCenter=rotateTextAroundCenter;import {setPhotoDragPreview} from './src/engine/photoDrag';window.setPhotoDragPreview=setPhotoDragPreview;import Preferences from './src/components/Preferences';import{applyTheme}from'./src/engine/theme';window.applyTheme=applyTheme;window.showPrefs=()=>{const d=document.createElement('div');document.body.append(d);const r=createRoot(d);r.render(<Preferences onClose={()=>{r.unmount();d.remove()}}/>)};import {computePlaceholderBoxes} from './src/engine/layoutMath';window.computePlaceholderBoxes=computePlaceholderBoxes;import {parseTemplateTransfer} from './src/engine/templateTransfer';import {resolveTemplateFrames} from './src/engine/templateLayout';import {drawPlacement,drawTextBox} from './src/engine/renderSpread';window.qa={parseTemplateTransfer,resolveTemplateFrames,drawPlacement,drawTextBox};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;localStorage.setItem('--inspector-width','320');localStorage.setItem('--timeline-height','150');localStorage.setItem('ynot.dockHeight','240');store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.ttf':'dataurl','.png':'dataurl','.icc':'dataurl'}})
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text)
 for(const name of ['app','editor'])await fs.writeFile(path.join(out,`${name}.css`),(await fs.readFile(`src/styles/${name}.css`,'utf8')).replace('../assets/BankGothic.ttf','BankGothic.ttf'));await fs.copyFile('src/assets/BankGothic.ttf',path.join(out,'BankGothic.ttf'))
 await fs.writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
 const win=new BrowserWindow({show:false,frame:false,width:1600,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}})
 win.webContents.on('console-message',(_,level,message)=>{if(level===3)console.error(message)});await win.loadFile(path.join(out,'index.html'));const evaluate=async code=>{try{return await win.webContents.executeJavaScript(`(()=>eval(${JSON.stringify(code)}))()`)}catch(e){console.error(code);throw e}}
 await new Promise(r=>setTimeout(r,200));await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`)

 // Allow the offscreen renderer to settle layout and pointer updates under build load.
 const wait=()=>new Promise(r=>setTimeout(r,200));await wait();


 await evaluate(`const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,300,400);ctx.fillStyle='blue';ctx.fillRect(300,0,300,400);window.src=c.toDataURL();store.setState({project:{...store.getState().project,photos:['a','b','c'].map(id=>({id,fileName:id+'.png',src,width:600,height:400,orientation:'landscape',bins:[],favorite:false}))},bottomPanelOpen:true,rightPanelOpen:true});store.getState().insertTimelinePhotos(['a','b'],null);window.id=store.getState().project.spreads[0].id;store.getState().selectSpread(id)`);await wait();




 await evaluate(`store.getState().enterDesignerView(id)`);await wait();
 for(const [title,kind,mode] of [['Shape with fill and stroke','rectangle','both'],['Shape with stroke only','rectangle','stroke'],['Shape with fill and stroke','circle','both'],['Shape with stroke only','triangle','stroke'],['Line · draw in any direction','line','stroke']]){
  if(kind==='circle'||kind==='triangle'){
   await evaluate(`document.querySelector('[aria-label="${title}"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:80,clientY:120}))`);await wait();
   await evaluate(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(b=>b.textContent.toLowerCase().includes('${kind}')).click()`);await wait();
   assert.equal(await evaluate(`store.getState().drawingShape`),kind);
  }
  await evaluate(`document.querySelector('[aria-label="${title}"]').click()`);await wait();
  const pts=await evaluate(`(()=>{const s=Konva.stages.find(s=>s.container().isConnected),r=s.container().getBoundingClientRect();return {x:Math.round(r.x+(s.x()+200*s.scaleX())*r.width/s.width()),y:Math.round(r.y+(s.y()+120*s.scaleY())*r.height/s.height()),dx:Math.round(100*s.scaleX()*r.width/s.width()),dy:Math.round(70*s.scaleY()*r.height/s.height())}})()`);
  for(const k of ['x','y','dx','dy'])pts[k]=Math.round(pts[k]*win.webContents.getZoomFactor());win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:pts.x,y:pts.y});await wait();win.webContents.sendInputEvent({type:'mouseMove',x:pts.x+pts.dx,y:pts.y+pts.dy});await wait();win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:pts.x+pts.dx,y:pts.y+pts.dy});await wait();

  const b=await evaluate(`store.getState().project.spreads[0].textBoxes.at(-1)`);assert.equal(b.shape,kind);assert.equal(b.shapeMode,mode);if(kind==='line')assert.ok(b.rotationDeg>20&&b.rotationDeg<60);
 }
 const pixels=await evaluate(`(async()=>{const results=[];for(const shape of ['circle','triangle']){const c=document.createElement('canvas');c.width=100;c.height=100;const ctx=c.getContext('2d');await qa.drawTextBox(ctx,{...store.getState().project.spreads[0].textBoxes[0],shape,shapeMode:'fill',rotationDeg:0,x:0,y:0,width:1,height:1},100,100);results.push([ctx.getImageData(50,50,1,1).data[3],ctx.getImageData(0,0,1,1).data[3]])}return results})()`);assert.deepEqual(pixels,[[255,0],[255,0]],'Export retains curved/triangular silhouettes');
 assert.ok(await evaluate(`Konva.stages.find(s=>s.container().isConnected).find('Transformer').some(t=>t.anchorCornerRadius()>0&&t.anchorFill()===t.anchorStroke())`));
 const center=await evaluate(`(()=>{const b=store.getState().project.spreads[0].textBoxes[0],aspect=2;const before={x:b.x+b.width/2,y:b.y+b.height/2};const p=rotateTextAroundCenter(b,90,aspect);return {before,after:{x:p.x-b.height/(2*aspect),y:p.y+b.width*aspect/2}}})()`);assert.ok(Math.abs(center.before.x-center.after.x)<1e-6);assert.ok(Math.abs(center.before.y-center.after.y)<1e-6);
 const strokes=await evaluate(`(async()=>{const counts=[];for(const style of ['solid','dashed','dotted']){const c=document.createElement('canvas');c.width=900;c.height=80;await qa.drawTextBox(c.getContext('2d'),{...store.getState().project.spreads[0].textBoxes.at(-1),rotationDeg:0,x:0,y:0,width:.8,height:.5,shapeStrokeWidth:4,shapeStrokeStyle:style},900,80);const a=c.getContext('2d').getImageData(0,20,720,1).data;counts.push(Array.from(a).filter((v,i)=>i%4===3&&v>0).length)}return counts})()`);assert.ok(strokes[0]>strokes[1]&&strokes[1]>strokes[2],JSON.stringify(strokes));

 await evaluate(`store.setState({bottomPanelOpen:false,matchingTemplatesOpen:false,fontTemplatesOpen:false})`);win.webContents.setZoomFactor(1);await wait();
 await evaluate(`store.getState().updateImageFrame(id,store.getState().project.spreads[0].placements[0].placeholderId,{x:.2,y:.4,width:.2,height:.4});store.getState().selectPlaceholder(store.getState().project.spreads[0].placements[0].placeholderId)`);await wait();
 const spin=await evaluate(`(()=>{const s=Konva.stages.find(s=>s.container().isConnected),t=s.find('Transformer').find(t=>t.nodes()[0]?.offsetX()>0);if(!t?.rotateEnabled())throw Error('Photo rotation unavailable');const a=t.findOne('.rotater').getAbsolutePosition(),c=t.nodes()[0].getAbsolutePosition(),r=s.container().getBoundingClientRect();return {from:{x:r.x+a.x,y:r.y+a.y},to:{x:r.x+c.x+(a.x-c.x)*.707-(a.y-c.y)*.707,y:r.y+c.y+(a.x-c.x)*.707+(a.y-c.y)*.707}}})()`);
 const z=win.webContents.getZoomFactor();for(const p of [spin.from,spin.to]){p.x=Math.round(p.x*z);p.y=Math.round(p.y*z)}
 win.webContents.sendInputEvent({type:'mouseMove',...spin.from});await wait();win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...spin.from});await wait();win.webContents.sendInputEvent({type:'mouseMove',...spin.to});await wait();win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...spin.to});await wait();

 assert.ok(Math.abs(await evaluate(`store.getState().project.spreads[0].placements[0].rotationDeg`))>10,'Photo rotation saved');
 await evaluate(`store.getState().undo()`);await wait();assert.equal(await evaluate(`store.getState().project.spreads[0].placements[0].rotationDeg`),0);
 await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:go-home'))`);await wait();
 for(const [width,height] of [[1280,720],[1600,900],[1920,1080],[2240,1260],[2560,1440],[4480,2520]]){win.setSize(width,height);await wait();const m=await evaluate(`(()=>{const h=document.querySelector('.home-screen'),r=h.getBoundingClientRect(),logo=document.querySelector('.home-screen__mark img').getBoundingClientRect();return {overflow:h.scrollWidth-h.clientWidth,logo:logo.width,width:r.width}})()`);assert.ok(m.overflow<=1,JSON.stringify({width,height,m}));assert.ok(m.logo>=80)}
 assert.ok(await evaluate(`document.fonts.load('900 28px "YNOT Bank Gothic"').then(f=>f.length>0)`),'Bundled Bank Gothic loads');
 win.setSize(1600,900);await wait();await fs.writeFile(path.join(out,'home-responsive.png'),(await win.webContents.capturePage()).toPNG());

 console.log('PASS: right-click circle/triangle selection, silhouette export, filled/outline/line drawing, rounded filled handles, fixed-center rotation, solid/dashed/dotted export; photo rotate/undo; Home layout at six resolutions; bundled Bank Gothic');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
