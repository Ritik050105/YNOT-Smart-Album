// A single-page spread (one page live, the other greyed out) takes mixed designs, font templates and added text on its live page only, never on the greyed-out one.
const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-single-page'); await fs.mkdir(out, { recursive: true })
  const source = `import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';import{computePlaceholderBoxes}from'./src/engine/layoutMath';window.store=store;window.boxes=computePlaceholderBoxes;createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false, loader: { '.bin': 'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' } })
  await fs.writeFile(path.join(out, 'fixture.js'), result.outputFiles[0].text)
  for (const name of ['app', 'editor']) await fs.copyFile(`src/styles/${name}.css`, path.join(out, `${name}.css`))
  await fs.writeFile(path.join(out, 'index.html'), '<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win = new BrowserWindow({ show: false, frame: false, width: 1700, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_, level, message) => { if (level === 3) console.error(message) })
  await win.webContents.session.clearStorageData()
  await win.loadFile(path.join(out, 'index.html'))
  const evaluate = (code) => win.webContents.executeJavaScript(`(async()=>{${code}})()`).catch(e => { console.error('EVALUATE FAILED:', code.slice(0, 240)); throw e })
  const wait = (ms) => new Promise(r => setTimeout(r, ms))
  await wait(400)
  await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`); await wait(400)
  await evaluate(`
    const s=store.getState();s.createProjectFromWizard({name:'Page',size:{...s.project.size,widthIn:24,heightIn:12}});
    const photos=[];for(let i=0;i<4;i++){const w=i%2?800:1200,h=i%2?1200:800,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='hsl('+(i*80)%360+',65%,50%)';g.fillRect(0,0,w,h);
      photos.push({id:'p'+i,fileName:'p'+i+'.jpg',src:c.toDataURL('image/jpeg',0.6),width:w,height:h,megapixels:1,orientation:w>h?'landscape':'portrait',mimeType:'image/jpeg',capturedAt:new Date(i*1000).toISOString(),bins:[],favorite:false})}
    store.getState().addPhotos(photos);
    store.getState().runAutoBuildFromGroups([['p0'],['p1','p2'],['p3']],{layout:{start:'single',end:'single'}});
    await new Promise(r=>setTimeout(r,1500))`)
  const id = await evaluate(`return store.getState().project.spreads.filter(s=>!s.isCover).find(s=>s.pageSide==='right')?.id`)
  assert.ok(id, 'a right-page spread exists')
  const shape = () => evaluate(`const st=store.getState(),p=st.project,s=p.spreads.find(x=>x.id==='${id}'),size=s.size??p.size;const b=window.boxes(s,1000,1000*size.heightIn/size.widthIn);return {tpl:s.templateId,frames:b.map(x=>[x.x/1000,(x.x+x.width)/1000]),texts:s.textBoxes.map(t=>[t.x,t.x+t.width])}`)
  const live = (s, label) => {
    assert.ok(s.frames.length > 0 && s.frames.every(([a, b]) => a >= 0.5 - 0.003 && b <= 1.003), `${label}: every frame is on the live (right) page ${JSON.stringify(s)}`)
    assert.ok(s.texts.every(([a, b]) => a >= 0.5 - 0.003 && b <= 1.003), `${label}: every text is on the live page ${JSON.stringify(s)}`)
  }
  await evaluate(`store.getState().selectSpread('${id}')`)
  // mixed designs stepped with the keyboard buttons
  for (let i = 0; i < 4; i++) { await evaluate(`store.getState().cycleSpreadMixedTemplate('${id}',1)`); await wait(250); const s = await shape(); live(s, 'mixed design ' + (i + 1)) }
  assert.match((await shape()).tpl, /^half-right-/, 'the mixed design is the live-page version of the design')
  // the mixed browser's own tiles and its preview
  await evaluate(`const re=/Browse.mixed/;[...document.querySelectorAll('.spreads-panel__column.is-selected .spread-card-controls button')].find(x=>re.test((x.getAttribute('aria-label')||'')+' '+(x.title||''))).click()`); await wait(2500)
  const tiles = await evaluate(`return [...document.querySelectorAll('.matching-templates__strip [data-template-id]')].slice(0,6).map(e=>e.dataset.templateId)`)
  assert.ok(tiles.length > 0 && tiles.every(t => /^half-right-/.test(t)), 'the mixed browser offers live-page designs only: ' + JSON.stringify(tiles))
  await evaluate(`store.getState().closeMatchingTemplates()`); await wait(300)
  // a font template
  await evaluate(`store.getState().selectSpread('${id}');store.setState({fontBrowserSpreadId:'${id}'})`); await wait(1500)
  await evaluate(`document.querySelector('.font-template-browser .quote-template-card').click()`); await wait(700)
  await evaluate(`const b=[...document.querySelectorAll('.font-template-browser button')].find(b=>/^apply$/i.test(b.textContent.trim()));b&&b.click()`); await wait(500)
  const withFont = await shape()
  assert.ok(withFont.texts.length > 0, 'the font template put its text on the spread')
  live(withFont, 'font template')
  // text added the usual way (the designer's Add Text and quote boxes are drawn for the whole spread)
  await evaluate(`store.getState().addTextBox('${id}',{id:'plain',x:.2,y:.44,width:.6,height:.12,text:'Your text',fontFamily:'Georgia',fontSize:48,color:'#222',align:'center',bold:false,italic:false})`); await wait(300)
  live(await shape(), 'added text')
  await evaluate(`store.setState({fontBrowserSpreadId:null})`); await evaluate(`store.getState().cycleSpreadMixedTemplate('${id}',1)`); await wait(800)
  await fs.writeFile(path.join(out, 'single-page.png'), (await win.webContents.capturePage()).toPNG())
  console.log('PASS: mixed designs, font templates and added text stay on the live page of a single-page spread')
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
