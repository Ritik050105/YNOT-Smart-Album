// Editor fixes, in the running app: (1) the "unsaved changes" prompt offers Save & Continue as well as Discard & Continue, and is not asked of a saved album;
// (2) a picture clicked on a spread takes the spread's own highlight away; (3) the right panel's preview follows a slider as it moves;
// (4) each template row folds away with its eye button and the panel shrinks; (6) double-clicking a corner handle of the Rounded Edge tool restores that corner.
const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-editor-fixes'); await fs.mkdir(out, { recursive: true })
  const source = `import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false, loader: { '.bin': 'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' } })
  await fs.writeFile(path.join(out, 'fixture.js'), result.outputFiles[0].text)
  for (const name of ['app', 'editor']) await fs.copyFile(`src/styles/${name}.css`, path.join(out, `${name}.css`))
  await fs.writeFile(path.join(out, 'index.html'), '<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win = new BrowserWindow({ show: false, frame: false, width: 1700, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_, level, message) => { if (level === 3) console.error(message) })
  await win.webContents.session.clearStorageData()
  await win.loadFile(path.join(out, 'index.html'))
  const evaluate = (code) => win.webContents.executeJavaScript(`(async()=>{${code}})()`)
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
  await wait(300)
  await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`); await wait(400)
  await evaluate(`
    const s=store.getState();s.createProjectFromWizard({name:'Fixes',size:{...s.project.size,widthIn:36,heightIn:12}});
    const photos=[];for(let i=0;i<4;i++){const w=i%2?800:1200,h=i%2?1200:800,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'hsl('+(i*80)%360+',65%,35%)');grad.addColorStop(1,'hsl('+(i*80+60)%360+',65%,65%)');g.fillStyle=grad;g.fillRect(0,0,w,h);
      photos.push({id:'p'+i,fileName:'p'+i+'.jpg',src:c.toDataURL('image/jpeg',0.7),width:w,height:h,megapixels:1,orientation:i%2?'portrait':'landscape',mimeType:'image/jpeg',capturedAt:new Date(i*1000).toISOString(),bins:[],favorite:false})}
    store.getState().addPhotos(photos);store.getState().insertTimelinePhotos(photos.map(p=>p.id),null);`)
  await wait(1200)
  await evaluate(`document.querySelector('.spreads-panel__column .spread-thumb').click()`); await wait(500)

  // (2) the spread's highlight goes once a picture on it is selected
  const ring = () => evaluate(`const c=document.querySelector('.spreads-panel__column.is-selected .spreads-panel__card');return c?getComputedStyle(c).boxShadow:'none'`)
  const before = await ring()
  const placeholder = await evaluate(`return store.getState().project.spreads.find(s=>s.id===store.getState().selectedSpreadId).placements[0].placeholderId`)
  await evaluate(`store.getState().selectPlaceholder(${JSON.stringify(placeholder)})`); await wait(300)
  const after = await ring()
  assert.notEqual(before, 'none', 'the selected spread has its ring')
  assert.ok(after !== before && !after.includes('3px'), `the spread's ring is gone once a picture is selected: ${before} -> ${after}`)
  await evaluate(`store.getState().selectPlaceholder(null)`); await wait(200)

  // (1) the unsaved prompt
  await evaluate(`store.setState({isDirty:false});window.dispatchEvent(new CustomEvent('album-studio:new-project'))`); await wait(400)
  assert.equal(await evaluate(`return /Start a new album/i.test(document.body.textContent)`), false, 'a saved album is not asked about discarding')
  // (a saved album goes straight on to the new-album wizard; close that)
  assert.ok(await evaluate(`return !!document.querySelector('.project-wizard')`), 'a saved album goes straight to the new-album wizard')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await wait(300)
  if (await evaluate(`return !!document.querySelector('.project-wizard')`)) await evaluate(`[...document.querySelectorAll('.project-wizard button')].find(b=>/cancel|close/i.test(b.textContent+b.getAttribute('aria-label')))?.click()`)
  await wait(300)
  assert.ok(!(await evaluate(`return !!document.querySelector('.project-wizard')`)), 'the wizard is closed')
  await evaluate(`store.setState({isDirty:true});window.dispatchEvent(new CustomEvent('album-studio:new-project'))`); await wait(400)
  const buttons = await evaluate(`return [...document.querySelectorAll('.modal-card button')].map(b=>b.textContent.trim())`)
  assert.ok(['Cancel', 'Discard & Continue', 'Save & Continue'].every(b => buttons.includes(b)), 'the prompt offers Cancel, Discard & Continue and Save & Continue: ' + JSON.stringify(buttons))
  await evaluate(`[...document.querySelectorAll('.modal-card button')].find(b=>b.textContent.trim()==='Cancel').click()`); await wait(200)
  await evaluate(`store.setState({isDirty:false})`)

  // (4) a template row folds away with its eye button
  await evaluate(`const re=/Browse.matching/;[...document.querySelectorAll('.spreads-panel__column.is-selected .spread-card-controls button')].find(x=>re.test((x.getAttribute('aria-label')||'')+' '+(x.title||''))).click()`); await wait(2500)
  const measure = () => evaluate(`return {rows:document.querySelectorAll('.matching-templates__strip').length,tile:document.querySelector('.matching-template')?.getBoundingClientRect().width??0,height:document.querySelector('.matching-templates').getBoundingClientRect().height,eyes:document.querySelectorAll('.matching-templates__eye').length}`)
  const full = await measure()
  assert.equal(full.rows, 2); assert.equal(full.eyes, 2, 'each row has an eye button')
  await evaluate(`document.querySelectorAll('.matching-templates__eye')[0].click()`); await wait(500)
  const one = await measure()
  assert.equal(one.rows, 1, 'the folded row has no templates showing'); assert.ok(one.tile >= full.tile, 'the row left is no smaller'); assert.ok(await evaluate(`const p=document.querySelector('.matching-templates');return p.scrollHeight<=p.clientHeight+1`), 'with a row folded everything that is left shows, none of it scrolled out of sight')
  await evaluate(`document.querySelectorAll('.matching-templates__eye')[1].click()`); await wait(500)
  const none = await measure()
  assert.equal(none.rows, 0); assert.ok(none.height < full.height - 40, `with both folded the panel is only its bars: ${full.height} -> ${none.height}`)
  await evaluate(`document.querySelectorAll('.matching-templates__eye').forEach(b=>b.click())`); await wait(500)
  assert.equal((await measure()).rows, 2, 'and both come back with their eyes')
  // the font templates panel has its drag line too
  await evaluate(`[...document.querySelectorAll('.matching-templates button')].find(b=>/Browse Font Templates/i.test(b.textContent)).click()`); await wait(1200)
  const fontHeight = () => evaluate(`return Math.round(document.querySelector('.font-template-browser').getBoundingClientRect().height)`)
  const line = await evaluate(`const r=document.querySelector('[role=separator][aria-label="Resize font templates"]')?.getBoundingClientRect();if(!r)return null;for(const f of [0.5,0.1,0.9,0.25,0.75,0.05,0.95]){const x=Math.round(r.left+r.width*f),y=Math.round(r.top+r.height/2),e=document.elementFromPoint(x,y);if(e&&e.getAttribute('role')==='separator')return {x,y}}return null`)
  assert.ok(line, 'the font templates panel has a drag line')
  const tall = await fontHeight()
  win.webContents.sendInputEvent({ type: 'mouseMove', x: line.x, y: line.y }); await wait(80)
  win.webContents.sendInputEvent({ type: 'mouseDown', x: line.x, y: line.y, button: 'left', clickCount: 1 }); await wait(80)
  for (let step = 1; step <= 6; step++) { win.webContents.sendInputEvent({ type: 'mouseMove', x: line.x, y: line.y + step * 12 }); await wait(30) }
  win.webContents.sendInputEvent({ type: 'mouseUp', x: line.x, y: line.y + 72, button: 'left', clickCount: 1 }); await wait(400)
  const resized = await fontHeight()
  assert.ok(Math.abs(resized - tall) > 30, `dragging the line changes the font panel's height: ${tall} -> ${resized}`)
  await evaluate(`document.querySelector('.font-template-browser header button').click()`); await wait(300)
  await evaluate(`store.getState().closeMatchingTemplates()`); await wait(300)

  // (3) the right panel's preview follows a slider while it is still being dragged
  const spreadId = await evaluate(`return store.getState().selectedSpreadId`)
  await evaluate(`store.getState().enterDesignerView(${JSON.stringify(spreadId)});store.getState().selectPlaceholder(${JSON.stringify(placeholder)})`); await wait(1500)
  const sum = () => evaluate(`const c=document.querySelector('.image-design__crop canvas');if(!c||!c.width)return -1;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0,n=0;for(let i=0;i<d.length;i+=16){s+=d[i]+d[i+1]+d[i+2];n++}return s/n`)
  const flat = await sum()
  assert.ok(flat > 0, 'the right panel has its preview')
  const slide = (value) => evaluate(`const input=[...document.querySelectorAll('.image-design input[type=range]')].find(i=>/brightness/i.test(i.closest('.slider-field')?.textContent||''));input.focus();const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'${value}');input.dispatchEvent(new Event('input',{bubbles:true}))`)
  await slide(80); await wait(700)
  const bright = await sum()
  assert.ok(bright > flat * 1.1, `the preview brightened while the slider was still held (${flat} -> ${bright})`)
  await evaluate(`const input=[...document.querySelectorAll('.image-design input[type=range]')].find(i=>/brightness/i.test(i.closest('.slider-field')?.textContent||''));input.dispatchEvent(new Event('pointerup',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))`); await wait(400)

  // (6) double-clicking a corner handle restores that corner
  await evaluate(`store.getState().updatePlacement(${JSON.stringify(spreadId)},${JSON.stringify(placeholder)},{frameStyle:'rounded',cornerRadiusPx:60,cornerRadiiPx:[60,40,60,40]});store.getState().setCanvasTool('round');store.getState().selectPlaceholder(${JSON.stringify(placeholder)})`); await wait(900)
  const handle = await evaluate(`const stage=window.Konva.stages[0],node=stage.findOne('.round-handle-0');if(!node)return null;const p=node.getAbsolutePosition(),r=stage.container().getBoundingClientRect();return {x:Math.round(r.left+p.x),y:Math.round(r.top+p.y)}`)
  assert.ok(handle, 'the Rounded Edge tool shows its corner handles')
  for (let i = 0; i < 2; i++) { for (const type of ['mouseDown', 'mouseUp']) win.webContents.sendInputEvent({ type, x: handle.x, y: handle.y, button: 'left', clickCount: i + 1 }); await wait(60) }
  await wait(500)
  const radii = await evaluate(`const pl=store.getState().project.spreads.find(s=>s.id===${JSON.stringify(spreadId)}).placements.find(p=>p.placeholderId===${JSON.stringify(placeholder)});return pl.frameStyle==='rounded'?(pl.cornerRadiiPx??[pl.cornerRadiusPx,pl.cornerRadiusPx,pl.cornerRadiusPx,pl.cornerRadiusPx]):[0,0,0,0]`)
  assert.deepEqual(radii, [0, 40, 60, 40], 'the first corner is back to square and the others keep their rounding: ' + JSON.stringify(radii))
  console.log('PASS: unsaved prompt with Save & Continue, spread highlight off when a picture is clicked, live right-panel preview, foldable template rows, double-click corner reset, a drag line for the font templates panel')
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
