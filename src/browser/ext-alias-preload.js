// DrYAE — extensions Chrome : les navigateurs récents donnent aussi aux extensions un objet « browser »
// (même rôle que « chrome »). Beaucoup d'extensions l'utilisent en priorité ; on le fait pointer vers
// l'objet « chrome » complété par DrYAE, pour qu'elles trouvent toutes leurs fonctions (commandes, menus…).
const { contextBridge } = require('electron');
if (process.type === 'service-worker' || (typeof location !== 'undefined' && location.href.startsWith('chrome-extension://'))) {
  const fix = () => {
    try {
      if (!globalThis.chrome || !globalThis.chrome.runtime) return;
      try { delete globalThis.browser; } catch {}
      Object.defineProperty(globalThis, 'browser', { value: globalThis.chrome, configurable: true, writable: true, enumerable: false });
    } catch {}
  };
  try { contextBridge.executeInMainWorld({ func: fix }); } catch {}
}
