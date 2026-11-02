const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-editor-update-qa');await fs.mkdir(out,{recursive:true})
 const source=`import {writePsd} from 'ag-psd';window.writePsd=writePsd;import {snapRect} from './src/engine/smartGuides';window.snapRect=snapRect;import {importTemplateArtwork} from './src/engine/importTemplateArtwork';window.importTemplateArtwork=importTemplateArtwork;import {classifyTemplates,readCollections,matchesCollection} from './src/engine/templateCollections';window.collections={classifyTemplates,readCollections,matchesCollection};window.confirm=()=>true;import {rotateTextAroundCenter} from './src/engine/textRotation';window.rotateTextAroundCenter=rotateTextAroundCenter;import {setPhotoDragPreview} from './src/engine/photoDrag';window.setPhotoDragPreview=setPhotoDragPreview;import Preferences from './src/components/Preferences';import{applyTheme}from'./src/engine/theme';window.applyTheme=applyTheme;window.showPrefs=()=>{const d=document.createElement('div');document.body.append(d);const r=createRoot(d);r.render(<Preferences onClose={()=>{r.unmount();d.remove()}}/>)};import {computePlaceholderBoxes} from './src/engine/layoutMath';window.computePlaceholderBoxes=computePlaceholderBoxes;import {parseTemplateTransfer} from './src/engine/templateTransfer';import {resolveTemplateFrames} from './src/engine/templateLayout';import {drawPlacement,drawTextBox} from './src/engine/renderSpread';window.qa={parseTemplateTransfer,resolveTemplateFrames,drawPlacement,drawTextBox};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;localStorage.setItem('--inspector-width','320');localStorage.setItem('--timeline-height','150');localStorage.setItem('ynot.dockHeight','240');store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
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





 const checks=await evaluate(`(async()=>{
 const s=store.getState();const first=s.project.spreads[0];
 s.addTextBox(first.id,{id:'qa-text',text:'Test text',x:.2,y:.2,width:.3,height:.1,fontSize:24,fontFamily:'Arial',color:'#222222',align:'left',bold:false,italic:false});const box=store.getState().project.spreads[0].textBoxes.at(-1);s.selectTextBox(box.id);
 return {id:first.id,boxId:box.id}
 })()`);await wait();
 assert.equal(await evaluate(`!!document.querySelector('[data-overview-text]')`),true,'Overview text hit target');
 assert.equal(await evaluate(`!!document.querySelector('.smart-grid')`),false,'Smart grid removed');
 await evaluate(`store.getState().updateTextBox(${JSON.stringify(checks.id)},${JSON.stringify(checks.boxId)},{opacity:.3})`);await wait();
 await evaluate(`document.querySelector('[aria-label="Text opacity slider"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);await wait();
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes.at(-1).opacity`),1,'Double click resets opacity');
 const rotated=await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const s=store.getState().project.spreads[0],p={...s.placements[0],imageRotationDeg:45,opacity:1,borderWidth:0,frameStyle:'none'};await qa.drawPlacement(canvas.getContext('2d'),{placeholderId:p.placeholderId,x:0,y:0,width:200,height:100},p,store.getState().project.photos[0],1);return [[2,2],[197,2],[2,97],[197,97]].map(([x,y])=>canvas.getContext('2d').getImageData(x,y,1,1).data[3])})()`);assert.deepEqual(rotated,[255,255,255,255],'Rotated image covers all corners');
 await evaluate(`const s=store.getState();s.insertTimelinePhotos(['c'],null);window.emptyTarget=s.project.spreads.at(-1)?.id;window.last=store.getState().project.spreads.at(-1);s.removeImageFrame(last.id,last.placements[0].placeholderId)`);await wait();
 assert.equal(await evaluate(`store.getState().project.spreads.some(s=>s.id===last.id)`),false,'Last photo removal removes empty spread');
 await evaluate(`store.getState().undo()`);assert.equal(await evaluate(`store.getState().project.spreads.some(s=>s.id===last.id)`),true,'Undo restores removed spread');

 await evaluate(`store.getState().selectSpread(${JSON.stringify(checks.id)});store.getState().selectTextBox(${JSON.stringify(checks.boxId)})`);await wait();
 await evaluate(`store.setState({bottomPanelOpen:false});document.documentElement.style.setProperty('--timeline-height','65px')`);await wait();
 await evaluate(`document.querySelector('[data-overview-text]').scrollIntoView({block:'center',inline:'center'})`);await wait();
 const origin=await evaluate(`store.getState().project.spreads[0].textBoxes.at(-1).x`);
 const bounds=await evaluate(`(()=>{const r=document.querySelector('[data-overview-text]').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 bounds.x=Math.round(bounds.x*win.webContents.getZoomFactor());bounds.y=Math.round(bounds.y*win.webContents.getZoomFactor());
 win.webContents.sendInputEvent({type:'mouseMove',...bounds});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...bounds});await wait();win.webContents.sendInputEvent({type:'mouseMove',x:bounds.x+30,y:bounds.y+20});await wait();win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:bounds.x+30,y:bounds.y+20});await wait();
 assert.ok(await evaluate(`store.getState().project.spreads[0].textBoxes.at(-1).x>${origin}`),'Real pointer moves overview text');
 await evaluate(`store.getState().undo()`);assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes.at(-1).x`),origin);
 await evaluate(`document.querySelector('[aria-label="Advanced Stroke"]').click()`);await wait();assert.equal(await evaluate(`!!document.querySelector('.layer-effect-panel')`),true,'Effects side panel');
 await fs.writeFile(path.join(out,'review-effects.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelector('[aria-label="Close effect"]').click()`);await wait();

 await evaluate(`store.setState({bottomPanelOpen:true});store.getState().setSelectedPhotoIds(['c'],'c')`);await wait();
 await evaluate(`document.querySelector('[aria-label="Image browser"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}))`);await wait();
 assert.equal(await evaluate(`store.getState().project.photos.some(p=>p.id==='c')`),false,'Gallery Delete key removes selection');
 await evaluate(`store.getState().undo()`);assert.equal(await evaluate(`store.getState().project.photos.some(p=>p.id==='c')`),true,'Gallery deletion Undo');
 await evaluate(`store.getState().selectSpread(${JSON.stringify(checks.id)});store.getState().selectPlaceholder(store.getState().project.spreads[0].placements[0].placeholderId)`);await wait();
 await evaluate(`document.querySelector('[aria-label="Move crop down"]').click()`);await wait();
 assert.ok(await evaluate(`store.getState().project.spreads[0].placements[0].focalY>.5&&store.getState().project.spreads[0].placements[0].zoom>1`),'Focal Y creates crop room');
 await evaluate(`store.getState().selectSpread(id);document.querySelector('.spreads-panel__row').click()`);await wait();
 assert.equal(await evaluate(`store.getState().selectedSpreadId`),null,'Empty spread strip clears selection');
 await evaluate(`store.getState().selectSpread(id);document.querySelector('.spreads-panel__timeline').click()`);await wait();
 assert.equal(await evaluate(`store.getState().selectedSpreadId`),null,'Empty timeline clears selection');
 await evaluate(`store.getState().setSelectedPhotoIds(['a'],'a');document.querySelector('[aria-label="Image browser"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:1,clientY:1}));window.dispatchEvent(new PointerEvent('pointerup'))`);await wait();
 assert.equal(await evaluate(`store.getState().selectedPhotoIds.length`),0,'Empty gallery clears selection');
 assert.equal(await evaluate(`snapRect({x:10,y:10,width:50,height:100},[{x:70,y:10,width:50,height:100}],500,500,0,undefined,[],[],10).guides.some(g=>g.bands?.some(b=>b.width===10))`),true,'Initial gap has filled band');
 assert.equal(await evaluate(`(async()=>{const blob=await (await fetch(src)).blob();const boxes=await importTemplateArtwork(new File([blob],'test.png',{type:'image/png'}));return boxes.length===1&&boxes[0].sourceArtwork.src.startsWith('data:image/png;base64,')})()`),true,'Raster artwork import');
 assert.equal(await evaluate(`collections.classifyTemplates(['template-test'],'QA category');collections.matchesCollection('template-test','QA category',collections.readCollections(),[])`),true,'Saved category filter');
 assert.equal(await evaluate(`(async()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;canvas.getContext('2d').fillRect(0,0,20,20);const psd=writePsd({width:20,height:20,canvas,children:[{name:'Artwork',left:0,top:0,right:20,bottom:20,canvas}]});const boxes=await importTemplateArtwork(new File([psd],'layered.psd'));return boxes.length===1&&!!boxes[0].groupId})()`),true,'Layered PSD artwork import');
 await evaluate(`store.getState().selectSpread(id);store.getState().selectTextBox(${JSON.stringify(checks.boxId)})`);await wait();
 await evaluate(`document.querySelector('[aria-label="Advanced Stroke"]').click()`);await wait();
 assert.equal(await evaluate(`!!document.querySelector('.layer-effect-panel [aria-label="Size slider"]')`),true,'Stroke-specific width control');
 assert.equal(await evaluate(`!!document.querySelector('.layer-effect-panel [aria-label="Angle slider"]')`),false,'Stroke hides irrelevant angle control');
 await evaluate(`document.querySelector('[aria-label="Advanced Gradient overlay"]').click()`);await wait();
 assert.equal(await evaluate(`!!document.querySelector('.layer-effect-panel [aria-label="Angle slider"]')`),true,'Gradient exposes angle control');
 await evaluate(`document.querySelector('[aria-label="Close effect"]').click()`);
 console.log('PASS: overview text controls, smart-grid removal, slider reset, rotation coverage, empty-spread removal and Undo');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});

