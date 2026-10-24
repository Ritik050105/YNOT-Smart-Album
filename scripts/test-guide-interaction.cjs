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

 // Allow the offscreen renderer to settle layout and pointer updates under build load.
 const wait=()=>new Promise(r=>setTimeout(r,200));await wait();
 const percentText=gap=>{const percent=Math.round((gap-60)/60*10000)/100;return ' · '+(percent===0?'':percent>0?'+':'−')+Math.abs(percent)+'%'};
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
 const applyReleasedGap=async()=>{assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),true,'Released drag keeps the editor open');await evaluate(`document.querySelector('.canvas-gap-editor').requestSubmit()`);await wait()};
 const clickLabel=async()=>{win.webContents.sendInputEvent({type:'mouseMove',...labelPoint});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...labelPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...labelPoint});await wait()};
 await clickLabel();assert.equal(await evaluate(`!!document.querySelector('[aria-label="Canvas spacing gap"]')`),true,'Real canvas label click opens inline editor');
 assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),[true,true],'Empty local history disables both buttons');
 await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'-1');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();assert.equal(await evaluate(`document.querySelector('.canvas-gap-editor [type="submit"]').disabled`),true);
 await evaluate(`document.querySelector('[aria-label="Undo gap change"]').click()`);await wait();assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),[true,false],'Undo to start disables Undo and enables Redo');
 await evaluate(`document.querySelector('[aria-label="Redo gap change"]').click()`);await wait();assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),[false,true],'Redo to latest enables Undo and disables Redo');
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
  if(!cancel){await applyReleasedGap();assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait()}
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
  const history=await evaluate('store.getState().history.length');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:sharedPoint.x+30,y:sharedPoint.y});await wait();await applyReleasedGap();assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
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
  const history=await evaluate('store.getState().history.length');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:sharedPoint.x+30,y:sharedPoint.y});await wait();await applyReleasedGap();assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
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
 for(const cancel of [true,false])for(const fine of [false,true]){
  await evaluate(`store.getState().setGapAnchor('first')`);await openShared();
  await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();
  const anchorPoint=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.findOne('.gap-anchor-candidate-'+spacingIds[1]),p=n.getAbsoluteTransform().point({x:n.width()/2,y:3}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...anchorPoint});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...anchorPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...anchorPoint});await wait();
  const previewBefore=await sharedRects();assert.ok(Math.abs(previewBefore[1].x-230)<.01);
  const point=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.find('.spacing-measurement')[0],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:stage.scaleX()}})()`),modifiers=fine?['shift']:[];
  const history=await evaluate('store.getState().history.length');
  win.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y,modifiers});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:point.x,y:point.y,modifiers});await wait();
  for(let step=1;step<=5;step++){win.webContents.sendInputEvent({type:'mouseMove',x:point.x+step*9,y:point.y,modifiers});await wait();const current=await sharedRects();assert.ok(Math.abs(current[1].x-previewBefore[1].x)<.01,'Anchor stays at its preview position throughout dragging');for(let i=0;i<3;i++){assert.equal(current[i].width,originals[i].width);assert.equal(current[i].height,originals[i].height)}}
  const preview=await sharedRects(),delta=45/point.scale*(fine?.1:1);assert.ok(Math.abs(preview[2].x-previewBefore[2].x-delta)<(fine?.01:6/point.scale+.01),'Drag continues from the live gap, including fine adjustment');assert.ok(Math.abs(preview[1].x-preview[0].x-preview[0].width-(preview[2].x-preview[1].x-preview[1].width))<.01,'All gaps remain equal');
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);assert.equal(await evaluate('store.getState().history.length'),history);
  if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait()}
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:point.x+45,y:point.y});await wait();
  if(cancel){assert.deepEqual(await sharedRects(),originals);assert.equal(await evaluate('store.getState().history.length'),history)}
  else {assert.equal(await evaluate('store.getState().history.length'),history);assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await applyReleasedGap();const committed=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(committed[i].x-preview[i].x)<.01,'Apply commits the full preview');assert.equal(await evaluate('store.getState().history.length'),history+1);await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait()}
 }
 for(const cancel of [true,false]){
  await evaluate(`store.getState().setGapAnchor('first')`);await openShared();
  const history=await evaluate('store.getState().history.length');
  const typeGap=async value=>{await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait()};
  const dragAgain=async()=>{
   const point=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.find('.spacing-measurement')[0],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
   win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});await wait();for(let step=1;step<=4;step++){win.webContents.sendInputEvent({type:'mouseMove',x:point.x+step*7,y:point.y});await wait()}
   const dragging=await sharedRects();const delta=Math.round(((dragging[1].x-dragging[0].x-dragging[0].width-60)/45)*100)/100;assert.equal(await evaluate(`document.querySelector('[aria-label="Live gap change"]').textContent`),(delta===0?'No change · 0 in':(delta>0?'+':'−')+Math.abs(delta)+' in '+(delta>0?'increase':'decrease'))+percentText(dragging[1].x-dragging[0].x-dragging[0].width),'Live drag delta is visible');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:point.x+28,y:point.y});await wait();const released=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(released[i].x-dragging[i].x)<1e-8,'Release preserves full precision');assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),true);assert.equal(await evaluate('store.getState().history.length'),history);return released;
  };
  await typeGap('2');await dragAgain();await typeGap('2.75');const beforeSwitch=await sharedRects();
  const point=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.findOne('.gap-anchor-candidate-'+spacingIds[1]),p=n.getAbsoluteTransform().point({x:n.width()/2,y:3}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
  win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait();const afterSwitch=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(afterSwitch[i].x-beforeSwitch[i].x)<.01);
  await typeGap('3');const beforeLastDrag=await sharedRects();let final=await dragAgain();
  const shortcut=async redo=>{await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').focus()`);const modifiers=redo?['control','shift']:['control'];if(cancel)await evaluate(`document.querySelector('[aria-label="${redo?'Redo gap change':'Undo gap change'}"]').click()`);else{win.webContents.sendInputEvent({type:'keyDown',keyCode:'Z',modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Z',modifiers})}await wait();assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),true,'Local history keeps editor open');assert.equal(await evaluate('store.getState().history.length'),history,'Local history never changes project history')};
  const assertRects=async expected=>{const actual=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i].x-expected[i].x)<1e-8,'Local history restores exact geometry');assert.equal(await evaluate(`document.querySelector('[aria-label="Original gap"]').textContent`),'1.33 in','Original gap stays fixed across Undo/Redo/Reset');const shown=await evaluate(`Number(document.querySelector('[aria-label="Canvas spacing gap"]').value)`);assert.ok(Math.abs(shown-(expected[1].x-expected[0].x-expected[0].width)/45)<=.005001,'Preview value matches the current spacing');const delta=Math.round(((expected[1].x-expected[0].x-expected[0].width-60)/45)*100)/100;assert.equal(await evaluate(`document.querySelector('[aria-label="Gap change from original"]').textContent`),(delta===0?'No change · 0 in':(delta>0?'+':'−')+Math.abs(delta)+' in '+(delta>0?'increase':'decrease'))+percentText(expected[1].x-expected[0].x-expected[0].width),'Change amount follows the preview history')};
  await shortcut(false);await assertRects(beforeLastDrag);
  await shortcut(false);await assertRects(beforeSwitch);
  await shortcut(false);assert.equal(await evaluate('store.getState().gapAnchor'),'first');await assertRects(beforeSwitch);
  await shortcut(true);assert.equal(await evaluate('store.getState().gapAnchor'),await evaluate(`'image:'+spacingIds[1]`));
  await shortcut(true);await assertRects(beforeLastDrag);
  await shortcut(true);await assertRects(final);
  await shortcut(false);await typeGap('3.1');final=await sharedRects();assert.equal(await evaluate(`document.querySelector('[aria-label="Redo gap change"]').disabled`),true,'New changes disable Redo');await shortcut(true);await assertRects(final);
  await evaluate(`document.querySelector('[aria-label="Reset gap preview"]').click()`);await wait();await assertRects(originals);
  assert.equal(await evaluate(`!!document.querySelector('.canvas-gap-editor')`),true,'Reset leaves editor open');assert.equal(await evaluate(`document.querySelector('[aria-label="Reset gap preview"]').disabled`),true,'Reset disables at the original state');assert.equal(await evaluate(`document.querySelector('.canvas-gap-editor [type="submit"]').disabled`),true,'Reset does not create a no-op Apply');
  assert.equal(await evaluate('store.getState().history.length'),history);assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  await shortcut(false);await assertRects(final);assert.equal(await evaluate(`document.querySelector('[aria-label="Reset gap preview"]').disabled`),false,'Undo restores pre-reset editing state');
  await shortcut(true);await assertRects(originals);await shortcut(false);await assertRects(final);
  await typeGap('1');await assertRects(await sharedRects());assert.equal(await evaluate(`document.querySelector('[aria-label="Gap change from original"]').textContent`),'−0.33 in decrease · −25%');await shortcut(false);await assertRects(final);
  const typePercent=async value=>{await evaluate(`const input=document.querySelector('[aria-label="Gap percentage change"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait()};
  const quickPercent=async percent=>{
   const point=await evaluate(`(()=>{const r=document.querySelector('[aria-label="Set gap change to ${percent}%"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
   win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait();
  };
  const configurePresets=async values=>{
   await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Customize presets').click()`);await wait();
   const fill=async values=>{for(let i=0;i<4;i++)await evaluate(`{const n=document.querySelector('[aria-label="Gap preset ${i+1}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(String(values[i]))});n.dispatchEvent(new Event('input',{bubbles:true}))}`);await wait()};
   for(const invalid of [[1,1,2,3],[-101,2,3,4],['',2,3,4]]){await fill(invalid);assert.equal(await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Save presets').disabled`),true)}
   await fill(values);await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Cancel presets').click()`);await wait();await assertRects(final);
   await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Customize presets').click()`);await wait();await fill(values);
   await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Save presets').click()`);await wait();
   assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapPercentPresets`),values);await assertRects(final);assert.equal(await evaluate('store.getState().history.length'),history);
  };
  for(const presets of [[-40,-5,12.5,30],[-25,-10,10,25]]){
   await configurePresets(presets);
  for(const percent of presets){
   await quickPercent(percent);const changed=await sharedRects();assert.ok(Math.abs(changed[1].x-final[1].x)<1e-8,'Quick percentage keeps anchor fixed');for(let i=0;i<3;i++){assert.equal(changed[i].width,originals[i].width);assert.equal(changed[i].height,originals[i].height)}
   assert.ok(Math.abs(changed[1].x-changed[0].x-changed[0].width-60*(1+percent/100))<1e-8);assert.equal(await evaluate(`document.querySelector('[aria-label="Gap percentage change"]').value`),String(percent));assert.equal(await evaluate(`document.querySelector('[aria-label="Set gap change to ${percent}%"]').getAttribute('aria-pressed')`),'true');
   assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await shortcut(false);await assertRects(final);await shortcut(true);await assertRects(changed);await shortcut(false);await assertRects(final);
  }
   if(presets[0]===-40){
    const previous=await sharedRects(),anchor=await evaluate('store.getState().gapAnchor');
    const beforeControls=await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`);
    if(cancel){await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Customize presets').click()`);await wait();}
    const point=await evaluate(`(()=>{const b=Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Restore default presets');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
    win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait();
    assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapPercentPresets`),[-25,-10,10,25]);await assertRects(previous);assert.equal(await evaluate('store.getState().gapAnchor'),anchor);assert.equal(await evaluate('store.getState().history.length'),history);
    assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),beforeControls);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor__percentages button')).map(b=>b.getAttribute('aria-label'))`),[-25,-10,10,25].map(p=>'Set gap change to '+p+'%'));
    assert.equal(await evaluate(`!!document.querySelector('[aria-label="Gap preset 1"]')`),false);
    const presetStep=async redo=>{const point=await evaluate(`(()=>{const b=Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent===${JSON.stringify(redo?'Redo presets':'Undo presets')});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});await wait();};
    for(const redo of [false,true,false,true]){
     await presetStep(redo);const expected=redo?[-25,-10,10,25]:presets;
     assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapPercentPresets`),expected);
     assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor__percentages button')).map(b=>b.getAttribute('aria-label'))`),expected.map(p=>'Set gap change to '+p+'%'));
     await assertRects(previous);assert.equal(await evaluate('store.getState().gapAnchor'),anchor);assert.equal(await evaluate('store.getState().history.length'),history);
     assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),beforeControls);
    }
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent==='Redo presets').disabled`),true);
    await presetStep(false);await configurePresets([-30,-5,15,30]);assert.equal(await evaluate(`Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent==='Redo presets').disabled`),true,'Saving new presets clears only preset redo');
    await presetStep(false);assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapPercentPresets`),presets);
    await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Restore default presets').click()`);await wait();
    await shortcut(true);await shortcut(false);await assertRects(previous);
   }
  }
  for(const percent of [25,-25,-100,12.345]){
   await typePercent(String(percent));const changed=await sharedRects();assert.ok(Math.abs(changed[1].x-final[1].x)<1e-8,'Percentage keeps the chosen anchor fixed');for(let i=0;i<3;i++){assert.equal(changed[i].width,originals[i].width);assert.equal(changed[i].height,originals[i].height)}
   assert.ok(Math.abs(changed[1].x-changed[0].x-changed[0].width-60*(1+percent/100))<1e-8,'Percentage uses unrounded original gap');assert.equal(await evaluate('store.getState().history.length'),history);assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
   await shortcut(false);await assertRects(final);await shortcut(true);await assertRects(changed);assert.equal(await evaluate(`document.querySelector('[aria-label="Gap percentage change"]').value`),String(percent));await shortcut(false);await assertRects(final);
  }
  for(const invalid of ['', '-101','100000']){await typePercent(invalid);assert.equal(await evaluate(`document.querySelector('.canvas-gap-editor [type="submit"]').disabled`),true,'Invalid or oversized percentage cannot apply');assert.equal(await evaluate('store.getState().history.length'),history);await shortcut(false);await assertRects(final)}
  await quickPercent(25);await evaluate(`document.querySelector('[aria-label="Reset gap preview"]').click()`);await wait();await assertRects(originals);assert.equal(await evaluate(`document.querySelector('[aria-label="Gap percentage change"]').value`),'0');await shortcut(false);await shortcut(false);await assertRects(final);
  await quickPercent(cancel?-10:25);final=await sharedRects();
  assert.ok(Math.abs(final[1].x-beforeSwitch[1].x)<.01,'Switched anchor remains fixed across typing and another drag');for(let i=0;i<3;i++){assert.equal(final[i].width,originals[i].width);assert.equal(final[i].height,originals[i].height)}
  assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
  if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait();assert.deepEqual(await sharedRects(),originals);assert.equal(await evaluate('store.getState().history.length'),history)}
  else{await applyReleasedGap();assert.equal(await evaluate('store.getState().history.length'),history+1);const saved=await sharedRects();for(let i=0;i<3;i++)assert.ok(Math.abs(saved[i].x-final[i].x)<1e-8);await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);await evaluate(`store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait()}
 }
 await evaluate(`const state=store.getState(),s=state.project.spreads[0];state.updateSpread(spreadId,{customBoxes:s.customBoxes.map(b=>spacingIds.includes(b.id)?{...b,x:(spacingIds.indexOf(b.id)+1)*.125,width:.125}:b)});state.setGapAnchor('first');state.setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
 const zeroPoint=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.find('.spacing-measurement')[0],p=n.getAbsoluteTransform().point({x:n.width()/2,y:n.height()/2}),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',...zeroPoint});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...zeroPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...zeroPoint});await wait();
 assert.equal(await evaluate(`document.querySelector('[aria-label="Gap change from original"]').textContent`),'No change · 0 in · 0%');
 assert.equal(await evaluate(`document.querySelector('[aria-label="Gap percentage change"]').disabled`),true,'Zero original gap disables percentage input');
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor__percentages button')).every(b=>b.disabled)`),true,'Zero original gap disables presets');
 await evaluate(`const input=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();
 assert.equal(await evaluate(`document.querySelector('[aria-label="Gap change from original"]').textContent`),'+1 in increase · % unavailable from zero');
 await evaluate(`document.querySelector('[aria-label="Reset gap preview"]').click()`);await wait();assert.equal(await evaluate(`document.querySelector('[aria-label="Gap change from original"]').textContent`),'No change · 0 in · 0%');
 await evaluate(`document.querySelector('[aria-label="Canvas spacing gap"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));store.getState().undo();store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),sharedBefore);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor__percentages button')).length`),0,'Closed editor removes quick buttons');
 console.log('Preset Undo/Redo passed: real pointer clicks, saved custom/default restoration, independent spacing history, redo branching and persisted values');
 console.log('Restore default presets passed: persisted defaults, unchanged preview/anchor/project history, intact local Undo/Redo, customization open or closed');
 console.log('Custom presets passed: edit, validation, cancel, persistent save, decimal presets, real clicks and unchanged preview/history on save');
 console.log('Quick percentages passed: real clicks on all presets, live anchored geometry, unchanged sizes, history, Reset, Escape and one Apply/Undo');
 console.log('Percentage input passed: positive/negative/decimal/zero-target values, fixed anchor and sizes, history, Reset, invalid/bounds rejection, Escape and one Apply/Undo');
 console.log('Percentage change passed: signed percentages from unrounded gaps, live dragging, history, Reset and zero-baseline handling');
 console.log('Gap delta passed: positive/negative/zero amounts, live drag indicator, typing, Undo/Redo and Reset');
 console.log('Gap comparison passed: stable original and current preview values through typing, dragging, Undo, Redo and Reset');
 console.log('Reset passed: original spacing after mixed edits, editor stays open, local Undo/Redo, no project mutation, Escape and single Apply/Undo');
 console.log('Local gap history passed: Undo/Redo buttons and disabled states, real Ctrl+Z/Ctrl+Shift+Z, typing/anchor/drag snapshots, exact preview, redo branching, Escape and one project Undo');
 console.log('Persistent gap editor passed: drag/type/switch/drag, full-precision release, fixed anchor, size preservation, whole-session Escape and single Apply/Undo');
 console.log('Switched-anchor dragging passed: preview continuity, fixed anchor, equal gaps, sizes, normal/Shift, Escape, release preview and one Apply/Undo');
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
   assert.equal(await evaluate(`getComputedStyle(document.querySelector('.canvas-gap-editor')).visibility`),'hidden','Dragging hides the editor while preserving its session');
   if(cancel){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'});await wait();assert.ok(await evaluate(`Math.abs(Konva.stages[0].find('Transformer')[0].nodes()[0].${axis}()-${initial})<.01`),'Escape restores preview')}
   win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...end});await wait();
   if(cancel)assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),startProject,'Release after Escape does not commit');
   else {await applyReleasedGap();assert.equal(await evaluate('store.getState().history.length'),history+1,'Apply makes one undo entry');assert.ok(await evaluate(`Math.abs(store.getState().project.spreads[0].customBoxes.find(b=>b.id===dragGapId).${axis}*${axis==='x'?900:450}-${initial+30/point.scale})<1`),'Released gap persisted');await evaluate('store.getState().undo()');await wait();assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),startProject,'Undo restores drag')}
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
 const savedPresets=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`);assert.ok(savedPresets.gapPresetPast.length);
 await evaluate('store.getState().exitDesignerView(true)');await wait();await evaluate(`store.getState().enterDesignerView(spreadId);store.getState().setLayerSelection(spacingIds.map(id=>'image:'+id))`);await wait();
 await evaluate(`void Konva.stages[0].find('.spacing-measurement')[0].fire('click',{evt:new MouseEvent('click')})`);await wait();
 await evaluate(`{const n=document.querySelector('[aria-label="Canvas spacing gap"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'2');n.dispatchEvent(new Event('input',{bubbles:true}))}`);await wait();
 const reopenedPreview=await sharedRects(),reopenedHistory=await evaluate('store.getState().history.length');
 const reopenedControls=await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`);
 for(const redo of [false,true]){
  await evaluate(`Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent===${JSON.stringify(redo?'Redo presets':'Undo presets')}).click()`);await wait();
  assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapPercentPresets`),redo?savedPresets.gapPercentPresets:savedPresets.gapPresetPast.at(-1));
  assert.deepEqual(await sharedRects(),reopenedPreview);assert.equal(await evaluate('store.getState().history.length'),reopenedHistory);
  assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),reopenedControls);
 }
 await evaluate(`Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent==='Undo presets').click()`);await wait();
 const beforeTransfer=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`);
 await evaluate(`window.originalBridge=window.albumStudio;window.albumStudio={...window.albumStudio,isElectron:true,saveFile:async args=>{window.presetExport={name:args.defaultName,text:new TextDecoder().decode(args.data)};return {canceled:false,filePath:'C:/Presets/test.json'}}};Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Export presets').click()`);await wait();
 const exported=await evaluate('presetExport');assert.equal(exported.name,'YNOT-percentage-presets.json');const portable=JSON.parse(exported.text);
 assert.deepEqual(portable,{format:'ynot-gap-presets',version:1,presets:beforeTransfer.gapPercentPresets,past:beforeTransfer.gapPresetPast,future:beforeTransfer.gapPresetFuture});
 const importFile=async text=>{await evaluate(`{const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(text)}],'presets.json',{type:'application/json'}));const input=document.querySelector('[aria-label="Import percentage presets file"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))}`);await wait()};
 const transferred={format:'ynot-gap-presets',version:1,presets:[-45,-15,15,45],past:[[-40,-10,10,40]],future:[[-20,-5,5,20]]};
 for(const text of [JSON.stringify(transferred),exported.text]){
  const beforeImport=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`);
  const expected=JSON.parse(text);await importFile(text);const saved=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`);
  assert.deepEqual(saved,{...beforeTransfer,gapPercentPresets:expected.presets,gapPresetPast:expected.past,gapPresetFuture:expected.future,gapImportPast:saved.gapImportPast,gapImportFuture:[]});
  assert.equal(saved.gapImportPast.length,beforeImport.gapImportPast.length+1);assert.deepEqual(JSON.parse(saved.gapImportPast.at(-1)),{format:'ynot-gap-presets',version:1,presets:beforeImport.gapPercentPresets,past:beforeImport.gapPresetPast,future:beforeImport.gapPresetFuture});
  assert.deepEqual(await sharedRects(),reopenedPreview);assert.equal(await evaluate('store.getState().history.length'),reopenedHistory);assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),reopenedControls);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.canvas-gap-editor__percentages button')).map(b=>b.getAttribute('aria-label'))`),expected.presets.map(p=>'Set gap change to '+p+'%'));
 }
 const importStep=async redo=>{await evaluate(`Array.from(document.querySelectorAll('[aria-label="Import history"] button')).find(b=>b.textContent===${JSON.stringify(redo?'Redo import':'Undo import')}).click()`);await wait()};
 for(const [redo,expected] of [[false,transferred],[false,portable],[true,transferred],[true,portable]]){
  await importStep(redo);const saved=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`);assert.deepEqual([saved.gapPercentPresets,saved.gapPresetPast,saved.gapPresetFuture],[expected.presets,expected.past,expected.future]);
  assert.deepEqual(await sharedRects(),reopenedPreview);assert.equal(await evaluate('store.getState().history.length'),reopenedHistory);assert.deepEqual(await evaluate(`['Undo gap change','Redo gap change','Reset gap preview'].map(label=>document.querySelector('[aria-label="'+label+'"]').disabled)`),reopenedControls);
 }
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('[aria-label="Import history"] button')).find(b=>b.textContent==='Redo import').disabled`),true);
 await importStep(false);await importFile(JSON.stringify({...transferred,presets:[-30,-15,15,30]}));assert.equal(await evaluate(`Array.from(document.querySelectorAll('[aria-label="Import history"] button')).find(b=>b.textContent==='Redo import').disabled`),true,'New import clears only import redo');await importFile(exported.text);
 const sameA={format:'ynot-gap-presets',version:1,presets:[-25,-10,10,25],past:[],future:[[-40,-5,5,40]]},sameB={format:'ynot-gap-presets',version:1,presets:[-40,-5,5,40],past:[[-25,-10,10,25]],future:[]};
 await importFile(JSON.stringify(sameA));await importFile(JSON.stringify(sameB));await evaluate(`Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent==='Undo presets').click()`);await wait();
 const importDepth=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapImportPast.length`);
 await importStep(false);assert.equal(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapImportPast.length`),importDepth-1,'Undo consumes its import entry even when preset Undo already restored the same bundle');
 await importStep(true);assert.equal(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapImportFuture.length`),0);await importFile(exported.text);
 const afterTransfers=await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`);
 console.log('Import Undo/Redo passed: whole preset/history snapshots restored, multiple imports, redo branching, spacing history preserved');
 for(const text of ['broken JSON',JSON.stringify({...portable,version:99}),JSON.stringify({...portable,future:[[1,1,2,3]]})]){await importFile(text);assert.ok(await evaluate(`!!document.querySelector('.canvas-gap-editor [role="alert"]')`));assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences'))`),afterTransfers);assert.deepEqual(await sharedRects(),reopenedPreview)}
 for(const redo of [true,false]){await evaluate(`Array.from(document.querySelectorAll('[aria-label="Preset history"] button')).find(b=>b.textContent===${JSON.stringify(redo?'Redo presets':'Undo presets')}).click()`);await wait();assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('albumstudio.preferences')).gapPercentPresets`),redo?portable.future.at(-1):portable.presets);assert.deepEqual(await sharedRects(),reopenedPreview)}
 await evaluate(`window.albumStudio.saveFile=async()=>({canceled:true});Array.from(document.querySelectorAll('.canvas-gap-editor button')).find(b=>b.textContent==='Export presets').click()`);await wait();assert.ok(await evaluate(`document.querySelector('.canvas-gap-editor').textContent.includes('Export canceled.')`));await evaluate('window.albumStudio=window.originalBridge');
 console.log('Preset transfer UI passed: export payload, import roundtrip and replacement, invalid files, canceled export, imported Redo/Undo, spacing and other preferences untouched');
 console.log('Designer remount passed: saved preset Undo/Redo restored, new spacing preview and history untouched');
 console.log('Spacing snap and Shift passed: both axes, highlighted references, fine movement, modifier transitions and cancellation');
 console.log('Spacing drag passed: real mouse horizontal/vertical dragging, zoom scaling, live preview, Escape cancellation, release preview and Apply/Undo');
 console.log('Live preview passed: visual movement without project changes, Escape/Cancel restoration, single Apply/Undo');
 console.log('Inline spacing passed: real label click, input validation, Escape, Enter, fixed leading frame and single Undo');
 console.log('Equal spacing canvas test passed: real pointer snap, paired gap markers, persistence and cleanup');
 await fs.writeFile(path.join(out,'guides-fixed.png'),(await win.webContents.capturePage()).toPNG());
 console.log('Guide interactions passed: actual pointer drag on both axes at fit zoom, pan-origin clamp, persistence, Undo, visible-guide snapping and hidden-guide exclusion and pointer resize');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
