const {app,BrowserWindow}=require('electron')
const {build}=require('esbuild')
const fs=require('node:fs/promises'),path=require('node:path')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
 const out=path.join(app.getPath('temp'),'ynot-dbg-controls');await fs.mkdir(out,{recursive:true})
 const source=`import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;store.setState({bottomPanelOpen:true,leftPanelOpen:true,rightPanelOpen:true});store.getState().createProjectFromWizard({name:'New album',size:{...store.getState().project.size,widthIn:20,heightIn:10}});createRoot(document.getElementById('root')).render(<App/>);`
 const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',write:false,loader:{'.ttf':'dataurl','.png':'dataurl','.icc':'dataurl'}})
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text)
 for(const name of ['app','editor'])await fs.copyFile(`src/styles/${name}.css`,path.join(out,`${name}.css`))
 await fs.writeFile(path.join(out,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
 const win=new BrowserWindow({show:false,frame:false,width:1600,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}})
 await win.loadFile(path.join(out,'index.html'))
 const evaluate=async code=>{try{return await win.webContents.executeJavaScript(`(()=>eval(${JSON.stringify(code)}))()`)}catch(e){console.error(code);throw e}}
 await new Promise(r=>setTimeout(r,200));await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`)
 for(let i=0;i<40&&!await evaluate('!!document.querySelector(".spreads-panel--empty")');i++)await new Promise(r=>setTimeout(r,100))
 await evaluate('store.getState().addBlankSpread()')
 win.setSize(1600,900)
 await evaluate(`store.getState().updateProjectSettings({size:{...store.getState().project.size,widthIn:7.5,heightIn:10}})`)
 await new Promise(r=>setTimeout(r,150))
 for(const bottom of [false,true])for(const right of [false,true]){
   await evaluate(`store.setState({bottomPanelOpen:${bottom},rightPanelOpen:${right}})`)
   await new Promise(r=>setTimeout(r,180))
   const noOverlap=await evaluate(`(()=>{const bar=document.querySelector('.spread-card-controls'),bounds=bar.getBoundingClientRect(),items=[...bar.querySelectorAll('button'),bar.querySelector('.spread-card-controls__end > span')].map(e=>e.getBoundingClientRect());return items.every((r,i)=>r.left>=bounds.left-1&&r.right<=bounds.right+1&&items.slice(i+1).every(s=>Math.min(r.right,s.right)-Math.max(r.left,s.left)<=1||Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)<=1))})()`)
   const centered=await evaluate(`(()=>{const card=document.querySelector('[data-spread-drag]').getBoundingClientRect(),icon=document.querySelector('.spread-card-controls__center').getBoundingClientRect();return Math.abs(icon.left+icon.width/2-card.left-card.width/2)<1})()`)
   console.log(`bottom=${bottom} right=${right}: noOverlap=${noOverlap} centered=${centered}`)
   if(!noOverlap){
    const info=await evaluate(`(()=>{const bar=document.querySelector('.spread-card-controls');const bounds=bar.getBoundingClientRect();const items=[...bar.querySelectorAll('button'),bar.querySelector('.spread-card-controls__end > span')].map(e=>({tag:e.tagName,label:e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent,rect:e.getBoundingClientRect()}));return JSON.stringify({barWidth:bounds.width,count:items.length,items:items.map(i=>({label:i.label,x:Math.round(i.rect.left),y:Math.round(i.rect.top),w:Math.round(i.rect.width),h:Math.round(i.rect.height)}))},null,1)})()`)
    console.log(info)
   }
 }
 app.quit()
}).catch(e=>{console.error(e);app.exit(1)})
