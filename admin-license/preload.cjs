const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('licenseAdmin', {
  keyStatus: () => ipcRenderer.invoke('admin:key-status'),
  chooseKey: () => ipcRenderer.invoke('admin:choose-key'),
  issue: input => ipcRenderer.invoke('admin:issue', input),
  reveal: () => ipcRenderer.invoke('admin:reveal'),
});
