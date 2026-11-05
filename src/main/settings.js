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
    duplicate: 'rename',      // rename | ask | overwrite
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
      vault: { offer: true, autofill: true },
      autofillProfile: { enabled: false, profile: {} },
    },
    scheduler: { enabled: false, start: '02:00', stop: '', days: [0, 1, 2, 3, 4, 5, 6], addNew: false, shutdown: false },
    dataLimit: { enabled: false, mb: 0, used: 0, day: '' },
    theme: { mode: 'dark', accent: '#8b5cf6' },
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
