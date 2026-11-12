// Previous / next text template must change the template on the spread; a photo dragged out of the app must not import again.
const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-text-step-qa'); await fs.mkdir(out, { recursive: true })
  const source = `import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false, loader: { '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' } })
  await fs.writeFile(path.join(out, 'fixture.js'), result.outputFiles[0].text)
  for (const name of ['app', 'editor']) await fs.copyFile(`src/styles/${name}.css`, path.join(out, `${name}.css`))
  await fs.writeFile(path.join(out, 'index.html'), '<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win = new BrowserWindow({ show: false, frame: false, width: 1700, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_, level, message) => { if (level === 3) console.error(message) })
  await win.webContents.session.clearStorageData()
  await win.loadFile(path.join(out, 'index.html'))
  const evaluate = async (code) => { try { return await win.webContents.executeJavaScript(`(()=>{${code}})()`) } catch (e) { console.error(code); throw e } }
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
  await wait(300)
  await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`); await wait(400)

  // Six spreads of three photographs each, so the overview is wider than the window and scrolls.
  await evaluate(`
    const s=store.getState();s.createProjectFromWizard({name:'Browse layout',size:{...s.project.size,widthIn:12,heightIn:12}});
    const photos=[];for(let i=0;i<18;i++){const c=document.createElement('canvas');c.width=1200;c.height=800;const g=c.getContext('2d');g.fillStyle='hsl('+(i*37)%360+',65%,50%)';g.fillRect(0,0,1200,800);
      photos.push({id:'p'+i,fileName:'p'+i+'.jpg',src:c.toDataURL('image/jpeg',0.5),width:1200,height:800,megapixels:1,orientation:'landscape',mimeType:'image/jpeg',capturedAt:new Date(i*1000).toISOString(),bins:[],favorite:false})}
    store.getState().addPhotos(photos);
    for(let k=0;k<6;k++)store.getState().insertTimelinePhotos(['p'+(k*3),'p'+(k*3+1),'p'+(k*3+2)],null);`)
  await wait(900)
  assert.equal(await evaluate(`return document.querySelectorAll('.spreads-panel__column').length`), 6, 'six spreads were built')

  /** Wait for layout to stop moving: the overview resizes itself on animation frames, over several. */
  const settle = async () => { let last = ''; for (let i = 0; i < 40; i++) { await wait(150); const now = await evaluate(`const r=document.querySelector('.spreads-panel__row');return [r.clientHeight,r.scrollWidth,r.scrollLeft,getComputedStyle(r.parentElement).getPropertyValue('--overview-height')].join()`); if (now === last) return; last = now } }
  const measure = () => evaluate(`
    const row=document.querySelector('.spreads-panel__row'),sel=document.querySelector('.spreads-panel__column.is-selected'),cover=row.querySelector('.spreads-panel__card--cover'),dock=document.querySelector('.photo-dock'),browser=document.querySelector('.matching-templates, .font-template-browser'),bar=sel&&sel.querySelector('.spread-card-controls');
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)}};
    return {sel:box(sel),cover:box(cover),dock:box(dock),browser:box(browser),row:box(row),bar:box(bar),scrollLeft:Math.round(row.scrollLeft),maxScroll:Math.round(row.scrollWidth-row.clientWidth),controls:bar?(()=>{const b=[...bar.querySelectorAll('button')].map(x=>x.getBoundingClientRect());return {top:Math.round(Math.min(...b.map(r=>r.top))),bottom:Math.round(Math.max(...b.map(r=>r.bottom))),rows:new Set(b.map(r=>Math.round(r.top/6))).size}})():null,inner:[innerWidth,innerHeight]}`)

  await evaluate(`const cols=[...document.querySelectorAll('.spreads-panel__column')];cols[2].querySelector('.spread-thumb').click()`); await wait(400)
  const groups = () => evaluate(`const s=store.getState();const sp=s.project.spreads.find(x=>x.id===s.selectedSpreadId);return [...new Set(sp.textBoxes.map(b=>b.groupId).filter(Boolean))]`)
  const press = (name) => evaluate(`const want=${JSON.stringify(name.replace(/[^a-z]/gi,''))};const b=[...document.querySelectorAll('.spreads-panel__column.is-selected button')].find(x=>(x.getAttribute('aria-label')||'').split('').filter(c=>/[a-z]/i.test(c)).join('')===want);b.click();return !!b`)
  assert.deepEqual(await groups(), [], 'no text template to begin with')
  assert.ok(await press('Next text template preview')); await wait(500)
  const first = await groups()
  assert.equal(first.length, 1, 'Next puts a text template on the spread')
  assert.ok(await press('Next text template preview')); await wait(500)
  const second = await groups()
  assert.equal(second.length, 1, 'Next replaces it, it does not stack')
  assert.notEqual(second[0], first[0], 'Next moved to a different template')
  assert.ok(await press('Previous text template preview')); await wait(500)
  assert.deepEqual(await groups(), first, 'Previous goes back to the one before')

  // A photograph dragged out of the dock and dropped back on the window is not an import.
  const before = await evaluate(`return store.getState().project.photos.length`)
  await evaluate(`const img=document.querySelector('.photo-dock img');img.dispatchEvent(new DragEvent('dragstart',{bubbles:true}));
    const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),c=>c.charCodeAt(0))],'p0.png',{type:'image/png'}));
    window.dispatchEvent(new DragEvent('dragenter',{dataTransfer:dt,bubbles:true}));window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));
    img.dispatchEvent(new DragEvent('dragend',{bubbles:true}))`)
  await wait(600)
  assert.equal(await evaluate(`return store.getState().project.photos.length`), before, 'dropping a photo back on the app imports nothing')

  console.log('PASS: text template next/previous swap the template; an in-app drag is never imported')
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
