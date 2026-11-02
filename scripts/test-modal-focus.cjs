const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ynot-dialog-focus-'))
  const result = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import Modal from './src/components/Modal';
    function Test(){const [open,setOpen]=React.useState(false),[nested,setNested]=React.useState(false),[count,setCount]=React.useState(0);
      return <><button id="launch" onClick={()=>setOpen(true)}>Open</button><button id="outside">Outside</button>
      {open&&<Modal title="Outer" onClose={()=>setOpen(false)}><input id="first"/><button id="rerender" onClick={()=>setCount(count+1)}>Update {count}</button><button id="nested" onClick={()=>setNested(true)}>Nested</button><button id="last">Last</button></Modal>}
      {nested&&<Modal title="Inner" onClose={()=>setNested(false)}><input id="inner" autoFocus/></Modal>}</>}
    createRoot(document.getElementById('root')).render(<Test/>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'browser', write: false })
  await fs.writeFile(path.join(dir, 'app.js'), result.outputFiles[0].text)
  await fs.writeFile(path.join(dir, 'index.html'), '<div id="root"></div><script src="app.js"></script>')
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
  await win.loadFile(path.join(dir, 'index.html'))
  const run = code => win.webContents.executeJavaScript(code)
  const wait = () => new Promise(resolve => setTimeout(resolve, 80))
  await wait()
  await run('document.querySelector("#launch").focus();document.querySelector("#launch").click()'); await wait()
  assert.equal(await run('!!document.activeElement.closest("[role=dialog]")'), true, 'Opening a dialog moves focus inside')
  await run('document.querySelector("#last").focus();window.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",cancelable:true}))')
  assert.equal(await run('document.activeElement.getAttribute("aria-label")'), 'Close', 'Tab wraps to first control')
  await run('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,cancelable:true}))')
  assert.equal(await run('document.activeElement.id'), 'last', 'Shift Tab wraps back')
  await run('document.querySelector("#first").focus();document.querySelector("#rerender").click()'); await wait()
  assert.equal(await run('document.activeElement.id'), 'first', 'Rerenders preserve field focus')
  await run('document.querySelector("#nested").focus();document.querySelector("#nested").click()'); await wait()
  assert.equal(await run('document.activeElement.closest("[role=dialog]").getAttribute("aria-label")'), 'Inner')
  await run('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",cancelable:true}))'); await wait()
  assert.equal(await run('document.querySelectorAll("[role=dialog]").length'), 1, 'Escape closes only top dialog')
  assert.equal(await run('document.activeElement.id'), 'nested', 'Nested close restores its trigger')
  await run('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",cancelable:true}))'); await wait()
  assert.equal(await run('document.activeElement.id'), 'launch', 'Close restores original trigger')
  console.log('PASS: dialog focus entry, Tab wrapping, rerenders, nested Escape and focus restoration')
  win.destroy(); app.quit()
}).catch(error => { console.error(error); app.exit(1) })
