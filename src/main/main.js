const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Notification, nativeImage, Tray, Menu, safeStorage, webContents, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { Settings } = require('./settings');
const LOG = require('./log');
const I18N = require('../shared/i18n');
const LOCALES = require('../shared/locales');
const { Updater } = require('./updater');
let i18n = I18N.create('fr', LOCALES), updater = null;
const T = s => i18n.T(s);
global.DRYAE_T = T;
const { Manager } = require('./manager');
const { WebBrowser } = require('./browser');
const { HlsDownload } = require('./engine/hls');
const tools = require('./tools');
const { isOnlineVideo } = require('./engine/ytdl');
const http = require('http');
const EXT_ID = 'pbgpfnhoilokfcjmfamemnjaddkpmmhf';
const { expandBatch, hostOf, nameFromUrl } = require('./util');
const pages = require('./pages');
pages.registerScheme(); // pages internes dryae:// (à déclarer avant le démarrage)

app.setName('DrYAE');
app.setAppUserModelId('com.dryae.app');
// profils : « --profile=travail » = DrYAE avec ses propres favoris, mots de passe, cookies, historique et téléchargements
// (dossier %APPDATA%\DrYAE\profiles\travail). Le profil principal reste %APPDATA%\DrYAE.
const BASE_DIR = app.getPath('userData');
const PROFILE = (process.argv.find(a => /^--profile=/.test(a)) || '').slice(10).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
if (PROFILE) app.setPath('userData', path.join(BASE_DIR, 'profiles', PROFILE));
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const UI = path.join(__dirname, '..', 'ui');
let win, tray, settings, manager, browser, quitting = false, psb = null;
const pendingArgs = [];

const enc = s => { try { return safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(s).toString('base64') : 'p:' + s; } catch { return 'p:' + s; } };
const dec = s => { if (!s) return ''; if (s.startsWith('p:')) return s.slice(2); try { return safeStorage.decryptString(Buffer.from(s.slice(2), 'base64')); } catch { return ''; } };

const api = {
  enc, dec,
  notify(title, body, onClick) {
    if (!settings.get().notify || !Notification.isSupported()) return;
    title = T(title); body = T(body);
    const n = new Notification({ title, body, icon: path.join(ASSETS, 'icon.png'), silent: !settings.get().sound });
    if (onClick) n.on('click', onClick);
    n.show();
  },
  async torrentInspect(src, opts) {
    let s = src;
    if (/^https?:/i.test(src) && opts?.cookie) {
      const r = await manager.fetch(src, { headers: manager.buildHeaders({ headers: { Cookie: opts.cookie, Referer: opts.page || '' }, url: src }, {}) });
      if (!r.ok) throw new Error(`Fichier torrent inaccessible (${r.status})`);
      s = Buffer.from(await r.arrayBuffer());
    }
    return manager.torrents.inspect(s, manager.torrentDir);
  },
  torrentAdd(o) {
    return manager.add({ type: 'torrent', url: o.magnet || ('magnet:?xt=urn:btih:' + o.infoHash), torrentFile: o.torrentFile, infoHash: o.infoHash, name: o.name,
      files: (o.files || []).map(f => ({ path: f.path, length: f.length })), selected: o.selected, dir: o.dir, sequential: o.sequential, seedAfter: o.seedAfter, startNow: o.startNow !== false, schedule: !!o.schedule });
    return true;
  },
  torrentQuick(src) { const d = manager.add({ type: 'torrent', url: src }); return d && d.duplicate ? d : !!d; },
  quit() { quitting = true; app.quit(); },
  openSettings(sec) { api.showMain(); send('open-settings', sec || ''); },
  // écran d'ouverture choisi (navigateur par défaut, ou gestionnaire)
  showStart() { if (settings.get().startView === 'manager' || !browser) return api.showMain(); if (!win) createWindow(); browser.open(); },
  showMain() { if (!win) createWindow(); if (win.isMinimized()) win.restore(); win.show(); browser?.hideView(); win.focus(); },
  report() { return report(); },
  a11y() { return a11yEff(); },
  ipc(name, ...a) { return IPCF[name]?.(...a); },
  profile() { return PROFILE ? (readProfiles().find(p => p.id === PROFILE) || { id: PROFILE, name: PROFILE }) : null; },
  updateInfo() { try { return updater?.state || {}; } catch { return {}; } },
  openFeedback() { const u = updater?.info(); if (u) shell.openExternal(u.feedbackUrl || u.repoUrl || 'https://github.com'); },
  hostWindow() { if (!win) createWindow(); return win; },
  onModeChange(m) { send('mode', m); if (m === 'manager') send('reload', manager.views()); },
  setLang(l) { return setLang(l); },
  languages() { return Object.entries(I18N.LANGS).map(([code, v]) => ({ code, name: v.name })); },
  updateInfo() { return updater?.info(); },
  updateCheck() { return updater?.check(); },
  updateInstall() { return updater?.install(); },
  savePassword(host, user, pass) {
    const list = settings.get().passwords.filter(p => p.host !== host);
    list.push({ host, user, pass: enc(pass) });
    settings.set({ passwords: list });
  },
  getPassword(host) {
    const p = settings.get().passwords.find(x => x.host && (host === x.host || host.endsWith('.' + x.host)));
    return p ? { user: p.user, pass: dec(p.pass) } : null;
  },
};

