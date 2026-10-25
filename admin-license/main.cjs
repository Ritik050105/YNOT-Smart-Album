const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { readSigningKey, issueLicense, readIssuedLicense } = require('./issuer.cjs');
const { readHistory, rememberLicense } = require('./history.cjs');
const fs = require('fs');
const publicKey = require('./public-key.json');
let win, lastSaved;
let issuing = false;
const historyFile = path.join(app.getPath('userData'), 'license-history.json');
let keyPath = path.join(app.getPath('home'), '.ynot-licensing', 'signing-private.pem');
function keyStatus() {
  try { readSigningKey(keyPath, publicKey); return { path: keyPath, ready: true }; }
  catch { return { path: keyPath, ready: false }; }
}
function registerHandlers() {
  ipcMain.handle('admin:history', () => {
    try { return { rows: readHistory(historyFile).map(row => ({ ...row, missing: !fs.existsSync(row.path) })) }; }
    catch { return { error: 'License history could not be read. Restore its backup before issuing more licenses.' }; }
  });
  ipcMain.handle('admin:add-existing', async () => {
    if (issuing) return { error: 'Finish saving the current license first.' };
    const result = await dialog.showOpenDialog(win, { title: 'Add an existing signed license to history', properties: ['openFile'], filters: [{ name: 'YNOT license', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try { rememberLicense(historyFile, readIssuedLicense(result.filePaths[0], publicKey)); return {}; }
    catch { return { error: 'Could not add this license. Check its signature and history folder permissions.' }; }
  });
  ipcMain.handle('admin:history-file', async (_event, deviceId, reveal) => {
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
  ipcMain.handle('admin:key-status' , () => keyStatus());
  ipcMain.handle('admin:choose-key', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'Choose administrator signing key', properties: ['openFile'], filters: [{ name: 'Private signing key', extensions: ['pem'] }] });
    if (!result.canceled && result.filePaths[0]) {
      try { readSigningKey(result.filePaths[0], publicKey); keyPath = result.filePaths[0]; }
      catch { return { ...keyStatus(), error: 'That file is not the matching private signing key.' }; }
    }
    return keyStatus();
  });
  ipcMain.handle('admin:issue', async (_event, input) => {
    if (!input || typeof input.deviceId !== 'string' || !/^[a-f0-9]{64}$/i.test(input.deviceId.trim()) || typeof input.client !== 'string' || !input.client.trim() || input.client.trim().length > 200) return { error: 'Enter a valid PC ID and client name.' };
    if (issuing) return { error: 'A license is already being saved.' };
    try {
      if (readHistory(historyFile).some(row => row.deviceId === input.deviceId.trim().toLowerCase())) return { error: 'A license was already issued for this PC. Open its existing file in License history.' };
    } catch { return { error: 'History is unavailable. Restore it before issuing a license.' }; }
    if (!keyStatus().ready) return { error: 'Choose the matching private signing key first.' };
    issuing = true;
    try {
    const result = await dialog.showSaveDialog(win, { title: 'Save client PC license', defaultPath: path.join(app.getPath('documents'), 'YNOT-client-license.json'), filters: [{ name: 'YNOT license', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      issueLicense(input.deviceId, input.client, result.filePath, keyPath, publicKey);
      lastSaved = result.filePath;
      try { rememberLicense(historyFile, readIssuedLicense(lastSaved, publicKey)); }
      catch { return { path: lastSaved, warning: 'License saved, but history could not be updated. Keep this file and use Add existing license to record it.' }; }
      return { path: lastSaved };
    } catch (error) {
      return { error: error.code === 'EEXIST' ? 'That file already exists. Choose a new filename to preserve the existing license.' : 'Could not save the license. Check the signing key and folder permissions, then try again.' };
    }
    } finally { issuing = false; }
  });
  ipcMain.handle('admin:reveal', () => { if (lastSaved) shell.showItemInFolder(lastSaved); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
  registerHandlers();
  win = new BrowserWindow({ width: 680, height: 760, minWidth: 540, minHeight: 600, title: 'YNOT License Admin', autoHideMenuBar: true, backgroundColor: '#f3f6fc', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
