// A resize handle has to move the panel the way the pointer moves. PanelResizer was written for
// panels that sit AFTER their handle (the timeline, the photo dock, the right sidebar), which grow
// when the handle is dragged back toward the start of the screen. The template browser sits BEFORE
// its handle, and with the same maths it resized the wrong way round: drag down to make it taller
// and it got shorter — and saved that smaller height, so it stayed cramped on every launch.
const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-panel-resizer-qa'); await fs.mkdir(out, { recursive: true })
  const source = `import React from 'react';import {createRoot} from 'react-dom/client';import PanelResizer from './src/components/PanelResizer'
    const App=()=><div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <div id="before-panel" style={{flexShrink:0,height:'var(--before-h)',background:'#357'}}/>
      <PanelResizer axis="y" variable="--before-h" label="before" placed="before" storageKey="qa.before" initial={300} min={100} max={0.8}/>
      <div style={{flex:1}}/>
      <PanelResizer axis="y" variable="--after-h" label="after" initial={200} min={100} max={0.8}/>
      <div id="after-panel" style={{flexShrink:0,height:'var(--after-h)',background:'#753'}}/>
    </div>
    createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false })
  await fs.writeFile(path.join(out, 'fixture.js'), result.outputFiles[0].text)
  await fs.writeFile(path.join(out, 'index.html'), '<html><body style="margin:0"><div id="root"></div><script src="fixture.js"></script></body></html>')
  const win = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { offscreen: true, backgroundThrottling: false } })
  win.webContents.on('console-message', (_, level, message) => { if (level === 3) console.error(message) })
  // The handles remember their size, so a run begins from empty storage or it begins from the
  // last run's.
  await win.webContents.session.clearStorageData()
  await win.loadFile(path.join(out, 'index.html'))
  const run = code => win.webContents.executeJavaScript(`(()=>{${code}})()`)
  const wait = ms => new Promise(r => setTimeout(r, ms))
  await wait(400)

  const height = id => run(`return Math.round(document.getElementById('${id}').getBoundingClientRect().height)`)
  const drag = (label, dy) => run(`
    const h=document.querySelector('[aria-label="${label}"]');h.setPointerCapture=()=>{};
    const r=h.getBoundingClientRect(),y=r.top+r.height/2,ev=(t,yy)=>new PointerEvent(t,{bubbles:true,cancelable:true,clientX:50,clientY:yy,pointerId:3,pointerType:'mouse',isPrimary:true,button:0,buttons:t==='pointerup'?0:1});
    h.dispatchEvent(ev('pointerdown',y));for(let i=1;i<=5;i++)window.dispatchEvent(ev('pointermove',y+${dy}*i/5));window.dispatchEvent(ev('pointerup',y+${dy}));`)
  const key = (label, k) => run(`const h=document.querySelector('[aria-label="${label}"]');h.dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',bubbles:true}))`)

  // A panel before its handle: down is bigger, up is smaller, one pixel of pointer per pixel of size.
  assert.equal(await height('before-panel'), 300)
  await drag('before', 80); await wait(100)
  assert.equal(await height('before-panel'), 380, 'dragging the handle DOWN makes the panel above it taller')
  await drag('before', -130); await wait(100)
  assert.equal(await height('before-panel'), 250, 'dragging the handle UP makes the panel above it shorter')
  await key('before', 'ArrowDown'); await wait(50)
  assert.equal(await height('before-panel'), 260, 'ArrowDown grows a panel above its handle')
  await key('before', 'ArrowUp'); await key('before', 'ArrowUp'); await wait(50)
  assert.equal(await height('before-panel'), 240, 'ArrowUp shrinks it')

  // A panel after its handle keeps behaving as it always did.
  assert.equal(await height('after-panel'), 200)
  await drag('after', -60); await wait(100)
  assert.equal(await height('after-panel'), 260, 'dragging the handle UP makes the panel below it taller')
  await drag('after', 90); await wait(100)
  assert.equal(await height('after-panel'), 170, 'dragging the handle DOWN makes the panel below it shorter')

  // Limits hold in both directions.
  await drag('before', 2000); await wait(100)
  assert.equal(await height('before-panel'), Math.round(0.8 * await run('return innerHeight')), 'it stops at its maximum')
  await drag('before', -2000); await wait(100)
  assert.equal(await height('before-panel'), 100, 'and at its minimum')

  // The size is remembered under the key it was given, not under the variable's name.
  const stored = await run(`return JSON.stringify({keyed:localStorage.getItem('qa.before'),unkeyed:localStorage.getItem('--before-h')})`)
  assert.deepEqual(JSON.parse(stored), { keyed: '100', unkeyed: null }, 'a storageKey redirects where the size is saved')

  console.log('PASS: panel resizer direction for panels before and after their handle, keyboard, limits, storage key')
  win.destroy(); app.quit()
}).catch(e => { console.error(e); app.exit(1) })
