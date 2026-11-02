const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-editor-update-qa');await fs.mkdir(out,{recursive:true})
 const source=`import {readQuotes,importQuotes} from './src/engine/savedQuotes';window.readQuotes=readQuotes;window.importQuotes=importQuotes;import {setPhotoDragPreview} from './src/engine/photoDrag';window.setPhotoDragPreview=setPhotoDragPreview;import Preferences from './src/components/Preferences';import{applyTheme}from'./src/engine/theme';window.applyTheme=applyTheme;window.showPrefs=()=>{const d=document.createElement('div');document.body.append(d);const r=createRoot(d);r.render(<Preferences onClose={()=>{r.unmount();d.remove()}}/>)};import {computePlaceholderBoxes} from './src/engine/layoutMath';window.computePlaceholderBoxes=computePlaceholderBoxes;import {parseTemplateTransfer} from './src/engine/templateTransfer';import {resolveTemplateFrames} from './src/engine/templateLayout';import {drawPlacement,drawTextBox} from './src/engine/renderSpread';window.qa={parseTemplateTransfer,resolveTemplateFrames,drawPlacement,drawTextBox};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;localStorage.setItem('--inspector-width','320');localStorage.setItem('--timeline-height','150');localStorage.setItem('ynot.dockHeight','240');store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
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



 const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait()};
 await click('[aria-label="Browse text templates"]');
 assert.equal(await evaluate(`!!document.querySelector('#overview-font-template-browser .font-template-browser')`),true);
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes.length`),0);
 await click('.quote-template-grid .quote-template-card');
 assert.ok(await evaluate(`store.getState().templatePreview.textBoxes.length`)>0);
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes.length`),0);
 await fs.writeFile(path.join(out,'quote-live-preview.png'),(await win.webContents.capturePage()).toPNG());
 await click('.font-template-browser .btn-primary');
 assert.ok(await evaluate(`store.getState().project.spreads[0].textBoxes.length`)>0);
 await click('[aria-label="Browse text templates"]');
 await evaluate(`Array.from(document.querySelectorAll('.quote-browser-tools button')).find(b=>b.textContent==='Save font template').click()`);await wait();
 assert.equal(await evaluate(`!!Array.from(document.querySelectorAll('select option')).find(o=>o.textContent==='Maternity')`),true);
 await evaluate(`Array.from(document.querySelectorAll('button')).filter(b=>b.textContent==='Save font template').at(-1).click()`);await wait();
 assert.equal(await evaluate(`readQuotes().at(-1).category`),'Wedding');
 assert.equal(await evaluate(`readQuotes().at(-1).title&&readQuotes().at(-1).content`),true);
 assert.ok(await evaluate(`readQuotes().at(-1).boxes.length`)>0);
 await evaluate(`window.importQuotes(JSON.stringify({format:'ynot-quotes',version:1,quotes:[{...readQuotes().at(-1),category:'Reception',title:true,content:false}]}))`);await wait();
 assert.equal(await evaluate(`readQuotes().at(-1).content`),false);
 await click('.quote-browser-tools input[type="checkbox"]');
 await evaluate(`Array.from(document.querySelectorAll('label')).find(l=>l.textContent.includes('Filter by classification')).querySelector('input').click()`);await wait();
 await evaluate(`const select=document.querySelector('[aria-label="Filter quote event"]');select.value='Reception';select.dispatchEvent(new Event('change',{bubbles:true}))`);await wait();
 assert.ok(await evaluate(`document.querySelectorAll('.quote-template-card').length`)>0);
 await evaluate(`document.querySelectorAll('.quote-browser-tools input[type="checkbox"]')[1].click()`);await wait();
 assert.equal(await evaluate(`document.querySelectorAll('.quote-template-card').length`),0);
 await evaluate(`document.querySelectorAll('.quote-browser-tools input[type="checkbox"]')[1].click()`);await wait();
 await click('.quote-browser-tools input[type="checkbox"]');

 await click('.font-template-browser header button');
 await evaluate('store.getState().undo()');await wait();
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes.length`),0);
 await click('[aria-label="Next text template preview"]');
 assert.equal(await evaluate(`!!document.querySelector('.quote-template-grid .quote-template-card[aria-pressed="true"]')`),true);
 await click('.font-template-browser header button');
 assert.equal(await evaluate(`store.getState().templatePreview`),null);
 await click('[aria-label="Delete spread 1"]');
 assert.equal(await evaluate(`store.getState().project.spreads.length`),0);
 assert.equal(await evaluate(`store.getState().project.photos.length`),3);
 await evaluate('store.getState().undo()');await wait();
 assert.equal(await evaluate(`store.getState().project.spreads.length`),1);
 await evaluate(`store.getState().selectSpread(id);document.querySelector('[data-overview-spread]').style.setProperty('--spread-width','400px')`);await wait();
 await fs.writeFile(path.join(out,'spread-bar.png'),(await win.webContents.capturePage()).toPNG());
 console.log('PASS: overview text previews and grouped apply/undo; classification dialog/save/import; immediate deletion, photo retention and undo');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
