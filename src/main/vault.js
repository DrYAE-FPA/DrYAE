// Coffre de mots de passe des sites web, cartes de paiement et adresses (navigateur DrYAE)
// Les mots de passe et les numéros de carte sont chiffrés par Windows (safeStorage / DPAPI). Une page ne reçoit que les identifiants
// de sa propre origine : l'origine est lue côté processus principal (senderFrame), jamais fournie par la page.
const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, BrowserWindow, app, shell } = require('electron');
const pages = require('./pages');
const M = require('./modules');

// ---------- fichiers .csv (export des navigateurs et gestionnaires de mots de passe courants) ----------
function parseCsv(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') && !first.includes(',') ? '\t' : ',');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === '') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}
const COLS = {
  url: ['url', 'login_uri', 'website', 'web site', 'origin', 'origin_url', 'site', 'address', 'uri', 'login url', 'hostname'],
  user: ['username', 'login_username', 'login name', 'user name', 'user', 'login', 'email', 'e-mail', 'identifiant'],
  pass: ['password', 'login_password', 'pass', 'mot de passe'],
  note: ['note', 'notes', 'comment', 'extra'],
};
function readLogins(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { list: [], bad: true };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const at = k => { for (const n of COLS[k]) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const iu = at('url'), in_ = at('user'), ip = at('pass'), inote = at('note');
  if (iu < 0 || ip < 0) return { list: [], bad: true };
  const list = []; let skipped = 0;
  for (const r of rows.slice(1)) {
    const pw = r[ip] || ''; let o = '';
    try { const raw = (r[iu] || '').trim(); const u = new URL(/^[a-z][\w+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); o = /^https?:$/.test(u.protocol) && (u.hostname.includes('.') || u.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) ? u.origin : ''; } catch {}
    if (!o || !pw || pw.length > 500) { skipped++; continue; }
    list.push({ origin: o, username: in_ >= 0 ? String(r[in_] || '').slice(0, 300) : '', password: pw, note: inote >= 0 ? String(r[inote] || '').slice(0, 2000) : '' });
  }
  return { list, skipped };
}
const csvCell = v => /[",\r\n;]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const hostOfOrigin = o => { try { return new URL(o).hostname.replace(/^www\./, ''); } catch { return o; } };
// regroupement par site : « accounts.example.com » et « example.com » vont ensemble
const siteOf = o => { const h = hostOfOrigin(o); if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return h; const p = h.split('.'); return p.length > 2 && !/^(co|com|org|net|gouv|gov|ac)$/.test(p[p.length - 2]) ? p.slice(-2).join('.') : p.length > 2 ? p.slice(-3).join('.') : h; };
const cardBrand = n => /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'American Express' : /^6(011|5)/.test(n) ? 'Discover' : /^35/.test(n) ? 'JCB' : /^62/.test(n) ? 'UnionPay' : 'Carte';

class Vault {
  constructor({ userDir, enc, dec, settings, getWc, privatePartition, hello }) {
    Object.assign(this, { enc, dec, settings, getWc, privatePartition, hello });
    this.file = path.join(userDir, 'web-passwords.json');
    this.data = { logins: [], never: [], addresses: [], cards: [], check: null };
    try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch {}
    // 1.6.4 : l'ancien profil unique de saisie automatique devient la première adresse
    const old = settings.get().browser.autofillProfile || {};
    if (!this.data.addresses.length && old.profile && Object.values(old.profile).some(Boolean)) { this.data.addresses.push({ id: uid(), ...old.profile, t: Date.now() }); this.save(); }
    this.pending = new Map(); // wcId -> { origin, username, password }
    this.setupIpc();
    this.setupPages();
  }
  P() { return this.settings.get().browser.vault || {}; }
  win() { return BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.isVisible()) || undefined; }
  save() { try { fs.writeFileSync(this.file, JSON.stringify(this.data)); } catch {} pages.broadcast('vault'); }
  static originOf(frame) { try { const u = new URL(frame.url); return /^https?:$/.test(u.protocol) ? u.origin : ''; } catch { return ''; } }
  frameOrigin(e) {
    const f = e.senderFrame;
    if (!f) return '';
    const o = Vault.originOf(f);
    // dans une iframe, on n'accepte que la même origine que la page principale
    const top = f.top ? Vault.originOf(f.top) : o;
    return o && o === top ? o : '';
  }
  forOrigin(origin) { return this.data.logins.filter(l => l.origin === origin); }
  find(origin, username) { return this.data.logins.find(x => x.origin === origin && x.username === username); }
  // Windows Hello demandé avant d'afficher, copier ou exporter un mot de passe (si activé)
  async confirm(kind, msg) {
    const P = this.P();
    const need = kind === 'card' ? P.paymentsHello !== false : !!P.hello;
    if (!need) return true;
    const r = await this.hello((global.DRYAE_T || (s => s))(msg || 'DrYAE veut afficher un mot de passe enregistré'));
    if (!r.ok) throw new Error((global.DRYAE_T || (s => s))('Identité non confirmée'));
    return true;
  }
  clearAll() { this.data.logins = []; this.data.never = []; this.data.check = null; this.save(); }
  clearAutofill() { this.data.addresses = []; this.data.cards = []; this.save(); this.settings.set({ browser: { autofillProfile: { enabled: false, profile: {} } } }); }
  listView() {
    const counts = new Map(); for (const l of this.data.logins) { const s = siteOf(l.origin); counts.set(s, (counts.get(s) || 0) + 1); }
    return this.data.logins.map(l => ({ origin: l.origin, host: hostOfOrigin(l.origin), site: siteOf(l.origin), username: l.username, t: l.t, note: !!l.note, used: l.used || 0 }));
  }
  upsert({ origin, username, password, note }, old) {
    try { origin = new URL(/^https?:\/\//.test(origin) ? origin : 'https://' + origin).origin; } catch { throw new Error('Adresse du site invalide'); }
    username = String(username || '').slice(0, 300);
    if (old) this.data.logins = this.data.logins.filter(l => !(l.origin === old.origin && l.username === old.username));
    const prev = this.find(origin, username);
    this.data.logins = this.data.logins.filter(l => !(l.origin === origin && l.username === username));
    const pw = password !== undefined && password !== null ? String(password) : (prev ? this.dec(prev.password) : '');
    if (!pw) throw new Error('Mot de passe vide');
    this.data.logins.unshift({ origin, username, password: this.enc(pw), t: Date.now(), ...(note !== undefined ? (note ? { note: this.enc(String(note).slice(0, 2000)) } : {}) : (prev?.note ? { note: prev.note } : {})) });
    this.save();
  }
  async checkup() {
    const list = this.data.logins.map(l => ({ key: l.origin + '\u0000' + l.username, pw: this.dec(l.password) })).filter(x => x.pw);
    const byPw = new Map(); for (const x of list) { if (!byPw.has(x.pw)) byPw.set(x.pw, []); byPw.get(x.pw).push(x.key); }
    const reused = [...byPw.values()].filter(g => g.length > 1);
    const weak = list.filter(x => M.weak(x.pw)).map(x => x.key);
    const compromised = []; let error = '';
    const uniq = [...byPw.keys()]; let i = 0;
    const worker = async () => { while (i < uniq.length) { const pw = uniq[i++]; try { const n = await M.pwnedCount(pw); if (n > 0) for (const k of byPw.get(pw)) compromised.push({ key: k, n }); } catch (e) { error = e.message; } } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    this.data.check = { t: Date.now(), n: list.length, compromised, reused, weak, error: error ? 'Vérification des fuites impossible (connexion ?)' : '' };
    this.save();
    return this.data.check;
  }

  setupPages() {
    const P = pages.on;
    P('pwList', () => ({ logins: this.listView(), never: this.data.never, settings: this.P(), check: this.data.check }));
    P('pwReveal', async (origin, username) => { const l = this.find(origin, username); if (!l) return ''; await this.confirm('pw'); return this.dec(l.password); });
    P('pwNote', async (origin, username) => { const l = this.find(origin, username); return l && l.note ? this.dec(l.note) : ''; });
    P('pwSave', (o, old) => { this.upsert(o, old); return true; });
    P('pwDelete', list => { const removed = []; for (const k of [].concat(list)) { const l = this.find(k.origin, k.username); if (l) { removed.push(l); this.data.logins = this.data.logins.filter(x => x !== l); } } this._lastRemoved = removed; this.save(); return removed.length; });
    P('pwUndo', () => { if (this._lastRemoved) { this.data.logins.push(...this._lastRemoved); this._lastRemoved = null; this.save(); } });
    P('pwUnnever', origin => { this.data.never = this.data.never.filter(x => x !== origin); this.save(); });
    P('pwNever', origin => { try { origin = new URL(/^https?:\/\//.test(origin) ? origin : 'https://' + origin).origin; } catch { return; } if (!this.data.never.includes(origin)) this.data.never.push(origin); this.save(); });
    P('pwSettings', patch => { this.settings.set({ browser: { vault: { ...this.P(), ...patch } } }); pages.broadcast('vault'); return this.P(); });
    P('pwCheck', () => this.checkup());
    P('pwGenerate', n => M.generatePassword(n || 16));
    P('pwDeleteAll', async () => { await this.confirm('pw', 'DrYAE veut supprimer tous les mots de passe'); this.clearAll(); return true; });
    P('pwImport', () => this.importCsv());
    P('pwExport', async () => { await this.confirm('pw', 'DrYAE veut exporter vos mots de passe'); return this.exportCsv(); });
    P('helloTest', () => this.hello((global.DRYAE_T || (s => s))('Test de Windows Hello pour DrYAE')));
    // adresses
    P('addrList', () => this.data.addresses);
    P('addrSave', a => { const x = { ...a, id: a.id || uid(), t: Date.now() }; for (const k of Object.keys(x)) if (typeof x[k] === 'string') x[k] = x[k].slice(0, 300); this.data.addresses = [x, ...this.data.addresses.filter(y => y.id !== x.id)]; this.save(); return x; });
    P('addrDelete', id => { this.data.addresses = this.data.addresses.filter(y => y.id !== id); this.save(); });
    // cartes de paiement (le code de sécurité CVC n'est jamais enregistré)
    P('cardList', () => this.data.cards.map(({ number, ...c }) => c));
    P('cardSave', c => {
      const num = String(c.number || '').replace(/\D/g, '');
      const prev = this.data.cards.find(y => y.id === c.id);
      if (!num && !prev) throw new Error('Numéro de carte manquant');
      if (num && (num.length < 12 || num.length > 19)) throw new Error('Numéro de carte invalide');
      const x = { id: c.id || uid(), holder: String(c.holder || '').slice(0, 120), nick: String(c.nick || '').slice(0, 60), exp: String(c.exp || '').replace(/[^\d/]/g, '').slice(0, 7), t: Date.now(),
        number: num ? this.enc(num) : prev.number, last4: num ? num.slice(-4) : prev.last4, brand: num ? cardBrand(num) : prev.brand };
      this.data.cards = [x, ...this.data.cards.filter(y => y.id !== x.id)]; this.save(); return true;
    });
    P('cardDelete', id => { this.data.cards = this.data.cards.filter(y => y.id !== id); this.save(); });
    P('cardReveal', async id => { const c = this.data.cards.find(y => y.id === id); if (!c) return ''; await this.confirm('card', 'DrYAE veut afficher le numéro de votre carte'); return this.dec(c.number); });
    P('pwShortcut', () => {
      if (process.platform !== 'win32') return false;
      const lnk = path.join(app.getPath('desktop'), 'DrYAE - Mots de passe.lnk');
      return shell.writeShortcutLink(lnk, { target: process.execPath, args: (app.isPackaged ? '' : '"' + path.resolve(process.argv[1] || '.') + '" ') + '--open=dryae://passwords', icon: process.execPath, iconIndex: 0, description: 'DrYAE' });
    });
  }
  async importCsv() {
    const tr = x => (global.DRYAE_T || (y => y))(x);
    const r = await dialog.showOpenDialog(this.win(), { title: tr('Importer des mots de passe'), properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const { list, skipped, bad } = readLogins(fs.readFileSync(r.filePaths[0], 'utf8'));
    if (bad) throw new Error(tr('Fichier non reconnu : il faut au moins les colonnes « url » et « password ».'));
    let added = 0, updated = 0;
    for (const l of list) {
      const old = this.find(l.origin, l.username);
      if (old) { if (this.dec(old.password) !== l.password) { old.password = this.enc(l.password); old.t = Date.now(); updated++; } }
      else { this.data.logins.push({ origin: l.origin, username: l.username, password: this.enc(l.password), t: Date.now(), ...(l.note ? { note: this.enc(l.note) } : {}) }); added++; }
    }
    this.save();
    return { added, updated, skipped: skipped || 0 };
  }
  async exportCsv() {
    const tr = x => (global.DRYAE_T || (y => y))(x);
    const r = await dialog.showSaveDialog(this.win(), { title: tr('Exporter les mots de passe'), defaultPath: 'DrYAE-mots-de-passe.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (r.canceled || !r.filePath) return null;
    const lines = ['name,url,username,password,note'];
    for (const l of this.data.logins) { const pw = this.dec(l.password); if (!pw) continue; lines.push([hostOfOrigin(l.origin), l.origin, l.username, pw, l.note ? this.dec(l.note) : ''].map(csvCell).join(',')); }
    fs.writeFileSync(r.filePath, '﻿' + lines.join('\r\n') + '\r\n');
    return { n: lines.length - 1, file: r.filePath };
  }

  setupIpc() {
    // ---- appels venant des pages (script page-preload) ----
    // identifiant choisi ou saisi sur une première page (connexion en deux étapes : adresse, puis mot de passe)
    this.lastUser = this.lastUser || new Map();
    const lastFor = (e, o) => { const x = this.lastUser.get(e.sender.id); return x && x.origin === o && Date.now() - x.t < 15 * 60000 ? x.username : ''; };
    ipcMain.handle('pw:user', (e, username) => { const o = this.frameOrigin(e); username = String(username || '').trim().slice(0, 300); if (o && username) this.lastUser.set(e.sender.id, { origin: o, username, t: Date.now() }); });
    ipcMain.handle('pw:get', e => {
      if (this.P().autofill === false) return [];
      const o = this.frameOrigin(e);
      if (!o) return [];
      const last = lastFor(e, o);
      return this.forOrigin(o).map(l => ({ username: l.username, password: this.dec(l.password), last: !!last && l.username === last })).filter(l => l.password);
    });
    ipcMain.handle('pw:used', (e, username) => { const o = this.frameOrigin(e); const l = o && this.find(o, username); if (l) { l.used = Date.now(); this.save(); } });
    ipcMain.handle('pw:gen', e => (this.P().suggest !== false && this.frameOrigin(e) ? M.generatePassword(16) : ''));
    ipcMain.handle('pw:offer', (e, c) => {
      if (this.P().offer === false || !c || !c.password || String(c.password).length > 500) return;
      if (e.sender.session && this.privatePartition && e.sender.session === require('electron').session.fromPartition(this.privatePartition)) return;
      const o = this.frameOrigin(e);
      if (!o || this.data.never.includes(o)) return;
      const username = String(c.username || lastFor(e, o) || '').slice(0, 300), password = String(c.password);
      const same = this.forOrigin(o).find(l => l.username === username);
      if (same && this.dec(same.password) === password) return;
      this.pending.set(e.sender.id, { origin: o, username, password });
      this.getWc()?.send('pw-offer', { wcId: e.sender.id, origin: o, username, update: !!same });
    });
    // adresses proposées dans les formulaires
    ipcMain.handle('af:get', e => {
      if (this.P().addresses === false || !this.frameOrigin(e)) return [];
      return this.data.addresses;
    });
    // cartes : la page ne voit que les 4 derniers chiffres ; le numéro complet est envoyé seulement au moment de remplir
    ipcMain.handle('card:list', e => (this.P().payments === false || !this.frameOrigin(e) ? [] : this.data.cards.map(c => ({ id: c.id, holder: c.holder, last4: c.last4, brand: c.brand, exp: c.exp, nick: c.nick }))));
    ipcMain.handle('card:fill', async (e, id) => {
      if (this.P().payments === false || !this.frameOrigin(e)) return null;
      const c = this.data.cards.find(y => y.id === id); if (!c) return null;
      await this.confirm('card', 'DrYAE veut remplir votre carte de paiement');
      return { number: this.dec(c.number), holder: c.holder, exp: c.exp };
    });
    // ---- appels venant de l'interface du navigateur ----
    ipcMain.handle('br:pwSave', (_e, { wcId, action }) => {
      const p = this.pending.get(wcId); this.pending.delete(wcId);
      if (!p) return;
      if (action === 'never') { if (!this.data.never.includes(p.origin)) this.data.never.push(p.origin); }
      else if (action === 'save') {
        const prev = this.find(p.origin, p.username);
        this.data.logins = this.data.logins.filter(l => !(l.origin === p.origin && l.username === p.username));
        this.data.logins.unshift({ origin: p.origin, username: p.username, password: this.enc(p.password), t: Date.now(), ...(prev?.note ? { note: prev.note } : {}) });
      }
      this.save();
    });
    ipcMain.handle('br:pwList', () => ({ logins: this.listView(), never: this.data.never, settings: this.P() }));
  }
}
module.exports = { Vault, parseCsv, readLogins, siteOf };
