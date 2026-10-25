const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict'), Module = require('module');
const { generateKeyPairSync } = require('crypto');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ynot-admin-test-'));
app.setPath('userData', path.join(root, 'profile'));
app.disableHardwareAcceleration();
const keys = generateKeyPairSync('ed25519');
const pub = keys.publicKey.export({ type: 'spki', format: 'pem' });
const keyFile = path.join(root, 'private.pem');
fs.writeFileSync(keyFile, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
const wrongKey = path.join(root, 'wrong.pem');
fs.writeFileSync(wrongKey, generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }));
const output = path.join(root, 'client-license.json');
let choice, save, revealed;
const original = Module._load;
Module._load = function(id, parent, ...rest) {
  if (parent?.filename.endsWith(path.join('admin-license', 'main.cjs'))) {
    if (id === './public-key.json') return pub;
    if (id === 'electron') return { ...original.call(this,id,parent,...rest), app: { getPath: name => name === 'home' || name === 'documents' ? root : app.getPath(name), whenReady: () => app.whenReady(), on: () => {}, quit: () => {} }, BrowserWindow: class extends BrowserWindow { constructor(options) { super({ ...options, show: false, webPreferences: { ...options.webPreferences, offscreen: true, backgroundThrottling: false } }); } }, dialog: { showOpenDialog: async () => ({ canceled: !choice, filePaths: choice ? [choice] : [] }), showSaveDialog: async () => ({ canceled: !save, filePath: save }) }, shell: { showItemInFolder: p => revealed = p } };
  }
  return original.call(this,id,parent,...rest);
};
require('../admin-license/main.cjs');
const wait = () => new Promise(resolve => setTimeout(resolve, 120));
app.whenReady().then(async () => {
  await wait();
  const win = BrowserWindow.getAllWindows()[0];
  if (win.webContents.isLoading()) await new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  const run = code => win.webContents.executeJavaScript(code);
  await wait();
  assert.equal(await run(`document.getElementById('generate').disabled`), true);
  choice = wrongKey; await run(`document.getElementById('choose').click()`); await wait();
  assert.match(await run(`document.getElementById('status').textContent`), /not the matching/);
  choice = keyFile; await run(`document.getElementById('choose').click()`); await wait();
  await run(`document.getElementById('client').value='Client Studio';document.getElementById('device').value='invalid';document.getElementById('form').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await run(`document.getElementById('generate').disabled`), true);
  await run(`document.getElementById('device').value='  '+ 'A'.repeat(64)+'  ';document.getElementById('form').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await run(`document.getElementById('generate').disabled`), false);
  await run(`document.getElementById('generate').click()`); await wait();
  assert.match(await run(`document.getElementById('status').textContent`), /canceled/); assert(!fs.existsSync(output));
  save = output; await run(`document.getElementById('generate').click()`); await wait();
  const bytes = fs.readFileSync(output,'utf8');
  const { validateLicense } = require('../dist-electron/license');
  validateLicense(bytes, 'a'.repeat(64), pub);
  assert.throws(() => validateLicense(bytes, 'b'.repeat(64), pub));
  assert.equal(await run(`document.getElementById('reveal').hidden`), false);
  await run(`document.getElementById('reveal').click()`); await wait(); assert.equal(revealed, output);
  const shot = path.join(os.tmpdir(), 'ynot-license-admin-qa.png'); fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
  await run(`document.getElementById('generate').click()`); await wait();
  assert.match(await run(`document.getElementById('status').textContent`), /already exists/);
  assert.equal(fs.readFileSync(output,'utf8'), bytes);
  const { issueLicense } = require('../admin-license/issuer.cjs');
  for (const id of ['', 'g'.repeat(64), null]) assert.throws(() => issueLicense(id, 'Client', output+'.bad', keyFile, pub));
  assert.throws(() => issueLicense('a'.repeat(64), '', output+'.bad', keyFile, pub));
  assert.throws(() => issueLicense('a'.repeat(64), 'Client', output+'.bad', wrongKey, pub));
  assert(!fs.existsSync(output+'.bad'));
  console.log('Admin GUI passed: missing/wrong key, invalid ID, canceled save, signed license accepted by client, wrong-PC rejection, reveal and overwrite protection. Screenshot: '+shot);
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Module._load = original;
  for (const win of BrowserWindow.getAllWindows()) win.destroy();
  // Electron profile files can remain open until exit; remove only test keys and licenses here.
  for (const file of [keyFile, wrongKey, output]) if (fs.existsSync(file)) fs.unlinkSync(file);
  app.exit(process.exitCode || 0);
});
