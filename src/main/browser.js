// Navigateur intégré : sessions, bloqueur de pubs, détecteur de médias, interception des téléchargements
const { BrowserWindow, WebContentsView, session, ipcMain, Menu, clipboard, app, dialog, shell, webContents, screen } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ElectronBlocker, adsLists } = require('@ghostery/adblocker-electron');
const PRELOAD_PATH = path.resolve(require.resolve('@ghostery/adblocker-electron-preload'));
const { extOf, hostOf, uniquePath, sanitize } = require('./util');
const pages = require('./pages');
const M = require('./modules');

const CHROME_MAJOR = (process.versions.chrome || '152').split('.')[0];
const UA_DESKTOP = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;
M.setUserAgent(UA_DESKTOP); // le traducteur se présente comme le navigateur de DrYAE (Chromium)
const PAGE_PRELOAD = path.join(__dirname, '..', 'browser', 'page-preload.js');
// Google refuse la connexion depuis les navigateurs intégrés : on se présente comme Firefox sur ses pages de connexion
// version de Firefox actuelle estimée (une version toutes les 4 semaines depuis la 132 du 29/10/2024)
const FF = 132 + Math.max(0, Math.floor((Date.now() - Date.UTC(2024, 9, 29)) / (28 * 864e5)));
const UA_GOOGLE_LOGIN = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${FF}.0) Gecko/20100101 Firefox/${FF}.0`;
const GOOGLE_LOGIN = /^(accounts\.google\.[a-z.]+|accounts\.youtube\.com|myaccount\.google\.com)$/;
// sites de Google traversés pendant une connexion (redirections, cookies posés sur chaque domaine)
const GOOGLE_FAMILY = /(^|\.)(google\.[a-z.]+|youtube\.com|gstatic\.com|googleusercontent\.com|googleapis\.com|gmail\.com|youtube-nocookie\.com|ggpht\.com|ytimg\.com|blogger\.com|googlevideo\.com|withgoogle\.com)$/;
// vérifications anti-robot : jamais filtrées par le bloqueur
const CHALLENGE = /(^|\.)(challenges\.cloudflare\.com|hcaptcha\.com|recaptcha\.net|turnstile\.cloudflare\.com)$/;
// pages jamais filtrées par le bloqueur : boutique d'extensions, vérifications « je ne suis pas un robot », connexion Google
const NO_BLOCK_PAGE = /(^|\.)(chromewebstore\.google\.com|chrome\.google\.com|challenges\.cloudflare\.com|accounts\.google\.[a-z.]+|accounts\.youtube\.com|myaccount\.google\.com)$/;
// fenêtres de connexion ouvertes par les sites (comptes Google, Microsoft, Apple, Facebook…)
const LOGIN_POPUP = /^https:\/\/(accounts\.google\.[a-z.]+|login\.(microsoftonline|live)\.com|appleid\.apple\.com|(www\.|m\.)?facebook\.com\/(v[\d.]+\/)?dialog|github\.com\/login|discord\.com\/(api\/)?oauth2|(twitter|x)\.com\/i\/oauth2|api\.twitter\.com\/oauth|id\.twitch\.tv|accounts\.spotify\.com|www\.paypal\.com\/(signin|connect|checkoutnow))/i;
const NO_BLOCK_URL = /^https?:\/\/[^/]+\/cdn-cgi\/(challenge-platform|images\/trace)\//i;
const UA_MOBILE = `Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Mobile Safari/537.36`;
const PART = 'persist:dryae-web', PART_PRIV = 'dryae-incognito';
const SEARCH = {
  google: 'https://www.google.com/search?q=%s', bing: 'https://www.bing.com/search?q=%s', duckduckgo: 'https://duckduckgo.com/?q=%s',
  qwant: 'https://www.qwant.com/?q=%s', yahoo: 'https://search.yahoo.com/search?p=%s', brave: 'https://search.brave.com/search?q=%s',
  ecosia: 'https://www.ecosia.org/search?q=%s', startpage: 'https://www.startpage.com/do/search?q=%s',
};
const MEDIA_EXT = { video: 'mp4 webm mkv mov avi flv m4v 3gp', audio: 'mp3 m4a aac ogg opus wav flac', hls: 'm3u8', dash: 'mpd', subtitle: 'vtt srt ass' };
const SKIP_HOST = /(^|\.)(youtube\.com|googlevideo\.com|ytimg\.com)$/;
const GH = 'https://raw.githubusercontent.com/ghostery/adblocker/master/packages/adblocker/assets/';
// listes de filtres proposées dans les paramètres du bloqueur
const AD_LISTS = {
  privacy: [GH + 'easylist/easyprivacy.txt', GH + 'ublock-origin/privacy.txt'],
  cookies: [GH + 'easylist/easylist-cookie.txt', GH + 'ublock-origin/annoyances-cookies.txt'],
  annoyances: [GH + 'ublock-origin/annoyances-others.txt'],
  regional: ['https://easylist-downloads.adblockplus.org/liste_fr.txt'],
  malware: ['https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-ag-online.txt'],
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

class WebBrowser {
  constructor({ main, settings, userDir, onDownload, onTorrent, getPassword, assetsDir }) {
    Object.assign(this, { main, settings, userDir, onDownload, onTorrent, getPassword, assetsDir });
    this.cfPass = new Set(); // onglets qui affichent une vérification Cloudflare
    this.loginTabs = new Set(); // onglets en cours de connexion à un compte Google
    this.win = null;   // fenêtre unique de DrYAE (fournie par main.js) une fois le navigateur ouvert
    this.view = null;  // vue du navigateur, posée au-dessus du gestionnaire
    this.blocker = null;
    this.blockedCount = new Map();
    this.blockedTotal = 0;
    this.nd = []; // téléchargements faits par le navigateur lui-même (quand « Téléchargements par DrYAE » est désactivé)
    this.storeFile = path.join(userDir, 'browser.json');
    this.store = { bookmarks: [], history: [], typed: [], session: null, browserOpen: false, perms: {}, closed: [], hides: {}, extDisabled: [] };
    try { this.store = { ...this.store, ...JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) }; } catch {}
    this.bmInit();
    this.seenMedia = new Map(); // wcId -> Set(url)
    this.extWaiters = new Map();
    const { Vault } = require('./vault');
    this.vault = new Vault({ userDir, enc: main.enc, dec: main.dec, settings, getWc: () => this.wc, privatePartition: PART_PRIV, hello: M.windowsHello });
    this.pendingLogins = new Map();
    this.setupIpc();
    this.setupPages();
  }
  B() { return this.settings.get().browser; }
  // extension intégrée installée et activée
  modOn(id) { const m = (this.B().modules || {})[id] || {}; if (id === 'adblock' && this.B().adblock === false) return false; return m.installed !== false && m.enabled !== false; }
  saveStoreSync() { clearTimeout(this._st); try { fs.writeFileSync(this.storeFile, JSON.stringify(this.store)); } catch {} }
  get wc() { return this.view && !this.view.webContents.isDestroyed() ? this.view.webContents : null; }
  visible() { return !!(this.view && this.view.getVisible && this.view.getVisible()); }
  onQuit() {
    this.quitting = true; this.saveStoreSync();
    try { session.fromPartition(PART_PRIV).clearStorageData(); } catch {}
    if (this.B().clearOnExit) { try { session.fromPartition(PART).clearStorageData(); } catch {} this.store.history = []; this.saveStoreSync(); }
  }
  // couleur d'accent « Windows » : celle choisie dans les paramètres de Windows (violet DrYAE sinon)
  theme() {
    const t = { ...(this.settings.get().theme || {}) };
    if (!t.accent || t.accent === 'system') { let c = null; try { c = require('electron').systemPreferences.getAccentColor?.(); } catch {} t.accent = c ? '#' + c.slice(0, 6) : '#8b5cf6'; }
    return t;
  }
  sendTheme() { this.wc?.send('theme', this.theme()); pages.broadcast('theme', this.theme()); }
  // fichier de cookies (format Netscape) pour yt-dlp, à partir de la session du navigateur
  async cookieFile(url) {
    if (!this.B().cookies) return null;
    let host = ''; try { host = new URL(url).hostname; } catch { return null; }
    const parts = host.split('.'); const base = parts.slice(-2).join('.');
    const domains = [base];
    if (/youtube\.com|youtu\.be/.test(host)) domains.splice(0, 1, 'youtube.com', 'google.com');
    const ses = session.fromPartition(PART);
    let list = [];
    for (const d of domains) { try { list = list.concat(await ses.cookies.get({ domain: d })); } catch {} }
    if (!list.length) return null;
    const lines = ['# Netscape HTTP Cookie File'];
    for (const c of list) {
      const dom = c.domain.startsWith('.') || !c.hostOnly ? (c.domain.startsWith('.') ? c.domain : '.' + c.domain) : c.domain;
      lines.push([dom, dom.startsWith('.') ? 'TRUE' : 'FALSE', c.path || '/', c.secure ? 'TRUE' : 'FALSE', Math.round(c.expirationDate || 0), c.name, c.value].join('\t'));
    }
    const dir = path.join(this.userDir, 'tmp'); await fsp.mkdir(dir, { recursive: true });
    const f = path.join(dir, 'cookies-' + base.replace(/[^\w.-]/g, '_') + '.txt');
    await fsp.writeFile(f, lines.join('\n') + '\n');
    return f;
  }
  saveStore() { clearTimeout(this._st); this._st = setTimeout(() => fsp.writeFile(this.storeFile, JSON.stringify(this.store)).catch(() => {}), 500); }
  sessions() { return [session.fromPartition(PART), session.fromPartition(PART_PRIV)]; }

  async init() {
    const B = this.B();
    // même identité partout (pages, workers, service workers) : sinon les vérifications anti-robot recommencent sans fin
    try { app.userAgentFallback = this.ua(); } catch {}
    if (B.doh) { try { app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: [B.doh] }); } catch {} }
    for (const ses of this.sessions()) this.setupSession(ses);
    pages.handleSession(session.defaultSession); // icônes des pages internes dans les onglets
    await this.loadBlocker();
    await this.setupExtensions().catch(e => console.error('extensions', e.message));
    this.settings.on('change', (_d, patch) => {
      if (patch.browser && ('ua' in patch.browser)) { this.sessions().forEach(s => s.setUserAgent(this.ua())); try { app.userAgentFallback = this.ua(); } catch {} }
      if (patch.browser && ('filterLists' in patch.browser || 'hostsSources' in patch.browser || 'customFilters' in patch.browser || 'adLists' in patch.browser)) this.updateBlocker(true);
      if (patch.browser || 'restoreSession' in patch || patch.theme) this.pushCfg();
    });
    // mise à jour des listes en arrière-plan (tous les 4 jours)
    setTimeout(() => this.updateBlocker(false), 20000);
    ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (e, url, msg) => this.adblockActiveFor(url) && this.adMode(hostOf(url)) !== 'basic' && !this.cfPass.has(e.sender.id) ? this.blocker?.onInjectCosmeticFilters(e, url, msg) : undefined);
    ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', e => this.blocker?.onIsMutationObserverEnabled(e));
  }
  // réglages envoyés à l'interface du navigateur
  cfg() { return { ...this.B(), theme: this.theme(), rawTheme: this.settings.get().theme || {}, restoreSession: this.settings.get().restoreSession, searchUrl: SEARCH[this.B().search] || SEARCH.google, ua: this.B().ua, partitions: { normal: PART, incognito: PART_PRIV }, mods: Object.fromEntries(M.MODULES.map(m => [m.id, { ...M.MOD_DEFAULT, ...(this.B().modules || {})[m.id], on: this.modOn(m.id) }])), lang: this.settings.get().lang }; }
  pushCfg() { clearTimeout(this._pc); this._pc = setTimeout(() => { this.wc?.send('cfg', this.cfg()); pages.broadcast('cfg', this.cfg()); }, 50); }

  // ---------- extensions Chrome (Chrome Web Store + dossiers) ----------
  async setupExtensions() {
    const { ElectronChromeExtensions } = require('electron-chrome-extensions');
    const { installChromeWebStore } = require('electron-chrome-web-store');
    const ses = session.fromPartition(PART);
    this.extDir = path.join(this.userDir, 'extensions');
    fs.mkdirSync(this.extDir, { recursive: true });
    this.ext = new ElectronChromeExtensions({
      session: ses,
      createTab: details => this.extCreateTab(details),
      selectTab: wc => this.wc?.send('ext-select-tab', { wcId: wc.id }),
      removeTab: wc => this.wc?.send('ext-remove-tab', { wcId: wc.id }),
      createWindow: async details => { this.open(details?.url ? [].concat(details.url)[0] : ''); return this.win; },
      removeWindow: () => {},
    });
    ElectronChromeExtensions.handleCRXProtocol(session.defaultSession);
    // après les fonctions des extensions : « browser » = « chrome » (sinon chrome.commands, contextMenus… manquent)
    const alias = path.join(__dirname, '..', 'browser', 'ext-alias-preload.js');
    for (const type of ['service-worker', 'frame']) { try { ses.registerPreloadScript({ id: 'dryae-ext-alias-' + type, type, filePath: alias }); } catch {} }
    // fenêtre d'extension (popup) : placée sous son bouton, à l'intérieur de l'écran,
    // même quand la fenêtre est agrandie ou sur un 2e écran
    this.ext.on('browser-action-popup-created', popup => {
      popup.updatePosition = function () {
        const bw = this.browserWindow, par = this.parent;
        if (!bw || bw.isDestroyed() || !par || par.isDestroyed()) return;
        const c = par.getContentBounds(), v = bw.getBounds(), a = this.anchorRect || { x: 0, y: 0, width: 0, height: 0 };
        let x = c.x + a.x + a.width - v.width, y = c.y + a.y + a.height + 4;
        const wa = screen.getDisplayMatching({ x: c.x + a.x, y: c.y + a.y, width: Math.max(1, a.width), height: Math.max(1, a.height) }).workArea;
        x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - v.width - 4));
        if (y + v.height > wa.y + wa.height - 4) y = Math.max(wa.y + 4, wa.y + wa.height - v.height - 4);
        if (process.env.DRYAE_DEBUG_POPUP) console.log('popup', JSON.stringify({ c, v, a, wa, x, y }));
        bw.setBounds({ ...v, x: Math.floor(x), y: Math.floor(y) });
      };
      try { popup.updatePosition(); } catch {}
      // secours : si la taille demandée par la fenêtre n'arrive pas, on la mesure nous-mêmes puis on l'affiche
      const bw = popup.browserWindow;
      bw?.webContents.once('did-finish-load', () => setTimeout(async () => {
        if (popup.isDestroyed() || !popup.hidden) return;
        try {
          const r = await bw.webContents.executeJavaScript('(() => { const e = document.documentElement, b = document.body; return { width: Math.max(e.scrollWidth, b ? b.scrollWidth : 0), height: Math.max(e.scrollHeight, b ? b.scrollHeight : 0) }; })()');
          if (popup.isDestroyed() || !popup.hidden) return;
          popup.setSize(r); popup.updatePosition(); popup.show();
        } catch {}
      }, 350));
    });
    await installChromeWebStore({ session: ses, extensionsPath: this.extDir, allowUnpackedExtensions: true, minimumManifestVersion: 2, autoUpdate: true });
    // extensions désactivées par l'utilisateur : fichiers gardés, extension non chargée
    const X = ses.extensions || ses;
    for (const d of this.store.extDisabled || []) { try { if (X.getExtension(d.id)) X.removeExtension(d.id); } catch {} }
  }
  async extCreateTab(details) {
    if (!this.wc) { this.open(''); await new Promise(r => this.wc.once('did-finish-load', r)); }
    const reqId = Math.random().toString(36).slice(2);
    const p = new Promise(r => this.extWaiters.set(reqId, r));
    this.wc.send('ext-create-tab', { reqId, url: details?.url || '', active: details?.active !== false });
    const wcId = await Promise.race([p, new Promise(r => setTimeout(() => r(null), 10000))]);
    const wc = wcId ? webContents.fromId(wcId) : null;
    if (!wc) throw new Error('onglet non créé');
    return [wc, this.win];
  }
  extList() {
    const ses = session.fromPartition(PART);
    const X = ses.extensions || ses;
    // icône lue directement dans les fichiers de l'extension (data:), visible partout (pages dryae:, menu)
    const icon = x => {
      const mf = x.manifest || {}; const act = mf.action || mf.browser_action || {};
      const ic = { ...(typeof act.default_icon === 'string' ? { 16: act.default_icon } : act.default_icon || {}), ...(mf.icons || {}) };
      const k = Object.keys(ic).sort((a, b) => b - a)[0]; if (!k || !x.path) return '';
      try { const f = path.join(x.path, String(ic[k]).replace(/^\//, '')); const ext = path.extname(f).slice(1).toLowerCase(); return `data:image/${ext === 'svg' ? 'svg+xml' : ext || 'png'};base64,` + fs.readFileSync(f).toString('base64'); } catch { return ''; }
    };
    const msg = (x, s) => {
      const m = /^__MSG_(\w+)__$/.exec(s || ''); if (!m) return s || '';
      for (const l of [String(this.settings.get().lang || 'fr'), x.manifest?.default_locale || 'en', 'en']) {
        try { const j = JSON.parse(fs.readFileSync(path.join(x.path, '_locales', l.replace('-', '_'), 'messages.json'), 'utf8')); const k = Object.keys(j).find(k => k.toLowerCase() === m[1].toLowerCase()); if (k) return j[k].message; } catch {}
      }
      return s;
    };
    const desc = x => {
      const mf = x.manifest || {};
      const opt = mf.options_ui?.page || mf.options_page || '';
      return { id: x.id, name: msg(x, x.name), version: x.version, description: msg(x, mf.description || ''), path: x.path, icon: icon(x), enabled: true,
        options: opt ? `chrome-extension://${x.id}/${opt.replace(/^\//, '')}` : '', homepage: mf.homepage_url || `https://chromewebstore.google.com/detail/${x.id}`,
        popup: !!((mf.action || mf.browser_action || {}).default_popup), pinned: !(this.B().extUnpinned || []).includes(x.id),
        permissions: [...(mf.permissions || []), ...(mf.host_permissions || [])].filter(p => typeof p === 'string'), local: !!(x.path && path.basename(x.path).startsWith('local-')), mv: mf.manifest_version };
    };
    const on = X.getAllExtensions().map(desc);
    const off = (this.store.extDisabled || []).filter(d => !on.some(x => x.id === d.id)).map(d => {
      let mf = {}; try { mf = JSON.parse(fs.readFileSync(path.join(d.path, 'manifest.json'), 'utf8')); } catch {}
      const x = { id: d.id, name: mf.name || d.name || d.id, version: mf.version || '', manifest: mf, path: d.path };
      return { ...desc(x), enabled: false };
    });
    return [...on, ...off].sort((a, b) => a.name.localeCompare(b.name));
  }
  async extSetEnabled(id, on) {
    const ses = session.fromPartition(PART); const X = ses.extensions || ses;
    if (!on) {
      const x = X.getExtension(id); if (!x) return;
      this.store.extDisabled = [...(this.store.extDisabled || []).filter(d => d.id !== id), { id, path: x.path, name: x.name }];
      X.removeExtension(id);
    } else {
      const d = (this.store.extDisabled || []).find(d => d.id === id); if (!d) return;
      await X.loadExtension(d.path, { allowFileAccess: true });
      this.store.extDisabled = this.store.extDisabled.filter(x => x.id !== id);
    }
    this.saveStore(); this.wc?.send('ext-changed');
  }
  // ajout direct depuis le navigateur (sans ouvrir la fenêtre principale)
  // titre de l'onglet qui affiche cette page
  pageTitle(page) {
    if (!page) return '';
    try { const w = webContents.getAllWebContents().find(x => !x.isDestroyed() && x.getURL() === page); return w ? w.getTitle() : ''; } catch { return ''; }
  }
  quickFile(o) {
    if (!o.pageTitle) o.pageTitle = this.pageTitle(o.page);
    if (this.wc) { this.showView(); this.wc.send('quick-file', o); }
    else this.onDownload(o);
  }
  ua() { return this.B().ua === 'mobile' ? UA_MOBILE : UA_DESKTOP; }

  // ---------- bloqueur de pubs ----------
  async loadBlocker() {
    const cache = path.join(this.userDir, 'adblock-engine.bin');
    const bundled = path.join(this.assetsDir, 'adblock', 'engine.bin');
    for (const f of [cache, bundled]) {
      try { this.blocker = ElectronBlocker.deserialize(new Uint8Array(await fsp.readFile(f))); return; } catch {}
    }
  }
  countBlocked(id) {
    this.blockedCount.set(id, (this.blockedCount.get(id) || 0) + 1);
    this.blockedTotal++;
    this.wc?.send('adblock:count', { wcId: id, n: this.blockedCount.get(id) });
  }
  filterUrls() {
    const B = this.B(), L = B.adLists || {};
    // listes de base : filtres uBlock, EasyList et la liste de serveurs de Peter Lowe (désactivable)
    const urls = adsLists.filter(u => L.peterLowe !== false || !/peter-lowe/.test(u));
    for (const k of Object.keys(AD_LISTS)) if (L[k]) urls.push(...AD_LISTS[k]);
    return [...new Set([...urls, ...(B.filterLists || []).filter(Boolean)])];
  }
  async updateBlocker(force) {
    const B = this.B();
    if (!force && Date.now() - (B.adblockUpdated || 0) < 4 * 864e5) return;
    if (this._updating) return this._updating;
    this._updating = (async () => {
      try {
        let text = '';
        for (const u of this.filterUrls()) { try { const r = await this.main.manager.fetch(u); if (r.ok) text += (await r.text()) + '\n'; } catch {} }
        for (const u of (B.hostsSources || []).filter(Boolean)) {
          try {
            const r = await this.main.manager.fetch(u);
            if (r.ok) text += (await r.text()).split(/\r?\n/).map(l => l.replace(/#.*/, '').trim().split(/\s+/)).filter(p => p.length >= 2 && /^(0\.0\.0\.0|127\.0\.0\.1)$/.test(p[0])).map(p => `||${p[1]}^`).join('\n') + '\n';
          } catch {}
        }
        text += (B.customFilters || '') + '\n';
        if (text.length < 10000) return false; // hors ligne : on garde le moteur actuel
        const b = ElectronBlocker.parse(text, { enableCompression: true, loadCosmeticFilters: true, loadNetworkFilters: true });
        await fsp.writeFile(path.join(this.userDir, 'adblock-engine.bin'), Buffer.from(b.serialize()));
        this.blocker = b;
        this.settings.set({ browser: { adblockUpdated: Date.now() } });
        return true;
      } catch (e) { console.error('adblock update', e.message); return false; }
      finally { setTimeout(() => { this._updating = null; }, 0); }
    })();
    return this._updating;
  }
  adblockActiveFor(pageUrl) {
    const B = this.B();
    if (!this.modOn('adblock') || !this.blocker) return false;
    const h = hostOf(pageUrl);
    if (h && NO_BLOCK_PAGE.test(h)) return false;
    if (this.adMode(h) === 'none') return false;
    return !(h && (B.whitelist || []).some(w => h === w || h.endsWith('.' + w)));
  }
  // mode nuit sur tous les sites (avec horaire facultatif), sauf les sites exclus
  nightBySchedule(host) {
    const l = this.B().lights || {};
    if (!l.nightAll || (l.nightExcept || []).includes(host)) return false;
    if (!l.nightSchedule) return true;
    const m = s => { const [h, mi] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (mi || 0); };
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), a = m(l.nightFrom || '20:00'), b = m(l.nightTo || '07:00');
    return a <= b ? now >= a && now < b : now >= a || now < b;
  }
  // mode de filtrage par site : none (aucun), basic (requêtes seulement), optimal (requêtes + éléments de la page)
  adMode(h) {
    const M = this.B().adModes || {}; if (!h) return 'optimal';
    const k = Object.keys(M).filter(d => M[d] && (h === d || h.endsWith('.' + d))).sort((a, b) => b.length - a.length)[0];
    return k ? M[k] : (this.B().adDefaultMode || 'optimal');
  }

  // décode une image (WebP, AVIF…) avec le moteur de l'interface du navigateur
  async decodeImage(buf) {
    if (!this.wc || this.wc.isDestroyed() || buf.length > 25e6) return null;
    const url = await this.wc.executeJavaScript(`(async () => { try { const b = await (await fetch('data:application/octet-stream;base64,${buf.toString('base64')}')).blob(); const bm = await createImageBitmap(b); const c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); const o = await c.convertToBlob({ type: 'image/png' }); const r = new FileReader(); return await new Promise(res => { r.onload = () => res(r.result); r.readAsDataURL(o); }); } catch { return ''; } })()`, true);
    return url ? require('electron').nativeImage.createFromDataURL(url) : null;
  }

  // préchargement de l'interface du navigateur en un seul fichier (un préchargement « bac à sable »
  // ne peut charger que le module electron) : notre préchargement + les boutons des extensions
  uiPreload() {
    const own = path.join(__dirname, '..', 'browser', 'preload.js');
    try {
      const ba = fs.readFileSync(require.resolve('electron-chrome-extensions/browser-action'), 'utf8');
      const src = fs.readFileSync(own, 'utf8').replace(/^try \{ require\('electron-chrome-extensions\/browser-action'\).*$/m, '');
      const out = path.join(app.getPath('userData'), 'ui-preload.js');
      const code = src + `\n;(function () { const module = { exports: {} }; const exports = module.exports;\n${ba}\n;try { module.exports.injectBrowserAction(); } catch (e) { console.error('browser-action', e.message); } })();\n`;
      if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== code) fs.writeFileSync(out, code);
      return out;
    } catch (e) { console.error('ui-preload', e.message); return own; }
  }

  // ---------- sessions ----------
  setupSession(ses) {
    ses.setUserAgent(this.ua());
    pages.handleSession(ses);
    if (ses.registerPreloadScript) {
      for (const [id, filePath] of [['dryae-page', PAGE_PRELOAD], ['dryae-adblock', PRELOAD_PATH]]) {
        try { ses.registerPreloadScript({ id, type: 'frame', filePath }); } catch {}
      }
    } else ses.setPreloads([PAGE_PRELOAD, PRELOAD_PATH]);
    const allowed = ['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'media', 'storage-access', 'top-level-storage-access', 'speaker-selection', 'window-management'];
    ses.setPermissionRequestHandler((wc, perm, cb, det) => cb(allowed.includes(perm) && (perm !== 'media' || !(det?.mediaTypes || []).length)));
    // les notifications et la position sont « à demander », pas accordées d'office
    ses.setPermissionCheckHandler((wc, perm) => perm === 'notifications' || perm === 'geolocation' || perm === 'midi-sysex' ? false : true);
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, cb) => {
      if (!this.blocker || details.resourceType === 'mainFrame' || CHALLENGE.test(hostOf(details.url)) || NO_BLOCK_URL.test(details.url) || this.cfPass.has(details.webContentsId) || this.loginTabs.has(details.webContentsId)) return cb({});
      const page = details.referrer || (details.webContents && !details.webContents.isDestroyed() ? details.webContents.getURL() : '');
      if (!this.adblockActiveFor(page)) return cb({});
      try {
        this.blocker.onBeforeRequest(details, r => {
          if (r && (r.cancel || r.redirectURL) && details.webContentsId) this.countBlocked(details.webContentsId);
          cb(r);
        });
      } catch { cb({}); }
    });
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, cb) => {
      try { this.sniff(details); } catch {}
      // page de vérification Cloudflare : rien n'est filtré dans cet onglet tant qu'elle est affichée
      if (details.resourceType === 'mainFrame' && details.webContentsId) {
        const rh = details.responseHeaders || {}; const k = Object.keys(rh).find(x => x.toLowerCase() === 'cf-mitigated');
        if (k && /challenge/i.test(String(rh[k]))) this.cfPass.add(details.webContentsId); else this.cfPass.delete(details.webContentsId);
      }
      const page = details.webContents && !details.webContents.isDestroyed() ? details.webContents.getURL() : details.url;
      if (this.blocker && this.adblockActiveFor(page) && !CHALLENGE.test(hostOf(details.url)) && !NO_BLOCK_URL.test(details.url) && !this.cfPass.has(details.webContentsId) && !this.loginTabs.has(details.webContentsId)) { try { return this.blocker.onHeadersReceived(details, cb); } catch {} }
      cb({});
    });
    // connexion à un compte Google : la même identité pour TOUTES les requêtes de l'onglet, du début à la fin
    // (avant, l'identité changeait à chaque redirection entre les sites de Google : la page se rechargeait en boucle)
    ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (d, cb) => {
      const inLogin = (d.webContentsId && this.loginTabs.has(d.webContentsId)) || GOOGLE_LOGIN.test(hostOf(d.url));
      if (!inLogin) return cb({});
      const h = { ...d.requestHeaders };
      for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
      h['User-Agent'] = UA_GOOGLE_LOGIN;
      cb({ requestHeaders: h });
    });
    ses.on('will-download', (e, item, wc) => this.interceptDownload(e, item, wc, ses));
  }

  sniff(d) {
    if (!d.webContentsId || d.statusCode >= 400 || d.method !== 'GET') return;
    const url = d.url;
    if (!/^https?:/i.test(url)) return;
    const host = hostOf(url);
    if (SKIP_HOST.test(host)) return;
    const h = {}; for (const k in d.responseHeaders || {}) h[k.toLowerCase()] = String(d.responseHeaders[k][0] || '');
    const ct = (h['content-type'] || '').split(';')[0].toLowerCase();
    const ext = extOf(new URL(url).pathname);
    let kind = null;
    if (ct.includes('mpegurl') || ext === 'm3u8') kind = 'hls';
    else if (ct === 'application/dash+xml' || ext === 'mpd') kind = 'dash';
    else if (ct === 'video/mp2t' || ['ts', 'm4s', 'm4f', 'cmfv', 'cmfa'].includes(ext)) return; // fragments de flux
    else if (ct.startsWith('video/') || MEDIA_EXT.video.split(' ').includes(ext)) kind = 'video';
    else if (ct.startsWith('audio/') || MEDIA_EXT.audio.split(' ').includes(ext)) kind = 'audio';
    else if (ct === 'text/vtt' || ct === 'application/x-subrip' || MEDIA_EXT.subtitle.split(' ').includes(ext)) { if (!this.B().captureSubtitles) return; kind = 'subtitle'; }
    else if (String(this.B().sniffExtra || '').split(/[,\s]+/).filter(Boolean).includes(ext)) kind = 'file';
    if (!kind) return;
    let size = -1;
    const cr = h['content-range'];
    if (cr && /\/(\d+)/.test(cr)) size = +cr.match(/\/(\d+)/)[1]; else if (h['content-length']) size = +h['content-length'];
    if ((kind === 'video' || kind === 'audio') && size >= 0 && size < 100 * 1024) return; // trop petit (pubs, bips)
    const key = url.replace(/([?&])(range|rn|rbuf|bytestart|byteend)=[^&]*/gi, '$1');
    let seen = this.seenMedia.get(d.webContentsId);
    if (!seen) this.seenMedia.set(d.webContentsId, (seen = new Set()));
    if (seen.has(key)) return;
    seen.add(key);
    let page = '', title = '';
    try { const wc = webContents.fromId(d.webContentsId); page = wc?.getURL() || ''; title = wc?.getTitle() || ''; } catch {}
    this.wc?.send('media', { wcId: d.webContentsId, url, kind, mime: ct, size, page, title, ext, name: decodeURIComponent(new URL(url).pathname.split('/').pop() || '') });
  }

  async cookieHeader(ses, url) {
    if (!this.B().cookies) return '';
    try { const list = await ses.cookies.get({ url }); return list.map(c => `${c.name}=${c.value}`).join('; '); } catch { return ''; }
  }

  async interceptDownload(e, item, wc, ses) {
    const url = item.getURL();
    const name = sanitize(item.getFilename());
    const mime = item.getMimeType();
    const page = wc && !wc.isDestroyed() ? wc.getURL() : '';
    if (/^https?:/i.test(url) && this.modOn('capture')) {
      e.preventDefault(); // on reprend le téléchargement dans DrYAE
      const cookie = await this.cookieHeader(ses, url);
      if (mime === 'application/x-bittorrent' || /\.torrent$/i.test(name)) return this.onTorrent(url, { cookie, page });
      return this.quickFile({ url, name, page, size: item.getTotalBytes() || -1, mime, incognito: ses === session.fromPartition(PART_PRIV), headers: { Cookie: cookie, 'User-Agent': this.ua(), Referer: page } });
    }
    if (/^https?:/i.test(url)) return this.nativeDownload(item, name);
    // blob: / data: → enregistrement direct par le navigateur
    const S = this.settings.get();
    await fsp.mkdir(S.dir, { recursive: true });
    const target = uniquePath(S.dir, name || 'fichier');
    item.setSavePath(target);
    item.once('done', (_e, state) => { if (state === 'completed') this.main.notify('Fichier enregistré', path.basename(target)); });
  }
  // téléchargement ordinaire, fait par le navigateur (extension « Téléchargements par DrYAE » désactivée)
  nativeDownload(item, name) {
    const N = this.B().nativeDl || {};
    if (!N.ask) {
      const dir = N.dir || app.getPath('downloads');
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      item.setSavePath(uniquePath(dir, name || 'fichier'));
    }
    const d = { id: uid(), name, url: item.getURL(), path: '', received: 0, total: item.getTotalBytes(), state: 'progressing', paused: false, t: Date.now(), item };
    this.nd.unshift(d);
    if (this.nd.length > 100) this.nd.length = 100;
    const push = () => { d.path = item.getSavePath() || d.path; d.name = d.path ? path.basename(d.path) : d.name; d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.paused = item.isPaused(); this.sendNd(); };
    item.on('updated', (_e, state) => { d.state = state; push(); });
    item.once('done', (_e, state) => { d.state = state; push(); d.item = null; if (state === 'completed') this.main.notify('Téléchargement terminé', d.name); });
    this.wc?.send('nd-start', { id: d.id });
    push();
  }
  ndView() { return this.nd.map(({ item, ...x }) => x); }
  sendNd() { clearTimeout(this._nd); this._nd = setTimeout(() => this.wc?.send('nd', this.ndView()), 120); }

  // ---------- fenêtre ----------
  // le navigateur vit dans la même fenêtre que le gestionnaire (une seule fenêtre)
  open(url, opts = {}) {
    const host = this.main.hostWindow();
    if (this.wc) {
      this.showView();
      if (url) this.wc.send('open-url', { url, incognito: !!opts.incognito });
      else if (opts.incognito) this.wc.send('open-url', { url: '', incognito: true });
      return;
    }
    this.win = host;
    this.view = new WebContentsView({
      // fenêtre du navigateur « bac à sable » : indispensable pour que les extensions Chrome récentes (MV3)
      // reçoivent leurs fonctions (chrome.commands, chrome.tabs…) dans leur script d'arrière-plan
      webPreferences: { preload: this.uiPreload(), webviewTag: true, contextIsolation: true, sandbox: true },
    });
    this.view.setBackgroundColor('#0d0f14');
    host.contentView.addChildView(this.view);
    const wc = this.view.webContents;
    // préférences imposées à chaque onglet : scripts DrYAE aussi dans les iframes (vérifications anti-robot)
    wc.on('will-attach-webview', (_e, prefs) => {
      prefs.contextIsolation = true; prefs.sandbox = true; prefs.nodeIntegration = false;
      prefs.nodeIntegrationInSubFrames = true;
      delete prefs.preload;
    });
    wc.loadFile(path.join(__dirname, '..', 'browser', 'browser.html'));
    wc.once('did-finish-load', () => {
      const S = this.store.session;
      const B = this.B();
      const restore = B.startup !== 'newtab' && B.startup !== 'pages' && this.settings.get().restoreSession && S && S.tabs && S.tabs.length && !opts.incognito;
      // onglets restaurés sans être chargés : chacun se charge quand on l'ouvre
      if (restore) wc.send('restore-session', S);
      else if (B.startup === 'pages' && (B.startupPages || []).length && !url && !opts.incognito) { B.startupPages.forEach(u => wc.send('open-url', { url: u })); return; }
      if (url || !restore) wc.send('open-url', { url: url || '', incognito: !!opts.incognito });
    });
    if (!this._layoutHooked) {
      this._layoutHooked = true;
      // boutons latéraux de la souris et touches multimédia du clavier (précédent / suivant / actualiser)
      host.on('app-command', (_e, cmd) => { if (this.view && this.view.getVisible?.() !== false && this.wc) this.wc.send('app-cmd', cmd); });
      const lay = () => this.layout();
      host.on('resize', lay); host.on('maximize', lay); host.on('unmaximize', lay); host.on('enter-full-screen', lay); host.on('leave-full-screen', lay);
    }
    this.showView();
  }
  // ouvre une page interne (historique, favoris…) dans un onglet du navigateur
  openPage(name, hash = '') {
    const url = `dryae://${name}/${hash ? '#' + hash : ''}`;
    if (!this.wc) return this.open(url);
    this.showView();
    this.wc.send('open-page', { url });
  }
  layout() {
    if (!this.view || !this.win || this.win.isDestroyed()) return;
    const [w, h] = this.win.getContentSize();
    this.view.setBounds({ x: 0, y: 0, width: w, height: h });
  }
  showView() {
    if (!this.view) return;
    const host = this.win;
    if (host.isMinimized()) host.restore();
    host.show();
    this.layout();
    this.view.setVisible(true);
    host.setTitle((global.DRYAE_T || (s => s))('DrYAE — Navigateur'));
    host.focus();
    this.view.webContents.focus();
    this.main.onModeChange?.('browser');
  }
  hideView() {
    if (!this.view) return;
    this.view.setVisible(false);
    if (this.win && !this.win.isDestroyed()) { this.win.setTitle('DrYAE'); this.win.webContents.focus(); }
    this.main.onModeChange?.('manager');
  }

  attachWebview(wc) {
    wc.on('before-input-event', (ev, i) => {
      if (i.type !== 'keyDown') return;
      const k = String(i.key || '').toLowerCase(), c = i.control || i.meta;
      // dans les pages internes, Ctrl+F et Ctrl+A restent à la page (recherche et sélection de la liste)
      if (pages.isPageUrl(wc.getURL()) && c && !i.shift && ['f', 'a'].includes(k)) return;
      const fkey = /^f(1|3|5|6|11|12)$/.test(k);
      const plain = ['t', 'w', 'p', 'l', 'k', 'e', 'f', 'g', 'j', 'h', 'd', 'r', 's', 'u', 'm', 'tab', 'pageup', 'pagedown', 'f4', 'f5', '+', '=', '-', '0', '/'];
      const withShift = ['t', 'n', 'p', 'o', 'a', 'y', 'i', 'q', 'r', 'g', 'b', 'd', 'e', 's', 'l', 'u', 'delete', 'tab', 'pageup', 'pagedown'];
      const hit = fkey || (i.alt && !c && ['arrowleft', 'arrowright', 'home', 'd'].includes(k)) || (c && (i.shift ? withShift.includes(k) : (plain.includes(k) || /^[1-9]$/.test(k))));
      if (!hit) return;
      ev.preventDefault();
      this.wc?.send('shortcut', { key: i.key, ctrl: !!c, shift: !!i.shift, alt: !!i.alt, wcId: wc.id });
    });
    try { if (this.ext && this.win && wc.session === session.fromPartition(PART)) this.ext.addTab(wc, this.win); } catch (e) { console.error('ext addTab', e.message); }
    wc.setWindowOpenHandler(({ url, disposition, features }) => {
      if (url.startsWith('magnet:')) { this.onTorrent(url, {}); return { action: 'deny' }; }
      // un site ne peut pas ouvrir une page interne de DrYAE
      if (pages.isPageUrl(url) && !pages.isPageUrl(wc.getURL())) return { action: 'deny' };
      // fenêtre de connexion (« Se connecter avec Google », etc.) : vraie petite fenêtre, reliée au site qui l'a ouverte
      if (disposition === 'new-window' && (LOGIN_POPUP.test(url) || /width=|height=/i.test(features || ''))) return this.popupWindow(url, features);
      if (disposition === 'new-window' && this.B().blockPopups && !this.loginTabs.has(wc.id)) { this.wc?.send('popup-blocked', { wcId: wc.id, url }); return { action: 'deny' }; }
      this.wc?.send('open-url', { url, background: disposition === 'background-tab', from: wc.id });
      return { action: 'deny' };
    });
    const nav = (e, url) => {
      if (/^magnet:/i.test(url)) { e.preventDefault(); this.onTorrent(url, {}); }
      else if (pages.isPageUrl(url)) { if (!pages.isPageUrl(wc.getURL())) e.preventDefault(); }
      else if (!/^(https?|file|about|data|blob|chrome|view-source):/i.test(url)) { e.preventDefault(); }
    };
    wc.on('will-navigate', nav);
    // Ctrl + molette : Electron signale la demande, l'onglet applique son zoom
    wc.on('zoom-changed', (_e, dir) => this.wc?.send('wheel-zoom', { wcId: wc.id, dir: dir === 'in' ? 1 : -1 }));
    // connexion Google : l'onglet garde l'identité de connexion tant qu'il reste sur les sites de Google
    const fixUa = url => {
      let h = ''; try { h = new URL(url).hostname; } catch { return; }
      if (GOOGLE_LOGIN.test(h)) this.loginTabs.add(wc.id);
      else if (!GOOGLE_FAMILY.test(h)) this.loginTabs.delete(wc.id);
      const want = this.loginTabs.has(wc.id) ? UA_GOOGLE_LOGIN : this.ua();
      try { if (wc.getUserAgent() !== want) wc.setUserAgent(want); } catch {}
    };
    wc.on('will-navigate', (_e, url) => fixUa(url));
    wc.on('will-redirect', (_e, url) => fixUa(url));
    wc.on('did-start-navigation', (_e, url, inPlace, isMain) => { if (isMain && !inPlace) fixUa(url); });
    wc.on('will-frame-navigate', d => {
      if (/^magnet:/i.test(d.url)) { d.preventDefault?.(); this.onTorrent(d.url, {}); }
      // pas de page interne dans un cadre
      else if (pages.isPageUrl(d.url) && !d.isMainFrame) d.preventDefault?.();
    });
    // la liste des fichiers détectés n'est vidée que quand une nouvelle page s'affiche vraiment
    // (un clic sur un lien de téléchargement, .torrent par ex., ne change pas de page)
    wc.on('did-navigate', () => { this.seenMedia.delete(wc.id); this.blockedCount.set(wc.id, 0); this.wc?.send('media-reset', { wcId: wc.id }); });
    wc.on('context-menu', (_e, p) => this.contextMenu(wc, p));
    wc.on('login', () => {});
    wc.once('destroyed', () => { this.loginTabs.delete(wc.id); this.cfPass.delete(wc.id); });
  }

  popupWindow(url, features) {
    const num = k => { const m = new RegExp(k + '=(\\d+)', 'i').exec(features || ''); return m ? +m[1] : 0; };
    return { action: 'allow', outlivesOpener: false, overrideBrowserWindowOptions: { width: Math.min(900, num('width') || 520), height: Math.min(900, num('height') || 680), autoHideMenuBar: true, backgroundColor: '#ffffff', title: 'DrYAE', icon: path.join(this.assetsDir, process.platform === 'win32' ? 'icon.ico' : 'icon.png') } };
  }
  // petite fenêtre ouverte par un site (connexion à un compte) : même identité que l'onglet, menu clic droit simple
  attachPopup(wc) {
    try { wc.setUserAgent(this.ua()); } catch {}
    const fixUa = url => {
      let h = ''; try { h = new URL(url).hostname; } catch { return; }
      if (GOOGLE_LOGIN.test(h)) this.loginTabs.add(wc.id); else if (!GOOGLE_FAMILY.test(h)) this.loginTabs.delete(wc.id);
      const want = this.loginTabs.has(wc.id) ? UA_GOOGLE_LOGIN : this.ua();
      try { if (wc.getUserAgent() !== want) wc.setUserAgent(want); } catch {}
    };
    wc.on('will-navigate', (_e, url) => fixUa(url)); wc.on('will-redirect', (_e, url) => fixUa(url));
    wc.on('did-start-navigation', (_e, url, inPlace, isMain) => { if (isMain && !inPlace) fixUa(url); });
    wc.setWindowOpenHandler(({ url }) => { this.wc?.send('open-url', { url }); return { action: 'deny' }; });
    wc.once('destroyed', () => this.loginTabs.delete(wc.id));
    try { const w = BrowserWindow.fromWebContents(wc); w?.setMenu(null); } catch {}
  }
  isWebSession(ses) { return ses === session.fromPartition(PART) || ses === session.fromPartition(PART_PRIV); }

  contextMenu(wc, p) {
    const T = [];
    const ses = wc.session;
    const internal = pages.isPageUrl(wc.getURL());
    const cmd = (c, extra = {}) => this.wc?.send('page-cmd', { wcId: wc.id, cmd: c, ...extra });
    const dl = async (url, name) => this.quickFile({ url, name, page: wc.getURL(), incognito: ses !== session.fromPartition(PART), headers: { Cookie: await this.cookieHeader(ses, url), 'User-Agent': this.ua(), Referer: wc.getURL() } });
    const cap = this.modOn('capture');
    // 1) le lien : ouvrir, onglet privé, copier
    const link = p.linkURL && !/^dryae:/.test(p.linkURL) ? p.linkURL : '';
    if (link) {
      T.push({ label: 'Ouvrir dans un nouvel onglet', click: () => this.wc?.send('open-url', { url: link, background: true }) });
      T.push({ label: 'Ouvrir dans un onglet privé', click: () => this.wc?.send('open-url', { url: link, incognito: true }) });
      T.push({ label: 'Copier le lien', click: () => clipboard.writeText(link) });
      if (this.modOn('translate') && (p.linkText || '').trim() && !internal) T.push({ label: 'Traduire le texte du lien', click: () => cmd('translate-text', { text: p.linkText.trim(), x: p.x, y: p.y }) });
      T.push({ type: 'separator' });
    }
    // 2) les téléchargements : lien puis image / vidéo / son
    const media = p.srcURL && /^(https?|blob|data):/.test(p.srcURL) && ['image', 'video', 'audio'].includes(p.mediaType);
    const before = T.length;
    if (link) {
      if (cap) {
        if (/^magnet:/i.test(link)) T.push({ label: 'Télécharger le torrent avec DrYAE', click: () => this.onTorrent(link, {}) });
        else T.push({ label: 'Télécharger le lien avec DrYAE', click: () => dl(link) });
      } else if (/^https?:/i.test(link)) T.push({ label: 'Enregistrer le lien sous…', click: () => wc.downloadURL(link) });
    }
    if (media) {
      const lab = { image: "l'image", video: 'la vidéo', audio: "l'audio" }[p.mediaType];
      if (/^https?:/.test(p.srcURL)) {
        if (cap) T.push({ label: `Télécharger ${lab} avec DrYAE`, click: () => dl(p.srcURL) });
        else T.push({ label: `Enregistrer ${lab} sous…`, click: () => wc.downloadURL(p.srcURL) });
        T.push({ label: `Copier l'adresse de ${lab}`, click: () => clipboard.writeText(p.srcURL) });
      }
      if (p.mediaType === 'image' && this.modOn('scan')) T.push({ label: "Traduire le texte de l'image", click: () => cmd('scan-one', { src: p.srcURL, x: p.x, y: p.y }) });
      if (p.mediaType === 'video' && this.modOn('pip')) T.push({ label: 'Image dans l\'image', click: () => this.pipToggle(wc) });
    }
    if (T.length > before) T.push({ type: 'separator' });
    if (p.selectionText) {
      T.push({ label: 'Copier', role: 'copy' });
      const s = p.selectionText.trim();
      if (this.modOn('translate') && !internal) T.push({ label: `Traduire « ${s.slice(0, 24)}${s.length > 24 ? '…' : ''} »`, click: () => cmd('translate-selection') });
      if (/^(https?:\/\/|magnet:)\S+$/i.test(s)) { if (cap) T.push({ label: 'Télécharger ce lien avec DrYAE', click: () => (s.startsWith('magnet:') ? this.onTorrent(s, {}) : dl(s)) }); }
      else T.push({ label: `Rechercher « ${s.slice(0, 30)}${s.length > 30 ? '…' : ''} »`, click: () => this.wc?.send('open-url', { url: this.searchUrl(s) }) });
    }
    if (p.isEditable) T.push({ label: 'Couper', role: 'cut' }, { label: 'Copier', role: 'copy' }, { label: 'Coller', role: 'paste' }, { type: 'separator' });
    T.push({ label: 'Précédent', enabled: wc.canGoBack(), click: () => wc.goBack() }, { label: 'Actualiser', click: () => wc.reload() });
    if (!internal) {
      if (this.modOn('translate') && !p.selectionText) T.push({ label: 'Traduire la page', click: () => cmd('translate-page') });
      if (cap) T.push({ label: 'Extraire les liens de la page', click: () => this.wc?.send('grab-links', { wcId: wc.id }) });
      if (this.modOn('adblock')) T.push({ label: 'Masquer cet élément…', click: () => cmd('picker', { x: p.x, y: p.y }) });
    }
    T.push({ label: 'Inspecter', click: () => wc.inspectElement(p.x, p.y) });
    try { const extItems = this.ext && !internal ? this.ext.getContextMenuItems(wc, p) : []; if (extItems.length) { T.push({ type: 'separator' }); extItems.forEach(i => T.push(i)); } } catch {}
    Menu.buildFromTemplate((global.DRYAE_TRMENU || (x => x))(T)).popup({ window: this.win });
  }
  searchUrl(q) { return (SEARCH[this.B().search] || SEARCH.google).replace('%s', encodeURIComponent(q)); }
  // image dans l'image : demande faite avec un « geste » de l'utilisateur (raccourci, menu)
  pipToggle(wc) {
    if (!wc || wc.isDestroyed()) return;
    const js = `(async () => { try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return 'off'; }
      const vs = [...document.querySelectorAll('video')].filter(v => v.readyState > 0);
      const v = vs.sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))[0];
      if (!v) return 'none';
      if (v.disablePictureInPicture) v.disablePictureInPicture = false;
      await v.requestPictureInPicture(); return 'on';
    } catch (e) { return 'err:' + e.message; } })()`;
    const run = f => (f.executeJavaScriptInIsolatedWorld ? f.executeJavaScriptInIsolatedWorld(999, [{ code: js }], true) : f.executeJavaScript(js, true));
    // la vidéo peut être dans un cadre (lecteur intégré) : on essaie la page puis chaque cadre
    return (async () => {
      let r = await run(wc).catch(() => 'err');
      if (r === 'none') for (const f of wc.mainFrame.framesInSubtree) { if (f === wc.mainFrame) continue; try { r = await f.executeJavaScript(js, true); if (r !== 'none') break; } catch {} }
      if (r === 'none') this.wc?.send('toast', "Aucune vidéo sur cette page");
      return r;
    })();
  }

  // authentification HTTP (Basic/Digest) dans le navigateur
  async handleLogin(wc, details, authInfo, cb) {
    const saved = this.getPassword(authInfo.host);
    if (saved) return cb(saved.user, saved.pass);
    if (!this.wc) return cb();
    const id = Math.random().toString(36).slice(2);
    this.pendingLogins.set(id, cb);
    this.wc.send('login', { id, host: authInfo.host, realm: authInfo.realm });
  }

  // ---------- favoris (arbre : barre de favoris + autres favoris) ----------
  bmInit() {
    if (!this.store.bm) {
      this.store.bm = {
        bar: { id: 'bar', type: 'folder', title: 'Barre de favoris', children: (this.store.bookmarks || []).map(b => ({ id: uid(), type: 'url', title: b.title || b.url, url: b.url, t: b.t || Date.now() })) },
        other: { id: 'other', type: 'folder', title: 'Autres favoris', children: [] },
      };
    }
    this.bmSyncFlat();
  }
  bmRoots() { return [this.store.bm.bar, this.store.bm.other]; }
  bmWalk(fn, nodes = this.bmRoots(), parent = null) { for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; if (fn(n, parent, i) === false) return false; if (n.children && this.bmWalk(fn, n.children, n) === false) return false; } }
  bmFind(id) { let r = null; this.bmWalk((n, parent, index) => { if (n.id === id) { r = { node: n, parent, index }; return false; } }); return r; }
  bmFlat() { const out = []; this.bmWalk(n => { if (n.type === 'url') out.push(n); }); return out; }
  bmSyncFlat() { this.store.bookmarks = this.bmFlat().map(b => ({ url: b.url, title: b.title, t: b.t, fav: b.fav })); }
  bmChanged() { this.bmSyncFlat(); this.saveStore(); this.wc?.send('bm', { tree: this.store.bm, flat: this.store.bookmarks }); pages.broadcast('bm', this.store.bm); }
  bmAdd({ parentId = 'bar', index = -1, type = 'url', title = '', url = '', fav = '' }) {
    const p = this.bmFind(parentId)?.node || this.store.bm.bar;
    if (p.type !== 'folder') throw new Error('Dossier introuvable');
    const n = type === 'folder' ? { id: uid(), type, title: title || 'Nouveau dossier', children: [], t: Date.now() } : { id: uid(), type: 'url', title: title || url, url, fav, t: Date.now() };
    if (index < 0 || index > p.children.length) p.children.push(n); else p.children.splice(index, 0, n);
    this.bmChanged(); return n;
  }
  bmRemove(ids) {
    const removed = [];
    for (const id of [].concat(ids)) { if (id === 'bar' || id === 'other') continue; const f = this.bmFind(id); if (!f || !f.parent) continue; f.parent.children.splice(f.index, 1); removed.push({ node: f.node, parentId: f.parent.id, index: f.index }); }
    this.bmChanged(); return removed;
  }
  bmRestore(list) { for (const r of [].concat(list).reverse()) { const p = this.bmFind(r.parentId)?.node || this.store.bm.bar; p.children.splice(Math.min(r.index, p.children.length), 0, r.node); } this.bmChanged(); }
  bmMove(ids, parentId, index) {
    const p = this.bmFind(parentId)?.node; if (!p || p.type !== 'folder') return;
    const nodes = [];
    for (const id of [].concat(ids)) {
      const f = this.bmFind(id); if (!f || !f.parent) continue;
      let bad = false; // pas de dossier dans lui-même
      if (f.node.type === 'folder') this.bmWalk(m => { if (m.id === p.id) bad = true; }, [f.node]);
      if (bad) continue;
      if (f.parent === p && f.index < index) index--;
      f.parent.children.splice(f.index, 1); nodes.push(f.node);
    }
    if (index < 0 || index > p.children.length) index = p.children.length;
    p.children.splice(index, 0, ...nodes);
    this.bmChanged();
  }
  bmUpdate(id, patch) { const f = this.bmFind(id); if (!f) return; if (patch.title !== undefined) f.node.title = String(patch.title).slice(0, 500); if (patch.url !== undefined && f.node.type === 'url') f.node.url = String(patch.url); if (patch.fav) f.node.fav = patch.fav; this.bmChanged(); return f.node; }
  bmToggle({ url, title, fav }) {
    const ex = this.bmFlat().filter(b => b.url === url);
    if (ex.length) { this.bmRemove(ex.map(b => b.id)); return null; }
    return this.bmAdd({ parentId: 'bar', title, url, fav });
  }
  bmExportHtml() {
    const e = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const walk = (nodes, ind) => nodes.map(n => n.type === 'folder'
      ? `${ind}<DT><H3 ADD_DATE="${Math.round((n.t || Date.now()) / 1000)}"${n.id === 'bar' ? ' PERSONAL_TOOLBAR_FOLDER="true"' : ''}>${e(n.title)}</H3>\n${ind}<DL><p>\n${walk(n.children, ind + '    ')}${ind}</DL><p>\n`
      : `${ind}<DT><A HREF="${e(n.url)}" ADD_DATE="${Math.round((n.t || Date.now()) / 1000)}">${e(n.title)}</A>\n`).join('');
    return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${walk(this.bmRoots(), '    ')}</DL><p>\n`;
  }
  // fichier de favoris au format HTML (exporté par tous les navigateurs)
  bmImportHtml(html) {
    const root = { children: [] }; const stack = [root]; let pendingFolder = null, n = 0;
    const un = s => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const re = /<DT><H3([^>]*)>([\s\S]*?)<\/H3>|<DT><A([^>]*)>([\s\S]*?)<\/A>|<DL>|<\/DL>/gi; let m;
    while ((m = re.exec(html))) {
      const top = stack[stack.length - 1];
      if (m[2] !== undefined) { pendingFolder = { id: uid(), type: 'folder', title: un(m[2]).trim() || 'Dossier', children: [], t: Date.now(), bar: /PERSONAL_TOOLBAR_FOLDER/i.test(m[1]) }; top.children.push(pendingFolder); }
      else if (m[4] !== undefined) { const href = (/HREF="([^"]*)"/i.exec(m[3]) || [])[1]; if (href && /^(https?|file|ftp):/i.test(un(href))) { top.children.push({ id: uid(), type: 'url', url: un(href), title: un(m[4]).trim() || un(href), t: Date.now() }); n++; } }
      else if (/^<DL>/i.test(m[0])) { if (pendingFolder) { stack.push(pendingFolder); pendingFolder = null; } else if (stack.length > 1 || root.children.length) stack.push(stack[stack.length - 1]); }
      else if (stack.length > 1) stack.pop();
    }
    if (!n) throw new Error('Aucun favori trouvé dans ce fichier.');
    const folder = { id: uid(), type: 'folder', title: 'Importés', children: [], t: Date.now() };
    for (const c of root.children) { if (c.bar) { delete c.bar; c.title = c.title + ' (importés)'; } folder.children.push(c); }
    this.store.bm.other.children.push(folder);
    this.bmChanged();
    return n;
  }

  // ---------- historique ----------
  histDays(q, mode) {
    const f = String(q || '').trim().toLowerCase();
    return this.store.history.filter(h => !f || (h.title + ' ' + h.url).toLowerCase().includes(f));
  }
  histDelete(keys) {
    const set = new Set([].concat(keys)); const removed = [];
    this.store.history = this.store.history.filter(h => { const k = h.t + '|' + h.url; if (set.has(k)) { removed.push(h); return false; } return true; });
    this.saveStore(); this.histChanged(); return removed;
  }
  histRestore(list) { this.store.history = [...this.store.history, ...[].concat(list)].sort((a, b) => b.t - a.t); this.saveStore(); this.histChanged(); }
  histChanged() { pages.broadcast('history'); }

  // ---------- pages internes : fonctions appelées par dryae://… ----------
  setupPages() {
    const P = pages.on;
    P('cfg', () => this.cfg());
    P('theme', () => this.theme());
    P('open', (url, o = {}) => {
      if (typeof url !== 'string' || !/^(https?|dryae|chrome-extension):/i.test(url)) return;
      const me = pages.sender;
      if (o.current && me) this.wc?.send('nav-tab', { wcId: me.id, url });
      else this.wc?.send('open-url', { url, background: !!o.background, incognito: !!o.incognito });
    });
    P('openPage', (name, hash) => this.openPage(name, hash));
    P('openManager', () => this.main.showMain());
    P('setBrowser', patch => { this.settings.set({ browser: patch }); if (patch && 'adblock' in patch) { this.settings.set({ browser: { modules: { adblock: { enabled: !!patch.adblock } } } }); } return this.cfg(); });
    P('setRoot', patch => { const ok = ['restoreSession', 'theme', 'lang']; const p = {}; for (const k of ok) if (k in (patch || {})) p[k] = patch[k]; this.settings.set(p); if (p.lang) this.main.setLang?.(p.lang); return this.cfg(); });
    P('resetBrowser', () => { const def = this.settings.def.browser; const keep = { modules: this.B().modules, filterLists: this.B().filterLists, customFilters: this.B().customFilters }; this.settings.set({ browser: { ...JSON.parse(JSON.stringify(def)), ...keep } }); return this.cfg(); });
    P('about', () => ({ version: app.getVersion(), chrome: process.versions.chrome, electron: process.versions.electron, update: this.main.updateInfo?.() }));
    P('updateCheck', () => this.main.updateCheck?.());
    P('updateInstall', () => this.main.updateInstall?.());
    P('pickDir', async def => { const r = await dialog.showOpenDialog(this.win, { properties: ['openDirectory', 'createDirectory'], defaultPath: def || app.getPath('downloads') }); return r.canceled ? null : r.filePaths[0]; });
    P('languages', () => this.main.languages?.() || []);
    P('engines', () => Object.keys(SEARCH));
    // historique
    P('history', (q) => this.histDays(q));
    P('historyDelete', keys => this.histDelete(keys));
    P('historyRestore', list => this.histRestore(list));
    P('closedTabs', () => this.store.closed || []);
    P('reopenClosed', i => { const c = (this.store.closed || [])[i]; if (!c) return; this.store.closed.splice(i, 1); this.saveStore(); this.wc?.send('open-url', { url: c.url, incognito: false }); pages.broadcast('closed'); });
    P('clearInfo', async from => {
      const ses = session.fromPartition(PART);
      const hist = this.store.history.filter(h => h.t >= from).length;
      let sites = 0; try { sites = new Set((await ses.cookies.get({})).map(c => c.domain.replace(/^\./, ''))).size; } catch {}
      let cache = 0; try { cache = await ses.getCacheSize(); } catch {}
      return { hist, sites, cache, finished: this.main.manager.list.filter(d => d.status === 'done').length, passwords: this.vault.data.logins.length, nd: this.nd.length };
    });
    P('clearData', async (from, what) => {
      const ses = session.fromPartition(PART);
      if (what.history) { this.store.history = this.store.history.filter(h => h.t < from); if (!from) this.store.typed = []; else this.store.typed = this.store.typed.filter(x => x.t < from); this.store.closed = []; this.saveStore(); this.histChanged(); }
      if (what.cookies) { await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'websql', 'filesystem', 'serviceworkers', 'cachestorage'] }).catch(() => {}); }
      if (what.cache) { await ses.clearCache().catch(() => {}); await ses.clearStorageData({ storages: ['shadercache', 'cachestorage'] }).catch(() => {}); }
      if (what.downloads) { this.nd = this.nd.filter(d => d.state === 'progressing'); this.sendNd(); this.main.manager.clearFinished(); }
      if (what.autofill) { this.vault.clearAutofill(); }
      if (what.passwords) { this.vault.clearAll(); }
      if (what.perms) { this.store.perms = {}; this.store.hides = {}; this.saveStore(); }
      return true;
    });
    // favoris
    P('bookmarks', () => this.store.bm);
    P('bmAdd', o => this.bmAdd(o));
    P('bmRemove', ids => this.bmRemove(ids));
    P('bmRestore', list => this.bmRestore(list));
    P('bmMove', (ids, parentId, index) => this.bmMove(ids, parentId, index));
    P('bmUpdate', (id, patch) => this.bmUpdate(id, patch));
    P('bmExport', async () => {
      const r = await dialog.showSaveDialog(this.win, { defaultPath: 'DrYAE-favoris.html', filters: [{ name: 'HTML', extensions: ['html', 'htm'] }] });
      if (r.canceled || !r.filePath) return null;
      await fsp.writeFile(r.filePath, this.bmExportHtml()); return r.filePath;
    });
    P('bmImport', async () => {
      const r = await dialog.showOpenDialog(this.win, { properties: ['openFile'], filters: [{ name: 'HTML', extensions: ['html', 'htm'] }] });
      if (r.canceled || !r.filePaths[0]) return null;
      return this.bmImportHtml(await fsp.readFile(r.filePaths[0], 'utf8'));
    });
    // extensions
    P('extList', () => this.extList());
    P('modules', () => M.MODULES.map(m => ({ ...m, ...M.MOD_DEFAULT, ...(this.B().modules || {})[m.id], on: this.modOn(m.id) })));
    P('setModule', (id, patch) => { if (!M.MODULES.some(m => m.id === id)) return; this.settings.set({ browser: { modules: { [id]: patch } } }); if (id === 'adblock' && 'enabled' in patch) this.settings.set({ browser: { adblock: !!patch.enabled } }); if (id === 'adblock' && patch.installed === false) this.settings.set({ browser: { adblock: false } }); if (id === 'adblock' && patch.installed === true) this.settings.set({ browser: { adblock: true, modules: { adblock: { enabled: true } } } }); return true; });
    P('extEnable', (id, on) => this.extSetEnabled(id, on));
    P('extRemove', id => this.extRemove(id));
    P('extInstall', v => this.extInstall(v));
    P('extLoadDir', () => this.extLoadDir());
    P('extUpdate', async () => { try { const { updateExtensions } = require('electron-chrome-web-store'); if (updateExtensions) await updateExtensions(session.fromPartition(PART)); } catch (e) { throw new Error(e.message); } return this.extList(); });
    P('openExtOptions', url => { if (/^chrome-extension:\/\//.test(url)) this.wc?.send('open-url', { url }); });
    // bloqueur
    P('adStats', () => ({ total: this.blockedTotal, updated: this.B().adblockUpdated || 0, hides: this.store.hides || {}, lists: Object.keys(AD_LISTS) }));
    P('adUpdate', () => this.updateBlocker(true));
    P('hideRemove', (host, sel) => { const h = this.store.hides || {}; if (h[host]) { h[host] = sel === undefined ? [] : h[host].filter(s => s !== sel); if (!h[host].length) delete h[host]; } this.saveStore(); return h; });
    // téléchargements du navigateur
    P('ocrLangs', () => ({ langs: M.OCR_LANGS, have: M.ocrDownloaded() }));
    P('providers', () => M.PROVIDERS);
    P('shortcutPasswords', () => this.main.passwordShortcut?.());
  }
  async extRemove(id) {
    const ses = session.fromPartition(PART);
    const dis = (this.store.extDisabled || []).find(d => d.id === id);
    if (dis) { this.store.extDisabled = this.store.extDisabled.filter(d => d.id !== id); this.saveStore(); if (dis.path && dis.path.startsWith(this.extDir)) await fsp.rm(dis.path, { recursive: true, force: true }).catch(() => {}); return this.extList(); }
    try { const { uninstallExtension } = require('electron-chrome-web-store'); await uninstallExtension(id, { session: ses, extensionsPath: this.extDir }); }
    catch { const x = (ses.extensions || ses).getExtension(id); (ses.extensions || ses).removeExtension(id); if (x && x.path && x.path.startsWith(this.extDir)) await fsp.rm(x.path, { recursive: true, force: true }).catch(() => {}); }
    this.wc?.send('ext-changed');
    return this.extList();
  }
  async extInstall(v) {
    const tr = x => (global.DRYAE_T || (y => y))(x);
    const m = String(v || '').match(/(?:^|[/=])([a-p]{32})(?:[/?#&]|$)/i);
    if (!m) throw new Error(tr('Lien ou identifiant non reconnu (32 lettres de a à p).'));
    const { installExtension } = require('electron-chrome-web-store');
    try {
      const x = await installExtension(m[1].toLowerCase(), { session: session.fromPartition(PART), extensionsPath: this.extDir });
      try { this.wc?.send('ext-changed'); } catch {}
      return { id: x.id, name: x.name };
    } catch (e) { throw new Error(tr("Impossible d'installer l'extension : {0}").replace('{0}', e.message)); }
  }
  async extLoadDir() {
    const r = await dialog.showOpenDialog(this.win, { title: "Dossier de l'extension (contenant manifest.json)", properties: ['openDirectory'] });
    if (r.canceled) return null;
    const src = r.filePaths[0];
    if (!fs.existsSync(path.join(src, 'manifest.json'))) throw new Error('Ce dossier ne contient pas de manifest.json');
    const dst = path.join(this.extDir, 'local-' + path.basename(src).replace(/[^\w.-]/g, '_'));
    await fsp.rm(dst, { recursive: true, force: true }).catch(() => {});
    await fsp.cp(src, dst, { recursive: true });
    const ses = session.fromPartition(PART);
    await (ses.extensions || ses).loadExtension(dst, { allowFileAccess: true });
    this.wc?.send('ext-changed');
    return this.extList();
  }

  setupIpc() {
    ipcMain.handle('br:store', () => this.store);
    ipcMain.handle('br:settings', () => this.cfg());
    ipcMain.handle('br:setSettings', (_e, patch) => { this.settings.set({ browser: patch }); if (patch && 'adblock' in patch) this.settings.set({ browser: { modules: { adblock: { enabled: !!patch.adblock, ...(patch.adblock ? { installed: true } : {}) } } } }); return this.cfg(); });
    ipcMain.handle('br:history', (_e, { url, title, fav, favOnly }) => {
      if (!/^https?:/.test(url)) return;
      const h = this.store.history;
      if (h[0]?.url === url) { h[0].title = title || h[0].title; if (fav) h[0].fav = fav; } else if (favOnly) return; else h.unshift({ url, title, t: Date.now(), ...(fav ? { fav } : {}) });
      if (h.length > 10000) h.length = 10000;
      this.saveStore();
      clearTimeout(this._hb); this._hb = setTimeout(() => this.histChanged(), 1500);
    });
    ipcMain.handle('br:clearHistory', () => { this.store.history = []; this.store.typed = []; this.saveStore(); this.histChanged(); });
    ipcMain.handle('br:typed', (_e, text) => {
      text = String(text || '').trim(); if (!text || text.length > 500) return;
      this.store.typed = [{ text, t: Date.now(), n: ((this.store.typed.find(x => x.text === text) || {}).n || 0) + 1 }, ...this.store.typed.filter(x => x.text !== text)].slice(0, 500);
      this.saveStore();
    });
    ipcMain.handle('br:closed', (_e, list) => { this.store.closed = (list || []).filter(c => c && /^https?:/.test(c.url)).slice(-25).reverse(); this.saveStore(); pages.broadcast('closed'); });
    ipcMain.handle('br:suggest', (_e, q) => {
      q = String(q || '').trim().toLowerCase(); if (!q) return [];
      const out = [], seen = new Set();
      const add = (o) => { const k = (o.url || o.text).toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push(o); };
      this.store.typed.filter(x => x.text.toLowerCase().includes(q)).sort((a, b) => (b.text.toLowerCase().startsWith(q) - a.text.toLowerCase().startsWith(q)) || b.n - a.n || b.t - a.t).slice(0, 4).forEach(x => add({ kind: isUrlLike(x.text) ? 'url' : 'search', text: x.text, url: isUrlLike(x.text) ? x.text : '' }));
      this.store.bookmarks.filter(b => (b.title + ' ' + b.url).toLowerCase().includes(q)).slice(0, 3).forEach(b => add({ kind: 'bookmark', text: b.title || b.url, url: b.url }));
      const counts = new Map();
      for (const h of this.store.history) { if (!(h.title + ' ' + h.url).toLowerCase().includes(q)) continue; const c = counts.get(h.url); if (c) c.n++; else counts.set(h.url, { ...h, n: 1 }); }
      [...counts.values()].sort((a, b) => (hostOf(b.url).startsWith(q) - hostOf(a.url).startsWith(q)) || b.n - a.n || b.t - a.t).slice(0, 6).forEach(h => add({ kind: 'history', text: h.title || h.url, url: h.url }));
      return out.slice(0, 9);
    });
    ipcMain.handle('br:session', (_e, sess) => { if (sess && Array.isArray(sess.tabs)) { this.store.session = { tabs: sess.tabs.filter(t => /^(https?|dryae):/.test(t.url)).slice(0, 50), active: sess.active | 0 }; this.saveStore(); } });
    ipcMain.handle('br:torInspect', async (_e, src, o) => { try { return { ok: true, info: await this.main.torrentInspect(src, o) }; } catch (e) { return { ok: false, error: String(e.message || e) }; } });
    ipcMain.handle('br:torAdd', (_e, o) => { this.main.torrentAdd(o); return true; });
    ipcMain.handle('br:torQuick', (_e, src) => this.main.torrentQuick(src));
    ipcMain.handle('br:ytInspect', async (_e, url, page) => {
      try { return { ok: true, v: await this.main.manager.ytdl.inspect(url, { 'User-Agent': this.ua(), ...(page && page !== url ? { Referer: page } : {}) }, await this.cookieFile(page || url)) }; }
      catch (e) { return { ok: false, error: e.message }; }
    });
    ipcMain.handle('br:ytQuick', (_e, o) => {
      const v = this.main.manager.add({ type: 'ytdl', url: o.url, title: o.title || null, thumbnail: o.thumbnail || '', duration: o.duration || 0, mode: o.mode, quality: o.quality || 'best',
        audioFormat: o.audioFormat || 'mp3', audioBitrate: o.audioBitrate || '320', pageUrl: o.page || o.url, headers: { 'User-Agent': this.ua() }, startNow: true });
      this.main.notify('Ajouté à DrYAE', `${o.title || o.url}`);
      return v;
    });
    ipcMain.handle('br:hlsInfo', async (_e, { url, page, incognito }) => {
      const ses = session.fromPartition(incognito ? PART_PRIV : PART);
      try { return { ok: true, ...(await this.main.manager.hlsInfo(url, { Cookie: await this.cookieHeader(ses, url), 'User-Agent': this.ua(), Referer: page || '' })) }; }
      catch (e) { return { ok: false, error: String(e.message || e) }; }
    });
    // menu du navigateur
    ipcMain.handle('br:print', (_e, wcId) => { try { webContents.fromId(wcId)?.print({}); } catch {} });
    ipcMain.handle('br:savePage', async (_e, wcId) => {
      const wc = webContents.fromId(wcId); if (!wc) return false;
      const name = (wc.getTitle() || 'page').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'page';
      const r = await dialog.showSaveDialog(this.win, { defaultPath: path.join(this.settings.get().dir, name + '.html'), filters: [{ name: 'Page web complète', extensions: ['html'] }, { name: 'Page web (HTML seul)', extensions: ['htm'] }] });
      if (r.canceled) return false;
      await wc.savePage(r.filePath, /\.htm$/i.test(r.filePath) ? 'HTMLOnly' : 'HTMLComplete'); return true;
    });
    ipcMain.handle('br:fullscreen', () => { if (this.win) this.win.setFullScreen(!this.win.isFullScreen()); });
    ipcMain.handle('br:devtools', (_e, wcId) => { try { webContents.fromId(wcId)?.toggleDevTools(); } catch {} });
    ipcMain.handle('br:mute', (_e, wcId) => { try { const wc = webContents.fromId(wcId); wc.setAudioMuted(!wc.isAudioMuted()); return wc.isAudioMuted(); } catch { return false; } });
    ipcMain.handle('br:quit', () => this.main.quit?.());
    ipcMain.handle('br:hlsConvert', (_e, v) => { if (typeof v === 'boolean') this.settings.set({ hls: { convert: v } }); return !!this.settings.get().hls.convert; });
    ipcMain.handle('br:setRestore', (_e, v) => { this.settings.set({ restoreSession: !!v }); return !!v; });
    ipcMain.handle('br:openSettingsMain', (_e, sec) => this.main.openSettings?.(sec));
    ipcMain.handle('br:sizes', async (_e, { urls, page, incognito }) => {
      const ses = session.fromPartition(incognito ? PART_PRIV : PART);
      const cookie = urls[0] ? await this.cookieHeader(ses, urls[0]) : '';
      return this.main.manager.probeSizes(urls.slice(0, 300), { Cookie: cookie, 'User-Agent': this.ua(), Referer: page || '' });
    });
    ipcMain.handle('br:openExternal', (_e, url) => { if (/^https?:/.test(url)) shell.openExternal(url); });
    // favoris
    ipcMain.handle('br:bookmark', (_e, { url, title, remove, fav }) => {
      if (remove) { this.bmRemove(this.bmFlat().filter(b => b.url === url).map(b => b.id)); return this.store.bookmarks; }
      if (!this.bmFlat().some(b => b.url === url)) this.bmAdd({ parentId: 'bar', url, title, fav });
      return this.store.bookmarks;
    });
    ipcMain.handle('br:bmTree', () => this.store.bm);
    ipcMain.handle('br:bmAdd', (_e, o) => this.bmAdd(o));
    ipcMain.handle('br:bmUpdate', (_e, id, patch) => this.bmUpdate(id, patch));
    ipcMain.handle('br:bmRemove', (_e, ids) => this.bmRemove(ids));
    ipcMain.handle('br:bmMove', (_e, ids, parentId, index) => this.bmMove(ids, parentId, index));
    ipcMain.handle('br:bmAddAll', (_e, tabs, title) => {
      const f = this.bmAdd({ parentId: 'bar', type: 'folder', title: title || 'Onglets' });
      for (const t of tabs || []) if (/^https?:/.test(t.url)) f.children.push({ id: uid(), type: 'url', url: t.url, title: t.title || t.url, t: Date.now() });
      this.bmChanged(); return f;
    });
    ipcMain.handle('br:bmImport', async () => {
      const r = await dialog.showOpenDialog(this.win, { properties: ['openFile'], filters: [{ name: 'HTML', extensions: ['html', 'htm'] }] });
      if (r.canceled || !r.filePaths[0]) return null;
      return this.bmImportHtml(await fsp.readFile(r.filePaths[0], 'utf8'));
    });
    ipcMain.handle('br:clearCookies', async () => { await session.fromPartition(PART).clearStorageData({ storages: ['cookies'] }); });
    ipcMain.handle('br:clearCache', async () => { await session.fromPartition(PART).clearCache(); await session.fromPartition(PART).clearStorageData({ storages: ['cachestorage', 'serviceworkers', 'shadercache'] }); });
    ipcMain.handle('br:attach', (_e, wcId) => { const wc = webContents.fromId(wcId); if (wc) this.attachWebview(wc); });
    ipcMain.handle('br:download', async (_e, { url, name, page, wcId, kind, incognito, allowPage }) => {
      const ses = session.fromPartition(incognito ? PART_PRIV : PART);
      const cookie = await this.cookieHeader(ses, url);
      if (/^magnet:/i.test(url) || /\.torrent(\?|$)/i.test(url)) return this.onTorrent(url, { cookie, page });
      if (kind === 'ytdl') { this.wc?.send('quick-video', { page: url, wcId }); return; }
      return this.quickFile({ url, name, page, kind, allowPage, incognito, headers: { Cookie: cookie, 'User-Agent': this.ua(), Referer: page } });
    });
    ipcMain.handle('br:downloadMany', async (_e, { urls, page, incognito }) => {
      const ses = session.fromPartition(incognito ? PART_PRIV : PART);
      const cookie = urls[0] ? await this.cookieHeader(ses, urls[0]) : '';
      const MG = this.main.manager, out = [];
      for (const url of urls) {
        if (/^magnet:/i.test(url)) { this.onTorrent(url, {}); continue; }
        if (!/^https?:/i.test(url)) continue;
        out.push(MG.add({ type: /\.m3u8(\?|$)/i.test(url) ? 'hls' : 'http', url, pageUrl: page, pageTitle: this.pageTitle(page), headers: { Cookie: cookie, 'User-Agent': this.ua(), Referer: page } }));
      }
      return out.length;
    });
    ipcMain.handle('br:quickAdd', async (_e, o) => {
      const ses = session.fromPartition(o.incognito ? PART_PRIV : PART);
      const MG = this.main.manager;
      const headers = { 'User-Agent': this.ua(), ...(o.headers || {}) };
      if (o.page && !headers.Referer) headers.Referer = o.page;
      if (!headers.Cookie && /^https?:/.test(o.url)) headers.Cookie = await this.cookieHeader(ses, o.url);
      const common = { url: o.url, dir: o.dir || '', pageUrl: o.page || '', pageTitle: o.pageTitle || o.tabTitle || this.pageTitle(o.page), headers, startNow: o.startNow !== false, schedule: !!o.schedule, speedLimit: o.speedLimit || 0, dupAction: o.dupAction };
      if (o.kind === 'torrent' || /^magnet:/i.test(o.url)) { this.onTorrent(o.url, { cookie: headers.Cookie, page: o.page }); return null; }
      if (o.kind === 'ytdl') return MG.add({ ...common, type: 'ytdl', title: o.name || o.title || null, thumbnail: o.thumbnail || '', duration: o.duration || 0, mode: o.mode || 'video', quality: o.quality || 'best', audioFormat: o.audioFormat || 'mp3', audioBitrate: o.audioBitrate || '320' });
      const hls = o.kind === 'hls' || /\.m3u8(\?|$)/i.test(o.url);
      return MG.add({ ...common, type: hls ? 'hls' : 'http', name: o.name || null, allowPage: !!o.allowPage });
    });
    ipcMain.handle('br:pickDir', async (_e, def) => {
      const r = await dialog.showOpenDialog(this.win, { properties: ['openDirectory', 'createDirectory'], defaultPath: def || this.settings.get().dir });
      return r.canceled ? null : r.filePaths[0];
    });
    ipcMain.handle('br:defaults', () => { const S = this.settings.get(); return { dir: S.dir, ytdl: S.ytdl, categorize: S.categorize }; });
    ipcMain.handle('br:selectTab', (_e, wcId) => { try { const wc = webContents.fromId(wcId); if (wc && this.ext) this.ext.selectTab(wc); } catch {} });
    ipcMain.handle('br:extTabCreated', (_e, { reqId, wcId }) => { const r = this.extWaiters.get(reqId); if (r) { this.extWaiters.delete(reqId); r(wcId); } });
    ipcMain.handle('br:extList', () => this.extList());
    ipcMain.handle('br:extEnable', async (_e, id, on) => { await this.extSetEnabled(id, !!on); return this.extList(); });
    // capture d'une vidéo (lumières tamisées) : image de la zone, enregistrée dans « Images\DrYAE »
    ipcMain.handle('br:shot', async (_e, wcId, r) => {
      try {
        const wc = webContents.fromId(wcId); if (!wc || !r) return '';
        const img = await wc.capturePage({ x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.max(1, Math.round(r.w)), height: Math.max(1, Math.round(r.h)) });
        if (img.isEmpty()) return '';
        const dir = path.join(app.getPath('pictures'), 'DrYAE'); await fsp.mkdir(dir, { recursive: true });
        const d = new Date(), pad = n => String(n).padStart(2, '0');
        const f = path.join(dir, `capture-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`);
        await fsp.writeFile(f, img.toPNG()); clipboard.writeImage(img);
        return f;
      } catch { return ''; }
    });
    ipcMain.handle('br:showItem', (_e, f) => { if (typeof f === 'string' && f.startsWith(path.join(app.getPath('pictures'), 'DrYAE'))) shell.showItemInFolder(f); });
    ipcMain.handle('br:ocrLangs', () => ({ langs: M.OCR_LANGS, have: M.ocrDownloaded() }));
    // installation par lien de la boutique ou identifiant (si la page de la boutique ne s'affiche pas)
    ipcMain.handle('br:extInstall', (_e, v) => this.extInstall(v));
    ipcMain.handle('br:extRemove', async (_e, id) => { await this.extRemove(id); this.wc?.send('ext-changed'); return this.extList(); });
    ipcMain.handle('br:extLoadDir', () => this.extLoadDir());
    ipcMain.handle('br:whitelist', (_e, { host, add }) => {
      const w = new Set(this.B().whitelist);
      add ? w.add(host) : w.delete(host);
      this.settings.set({ browser: { whitelist: [...w] } });
      return [...w];
    });
    ipcMain.handle('br:loginReply', (_e, { id, user, pass, save, host }) => {
      const cb = this.pendingLogins.get(id); this.pendingLogins.delete(id);
      if (save && user) this.main.savePassword(host, user, pass);
      cb?.(user || undefined, pass || undefined);
    });
    ipcMain.handle('br:openMain', () => this.main.showMain());
    ipcMain.handle('br:openPage', (_e, name, hash) => this.openPage(name, hash));
    ipcMain.handle('br:feedback', () => this.main.openFeedback?.());
    ipcMain.handle('br:search', (_e, q) => this.searchUrl(q));
    ipcMain.handle('br:updateAdblock', () => this.updateBlocker(true));
    ipcMain.handle('br:setModule', (_e, id, patch) => { this.settings.set({ browser: { modules: { [id]: patch } } }); if (id === 'adblock' && 'enabled' in patch) this.settings.set({ browser: { adblock: !!patch.enabled } }); return this.cfg(); });
    ipcMain.handle('br:pip', (_e, wcId) => this.pipToggle(webContents.fromId(wcId)));
    // téléchargements du navigateur (sans DrYAE)
    ipcMain.handle('br:nd', () => this.ndView());
    ipcMain.handle('br:ndAct', (_e, id, act) => {
      const d = this.nd.find(x => x.id === id); if (!d) return;
      if (act === 'pause') d.item?.pause(); else if (act === 'resume') d.item?.resume(); else if (act === 'cancel') d.item?.cancel();
      else if (act === 'open' && d.path) shell.openPath(d.path); else if (act === 'show' && d.path) shell.showItemInFolder(d.path);
      else if (act === 'remove') this.nd = this.nd.filter(x => x !== d);
      else if (act === 'retry') { try { webContents.fromId(this._lastWc || 0); } catch {} this.wc?.send('open-url', { url: d.url, background: true }); }
      this.sendNd();
    });
    ipcMain.handle('br:ndClear', () => { this.nd = this.nd.filter(d => d.state === 'progressing'); this.sendNd(); });
    ipcMain.handle('br:ndFolder', () => shell.openPath((this.B().nativeDl || {}).dir || app.getPath('downloads')));

    // ---- appels venant des pages (script page-preload) ----
    // réglages des extensions intégrées pour cette page
    ipcMain.on('page:init', e => {
      const f = e.senderFrame; let host = ''; try { host = new URL(f?.url || '').hostname; } catch {}
      const B = this.B();
      const T = global.DRYAE_T || (s => s);
      const keys = ['Télécharger cette vidéo', 'Masquer', 'Remplir avec mon profil', 'mon profil', '(sans identifiant)', '— mot de passe enregistré', 'Suggérer un mot de passe fort', 'Utiliser ce mot de passe', 'Carte enregistrée', 'Remplir avec la carte', 'Image dans l\'image', 'Masquer le bouton sur ce site', 'Placer le bouton à gauche', 'Placer le bouton à droite', 'Traduire', 'Copier', 'Écouter', 'Fermer', 'Traduction…', 'Traduit de {0}', 'Afficher l\'original', 'Masquer les traductions', 'Arrêter', 'Lecture des images…', '{0} bulle(s) traduite(s)', 'Aucun texte trouvé dans cette image', 'Cliquez sur un élément à masquer. Molette ou ↑ ↓ : agrandir / réduire. Échap : annuler.', 'Masquer cet élément', 'Annuler', 'Traduction impossible : {0}', 'Adresse', 'Cliquez à côté pour rallumer', 'Traducteur de scans', 'Texte d\'origine', 'Échap pour rallumer', 'Aucune vidéo sur cette page', 'Boucle activée', 'Boucle désactivée', 'Sans filtre', 'Opacité gardée : {0} %', 'Protection des yeux activée', 'Protection des yeux désactivée', 'Aucune image à traduire sur cette page', 'Afficher la traduction', 'Original / traduction', 'Comparer', 'Relire cette image', 'Copier le texte traduit', 'Retirer la traduction', 'Dessinez un rectangle autour du texte à traduire. Échap : annuler.', 'Traduire la zone', 'Compte enregistré'];
      const pip = B.pip || {};
      const isInt = pages.isPageUrl(f?.url);
      e.returnValue = {
        pt: Object.fromEntries(keys.map(k => [k, T(k)])),
        internal: isInt, lang: this.settings.get().lang,
        capture: this.modOn('capture') && !isInt,
        pip: this.modOn('pip') && !isInt && !(pip.hidden || []).includes(host) ? { side: pip.side || 'left' } : null,
        translate: this.modOn('translate') && !isInt ? (() => { const t = B.translate || {}; return { selection: t.selection || 'button', off: (t.offSites || []).includes(host), hideSame: t.hideSame !== false, delay: Math.max(0, Math.min(3000, +t.delay || 0)), target: target(), second: t.second || '', pageAuto: (t.autoSites || []).includes(host) }; })() : null,
        lights: this.modOn('lights') && !isInt ? (() => { const l = B.lights || {}; return { ...l, night: (l.nightHosts || []).includes(host) || this.nightBySchedule(host), nightOff: (l.nightExcept || []).includes(host) }; })() : null,
        scan: this.modOn('scan') && !isInt ? (() => { const sc = B.scan || {}; return { auto: (sc.autoSites || []).includes(host), icons: sc.icons !== false, minSize: 250 }; })() : null,
        hides: this.modOn('adblock') && !this.loginTabs.has(e.sender.id) ? ((this.store.hides || {})[host] || []) : [],
      };
    });
    const target = () => { const B = this.B(); return (B.translate || {}).target || this.settings.get().lang || 'fr'; };
    // deuxième langue : celle choisie, sinon l'anglais (ou le français si la première langue est l'anglais)
    const second = to => { const s = (this.B().translate || {}).second; const base = String(to || '').split('-')[0]; return s && s.split('-')[0] !== base ? s : (base === 'en' ? 'fr' : 'en'); };
    const same = (a, b) => !!a && !!b && String(a).split('-')[0] === String(b).split('-')[0];
    this.trSecond = second; this.trSame = same;
    ipcMain.handle('tr:text', async (_e, texts, opts = {}) => {
      if (!this.modOn('translate') && !this.modOn('scan')) throw new Error('Traducteur désactivé');
      let to = opts.to || target();
      let r = await M.translate([].concat(texts).slice(0, 400), to, opts.from || 'auto', this.B().translate || {});
      // texte déjà dans la langue choisie (ex. français → français) : traduit automatiquement dans la 2e langue
      if (opts.auto2 && same(r.from, to)) { to = second(to); r = await M.translate([].concat(texts).slice(0, 400), to, r.from, this.B().translate || {}); }
      return { ...r, to };
    });
    ipcMain.handle('tr:target', () => target());
    // fenêtre du traducteur (barre d'outils) : traduction du texte saisi, avec 2e langue automatique
    ipcMain.handle('br:tr', async (_e, text, to) => {
      if (!this.modOn('translate')) throw new Error('Traducteur désactivé');
      text = String(text || '').slice(0, 5000); if (!text.trim()) return { text: '', from: '', to: to || target() };
      const T = this.B().translate || {}; let dest = to || target();
      let r = await M.translate([text], dest, 'auto', T);
      if (same(r.from, dest)) { dest = second(dest); r = await M.translate([text], dest, r.from, T); }
      return { text: r.texts[0] || '', from: r.from, to: dest };
    });
    // réglages par site (traducteur, traducteur de scans, bloqueur)
    ipcMain.handle('br:site', (_e, kind, host, val) => {
      host = String(host || '').toLowerCase(); if (!host) return this.cfg();
      const B = this.B();
      const toggle = (obj, key) => { const s = new Set((obj || {})[key] || []); val ? s.add(host) : s.delete(host); return [...s].slice(-500); };
      if (kind === 'trOff') this.settings.set({ browser: { translate: { ...(B.translate || {}), offSites: toggle(B.translate, 'offSites') } } });
      else if (kind === 'trAuto') this.settings.set({ browser: { translate: { ...(B.translate || {}), autoSites: toggle(B.translate, 'autoSites') } } });
      else if (kind === 'scanAuto') this.settings.set({ browser: { scan: { ...(B.scan || {}), autoSites: toggle(B.scan, 'autoSites') } } });
      else if (kind === 'nightExcept') this.settings.set({ browser: { lights: { ...(B.lights || {}), nightExcept: toggle(B.lights, 'nightExcept') } } });
      else if (kind === 'adMode') {
        const m = { ...(B.adModes || {}) }; if (['none', 'basic', 'optimal'].includes(val) && val !== (B.adDefaultMode || 'optimal')) m[host] = val; else m[host] = null; // null : retour au mode par défaut (les réglages sont fusionnés)
        const wl = (B.whitelist || []).filter(w => w !== host);
        this.settings.set({ browser: { adModes: m, whitelist: wl } });
      }
      return this.cfg();
    });
    ipcMain.handle('br:extPin', (_e, id, pin) => { const s = new Set(this.B().extUnpinned || []); pin ? s.delete(id) : s.add(id); this.settings.set({ browser: { extUnpinned: [...s] } }); return [...s]; });
    ipcMain.handle('br:extOptions', (_e, id) => { const x = this.extList().find(e => e.id === id); if (x?.options) this.open(x.options); });
    ipcMain.handle('br:stats', (_e, wcId) => ({ page: this.blockedCount.get(wcId) || 0, total: this.blockedTotal || 0 }));
    ipcMain.handle('pk:add', (e, sel) => {
      let host = ''; try { host = new URL(e.senderFrame.url).hostname; } catch {}
      if (!host || typeof sel !== 'string' || sel.length > 500) return;
      const h = this.store.hides || (this.store.hides = {});
      h[host] = [...new Set([...(h[host] || []), sel])].slice(-200);
      this.saveStore(); return true;
    });
    ipcMain.handle('pip:pref', (e, patch) => {
      let host = ''; try { host = new URL(e.senderFrame.url).hostname; } catch {}
      const P = { ...(this.B().pip || {}) };
      if (patch.hideHere && host) P.hidden = [...new Set([...(P.hidden || []), host])];
      if (patch.side) P.side = patch.side;
      this.settings.set({ browser: { pip: P } }); return true;
    });
    ipcMain.handle('lights:pref', (_e, patch = {}) => {
      const L = { ...(this.B().lights || {}) };
      if ('opacity' in patch) L.opacity = Math.max(30, Math.min(97, +patch.opacity || 85));
      if ('eye' in patch) L.eye = !!patch.eye;
      this.settings.set({ browser: { lights: L } }); this.pushCfg(); return true;
    });
    ipcMain.handle('lights:night', (e, on) => {
      let host = ''; try { host = new URL(e.senderFrame.url).hostname; } catch {}
      const L = { ...(this.B().lights || {}) }; const s = new Set(L.nightHosts || []);
      on ? s.add(host) : s.delete(host); L.nightHosts = [...s];
      this.settings.set({ browser: { lights: L } }); return on;
    });
    // traducteur de scans : lecture du texte d'une image puis traduction
    ipcMain.handle('scan:image', async (e, o) => {
      if (!this.modOn('scan')) throw new Error('Traducteur de scans désactivé');
      if (o.region && o.rect) { o.src = ''; o.data = null; } // capture d'une zone choisie à l'écran
      const wc = e.sender; const S = this.B().scan || {};
      let buf = null, scale = 1;
      if (o.data) buf = Buffer.from(o.data);
      else if (/^https?:/i.test(o.src || '')) {
        try { const r = await wc.session.fetch(o.src, { headers: { Referer: o.page || '' } }); if (r.ok && /^image\//.test(r.headers.get('content-type') || 'image/')) buf = Buffer.from(await r.arrayBuffer()); } catch {}
      }
      const { nativeImage } = require('electron');
      let img = buf ? nativeImage.createFromBuffer(buf) : null;
      // WebP, AVIF… : décodés par le moteur du navigateur (l'image entière, pas seulement la partie visible)
      if (buf && (!img || img.isEmpty())) img = await this.decodeImage(buf).catch(() => null);
      if (!img || img.isEmpty()) {
        // image illisible directement (protection) : on lit la partie visible à l'écran
        if (!o.rect || o.rect.w < 50 || o.rect.h < 30) throw new Error('Image inaccessible');
        img = await wc.capturePage({ x: Math.max(0, Math.round(o.rect.x)), y: Math.max(0, Math.round(o.rect.y)), width: Math.round(o.rect.w), height: Math.round(o.rect.h) });
        if (img.isEmpty()) throw new Error('Image inaccessible');
        scale = 0;
      }
      const src = o.lang && /^[a-z_]+$/.test(o.lang) ? o.lang : (S.source || 'auto');
      let groups, w;
      if (M.PADDLE_LANGS.includes(src)) {
        // lecture « automatique » (modèle multilingue) : la langue n'a pas besoin d'être choisie
        let sz = img.getSize();
        if (sz.width < 700) { img = img.resize({ width: sz.width * 2, quality: 'best' }); sz = img.getSize(); }
        const bm = img.toBitmap(); // BGRA
        for (let i = 0; i < bm.length; i += 4) { const t = bm[i]; bm[i] = bm[i + 2]; bm[i + 2] = t; }
        groups = await require('./paddle-ocr').readBubbles({ width: sz.width, height: sz.height, data: bm });
        w = sz.width;
      } else {
        // autres écritures (coréen, thaï, arabe, cyrillique…) : lecture classique
        const sz = img.getSize();
        if (sz.width < 1100) img = img.resize({ width: sz.width * 2, quality: 'best' });
        w = img.getSize().width;
        groups = await M.readImage(img.toPNG(), src + (S.withEng && !/^eng/.test(src) ? '+eng' : ''));
      }
      if (!groups.length) return { blocks: [], w };
      // langue d'arrivée : celle choisie (par défaut celle du traducteur) ; texte déjà dans cette langue → 2e langue
      let to = o.to || S.target || target();
      let tr = await M.translate(groups.map(g => g.text), to, 'auto', this.B().translate || {});
      if (!o.to && same(tr.from, to)) { to = second(to); tr = await M.translate(groups.map(g => g.text), to, tr.from, this.B().translate || {}); }
      return { blocks: groups.map((g, i) => ({ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, text: g.text, tr: tr.texts[i], vertical: g.vertical })), w, captured: scale === 0, from: tr.from, to };
    });
  }
}

function isUrlLike(s) { return /^(https?:\/\/|file:\/\/)/i.test(s) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s); }

module.exports = { WebBrowser, PART, PART_PRIV, UA_DESKTOP, UA_MOBILE };
