const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { readSigningKey, issueLicense } = require('./issuer.cjs');
const publicKey = require('./public-key.json');
let win, lastSaved;
let keyPath = path.join(app.getPath('home'), '.ynot-licensing', 'signing-private.pem');
function keyStatus() {
  try { readSigningKey(keyPath, publicKey); return { path: keyPath, ready: true }; }
  catch { return { path: keyPath, ready: false }; }
}
function registerHandlers() {
  ipcMain.handle('admin:key-status', () => keyStatus());
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
    if (!keyStatus().ready) return { error: 'Choose the matching private signing key first.' };
    const result = await dialog.showSaveDialog(win, { title: 'Save client PC license', defaultPath: path.join(app.getPath('documents'), 'YNOT-client-license.json'), filters: [{ name: 'YNOT license', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      issueLicense(input.deviceId, input.client, result.filePath, keyPath, publicKey);
      lastSaved = result.filePath;
      return { path: lastSaved };
    } catch (error) {
      return { error: error.code === 'EEXIST' ? 'That file already exists. Choose a new filename to preserve the existing license.' : 'Could not save the license. Check the signing key and folder permissions, then try again.' };
    }
  });
  ipcMain.handle('admin:reveal', () => { if (lastSaved) shell.showItemInFolder(lastSaved); });
}
app.whenReady().then(() => {
  registerHandlers();
  win = new BrowserWindow({ width: 680, height: 760, minWidth: 540, minHeight: 600, title: 'YNOT License Admin', autoHideMenuBar: true, backgroundColor: '#f3f6fc', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
