const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-layer-lock-qa');await fs.mkdir(out,{recursive:true})
 const source=`import {renderSpreadToCanvas} from './src/engine/renderSpread';import {buildSpreadPsdBytes} from './src/engine/exportPsd';import {readPsd} from 'ag-psd';window.renderSpread=()=>{const p=store.getState().project;return renderSpreadToCanvas(p.spreads[0],new Map(p.photos.map(p=>[p.id,p])),p.size,10)};window.psdLayers=async()=>{const p=store.getState().project;const bytes=await buildSpreadPsdBytes(p.spreads[0],new Map(p.photos.map(p=>[p.id,p])),p.size,10);return readPsd(bytes,{skipLayerImageData:true,skipCompositeImageData:true}).children.map(l=>({name:l.name,hidden:!!l.hidden}))};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.roundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project;window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.png':'dataurl','.icc':'dataurl'}})
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text)
 for(const name of ['app','editor'])await fs.copyFile(`src/styles/${name}.css`,path.join(out,`${name}.css`))
 await fs.writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
 const win=new BrowserWindow({show:false,frame:false,width:1600,height:900,webPreferences:{offscreen:true}})
 win.webContents.on('console-message',(_,level,message)=>{if(level===3)console.error(message)});await win.loadFile(path.join(out,'index.html'));const evaluate=async code=>{try{return await win.webContents.executeJavaScript(`(()=>eval(${JSON.stringify(code)}))()`)}catch(e){console.error(code);throw e}}
 await new Promise(r=>setTimeout(r,200));await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`)


 const wait=()=>new Promise(r=>setTimeout(r,150));await wait();
 await evaluate(`store.getState().addBlankSpread();window.sid=store.getState().project.spreads[0].id;store.getState().enterDesignerView(sid);store.getState().addImageFrame(sid,{x:.1,y:.1,width:.3,height:.3});window.fid=store.getState().project.spreads[0].placements.at(-1).placeholderId;store.getState().addTextBox(sid,{id:'text',x:.5,y:.1,width:.3,height:.2,text:'Wedding title',fontFamily:'Arial',fontSize:24,color:'#222',align:'left',bold:false,italic:false});store.setState({rightPanelOpen:true})`);await wait();
 assert.ok(await evaluate(`!!document.querySelector('.designer-layers')`));
 await evaluate(`document.querySelectorAll('.designer-layers__row')[1].querySelector('button[aria-label^="Lock"]').click()`);await wait();
 assert.equal(await evaluate(`store.getState().project.spreads[0].placements.find(p=>p.placeholderId===fid).locked`),true);
 const locked=await evaluate('JSON.stringify(store.getState().project.spreads[0])');
 await evaluate(`store.getState().updateImageFrame(sid,fid,{x:.5,y:.5,width:.2,height:.2});store.getState().updatePlacement(sid,fid,{opacity:.1});store.getState().removeImageFrame(sid,fid)`);
 assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),locked,'Move, inspector edits and delete cannot change locked image');
 await evaluate(`store.getState().selectPlaceholder(fid)`);await wait();assert.equal(await evaluate(`Konva.stages[0].find('Transformer').length`),0,'Locked image has no resize handles');
 await evaluate(`store.getState().setLayerLocked(sid,'text','text',true);store.getState().selectTextBox('text')`);await wait();
 assert.equal(await evaluate(`Konva.stages[0].find('Text').find(t=>t.text()==='Wedding title').draggable()`),false);
 await evaluate(`store.getState().updateTextBox(sid,'text',{text:'changed'});store.getState().removeTextBox(sid,'text')`);
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].text`),'Wedding title');
 await evaluate(`store.getState().setLayerLocked(sid,'background','background',true)`);
 const bg=await evaluate('store.getState().project.spreads[0].backgroundColor');await evaluate(`store.getState().updateSpread(sid,{backgroundColor:'#ff0000'})`);assert.equal(await evaluate('store.getState().project.spreads[0].backgroundColor'),bg);
 const saved=await evaluate('(async()=>{const p=await roundtrip();return {image:p.spreads[0].placements.find(x=>x.placeholderId===fid).locked,text:p.spreads[0].textBoxes[0].locked,background:p.spreads[0].backgroundLocked}})()');assert.deepEqual(saved,{image:true,text:true,background:true});
 await evaluate(`store.getState().setLayerLocked(sid,'text','text',false);store.getState().undo()`);assert.equal(await evaluate('store.getState().project.spreads[0].textBoxes[0].locked'),true,'Undo restores lock');
 await evaluate(`store.getState().setLayerLocked(sid,'text','text',false);store.getState().updateTextBox(sid,'text',{text:'Unlocked title'})`);assert.equal(await evaluate('store.getState().project.spreads[0].textBoxes[0].text'),'Unlocked title','Unlocked layer edits without disturbing locked image');
 await wait();await evaluate(`document.querySelector('.modal-card__footer .btn')?.click()`);await wait();

 // Use real canvas pixels and PSD layer descriptors to verify cross-type stacking and visibility.
 await evaluate(`store.getState().setLayerLocked(sid,'image',fid,false);store.getState().setLayerLocked(sid,'background','background',false);window.baseId=store.getState().project.spreads[0].placements[0].placeholderId;const make=(id,color)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,64,64);return {id,fileName:id,src:c.toDataURL(),width:64,height:64,bins:[]}};store.setState({project:{...store.getState().project,photos:[make('blue','#0000ff'),make('red','#ff0000')]}});store.getState().updatePlacement(sid,baseId,{photoId:'blue'});store.getState().updatePlacement(sid,fid,{photoId:'red'});store.getState().updateTextBox(sid,'text',{x:.1,y:.1,text:'AAAA',fontSize:100,color:'#000000'});window.blackCount=async()=>{const c=await renderSpread();const d=c.getContext('2d').getImageData(20,10,55,25).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<30&&d[i+1]<30&&d[i+2]<30)n++;return n};true`);await wait();
 assert.ok(await evaluate('blackCount()')>0,'Text initially renders over images');
 // Exercise the actual Layers drop handlers, moving text beneath the small image.
 await evaluate(`const row=document.querySelector('[data-layer-id="text"] .designer-layers__grip');const target=document.querySelector('[data-layer-id="'+fid+'"]');const data=new DataTransfer();row.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));target.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:data}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:data}));row.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:data}))`);await wait();
 assert.equal(await evaluate('blackCount()'),0,'Dragged text is covered by image in raster export');
 const nodeOrder=await evaluate(`Konva.stages[0].getLayers()[0].getChildren().map(n=>n.name()).filter(n=>n.includes('-layer-'))`);
 assert.ok(nodeOrder.indexOf('text-layer-text')<nodeOrder.indexOf('image-layer-'+await evaluate('fid')),'Designer uses the same mixed image/text order');
 await evaluate(`document.querySelector('[data-layer-id="'+fid+'"] button[aria-label^="Hide"]').click()`);await wait();
 assert.ok(await evaluate('blackCount()')>0,'Hiding image reveals text underneath');
 assert.equal(await evaluate(`Konva.stages[0].find('.image-layer-'+fid).length`),0,'Hidden frame is absent from canvas');
 const psd=await evaluate('psdLayers()');assert.deepEqual(psd.map(l=>l.name),['Background','blue','AAAA','red']);assert.equal(psd.at(-1).hidden,true,'PSD keeps hidden image layer hidden');
 const controlsSaved=await evaluate('(async()=>{const p=await roundtrip();return p.spreads[0]})()');assert.equal(controlsSaved.placements.find(p=>p.photoId==='red').hidden,true);assert.ok(controlsSaved.textBoxes[0].zIndex<controlsSaved.placements.find(p=>p.photoId==='red').zIndex);
 await evaluate('store.getState().undo()');assert.equal(await evaluate('blackCount()'),0,'Undo restores visibility');await evaluate('store.getState().undo()');assert.ok(await evaluate('blackCount()')>0,'Undo restores stacking');
 // Keyboard alternative, locked hide/show, and background visibility.
 await evaluate(`document.querySelector('[data-layer-id="text"] .designer-layers__grip').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);await wait();assert.equal(await evaluate('blackCount()'),0);
 await evaluate(`store.getState().setLayerLocked(sid,'text','text',true);store.getState().setLayerHidden(sid,'text','text',true);store.getState().setLayerHidden(sid,'background','background',true);store.getState().setLayerHidden(sid,'image',fid,true);store.getState().setLayerHidden(sid,'image',baseId,true)`);await wait();
 assert.equal(await evaluate(`Konva.stages[0].find('.text-layer-text').length`),0);
 assert.deepEqual(await evaluate(`renderSpread().then(c=>Array.from(c.getContext('2d').getImageData(30,20,1,1).data))`),[255,255,255,255],'Hidden artwork leaves white page');
 await evaluate(`store.getState().setLayerHidden(sid,'text','text',false)`);assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].locked`),true,'Show preserves lock');
 await wait();

 await evaluate(`store.getState().setLayerLocked(sid,'text','text',false);store.getState().setLayerHidden(sid,'text','text',false);store.getState().setLayerHidden(sid,'image',fid,false);store.getState().setLayerHidden(sid,'image',baseId,false)`);await wait();
 await evaluate(`document.querySelector('[data-layer-id="text"] input').click();document.querySelector('[data-layer-id="'+fid+'"] input').click()`);await wait();
 await evaluate(`Array.from(document.querySelectorAll('.designer-layers__actions button')).find(b=>b.textContent==='Group selected').click()`);await wait();
 const groupId=await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`);assert.ok(groupId,'UI groups selected mixed layers');
 assert.equal(await evaluate(`store.getState().project.spreads[0].placements.find(p=>p.placeholderId===fid).groupId`),groupId);
 assert.equal(await evaluate(`document.querySelectorAll('.designer-layers__row').length`),3,'Group appears as a single layer row');
 const beforeGroup=await evaluate(`({text:store.getState().project.spreads[0].textBoxes[0],frame:store.getState().project.spreads[0].customBoxes.find(b=>b.id===fid)})`);
 const groupPoint=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.findOne('.group-transform-box'),r=stage.container().getBoundingClientRect(),p=n.getAbsolutePosition();return {x:Math.round(r.x+p.x+n.width()*stage.scaleX()*.65),y:Math.round(r.y+p.y+n.height()*stage.scaleY()*.7),scale:stage.scaleX()}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:groupPoint.x,y:groupPoint.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:groupPoint.x,y:groupPoint.y});await wait();
 for(let i=1;i<=5;i++){win.webContents.sendInputEvent({type:'mouseMove',x:groupPoint.x+i*6,y:groupPoint.y+i*4});await wait()}
 assert.equal(await evaluate(`Konva.stages[0].find('.rule-of-thirds-grid').length`),0,'Moving does not automatically display thirds grid');
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:groupPoint.x+30,y:groupPoint.y+20});await wait();
 const afterGroup=await evaluate(`({text:store.getState().project.spreads[0].textBoxes[0],frame:store.getState().project.spreads[0].customBoxes.find(b=>b.id===fid)})`);
 assert.ok(afterGroup.text.x>beforeGroup.text.x,'Pointer drag moves group');assert.ok(Math.abs((afterGroup.text.x-beforeGroup.text.x)-(afterGroup.frame.x-beforeGroup.frame.x))<.00001,'Image and text translate together');
 await evaluate(`const n=Konva.stages[0].findOne('.group-transform-box');n.scale({x:1.25,y:1.25});n.fire('transform',{target:n});n.fire('transformend',{target:n});undefined`);await wait();
 assert.ok(Math.abs(await evaluate(`store.getState().project.spreads[0].textBoxes[0].fontSize`)-125)<.01,'Group resize scales text');assert.ok(Math.abs(await evaluate(`store.getState().project.spreads[0].customBoxes.find(b=>b.id===fid).width`)-afterGroup.frame.width*1.25)<.00001,'Group resize scales image frame');
 assert.equal(await evaluate(`roundtrip().then(p=>p.spreads[0].textBoxes[0].groupId)`),groupId,'Group persists on save/reopen');
 await evaluate(`store.getState().setLayerLocked(sid,'text','text',true);store.getState().setLayerHidden(sid,'text','text',true)`);await wait();
 assert.equal(await evaluate(`store.getState().project.spreads[0].placements.find(p=>p.placeholderId===fid).locked`),true);assert.equal(await evaluate(`store.getState().project.spreads[0].placements.find(p=>p.placeholderId===fid).hidden`),true);assert.equal(await evaluate(`Konva.stages[0].find('.group-transform-box').length`),0);
 await evaluate(`store.getState().setLayerHidden(sid,'image',fid,false);store.getState().setLayerLocked(sid,'image',fid,false);store.getState().selectTextBox('text');store.getState().ungroupLayers(sid,store.getState().project.spreads[0].textBoxes[0].groupId)`);await wait();
 assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`),undefined);await evaluate('store.getState().undo()');assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`),groupId,'Ungroup is undoable');
 // Fill the photo dock and verify wrapping, vertical overflow and row navigation.
 await evaluate(`const p=store.getState().project;store.setState({bottomPanelOpen:true,project:{...p,photos:[...p.photos,...Array.from({length:36},(_,i)=>({...p.photos[0],id:'dock'+i,fileName:'Photo '+(i+1)}))]}})`);await wait();
 for(const width of [1100,1600]){win.setSize(width,900);await wait();const grid=await evaluate(`(()=>{const el=document.querySelector('.photo-dock__strip');return {display:getComputedStyle(el).display,width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight,rows:new Set(Array.from(el.querySelectorAll('[data-dock-photo]')).map(n=>n.offsetTop)).size}})()`);console.log('Dock layout',width,grid);await fs.writeFile(path.join(out,'dock.png'),(await win.webContents.capturePage()).toPNG());assert.equal(grid.display,'grid');assert.ok(grid.scrollWidth<=grid.width+1,'No horizontal photo scrolling');assert.ok(grid.rows>1&&grid.scrollHeight>grid.height,'Photo dock wraps and scrolls vertically')}
 await evaluate(`document.querySelector('[data-dock-photo]').focus();document.querySelector('[data-dock-photo]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);await wait();assert.ok(await evaluate(`document.activeElement.matches('[data-dock-photo]')`),'Keyboard moves between photo rows');
 console.log('Groups passed: mixed selection, actual pointer move, resize, lock/hide, persistence, Undo, no automatic thirds grid; responsive vertical dock passed');
 await fs.writeFile(path.join(out,'layers.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`store.getState().exitDesignerView(true);store.setState({bottomPanelOpen:true})`);await wait();const overview=await evaluate(`(()=>{const e=document.querySelector('.photo-dock__strip');return {w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight}})()`);assert.ok(overview.sw<=overview.w+1&&overview.sh>overview.h,'Overview photo dock scrolls vertically too');
 console.log('Layer visibility, drag/keyboard order, raster/PSD parity and layer locks passed: controls, image/text/background protection, resize/drag prevention, independent editing, Undo, project roundtrip');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
