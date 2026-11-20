// In the running app: bins sit in numerical order and a new bin is named with the next number; the mixed templates checkbox says "Mixed design"; the font templates panel stays
// open when a spread is clicked; the import review's frames answer the keyboard; a template is saved for an album size (any of them, or a custom one) and can be filtered by it.
const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-batch-fixes'); await fs.mkdir(out, { recursive: true })
  const source = `import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';import{importTemplateGeometry}from'./src/components/ImportTemplateGeometry';import{askTemplateCategory}from'./src/components/ClassifyTemplate';import{classifyTemplates,readCollections}from'./src/engine/templateCollections';window.store=store;window.importTemplate=importTemplateGeometry;window.askCategory=askTemplateCategory;window.classify=classifyTemplates;window.readCollections=readCollections;createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false, loader: { '.bin': 'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' } })
  await fs.writeFile(path.join(out, 'fixture.js'), result.outputFiles[0].text)
  for (const name of ['app', 'editor']) await fs.copyFile(`src/styles/${name}.css`, path.join(out, `${name}.css`))
  await fs.writeFile(path.join(out, 'index.html'), '<html><head><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="editor.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win = new BrowserWindow({ show: false, frame: false, width: 1700, height: 1000, webPreferences: { offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_, level, message) => { if (level === 3) console.error(message) })
  await win.webContents.session.clearStorageData()
  await win.loadFile(path.join(out, 'index.html'))
  const evaluate = (code) => win.webContents.executeJavaScript(`(async()=>{${code}})()`).catch(e => { console.error('EVALUATE FAILED:', code.slice(0, 260)); throw e })
  const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))
  await wait(300)
  await evaluate(`window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))`); await wait(400)
  await evaluate(`
    const s=store.getState();s.createProjectFromWizard({name:'Batch',size:{...s.project.size,widthIn:36,heightIn:12}});
    const photos=[];for(let i=0;i<8;i++){const w=i%2?800:1200,h=i%2?1200:800,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='hsl('+(i*45)%360+',65%,50%)';g.fillRect(0,0,w,h);
      photos.push({id:'p'+i,fileName:'p'+i+'.jpg',src:c.toDataURL('image/jpeg',0.7),width:w,height:h,megapixels:1,orientation:w>h?'landscape':'portrait',mimeType:'image/jpeg',capturedAt:new Date(i*1000).toISOString(),bins:[],favorite:false})}
    store.getState().addPhotos(photos);store.getState().insertTimelinePhotos(['p0','p1','p2','p3'],null);store.getState().insertTimelinePhotos(['p4','p5','p6','p7'],null)`)
  await wait(1200)

  // bins: numerical order, and a new one starts out as the next free number
  await evaluate(`store.getState().setPhotoBins('p0',['10']);store.getState().setPhotoBins('p1',['2']);store.getState().setPhotoBins('p2',['1'])`); await wait(500)
  const bins = await evaluate(`return [...document.querySelectorAll('.photo-dock__bin-name')].map(b=>b.textContent.trim().split(' ')[0])`)
  assert.deepEqual(bins, ['1', '2', '10'], 'bins are listed 1, 2, 10 (numerical order, not 1, 10, 2)')
  await evaluate(`document.querySelector('button[title="Add bin"]').click()`); await wait(300)
  assert.equal(await evaluate(`return document.querySelector('.photo-dock__bin-input').value`), '3', 'a new bin is named with the next free number')
  await evaluate(`const i=document.querySelector('.photo-dock__bin-input');i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`); await wait(300)
  assert.ok((await evaluate(`return [...document.querySelectorAll('.photo-dock__bin-name')].map(b=>b.textContent.trim().split(' ')[0])`)).includes('3'), 'the default name is kept as the bin\'s name')

  // the mixed templates checkbox
  await evaluate(`document.querySelector('.spreads-panel__column .spread-thumb').click()`); await wait(400)
  await evaluate(`const re=/Browse.mixed/;[...document.querySelectorAll('.spreads-panel__column.is-selected .spread-card-controls button')].find(x=>re.test((x.getAttribute('aria-label')||'')+' '+(x.title||''))).click()`); await wait(2500)
  const labels = await evaluate(`return [...document.querySelectorAll('.template-source-controls label')].map(l=>l.textContent.trim())`)
  assert.ok(labels.includes('Mixed design') && !labels.includes('Creative design'), 'the mixed browser calls its checkbox Mixed design: ' + JSON.stringify(labels))
  assert.ok(await evaluate(`return !!document.querySelector('select[aria-label="Album size category"]')`), 'the album size filter sits beside the category filter')
  await evaluate(`store.getState().closeMatchingTemplates()`); await wait(300)

  // the font templates panel stays open when a spread is clicked
  const ids = await evaluate(`return store.getState().project.spreads.filter(s=>!s.isCover).map(s=>s.id)`)
  await evaluate(`store.getState().selectSpread(${JSON.stringify(ids[0])});store.setState({fontBrowserSpreadId:${JSON.stringify(ids[0])}})`); await wait(900)
  assert.ok(await evaluate(`return !!document.querySelector('.font-template-browser')`), 'the font templates panel is open')
  await evaluate(`store.getState().selectSpread(${JSON.stringify(ids[1])})`); await wait(700)
  assert.ok(await evaluate(`return !!document.querySelector('.font-template-browser')`), 'it stays open when another spread is clicked')
  await evaluate(`store.getState().selectSpread(null)`); await wait(500)
  assert.ok(await evaluate(`return !!document.querySelector('.font-template-browser')`), 'and when empty space is clicked')
  await evaluate(`document.querySelector('.font-template-browser header button').click()`); await wait(400)
  assert.ok(!(await evaluate(`return !!document.querySelector('.font-template-browser')`)), 'only its own close button closes it')

  // the import review answers the keyboard
  await evaluate(`const c=document.createElement('canvas');c.width=600;c.height=300;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,600,300);const blob=await new Promise(r=>c.toBlob(r,'image/png'));window.__review=window.importTemplate(new File([blob],'Review test.png',{type:'image/png'}))`); await wait(1500)
  assert.ok(await evaluate(`return !!document.querySelector('.frame-review')`), 'the review modal is open')
  const frames = () => evaluate(`return document.querySelectorAll('.frame-review__frame').length`)
  const field = (name) => evaluate(`return Number(document.querySelector('input[aria-label="Frame ${name}"]')?.value)`)
  const press = (key, extra = {}) => evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true,cancelable:true,...${JSON.stringify(extra)}}))`)
  while ((await frames()) > 0) { await press('Delete'); await wait(100) }
  await evaluate(`[...document.querySelectorAll('.frame-review__actions button')].find(b=>/Add frame/.test(b.textContent)).click()`); await wait(300)
  assert.equal(await frames(), 1)
  const x0 = await field('x'), w0 = await field('width')
  await press('ArrowRight'); await wait(150)
  assert.ok(Math.abs((await field('x')) - (x0 + 0.5)) < 0.01, 'an arrow key moves the selected frame half a per cent')
  await press('ArrowRight', { shiftKey: true }); await wait(150)
  assert.ok(Math.abs((await field('x')) - (x0 + 5.5)) < 0.01, 'Shift moves it five per cent')
  await press('ArrowRight', { altKey: true }); await wait(150)
  assert.ok(Math.abs((await field('width')) - (w0 + 0.5)) < 0.01, 'Alt with an arrow resizes it')
  await press('d', { ctrlKey: true }); await wait(150)
  assert.equal(await frames(), 2, 'Ctrl+D duplicates the frame')
  await press('PageUp'); await wait(150)
  assert.equal(await evaluate(`return [...document.querySelectorAll('.frame-review__frame')].findIndex(f=>f.classList.contains('is-selected'))`), 0, 'Page Up picks the previous frame')
  await press('Delete'); await wait(150)
  assert.equal(await frames(), 1, 'Delete removes the selected frame')
  await evaluate(`[...document.querySelectorAll('.frame-review button')].find(b=>b.textContent.trim()==='Cancel')?.click()`); await wait(500)
  assert.ok(!(await evaluate(`return !!document.querySelector('.frame-review')`)), 'the review is closed')

  // saving for an album size, and filtering by it
  await evaluate(`window.__ask=window.askCategory()`); await wait(500)
  const sizeOptions = await evaluate(`return [...document.querySelectorAll('select[aria-label="Album size"] option')].map(o=>o.textContent)`)
  assert.ok(sizeOptions[0] === 'Any album size' && sizeOptions.includes('12" x 12" Square') && sizeOptions.at(-1) === 'Custom size…', 'the save dialog offers every album size and a custom one: ' + sizeOptions.slice(0, 3).join(' | '))
  await evaluate(`const set=(el,v,ev)=>{const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');d.set.call(el,v);el.dispatchEvent(new Event(ev,{bubbles:true}))};
    set(document.querySelector('select[aria-label="Album size"]'),'Custom size…','change');`); await wait(300)
  await evaluate(`const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
    const [w,h]=document.querySelectorAll('[aria-label="Custom album size in inches"] input');set(w,'10');set(h,'14');
    const cat=[...document.querySelectorAll('.modal-card input')].find(i=>!i.type||i.type==='text');if(cat)set(cat,'Weddings')`); await wait(300)
  await evaluate(`[...document.querySelectorAll('.modal-card.save-template-dialog button, .save-template-dialog button, .modal-card button')].find(b=>b.textContent.trim()==='Save').click()`); await wait(400)
  const category = await evaluate(`return await window.__ask`)
  assert.equal(category, 'Weddings')
  await evaluate(`window.classify(['t-one'],'Weddings')`)
  assert.deepEqual(await evaluate(`return window.readCollections().sizes`), { '10" x 14" Custom': ['t-one'] }, 'the template is filed under the custom album size')
  await evaluate(`store.getState().selectSpread(${JSON.stringify(ids[0])})`); await wait(500)
  await evaluate(`const re=/Browse.matching/;[...document.querySelectorAll('.spreads-panel__column.is-selected .spread-card-controls button')].find(x=>re.test((x.getAttribute('aria-label')||'')+' '+(x.title||''))).click()`); await wait(2500)
  const filter = await evaluate(`return [...document.querySelectorAll('select[aria-label="Album size category"] option')].map(o=>o.textContent)`)
  assert.deepEqual(filter, ['All album sizes', '10" x 14" Custom'], 'the filter lists the album sizes templates are saved for: ' + JSON.stringify(filter))
  // a bigger font never grows a text out past the spread's wall
  await evaluate('store.getState().closeMatchingTemplates();store.getState().enterDesignerView(' + JSON.stringify(ids[0]) + ');store.getState().addTextBox(' + JSON.stringify(ids[0]) + ",{id:'grow',x:.5,y:.7,width:.6,height:.1,text:'POOKY',fontFamily:'Arial',fontSize:20,color:'#222',align:'left',bold:false,italic:false,autoWidth:false})"); await wait(600)
  await evaluate('store.getState().updateTextBox(' + JSON.stringify(ids[0]) + ",'grow',{fontSize:120})"); await wait(400)
  const grown = await evaluate('const t=store.getState().project.spreads.find(s=>s.id===' + JSON.stringify(ids[0]) + ").textBoxes.find(t=>t.id==='grow');return {x:t.x,y:t.y,right:t.x+t.width,bottom:t.y+t.height,fontSize:t.fontSize}")
  assert.ok(grown.fontSize === 120 && grown.x >= 0 && grown.y >= 0 && grown.right <= 1.001 && grown.bottom <= 1.001, 'the enlarged text stays inside the spread: ' + JSON.stringify(grown))
  console.log('PASS: bins in numerical order with numbered default names, Mixed design label, font panel stays open on spread click, review keyboard shortcuts, album size category and filter')
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
