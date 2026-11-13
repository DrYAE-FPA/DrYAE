/* DrYAE — navigateur, 1.7.0 : outils pour les longues sessions de travail.
   Espaces de travail, collections (export Word / PDF), surlignages et notes dans les pages, vitesse des vidéos
   par site, recherche dans le texte des pages visitées, rappels de pause, correcteur d'orthographe,
   conteneurs (onglets séparés pour plusieurs comptes), taux de change pour la barre d'adresse.
   Tout est gardé sur ce PC (fichier browser.json et history-text.json du dossier de DrYAE). */
'use strict';
const { ipcMain, app, dialog, session, webContents, BrowserWindow, powerMonitor, nativeImage, net, shell } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { makeDocx } = require('./docx-lite');

const CONTAINERS = [
  { id: 'c1', name: 'Conteneur 1', color: '#3b82f6' },
  { id: 'c2', name: 'Conteneur 2', color: '#22c55e' },
  { id: 'c3', name: 'Conteneur 3', color: '#f97316' },
  { id: 'c4', name: 'Conteneur 4', color: '#ec4899' },
];
const partOf = id => 'persist:dryae-' + id;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const keyOf = u => String(u || '').split('#')[0];
const clip = (s, n) => String(s || '').slice(0, n);

module.exports = function work(br) {
  const save = () => br.saveStore();
  const T = s => (global.DRYAE_T || (x => x))(s);
  const B = () => br.B();
  const toUi = (ch, x) => br.wc?.send(ch, x);

  // ---------------------------------------------------------------- conteneurs
  br.containers = () => CONTAINERS.map(c => ({ ...c, name: (B().containers || {})[c.id] || T(c.name) }));
  br.containerSessions = () => CONTAINERS.map(c => session.fromPartition(partOf(c.id)));
  ipcMain.handle('br:containers', () => br.containers());
  ipcMain.handle('br:containerRename', (_e, id, name) => { const n = { ...(B().containers || {}) }; n[id] = clip(String(name || '').trim(), 30); if (!n[id]) delete n[id]; br.settings.set({ browser: { containers: n } }); return br.containers(); });
  const pages = require('./pages');
  pages.on('containerRename', (id, name) => { const n = { ...(B().containers || {}) }; n[id] = clip(String(name || '').trim(), 30); if (!n[id]) delete n[id]; br.settings.set({ browser: { containers: n } }); return true; });
  pages.on('containerClear', async id => { if (CONTAINERS.some(c => c.id === id)) await session.fromPartition(partOf(id)).clearStorageData(); return true; });
  ipcMain.handle('br:containerClear', async (_e, id) => { if (!CONTAINERS.some(c => c.id === id)) return; await session.fromPartition(partOf(id)).clearStorageData(); return true; });

  // ---------------------------------------------------------------- espaces de travail
  ipcMain.handle('br:spaces', () => br.store.spaces || []);
  ipcMain.handle('br:spaceSave', (_e, o = {}) => {
    const L = br.store.spaces || (br.store.spaces = []);
    const tabs = (o.tabs || []).filter(t => /^(https?|file|dryae):/.test(t.url || '')).slice(0, 200).map(t => ({ url: clip(t.url, 4000), title: clip(t.title, 300), group: t.group || undefined, container: t.container || undefined }));
    let sp = o.id && L.find(x => x.id === o.id);
    if (sp) { if (o.tabs) sp.tabs = tabs; if (o.name) sp.name = clip(o.name, 60); if (o.groups) sp.groups = o.groups; sp.t = Date.now(); }
    else { sp = { id: uid(), name: clip(o.name || T('Espace sans nom'), 60), tabs, groups: o.groups || {}, t: Date.now(), kind: o.kind || undefined }; L.unshift(sp); }
    save(); return L;
  });
  ipcMain.handle('br:spaceAdd', (_e, id, tabs) => {
    const L = br.store.spaces || (br.store.spaces = []);
    let sp = L.find(x => x.id === id || x.kind === id);
    if (!sp) { sp = { id: uid(), name: id === 'inactive' ? T('Onglets inactifs') : T('Espace sans nom'), tabs: [], groups: {}, t: Date.now(), kind: id === 'inactive' ? 'inactive' : undefined }; L.push(sp); }
    for (const t of tabs || []) if (/^https?:/.test(t.url || '') && !sp.tabs.some(x => x.url === t.url)) sp.tabs.push({ url: clip(t.url, 4000), title: clip(t.title, 300), container: t.container || undefined, closedAt: Date.now() });
    sp.tabs = sp.tabs.slice(-300); sp.t = Date.now(); save(); return L;
  });
  ipcMain.handle('br:spaceDel', (_e, id, i) => { const L = br.store.spaces || []; const sp = L.find(x => x.id === id); if (!sp) return L; if (i == null) br.store.spaces = L.filter(x => x !== sp); else sp.tabs.splice(i, 1); save(); return br.store.spaces; });

  // ---------------------------------------------------------------- collections
  const cols = () => br.store.cols || (br.store.cols = []);
  const colGet = id => cols().find(c => c.id === id);
  br.colAdd = (id, item) => {
    let c = id && colGet(id);
    if (!c) { c = { id: uid(), name: T('Collection {0}').replace('{0}', cols().length + 1), items: [], t: Date.now() }; cols().unshift(c); }
    const it = { id: uid(), type: item.type, url: clip(item.url, 4000), title: clip(item.title, 300), text: clip(item.text, 20000), src: clip(item.src, 4000), t: Date.now() };
    c.items.push(it); c.t = Date.now(); save();
    toUi('toast', T('Ajouté à « {0} »').replace('{0}', c.name)); toUi('cols-changed');
    return c;
  };
  ipcMain.handle('br:cols', () => cols());
  ipcMain.handle('br:colNew', (_e, name) => { const c = { id: uid(), name: clip(String(name || '').trim() || T('Collection {0}').replace('{0}', cols().length + 1), 60), items: [], t: Date.now() }; cols().unshift(c); save(); return cols(); });
  ipcMain.handle('br:colAdd', (_e, id, item) => { br.colAdd(id, item || {}); return cols(); });
  ipcMain.handle('br:colRename', (_e, id, name) => { const c = colGet(id); if (c && String(name || '').trim()) { c.name = clip(name.trim(), 60); save(); } return cols(); });
  ipcMain.handle('br:colDel', (_e, id, itemId) => { const c = colGet(id); if (!c) return cols(); if (itemId) c.items = c.items.filter(i => i.id !== itemId); else br.store.cols = cols().filter(x => x !== c); save(); return cols(); });
  ipcMain.handle('br:colMove', (_e, id, itemId, dir) => { const c = colGet(id); if (!c) return cols(); const i = c.items.findIndex(x => x.id === itemId), j = i + dir; if (i >= 0 && j >= 0 && j < c.items.length) [c.items[i], c.items[j]] = [c.items[j], c.items[i]]; save(); return cols(); });
  const exported = new Set();
  ipcMain.handle('br:colExport', async (_e, id, kind) => { const f = await exportCol(colGet(id), kind); if (f) exported.add(f); return f; });
  ipcMain.handle('br:openPath', (_e, f) => (exported.has(f) ? shell.openPath(f) : null));

  // image d'une collection : récupérée avec la session du navigateur, convertie en PNG (taille limitée)
  async function fetchImg(src) {
    try {
      let buf;
      if (/^data:image\//.test(src)) buf = Buffer.from(src.split(',')[1] || '', 'base64');
      else if (/^https?:/.test(src)) { const r = await session.fromPartition('persist:dryae-web').fetch(src); if (!r.ok) return null; buf = Buffer.from(await r.arrayBuffer()); }
      else return null;
      let img = nativeImage.createFromBuffer(buf); if (img.isEmpty()) return null;
      let { width: w, height: h } = img.getSize();
      if (w > 1400) { img = img.resize({ width: 1400 }); ({ width: w, height: h } = img.getSize()); }
      return { png: img.toPNG(), w, h, data: img.toDataURL() };
    } catch { return null; }
  }
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  async function exportCol(c, kind) {
    if (!c) return null;
    const lang = br.settings.get().lang || 'fr';
    const name = c.name.replace(/[\\/:*?"<>|]/g, '_');
    const ext = kind === 'pdf' ? 'pdf' : 'docx';
    const r = await dialog.showSaveDialog(br.win, { defaultPath: path.join(app.getPath('documents'), name + '.' + ext), filters: [{ name: kind === 'pdf' ? 'PDF' : 'Word', extensions: [ext] }] });
    if (r.canceled || !r.filePath) return null;
    const blocks = [{ h: 1, text: c.name }];
    const dateStr = t => { try { return new Date(t).toLocaleDateString(lang); } catch { return ''; } };
    for (const it of c.items) {
      if (it.type === 'note') { blocks.push({ text: it.text, note: true }); continue; }
      if (it.title) blocks.push({ h: 2, text: it.title });
      if (it.type === 'text') blocks.push({ text: it.text, quote: true });
      if (it.type === 'image') { const im = await fetchImg(it.src); if (im) blocks.push({ img: im }); else blocks.push({ text: it.src, small: true }); }
      if (it.url) blocks.push({ text: it.url + ' — ' + T('ajouté le {0}').replace('{0}', dateStr(it.t)), small: true, link: it.url });
    }
    if (kind === 'pdf') {
      const html = `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><style>body{font:12pt Calibri,"Segoe UI",sans-serif;margin:0;color:#111}h1{font-size:22pt;margin:0 0 14pt}h2{font-size:14pt;margin:16pt 0 6pt}blockquote{margin:4pt 0 8pt;padding:4pt 10pt;border-left:3pt solid #7c3aed;background:#f5f3ff}.small{color:#555;font-size:9pt;word-break:break-all}.note{background:#fff7d6;padding:6pt 10pt;border-radius:4pt}img{max-width:100%;margin:6pt 0}p{white-space:pre-wrap;margin:4pt 0}</style></head><body>`
        + blocks.map(b => b.h ? `<h${b.h}>${esc(b.text)}</h${b.h}>` : b.img ? `<img src="${b.img.data}">` : b.quote ? `<blockquote><p>${esc(b.text)}</p></blockquote>` : `<p class="${b.small ? 'small' : b.note ? 'note' : ''}">${esc(b.text)}</p>`).join('') + '</body></html>';
      const tmp = path.join(app.getPath('temp'), 'dryae-col-' + Date.now() + '.html');
      await fsp.writeFile(tmp, html);
      const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
      try { await w.loadFile(tmp); const pdf = await w.webContents.printToPDF({ pageSize: 'A4', margins: { marginType: 'default' }, printBackground: true }); await fsp.writeFile(r.filePath, pdf); }
      finally { w.destroy(); fsp.unlink(tmp).catch(() => {}); }
    } else await fsp.writeFile(r.filePath, makeDocx(blocks, { lang: { fr: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-PT', ru: 'ru-RU', ar: 'ar-SA' }[lang.split('-')[0]] || lang, title: c.name }));
    return r.filePath;
  }

  // ---------------------------------------------------------------- surlignages et notes dans les pages
  const marks = () => br.store.marks || (br.store.marks = {});
  br.marksFor = url => (marks()[keyOf(url)] || {}).list || [];
  ipcMain.handle('hl:save', (e, m) => {
    const k = keyOf(e.senderFrame?.url); if (!/^https?:/.test(k) || !m || !m.id) return false;
    const M = marks(); const p = M[k] || (M[k] = { title: '', list: [] });
    p.title = clip(e.sender.getTitle(), 300) || p.title;
    const i = p.list.findIndex(x => x.id === m.id);
    const it = { id: String(m.id).slice(0, 40), text: clip(m.text, 5000), pre: clip(m.pre, 40), post: clip(m.post, 40), color: /^[a-z]+$/.test(m.color) ? m.color : 'yellow', note: clip(m.note, 5000), t: Date.now() };
    if (i >= 0) p.list[i] = it; else p.list.push(it);
    p.t = Date.now(); save(); toUi('marks-changed'); return true;
  });
  ipcMain.handle('hl:del', (e, id) => { const k = keyOf(e.senderFrame?.url); const p = marks()[k]; if (p) { p.list = p.list.filter(x => x.id !== id); if (!p.list.length) delete marks()[k]; save(); toUi('marks-changed'); } return true; });
  ipcMain.handle('br:marks', () => marks());
  ipcMain.handle('br:markDel', (_e, url, id) => { const p = marks()[url]; if (p) { p.list = p.list.filter(x => x.id !== id); if (!p.list.length) delete marks()[url]; save(); } return marks(); });

  // ---------------------------------------------------------------- vitesse des vidéos (mémorisée par site)
  ipcMain.handle('speed:pref', (e, rate) => {
    let host = ''; try { host = new URL(e.senderFrame.url).hostname; } catch {}
    if (!host) return;
    const sp = { ...(B().videoSpeed || {}) }; rate = Math.max(0.25, Math.min(4, +rate || 1));
    if (rate === 1) delete sp[host]; else sp[host] = rate;
    br.settings.set({ browser: { videoSpeed: sp } }); return true;
  });

  br.setSpeed = (wc, rate) => {
    if (!wc || wc.isDestroyed()) return;
    for (const f of wc.mainFrame.framesInSubtree) { try { f.send('dryae-cmd', { cmd: 'speed', rate, save: f === wc.mainFrame }); } catch {} }
  };
  ipcMain.handle('br:speed', (_e, wcId, rate) => br.setSpeed(webContents.fromId(wcId), rate));

  // ---------------------------------------------------------------- texte des pages visitées (recherche dans l'historique)
  const HT_FILE = path.join(br.userDir, 'history-text.json');
  let HT = null, htT = 0;
  const htLoad = () => { if (HT) return HT; HT = new Map(); try { for (const [u, x] of Object.entries(JSON.parse(fs.readFileSync(HT_FILE, 'utf8')))) HT.set(u, x); } catch {} return HT; };
  const htSave = () => { clearTimeout(htT); htT = setTimeout(() => { if (!HT) return; fsp.writeFile(HT_FILE, JSON.stringify(Object.fromEntries(HT))).catch(() => {}); }, 3000); };
  br.htClear = (urls) => { htLoad(); if (!urls) HT.clear(); else for (const u of urls) HT.delete(keyOf(u)); htSave(); };
  br.htPrune = () => { if (!HT) return; const keep = new Set((br.store.history || []).map(h => keyOf(h.url))); for (const u of HT.keys()) if (!keep.has(u)) HT.delete(u); htSave(); };
  // résultats trouvés dans le texte des pages : { url -> extrait }
  br.htSearch = q => {
    const f = fold(q).trim(); if (f.length < 3 || B().histText === false) return new Map();
    const words = f.split(/\s+/).filter(Boolean), out = new Map();
    for (const [u, x] of htLoad()) {
      const F = x.f || (x.f = fold(x.s));
      if (!words.every(w => F.includes(w))) continue;
      const i = F.indexOf(words[0]); const a = Math.max(0, i - 60);
      out.set(u, (a ? '…' : '') + x.s.slice(a, i + 120).replace(/\s+/g, ' ').trim() + '…');
      if (out.size >= 300) break;
    }
    return out;
  };
  const grab = async wc => {
    try {
      if (wc.isDestroyed() || B().histText === false || B().clearOnExit) return;
      if (wc.session !== session.fromPartition('persist:dryae-web')) return;
      if (!/^https?:/.test(wc.getURL())) return;
      const [href, s] = await wc.executeJavaScript('[location.href, (document.body && document.body.innerText || "").slice(0, 12000)]', false);
      const u = keyOf(href); if (!/^https?:/.test(u)) return;
      if (!s || s.length < 80) return;
      htLoad(); HT.delete(u); HT.set(u, { s: s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n'), t: Date.now() });
      while (HT.size > 3000) HT.delete(HT.keys().next().value);
      htSave();
    } catch {}
  };
  app.on('web-contents-created', (_e, wc) => {
    if (wc.getType() !== 'webview') return;
    let t = 0;
    wc.on('did-finish-load', () => { clearTimeout(t); t = setTimeout(() => grab(wc), 4000); });
    wc.on('destroyed', () => clearTimeout(t));
  });

  // ---------------------------------------------------------------- rappels de pause (temps d'utilisation réel)
  let used = 0, lastEye = 0, lastStand = 0;
  setInterval(() => {
    const R = B().breaks || {}; if (R.on === false || !br.win || br.win.isDestroyed() || !br.view) return;
    if (!br.win.isVisible() || br.win.isMinimized() || br.present) return;
    let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch {}
    if (idle > 300) { used = 0; lastEye = 0; lastStand = 0; return; } // 5 minutes sans rien toucher = pause déjà prise
    used += 1;
    const eye = Math.max(10, +R.eye || 20), stand = Math.max(30, +R.stand || 60);
    if (used - lastStand >= stand) { lastStand = used; lastEye = used; toUi('break', 'stand'); }
    else if (used - lastEye >= eye) { lastEye = used; toUi('break', 'eye'); }
  }, 60 * 1000);

  // ---------------------------------------------------------------- correcteur d'orthographe
  // Sous Windows, DrYAE utilise le correcteur de Windows lui-même : aucun dictionnaire n'est téléchargé.
  br.spellSetup = ses => {
    const sp = B().spell || {};
    try { ses.setSpellCheckerEnabled(sp.on !== false); } catch {}
    if (process.platform === 'win32' || process.platform === 'darwin') return;
    try {
      const avail = ses.availableSpellCheckerLanguages || [];
      const want = [...new Set([...(sp.langs || []), br.settings.get().lang || 'fr'])].map(l => avail.find(a => a === l) || avail.find(a => a.startsWith(l + '-')) || avail.find(a => a.split('-')[0] === l)).filter(Boolean);
      if (want.length) ses.setSpellCheckerLanguages(want);
    } catch {}
  };

  // ---------------------------------------------------------------- taux de change (barre d'adresse)
  let rates = null, ratesT = 0;
  ipcMain.handle('br:rates', async () => {
    if (rates && Date.now() - ratesT < 12 * 3600e3) return rates;
    if (B().dataSaver) return rates;
    try {
      const r = await net.fetch('https://open.er-api.com/v6/latest/EUR'); const j = await r.json();
      if (j && j.rates) { rates = { base: 'EUR', rates: j.rates, t: (j.time_last_update_unix || 0) * 1000 || Date.now() }; ratesT = Date.now(); }
    } catch {}
    return rates;
  });

  // ---------------------------------------------------------------- mode présentation
  ipcMain.handle('br:present', (_e, on) => {
    br.present = !!on;
    if (br.win && !br.win.isDestroyed() && br.win.isFullScreen() !== !!on) br.win.setFullScreen(!!on);
    return br.present;
  });
};
module.exports.CONTAINERS = CONTAINERS;
module.exports.partOf = partOf;
