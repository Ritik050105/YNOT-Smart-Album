const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'ynot-templates-test-')))
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






 const deletion=await evaluate(`(()=>{let s=store.getState();const before=structuredClone(s.project),history=s.history.length;s.removePoolPhotos(['a','b']);const removed=store.getState().project.photos.length===1,one=store.getState().history.length===history+1;store.getState().undo();const restored=store.getState().project.photos.length===3;store.getState().redo();const redone=store.getState().project.photos.length===1;store.getState().undo();return {removed,one,restored,redone}})()`);assert.deepEqual(deletion,{removed:true,one:true,restored:true,redone:true});
 await evaluate(`window.messages=[];window.confirm=(message)=>{messages.push(message);return false};store.getState().setSelectedPhotoIds(['a','b'],'a')`);await wait();
 await evaluate(`document.querySelector('[aria-label="Image browser"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}))`);await wait();
 assert.equal(await evaluate(`store.getState().project.photos.length`),3,'Cancel keeps photos');assert.match(await evaluate(`messages.join(' ')`),/2 of 2 selected photos are used in spreads/);
 await evaluate(`window.confirm=()=>true;const s=store.getState();s.addTextBox(id,{id:'text-test',text:'Wedding title',x:.1,y:.1,width:.5,height:.1,fontSize:25,fontFamily:'Arial',color:'#111111',align:'center',bold:false,italic:false});s.selectTextBox('text-test')`);await wait();
 assert.equal(await evaluate(`!!document.querySelector('[aria-label="Text formatting"]')`),true);
 await evaluate(`document.querySelector('[aria-label="Text formatting"] [aria-label="bold"]').click()`);await wait();
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].bold`),true);await evaluate(`store.getState().undo()`);assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].bold`),false);
 await evaluate(`store.getState().enterDesignerView(id)`);await wait();
 for(const label of ['Browse Image Templates','Browse Font Templates','Browse Mixed Templates','Save Image Templates','Save Font Templates','Save Mixed Templates'])assert.equal(await evaluate(`Array.from(document.querySelectorAll('.designer-view__topbar button')).some(b=>b.textContent===${JSON.stringify(label)})`),true,label);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('.designer-view__topbar button')).some(b=>b.textContent==='Layers')`),false);
 await evaluate(`void store.getState().saveSpreadAsTemplate(id,'Mixed QA','mixed')`);await wait();
 await evaluate(`const modal=document.querySelector('.modal-backdrop');const inputs=modal.querySelectorAll('input');for(const [index,input] of [...inputs].entries()){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,index===0?'Wedding':'Elegant');input.dispatchEvent(new Event('input',{bubbles:true}))}`);await wait();
 await evaluate(`Array.from(document.querySelectorAll('.modal-backdrop button')).find(b=>b.textContent==='Save').click()`);await wait();
 const template=await evaluate(`store.getState().userTemplates.at(-1)`);assert.equal(template.kind,'mixed');assert.equal(template.textBoxes.length,1);assert.equal(template.category,'Wedding');assert.equal(template.subcategory,'Elegant');
 const imported=await evaluate(`qa.parseTemplateTransfer(JSON.stringify({format:'ynot-templates',version:1,templates:[store.getState().userTemplates.at(-1)]}))[0]`);assert.equal(imported.category,'Wedding');assert.equal(imported.subcategory,'Elegant');assert.equal(imported.textBoxes.length,1);
 await evaluate(`store.getState().openMatchingTemplates(id,'mixed')`);await wait();assert.equal(await evaluate(`document.querySelector('.matching-templates').textContent.includes('matching mixed templates')`),true);
 await evaluate(`store.getState().closeMatchingTemplates();store.getState().selectTextBox('text-test')`);await wait();
 await fs.writeFile(path.join(out,'text-toolbar.png'),(await win.webContents.capturePage()).toPNG());
 const fontBytes=(await fs.readFile('src/assets/BankGothic.ttf')).toString('base64');
 await evaluate(`const data=Uint8Array.from(atob('${fontBytes}'),c=>c.charCodeAt(0)),transfer=new DataTransfer();for(const name of ['BulkOne.ttf','BulkTwo.ttf'])transfer.items.add(new File([data],name));const input=document.querySelector('.floating-text-tools input[type=file][accept]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))`);await wait();await wait();
 assert.equal(await evaluate(`store.getState().project.customFonts.filter(f=>f.family.startsWith('Bulk')).length`),2,'Bulk fonts loaded');
 console.log('PASS: gallery warning/cancel, atomic delete Undo/Redo, floating formatting Undo, toolbar placement, mixed classification export/import and browse');win.destroy();app.quit()
}).catch(error=>{console.error(error);app.exit(1)})

