const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
  const output=path.join(app.getPath('temp'),'ynot-matching-layout');await fs.mkdir(output,{recursive:true})
  const source=`import React from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/components/MatchingTemplatesPanel';import {useProjectStore as store} from './src/state/projectStore';import {createBlankSpread,defaultPlacement} from './src/engine/autoLayout';import {templatesForCount} from './src/engine/templates';
  const photos=Array.from({length:30},(_,i)=>({id:String(i),src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="100"><rect width="120" height="100" fill="hsl('+i*37+',60%,45%)"/><text x="40" y="60" font-size="30" fill="white">'+i+'</text></svg>'),width:[900,600,700,1600,400][i%5],height:[600,900,700,400,1200][i%5]}));const template=templatesForCount(30)[0];const spread={...createBlankSpread(0,{backgroundColor:'#fff',marginPx:24,gapPx:8,borderWidth:0,borderColor:'#fff'}),id:'s',templateId:template.id,placements:template.placeholders.map((p,i)=>defaultPlacement(p.id,photos[i].id))};store.setState(s=>({project:{...s.project,photos,spreads:[spread],size:{...s.project.size,widthIn:36,heightIn:12}},selectedSpreadId:'s',history:[],isDirty:false,favoriteTemplateIds:[]}));window.store=store;window.original=store.getState().project;store.getState().openMatchingTemplates('s');function Fixture(){const open=store(s=>s.matchingTemplatesOpen);return <div className="app-shell album-editor"><header style={{height:55,flexShrink:0}}>Album workspace</header><Panel/><main id="workspace" style={{flex:1,minHeight:0}}>Spread and timeline</main><footer id="photo-dock" hidden={open}>Photo dock</footer></div>};createRoot(document.getElementById('root')).render(<Fixture/>);`
  const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.png':'dataurl','.icc':'dataurl'}})
  await fs.writeFile(path.join(output,'fixture.js'),result.outputFiles[0].text);await fs.copyFile('src/styles/app.css',path.join(output,'app.css'));await fs.copyFile('src/styles/editor.css',path.join(output,'editor.css'))
  await fs.writeFile(path.join(output,'index.html'),'<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win=new BrowserWindow({show:false,frame:false,width:1280,height:800,webPreferences:{offscreen:true,contextIsolation:true,sandbox:true}}),errors=[]
  win.webContents.on('console-message',(_,level,message)=>{if(level===3){errors.push(message);console.error(message)}})
  await win.loadFile(path.join(output,'index.html'));const evaluate=code=>win.webContents.executeJavaScript(code)
  for(let i=0;i<40&&!await evaluate('!!document.querySelector(".matching-template")');i++)await new Promise(r=>setTimeout(r,100))
  const report=[]
  for(const [width,height,zoom] of [[720,480,1],[1024,768,1],[1366,768,1],[1920,1080,1],[3840,2160,1],[3840,2160,1.5],[3840,2160,2],[3840,2160,3]]){
    win.setSize(width,height);win.webContents.setZoomFactor(zoom)
    let ready=false
    for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100));if(await evaluate(`Math.abs(innerWidth-${width/zoom})<=2&&Math.abs(innerHeight-${height/zoom})<=2`)){ready=true;break}}
    assert.ok(ready)
    const metrics=await evaluate(`({viewport:[innerWidth,innerHeight],rows:document.querySelectorAll('.matching-templates__row').length,tiles:document.querySelectorAll('.matching-template').length,panel:document.querySelector('.matching-templates').getBoundingClientRect().toJSON(),workspace:document.querySelector('#workspace').getBoundingClientRect().toJSON(),overflow:document.body.scrollWidth-innerWidth,modal:!!document.querySelector('[role=dialog]'),dockHidden:document.querySelector('#photo-dock').hidden,accent:getComputedStyle(document.querySelector('.album-editor')).getPropertyValue('--accent').trim()})`)
    assert.equal(metrics.rows,2);assert.ok(metrics.tiles<=56&&metrics.tiles>0);assert.equal(metrics.modal,false);assert.equal(metrics.dockHidden,true);assert.ok(metrics.accent);assert.ok(metrics.overflow<=1);assert.ok(metrics.workspace.height>=40,JSON.stringify(metrics));assert.ok(metrics.panel.right<=metrics.viewport[0]+1)
    report.push({width,height,zoom,...metrics})
    if(width===720||zoom===2)await fs.writeFile(path.join(output,`matching-${width}x${height}-${zoom}x.png`),(await win.webContents.capturePage()).toPNG())
  }
  assert.equal(await evaluate(`document.body.textContent.includes('Rearrange Timeline')`),true)
  assert.equal(await evaluate(`document.querySelector('.matching-templates__info')`),null,'Multiple images retain rearrange template choices')
  await evaluate(`document.querySelector('.matching-template__apply').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
  await new Promise(r=>setTimeout(r,100))
  assert.equal(await evaluate('store.getState().project===window.original'),true)
  assert.ok(await evaluate('!!store.getState().templatePreview'),'Hover must preview the candidate')
  for(const row of [0,1]){
   await evaluate(`document.querySelectorAll('.matching-templates__strip')[${row}].querySelector('.matching-template__apply').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`);await new Promise(r=>setTimeout(r,100));
   assert.ok(await evaluate(`(()=>{const cells=[...document.querySelectorAll('.matching-templates__strip')[${row}].querySelectorAll('.matching-template:first-child .gallery-cell')],s=store.getState();return cells.length===30&&cells.every((cell,i)=>cell.style.backgroundImage.includes(s.project.photos.find(p=>p.id===s.templatePreview.placements[i].photoId).src))})()`),'Thumbnail photo assignment matches applied preview for row '+row);
  }
  assert.ok(await evaluate(`Promise.all(store.getState().project.photos.map(p=>{const image=new Image();image.src=p.src;return image.decode().then(()=>true)})).then(values=>values.every(Boolean))`));
  await fs.writeFile(path.join(output,'matching-with-photos.png'),(await win.webContents.capturePage()).toPNG());
  await evaluate(`document.querySelector('.matching-template__favorite').click()`)
  assert.equal(await evaluate('store.getState().favoriteTemplateIds.length'),1);assert.equal(await evaluate('store.getState().isDirty'),false)
  await new Promise(r=>setTimeout(r,100))
  assert.equal(await evaluate('store.getState().templatePreview'),null,'Reordering candidates after a favorite change clears the old preview and keyboard selection')
  await evaluate(`document.querySelector('.matching-template__favorite').focus();document.querySelector('.matching-template__favorite').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`)
  assert.equal(await evaluate('store.getState().matchingTemplatesOpen'),true,'Favorite keyboard activation must not apply a layout')
  await evaluate(`document.querySelectorAll('.matching-templates__strip')[0].scrollLeft=100000`);await new Promise(r=>setTimeout(r,150))
  assert.ok(await evaluate(`document.querySelectorAll('.matching-templates__strip')[0].scrollLeft>1000`))
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await new Promise(r=>setTimeout(r,100))
  assert.equal(await evaluate('store.getState().matchingTemplatesOpen'),false);assert.equal(await evaluate('store.getState().templatePreview'),null)
  await evaluate(`store.getState().openMatchingTemplates('s')`);await new Promise(r=>setTimeout(r,100))
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await new Promise(r=>setTimeout(r,100))
  assert.ok(await evaluate('!!store.getState().templatePreview'));assert.equal(await evaluate('store.getState().history.length'),0)
  await evaluate(`const button=document.createElement('button');button.id='browse-trigger';document.body.append(button);button.focus();button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await new Promise(r=>setTimeout(r,100))
  assert.equal(await evaluate('store.getState().matchingTemplatesOpen'),false);assert.equal(await evaluate('store.getState().history.length'),1)
  assert.notDeepEqual(await evaluate('store.getState().project.spreads[0].placements.map(p=>p.photoId)'),await evaluate('window.original.spreads[0].placements.map(p=>p.photoId)'), 'Rearrange Timeline can optimize photo order')
  await evaluate(`store.getState().undo();store.getState().openMatchingTemplates('s')`);await new Promise(r=>setTimeout(r,100))
  await evaluate(`document.querySelectorAll('.matching-templates__strip')[1].querySelector('.matching-template__apply').focus()`);await new Promise(r=>setTimeout(r,100))
  await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await new Promise(r=>setTimeout(r,100))
  const keyboardPreview=await evaluate('store.getState().templatePreview.templateId')
  await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await new Promise(r=>setTimeout(r,100))
  assert.equal(await evaluate('store.getState().project.spreads[0].templateId'),keyboardPreview,'Enter applies the arrow-selected preview even when an older thumbnail retains focus')
  assert.equal(await evaluate('store.getState().matchingTemplatesOpen'),false)
  assert.deepEqual(await evaluate('store.getState().project.spreads[0].placements.map(p=>p.photoId)'),await evaluate('window.original.spreads[0].placements.map(p=>p.photoId)'), 'Applying templates preserves timeline order')
  await evaluate(`store.getState().undo();store.setState(s=>({project:{...s.project,spreads:s.project.spreads.map(sp=>({...sp,placements:sp.placements.slice(0,1)}))}}));store.getState().openMatchingTemplates('s')`)
  await new Promise(r=>setTimeout(r,150))
  assert.equal(await evaluate(`document.querySelectorAll('.matching-templates__row').length`),1,'Single-image spreads only show Match Timeline Order templates')
  assert.equal(await evaluate(`document.querySelector('.matching-templates__info').querySelectorAll('button,.matching-template').length`),0,'Single-image rearrange row is information only')
  await evaluate(`store.setState(s=>({project:{...s.project,spreads:[{...window.original.spreads[0],pageSide:'spread',flipped:false,customBoxes:[{id:'l',x:0,y:0,width:.45,height:1},{id:'r',x:.55,y:0,width:.45,height:1},{id:'cross',x:.4,y:.1,width:.2,height:.2}],placements:[{...window.original.spreads[0].placements[0],placeholderId:'l',photoId:'0',zoom:1.7},{...window.original.spreads[0].placements[1],placeholderId:'r',photoId:'1',rotationDeg:12},{...window.original.spreads[0].placements[2],placeholderId:'cross',photoId:'2'}]}]}}));store.getState().openMatchingTemplates('s')`)
  await new Promise(r=>setTimeout(r,100))
  for(const side of ['left','right']) {
    const opposite=side==='left'?'r':'l'
    const before=await evaluate('JSON.stringify(store.getState().project.spreads[0])')
    await evaluate(`var scopeSelect=document.querySelector('[aria-label="Template page"]');scopeSelect.value='${side}';scopeSelect.dispatchEvent(new Event('change',{bubbles:true}))`)
    await new Promise(r=>setTimeout(r,100))
    await evaluate(`document.querySelector('.matching-template__apply').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))`)
    await new Promise(r=>setTimeout(r,100))
    assert.ok(await evaluate(`document.querySelector('.matching-template .gallery-cell').style.backgroundImage.includes(store.getState().project.photos.find(p=>p.id==='${side==='left'?'0':'1'}').src)`),'Page-only thumbnail uses selected page photo');
    const preview=await evaluate('store.getState().templatePreview')
    assert.ok(preview,'Page template previews')
    for(const id of [opposite,'cross']){
      assert.deepEqual(preview.customBoxes.find(b=>b.id===id),JSON.parse(before).customBoxes.find(b=>b.id===id)&&{...JSON.parse(before).customBoxes.find(b=>b.id===id),preferredOrientation:'any'})
      assert.deepEqual(preview.placements.find(p=>p.placeholderId===id),JSON.parse(before).placements.find(p=>p.placeholderId===id),'Opposite and crossing image edits stay unchanged')
    }
    const target=preview.customBoxes.find(b=>b.id.startsWith('page-'+side))
    assert.ok(target&&(side==='left'?target.x+target.width<=.5:target.x>=.5),'Page layout stays on selected side')
    await evaluate(`document.querySelector('.matching-template__apply').click()`)
    assert.deepEqual(await evaluate('store.getState().project.spreads[0]'),preview,'Applied page matches preview')
    await evaluate(`store.getState().undo();store.getState().openMatchingTemplates('s')`)
    await new Promise(r=>setTimeout(r,100))
    assert.equal(await evaluate('JSON.stringify(store.getState().project.spreads[0])'),before,'Undo restores both pages')
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log('Inline matching-browser checks passed: eight viewport/scaling cases, two virtualized rows for multiple images and information-only rearrange row for one image, no dialog, workspace/dock bounds, favorites, scroll, keyboard preview/cancel/apply and one-step history. Evidence:',output);win.destroy();app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
