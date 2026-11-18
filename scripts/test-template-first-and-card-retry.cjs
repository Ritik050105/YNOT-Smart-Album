// (1) The template a spread has comes first in the template browser, marked, with the favourites right after it. (2) A spread card that fails to draw (a
// photograph not ready, the image cache busy while a file opens) shows a message inside the card and tries again, instead of staying blank.
const { app, BrowserWindow } = require('electron')
const assert = require('node:assert/strict')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-real-first'); await fs.mkdir(out, { recursive: true })
  const source = `import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false, loader: { '.bin':'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' } })
  await fs.writeFile(path.join(out, 'fixture.js'), result.outputFiles[0].text)
  for (const name of ['app', 'editor']) await fs.copyFile(`src/styles/${name}.css`, path.join(out, `${name}.css`))
  await fs.writeFile(path.join(out, 'index.html'), '<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win = new BrowserWindow({ show: false, frame: false, width: 1700, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_, level, message) => { if (level === 3) console.error(message) })
  await win.webContents.session.clearStorageData()
  await win.loadFile(path.join(out, 'index.html'))
  const evaluate = (code) => win.webContents.executeJavaScript(`(()=>{${code}})()`)
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
  await wait(300)
  await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`); await wait(400)
  await evaluate(`
    const s=store.getState();s.createProjectFromWizard({name:'First',size:{...s.project.size,widthIn:36,heightIn:12}});
    const photos=[];for(let i=0;i<4;i++){const w=i%2?800:1200,h=i%2?1200:800,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='hsl('+(i*80)%360+',65%,50%)';g.fillRect(0,0,w,h);
      photos.push({id:'p'+i,fileName:'p'+i+'.jpg',src:c.toDataURL('image/jpeg',0.5),width:w,height:h,megapixels:1,orientation:i%2?'portrait':'landscape',mimeType:'image/jpeg',capturedAt:new Date(i*1000).toISOString(),bins:[],favorite:false})}
    store.getState().addPhotos(photos);store.getState().insertTimelinePhotos(['p0','p1','p2','p3'],null);`)
  await wait(900)
  await evaluate(`document.querySelector('.spreads-panel__column .spread-thumb').click()`); await wait(400)
  const open = async () => { await evaluate(`const re=/Browse.matching/;[...document.querySelectorAll('.spreads-panel__column.is-selected .spread-card-controls button')].find(x=>re.test((x.getAttribute('aria-label')||'')+' '+(x.title||''))).click()`); await wait(2500) }
  const ids = () => evaluate(`const row=document.querySelector('.matching-templates__strip');return {tiles:[...row.querySelectorAll('[data-template-id]')].slice(0,6).map(e=>e.dataset.templateId+(e.classList.contains('is-current')?' *CURRENT*':'')),spread:store.getState().project.spreads.find(s=>s.id===store.getState().selectedSpreadId).templateId}`)
  await open()
  const first = await ids()
  assert.ok(/CURRENT/.test(first.tiles[0]), 'the spread own template is the first tile: ' + JSON.stringify(first.tiles))
  // apply the 5th template in the first row, favourite the 3rd and 8th, reopen
  const pick = await evaluate(`const row=document.querySelector('.matching-templates__strip');return [...row.querySelectorAll('[data-template-id]')].map(e=>e.dataset.templateId)`)
  await evaluate(`store.getState().applyTemplateToSpread(store.getState().selectedSpreadId,${JSON.stringify(pick[4])},false,'spread')`); await wait(500)
  await open()
  const again = await evaluate(`const row=document.querySelector('.matching-templates__strip');return [...row.querySelectorAll('[data-template-id]')].map(e=>e.dataset.templateId)`)
  await evaluate(`store.getState().toggleTemplateFavorite(${JSON.stringify(again[3])});store.getState().toggleTemplateFavorite(${JSON.stringify(again[9])})`); await wait(800)
  if (!(await evaluate('return !!document.querySelector(".matching-templates")'))) await open()
  const after = await ids()
  assert.ok(/CURRENT/.test(after.tiles[0]) && after.tiles[0].startsWith(after.spread), 'the template just chosen is first: ' + JSON.stringify(after.tiles))
  assert.deepEqual(after.tiles.slice(1, 3), [again[3], again[9]], 'the favourites follow it: ' + JSON.stringify({ tiles: after.tiles, asked: [again[3], again[9]] }))
  assert.ok(await evaluate('return getComputedStyle(document.querySelector(".matching-template.is-current")).boxShadow !== "none"'), 'the current template is highlighted')
  // A spread whose photograph cannot be drawn says so on its card (it used to stay blank, the message hidden below the card) and keeps trying.
  await evaluate(`store.getState().addPhotos([{id:'bad',fileName:'bad.jpg',src:'data:image/png;base64,AAAA',width:800,height:600,megapixels:1,orientation:'landscape',mimeType:'image/jpeg',capturedAt:new Date(9000).toISOString(),bins:[],favorite:false}]);store.getState().insertTimelinePhotos(['bad'],null)`)
  await wait(2500)
  const note = await evaluate(`const n=document.querySelector('.spread-thumb [role=status]');if(!n)return null;const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return {text:n.textContent,inside:r.top>=p.top&&r.bottom<=p.bottom+1}`)
  assert.ok(note && note.inside, 'a card that failed to draw shows its message inside the card: ' + JSON.stringify(note))
  console.log('PASS: the current template leads the browser, favourites follow it, and a card that cannot draw says so')
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
