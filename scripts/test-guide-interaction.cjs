const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-guide-interaction-qa');await fs.mkdir(out,{recursive:true})
 const source=`import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.png':'dataurl','.icc':'dataurl'}})
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text)
 for(const name of ['app','editor'])await fs.copyFile(`src/styles/${name}.css`,path.join(out,`${name}.css`))
 await fs.writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
 const win=new BrowserWindow({show:false,frame:false,width:1600,height:900,webPreferences:{offscreen:true}})
 win.webContents.on('console-message',(_,level,message)=>{if(level===3)console.error(message)});await win.loadFile(path.join(out,'index.html'));const evaluate=async code=>{try{return await win.webContents.executeJavaScript(`(()=>eval(${JSON.stringify(code)}))()`)}catch(e){console.error(code);throw e}}
 await new Promise(r=>setTimeout(r,200));await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`)

 const wait=()=>new Promise(r=>setTimeout(r,100));await wait();
 await evaluate(`store.getState().addBlankSpread();window.spreadId=store.getState().project.spreads[0].id;store.getState().enterDesignerView(spreadId);store.setState({showGuides:true});store.getState().addGuide(spreadId,'vertical',.3);store.getState().addGuide(spreadId,'horizontal',.35)`);await wait();
 // Use real pointer dragging, including a nonzero stage origin and zoom.
 for(const axis of ['vertical','horizontal']){
  const point=await evaluate(`(()=>{const stage=Konva.stages[0],line=stage.findOne('.manual-guide-${axis}'),p=line.getAbsoluteTransform().point(${axis==='vertical'?'{x:0,y:100}':'{x:120,y:0}'}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:stage.scaleX(),before:store.getState().project.spreads[0].guides.${axis}[0]}})()`);
  const target={x:point.x+(axis==='vertical'?50:0),y:point.y+(axis==='horizontal'?35:0)};
  win.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:point.x,y:point.y});await wait();
  for(let step=1;step<=5;step++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(point.x+(target.x-point.x)*step/5),y:Math.round(point.y+(target.y-point.y)*step/5)});await wait()}
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...target});await wait();
  const saved=await evaluate(`store.getState().project.spreads[0].guides.${axis}[0]`),expected=point.before+(axis==='vertical'?50/900:35/450)/point.scale;
  assert.ok(Math.abs(saved-expected)<.004,`${axis}: expected ${expected}, got ${saved}`);
  const bounds=await evaluate(`(()=>{const s=Konva.stages[0],n=s.findOne('.manual-guide-${axis}');return {position:n.${axis==='vertical'?'x':'y'}(),points:n.points(),bound:n.dragBoundFunc()({x:-9999,y:-9999}),origin:s.position()}})()`);
  assert.ok(Math.abs(bounds.position-saved*(axis==='vertical'?900:450))<.01);
  assert.deepEqual(bounds.bound,bounds.origin,'Guide clamps at page origin in screen coordinates');
  await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate(`store.getState().project.spreads[0].guides.${axis}[0]`),point.before);
 }
 await evaluate(`store.getState().addImageFrame(spreadId,{x:.1,y:.1,width:.12,height:.12});window.frameId=store.getState().project.spreads[0].placements.at(-1).placeholderId;store.getState().selectPlaceholder(frameId)`);await wait();
 await evaluate(`window.node=Konva.stages[0].find('Transformer')[0].nodes()[0];node.position({x:272,y:70});node.fire('dragmove',{target:node});undefined`);await wait();assert.equal(await evaluate('node.x()'),270,'Frame snaps to visible manual guide');
 await evaluate(`node.fire('dragend',{target:node});store.getState().toggleGuides()`);await wait();
 await evaluate(`node.position({x:272,y:70});node.fire('dragmove',{target:node});undefined`);await wait();assert.equal(await evaluate('node.x()'),272,'Hidden manual guides do not attract frames');
 await evaluate(`node.fire('dragend',{target:node});undefined`);await wait();
 assert.equal(await evaluate(`Konva.stages[0].find('.smart-guides').flatMap(g=>g.find('Line')).length`),0);

 await evaluate(`store.getState().toggleGuides();store.getState().addGuide(spreadId,'vertical',.6)`);await wait();
 const resize=await evaluate(`(()=>{const s=Konva.stages[0],t=s.find('Transformer')[0],anchor=t.findOne('.middle-right'),p=anchor.getAbsolutePosition(),r=s.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),target:Math.round(r.x+s.x()+540*s.scaleX()-2)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:resize.x,y:resize.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:resize.x,y:resize.y});await wait();
 for(let i=1;i<=8;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(resize.x+(resize.target-resize.x)*i/8),y:resize.y});await wait()}
 assert.ok(await evaluate(`Konva.stages[0].find('.smart-guides').flatMap(g=>g.find('Line')).length>0`),'Resize shows alignment guides');
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:resize.target,y:resize.y});await wait();
 assert.ok(await evaluate(`Math.abs((store.getState().project.spreads[0].customBoxes.at(-1).x+store.getState().project.spreads[0].customBoxes.at(-1).width)*900-540)<1`),'Resize edge persists at guide');
 await fs.writeFile(path.join(out,'guides-fixed.png'),(await win.webContents.capturePage()).toPNG());
 console.log('Guide interactions passed: actual pointer drag on both axes at fit zoom, pan-origin clamp, persistence, Undo, visible-guide snapping and hidden-guide exclusion and pointer resize');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
