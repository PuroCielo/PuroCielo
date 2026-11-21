const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('PuroDesktop', {
  alignLyrics: payload => ipcRenderer.invoke('align-lyrics', payload),
  cancelAlignment: () => ipcRenderer.invoke('cancel-alignment'),
  fetchText: url => ipcRenderer.invoke('fetch-text', url),
});
