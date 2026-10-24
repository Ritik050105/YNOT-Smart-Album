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

 await evaluate(`for(const [x,w] of [[100,40],[200,60],[330,40]])store.getState().addImageFrame(spreadId,{x:x/900,y:250/450,width:w/900,height:40/450});window.spacingIds=store.getState().project.spreads[0].placements.slice(-3).map(p=>p.placeholderId);store.getState().selectPlaceholder(spacingIds[2])`);await wait();
 const spacingPoint=await evaluate(`(()=>{const s=Konva.stages[0],p=s.getAbsoluteTransform().point({x:350,y:270}),r=s.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:s.scaleX()}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:spacingPoint.x,y:spacingPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:spacingPoint.x,y:spacingPoint.y});await wait();
 for(let i=1;i<=4;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(spacingPoint.x-8*spacingPoint.scale*i/4),y:spacingPoint.y});await wait()}
 assert.ok(await evaluate(`Konva.stages[0].find('.equal-spacing-guide').length>0`),'Real drag shows equal-gap marks');
 assert.ok(await evaluate(`Konva.stages[0].find('.spacing-measurement').every(n=>n.text()==='1.33 in')`),'Measurements use physical inches');
 await fs.writeFile(path.join(out,'equal-spacing.png'),(await win.webContents.capturePage()).toPNG());
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(spacingPoint.x-8*spacingPoint.scale),y:spacingPoint.y});await wait();
 assert.ok(await evaluate(`Math.abs(store.getState().project.spreads[0].customBoxes.find(b=>b.id===spacingIds[2]).x*900-320)<.01`),'Equal spacing persists after drag');assert.ok(await evaluate(`Konva.stages[0].find('.spacing-measurement').length===2&&Konva.stages[0].find('.spacing-measurement').every(n=>n.isListening())`),'Spacing measurements remain clickable after drag');

 for(const [unit,expected] of [['cm','3.39 cm'],['px','400 px']]){
  await evaluate(`store.getState().updateProjectSettings({units:${JSON.stringify(unit)}})`);await wait();await evaluate(`const n=Konva.stages[0].find('Transformer')[0].nodes()[0];n.position({x:322,y:250});n.fire('dragmove',{target:n});undefined`);await wait();assert.ok(await evaluate(`Konva.stages[0].find('.spacing-measurement').length===2&&Konva.stages[0].find('.spacing-measurement').every(n=>n.text()===${JSON.stringify(expected)})`),'Measurement in '+unit);
 }
 await evaluate(`store.getState().updateProjectSettings({units:'in'})`);await wait();

 await evaluate(`const n=Konva.stages[0].find('Transformer')[0].nodes()[0];n.fire('dragend',{target:n});undefined`);await wait();
 const beforeInline=await evaluate('JSON.stringify(store.getState().project.spreads[0])');
 const labelPoint=await evaluate(`(()=>{const s=Konva.stages[0],n=s.find('.spacing-measurement')[1],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=s.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
 const clickLabel=async()=>{win.webContents.sendInputEvent({type:'mouseMove',...labelPoint});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...labelPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...labelPoint});await wait()};
 await clickLabel();assert.equal(await evaluate(`!!document.querySelector('[aria-label="Canvas spacing gap"]')`),true,'Real canvas label click opens inline editor');
 await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'-1');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();assert.equal(await evaluate(`document.querySelector('.canvas-gap-editor [type="submit"]').disabled`),true);
 await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),beforeInline,'Escape does not edit');assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),false);
 await clickLabel();await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();

 assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].x()-350)<.01`),'Typing previews the frame at the new gap');
 assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),beforeInline,'Preview never mutates project data');

 for(const value of ['', '-1', '2000']){
  await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();
  assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].x()-320)<.01&&document.querySelector('.canvas-gap-editor [type="submit"]').disabled`),'Invalid input restores original preview');
 }
 await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();
 for(const cancel of ['Escape','Cancel']){
  if(cancel==='Escape')await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  else await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Cancel').click()`);
  await wait();assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].x()-320)<.01`),cancel+' restores original canvas geometry');assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),beforeInline);
  await clickLabel();await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();
 }
 await fs.writeFile(path.join(out,'inline-gap.png'),(await win.webContents.capturePage()).toPNG());
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'ENTER'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ENTER'});await wait();
 assert.ok(await evaluate(`Math.abs(store.getState().project.spreads[0].customBoxes.find(b=>b.id===spacingIds[2]).x*900-350)<.01`),'Inline 2 inch gap moves following frame to 350');
 assert.ok(await evaluate(`Math.abs(store.getState().project.spreads[0].customBoxes.find(b=>b.id===spacingIds[1]).x*900-200)<.01`),'First frame stays anchored');assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),false);
 await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),beforeInline,'One Undo restores canvas gap edit');


 await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
 const sharedBefore=await evaluate('JSON.stringify(store.getState().project.spreads[0])');
 const sharedPoint=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.find('.spacing-measurement')[0],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:stage.scaleX()}})()`);
 const sharedRects=()=>evaluate(`spacingIds.map(id=>{const r=Konva.stages[0].findOne('.image-layer-'+id).find('Rect')[0];return {x:r.x(),width:r.width(),height:r.height()}})`);
 const originals=await sharedRects();
 const openShared=async()=>{win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x,y:sharedPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:sharedPoint.x,y:sharedPoint.y});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:sharedPoint.x,y:sharedPoint.y});await wait()};
 for(const cancel of [true,false]){
  await openShared();await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();const preview=await sharedRects();
  for(let i=0;i<3;i++){assert.ok(Math.abs(preview[i].x-[100,230,380][i])<.01,'Numeric preview updates every gap');assert.equal(preview[i].width,originals[i].width);assert.equal(preview[i].height,originals[i].height)}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  if(cancel)await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  else {win.webContents.sendInputEvent({type:'keyDown',keyCode:'ENTER'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ENTER'})}
  await wait();if(!cancel){await evaluate('store.getState().undo()');await wait();await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait()}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
 }
 for(const cancel of [true,false]){
  const history=await evaluate('store.getState().history.length');win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x,y:sharedPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:sharedPoint.x,y:sharedPoint.y});await wait();
  const end={x:sharedPoint.x+30,y:sharedPoint.y};for(let i=1;i<=5;i++){win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x+i*6,y:sharedPoint.y});await wait()}
  const preview=await sharedRects();for(let i=0;i<3;i++){assert.ok(Math.abs(preview[i].x-(originals[i].x+i*30/sharedPoint.scale))<.01,'Dragging changes all selected gaps');assert.equal(preview[i].width,originals[i].width);assert.equal(preview[i].height,originals[i].height)}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait()}
  else await fs.writeFile(path.join(out,'shared-gap-preview.png'),(await win.webContents.capturePage()).toPNG());
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...end});await wait();
  if(!cancel){assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait()}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
 }

 for(const anchor of ['center','last']){
  const factor=anchor==='center'?.5:1;await openShared();await evaluate(`const select=document.querySelector('[aria-label="Canvas gap anchor"]');select.value=${JSON.stringify(anchor)};select.dispatchEvent(new Event('change',{bubbles:true}))`);await wait();
  await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();let preview=await sharedRects();
  for(let i=0;i<3;i++){assert.ok(Math.abs(preview[i].x-([100,230,380][i]-60*factor))<.01,anchor+' numeric preview');assert.equal(preview[i].width,originals[i].width)}
  await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x,y:sharedPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:sharedPoint.x,y:sharedPoint.y});await wait();
  for(let i=1;i<=5;i++){win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x+i*6,y:sharedPoint.y});await wait()}
  preview=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(preview[i].x-(originals[i].x+(i-2*factor)*30/sharedPoint.scale))<.01,anchor+' drag preview');
  const history=await evaluate('store.getState().history.length');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:sharedPoint.x+30,y:sharedPoint.y});await wait();assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
 }
 await openShared();await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Pick anchor on canvas').click()`);await wait();
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait();assert.equal(await evaluate('store.getState().pickingGapAnchor'),false);assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
 await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Cancel').click()`);await wait();
 for(const picked of [0,1,2]){
  await openShared();await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Pick anchor on canvas').click()`);await wait();
  const point=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.findOne('.gap-anchor-candidate-'+spacingIds[${picked}]),p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait();
  assert.equal(await evaluate('store.getState().gapAnchor'),await evaluate(`'image:'+spacingIds[${picked}]`));assert.equal(await evaluate('store.getState().selectedLayerKeys.length'),3);
  await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();const preview=await sharedRects();
  for(let i=0;i<3;i++){assert.ok(Math.abs(preview[i].x-([100,230,380][i]-30*picked))<.01,'Picked anchor numeric preview');assert.equal(preview[i].width,originals[i].width);assert.equal(preview[i].height,originals[i].height)}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait();assert.deepEqual(await sharedRects(),originals);
  win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x,y:sharedPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:sharedPoint.x,y:sharedPoint.y});await wait();
  for(let i=1;i<=5;i++){win.webContents.sendInputEvent({type:'mouseMove',x:sharedPoint.x+i*6,y:sharedPoint.y});await wait()}
  const dragged=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(dragged[i].x-(originals[i].x+(i-picked)*30/sharedPoint.scale))<.01,'Picked anchor drag preview');
  const history=await evaluate('store.getState().history.length');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:sharedPoint.x+30,y:sharedPoint.y});await wait();assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
 }
 for(const cancel of [true,false]){
  await evaluate(`store.getState().setGapAnchor('first')`);await openShared();
  const inputGap=async value=>{await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait()};
  const clickAnchor=async index=>{
   const previous=await sharedRects();
   const point=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.findOne('.gap-anchor-candidate-'+spacingIds[${index}]),p=n.getAbsoluteTransform().point({x:n.width()/2,y:3}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
   win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait();
   assert.equal(await evaluate('store.getState().gapAnchor'),await evaluate(`'image:'+spacingIds[${index}]`));
   const next=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(next[i].x-previous[i].x)<.01,'Switch preserves the visible preview');
   assert.equal(await evaluate(`Konva.stages[0].find('.fixed-anchor-badge').length`),1,'One clear fixed-anchor badge');
   assert.equal(await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').value`),index===1?'2':'2.2');
  };
  await inputGap('2');await clickAnchor(1);await inputGap('2.2');let preview=await sharedRects();assert.ok(Math.abs(preview[1].x-230)<.01,'New anchor keeps its preview position');
  await clickAnchor(0);await inputGap('2.4');preview=await sharedRects();for(let i=0;i<3;i++){assert.ok(Math.abs(preview[i].x-[91,239,407][i])<.01);assert.equal(preview[i].width,originals[i].width);assert.equal(preview[i].height,originals[i].height)}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait();assert.deepEqual(await sharedRects(),originals)}
  else {await fs.writeFile(path.join(out,'anchor-switch-preview.png'),(await win.webContents.capturePage()).toPNG());const history=await evaluate('store.getState().history.length');await evaluate(`document.querySelector('.canvas-gap-editor').requestSubmit()`);await wait();assert.equal(await evaluate('store.getState().history.length'),history+1);const saved=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(saved[i].x-preview[i].x)<.01,'Apply commits the visible preview');await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait()}
 }
 console.log('Anchor switching passed: direct clicks during preview, stable positions/value/sizes, badge, canvas Escape, Apply and single Undo');
 console.log('Picked anchors passed: actual canvas clicks, first/interior/last, typed and dragged preview, preserved sizes, Escape and Undo');
 await evaluate(`store.getState().setGapAnchor('first')`);await wait();
 console.log('Anchor UI passed: center/last inline choice, numeric/drag preview, unchanged sizes, Escape and single Undo');
 await evaluate(`store.getState().selectPlaceholder(spacingIds[2])`);await wait();
 console.log('Shared gap editing passed: real label clicks/drags, all gaps preview together, unchanged element sizes, Escape and one-step Undo');
 for(const axis of ['x','y']){
  if(axis==='y'){await evaluate(`for(const [y,h] of [[100,30],[180,40],[270,30]])store.getState().addImageFrame(spreadId,{x:600/900,y:y/450,width:40/900,height:h/450});window.dragGapId=store.getState().project.spreads[0].placements.at(-1).placeholderId;store.getState().selectPlaceholder(dragGapId)`);await wait()}
  else await evaluate(`window.dragGapId=spacingIds[2]`);
  const startProject=await evaluate('JSON.stringify(store.getState().project.spreads[0])'),history=await evaluate('store.getState().history.length');
  const point=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.find('.spacing-measurement')[1],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:stage.scaleX()}})()`);
  const initial=axis==='x'?320:270;
  for(const cancel of [true,false]){
   win.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:point.x,y:point.y});await wait();
   const end={x:point.x+(axis==='x'?30:0),y:point.y+(axis==='y'?30:0)};
   for(let i=1;i<=5;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(point.x+(end.x-point.x)*i/5),y:Math.round(point.y+(end.y-point.y)*i/5)});await wait()}
   assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].${axis}()-${initial+30/point.scale})<1`),'Label drag previews '+axis);
   assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),startProject,'Drag preview leaves project unchanged');assert.equal(await evaluate('store.getState().history.length'),history);
   assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),false,'Dragging does not open numeric editor');
   if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait();assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].${axis}()-${initial})<.01`),'Escape restores preview')}
   win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...end});await wait();
   if(cancel)assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),startProject,'Release after Escape does not commit');
   else {assert.equal(await evaluate('store.getState().history.length'),history+1,'Release makes one undo entry');assert.ok(await evaluate(`Math.abs(store.getState().project.spreads[0].customBoxes.find(b=>b.id===dragGapId).${axis}*${axis==='x'?900:450}-${initial+30/point.scale})<1`),'Released gap persisted');await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),startProject,'Undo restores drag')}
  }
  for(const fine of [false,true]){
   if(fine)win.webContents.sendInputEvent({type:'keyDown',keyCode:'SHIFT'});
   const modifiers=fine?['shift']:[];
   win.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y,modifiers});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:point.x,y:point.y,modifiers});await wait();
   const distance=fine?30:4,end={x:point.x+(axis==='x'?distance:0),y:point.y+(axis==='y'?distance:0)};
   win.webContents.sendInputEvent({type:'mouseMove',...end,modifiers});await wait();
   const expected=fine?initial+3/point.scale:initial;
   assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].${axis}()-${expected})<.01`),fine?'Shift uses one tenth movement without snap':'Drag snaps to reference gap');
   if(!fine)assert.equal(await evaluate(`Konva.stages[0].find('.spacing-measurement').length`),2,'Matching reference gap is highlighted');
   if(fine){
    win.webContents.sendInputEvent({type:'keyUp',keyCode:'SHIFT'});await wait();assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].${axis}()-${expected})<.01`),'Releasing Shift does not jump');
    end[axis]+=20;win.webContents.sendInputEvent({type:'mouseMove',...end});await wait();assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].${axis}()-${initial+23/point.scale})<.01`),'Normal speed resumes incrementally');
   }
   win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...end});await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),startProject,'Fine/snap drag cancels cleanly');
  }
 }

 await evaluate(`for(const y of [350,420])store.getState().addImageFrame(spreadId,{x:600/900,y:y/450,width:40/900,height:10/450});store.getState().selectPlaceholder(dragGapId)`);await wait();
 const snapPoint=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.find('.spacing-measurement')[1],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:stage.scaleX()}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:snapPoint.x,y:snapPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:snapPoint.x,y:snapPoint.y});await wait();
 const snapEnd={x:snapPoint.x,y:snapPoint.y+Math.round(10*snapPoint.scale)+2};win.webContents.sendInputEvent({type:'mouseMove',...snapEnd});await wait();assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].y()-280)<.01`),'Gap snaps from 50 to nearby 60 design-pixel spacing');
 await fs.writeFile(path.join(out,'gap-snapping.png'),(await win.webContents.capturePage()).toPNG());
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...snapEnd});await wait();
 console.log('Spacing snap and Shift passed: both axes, highlighted references, fine movement, modifier transitions and cancellation');
 console.log('Spacing drag passed: real mouse horizontal/vertical dragging, zoom scaling, live preview, Escape cancellation, release commit and Undo');
 console.log('Live preview passed: visual movement without project changes, Escape/Cancel restoration, single Apply/Undo');
 console.log('Inline spacing passed: real label click, input validation, Escape, Enter, fixed leading frame and single Undo');
 console.log('Equal spacing canvas test passed: real pointer snap, paired gap markers, persistence and cleanup');
 await fs.writeFile(path.join(out,'guides-fixed.png'),(await win.webContents.capturePage()).toPNG());
 console.log('Guide interactions passed: actual pointer drag on both axes at fit zoom, pan-origin clamp, persistence, Undo, visible-guide snapping and hidden-guide exclusion and pointer resize');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
