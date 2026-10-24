const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-layer-lock-qa');await fs.mkdir(out,{recursive:true})
 const source=`import {selectionGeometry,arrangeLayerSelection} from './src/engine/spreadLayers';window.arrangeRaw=arrangeLayerSelection;window.geometry=keys=>{const p=store.getState().project;return selectionGeometry(p.spreads[0],keys,p.size)};import {renderSpreadToCanvas} from './src/engine/renderSpread';import {buildSpreadPsdBytes} from './src/engine/exportPsd';import {readPsd} from 'ag-psd';window.renderSpread=()=>{const p=store.getState().project;return renderSpreadToCanvas(p.spreads[0],new Map(p.photos.map(p=>[p.id,p])),p.size,10)};window.psdLayers=async()=>{const p=store.getState().project;const bytes=await buildSpreadPsdBytes(p.spreads[0],new Map(p.photos.map(p=>[p.id,p])),p.size,10);return readPsd(bytes,{skipLayerImageData:true,skipCompositeImageData:true}).children.map(l=>({name:l.name,hidden:!!l.hidden}))};import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import {serializeProjectFile,deserializeProjectFile} from './src/engine/projectFile';window.roundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project;window.fontRoundtrip=async()=>deserializeProjectFile(await serializeProjectFile(store.getState().project,[])).project.customFonts;import{useProjectStore as store}from'./src/state/projectStore';window.store=store;store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
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

 // Canvas marquee and Shift-click share the Layers selection and grouping shortcuts.
 await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'G',ctrlKey:true,shiftKey:true,bubbles:true}))`);await wait();assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`),undefined,'Ctrl+Shift+G ungroups selected group');
 await evaluate(`store.getState().setLayerLocked(sid,'image',baseId,true);store.getState().updateTextBox(sid,'text',{x:.6,y:.1,width:.3});store.getState().addTextBox(sid,{id:'hidden-text',x:.1,y:.1,width:.2,height:.1,text:'Hidden',fontFamily:'Arial',fontSize:20,color:'#000',align:'left',bold:false,italic:false,hidden:true});store.getState().selectTextBox(null)`);await wait();
 const area=await evaluate(`(()=>{const stage=Konva.stages[0],r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+stage.x()-15*stage.scaleX()),y:Math.round(r.y+stage.y()-15*stage.scaleY()),endX:Math.round(r.x+stage.x()+650*stage.scaleX()),endY:Math.round(r.y+stage.y()+350*stage.scaleY())}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:area.x,y:area.y});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:area.x,y:area.y});await wait();
 for(let i=1;i<=6;i++){win.webContents.sendInputEvent({type:'mouseMove',x:Math.round(area.x+(area.endX-area.x)*i/6),y:Math.round(area.y+(area.endY-area.y)*i/6)});await wait()}
 assert.equal(await evaluate(`Konva.stages[0].findOne('.selection-marquee').find('Rect').length`),1,'Marquee appears while dragging');
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:area.endX,y:area.endY});await wait();
 assert.deepEqual((await evaluate('store.getState().selectedLayerKeys')).sort(),['text:text','image:'+await evaluate('fid')].sort(),'Box selects mixed layers, excludes locked and hidden');
 const textPoint=await evaluate(`(()=>{const stage=Konva.stages[0],r=stage.container().getBoundingClientRect(),n=stage.find('Text').find(t=>t.text()==='AAAA'),p=n.getAbsolutePosition();return {x:Math.round(r.x+p.x+20*stage.scaleX()),y:Math.round(r.y+p.y+30*stage.scaleY())}})()`);const shiftClick=async()=>{win.webContents.sendInputEvent({type:'keyDown',keyCode:'Shift'});await wait();win.webContents.sendInputEvent({type:'mouseMove',...textPoint});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,modifiers:['shift'],...textPoint});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,modifiers:['shift'],...textPoint});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Shift'});await wait()};await shiftClick();assert.equal(await evaluate('store.getState().selectedLayerKeys.length'),1,'Shift-click removes selected text');
 await shiftClick();assert.equal(await evaluate('store.getState().selectedLayerKeys.length'),2,'Shift-click adds text');
 await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'g',ctrlKey:true,bubbles:true}))`);await wait();assert.ok(await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`),'Ctrl+G groups canvas selection');
 await evaluate(`const field=document.createElement('textarea');document.body.append(field);field.focus();field.dispatchEvent(new KeyboardEvent('keydown',{key:'G',ctrlKey:true,shiftKey:true,bubbles:true}));field.remove()`);assert.ok(await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`),'Shortcut ignores text editing');
 await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'G',ctrlKey:true,shiftKey:true,bubbles:true}))`);await wait();assert.equal(await evaluate(`store.getState().project.spreads[0].textBoxes[0].groupId`),undefined);
 await evaluate(`store.getState().setLayerSelection(['text:text']);window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait();assert.equal(await evaluate('store.getState().selectedLayerKeys.length'),0);assert.equal(await evaluate('store.getState().designerViewSpreadId'),await evaluate('sid'),'Escape deselects text-only multi-selection without leaving designer');
 console.log('Canvas selection passed: real pointer marquee, mixed selection, Shift toggle, lock/hidden exclusions, grouping shortcuts and text-edit protection');

 // Ungrouped selection uses one transform without creating group IDs.
 await evaluate(`window.selectionKeys=['image:'+fid,'text:text'];store.getState().setLayerSelection(selectionKeys)`);await wait();
 assert.equal(await evaluate(`document.querySelectorAll('.text-edit-overlay').length`),0,'Multi-selection closes text editing');
 const selectionBefore=await evaluate('geometry(selectionKeys)');
 const selectionPoint=await evaluate(`(()=>{const stage=Konva.stages[0],n=stage.findOne('.group-transform-box'),p=n.getAbsolutePosition(),r=stage.container().getBoundingClientRect();return {x:Math.round(r.x+p.x+n.width()*stage.scaleX()*.5),y:Math.round(r.y+p.y+n.height()*stage.scaleY()*.5)}})()`);
 win.webContents.sendInputEvent({type:'mouseMove',...selectionPoint});win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...selectionPoint});await wait();
 for(let i=1;i<=4;i++){win.webContents.sendInputEvent({type:'mouseMove',x:selectionPoint.x+i*3,y:selectionPoint.y+i*2});await wait()}
 win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:selectionPoint.x+12,y:selectionPoint.y+8});await wait();
 const selectionMoved=await evaluate('geometry(selectionKeys)');assert.ok(selectionMoved.x>selectionBefore.x,'Pointer moves ungrouped selection');
 for(let i=0;i<selectionMoved.members.length;i++){assert.ok(!selectionMoved.members[i].value.groupId);assert.ok(Math.abs((selectionMoved.members[i].rect.x-selectionBefore.members[i].rect.x)-(selectionMoved.x-selectionBefore.x))<.00001)}
 await evaluate(`const n=Konva.stages[0].findOne('.group-transform-box');n.scale({x:1.03,y:1.03});n.fire('transform',{target:n});n.fire('transformend',{target:n});undefined`);await wait();
 const selectionResized=await evaluate('geometry(selectionKeys)');for(let i=0;i<selectionResized.members.length;i++){assert.ok(Math.abs(selectionResized.members[i].rect.width-selectionMoved.members[i].rect.width*1.03)<.00001);assert.ok(!selectionResized.members[i].value.groupId)}
 await evaluate(`store.getState().addTextBox(sid,{id:'third',x:.3,y:.7,width:.15,height:.1,text:'Third',fontFamily:'Arial',fontSize:20,color:'#000',align:'left',bold:false,italic:false});window.arrangeKeys=[...selectionKeys,'text:third'];store.getState().setLayerSelection(arrangeKeys)`);await wait();
 for(const mode of ['left','center','right','top','middle','bottom']){
   const original=await evaluate('geometry(arrangeKeys)');await evaluate(`store.getState().arrangeSelection(sid,arrangeKeys,${JSON.stringify(mode)})`);
   const aligned=await evaluate('geometry(arrangeKeys)');const horizontal=['left','center','right'].includes(mode),axis=horizontal?'x':'y',dimension=horizontal?'width':'height';const fraction=['center','middle'].includes(mode)?.5:['right','bottom'].includes(mode)?1:0;
   for(let i=0;i<aligned.members.length;i++){const r=aligned.members[i].rect;assert.ok(Math.abs(r[axis]+r[dimension]*fraction-(original[axis]+original[dimension]*fraction))<.00001,mode);assert.equal(r.width,original.members[i].rect.width);assert.equal(r.height,original.members[i].rect.height)}
   await evaluate('store.getState().undo()');assert.ok(Math.abs((await evaluate('geometry(arrangeKeys)')).members[0].rect.x-original.members[0].rect.x)<.00001,'Undo restores alignment');
 }
 for(const mode of ['horizontal','vertical']){
   await evaluate(`store.getState().setLayerSelection(arrangeKeys)`);await wait();await evaluate(`Array.from(document.querySelectorAll('.layer-arrange button')).find(b=>b.textContent===${JSON.stringify(mode==='horizontal'?'Horizontal':'Vertical')}).click()`);
   const arranged=await evaluate('geometry(arrangeKeys)'),axis=mode==='horizontal'?'x':'y',dimension=mode==='horizontal'?'width':'height',rects=arranged.members.map(m=>m.rect).sort((a,b)=>a[axis]-b[axis]);assert.ok(Math.abs((rects[1][axis]-rects[0][axis]-rects[0][dimension])-(rects[2][axis]-rects[1][axis]-rects[1][dimension]))<.00001,'Equal '+mode+' gaps');await evaluate('store.getState().undo()');
 }
 await evaluate('store.getState().setLayerSelection(arrangeKeys)');await wait();await fs.writeFile(path.join(out,'alignment.png'),(await win.webContents.capturePage()).toPNG());
 // A grouped pair must align as a unit, without collapsing its internal arrangement.
 await evaluate(`store.getState().groupLayers(sid,selectionKeys)`);const groupedBefore=await evaluate('geometry(selectionKeys)');await evaluate(`store.getState().arrangeSelection(sid,arrangeKeys,'bottom')`);const groupedAfter=await evaluate('geometry(selectionKeys)');assert.ok(Math.abs((groupedAfter.members[1].rect.y-groupedAfter.members[0].rect.y)-(groupedBefore.members[1].rect.y-groupedBefore.members[0].rect.y))<.00001,'Existing group maintains internal spacing');
 const savedArrangement=await evaluate('roundtrip()');assert.equal(savedArrangement.spreads[0].textBoxes.find(t=>t.id==='third').y,await evaluate(`store.getState().project.spreads[0].textBoxes.find(t=>t.id==='third').y`),'Arrangement persists');
 await evaluate(`store.getState().setLayerLocked(sid,'text','third',true)`);const protectedSpread=await evaluate('JSON.stringify(store.getState().project.spreads[0])');await evaluate(`store.getState().arrangeSelection(sid,arrangeKeys,'left')`);assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),protectedSpread,'Alignment cannot modify locked selection');
 console.log('Ungrouped transforms and all six alignments/two distributions passed, including group preservation, Undo, persistence and locks');

 // Page-relative alignment supports single elements, mixed selections and intact groups.
 await evaluate(`store.getState().arrangeSelection(sid,['text:third'],'left','left-page')`);assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),protectedSpread,'Page alignment respects locks');
 await evaluate(`store.getState().setLayerLocked(sid,'text','third',false);store.getState().selectTextBox('third')`);await wait();
 for(const target of ['left-page','right-page','spread'])for(const mode of ['left','center','right','top','middle','bottom']){
   const before=await evaluate(`geometry(['text:third'])`);await evaluate(`store.getState().arrangeSelection(sid,['text:third'],${JSON.stringify(mode)},${JSON.stringify(target)})`);const after=await evaluate(`geometry(['text:third'])`);
   const horizontal=['left','center','right'].includes(mode),axis=horizontal?'x':'y',dimension=horizontal?'width':'height',fraction=['center','middle'].includes(mode)?.5:['right','bottom'].includes(mode)?1:0;
   const start=horizontal&&target==='right-page'?.5:0,span=horizontal&&target!=='spread'?.5:1;
   assert.ok(Math.abs(after[axis]+after[dimension]*fraction-(start+span*fraction))<.00001,`${target} ${mode}`);assert.ok(Math.abs(after.width-before.width)<1e-12);assert.ok(Math.abs(after.height-before.height)<1e-12);
   await evaluate('store.getState().undo()');assert.ok(Math.abs((await evaluate(`geometry(['text:third'])`)).x-before.x)<.00001,'Undo page alignment');
 }
 await evaluate(`store.getState().selectTextBox('third')`);await wait();await evaluate(`const el=document.querySelector('[aria-label="Alignment target"]');el.value='right-page';el.dispatchEvent(new Event('change',{bubbles:true}))`);await wait();await evaluate(`Array.from(document.querySelectorAll('.layer-arrange__grid button')).find(b=>b.textContent==='Right').click()`);assert.ok(Math.abs((await evaluate(`geometry(['text:third'])`)).x-.85)<.00001,'Single-layer UI aligns to right-page edge');
 const groupPageBefore=await evaluate('geometry(selectionKeys)');await evaluate(`store.getState().arrangeSelection(sid,selectionKeys,'center','spread')`);const groupPageAfter=await evaluate('geometry(selectionKeys)');assert.ok(Math.abs(groupPageAfter.x+groupPageAfter.width/2-.5)<.00001);assert.ok(Math.abs((groupPageAfter.members[1].rect.x-groupPageAfter.members[0].rect.x)-(groupPageBefore.members[1].rect.x-groupPageBefore.members[0].rect.x))<.00001,'Page alignment keeps group spacing');
 const singlePageChecks=await evaluate(`(()=>{const p=store.getState().project,s=p.spreads[0];return ['left','right'].map(side=>{const single={...s,pageSide:side};const result=arrangeRaw(single,p.size,['text:third'],'center',side+'-page');const text=result.textBoxes.find(t=>t.id==='third');const invalid=arrangeRaw(single,p.size,['text:third'],'left',(side==='left'?'right':'left')+'-page');return {center:text.x+text.width/2,oppositeUnchanged:invalid===single}})})()`);assert.deepEqual(singlePageChecks,[{center:.5,oppositeUnchanged:true},{center:.5,oppositeUnchanged:true}]);
 assert.equal(await evaluate(`(()=>{const p=store.getState().project,s={...p.spreads[0],isCover:true};return arrangeRaw(s,p.size,['text:third'],'center','left-page')===s})()`),true,'Cover is not split into arbitrary halves');
 await wait();await fs.writeFile(path.join(out,'page-alignment.png'),(await win.webContents.capturePage()).toPNG());
 console.log('Page alignment passed: all 18 target/alignment combinations, single-layer UI, group integrity, single-page semantics, cover exclusion, Undo and locks');

 await evaluate(`for(let i=0;i<3;i++)store.getState().addTextBox(sid,{...store.getState().project.spreads[0].textBoxes.find(t=>t.id==='third'),id:'dist-'+i,x:.1+i*.16,y:.1+i*.2,width:.05+i*.02,height:.06+i*.02,groupId:undefined});window.distKeys=['text:dist-0','text:dist-1','text:dist-2']`);
 for(const target of ['left-page','right-page','spread'])for(const mode of ['horizontal','vertical']){
  const prior=await evaluate('JSON.stringify(store.getState().project.spreads[0])');await evaluate(`store.getState().arrangeSelection(sid,distKeys,${JSON.stringify(mode)},${JSON.stringify(target)})`);
  const items=(await evaluate('geometry(distKeys)')).members.map(m=>m.rect),axis=mode==='horizontal'?'x':'y',size=mode==='horizontal'?'width':'height',start=mode==='horizontal'&&target==='right-page'?.5:0,end=mode==='horizontal'&&target==='left-page'?.5:1;
  items.sort((a,b)=>a[axis]-b[axis]);const gaps=[items[0][axis]-start,...items.slice(1).map((r,i)=>r[axis]-items[i][axis]-items[i][size]),end-items.at(-1)[axis]-items.at(-1)[size]];assert.ok(gaps.every(g=>Math.abs(g-gaps[0])<1e-10),target+' '+mode+' equal outer and inner gaps');
  assert.equal(JSON.stringify((await evaluate('roundtrip()')).spreads[0]),await evaluate('JSON.stringify(store.getState().project.spreads[0])'));await evaluate('store.getState().undo()');assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),prior);
 }
 await evaluate(`store.getState().setLayerSelection(distKeys.slice(0,2))`);await wait();await evaluate(`const el=document.querySelector('[aria-label="Alignment target"]');el.value='left-page';el.dispatchEvent(new Event('change',{bubbles:true}))`);await wait();assert.equal(await evaluate(`Array.from(document.querySelectorAll('.layer-arrange button')).find(b=>b.textContent==='Horizontal').disabled`),false,'Two layers support page distribution');await evaluate(`Array.from(document.querySelectorAll('.layer-arrange button')).find(b=>b.textContent==='Horizontal').click()`);
 assert.equal(await evaluate(`(()=>{const p=store.getState().project,s={...p.spreads[0],textBoxes:p.spreads[0].textBoxes.map(t=>t.id.startsWith('dist-')?{...t,width:.4}:t)};return arrangeRaw(s,p.size,distKeys,'horizontal','left-page')===s})()`),true,'Oversized selection is not overlapped');
 console.log('Page distribution passed: six page/axis combinations, equal outside margins, two-layer controls, save/Undo and oversized protection');

 for(const target of ['selection','left-page','right-page','spread'])for(const mode of ['horizontal','vertical']){
  const before=await evaluate('JSON.stringify(store.getState().project.spreads[0])');await evaluate(`store.getState().arrangeSelection(sid,distKeys,${JSON.stringify(mode)},${JSON.stringify(target)},.02)`);
  const axis=mode==='horizontal'?'x':'y',size=mode==='horizontal'?'width':'height',items=(await evaluate('geometry(distKeys)')).members.map(m=>m.rect).sort((a,b)=>a[axis]-b[axis]);
  assert.ok(items.slice(1).every((r,i)=>Math.abs(r[axis]-items[i][axis]-items[i][size]-.02)<1e-10),'Exact gap '+target+' '+mode);
  if(target!=='selection'){const start=mode==='horizontal'&&target==='right-page'?.5:0,end=mode==='horizontal'&&target==='left-page'?.5:1;assert.ok(Math.abs(items[0][axis]-start-(end-items.at(-1)[axis]-items.at(-1)[size]))<1e-10,'Centered outer margins')}
  await evaluate('store.getState().undo()');assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),before);
 }
 assert.equal(await evaluate(`(()=>{const p=store.getState().project,s=p.spreads[0];return [-1,NaN,Infinity,5].every(g=>arrangeRaw(s,p.size,distKeys,'horizontal','spread',g)===s)})()`),true,'Reject invalid or oversized exact gaps');
 await evaluate(`store.getState().setLayerSelection(distKeys);store.getState().updateProjectSettings({units:'cm'})`);await wait();
 await evaluate(`const input=document.querySelector('[aria-label="Exact gap (cm)"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2.54');input.dispatchEvent(new Event('input',{bubbles:true}))`);await wait();assert.equal(await evaluate(`document.querySelector('[aria-label="Set horizontal gap"]').disabled`),false);await evaluate(`document.querySelector('[aria-label="Set horizontal gap"]').click()`);
 const exactItems=(await evaluate('geometry(distKeys)')).members.map(m=>m.rect).sort((a,b)=>a.x-b.x);assert.ok(Math.abs(exactItems[1].x-exactItems[0].x-exactItems[0].width-.05)<1e-10,'2.54 cm is one inch on a 20 inch spread');
 assert.equal(JSON.stringify((await evaluate('roundtrip()')).spreads[0]),await evaluate('JSON.stringify(store.getState().project.spreads[0])'));
 await fs.writeFile(path.join(out,'exact-gap.png'),(await win.webContents.capturePage()).toPNG());await evaluate(`store.getState().updateProjectSettings({units:'in'})`);
 console.log('Exact gaps passed: both axes/all targets, centered margins, Undo/save, invalid gap protection and centimeter input');

 for(const anchor of ['first','center','last'])for(const mode of ['horizontal','vertical']){
  const before=await evaluate('geometry(distKeys)'),axis=mode==='horizontal'?'x':'y',dimension=mode==='horizontal'?'width':'height',factor=anchor==='first'?0:anchor==='last'?1:.5;
  const projectBefore=await evaluate('JSON.stringify(store.getState().project.spreads[0])');await evaluate(`store.getState().arrangeSelection(sid,distKeys,${JSON.stringify(mode)},'selection',.025,${JSON.stringify(anchor)})`);const after=await evaluate('geometry(distKeys)');
  assert.ok(Math.abs(before[axis]+before[dimension]*factor-after[axis]-after[dimension]*factor)<1e-10,anchor+' stays fixed on '+axis);
  for(let i=0;i<before.members.length;i++){assert.equal(after.members[i].rect.width,before.members[i].rect.width);assert.equal(after.members[i].rect.height,before.members[i].rect.height)}
  const rects=after.members.map(m=>m.rect).sort((a,b)=>a[axis]-b[axis]);assert.ok(rects.slice(1).every((r,i)=>Math.abs(r[axis]-rects[i][axis]-rects[i][dimension]-.025)<1e-10));await evaluate('store.getState().undo()');assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),projectBefore);
 }
 for(const anchor of await evaluate('distKeys'))for(const mode of ['horizontal','vertical']){
  const before=await evaluate('geometry(distKeys)'),axis=mode==='horizontal'?'x':'y';
  const projectBefore=await evaluate('JSON.stringify(store.getState().project.spreads[0])');await evaluate(`store.getState().arrangeSelection(sid,distKeys,${JSON.stringify(mode)},'selection',.025,${JSON.stringify(anchor)})`);const after=await evaluate('geometry(distKeys)');
  const selected=before.members.findIndex(l=>l.kind+':'+l.id===anchor);assert.ok(Math.abs(before.members[selected].rect[axis]-after.members[selected].rect[axis])<1e-10,'Clicked element stays fixed');
  for(let i=0;i<before.members.length;i++){assert.equal(after.members[i].rect.width,before.members[i].rect.width);assert.equal(after.members[i].rect.height,before.members[i].rect.height)}
  await evaluate('store.getState().undo()');assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),projectBefore);
 }
 console.log('Gap anchors passed: first/center/last, both axes, preserved sizes, exact gaps and Undo');
 // Fill the photo dock and verify wrapping, vertical overflow and row navigation.
 await evaluate(`const p=store.getState().project;store.setState({bottomPanelOpen:true,project:{...p,photos:[...p.photos,...Array.from({length:36},(_,i)=>({...p.photos[0],id:'dock'+i,fileName:'Photo '+(i+1)}))]}})`);await wait();
 for(const width of [1100,1600]){win.setSize(width,900);await wait();const grid=await evaluate(`(()=>{const el=document.querySelector('.photo-dock__strip');return {display:getComputedStyle(el).display,width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight,rows:new Set(Array.from(el.querySelectorAll('[data-dock-photo]')).map(n=>n.offsetTop)).size}})()`);console.log('Dock layout',width,grid);await fs.writeFile(path.join(out,'dock.png'),(await win.webContents.capturePage()).toPNG());assert.equal(grid.display,'grid');assert.ok(grid.scrollWidth<=grid.width+1,'No horizontal photo scrolling');assert.ok(grid.rows>1&&grid.scrollHeight>grid.height,'Photo dock wraps and scrolls vertically')}
 await evaluate(`document.querySelector('[data-dock-photo]').focus();document.querySelector('[data-dock-photo]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);await wait();assert.ok(await evaluate(`document.activeElement.matches('[data-dock-photo]')`),'Keyboard moves between photo rows');
 console.log('Groups passed: mixed selection, actual pointer move, resize, lock/hide, persistence, Undo, no automatic thirds grid; responsive vertical dock passed');
 await fs.writeFile(path.join(out,'layers.png'),(await win.webContents.capturePage()).toPNG());
 await evaluate(`store.getState().exitDesignerView(true);store.setState({bottomPanelOpen:true})`);await wait();const overview=await evaluate(`(()=>{const e=document.querySelector('.photo-dock__strip');return {w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight}})()`);assert.ok(overview.sw<=overview.w+1&&overview.sh>overview.h,'Overview photo dock scrolls vertically too');
 console.log('Layer visibility, drag/keyboard order, raster/PSD parity and layer locks passed: controls, image/text/background protection, resize/drag prevention, independent editing, Undo, project roundtrip');win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
