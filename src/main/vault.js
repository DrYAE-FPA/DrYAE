// Coffre de mots de passe des sites web + profil de saisie automatique (navigateur DrYAE)
// Les mots de passe sont chiffrés par Windows (safeStorage / DPAPI). Une page ne reçoit que les identifiants
// de sa propre origine : l'origine est lue côté processus principal (senderFrame), jamais fournie par la page.
const fs = require('fs');
const path = require('path');
const { ipcMain, dialog, BrowserWindow } = require('electron');

// ---------- fichiers .csv (export des navigateurs et gestionnaires de mots de passe courants) ----------
function parseCsv(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
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
};
function readLogins(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { list: [], bad: true };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const at = k => { for (const n of COLS[k]) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const iu = at('url'), in_ = at('user'), ip = at('pass');
  if (iu < 0 || ip < 0) return { list: [], bad: true };
  const list = []; let skipped = 0;
  for (const r of rows.slice(1)) {
    const pw = r[ip] || ''; let o = '';
    try { const raw = (r[iu] || '').trim(); const u = new URL(/^[a-z][\w+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw); o = /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.origin : ''; } catch {}
    if (!o || !pw || pw.length > 500) { skipped++; continue; }
    list.push({ origin: o, username: in_ >= 0 ? String(r[in_] || '').slice(0, 300) : '', password: pw });
  }
  return { list, skipped };
}
const csvCell = v => /[",\r\n;]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);

class Vault {
  constructor({ userDir, enc, dec, settings, getWc, privatePartition }) {
    Object.assign(this, { enc, dec, settings, getWc, privatePartition });
    this.file = path.join(userDir, 'web-passwords.json');
    this.data = { logins: [], never: [] };
    try { this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch {}
    this.pending = new Map(); // wcId -> { origin, username, password }
    this.setupIpc();
  }
  P() { return this.settings.get().browser.vault || {}; }
  save() { try { fs.writeFileSync(this.file, JSON.stringify(this.data)); } catch {} }
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

  setupIpc() {
    // ---- appels venant des pages (script page-preload) ----
    ipcMain.handle('pw:get', e => {
      if (this.P().autofill === false) return [];
      const o = this.frameOrigin(e);
      if (!o) return [];
      return this.forOrigin(o).map(l => ({ username: l.username, password: this.dec(l.password) })).filter(l => l.password);
    });
    ipcMain.handle('pw:offer', (e, c) => {
      if (this.P().offer === false || !c || !c.password || String(c.password).length > 500) return;
      if (e.sender.session && this.privatePartition && e.sender.session === require('electron').session.fromPartition(this.privatePartition)) return;
      const o = this.frameOrigin(e);
      if (!o || this.data.never.includes(o)) return;
      const username = String(c.username || '').slice(0, 300), password = String(c.password);
      const same = this.forOrigin(o).find(l => l.username === username);
      if (same && this.dec(same.password) === password) return;
      const host = e.sender.hostWebContents || null;
      this.pending.set(e.sender.id, { origin: o, username, password });
      this.getWc()?.send('pw-offer', { wcId: e.sender.id, origin: o, username, update: !!same });
    });
    ipcMain.handle('af:get', e => {
      const A = this.settings.get().browser.autofillProfile || {};
      if (!A.enabled || !this.frameOrigin(e)) return null;
      return A.profile || null;
    });
    // ---- appels venant de l'interface du navigateur ----
    ipcMain.handle('br:pwSave', (_e, { wcId, action }) => {
      const p = this.pending.get(wcId); this.pending.delete(wcId);
      if (!p) return;
      if (action === 'never') { if (!this.data.never.includes(p.origin)) this.data.never.push(p.origin); }
      else if (action === 'save') {
        this.data.logins = this.data.logins.filter(l => !(l.origin === p.origin && l.username === p.username));
        this.data.logins.unshift({ origin: p.origin, username: p.username, password: this.enc(p.password), t: Date.now() });
      }
      this.save();
    });
    ipcMain.handle('br:pwList', () => ({ logins: this.data.logins.map(l => ({ origin: l.origin, username: l.username, t: l.t })), never: this.data.never, settings: this.P() }));
    ipcMain.handle('br:pwReveal', (_e, { origin, username }) => { const l = this.data.logins.find(x => x.origin === origin && x.username === username); return l ? this.dec(l.password) : ''; });
    ipcMain.handle('br:pwDelete', (_e, { origin, username }) => { this.data.logins = this.data.logins.filter(x => !(x.origin === origin && x.username === username)); this.save(); });
    ipcMain.handle('br:pwAdd', (_e, { origin, username, password }) => {
      try { origin = new URL(/^https?:\/\//.test(origin) ? origin : 'https://' + origin).origin; } catch { throw new Error('Adresse du site invalide'); }
      this.data.logins = this.data.logins.filter(l => !(l.origin === origin && l.username === username));
      this.data.logins.unshift({ origin, username, password: this.enc(password), t: Date.now() }); this.save();
    });
    // importer / exporter un fichier .csv
    ipcMain.handle('br:pwImport', async e => {
      const win = BrowserWindow.fromWebContents(e.sender) || undefined;
      const tr = x => (global.DRYAE_T || (y => y))(x);
      const r = await dialog.showOpenDialog(win, { title: tr('Importer des mots de passe'), properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }] });
      if (r.canceled || !r.filePaths[0]) return null;
      const { list, skipped, bad } = readLogins(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (bad) throw new Error(tr('Fichier non reconnu : il faut au moins les colonnes « url » et « password ».'));
      let added = 0, updated = 0;
      for (const l of list) {
        const old = this.data.logins.find(x => x.origin === l.origin && x.username === l.username);
        if (old) { if (this.dec(old.password) !== l.password) { old.password = this.enc(l.password); old.t = Date.now(); updated++; } }
        else { this.data.logins.push({ origin: l.origin, username: l.username, password: this.enc(l.password), t: Date.now() }); added++; }
      }
      this.save();
      return { added, updated, skipped: skipped || 0 };
    });
    ipcMain.handle('br:pwExport', async e => {
      const win = BrowserWindow.fromWebContents(e.sender) || undefined;
      const tr = x => (global.DRYAE_T || (y => y))(x);
      const r = await dialog.showSaveDialog(win, { title: tr('Exporter les mots de passe'), defaultPath: 'DrYAE-mots-de-passe.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (r.canceled || !r.filePath) return null;
      const lines = ['name,url,username,password,note'];
      for (const l of this.data.logins) { const pw = this.dec(l.password); if (!pw) continue; lines.push([new URL(l.origin).hostname, l.origin, l.username, pw, ''].map(csvCell).join(',')); }
      fs.writeFileSync(r.filePath, '\uFEFF' + lines.join('\r\n') + '\r\n');
      return { n: lines.length - 1, file: r.filePath };
    });
    ipcMain.handle('br:pwUnnever', (_e, origin) => { this.data.never = this.data.never.filter(x => x !== origin); this.save(); });
    ipcMain.handle('br:pwSettings', (_e, patch) => { this.settings.set({ browser: { vault: { ...this.P(), ...patch } } }); return this.P(); });
    ipcMain.handle('br:afGet', () => this.settings.get().browser.autofillProfile || { enabled: false, profile: {} });
    ipcMain.handle('br:afSet', (_e, v) => { this.settings.set({ browser: { autofillProfile: v } }); return v; });
  }
}
module.exports = { Vault, parseCsv, readLogins };
