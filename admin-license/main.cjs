const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const { readSigningKey, issueLicenseWithKey, readIssuedLicense } = require('./issuer.cjs');
const { readHistory, rememberLicense } = require('./history.cjs');
const fs = require('fs');
const { exportBackup, prepareRestore, restoreBackup } = require('./backup.cjs');
const publicKey = require('./public-key.json');
const {AdminAuth}=require('./auth.cjs');
const auth=new AdminAuth(path.join(app.getPath('userData'),'owner-vault.json'));
let win, lastSaved;
let issuing = false;
let pendingRestore = null;
const historyFile = path.join(app.getPath('userData'), 'license-history.json');
let keyPath = path.join(app.getPath('home'), '.ynot-licensing', 'signing-private.pem');
function keyStatus() { try {auth.getKey();return {path:'Encrypted owner vault',ready:true};}catch{return {path:'Choose the original studio signing key',ready:false};} }
function registerHandlers() {
  const handle=(name,fn)=>ipcMain.handle(name,(event,...args)=>{
    if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!auth.status().authenticated)return {error:'Sign in to the owner tool first.'};
    return fn(event,...args);
  });
  ipcMain.handle('admin:auth-status',()=>auth.status());
  ipcMain.handle('admin:auth',(_event,input)=>{
    try{
      if(!win||_event.sender!==win.webContents||_event.senderFrame!==win.webContents.mainFrame)throw Error('Invalid window.');
      if(input?.action==='lock'){auth.lock();pendingRestore=null;issuing=false;return auth.status();}
      if(input?.action==='setup')auth.setup(input.username,input.password);else if(input?.action==='login')auth.login(input.username,input.password);else throw Error('Unknown login action.');
      return auth.status();
    }catch(e){return {...auth.status(),error:e.message};}
  });
  handle('admin:detect-pc', () => {
    try { return { deviceId: require('./device-license.cjs').deviceId() }; }
    catch { return { error: 'Could not identify this computer (Windows or Mac). Your entered PC ID was kept. Try again or copy the ID from Album Studio.' }; }
  });
  handle('admin:backup', async () => {
    if (issuing) return { error: 'Finish the current operation first.' };
    issuing = true;
    try {
      const result = await dialog.showSaveDialog(win, { title: 'Back up history and licenses', defaultPath: path.join(app.getPath('documents'), 'YNOT-license-backup.json'), filters: [{ name: 'YNOT license backup', extensions: ['json'] }] });
      if (result.canceled || !result.filePath) return { canceled: true };
      const count = exportBackup(historyFile, result.filePath, publicKey);
      return { message: `Backup saved with ${count} license(s): ${result.filePath}` };
    } catch (error) { return { error: error.code === 'EEXIST' ? 'Backup already exists. Choose a new filename.' : error.message || 'Backup failed.' }; }
    finally { issuing = false; }
  });
  handle('admin:restore', async () => {
    if (issuing) return { error: 'Finish the current operation first.' };
    issuing = true;
    try {
      const result = await dialog.showOpenDialog(win, { title: 'Restore history and licenses', properties: ['openFile'], filters: [{ name: 'YNOT license backup', extensions: ['json'] }] });
      if (result.canceled || !result.filePaths[0]) return { canceled: true };
      const plan = prepareRestore(historyFile, result.filePaths[0], publicKey);
      pendingRestore = plan;
      return { preview: { rows: plan.rows, added: plan.added, repaired: plan.repaired, unchanged: plan.unchanged, conflicts: plan.conflicts } };
    } catch (error) { return { error: error.message || 'Could not preview this backup.' }; }
    finally { if (!pendingRestore) issuing = false; }
  });
  handle('admin:finish-restore', (_event, apply) => {
    if (!pendingRestore || typeof apply !== 'boolean') return { error: 'Open a backup preview first.' };
    const plan = pendingRestore;
    try {
      if (!apply) return { canceled: true };
      restoreBackup(historyFile, plan);
      return { message: `Restored ${plan.added} new PC(s) and ${plan.repaired} missing file(s); ${plan.unchanged} already recorded.` };
    } catch (error) { return { error: error.message || 'Restore failed. Existing history was preserved.' }; }
    finally { pendingRestore = null; issuing = false; }
  });
  handle('admin:history', () => {
    try { return { rows: readHistory(historyFile).map(row => ({ ...row, missing: !fs.existsSync(row.path) })) }; }
    catch { return { error: 'License history could not be read. Restore its backup before issuing more licenses.' }; }
  });
  handle('admin:add-existing', async () => {
    if (issuing) return { error: 'Finish saving the current license first.' };
    issuing = true;
    try {
    const result = await dialog.showOpenDialog(win, { title: 'Add an existing signed license to history', properties: ['openFile'], filters: [{ name: 'YNOT license', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try { rememberLicense(historyFile, readIssuedLicense(result.filePaths[0], publicKey)); return {}; }
    catch { return { error: 'Could not add this license. Check its signature and history folder permissions.' }; }
    } finally { issuing = false; }
  });
  handle('admin:history-file', async (_event, deviceId, reveal) => {
    try {
      const row = readHistory(historyFile).find(row => row.deviceId === deviceId);
      if (!row) throw new Error('Unknown history entry.');
      const actual = readIssuedLicense(row.path, publicKey);
      if (actual.deviceId !== row.deviceId || actual.client !== row.client || actual.issuedAt !== row.issuedAt) throw new Error('File changed.');
      if (reveal === true) shell.showItemInFolder(row.path);
      else { const error = await shell.openPath(row.path); if (error) throw new Error(error); }
      return {};
    } catch { return { error: 'The saved license is missing, changed, or cannot be opened. Use Add existing license to locate the original file.' }; }
  });
  handle('admin:key-status' , () => keyStatus());
  handle('admin:choose-key', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Choose administrator signing key', properties: ['openFile'], filters: [{ name: 'Private signing key', extensions: ['pem'] }] });
    if (!result.canceled && result.filePaths[0]) {
      try { auth.storeKey(readSigningKey(result.filePaths[0], publicKey)); }
      catch { return { ...keyStatus(), error: 'That file is not the matching private signing key.' }; }
    }
    return keyStatus();
  });
  handle('admin:issue', async (_event, input) => {
    if (!input || typeof input.deviceId !== 'string' || !/^[a-f0-9]{64}$/i.test(input.deviceId.trim()) || typeof input.client !== 'string' || !input.client.trim() || input.client.trim().length > 200) return { error: 'Enter a valid PC ID and employee name.' };
    if (issuing) return { error: 'A license is already being saved.' };
    try {
      if (readHistory(historyFile).some(row => row.deviceId === input.deviceId.trim().toLowerCase())) return { error: 'A license was already issued for this PC. Open its existing file in License history.' };
    } catch { return { error: 'History is unavailable. Restore it before issuing a license.' }; }
    if (!keyStatus().ready) return { error: 'Choose the matching private signing key first.' };
    issuing = true;
    try {
    const result = await dialog.showSaveDialog(win, { title: 'Save employee PC license', defaultPath: path.join(app.getPath('documents'), 'YNOT-employee-license.json'), filters: [{ name: 'YNOT license', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      issueLicenseWithKey(input.deviceId, input.client, result.filePath, auth.getKey());
      lastSaved = result.filePath;
      try { rememberLicense(historyFile, readIssuedLicense(lastSaved, publicKey)); }
      catch { return { path: lastSaved, warning: 'License saved, but history could not be updated. Keep this file and use Add existing license to record it.' }; }
      return { path: lastSaved };
    } catch (error) {
      return { error: error.code === 'EEXIST' ? 'That file already exists. Choose a new filename to preserve the existing license.' : 'Could not save the license. Check the signing key and folder permissions, then try again.' };
    }
    } finally { issuing = false; }
  });
  handle('admin:revoke', async (_event, device) => {
    if(issuing)return {error:'Finish the current operation first.'};
    issuing=true;
    try{
      const row=readHistory(historyFile).find(r=>r.deviceId===device);if(!row)throw Error('Choose a license from history.');
      const key=auth.getKey();
      const confirm=await dialog.showMessageBox(win,{type:'warning',message:'Create offline revocation for '+row.client+'?',detail:'This file must be imported using Help → Import license revocation on the employee PC. It cannot remotely disable a disconnected PC. Projects are preserved. Old app versions do not enforce this revocation.',buttons:['Cancel','Create revocation'],defaultId:0,cancelId:0});
      if(confirm.response!==1)return {canceled:true};
      const output=await dialog.showSaveDialog(win,{title:'Save signed revocation',defaultPath:path.join(app.getPath('documents'),'YNOT-revocation-'+device.slice(0,12)+'.json'),filters:[{name:'Signed revocation',extensions:['json']}]});if(output.canceled||!output.filePath)return {canceled:true};
      const payload=Buffer.from(JSON.stringify({version:1,product:'com.ynotphotography.albumstudio',action:'revoke',deviceId:device,revokedThrough:new Date().toISOString()}));
      fs.writeFileSync(output.filePath,JSON.stringify({payload:payload.toString('base64'),signature:require('crypto').sign(null,payload,key).toString('base64')}),{flag:'wx'});
      return {message:'Revocation file saved. Import it on the employee PC to enforce it; this PC has not been remotely disabled.',path:output.filePath};
    }catch(e){return {error:e.message};}finally{issuing=false;}
  });
  handle('admin:reveal' , () => { if (lastSaved) shell.showItemInFolder(lastSaved); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
  registerHandlers();
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
  win = new BrowserWindow({ width: 680, height: 760, minWidth: 540, minHeight: 600, title: 'YNOT License Admin', icon: path.join(__dirname, 'logo.png'), autoHideMenuBar: true, backgroundColor: '#f3f6fc', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.webContents.on('did-start-navigation', () => { auth.lock(); if (pendingRestore) { pendingRestore = null; issuing = false; } });
  if (process.platform !== 'darwin') win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
