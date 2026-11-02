const {app,BrowserWindow}=require('electron'),{build}=require('esbuild'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp');
const log=message=>require('node:fs').appendFileSync('qa-deep-review/recovery-electron-result.log',message+'\n');
log('START');app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 log('READY');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-recovery-qa-'));
 const original=path.join(dir,'original #100%.png');await sharp({create:{width:32,height:24,channels:3,background:'red'}}).png().toFile(original);
 const js=(await build({stdin:{contents:`import {serializeProjectFile} from './src/engine/projectFile';window.serialize=serializeProjectFile`,resolveDir:process.cwd()},bundle:true,platform:'browser',write:false})).outputFiles[0].text;
 log('BUNDLED');await fs.writeFile(path.join(dir,'fixture.js'),js);await fs.writeFile(path.join(dir,'index.html'),'<script src="fixture.js"></script>');
 const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});await win.loadFile(path.join(dir,'index.html'));
 log('LOADED');const json=await win.webContents.executeJavaScript(`serialize({photos:[{src:URL.createObjectURL(new Blob(['bytes'])),sourcePath:${JSON.stringify(original)}}],spreads:[],size:{}},[],true)`);
 await new Promise(r=>{win.webContents.once('did-finish-load',r);win.reload()});
 log('RELOADED');const src=JSON.parse(json).project.photos[0].src;
 const result=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);image.onerror=reject;image.src=${JSON.stringify(src)}})`);
 assert.deepEqual(result,[32,24]);log('PASS: recovered original loads after renderer restart');win.destroy();await fs.rm(dir,{recursive:true,force:true});console.log('PASS: recovery original image loads after renderer restart, including special characters in path');app.quit();
}).catch(e=>{log('FAIL: '+e.stack);console.error(e);app.exit(1)});

