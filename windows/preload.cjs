const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('PuroDesktop', {
  fetchText: url => ipcRenderer.invoke('fetch-text', url),
});
