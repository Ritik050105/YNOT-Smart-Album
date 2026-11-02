const {app,BrowserWindow,ipcMain}=require('electron');
const {build}=require('esbuild');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),sharp=require('sharp');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-large-import-'));
 const moduleResult={exports:{}};
 const native=await build({entryPoints:['electron/images.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['sharp']});
 new Function('require','module','exports',native.outputFiles[0].text)(require,moduleResult,moduleResult.exports);
 ipcMain.handle('qa:preview',(_,data)=>moduleResult.exports.imagePreview(data));
 await fs.writeFile(path.join(dir,'preload.cjs'),`const {contextBridge,ipcRenderer,webUtils}=require('electron');contextBridge.exposeInMainWorld('albumStudio',{getImagePath:file=>webUtils.getPathForFile(file),imagePreview:data=>ipcRenderer.invoke('qa:preview',data)});`);
 const original=path.join(dir,'original.png');
 await sharp(crypto.randomBytes(6000*5000*3),{raw:{width:6000,height:5000,channels:3}}).png({compressionLevel:0}).toFile(original);
 const size=(await fs.stat(original)).size;assert.ok(size>80*1024*1024&&size<100*1024*1024);
 const before=crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex');
 const files=[];for(let i=0;i<500;i++){const file=path.join(dir,`photo-${i}.png`);await fs.link(original,file);files.push(file)}
 const source=`import React from 'react';import{createRoot}from'react-dom/client';import{useImportPhotos}from'./src/engine/useImportPhotos';import{useProjectStore as store}from'./src/state/projectStore';import{PreviewImage}from'./src/engine/previewImage';import{dedupeImportedAssets}from'./src/engine/importWorkflow';window.store=store;window.dedupe=dedupeImportedAssets;window.ticks=[];let last=performance.now();setInterval(()=>{const now=performance.now();window.ticks.push(now-last);last=now},50);function Test(){const {handleFiles,progress}=useImportPhotos();const photos=store(s=>s.project.photos);return <><input id="files" type="file" multiple onChange={e=>{window.finished=false;window.started=performance.now();handleFiles(e.target.files).then(()=>{window.finished=true;window.elapsed=performance.now()-window.started}).catch(e=>window.failure=String(e))}}/><output>{progress?.done??'Ready'}</output><div style={{height:300,overflow:'auto',display:'grid',gridTemplateColumns:'repeat(5,150px)'}}>{photos.map(p=><div key={p.id} style={{height:150}}><PreviewImage src={p.src} width={140} height={140}/></div>)}</div></>};createRoot(document.getElementById('root')).render(<Test/>);`;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.ttf':'dataurl','.png':'dataurl','.icc':'dataurl'}});
 await fs.writeFile(path.join(dir,'fixture.js'),bundle.outputFiles[0].text);
 await fs.writeFile(path.join(dir,'index.html'),'<div id="root"></div><script src="fixture.js"></script>');
 const win=new BrowserWindow({show:false,width:1000,height:700,webPreferences:{preload:path.join(dir,'preload.cjs'),backgroundThrottling:false,offscreen:true}});
 await win.loadFile(path.join(dir,'index.html'));const evaluate=s=>win.webContents.executeJavaScript(s);
 await new Promise(r=>setTimeout(r,500));win.webContents.debugger.attach('1.3');
 const {root}=await win.webContents.debugger.sendCommand('DOM.getDocument');const {nodeId}=await win.webContents.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#files'});
 await win.webContents.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files});
 let peakKB=0,lastProgress=-1;const deadline=Date.now()+30*60*1000;
 while(!await evaluate('window.finished===true')){
  const failure=await evaluate('window.failure');if(failure)throw new Error(failure);
  assert.ok(Date.now()<deadline,'Import timed out');
  for(const metric of app.getAppMetrics())if(metric.type==='Tab')peakKB=Math.max(peakKB,metric.memory.workingSetSize);
  const progress=await evaluate('document.querySelector("output").textContent');if(progress!==lastProgress){console.log('Imported',progress);lastProgress=progress}
  await new Promise(r=>setTimeout(r,1000));
 }
 await new Promise(r=>setTimeout(r,1500));
 const result=await evaluate(`(()=>{const p=store.getState().project.photos;const times=window.ticks.slice().sort((a,b)=>a-b);return {count:p.length,width:p[0].width,height:p[0].height,originals:p.every(a=>a.src.startsWith('blob:')),seconds:window.elapsed/1000,timerP99Ms:times[Math.floor(times.length*.99)],timerMaxMs:times.at(-1),loadedThumbnails:document.querySelectorAll('img[src]').length}})()`);
 assert.equal(result.count,500);assert.equal(result.width,6000);assert.equal(result.height,5000);assert.ok(result.originals);assert.ok(result.loadedThumbnails<100,'Offscreen thumbnails should not all decode');
 const duplicate=await evaluate(`dedupe([{...store.getState().project.photos[0],id:'duplicate'}],store.getState().project.photos).then(r=>r.newAssets.length)`);assert.equal(duplicate,0);
 assert.equal(crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex'),before);
 console.log(JSON.stringify({...result,sourceBytes:size,peakRendererMB:peakKB/1024,sourceUnchanged:true,fixture:'500 hard-linked paths to one random 30MP PNG; not 500 distinct photo contents'},null,2));
 win.destroy();await fs.rm(dir,{recursive:true,force:true});app.quit();
}).catch(e=>{console.error(e);app.exit(1)});