function send(ch, v) { if (win && !win.isDestroyed()) win.webContents.send(ch, v); }
// état de la mise à jour : envoyé au gestionnaire, au navigateur et aux pages internes (icône visible partout)
function sendUpd(ch, v) { send(ch, v); try { browser?.wc?.send(ch, v); } catch {} pages.broadcast(ch, v); }

function createWindow() {
  const b = settings.get().restoreSession ? settings.get().winBounds : null;
  win = new BrowserWindow({
    width: b?.width || 1240, height: b?.height || 800, x: b?.x, y: b?.y, minWidth: 900, minHeight: 560, title: 'DrYAE', backgroundColor: '#0d0f14',
    icon: nativeImage.createFromPath(path.join(ASSETS, process.platform === 'win32' ? 'icon.ico' : 'icon.png')), autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(UI, 'preload.js'), contextIsolation: true },
  });
  win.setMenu(null);
  win.loadFile(path.join(UI, 'index.html'));
  // lancé avec Windows (--hidden) : DrYAE reste caché dans les icônes de la barre des tâches, sans ouvrir de fenêtre
  win.once('ready-to-show', () => { try { applyA11y(); } catch {} });
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) { if (settings.get().startView === 'manager' || !browser || process.argv.some(a => /^magnet:|\.torrent$|^https?:\/\//i.test(a))) win.show(); else browser.open(); } flushArgs(); });
  win.on('focus', () => send('focus'));
  win.on('show', () => send('reload', manager.views()));
  win.on('restore', () => send('reload', manager.views()));
  // agrandir une fenêtre cachée l'afficherait : au démarrage caché, on agrandit seulement à la première ouverture
  if (b?.maximized) { if (process.argv.includes('--hidden')) win.once('show', () => win.maximize()); else win.maximize(); }
  const saveB = () => { if (!win || win.isMinimized()) return; settings.set({ winBounds: { ...(win.isMaximized() ? settings.get().winBounds || {} : win.getBounds()), maximized: win.isMaximized() } }); };
  win.on('resized', saveB); win.on('moved', saveB); win.on('maximize', saveB); win.on('unmaximize', saveB);
  win.on('close', e => { if (!quitting && settings.get().tray && tray) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; if (browser) { browser.view = null; browser.win = null; } });
}

function createTray() {
  if (tray || !settings.get().tray) return;
  tray = new Tray(nativeImage.createFromPath(path.join(ASSETS, 'tray.png')));
  tray.setToolTip('DrYAE');
  const menu = () => Menu.buildFromTemplate(trMenu([
    { label: 'Ouvrir DrYAE', click: () => api.showStart() },
    { label: 'Gestionnaire de téléchargements', click: () => api.showMain() },
    { label: 'Navigateur DrYAE', click: () => browser.open() },
    { type: 'separator' },
    { label: 'Ajouter depuis le presse-papiers', click: () => { api.showMain(); send('prompt-add', { url: clipboard.readText().trim() }); } },
    { label: 'Tout reprendre', click: () => manager.resumeAll() },
    { label: 'Tout mettre en pause', click: () => manager.pauseAll() },
    { label: 'Limiter la vitesse', type: 'checkbox', checked: settings.get().speedLimitOn, click: i => settings.set({ speedLimitOn: i.checked }) },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.setContextMenu(menu());
  settings.on('change', () => tray && tray.setContextMenu(menu()));
  // clic sur l'icône (zone de notification) : ouvre directement le navigateur
  tray.on('click', () => browser.open());
}

// --- arguments : magnet:, fichiers .torrent, liens http ---
function handleArgs(argv) {
  for (const a of argv.slice(1)) {
    if (/^magnet:/i.test(a)) pendingArgs.push({ torrent: a });
    else if (/\.torrent$/i.test(a) && fs.existsSync(a)) pendingArgs.push({ torrent: a });
    else if (/^https?:\/\//i.test(a)) pendingArgs.push({ url: a });
    else if (/^--open=dryae:\/\/\w+/i.test(a)) pendingArgs.push({ page: a.slice(7) });
  }
  flushArgs();
}
function flushArgs() {
  if (!win || win.webContents.isLoading()) return;
  while (pendingArgs.length) {
    const a = pendingArgs.shift();
    if (a.page) { const m = /^dryae:\/\/(\w+)/i.exec(a.page); if (m) browser?.openPage(m[1].toLowerCase()); continue; }
    api.showMain();
    if (a.torrent) send('prompt-torrent', { src: a.torrent });
    else send('prompt-add', { url: a.url });
  }
}
// clic sur l'icône alors que DrYAE tourne déjà : écran d'ouverture choisi ; un lien ou un torrent ouvre le gestionnaire
app.on('second-instance', (_e, argv) => { if (argv.slice(1).some(a => /^magnet:|\.torrent$|^https?:\/\//i.test(a))) api.showMain(); else api.showStart(); handleArgs(argv); });
app.on('open-url', (e, url) => { e.preventDefault(); pendingArgs.push({ torrent: url }); flushArgs(); });

// --- presse-papiers ---
let lastClip = '';
function clipWatch() {
  setInterval(() => {
    if (!settings.get().clipboard) return;
    let t = '';
    try { t = clipboard.readText().trim(); } catch { return; }
    if (t === lastClip) return;
    lastClip = t;
    if (!/^(https?:\/\/\S+|magnet:\?\S+)$/i.test(t) || t.length > 4000) return;
    if (manager.list.some(d => d.url === t)) return;
    send('clip', t);
    if (!win || !win.isVisible() || !win.isFocused() || browser.visible()) {
      api.notify('Lien copié détecté', t.length > 80 ? t.slice(0, 80) + '…' : t, () => { api.showMain(); t.startsWith('magnet:') ? send('prompt-torrent', { src: t }) : send('prompt-add', { url: t }); });
    }
  }, 1200);
}

// copie de sécurité des données (réglages, liste des téléchargements, historique, favoris, mots de passe)
// faite juste avant une mise à jour ; si un fichier manque ou est illisible au démarrage, il est repris de la copie
const DATA_FILES = ['settings.json', 'downloads.json', 'browser.json', 'web-passwords.json'];
function backupData() {
  const u = app.getPath('userData'), b = path.join(u, 'backup');
  try { fs.mkdirSync(b, { recursive: true }); for (const f of DATA_FILES) { try { JSON.parse(fs.readFileSync(path.join(u, f), 'utf8')); fs.copyFileSync(path.join(u, f), path.join(b, f)); } catch {} } } catch {}
}
function restoreData() {
  const u = app.getPath('userData'), b = path.join(u, 'backup');
  for (const f of DATA_FILES) {
    let ok = false; try { JSON.parse(fs.readFileSync(path.join(u, f), 'utf8')); ok = true; } catch {}
    if (!ok) { try { JSON.parse(fs.readFileSync(path.join(b, f), 'utf8')); fs.copyFileSync(path.join(b, f), path.join(u, f)); } catch {} }
  }
}

app.whenReady().then(async () => {
  LOG.init(app.getPath('userData'), app.getVersion());
  restoreData();
  settings = new Settings(app);
  resolveLanguage();
  i18n = I18N.create(settings.get().lang, LOCALES);
  const userDir = app.getPath('userData');
  manager = new Manager({ userDir, settings, decrypt: dec });
  api.manager = manager;
  browser = new WebBrowser({
    main: api, settings, userDir, assetsDir: ASSETS, getPassword: api.getPassword,
    onDownload: (o) => { api.showMain(); send('prompt-add', o); },
    // torrent cliqué dans le navigateur : la fenêtre de choix s'ouvre sur la page, sans quitter le navigateur
    onTorrent: (src, o) => { if (browser?.visible() && browser.wc) browser.wc.send('quick-torrent', { src, ...o }); else { api.showMain(); send('prompt-torrent', { src, ...o }); } },
  });
  await browser.init();
  manager.cookieFileFor = url => browser.cookieFile(url);
  manager.online = () => { try { return require('electron').net.isOnline(); } catch { return true; } };
  manager.trash = f => shell.trashItem(f);
  startExtensionServer();
  updater = new Updater({ send: sendUpd, notify: api.notify, T, beforeInstall: () => { browser?.saveStoreSync(); manager?.saveSync(); settings?.save?.(); backupData(); }, auto: () => settings.get().autoUpdateCheck !== false });
  updater.init();
  settings.on('change', (_d, patch) => { if (patch.theme) browser.sendTheme(); if (patch.a11y) applyA11y(); });
  require('electron').nativeTheme.on('updated', () => applyA11y());
  applyA11y();

  manager.on('changed', v => send('changed', v));
  manager.on('progress', v => { if (win && win.isVisible() && !win.isMinimized() && !browser.visible()) send('progress', v); updateTray(v); });
  manager.on('reload', () => send('reload', manager.views()));
  manager.on('torrentProbe', p => { send('torrent-probe', p); browser?.wc?.send('torrent-probe', p); });
  manager.on('notice', n => { api.notify(n.title, n.body); send('toast', n.body); });
  manager.on('itemFinished', d => {
    if (d.status === 'done' && !d._notified) {
      d._notified = true;
      api.notify('Téléchargement terminé', d.name, () => { api.showMain(); });
      send('sound', 'done');
    } else if (d.status === 'error') LOG.write('téléchargement', d.type, `${d.errorCode || ''} ${d.error} (${d.host || ''})`);
    if (d.status === 'error' && !d._retryAt) { const v = d.view(); if (!require('./errors').AUTO.has(v.errKind) || !manager.online()) api.notify('Échec du téléchargement', `${d.name || d.url}\n${T(v.errText || d.error)}`); }
    else if (d.status === 'seeding') api.notify('Torrent terminé', `${d.name} — partage en cours`);
  });
  manager.on('allDone', () => {
    const S = settings.get();
    if (S.shutdownWhenDone || manager._schedShutdown) {
      manager._schedShutdown = false;
      api.notify('Arrêt de l\'ordinateur', 'Tous les téléchargements sont terminés. Arrêt dans 60 secondes.');
      send('shutdown-countdown', 60);
      tools.shutdown('shutdown');
    }
  });
  // empêcher la mise en veille pendant les téléchargements
  setInterval(() => {
    const busy = manager.list.some(d => d.status === 'running');
    if (busy && psb === null) psb = powerSaveBlocker.start('prevent-app-suspension');
    else if (!busy && psb !== null) { powerSaveBlocker.stop(psb); psb = null; }
  }, 5000);

  app.on('render-process-gone', (_e, wc, det) => LOG.write('erreur', 'page plantée', `${det.reason} ${det.exitCode} ${wc?.getType?.() || ''} ${wc?.getURL?.() || ''}`));
  app.on('child-process-gone', (_e, det) => { if (det.reason !== 'clean-exit') LOG.write('erreur', 'processus', `${det.type} ${det.reason} ${det.name || ''}`); });
  app.on('web-contents-created', (_e, wc) => {
    if (wc.getType() === 'webview') browser.attachWebview(wc);
    else if (wc.getType() === 'window') setImmediate(() => { try { if (!wc.isDestroyed() && browser.isWebSession(wc.session)) browser.attachPopup(wc); } catch {} });
  });
  app.on('login', (e, wc, details, authInfo, cb) => {
    if (wc && wc.getType && wc.getType() === 'webview') { e.preventDefault(); browser.handleLogin(wc, details, authInfo, cb); }
  });

  if (settings.get().startWithWindows) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  createWindow();
  createTray();
  clipWatch();
  handleArgs(process.argv);
  manager.schedule();
});

function updateTray(active) {
  if (!tray) return;
  const sp = active.reduce((a, d) => a + (d.speed || 0), 0);
  tray.setToolTip(active.length ? T(`DrYAE — ${active.length} actif(s) · ${(sp / 1048576).toFixed(2)} Mo/s`) : 'DrYAE');
  if (win) {
    const run = active.filter(d => d.size > 0 && d.status === 'running');
    const p = run.length ? run.reduce((a, d) => a + d.downloaded, 0) / run.reduce((a, d) => a + d.size, 0) : -1;
    win.setProgressBar(p >= 0 ? p : -1);
  }
}

app.on('before-quit', () => { quitting = true; browser?.onQuit(); manager?.shutdownAll(); });
app.on('window-all-closed', () => { if (!settings.get().tray) app.quit(); });

// ================= IPC =================
// accessibilité : réglages effectifs (contraste « automatique » = celui de Windows)
function a11yEff() {
  const A = settings.get().a11y || {};
  let hc = false; try { hc = A.contrast === 'on' || (A.contrast !== 'off' && require('electron').nativeTheme.shouldUseHighContrastColors); } catch {}
  return { hc, easy: !!A.easy, rm: A.motion === 'on', motion: A.motion || 'auto', simple: !!A.simple, scale: Math.max(80, Math.min(200, +A.scale || 100)) };
}
function applyA11y() {
  const e = a11yEff();
  try { if (win && !win.isDestroyed()) win.webContents.setZoomFactor(e.scale / 100); } catch {}
  send('a11y', e); browser?.applyA11y?.(e);
}
async function report() {
  const S = settings.get();
  const txt = LOG.report({ Langue: S.lang, 'Démarrage sur': S.startView, Proxy: S.proxy?.enabled ? 'oui' : 'non', 'Téléchargements': manager.list.length + ' (' + manager.list.filter(d => d.status === 'error').length + ' en erreur)', 'Erreurs en cours': manager.list.filter(d => d.status === 'error').slice(0, 15).map(d => `${d.type} ${d.errorCode || ''} ${d.error}`), 'Moteur torrent': manager.torrents.proc ? 'lancé' : 'arrêté', Extensions: (browser?.extList?.() || []).length });
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const f = path.join(app.getPath('desktop'), `DrYAE-rapport-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`);
  await fsp.mkdir(path.dirname(f), { recursive: true }).catch(() => {});
  await fsp.writeFile(f, '\ufeff' + txt, 'utf8');
  shell.showItemInFolder(f);
  const u = updater?.info(); if (u?.repoUrl) shell.openExternal(u.repoUrl + '/issues/new?template=bug.yml');
  return f;
}
const IPCF = {}; // fonctions IPC appelables aussi depuis le navigateur
const H = (ch, fn) => { IPCF[ch] = fn; return H0(ch, fn); };
const H0 = (ch, fn) => ipcMain.handle(ch, async (_e, ...a) => { try { return { ok: true, v: await fn(...a) }; } catch (e) { return { ok: false, error: e.message || String(e) }; } });

H('list', () => manager.views());
H('undoRemove', () => manager.undoRemove());
// Ctrl+C : copie les fichiers terminés dans le presse-papiers (on peut ensuite les coller dans un dossier Windows)
H('copyFiles', async ids => {
  const files = [].concat(ids).map(id => manager.get(id)).filter(d => d && d.status === 'done').map(d => d.fileForOpen || d.file).filter(f => f && fs.existsSync(f));
  if (!files.length) return 0;
  if (process.platform === 'win32') {
    const lit = files.map(f => "'" + f.replace(/'/g, "''") + "'").join(',');
    await new Promise(res => require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Set-Clipboard -LiteralPath ${lit}`], { windowsHide: true }, () => res()));
  } else clipboard.writeText(files.join('\n'));
  return files.length;
});
// glisser un fichier terminé hors de DrYAE (vers le Bureau, un dossier, une autre appli)
ipcMain.on('drag-out', (e, ids) => {
  const files = [].concat(ids).map(id => manager.get(id)).filter(d => d && d.status === 'done').map(d => d.fileForOpen || d.file).filter(f => f && fs.existsSync(f));
  if (!files.length) return;
  const icon = nativeImage.createFromPath(path.join(ASSETS, 'logo.png')).resize({ width: 48, height: 48 });
  try { e.sender.startDrag({ file: files[0], files, icon }); } catch {}
});
H('accentColor', () => { try { const { systemPreferences } = require('electron'); const c = systemPreferences.getAccentColor?.(); return c ? '#' + c.slice(0, 6) : null; } catch { return null; } });
H('add', async (o) => {
  // o : { urls[], dir, connections, startNow, schedule, name, headers, page, speedLimit, kind, quality }
  const out = [];
  let urls = (o.urls || []).flatMap(u => (o.batch ? expandBatch(u.trim()) : [u.trim()])).filter(Boolean);
  if (o.kind === 'ytdl') {
    const Y = o.ytdl || {};
    const entries = o.entries && o.entries.length ? o.entries : urls.map(u => ({ url: u, title: o.title || null }));
    for (const e of entries) {
      if (!/^https?:\/\//i.test(e.url || '')) continue;
      out.push(manager.add({ type: 'ytdl', url: e.url, dir: o.dir, startNow: o.startNow !== false, schedule: !!o.schedule, title: e.title || o.name || null,
        thumbnail: e.thumbnail || o.thumbnail || '', duration: e.duration || 0, mode: Y.mode || 'video', quality: Y.quality || 'best', audioFormat: Y.audioFormat || 'mp3', audioBitrate: Y.audioBitrate || '320',
        headers: o.headers || {}, pageUrl: o.page || '', speedLimit: o.speedLimit || 0, dupAction: o.dupAction }));
    }
    return out;
  }
  for (const url of urls) {
    if (/^magnet:/i.test(url)) { send('prompt-torrent', { src: url }); continue; }
    if (!/^https?:\/\//i.test(url)) continue;
    const isHls = o.kind === 'hls' || /\.m3u8(\?|$)/i.test(url);
    const v = manager.add({
      type: isHls ? 'hls' : 'http', url, dir: o.dir, connections: o.connections, startNow: o.startNow !== false, schedule: !!o.schedule,
      name: urls.length === 1 ? o.name : null, headers: o.headers || {}, pageUrl: o.page || '', pageTitle: o.pageTitle || (browser && browser.pageTitle ? browser.pageTitle(o.page) : ''), speedLimit: o.speedLimit || 0, quality: o.quality || null, allowPage: !!o.allowPage, dupAction: o.dupAction,
    });
    out.push(v);
  }
  return out;
});
H('ytdl:inspect', async (url, headers) => manager.ytdl.inspect(url, headers, await browser.cookieFile(url)));
H('ytdl:update', () => manager.ytdl.update());
H('ytdl:version', () => manager.ytdl.version());
H('isOnlineVideo', url => isOnlineVideo(url));
H('sizes', (urls, headers) => manager.probeSizes(urls.slice(0, 200), headers || {}));
H('hls:inspect', (url, headers) => HlsDownload.inspect(manager, url, headers));
H('probe', async (url, headers) => {
  const r = await manager.fetch(url, { headers: manager.buildHeaders({ headers: headers || {}, url }, { Range: 'bytes=0-0' }) });
  const { nameFromHeaders } = require('./util');
  let size = -1; const cr = r.headers.get('content-range');
  if (cr && /\/(\d+)/.test(cr)) size = +cr.match(/\/(\d+)/)[1]; else if (r.headers.get('content-length') && r.status === 200) size = +r.headers.get('content-length');
  try { await r.body?.cancel(); } catch {}
  return { status: r.status, size, resumable: r.status === 206, name: nameFromHeaders(r.url || url, r.headers), type: (r.headers.get('content-type') || '').split(';')[0] };
});
H('pause', id => manager.pause(id));
H('resume', id => manager.resume(id));
H('restart', id => manager.restart(id));
H('remove', (ids, del) => manager.remove(ids, del));
H('refresh', (id, url) => manager.refresh(id, url));
// analyse par Microsoft Defender (MpCmdRun) : 0 = rien trouvé, 2 = menace
H('avScan', async id => {
  const d = manager.get(id); const f = d?.type === 'torrent' ? d.rootPath() : d?.file;
  if (!f || !fs.existsSync(f) || process.platform !== 'win32') return { state: 'error', detail: 'fichier introuvable' };
  const exe = [process.env.ProgramFiles, process.env.ProgramW6432].filter(Boolean).map(p => path.join(p, 'Windows Defender', 'MpCmdRun.exe')).find(p => fs.existsSync(p));
  if (!exe) return { state: 'error', detail: 'Microsoft Defender absent' };
  return new Promise(res => require('child_process').execFile(exe, ['-Scan', '-ScanType', '3', '-File', f, '-DisableRemediation'], { windowsHide: true, timeout: 600000 }, (err, out) => {
    const code = err ? err.code : 0;
    LOG.write('antivirus', path.extname(f), `code ${code}`);
    res(code === 0 ? { state: 'clean' } : code === 2 || /threat|menace/i.test(out || '') ? { state: 'threat' } : { state: 'error', detail: 'code ' + code });
  }));
});
H('changeDir', (id, dir) => manager.changeDir(id, dir));
H('openFirewall', () => require('child_process').spawn('control.exe', ['/name', 'Microsoft.WindowsFirewall', '/page', 'pageConfigureApps'], { detached: true, windowsHide: false }));
H('rename', (id, name) => manager.rename(id, name));
H('move', async id => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); if (!r.canceled) await manager.move(id, r.filePaths[0]); });
H('itemSpeed', (id, kb) => manager.get(id)?.setSpeedLimit(kb));
H('itemConnections', (id, n) => { const d = manager.get(id); if (d && d.type === 'http') { d.connections = Math.max(1, Math.min(32, n | 0)); d.changed(); } });
H('setScheduled', (ids, on) => manager.setScheduled(ids, on));
H('pauseAll', () => manager.pauseAll());
H('resumeAll', () => manager.resumeAll());
H('clearFinished', () => manager.clearFinished());
H('details', id => {
  const d = manager.get(id);
  if (!d) return null;
  const base = { ...d.view() };
  if (d.type === 'torrent') base.torrent = d.details();
  if (d.type === 'http') base.segs = d.segments.map(s => ({ start: s.start, end: s.end, done: s.done, active: !!s.active }));
  return base;
});
H('open', id => { const d = manager.get(id); const p = d?.type === 'torrent' ? d.rootPath() : d?.file; if (p) return shell.openPath(p); });
H('openWith', async id => { const d = manager.get(id); if (d?.file && process.platform === 'win32') require('child_process').spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', d.file], { detached: true }); });
H('showInFolder', id => {
  const d = manager.get(id);
  if (!d) return;
  const p = d.partPath && d.partPath();
  if (p && fs.existsSync(p)) shell.showItemInFolder(p); else shell.openPath(d.dir || settings.get().dir);
});
H('openDir', async () => { await fsp.mkdir(settings.get().dir, { recursive: true }); shell.openPath(settings.get().dir); });
H('pickDir', async (def) => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: def || settings.get().dir }); return r.canceled ? null : r.filePaths[0]; });
H('pickFile', async (filters) => { const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: filters || [] }); return r.canceled ? null : r.filePaths[0]; });
H('saveFile', async (name, filters) => { const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: filters || [] }); return r.canceled ? null : r.filePath; });
H('getSettings', () => ({ ...settings.get(), passwords: settings.get().passwords.map(p => ({ host: p.host, user: p.user })) }));
H('setSettings', s => {
  if (s.passwords) delete s.passwords;
  const r = settings.set(s);
  if ('startWithWindows' in s) app.setLoginItemSettings({ openAtLogin: !!s.startWithWindows, args: ['--hidden'] });
  if ('tray' in s) { if (s.tray) createTray(); else if (tray) { tray.destroy(); tray = null; } }
  manager.schedule();
  return { ...r, passwords: r.passwords.map(p => ({ host: p.host, user: p.user })) };
});
H('resetSettings', () => settings.reset());
H('passwords:add', (host, user, pass) => api.savePassword(host, user, pass));
H('passwords:remove', host => settings.set({ passwords: settings.get().passwords.filter(p => p.host !== host) }));
H('clipboard', () => clipboard.readText());
H('copy', t => clipboard.writeText(String(t)));
H('version', () => app.getVersion());
H('languages', () => Object.entries(I18N.LANGS).map(([code, v]) => ({ code, name: v.name })));
function setLang(lang) {
  lang = I18N.normalize(lang);
  settings.set({ lang, langChosen: true });
  i18n = I18N.create(lang, LOCALES);
  if (tray) { tray.destroy(); tray = null; createTray(); }
  win?.webContents.reload();
  if (browser?.wc) browser.wc.reload();
  return lang;
}
H('setLang', setLang);
H('upd:info', () => updater.info());
H('upd:check', () => updater.check());
H('upd:install', () => updater.install());
// « Signaler un problème » : rapport texte sur le Bureau (rien n'est envoyé), puis la page GitHub des signalements
H('report', async () => report());
H('a11y', () => a11yEff());
// ---- profils ----
const PROFILES_FILE = path.join(BASE_DIR, 'profiles.json');
const readProfiles = () => { let l = []; try { l = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')); } catch {} return [{ id: '', name: 'Principal' }, ...l.filter(p => p && /^[a-z0-9_-]{1,40}$/.test(p.id))]; };
H('profiles', () => ({ list: readProfiles(), current: PROFILE }));
H('profileAdd', name => {
  name = String(name || '').trim().slice(0, 40); if (!name) throw new Error('Nom vide');
  const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'profil';
  const l = readProfiles().slice(1); let k = id, n = 2; while (l.some(p => p.id === k)) k = id + '-' + n++;
  l.push({ id: k, name }); fs.writeFileSync(PROFILES_FILE, JSON.stringify(l)); return k;
});
H('profileOpen', id => { const args = [...(process.defaultApp ? [path.resolve(process.argv[1])] : []), ...(id ? ['--profile=' + id] : [])]; require('child_process').spawn(process.execPath, args, { detached: true, stdio: 'ignore' }).unref(); });
H('profileDelete', async id => {
  if (!id || id === PROFILE) throw new Error('Impossible de supprimer le profil ouvert');
  const l = readProfiles().slice(1).filter(p => p.id !== id); fs.writeFileSync(PROFILES_FILE, JSON.stringify(l));
  await fsp.rm(path.join(BASE_DIR, 'profiles', id), { recursive: true, force: true }).catch(() => {}); return true;
});
H('openPage', (name, hash) => { if (/^\w+$/.test(name || '')) browser?.openPage(name, hash || ''); });
H('openFeedback', () => { const u = updater.info(); shell.openExternal(u.feedbackUrl || u.repoUrl || 'https://github.com'); });
H('openRepo', () => { const u = updater.info(); if (u.repoUrl) shell.openExternal(u.repoUrl); });
H('openDonate', () => { const u = updater.info(); if (u.donateUrl) shell.openExternal(u.donateUrl); });
H('openNotices', () => {
  for (const p of [path.join(process.resourcesPath || '', 'THIRD_PARTY_NOTICES.txt'), path.join(__dirname, '..', '..', 'THIRD_PARTY_NOTICES.txt')]) if (fs.existsSync(p)) return shell.openPath(p);
});
H('openExternal', u => { if (/^(https?:|mailto:|ms-settings:)/i.test(String(u))) shell.openExternal(u); });
H('openBrowser', (url, incognito) => browser.open(url, { incognito }));
H('cancelShutdown', () => tools.cancelShutdown());
H('registerMagnet', () => {
  const ok = process.defaultApp ? app.setAsDefaultProtocolClient('magnet', process.execPath, [path.resolve(process.argv[1])]) : app.setAsDefaultProtocolClient('magnet');
  return ok;
});
H('isMagnetDefault', () => app.isDefaultProtocolClient('magnet'));

// torrents
H('torrent:inspect', async (src, opts) => {
  let s = src;
  if (/^https?:/i.test(src) && opts?.cookie) {
    const r = await manager.fetch(src, { headers: manager.buildHeaders({ headers: { Cookie: opts.cookie, Referer: opts.page || '' }, url: src }, {}) });
    if (!r.ok) throw new Error(`Fichier torrent inaccessible (${r.status})`);
    s = Buffer.from(await r.arrayBuffer());
  }
  return manager.torrents.inspect(s, manager.torrentDir);
});
H('torrent:add', o => manager.add({ type: 'torrent', url: o.magnet || ('magnet:?xt=urn:btih:' + o.infoHash), torrentFile: o.torrentFile, infoHash: o.infoHash, name: o.name,
  files: (o.files || []).map(f => ({ path: f.path, length: f.length })), selected: o.selected, dir: o.dir, sequential: o.sequential, seedAfter: o.seedAfter, startNow: o.startNow !== false, schedule: !!o.schedule }));
H('torrent:addQuick', src => manager.add({ type: 'torrent', url: src }));
H('torrent:cancelProbe', hash => { if (hash) manager.torrents.probeCancel.add(String(hash).toLowerCase()); });
H('torrent:select', (id, sel) => manager.get(id)?.setSelection(sel));
H('torrent:sequential', (id, v) => manager.get(id)?.setSequential(v));
H('torrent:trackers', (id, list) => manager.get(id)?.addTrackers(list));
H('torrent:seed', (id, v) => { const d = manager.get(id); if (d) { d.seedAfter = !!v; d.changed(); } });
H('torrent:ratio', (id, r) => { const d = manager.get(id); if (d) { d.ratio = Math.max(0, +r || 0); d.changed(); } });
H('torrent:stream', async (id, index) => {
  const d = manager.get(id);
  if (!d) throw new Error('Introuvable');
  if (d.status !== 'running' && d.status !== 'seeding') { d.status = 'queued'; manager.resume(id); await d.start(); }
  const s = await d.streamUrl(index);
  openPlayer(s.url, s.name);
});
H('torrent:create', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'openDirectory'] });
  if (r.canceled) return null;
  const ct = (await import('create-torrent')).default;
  const buf = await new Promise((res, rej) => ct(r.filePaths[0], { announceList: [manager.torrents.trackers()] }, (e, b) => (e ? rej(e) : res(b))));
  const out = await dialog.showSaveDialog(win, { defaultPath: path.basename(r.filePaths[0]) + '.torrent', filters: [{ name: 'Torrent', extensions: ['torrent'] }] });
  if (out.canceled) return null;
  await fsp.writeFile(out.filePath, buf);
  return out.filePath;
});

// outils
H('checksum', async (idOrPath, algo) => {
  const d = manager.get(idOrPath);
  const file = d ? d.file : idOrPath;
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) throw new Error('Fichier introuvable');
  const h = await tools.checksum(file, algo || 'md5', p => send('checksum-progress', { id: idOrPath, p }));
  if (d && (algo || 'md5') === 'md5') { d.md5 = h; d.changed(); }
  return h;
});
H('extract', async (idOrPath, pass) => {
  const d = manager.get(idOrPath);
  const file = d ? d.file : idOrPath;
  const out = path.join(path.dirname(file), path.basename(file).replace(/\.(zip|rar|7z|tar|gz|tgz|bz2|xz|iso)(\.\w+)?$/i, ''));
  await tools.extract(file, out, pass);
  shell.openPath(out);
  return out;
});
H('merge', async (video, audio, out) => { await tools.mergeAV(video, audio, out); return out; });
H('convert', async (input, out) => { await tools.convert(input, out); return out; });
H('hasFfmpeg', () => !!tools.ffmpegPath());
H('br:updateAdblockProxy', () => browser.updateBlocker(true));
H('exportList', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: 'DrYAE-liens.txt', filters: [{ name: 'Texte', extensions: ['txt'] }] });
  if (r.canceled) return null;
  await fsp.writeFile(r.filePath, manager.list.filter(d => d.status !== 'done').map(d => d.url).join('\r\n'));
  return r.filePath;
});
H('importList', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Texte', extensions: ['txt', 'csv', 'lst'] }] });
  if (r.canceled) return null;
  return (await fsp.readFile(r.filePaths[0], 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(s => /^(https?:\/\/|magnet:)/i.test(s));
});
H('stats', () => {
  const L = manager.list;
  const done = L.filter(d => d.status === 'done');
  return { total: L.length, done: done.length, bytes: done.reduce((a, d) => a + Math.max(0, d.size), 0), dataToday: manager._data?.used || settings.get().dataLimit.used || 0 };
});

function openPlayer(src, title) {
  const p = new BrowserWindow({ width: 1000, height: 620, title: title || 'Lecteur DrYAE', backgroundColor: '#000', icon: path.join(ASSETS, 'icon.png'), autoHideMenuBar: true });
  p.setMenu(null);
  p.loadFile(path.join(UI, 'player.html'), { query: { src, title: title || '', err: T('Lecture impossible ici (format non pris en charge). Ouvre le fichier avec ton lecteur habituel une fois téléchargé.'), buf: T('Mise en mémoire tampon…'), lp: T('Lecteur') } });
}
H('play', id => { const d = manager.get(id); if (d?.file) openPlayer('file:///' + d.file.replace(/\\/g, '/'), d.name); });


// ================= Extension Chrome =================
// Petit serveur local (127.0.0.1) qui n'accepte que les requêtes de l'extension DrYAE (identifiant fixe).
let extPort = 0;
function startExtensionServer() {
  const ok = o => o === 'chrome-extension://' + EXT_ID || o === 'extension://' + EXT_ID;
  const srv = http.createServer((req, res) => {
    const origin = req.headers.origin || '';
    if (!ok(origin)) { res.writeHead(403); return res.end(); }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const json = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'GET' && req.url === '/ping') return json(200, { app: 'DrYAE', version: app.getVersion() });
    if (req.method === 'POST' && req.url === '/add') {
      let body = '';
      req.on('data', d => { body += d; if (body.length > 2e6) req.destroy(); });
      req.on('end', () => {
        let o; try { o = JSON.parse(body); } catch { return json(400, { error: 'json' }); }
        const url = String(o.url || '');
        const headers = {};
        if (o.cookie) headers.Cookie = String(o.cookie);
        if (o.ua) headers['User-Agent'] = String(o.ua);
        if (o.referer) headers.Referer = String(o.referer);
        api.showMain();
        if (/^magnet:/i.test(url) || o.kind === 'torrent') send('prompt-torrent', { src: url, cookie: headers.Cookie, page: o.referer || '' });
        else if (Array.isArray(o.urls)) send('prompt-add', { urls: o.urls.map(String), page: o.referer || '', headers });
        else if (o.kind === 'page' || o.kind === 'ytdl' || isOnlineVideo(url)) send('prompt-add', { url, kind: 'ytdl', page: o.referer || url, headers });
        else send('prompt-add', { url, name: o.name || '', page: o.referer || '', pageTitle: String(o.title || ''), headers, kind: o.kind === 'hls' ? 'hls' : undefined });
        json(200, { ok: true });
      });
      return;
    }
    json(404, { error: 'not found' });
  });
  const tryPort = p => {
    srv.once('error', () => { if (p < 47325) tryPort(p + 1); });
    srv.listen(p, '127.0.0.1', () => { extPort = p; });
  };
  tryPort(47321);
}
H('extInfo', () => ({ port: extPort, id: EXT_ID, folder: path.join(path.dirname(process.execPath), 'Extension Chrome DrYAE') }));
H('openExtFolder', () => { const f = path.join(path.dirname(process.execPath), 'Extension Chrome DrYAE'); if (fs.existsSync(f)) shell.openPath(f); else shell.openPath(path.join(__dirname, '..', '..', 'extension')); });
H('openChromeExt', () => shell.openExternal('chrome://extensions'));


// ---------- langue ----------
function trMenu(items) { return items.map(i => (i && i.label ? { ...i, label: T(i.label), submenu: i.submenu ? trMenu(i.submenu) : undefined } : i)); }
global.DRYAE_TRMENU = trMenu;
function resolveLanguage() {
  const S = settings.get();
  // langue choisie dans l'installateur (lang.txt, écrit seulement lors d'une installation manuelle)
  let fileVal = '', fileLang = '';
  for (const f of [path.join(path.dirname(process.execPath), 'lang.txt'), path.join(process.resourcesPath || '', 'lang.txt')]) {
    try { const v = fs.readFileSync(f, 'utf8').trim(); const l = I18N.LCID[parseInt(v, 10)] || (I18N.LANGS[v] ? v : ''); if (l) { fileVal = v; fileLang = l; break; } } catch {}
  }
  if (fileLang && fileVal !== S.langFileSeen) return settings.set({ lang: fileLang, langChosen: true, langFileSeen: fileVal });
  if (S.langChosen && S.lang) return;
  const loc = (app.getLocale() || 'en').slice(0, 2);
  settings.set({ lang: I18N.LANGS[loc] ? loc : 'en', langChosen: true });
}
ipcMain.on('i18n:lang', e => { e.returnValue = i18n.lang; });
ipcMain.on('i18n:page', e => {
  const keys = ['Télécharger cette vidéo', 'Masquer', 'Remplir avec mon profil', 'mon profil', '(sans identifiant)', '— mot de passe enregistré'];
  e.returnValue = Object.fromEntries(keys.map(k => [k, T(k)]));
});
