// Navigateur intégré : sessions, bloqueur de pubs, détecteur de médias, interception des téléchargements
const { BrowserWindow, WebContentsView, session, ipcMain, Menu, clipboard, app, dialog } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ElectronBlocker, adsAndTrackingLists } = require('@ghostery/adblocker-electron');
const PRELOAD_PATH = path.resolve(require.resolve('@ghostery/adblocker-electron-preload'));
const { extOf, hostOf, uniquePath, sanitize } = require('./util');

const CHROME_MAJOR = (process.versions.chrome || '152').split('.')[0];
const UA_DESKTOP = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`;
const ACCEPT_LANG = 'fr-FR,fr,en-US,en';
const PAGE_PRELOAD = path.join(__dirname, '..', 'browser', 'page-preload.js');
// Google refuse la connexion depuis les navigateurs intégrés : on se présente comme Firefox sur ses pages de connexion
// version de Firefox actuelle estimée (une version toutes les 4 semaines depuis la 132 du 29/10/2024)
const FF = 132 + Math.max(0, Math.floor((Date.now() - Date.UTC(2024, 9, 29)) / (28 * 864e5)));
const UA_GOOGLE_LOGIN = `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${FF}.0) Gecko/20100101 Firefox/${FF}.0`;
const GOOGLE_LOGIN = /^(accounts\.google\.[a-z.]+|accounts\.youtube\.com|myaccount\.google\.com)$/;
// vérifications anti-robot : jamais filtrées par le bloqueur
const CHALLENGE = /(^|\.)(challenges\.cloudflare\.com|hcaptcha\.com|recaptcha\.net|turnstile\.cloudflare\.com)$/;
const UA_MOBILE = `Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Mobile Safari/537.36`;
const PART = 'persist:dryae-web', PART_PRIV = 'dryae-incognito';
const SEARCH = {
  google: 'https://www.google.com/search?q=%s', bing: 'https://www.bing.com/search?q=%s', duckduckgo: 'https://duckduckgo.com/?q=%s',
  qwant: 'https://www.qwant.com/?q=%s', yahoo: 'https://search.yahoo.com/search?p=%s', brave: 'https://search.brave.com/search?q=%s',
};
const MEDIA_EXT = { video: 'mp4 webm mkv mov avi flv m4v 3gp', audio: 'mp3 m4a aac ogg opus wav flac', hls: 'm3u8', dash: 'mpd', subtitle: 'vtt srt ass' };
const SKIP_HOST = /(^|\.)(youtube\.com|googlevideo\.com|ytimg\.com)$/;

class WebBrowser {
  constructor({ main, settings, userDir, onDownload, onTorrent, getPassword, assetsDir }) {
    Object.assign(this, { main, settings, userDir, onDownload, onTorrent, getPassword, assetsDir });
    this.win = null;   // fenêtre unique de DrYAE (fournie par main.js) une fois le navigateur ouvert
    this.view = null;  // vue du navigateur, posée au-dessus du gestionnaire
    this.blocker = null;
    this.blockedCount = new Map();
    this.storeFile = path.join(userDir, 'browser.json');
    this.store = { bookmarks: [], history: [], typed: [], session: null, browserOpen: false, perms: {} };
    try { this.store = { ...this.store, ...JSON.parse(fs.readFileSync(this.storeFile, 'utf8')) }; } catch {}
    this.seenMedia = new Map(); // wcId -> Set(url)
    this.extWaiters = new Map();
    const { Vault } = require('./vault');
    this.vault = new Vault({ userDir, enc: main.enc, dec: main.dec, settings, getWc: () => this.wc, privatePartition: PART_PRIV });
    this.pendingLogins = new Map();
    this.setupIpc();
  }
  B() { return this.settings.get().browser; }
  saveStoreSync() { clearTimeout(this._st); try { fs.writeFileSync(this.storeFile, JSON.stringify(this.store)); } catch {} }
  get wc() { return this.view && !this.view.webContents.isDestroyed() ? this.view.webContents : null; }
  visible() { return !!(this.view && this.view.getVisible && this.view.getVisible()); }
  onQuit() {
    this.quitting = true; this.saveStoreSync();
    try { session.fromPartition(PART_PRIV).clearStorageData(); } catch {}
    if (this.B().clearOnExit) { try { session.fromPartition(PART).clearStorageData(); } catch {} this.store.history = []; this.saveStoreSync(); }
  }
  sendTheme() { this.wc?.send('theme', this.settings.get().theme); }
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
    if (B.doh) { try { app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: [B.doh] }); } catch {} }
    for (const ses of this.sessions()) this.setupSession(ses);
    await this.loadBlocker();
    await this.setupExtensions().catch(e => console.error('extensions', e.message));
    this.settings.on('change', (_d, patch) => {
      if (patch.browser && ('ua' in patch.browser)) this.sessions().forEach(s => s.setUserAgent(this.ua()));
      if (patch.browser && ('filterLists' in patch.browser || 'hostsSources' in patch.browser || 'customFilters' in patch.browser)) this.updateBlocker(true);
    });
    // mise à jour des listes en arrière-plan (tous les 4 jours)
    setTimeout(() => this.updateBlocker(false), 20000);
    ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (e, url, msg) => this.adblockActiveFor(url) ? this.blocker?.onInjectCosmeticFilters(e, url, msg) : undefined);
    ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', e => this.blocker?.onIsMutationObserverEnabled(e));
  }
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
    await installChromeWebStore({ session: ses, extensionsPath: this.extDir, allowUnpackedExtensions: true, minimumManifestVersion: 2, autoUpdate: true });
  }
  async extCreateTab(details) {
    if (!this.wc) { this.open(''); await new Promise(r => this.wc.once('did-finish-load', r)); }
    const reqId = Math.random().toString(36).slice(2);
    const p = new Promise(r => this.extWaiters.set(reqId, r));
    this.wc.send('ext-create-tab', { reqId, url: details?.url || '', active: details?.active !== false });
    const wcId = await Promise.race([p, new Promise(r => setTimeout(() => r(null), 10000))]);
    const wc = wcId ? require('electron').webContents.fromId(wcId) : null;
    if (!wc) throw new Error('onglet non créé');
    return [wc, this.win];
  }
  extList() {
    const ses = session.fromPartition(PART);
    const list = (ses.extensions || ses).getAllExtensions();
    return list.map(x => ({ id: x.id, name: x.name, version: x.version, description: x.manifest?.description || '', path: x.path,
      icon: (() => { const ic = x.manifest?.icons || {}; const k = Object.keys(ic).sort((a, b) => b - a)[0]; return k ? `crx://extension-icon/${x.id}/${k}/2?partition=${encodeURIComponent(PART)}` : ''; })() }));
  }
  // ajout direct depuis le navigateur (sans ouvrir la fenêtre principale)
  // titre de l'onglet qui affiche cette page
  pageTitle(page) {
    if (!page) return '';
    try { const { webContents } = require('electron'); const w = webContents.getAllWebContents().find(x => !x.isDestroyed() && x.getURL() === page); return w ? w.getTitle() : ''; } catch { return ''; }
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
      try { this.setBlocker(ElectronBlocker.deserialize(new Uint8Array(await fsp.readFile(f)))); return; } catch {}
    }
  }
  setBlocker(b) {
    this.blocker = b;

  }
  countBlocked(id) {
    this.blockedCount.set(id, (this.blockedCount.get(id) || 0) + 1);
    this.wc?.send('adblock:count', { wcId: id, n: this.blockedCount.get(id) });
  }
  async updateBlocker(force) {
    const B = this.B();
    if (!force && Date.now() - (B.adblockUpdated || 0) < 4 * 864e5) return;
    try {
      const urls = [...adsAndTrackingLists.filter(u => !/peter-lowe/.test(u)), ...B.filterLists.filter(Boolean)];
      let text = '';
      for (const u of urls) { try { const r = await this.main.manager.fetch(u); if (r.ok) text += (await r.text()) + '\n'; } catch {} }
      for (const u of B.hostsSources.filter(Boolean)) {
        try {
          const r = await this.main.manager.fetch(u);
          if (r.ok) text += (await r.text()).split(/\r?\n/).map(l => l.replace(/#.*/, '').trim().split(/\s+/)).filter(p => p.length >= 2 && /^(0\.0\.0\.0|127\.0\.0\.1)$/.test(p[0])).map(p => `||${p[1]}^`).join('\n') + '\n';
        } catch {}
      }
      text += (B.customFilters || '') + '\n';
      if (text.length < 10000) return; // hors ligne : on garde le moteur actuel
      const b = ElectronBlocker.parse(text, { enableCompression: true, loadCosmeticFilters: true, loadNetworkFilters: true });
      await fsp.writeFile(path.join(this.userDir, 'adblock-engine.bin'), Buffer.from(b.serialize()));
      this.setBlocker(b);
      this.settings.set({ browser: { adblockUpdated: Date.now() } });
      return true;
    } catch (e) { console.error('adblock update', e.message); return false; }
  }
  adblockActiveFor(pageUrl) {
    const B = this.B();
    if (!B.adblock || !this.blocker) return false;
    const h = hostOf(pageUrl);
    return !(h && B.whitelist.some(w => h === w || h.endsWith('.' + w)));
  }

  // ---------- sessions ----------
  setupSession(ses) {
    ses.setUserAgent(this.ua());
    if (ses.registerPreloadScript) {
      for (const [id, filePath] of [['dryae-page', PAGE_PRELOAD], ['dryae-adblock', PRELOAD_PATH]]) {
        try { ses.registerPreloadScript({ id, type: 'frame', filePath }); } catch {}
      }
    } else ses.setPreloads([PAGE_PRELOAD, PRELOAD_PATH]);
    const allowed = ['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'media', 'storage-access', 'top-level-storage-access', 'speaker-selection', 'window-management'];
    ses.setPermissionRequestHandler((wc, perm, cb, det) => cb(allowed.includes(perm) && (perm !== 'media' || !(det?.mediaTypes || []).length)));
    // comme Chrome : les notifications sont « à demander », pas accordées d'office
    ses.setPermissionCheckHandler((wc, perm) => perm === 'notifications' || perm === 'geolocation' || perm === 'midi-sysex' ? false : true);
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, cb) => {
      if (!this.blocker || details.resourceType === 'mainFrame' || CHALLENGE.test(hostOf(details.url))) return cb({});
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
      const page = details.webContents && !details.webContents.isDestroyed() ? details.webContents.getURL() : details.url;
      if (this.blocker && this.adblockActiveFor(page) && !CHALLENGE.test(hostOf(details.url))) { try { return this.blocker.onHeadersReceived(details, cb); } catch {} }
      cb({});
    });
    ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (d, cb) => {
      if (!GOOGLE_LOGIN.test(hostOf(d.url))) return cb({});
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
    else if (this.B().sniffExtra.split(/[,\s]+/).filter(Boolean).includes(ext)) kind = 'file';
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
    try { const wc = require('electron').webContents.fromId(d.webContentsId); page = wc?.getURL() || ''; title = wc?.getTitle() || ''; } catch {}
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
    if (/^https?:/i.test(url)) {
      e.preventDefault(); // on reprend le téléchargement dans DrYAE
      const cookie = await this.cookieHeader(ses, url);
      if (mime === 'application/x-bittorrent' || /\.torrent$/i.test(name)) return this.onTorrent(url, { cookie, page });
      return this.quickFile({ url, name, page, size: item.getTotalBytes() || -1, mime, incognito: ses === session.fromPartition(PART_PRIV), headers: { Cookie: cookie, 'User-Agent': this.ua(), Referer: page } });
    }
    // blob: / data: → enregistrement direct par le navigateur
    const S = this.settings.get();
    await fsp.mkdir(S.dir, { recursive: true });
    const target = uniquePath(S.dir, name || 'fichier');
    item.setSavePath(target);
    item.once('done', (_e, state) => { if (state === 'completed') this.main.notify('Fichier enregistré', path.basename(target)); });
  }

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
      webPreferences: { preload: path.join(__dirname, '..', 'browser', 'preload.js'), webviewTag: true, contextIsolation: true, sandbox: false },
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
      const restore = this.settings.get().restoreSession && S && S.tabs && S.tabs.length && !opts.incognito;
      // onglets restaurés sans être chargés : chacun se charge quand on l'ouvre
      if (restore) wc.send('restore-session', S);
      if (url || !restore) wc.send('open-url', { url: url || '', incognito: !!opts.incognito });
    });
    if (!this._layoutHooked) {
      this._layoutHooked = true;
      const lay = () => this.layout();
      host.on('resize', lay); host.on('maximize', lay); host.on('unmaximize', lay); host.on('enter-full-screen', lay); host.on('leave-full-screen', lay);
    }
    this.showView();
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
      const fkey = /^f(1|3|5|6|11|12)$/.test(k);
      const plain = ['t', 'w', 'p', 'l', 'k', 'e', 'f', 'g', 'j', 'h', 'd', 'r', 's', 'u', 'm', 'tab', 'pageup', 'pagedown', 'f4', 'f5', '+', '=', '-', '0', '/'];
      const withShift = ['t', 'n', 'p', 'o', 'a', 'y', 'i', 'q', 'r', 'g', 'delete', 'tab', 'pageup', 'pagedown'];
      const hit = fkey || (i.alt && !c && ['arrowleft', 'arrowright', 'home', 'd'].includes(k)) || (c && (i.shift ? withShift.includes(k) : (plain.includes(k) || /^[1-9]$/.test(k))));
      if (!hit) return;
      ev.preventDefault();
      this.wc?.send('shortcut', { key: i.key, ctrl: !!c, shift: !!i.shift, alt: !!i.alt, wcId: wc.id });
    });
    try { if (this.ext && this.win && wc.session === session.fromPartition(PART)) this.ext.addTab(wc, this.win); } catch (e) { console.error('ext addTab', e.message); }
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (url.startsWith('magnet:')) { this.onTorrent(url, {}); return { action: 'deny' }; }
      if (disposition === 'new-window' && this.B().blockPopups) { this.wc?.send('popup-blocked', { wcId: wc.id, url }); return { action: 'deny' }; }
      this.wc?.send('open-url', { url, background: disposition === 'background-tab', from: wc.id });
      return { action: 'deny' };
    });
    const nav = (e, url) => {
      if (/^magnet:/i.test(url)) { e.preventDefault(); this.onTorrent(url, {}); }
      else if (!/^(https?|file|about|data|blob|chrome):/i.test(url)) { e.preventDefault(); }
    };
    wc.on('will-navigate', nav);
    const fixUa = (url) => { try { wc.setUserAgent(GOOGLE_LOGIN.test(new URL(url).hostname) ? UA_GOOGLE_LOGIN : this.ua()); } catch {} };
    wc.on('will-navigate', (_e, url) => fixUa(url));
    wc.on('will-redirect', (_e, url) => fixUa(url));
    wc.on('did-start-navigation', (_e, url, inPlace, isMain) => { if (isMain && !inPlace) fixUa(url); });
    wc.on('will-frame-navigate', d => { if (/^magnet:/i.test(d.url)) { d.preventDefault?.(); this.onTorrent(d.url, {}); } });
    // la liste des fichiers détectés n'est vidée que quand une nouvelle page s'affiche vraiment
    // (un clic sur un lien de téléchargement, .torrent par ex., ne change pas de page)
    wc.on('did-navigate', () => { this.seenMedia.delete(wc.id); this.blockedCount.set(wc.id, 0); this.wc?.send('media-reset', { wcId: wc.id }); });
    wc.on('context-menu', (_e, p) => this.contextMenu(wc, p));
    wc.on('login', () => {});
  }

  contextMenu(wc, p) {
    const T = [];
    const ses = wc.session;
    const dl = async (url, name) => this.quickFile({ url, name, page: wc.getURL(), incognito: ses !== session.fromPartition(PART), headers: { Cookie: await this.cookieHeader(ses, url), 'User-Agent': this.ua(), Referer: wc.getURL() } });
    if (p.linkURL) {
      if (/^magnet:/i.test(p.linkURL)) T.push({ label: 'Télécharger le torrent avec DrYAE', click: () => this.onTorrent(p.linkURL, {}) });
      else T.push({ label: 'Télécharger le lien avec DrYAE', click: () => dl(p.linkURL) });
      T.push({ label: 'Ouvrir dans un nouvel onglet', click: () => this.wc?.send('open-url', { url: p.linkURL, background: true }) });
      T.push({ label: 'Ouvrir dans un onglet privé', click: () => this.wc?.send('open-url', { url: p.linkURL, incognito: true }) });
      T.push({ label: 'Copier le lien', click: () => clipboard.writeText(p.linkURL) });
      T.push({ type: 'separator' });
    }
    if (p.srcURL && /^https?:/.test(p.srcURL) && ['image', 'video', 'audio'].includes(p.mediaType)) {
      const lab = { image: "l'image", video: 'la vidéo', audio: "l'audio" }[p.mediaType];
      T.push({ label: `Télécharger ${lab} avec DrYAE`, click: () => dl(p.srcURL) });
      T.push({ label: `Copier l'adresse de ${lab}`, click: () => clipboard.writeText(p.srcURL) });
      T.push({ type: 'separator' });
    }
    if (p.selectionText) {
      T.push({ label: 'Copier', role: 'copy' });
      const s = p.selectionText.trim();
      if (/^(https?:\/\/|magnet:)\S+$/i.test(s)) T.push({ label: 'Télécharger ce lien avec DrYAE', click: () => (s.startsWith('magnet:') ? this.onTorrent(s, {}) : dl(s)) });
      else T.push({ label: `Rechercher « ${s.slice(0, 30)}${s.length > 30 ? '…' : ''} »`, click: () => this.wc?.send('open-url', { url: this.searchUrl(s) }) });
    }
    if (p.isEditable) T.push({ label: 'Couper', role: 'cut' }, { label: 'Copier', role: 'copy' }, { label: 'Coller', role: 'paste' }, { type: 'separator' });
    T.push({ label: 'Précédent', enabled: wc.canGoBack(), click: () => wc.goBack() }, { label: 'Actualiser', click: () => wc.reload() });
    T.push({ label: 'Extraire les liens de la page', click: () => this.wc?.send('grab-links', { wcId: wc.id }) });
    T.push({ label: 'Inspecter', click: () => wc.inspectElement(p.x, p.y) });
    try { const extItems = this.ext ? this.ext.getContextMenuItems(wc, p) : []; if (extItems.length) { T.push({ type: 'separator' }); extItems.forEach(i => T.push(i)); } } catch {}
    Menu.buildFromTemplate((global.DRYAE_TRMENU || (x => x))(T)).popup({ window: this.win });
  }
  searchUrl(q) { return (SEARCH[this.B().search] || SEARCH.google).replace('%s', encodeURIComponent(q)); }

  // authentification HTTP (Basic/Digest) dans le navigateur
  async handleLogin(wc, details, authInfo, cb) {
    const saved = this.getPassword(authInfo.host);
    if (saved) return cb(saved.user, saved.pass);
    if (!this.wc) return cb();
    const id = Math.random().toString(36).slice(2);
    this.pendingLogins.set(id, cb);
    this.wc.send('login', { id, host: authInfo.host, realm: authInfo.realm });
  }

  setupIpc() {
    ipcMain.handle('br:store', () => this.store);
    ipcMain.handle('br:settings', () => ({ ...this.B(), theme: this.settings.get().theme, restoreSession: this.settings.get().restoreSession, searchUrl: SEARCH[this.B().search] || SEARCH.google, ua: this.B().ua, partitions: { normal: PART, incognito: PART_PRIV } }));
    ipcMain.handle('br:setSettings', (_e, patch) => { this.settings.set({ browser: patch }); return this.B(); });
    ipcMain.handle('br:history', (_e, { url, title }) => {
      if (!/^https?:/.test(url)) return;
      const h = this.store.history;
      if (h[0]?.url === url) { h[0].title = title || h[0].title; } else h.unshift({ url, title, t: Date.now() });
      if (h.length > 3000) h.length = 3000;
      this.saveStore();
    });
    ipcMain.handle('br:clearHistory', () => { this.store.history = []; this.store.typed = []; this.saveStore(); });
    ipcMain.handle('br:typed', (_e, text) => {
      text = String(text || '').trim(); if (!text || text.length > 500) return;
      this.store.typed = [{ text, t: Date.now(), n: ((this.store.typed.find(x => x.text === text) || {}).n || 0) + 1 }, ...this.store.typed.filter(x => x.text !== text)].slice(0, 500);
      this.saveStore();
    });
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
    ipcMain.handle('br:session', (_e, sess) => { if (sess && Array.isArray(sess.tabs)) { this.store.session = { tabs: sess.tabs.filter(t => /^https?:/.test(t.url)).slice(0, 50), active: sess.active | 0 }; this.saveStore(); } });
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
    ipcMain.handle('br:print', (_e, wcId) => { try { require('electron').webContents.fromId(wcId)?.print({}); } catch {} });
    ipcMain.handle('br:savePage', async (_e, wcId) => {
      const wc = require('electron').webContents.fromId(wcId); if (!wc) return false;
      const name = (wc.getTitle() || 'page').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'page';
      const r = await dialog.showSaveDialog(this.win, { defaultPath: require('path').join(this.settings.get().dir, name + '.html'), filters: [{ name: 'Page web complète', extensions: ['html'] }, { name: 'Page web (HTML seul)', extensions: ['htm'] }] });
      if (r.canceled) return false;
      await wc.savePage(r.filePath, /\.htm$/i.test(r.filePath) ? 'HTMLOnly' : 'HTMLComplete'); return true;
    });
    ipcMain.handle('br:fullscreen', () => { if (this.win) this.win.setFullScreen(!this.win.isFullScreen()); });
    ipcMain.handle('br:devtools', (_e, wcId) => { try { require('electron').webContents.fromId(wcId)?.toggleDevTools(); } catch {} });
    ipcMain.handle('br:mute', (_e, wcId) => { try { const wc = require('electron').webContents.fromId(wcId); wc.setAudioMuted(!wc.isAudioMuted()); return wc.isAudioMuted(); } catch { return false; } });
    ipcMain.handle('br:quit', () => this.main.quit?.());
    ipcMain.handle('br:hlsConvert', (_e, v) => { if (typeof v === 'boolean') this.settings.set({ hls: { convert: v } }); return !!this.settings.get().hls.convert; });
    ipcMain.handle('br:setRestore', (_e, v) => { this.settings.set({ restoreSession: !!v }); return !!v; });
    ipcMain.handle('br:openSettingsMain', (_e, sec) => this.main.openSettings?.(sec));
    ipcMain.handle('br:sizes', async (_e, { urls, page, incognito }) => {
      const ses = session.fromPartition(incognito ? PART_PRIV : PART);
      const cookie = urls[0] ? await this.cookieHeader(ses, urls[0]) : '';
      return this.main.manager.probeSizes(urls.slice(0, 300), { Cookie: cookie, 'User-Agent': this.ua(), Referer: page || '' });
    });
    ipcMain.handle('br:openExternal', (_e, url) => { if (/^https?:/.test(url)) require('electron').shell.openExternal(url); });
    ipcMain.handle('br:bookmark', (_e, { url, title, remove }) => {
      this.store.bookmarks = this.store.bookmarks.filter(b => b.url !== url);
      if (!remove) this.store.bookmarks.unshift({ url, title, t: Date.now() });
      this.saveStore(); return this.store.bookmarks;
    });
    ipcMain.handle('br:clearCookies', async () => { await session.fromPartition(PART).clearStorageData({ storages: ['cookies'] }); });
    ipcMain.handle('br:clearCache', async () => { await session.fromPartition(PART).clearCache(); await session.fromPartition(PART).clearStorageData({ storages: ['cachestorage', 'serviceworkers', 'shadercache'] }); });
    ipcMain.handle('br:attach', (_e, wcId) => { const wc = require('electron').webContents.fromId(wcId); if (wc) this.attachWebview(wc); });
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
      const M = this.main.manager, out = [];
      for (const url of urls) {
        if (/^magnet:/i.test(url)) { this.onTorrent(url, {}); continue; }
        if (!/^https?:/i.test(url)) continue;
        out.push(M.add({ type: /\.m3u8(\?|$)/i.test(url) ? 'hls' : 'http', url, pageUrl: page, pageTitle: this.pageTitle(page), headers: { Cookie: cookie, 'User-Agent': this.ua(), Referer: page } }));
      }
      return out.length;
    });
    ipcMain.handle('br:quickAdd', async (_e, o) => {
      const ses = session.fromPartition(o.incognito ? PART_PRIV : PART);
      const M = this.main.manager;
      const headers = { 'User-Agent': this.ua(), ...(o.headers || {}) };
      if (o.page && !headers.Referer) headers.Referer = o.page;
      if (!headers.Cookie && /^https?:/.test(o.url)) headers.Cookie = await this.cookieHeader(ses, o.url);
      const common = { url: o.url, dir: o.dir || '', pageUrl: o.page || '', pageTitle: o.pageTitle || o.tabTitle || this.pageTitle(o.page), headers, startNow: o.startNow !== false, schedule: !!o.schedule, speedLimit: o.speedLimit || 0, dupAction: o.dupAction };
      if (o.kind === 'torrent' || /^magnet:/i.test(o.url)) { this.onTorrent(o.url, { cookie: headers.Cookie, page: o.page }); return null; }
      if (o.kind === 'ytdl') return M.add({ ...common, type: 'ytdl', title: o.name || o.title || null, thumbnail: o.thumbnail || '', duration: o.duration || 0, mode: o.mode || 'video', quality: o.quality || 'best', audioFormat: o.audioFormat || 'mp3', audioBitrate: o.audioBitrate || '320' });
      const hls = o.kind === 'hls' || /\.m3u8(\?|$)/i.test(o.url);
      return M.add({ ...common, type: hls ? 'hls' : 'http', name: o.name || null, allowPage: !!o.allowPage });
    });
    ipcMain.handle('br:pickDir', async (_e, def) => {
      const r = await dialog.showOpenDialog(this.win, { properties: ['openDirectory', 'createDirectory'], defaultPath: def || this.settings.get().dir });
      return r.canceled ? null : r.filePaths[0];
    });
    ipcMain.handle('br:defaults', () => { const S = this.settings.get(); return { dir: S.dir, ytdl: S.ytdl, categorize: S.categorize }; });
    ipcMain.handle('br:selectTab', (_e, wcId) => { try { const wc = require('electron').webContents.fromId(wcId); if (wc && this.ext) this.ext.selectTab(wc); } catch {} });
    ipcMain.handle('br:extTabCreated', (_e, { reqId, wcId }) => { const r = this.extWaiters.get(reqId); if (r) { this.extWaiters.delete(reqId); r(wcId); } });
    ipcMain.handle('br:extList', () => this.extList());
    ipcMain.handle('br:extRemove', async (_e, id) => {
      const ses = session.fromPartition(PART);
      try { const { uninstallExtension } = require('electron-chrome-web-store'); await uninstallExtension(id, { session: ses, extensionsPath: this.extDir }); }
      catch { const x = (ses.extensions || ses).getExtension(id); (ses.extensions || ses).removeExtension(id); if (x && x.path && x.path.startsWith(this.extDir)) await fsp.rm(x.path, { recursive: true, force: true }).catch(() => {}); }
      return this.extList();
    });
    ipcMain.handle('br:extLoadDir', async () => {
      const r = await dialog.showOpenDialog(this.win, { title: "Dossier de l'extension (contenant manifest.json)", properties: ['openDirectory'] });
      if (r.canceled) return null;
      const src = r.filePaths[0];
      if (!fs.existsSync(path.join(src, 'manifest.json'))) throw new Error('Ce dossier ne contient pas de manifest.json');
      const dst = path.join(this.extDir, 'local-' + path.basename(src).replace(/[^\w.-]/g, '_'));
      await fsp.rm(dst, { recursive: true, force: true }).catch(() => {});
      await fsp.cp(src, dst, { recursive: true });
      const ses = session.fromPartition(PART);
      await (ses.extensions || ses).loadExtension(dst, { allowFileAccess: true });
      return this.extList();
    });
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
    ipcMain.handle('br:feedback', () => this.main.openFeedback?.());
    ipcMain.handle('br:search', (_e, q) => this.searchUrl(q));
    ipcMain.handle('br:updateAdblock', () => this.updateBlocker(true));
  }
}

function isUrlLike(s) { return /^(https?:\/\/|file:\/\/)/i.test(s) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s); }

module.exports = { WebBrowser, PART, PART_PRIV, UA_DESKTOP, UA_MOBILE };
