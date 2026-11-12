const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { fetchText } = require('./lyrics-fetch.cjs');
// Сохраняем профиль старой версии 1.7.0 (name: puro-cielo).
app.setName('puro-cielo');
app.setPath('userData', path.join(app.getPath('appData'), 'puro-cielo'));
let win;
const playerFile = path.join(__dirname, 'renderer', 'index.html');
const playerURL = pathToFileURL(playerFile).href;
function external(raw) {
  try { const u = new URL(raw); if (['https:', 'http:'].includes(u.protocol)) shell.openExternal(u.href).catch(() => {}); } catch {}
}
ipcMain.handle('fetch-text', (event, url) => win && event.sender === win.webContents ? fetchText(url) : '');
function create() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1320, height: 860, minWidth: 420, minHeight: 600,
    backgroundColor: '#111113', title: 'Puro Cielo', autoHideMenuBar: true,
    icon: path.join(__dirname, 'renderer', 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Разрешаем локальное окно мини-плеера, которое заполняется самим приложением.
    if (!url || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: {
      width: 300, height: 420, autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    } };
    external(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] === playerURL) return;
    event.preventDefault();
    external(url);
  });
  win.on('closed', () => { win = null; });
  win.loadFile(playerFile);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(create);
  app.on('window-all-closed', () => app.quit());
}
