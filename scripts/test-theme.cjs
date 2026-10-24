const {app,BrowserWindow}=require('electron');
const {build}=require('esbuild');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-theme-qa');await fs.mkdir(out,{recursive:true});
 const source=`import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{createBlankSpread,defaultPlacement}from'./src/engine/autoLayout';import{templatesForCount}from'./src/engine/templates';window.seed=()=>{const t=templatesForCount(3)[0];const photos=Array.from({length:3},(_,i)=>({id:'p'+i,bins:[],tags:[],rating:0,favorite:false,fileName:'Studio '+(i+1),width:900,height:600,src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="'+['#80746a','#8f9d9a','#b9a792'][i]+'"/></svg>')}));const spread={...createBlankSpread(0,{backgroundColor:'#fff',marginPx:24,gapPx:8,borderWidth:0,borderColor:'#fff'}),id:'palette',templateId:t.id,placements:t.placeholders.map((p,i)=>defaultPlacement(p.id,photos[i].id))};store.setState(s=>({project:{...s.project,photos,spreads:[spread]},selectedSpreadId:spread.id}));};import Preferences from './src/components/Preferences';import Wizard from './src/components/NewProjectWizard';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;const root=createRoot(document.getElementById('root'));window.screen=(name)=>root.render(name==='preferences'?<Preferences onClose={()=>{}}/>:name==='wizard'?<Wizard bare onClose={()=>{}} onSubmit={()=>{}}/>:<App/>);window.screen('home');`;
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',loader:{'.png':'dataurl','.icc':'dataurl'}});
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text);
 for(const n of ['app','editor'])await fs.copyFile(`src/styles/${n}.css`,path.join(out,`${n}.css`));
 await fs.writeFile(path.join(out,'index.html'),'<!doctype html><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"><div id="root"></div><script src="fixture.js"></script>');
 const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true}});const errors=[];win.webContents.on('console-message',(_,level,message)=>{if(level===3){errors.push(message);console.error(message)}});await win.loadFile(path.join(out,'index.html'));
 const run=s=>win.webContents.executeJavaScript(s),wait=()=>new Promise(r=>setTimeout(r,250));await wait();
 const lum=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
 for(const screen of ['home','wizard','preferences','editor','designer','templates']){
  await run(`window.screen('${screen}')`);await wait();
  if(screen==='editor'){await run(`store.getState().createProjectFromWizard({name:'Palette review',size:{...store.getState().project.size,widthIn:20,heightIn:10}});window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`);await wait();await run(`window.seed();store.setState({bottomPanelOpen:true,rightPanelOpen:true})`);await wait();}
  if(screen==='designer'){await run(`store.getState().enterDesignerView('palette')`);await wait();}
  if(screen==='templates'){await run(`store.getState().openMatchingTemplates('palette')`);await wait();}
  for(const theme of ['light','dark']){
   await run(`document.documentElement.dataset.theme='${theme}'`);await wait();
   const metrics=await run(`(()=>{const s=getComputedStyle(document.documentElement),e=document.querySelector('.btn--primary:not(:disabled)'),b=e&&getComputedStyle(e);return {text:s.getPropertyValue('--text').trim(),accent:s.getPropertyValue('--accent').trim(),button:b&&[b.color,b.backgroundColor],overflow:document.documentElement.scrollWidth>innerWidth}})()`);
   assert.equal(metrics.accent,theme==='light'?'#875f40':'#d6b18b',screen);
   if(metrics.button){const [a,b]=metrics.button.map(lum);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${screen}/${theme} primary contrast ${metrics.button}`)}
   assert.equal(await run(`!!document.querySelector('.app-shell, .home-screen, .modal-card')`),true,screen+' renders');
   assert.equal(metrics.overflow,false,`${screen}/${theme} overflow`);
   const pairs=await run(`(()=>{const probe=document.createElement('span');document.body.append(probe);const color=token=>{probe.style.color='var(--'+token+')';return getComputedStyle(probe).color};const pairs=['bg','panel','panel-alt','field'].flatMap(bg=>['text','text-muted','text-faint'].map(text=>[text+'/'+bg,color(text),color(bg)]));pairs.push(['active',color('accent'),color('accent-soft')]);probe.remove();return pairs})()`);
   for(const [name,fg,bg] of pairs){const [a,b]=[fg,bg].map(lum);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${theme} ${name} contrast`)}

   await fs.writeFile(path.join(out,`${screen}-${theme}.png`),(await win.webContents.capturePage()).toPNG());
  }
 }
 assert.deepEqual(errors,[]);
 console.log('Theme checks passed: home, setup, preferences, populated editor, designer and templates in both themes, primary button and semantic text contrast and viewport bounds. '+out);win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
