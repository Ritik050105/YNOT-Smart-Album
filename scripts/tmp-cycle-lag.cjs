const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-cycle-lag'); await fs.mkdir(out, { recursive: true })
  const source = `import Konva from 'konva';window.Konva=Konva;import React from 'react';import{createRoot}from'react-dom/client';import App from './src/App';import{useProjectStore as store}from'./src/state/projectStore';window.store=store;createRoot(document.getElementById('root')).render(<App/>)`
  const result = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false, loader: { '.bin':'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' } })
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
  const N = Number(process.argv[2] || 6)
  await evaluate(`
    const s=store.getState();s.createProjectFromWizard({name:'Lag',size:{...s.project.size,widthIn:36,heightIn:12}});
    const photos=[];for(let i=0;i<${N};i++){const w=i%3===1?800:1200,h=i%3===1?1200:800,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='hsl('+(i*47)%360+',65%,50%)';g.fillRect(0,0,w,h);
      photos.push({id:'p'+i,fileName:'p'+i+'.jpg',src:c.toDataURL('image/jpeg',0.5),width:w,height:h,megapixels:1,orientation:w>h?'landscape':'portrait',mimeType:'image/jpeg',capturedAt:new Date(i*1000).toISOString(),bins:[],favorite:false})}
    store.getState().addPhotos(photos);store.getState().insertTimelinePhotos(photos.map(p=>p.id),null);`)
  await wait(1200)
  await evaluate(`document.querySelector('.spreads-panel__column .spread-thumb').click()`); await wait(9000)
  // time from the key to the card showing the new layout (the canvas pixels change), one press at a time and held
  await evaluate('window.__sig=()=>{const c=document.querySelector(".spreads-panel__column.is-selected canvas");if(!c||!c.width)return "";const t=document.createElement("canvas");t.width=24;t.height=12;const g=t.getContext("2d");g.drawImage(c,0,0,24,12);return Array.from(g.getImageData(0,0,24,12).data).join(",")};window.__first=(ms)=>new Promise(res=>{const base=window.__sig(),t0=performance.now();const tick=()=>{if(window.__sig()!==base)res(Math.round(performance.now()-t0));else if(performance.now()-t0>ms)res(-1);else requestAnimationFrame(tick)};tick()})')
  for (let i = 0; i < 4; i++) {
    const t = await evaluate('const w=window.__first(3000);window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));return await w')
    console.log('key to first changed pixel', i + 1, t, 'ms'); await wait(900)
  }
  const dbg = win.webContents.debugger; dbg.attach('1.3'); await dbg.sendCommand('Profiler.enable'); await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 500 }); await dbg.sendCommand('Profiler.start')
  const held = await evaluate('const t0=performance.now();for(let i=0;i<24;i++){window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true,repeat:i>0}));await new Promise(r=>setTimeout(r,35))}await new Promise(r=>setTimeout(r,500));return {sentIn:Math.round(performance.now()-t0)}')
  const { profile } = await dbg.sendCommand('Profiler.stop')
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map()
  for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id)
  const incl = new Map(), dt = profile.timeDeltas
  profile.samples.forEach((id, i) => { const seen = new Set(); for (let cur = id; cur; cur = parent.get(cur)) { const n = byId.get(cur), key = (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop().slice(0, 24) + ':' + n.callFrame.lineNumber; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + (dt[i] || 0)) } } })
  const top = [...incl.entries()].sort((x, y) => y[1] - x[1]).slice(0, 40).map(([k, v]) => (v / 1000).toFixed(0).padStart(6) + ' ms  ' + k)
  console.log('held key', JSON.stringify(held)); console.log(top.join(String.fromCharCode(10)))
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
