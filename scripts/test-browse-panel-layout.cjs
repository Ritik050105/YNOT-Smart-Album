// Opening a template browser must not wreck the page.
//
// Three things used to go wrong. (1) The browser opened and the spread you had pressed Browse on
// slid sideways — the cover shrank on its own while the spreads did not, and the strip, now
// narrower, had its scroll position clamped; closing grew everything back without restoring it, so
// the spread ended up at the edge of the window or off it. (2) The photo dock was hidden outright
// while an image or mixed browser was open, taking the photographs away exactly when you are
// choosing a layout for them. (3) With the font browser open the dock stayed at full size and the
// overview was squeezed to a sliver, cards and their controls overlapping.
const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const out = path.join(app.getPath('temp'), 'ynot-browse-layout-qa'); await fs.mkdir(out, { recursive: true })
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

  // Put the fourth spread in the middle of the view and select it.
  await evaluate(`const cols=[...document.querySelectorAll('.spreads-panel__column')];cols[3].scrollIntoView({inline:'center',block:'nearest'});cols[3].querySelector('.spread-thumb').click()`)
  await settle()
  const before = await measure()
  assert.ok(before.sel && before.sel.x > 0 && before.sel.x + before.sel.w < before.inner[0], `the fourth spread is in view to begin with: ${JSON.stringify(before.sel)}`)
  assert.ok(before.dock && before.dock.h > 120, 'the photo dock is showing before any browser is open')

  // Matched on the label with '.' between the words, because these labels hold a non-breaking space that a plain
  // substring never matches, and some of the buttons carry a title while others only an aria-label.
  const open = (kind) => evaluate(`const re=new RegExp(${JSON.stringify(kind.split(' ').join('.'))});const b=[...document.querySelectorAll('.spreads-panel__column.is-selected .spread-card-controls button')].find(x=>re.test((x.getAttribute('aria-label')||'')+' '+(x.title||'')));b.click()`)
  const closeIt = () => evaluate(`const b=document.querySelector('button[aria-label*="Close matching"], button[title*="Close matching"], .font-template-browser button[aria-label*="Close"]');b&&b.click();return !!b`)

  for (const [label, trigger] of [['image browser', 'Browse matching'], ['mixed browser', 'Browse mixed'], ['font browser', 'Browse text']]) {
    await open(trigger); await settle(); await wait(400); await settle()
    const m = await measure()
    assert.ok(m.browser, `${label} opened`)

    // (1) The spread you were working on stays where it was, horizontally, and in view. It may move
    // down — a panel went in above it. Sideways it can only travel as far as the strip allows: with
    // smaller cards the strip is narrower, so a scroll position near its far end cannot be held and the
    // spread settles at the strip's own limit. That is fine; what is not is losing it, or not bringing
    // it back, so both are checked: in view while open, exactly restored on close.
    const atALimit = m.scrollLeft <= 1 || m.scrollLeft >= m.maxScroll - 1
    assert.ok(atALimit || Math.abs(m.sel.x - before.sel.x) <= 3, `${label}: the selected spread slid sideways from x=${before.sel.x} to x=${m.sel.x} with room to spare (scroll ${before.scrollLeft} -> ${m.scrollLeft} of ${m.maxScroll})`)
    assert.ok(m.sel.x >= 0 && m.sel.x + m.sel.w <= m.inner[0] + 2, `${label}: the selected spread is still in view: ${JSON.stringify(m.sel)}`)
    // The cover and the spreads are one size, as they are with nothing open.
    assert.ok(Math.abs(m.cover.w - m.sel.w) <= 2, `${label}: the cover (${m.cover.w}px) shrank on its own while the spreads are ${m.sel.w}px`)

    // (2) The photographs stay available while a browser is open.
    assert.ok(m.dock && m.dock.h >= 100, `${label}: the photo dock is still showing (${JSON.stringify(m.dock)})`)
    assert.ok(m.dock.bottom <= m.inner[1] + 1, `${label}: the dock stays inside the window`)

    // (3) The overview keeps room to be used: the cards are real cards and their controls are inside them.
    assert.ok(m.sel.h >= 170, `${label}: the overview was squeezed to ${m.sel.h}px`)
    assert.ok(m.row.bottom <= m.dock.y + 2, `${label}: the overview runs under the dock`)
    assert.ok(m.browser.h <= Math.round(m.inner[1] * 0.34) + 2, `${label}: the browser takes more than a third of the window (${m.browser.h}px)`)
    // Every control sits inside the bar's own box. In the compact bar there are two rows, and nine
    // buttons that did not fit on one wrapped onto a third that hung below the bar's background.
    assert.ok(m.controls && m.controls.bottom <= m.bar.bottom + 1 && m.controls.top >= m.bar.y - 1, `${label}: some of the spread's controls hang outside its bar: ${JSON.stringify({ bar: m.bar, controls: m.controls })}`)
    assert.ok(m.bar && m.bar.bottom <= m.sel.bottom + 1 && m.bar.w <= m.sel.w + 1, `${label}: the spread's controls are not inside its card: ${JSON.stringify({ bar: m.bar, sel: m.sel })}`)
    await fs.writeFile(path.join(out, `${trigger.replace(/ /g, '-')}-open.png`), (await win.webContents.capturePage()).toPNG())

    await closeIt(); await settle(); await wait(300); await settle()
    const closed = await measure()
    assert.ok(!(await evaluate(`return !!document.querySelector('.matching-templates, .font-template-browser')`)), `${label} closed`)
    assert.ok(Math.abs(closed.sel.x - before.sel.x) <= 3 && Math.abs(closed.sel.y - before.sel.y) <= 3,
      `${label}: closing it left the spread at (${closed.sel.x},${closed.sel.y}) instead of (${before.sel.x},${before.sel.y})`)
    assert.ok(Math.abs(closed.scrollLeft - before.scrollLeft) <= 3, `${label}: closing it changed the scroll from ${before.scrollLeft} to ${closed.scrollLeft}`)
    assert.equal(closed.sel.w, before.sel.w, `${label}: the cards did not return to their size`)
  }

  console.log('PASS: browse panels keep the selected spread in place, keep the photo dock, and leave the overview usable')
  win.destroy(); app.quit()
}).catch((e) => { console.error(e); app.exit(1) })
