const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('licenseAdmin', {
  history: () => ipcRenderer.invoke('admin:history'),
  addExisting: () => ipcRenderer.invoke('admin:add-existing'),
  historyFile: (deviceId, reveal) => ipcRenderer.invoke('admin:history-file', deviceId, reveal),
  keyStatus: () => ipcRenderer.invoke('admin:key-status'),
  chooseKey: () => ipcRenderer.invoke('admin:choose-key'),
  issue: input => ipcRenderer.invoke('admin:issue', input),
  reveal: () => ipcRenderer.invoke('admin:reveal'),
});
