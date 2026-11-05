const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DRYAE_LANG', ipcRenderer.sendSync('i18n:lang'));
contextBridge.exposeInMainWorld('br', {
  call: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, v) => fn(v)),
});
// barre d'icônes des extensions Chrome (<browser-action-list>)
try { require('electron-chrome-extensions/browser-action').injectBrowserAction(); } catch (e) { console.error('browser-action', e.message); }
