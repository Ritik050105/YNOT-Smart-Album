const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-size-move-qa');await fs.mkdir(out,{recursive:true})
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

 await evaluate(`store.getState().addBlankSpread();window.spreadId=store.getState().project.spreads[0].id;store.getState().enterDesignerView(spreadId);store.setState({showPrintGuides:true})`);await wait();
 assert.equal(await evaluate(`Konva.stages[0].find('.center-fold').length`),0,'Blank spread has no fold guide');
 assert.equal(await evaluate(`Konva.stages[0].find('Rect').filter(n=>['#d95339','#9fcb99','#c7b8a2'].includes(n.stroke())).length`),0,'Blank spread has no permanent print or placeholder outlines');
 await fs.writeFile(path.join(out,'empty-spread.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`for(const r of [{x:100,y:60,width:120,height:80},{x:470,y:260,width:118,height:78}])store.getState().addImageFrame(spreadId,{x:r.x/900,y:r.y/450,width:r.width/900,height:r.height/450});window.frameId=store.getState().project.spreads[0].placements.at(-1).placeholderId;const photoCanvas=document.createElement('canvas');photoCanvas.width=80;photoCanvas.height=60;photoCanvas.getContext('2d').fillRect(0,0,80,60);store.setState({project:{...store.getState().project,photos:[{id:'snap-photo',name:'Snap test',src:photoCanvas.toDataURL(),width:80,height:60,orientation:'landscape'}]}});for(const p of store.getState().project.spreads[0].placements.slice(-2))store.getState().setPlacementPhoto(spreadId,p.placeholderId,'snap-photo');store.getState().selectPlaceholder(frameId)`);await wait();
 const handle=await evaluate(`(()=>{const s=Konva.stages[0],t=s.find('Transformer')[0],p=t.findOne('.middle-right').getAbsolutePosition(),r=s.container().getBoundingClientRect();return {x:Math.round(r.x+p.x),y:Math.round(r.y+p.y),scale:s.scaleX()}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:handle.x,y:handle.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:handle.x,y:handle.y});await wait();
 win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(handle.x+2*handle.scale),y:handle.y});await wait();
 assert.ok(await evaluate(`Konva.stages[0].find('.matching-size-guide').length>0`),'Pointer resize shows matching sizes');
 assert.ok(await evaluate(`Konva.stages[0].find('.matching-size-guide').flatMap(g=>g.find('Line')).some(n=>n.stroke()==='#ffcf33')`),'Yellow measurement guide');
 assert.ok(await evaluate(`Konva.stages[0].find('.matching-size-guide').flatMap(g=>g.find('Rect')).some(n=>n.stroke()==='#2583ff')`),'Blue reference outline');
 await fs.writeFile(path.join(out,'matching-size.png'),(await win.webContents.capturePage()).toPNG());
 win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(handle.x+20*handle.scale),y:handle.y});await wait();
 assert.equal(await evaluate(`Konva.stages[0].find('.matching-size-guide').length`),0,'Dragging past snap releases match');
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:Math.round(handle.x+20*handle.scale),y:handle.y});await wait();
 assert.ok(await evaluate(`store.getState().project.spreads[0].customBoxes.at(-1).width*900>126`));
 await evaluate('store.getState().undo()');await wait();assert.ok(await evaluate(`Math.abs(store.getState().project.spreads[0].customBoxes.at(-1).width*900-118)<.01`),'One undo restores original size');
 console.log('PASS: blank spread, pointer size matching, blue/yellow indicators, snap escape and Undo');
 await evaluate(`const c=document.createElement('canvas');c.width=80;c.height=60;c.getContext('2d').fillRect(0,0,80,60);store.setState({project:{...store.getState().project,photos:[...store.getState().project.photos,{id:'move-photo',name:'Move test',src:c.toDataURL(),width:80,height:60,orientation:'landscape'}]}});store.getState().setPlacementPhoto(spreadId,frameId,'move-photo');store.getState().exitDesignerView(true);store.getState().addBlankSpread();window.targetId=store.getState().project.spreads.at(-1).id;store.getState().selectSpread(spreadId)`);await new Promise(r=>setTimeout(r,800));
 const points=await evaluate(`(()=>{const a=document.querySelector('[data-overview-spread="'+spreadId+'"] [data-spread-drag]').getBoundingClientRect(),b=document.querySelector('[data-overview-spread="'+targetId+'"] [data-spread-drag]').getBoundingClientRect();return {x:Math.round(a.left+(470+59)/900*a.width),y:Math.round(a.top+(260+39)/450*a.height),tx:Math.round(Math.min(b.left+b.width/2,document.querySelector('.spreads-panel__row').getBoundingClientRect().right-40)),ty:Math.round(b.top+b.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:points.x,y:points.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:points.x,y:points.y});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:points.x,y:points.y});await wait();assert.equal(await evaluate('store.getState().selectedPlaceholderId'),await evaluate('frameId'),'Overview click selects the photo');
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:points.x,y:points.y});await wait();
 for(let i=1;i<=8;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(points.x+(points.tx-points.x)*i/8),y:Math.round(points.y+(points.ty-points.y)*i/8)});await wait()}
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:points.tx,y:points.ty});await wait();
 assert.ok(await evaluate(`!store.getState().project.spreads.find(s=>s.id===spreadId).placements.some(p=>p.photoId==='move-photo')&&store.getState().project.spreads.find(s=>s.id===targetId).placements.some(p=>p.photoId==='move-photo')`),'Overview pointer drag moves photo to empty spread instead of reordering spreads');
 assert.equal(await evaluate('store.getState().selectedSpreadId'),await evaluate('targetId'),'Moved photo selects its destination');
 await evaluate('store.getState().undo()');await wait();assert.ok(await evaluate(`store.getState().project.spreads.find(s=>s.id===spreadId).placements.some(p=>p.photoId==='move-photo')`));
 await evaluate('store.getState().redo()');await wait();assert.ok(await evaluate(`store.getState().project.spreads.find(s=>s.id===targetId).placements.some(p=>p.photoId==='move-photo')`));
 console.log('PASS: overview photo drag to empty spread, Undo and Redo');
 win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
