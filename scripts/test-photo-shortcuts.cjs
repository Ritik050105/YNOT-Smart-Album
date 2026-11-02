const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.setPath('userData',require('fs').mkdtempSync(path.join(require('os').tmpdir(),'ynot-shortcut-qa-')))
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-editor-update-qa');await fs.mkdir(out,{recursive:true})
 const source=`import {setPhotoDragPreview} from './src/engine/photoDrag';window.setPhotoDragPreview=setPhotoDragPreview;import Preferences from './src/components/Preferences';import{applyTheme}from'./src/engine/theme';window.applyTheme=applyTheme;window.showPrefs=()=>{const d=document.createElement('div');document.body.append(d);const r=createRoot(d);r.render(<Preferences onClose={()=>{r.unmount();d.remove()}}/>)};import {computePlaceholderBoxes} from './src/engine/layoutMath';window.computePlaceholderBoxes=computePlaceholderBoxes;import {parseTemplateTransfer} from './src/engine/templateTransfer';import {resolveTemplateFrames} from './src/engine/templateLayout';import {drawPlacement,drawTextBox} from './src/engine/renderSpread';window.qa={parseTemplateTransfer,resolveTemplateFrames,drawPlacement,drawTextBox};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;localStorage.setItem('--inspector-width','320');localStorage.setItem('--timeline-height','150');localStorage.setItem('ynot.dockHeight','240');store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.ttf':'dataurl','.png':'dataurl','.icc':'dataurl'}})
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text)
 for(const name of ['app','editor'])await fs.copyFile(`src/styles/${name}.css`,path.join(out,`${name}.css`))
 await fs.writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
 const win=new BrowserWindow({show:false,frame:false,width:1600,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}})
 win.webContents.on('console-message',(_,level,message)=>{if(level===3)console.error(message)});await win.loadFile(path.join(out,'index.html'));const evaluate=async code=>{try{return await win.webContents.executeJavaScript(`(()=>eval(${JSON.stringify(code)}))()`)}catch(e){console.error(code);throw e}}
 await new Promise(r=>setTimeout(r,200));await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`)

 // Allow the offscreen renderer to settle layout and pointer updates under build load.
 const wait=()=>new Promise(r=>setTimeout(r,200));await wait();


 await evaluate(`const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,300,400);ctx.fillStyle='blue';ctx.fillRect(300,0,300,400);window.src=c.toDataURL();store.setState({project:{...store.getState().project,photos:['a','b','c'].map(id=>({id,fileName:id+'.png',src,width:600,height:400,orientation:'landscape',bins:[],favorite:false}))},bottomPanelOpen:true,rightPanelOpen:true});store.getState().insertTimelinePhotos(['a','b'],null);window.id=store.getState().project.spreads[0].id;store.getState().selectSpread(id)`);await wait();


 const key=async(keyCode,modifiers=[])=>{win.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});win.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await wait()};
 await evaluate(`window.first=store.getState().project.spreads[0].placements[0].placeholderId;window.second=store.getState().project.spreads[0].placements[1].placeholderId;store.getState().selectPlaceholder(first);window.original=JSON.stringify(store.getState().project.spreads[0]);window.beforeHistory=store.getState().history.length`);

 await evaluate(`store.getState().selectPlaceholder(null)`);await wait();
 const tap=await evaluate(`(()=>{const card=document.querySelector('[data-spread-drag]'),r=card.getBoundingClientRect(),spread=store.getState().project.spreads[0],b=computePlaceholderBoxes(spread,r.width,r.height).find(b=>b.placeholderId===first);return {x:Math.round(r.x+b.x+b.width/2),y:Math.round(r.y+b.y+b.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',...tap});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...tap});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...tap});await wait();assert.equal(await evaluate('store.getState().selectedPlaceholderId'),await evaluate('first'),'Tap selects image before Copy');
 await key('c',['control']);await key('v',['control']);
 assert.deepEqual(await evaluate(`store.getState().project.spreads[0].placements.map(p=>p.photoId)`),['a','b','a'],'Paste duplicates instead of replacing');
 assert.equal(await evaluate(`store.getState().history.length-beforeHistory`),1,'Duplicate is one Undo step');
 await key('z',['control']);assert.equal(await evaluate(`JSON.stringify(store.getState().project.spreads[0])`),await evaluate('original'));await key('z',['control','shift']);assert.equal(await evaluate(`store.getState().project.spreads[0].placements.length`),3);
 await evaluate(`store.getState().selectPlaceholder(first);window.beforeDelete=JSON.stringify(store.getState().project.spreads[0])`);await key('Delete');
 assert.equal(await evaluate(`store.getState().project.spreads[0].placements.length`),2);assert.ok(await evaluate(`!store.getState().project.spreads[0].customBoxes?.length`),'Normal Delete reflows instead of keeping old geometry');
 await key('z',['control']);assert.equal(await evaluate(`JSON.stringify(store.getState().project.spreads[0])`),await evaluate('beforeDelete'));
 await evaluate(`store.setState({multiSelectedPlaceholderIds:[first,second],selectedPlaceholderId:null})`);await key('Delete');assert.equal(await evaluate(`store.getState().project.spreads[0].placements.filter(p=>p.photoId).length`),1);await key('z',['control']);
 await evaluate(`store.getState().enterDesignerView(id);store.getState().selectPlaceholder(first)`);await key('Delete');assert.equal(await evaluate(`store.getState().project.spreads[0].customBoxes.length`),2,'Designer retains remaining geometry');await key('z',['control']);await evaluate(`store.getState().exitDesignerView()`);await wait();
 const native=await evaluate(`(()=>{const img=document.querySelector('[data-dock-photo] img');let result;setPhotoDragPreview({setDragImage:(c,x,y)=>result={width:c.width,height:c.height,x,y,alpha:c.getContext('2d').getImageData(10,10,1,1).data[3]}},img);return result})()`);assert.equal(native.x,native.width/2);assert.equal(native.y,native.height/2);assert.ok(native.alpha>0);
 const from=await evaluate(`(()=>{const r=document.querySelector('[data-dock-photo="c"] img').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',...from});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...from});await wait();const to={x:from.x+40,y:from.y-90};win.webContents.sendInputEvent({type:'mouseMove',...to});await wait();
 const ghost=await evaluate(`(()=>{const img=document.querySelector('.timeline-drag-preview'),r=img?.getBoundingClientRect();return img?{loaded:img.complete&&img.naturalWidth>0,parent:img.parentElement.tagName,x:r.x+r.width/2,y:r.y+r.height/2,src:img.src}:null})()`);assert.ok(ghost?.loaded,'Drag photo is decoded and visible');assert.equal(ghost.parent,'BODY','Preview escapes clipping panels');assert.ok(Math.abs(ghost.x-to.x)<1&&Math.abs(ghost.y-to.y)<1,'Preview centered at cursor');
 await fs.writeFile(path.join(out,'photo-drag-preview.png'),(await win.webContents.capturePage()).toPNG());await key('Escape');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...to});await wait();assert.equal(await evaluate(`document.querySelector('.timeline-drag-preview')`),null);

 for(const zoom of [.8,1.25,1.5]){
  win.webContents.setZoomFactor(zoom);await wait();
  const start=await evaluate(`(()=>{const r=document.querySelector('[data-dock-photo="c"] img').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const point={x:Math.round(start.x*zoom),y:Math.round(start.y*zoom)};win.webContents.sendInputEvent({type:'mouseMove',...point});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});await wait();
  const end={x:point.x+30,y:point.y-70};win.webContents.sendInputEvent({type:'mouseMove',...end});await wait();
  const center=await evaluate(`(()=>{const r=document.querySelector('.timeline-drag-preview')?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
  assert.ok(center&&Math.abs(center.x*zoom-end.x)<2&&Math.abs(center.y*zoom-end.y)<2,'Cursor center at zoom '+zoom);
  await key('Escape');win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...end});await wait();
 }
 console.log('PASS: Ctrl+C/V duplicate with Undo/Redo; normal single/multi Delete reflows; Designer Delete preserves space; native and pointer drag previews centered, decoded and unclipped; Escape cleanup');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});


