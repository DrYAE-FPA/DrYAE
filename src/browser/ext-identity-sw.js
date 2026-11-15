// DrYAE — connexion « identity » pour le service de fond (service worker) des extensions Chrome.
// Electron ne lance pas les préchargements dans ces services : DrYAE place ce petit fichier avant le script
// de l'extension. La fenêtre de connexion est ouverte par DrYAE (petit service local de DrYAE, sur ce PC seulement).
(() => {
  try {
    const c = globalThis.chrome; if (!c || !c.runtime || c.identity) return;
    const lastError = (cb, e) => { try { Object.defineProperty(c.runtime, 'lastError', { value: { message: e.message }, configurable: true }); cb(); delete c.runtime.lastError; } catch {} };
    // DrYAE écoute sur ce PC seulement (127.0.0.1), sur le premier port libre entre 47811 et 47830
    let port = 0;
    const find = async () => { if (port) return port; for (let p = 47811; p <= 47830; p++) { try { const r = await fetch(`http://127.0.0.1:${p}/dryae-id/ping`); if (r.ok && (await r.json()).dryae) return (port = p); } catch {} } throw new Error('DrYAE sign-in service unavailable'); };
    const auth = async (url, interactive) => {
      const p = await find();
      const r = await fetch(`http://127.0.0.1:${p}/dryae-id/auth?ext=${encodeURIComponent(c.runtime.id)}&i=${interactive ? 1 : 0}&u=${encodeURIComponent(String(url || ''))}`);
      const j = await r.json(); if (j.error) throw new Error(j.error); return j.url;
    };
    const identity = {
      getRedirectURL: (p) => `https://${c.runtime.id}.chromiumapp.org/${String(p || '').replace(/^\//, '')}`,
      launchWebAuthFlow: (details, cb) => {
        const p = auth(details && details.url, details && details.interactive);
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
    try { if (globalThis.browser && globalThis.browser !== c && !globalThis.browser.identity) Object.defineProperty(globalThis.browser, 'identity', { value: identity, enumerable: true, configurable: true }); } catch {}
  } catch {}
})();
