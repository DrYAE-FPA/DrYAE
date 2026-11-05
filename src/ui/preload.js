const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('DRYAE_LANG', ipcRenderer.sendSync('i18n:lang'));
contextBridge.exposeInMainWorld('dryae', {
  call: async (ch, ...a) => {
    const r = await ipcRenderer.invoke(ch, ...a);
    if (r && r.ok === false) throw new Error(r.error);
    return r ? r.v : undefined;
  },
  on: (ch, fn) => ipcRenderer.on(ch, (_e, v) => fn(v)),
  pathFor: f => { try { return webUtils.getPathForFile(f); } catch { return f.path || ''; } },
});
