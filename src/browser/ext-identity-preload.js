// DrYAE — extensions Chrome : fonction de connexion « identity » (connexion à un compte dans une fenêtre,
// puis retour vers l'extension). Electron ne la fournit pas ; DrYAE l'ajoute avant que l'objet « chrome » soit figé.
const { contextBridge, ipcRenderer } = require('electron');
if (process.type === 'service-worker' || (typeof location !== 'undefined' && location.href.startsWith('chrome-extension://'))) {
  try {
    contextBridge.exposeInMainWorld('__dryaeIdentity', { auth: (url, interactive) => ipcRenderer.invoke('dryae-identity-auth', String(url || ''), !!interactive) });
    contextBridge.executeInMainWorld({
      func: () => {
        try {
          const bridge = globalThis.__dryaeIdentity; delete globalThis.__dryaeIdentity;
          const c = globalThis.chrome; if (!c || !c.runtime || c.identity) return;
          const lastError = (cb, e) => { try { Object.defineProperty(c.runtime, 'lastError', { value: { message: e.message }, configurable: true }); cb(); delete c.runtime.lastError; } catch {} };
          const identity = {
            getRedirectURL: (p) => `https://${c.runtime.id}.chromiumapp.org/${String(p || '').replace(/^\//, '')}`,
            launchWebAuthFlow: (details, cb) => {
              const p = bridge.auth(details && details.url, details && details.interactive);
              if (typeof cb === 'function') { p.then(u => cb(u), e => lastError(() => cb(undefined), e)); return; }
              return p;
            },
            getAuthToken: (o, cb) => { const e = new Error('getAuthToken is not supported in DrYAE'); if (typeof (cb || o) === 'function') return lastError(() => (cb || o)(undefined), e); return Promise.reject(e); },
            removeCachedAuthToken: (o, cb) => { if (typeof cb === 'function') cb(); return Promise.resolve(); },
            clearAllCachedAuthTokens: (cb) => { if (typeof cb === 'function') cb(); return Promise.resolve(); },
            getProfileUserInfo: (o, cb) => { const r = { email: '', id: '' }; const f = typeof o === 'function' ? o : cb; if (f) f(r); return Promise.resolve(r); },
            onSignInChanged: { addListener() {}, removeListener() {}, hasListener: () => false },
          };
          Object.defineProperty(c, 'identity', { value: identity, enumerable: true, configurable: true });
        } catch {}
      },
    });
  } catch {}
}
