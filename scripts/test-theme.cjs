const {app,BrowserWindow}=require('electron');
const {build}=require('esbuild');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-theme-qa');await fs.mkdir(out,{recursive:true});
 const source=`import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import Preferences from './src/components/Preferences';import Wizard from './src/components/NewProjectWizard';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;const root=createRoot(document.getElementById('root'));window.screen=(name)=>root.render(name==='preferences'?<Preferences onClose={()=>{}}/>:name==='wizard'?<Wizard bare onClose={()=>{}} onSubmit={()=>{}}/>:<App/>);window.screen('home');`;
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',loader:{'.png':'dataurl','.icc':'dataurl'}});
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text);
 for(const n of ['app','editor'])await fs.copyFile(`src/styles/${n}.css`,path.join(out,`${n}.css`));
 await fs.writeFile(path.join(out,'index.html'),'<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"><div id="root"></div><script src="fixture.js"></script>');
 const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true}});await win.loadFile(path.join(out,'index.html'));
 const run=s=>win.webContents.executeJavaScript(s),wait=()=>new Promise(r=>setTimeout(r,250));await wait();
 const lum=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
 for(const screen of ['home','wizard','preferences','editor']){
  await run(`window.screen('${screen}')`);await wait();
  if(screen==='editor'){await run(`store.getState().createProjectFromWizard({name:'Palette review',size:{...store.getState().project.size,widthIn:20,heightIn:10}});window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`);await wait();await run(`store.setState({bottomPanelOpen:true,rightPanelOpen:true})`);await wait();}
  for(const theme of ['light','dark']){
   await run(`document.documentElement.dataset.theme='${theme}'`);await wait();
   const metrics=await run(`(()=>{const s=getComputedStyle(document.documentElement),e=document.querySelector('.btn--primary:not(:disabled)'),b=e&&getComputedStyle(e);return {text:s.getPropertyValue('--text').trim(),accent:s.getPropertyValue('--accent').trim(),button:b&&[b.color,b.backgroundColor],overflow:document.documentElement.scrollWidth>innerWidth}})()`);
   assert.equal(metrics.accent,theme==='light'?'#805638':'#d7ad83',screen);
   if(metrics.button){const [a,b]=metrics.button.map(lum);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${screen}/${theme} primary contrast ${metrics.button}`)}
   assert.equal(metrics.overflow,false,`${screen}/${theme} overflow`);
   await fs.writeFile(path.join(out,`${screen}-${theme}.png`),(await win.webContents.capturePage()).toPNG());
  }
 }
 console.log('Theme checks passed: home, setup, preferences and editor in both themes, primary button contrast and viewport bounds. '+out);win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
