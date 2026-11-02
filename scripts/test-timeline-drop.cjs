const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-timeline-qa');await fs.mkdir(out,{recursive:true})
 const source=`import Preferences from './src/components/Preferences';import{applyTheme}from'./src/engine/theme';window.applyTheme=applyTheme;window.showPrefs=()=>{const d=document.createElement('div');document.body.append(d);const r=createRoot(d);r.render(<Preferences onClose={()=>{r.unmount();d.remove()}}/>)};import {computePlaceholderBoxes} from './src/engine/layoutMath';window.computePlaceholderBoxes=computePlaceholderBoxes;import {parseTemplateTransfer} from './src/engine/templateTransfer';import {resolveTemplateFrames} from './src/engine/templateLayout';import {drawPlacement,drawTextBox} from './src/engine/renderSpread';window.qa={parseTemplateTransfer,resolveTemplateFrames,drawPlacement,drawTextBox};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;localStorage.setItem('--inspector-width','320');localStorage.setItem('--timeline-height','150');localStorage.setItem('ynot.dockHeight','240');store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.ttf':'dataurl','.png':'dataurl','.icc':'dataurl'}})
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text)
 for(const name of ['app','editor'])await fs.copyFile(`src/styles/${name}.css`,path.join(out,`${name}.css`))
 await fs.writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
 const win=new BrowserWindow({show:false,frame:false,width:1600,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}})
 win.webContents.on('console-message',(_,level,message)=>{if(level===3)console.error(message)});await win.loadFile(path.join(out,'index.html'));const evaluate=async code=>{try{return await win.webContents.executeJavaScript(`(()=>eval(${JSON.stringify(code)}))()`)}catch(e){console.error(code);throw e}}
 await new Promise(r=>setTimeout(r,200));await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`)

 // Allow the offscreen renderer to settle layout and pointer updates under build load.
 const wait=()=>new Promise(r=>setTimeout(r,200));await wait();



 await evaluate(`const c=document.createElement('canvas');c.width=120;c.height=100;c.getContext('2d').fillRect(0,0,120,100);const src=c.toDataURL();store.setState({bottomPanelOpen:true,rightPanelOpen:false,project:{...store.getState().project,photos:['a','b','c','d','e'].map(id=>({id,fileName:id+'.png',src,width:120,height:100,bins:[],favorite:false}))}});store.getState().insertTimelinePhotos(['a','b','c'],null);store.getState().insertTimelinePhotos(['d'],null);window.firstId=store.getState().project.spreads[0].id;window.secondId=store.getState().project.spreads[1].id;store.getState().selectSpread(firstId)`);await wait();
 assert.equal(await evaluate(`document.querySelectorAll('.timeline-cut').length`),2);
 assert.equal(await evaluate(`document.querySelectorAll('.timeline-boundary').length`),3);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.timeline-cut'),'::after').opacity`),'0');
 assert.ok(await evaluate(`Array.from(document.querySelectorAll('.timeline-boundary--edge')).every(e=>e.getBoundingClientRect().width>=8&&e.getBoundingClientRect().height>50)`));
 const cut=await evaluate(`(()=>{const r=document.querySelector('.timeline-cut').getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',...cut});await wait();assert.equal(await evaluate(`getComputedStyle(document.querySelector('.timeline-cut'),'::after').opacity`),'0.55');
 win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...cut});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...cut});await wait();
 assert.deepEqual(await evaluate(`store.getState().project.spreads.map(s=>s.placements.map(p=>p.photoId))`),[['a'],['b','c'],['d']]);
 await evaluate(`store.getState().undo()`);await wait();
 for(const theme of ['classic','dark']){
  await evaluate(`applyTheme('${theme}')`);await wait();
  const tones=await evaluate(`['.spreads-panel__row','.spreads-panel__timeline','.photo-dock'].map(q=>getComputedStyle(document.querySelector(q)).backgroundColor.match(/[\\d.]+/g).slice(0,3).map(Number).reduce((a,b)=>a+b))`);
  assert.ok(tones[0]<tones[1]&&tones[1]<tones[2],JSON.stringify({theme,tones}));
 }
 await evaluate(`applyTheme('classic')`);await wait();
 const order=()=>evaluate(`store.getState().project.spreads.map(s=>s.placements.map(p=>p.photoId))`);
 async function pointer(source, destination, escape=false){
  const p=await evaluate(`(()=>{const r=${source}.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
  const q=await evaluate(destination);
  win.webContents.sendInputEvent({type:'mouseMove',...p});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});await wait();
  for(let i=1;i<=8;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(p.x+(q.x-p.x)*i/8),y:Math.round(p.y+(q.y-p.y)*i/8)});await new Promise(r=>setTimeout(r,25))}await wait();
  assert.ok(await evaluate(`!!document.querySelector('.timeline-drop-marker')`),'Drop indicator visible');
  if(escape){win.webContents.sendInputEvent({type:'keyDown',keyCode:'ESCAPE'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'ESCAPE'})}
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...q});await wait();
 }
 const frame=i=>`document.querySelectorAll('[data-timeline-frame]')[${i}]`;
 const before=i=>`(()=>{const r=${frame(i)}.getBoundingClientRect();return {x:Math.round(r.left+8),y:Math.round(r.top+r.height/2)}})()`;
 await pointer(frame(2),before(0));assert.deepEqual(await order(),[['c','a','b'],['d']]);await evaluate('store.getState().undo()');await wait();assert.deepEqual(await order(),[['a','b','c'],['d']]);
 await pointer(frame(0),before(3));assert.deepEqual(await order(),[['b','c'],['a','d']]);await evaluate('store.getState().undo()');await wait();
 const gap=`(()=>{const a=${frame(0)}.getBoundingClientRect(),b=${frame(1)}.getBoundingClientRect();return{x:Math.round((a.right+b.left)/2),y:Math.round(a.top+a.height/2)}})()`;
 await pointer(`document.querySelector('[data-dock-photo="e"]')`,gap);assert.deepEqual(await order(),[['a','e','b','c'],['d']]);await evaluate('store.getState().undo()');await wait();
 await pointer(frame(2),before(0),true);assert.deepEqual(await order(),[['a','b','c'],['d']]);
 await fs.writeFile(path.join(out,'timeline.png'),(await win.webContents.capturePage()).toPNG());
 console.log('PASS: spread-only dividers and outer edges; pointer reorder, cross-spread move, gallery insertion into gaps, dot marker, Escape and Undo');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
