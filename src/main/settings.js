const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://explodie.org:6969/announce',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
];

function defaults(app) {
  return {
    dir: path.join(app.getPath('downloads'), 'DrYAE'),
    categorize: true,
    connections: 8,
    parallel: 3,
    perSite: 0,
    speedLimit: 0,            // Ko/s, 0 = illimité
    speedLimitOn: false,
    maxRetries: 10,
    userAgent: '',
    proxy: { enabled: false, url: '' },
    duplicate: 'ask',         // ask | rename | overwrite (doublon : même lien ou même titre)
    confirmClear: true,
    autoUpdateCheck: true,    // vérifier automatiquement les nouvelles versions sur GitHub (désactivable)       // demander avant de vider la liste des terminés
    notify: true,
    sound: true,
    clipboard: true,
    tray: true,
    startWithWindows: false,
    startMinimized: false,
    shutdownWhenDone: false,
    autoOpenWebpage: true,
    hls: { connections: 6, convert: true, quality: 'best' },
    ytdl: { mode: 'video', quality: '1080', audioFormat: 'mp3', audioBitrate: '320', updated: 0 },
    restoreSession: true,
    winBounds: null,
    torrent: {
      enabled: true, seed: true, ratio: 1.0, uploadLimit: 0, downloadLimit: 0, dht: true, lsd: true, port: 0,
      useDefaultTrackers: true, alwaysAllTrackers: true, trackersUrl: 'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
      trackers: DEFAULT_TRACKERS.join('\n'), fetchMetadata: true, sequential: false, maxConns: 55, folderView: false,
    },
    browser: {
      home: 'dryae://start', search: 'google', adblock: true, whitelist: [], blockPopups: true,
      // listes en plus des listes intégrées (EasyList, EasyPrivacy, uBlock, Peter Lowe)
      filterLists: ['https://easylist-downloads.adblockplus.org/liste_fr.txt'],
      adblockUpdated: 0,
      hostsSources: [], customFilters: '',
      ua: 'desktop', clearOnExit: false, sniffExtra: 'zip,rar,7z,apk,exe,pdf', captureSubtitles: true,
      doh: '', extractLinks: true, cookies: true,
      vault: { offer: true, autofill: true, hello: false, payments: true, paymentsHello: true, addresses: true, suggest: true },
      autofillProfile: { enabled: false, profile: {} },
      // 1.6.4 : extensions intégrées (activables, masquables dans la barre d'outils, retirables)
      modules: {
        adblock: { installed: true, enabled: true, pinned: true },
        capture: { installed: true, enabled: true, pinned: true },
        translate: { installed: true, enabled: true, pinned: true },
        scan: { installed: true, enabled: true, pinned: true },
        lights: { installed: true, enabled: true, pinned: false },
        pip: { installed: true, enabled: true, pinned: false },
      },
      adLists: { privacy: true, cookies: false, annoyances: false, regional: true, malware: true, peterLowe: true },
      adModes: {}, adDefaultMode: 'optimal', extUnpinned: [], tbOrder: [],
      translate: { target: '', provider: 'google', selection: 'button', deeplKey: '', libreUrl: '', libreKey: '', second: '', hideSame: false, delay: 0, offSites: [], autoSites: [] },
      scan: { source: 'auto', target: '', font: 'auto', icons: true, withEng: false, autoSites: [] },
      lights: { opacity: 85, auto: false, color: '#000000', fade: true, clickOff: true, eye: false, eyeLevel: 30, glow: false, wheelVolume: false, stopAutoplay: false, videoTools: true, nightAll: false, nightSchedule: false, nightFrom: '20:00', nightTo: '07:00', nightHosts: [], nightExcept: [] },
      pip: { side: 'right', hidden: [] },
      showBookmarksBar: false, showHome: true, startup: 'restore', startupPages: [],
      nativeDl: { ask: false, dir: '' },
      zoomDefault: 0,
    },
    scheduler: { enabled: false, start: '02:00', stop: '', days: [0, 1, 2, 3, 4, 5, 6], addNew: false, shutdown: false },
    dataLimit: { enabled: false, mb: 0, used: 0, day: '' },
    theme: { mode: 'dark', accent: 'system' }, // 'system' = couleur d'accent de Windows
    passwords: [],            // [{host, user, pass(enc)}]
    siteLimits: [],           // [{host, max}]
    lang: '',
    langChosen: false,
  };
}

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k in over || {}) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

class Settings extends EventEmitter {
  constructor(app) {
    super();
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.def = defaults(app);
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
    this.data = deepMerge(this.def, saved);
    // 1.6.1 : on demande désormais quoi faire en cas de doublon (l'ancien réglage par défaut était « renommer »)
    if (!saved.v161) { this.data.duplicate = 'ask'; this.data.v161 = true; }
    // 1.6.4 : le bloqueur devient une extension intégrée ; la liste française passe dans les listes proposées
    if (!saved.v164) {
      const b = this.data.browser;
      b.modules.adblock.enabled = b.adblock !== false;
      const FR = 'https://easylist-downloads.adblockplus.org/liste_fr.txt';
      if ((b.filterLists || []).includes(FR)) { b.filterLists = b.filterLists.filter(u => u !== FR); b.adLists.regional = true; }
      b.startup = this.data.restoreSession === false ? 'newtab' : 'restore';
      this.data.v164 = true;
      try { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); } catch {}
    }
    // 1.6.6 : le bouton de traduction s'affiche aussi pour un texte déjà dans votre langue (il est traduit dans la 2e langue)
    if (!saved.v166) {
      const t = this.data.browser.translate || {}; t.hideSame = false;
      // lecture automatique de la langue des images (nouveau moteur)
      if (this.data.browser.scan) this.data.browser.scan.source = 'auto';
      this.data.v166 = true;
      try { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); } catch {}
    }
  }
  get() { return this.data; }
  set(patch) {
    this.data = deepMerge(this.data, patch);
    try { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); } catch {}
    this.emit('change', this.data, patch);
    return this.data;
  }
  reset() { this.data = JSON.parse(JSON.stringify(this.def)); this.set({}); return this.data; }
}

module.exports = { Settings, DEFAULT_TRACKERS };
