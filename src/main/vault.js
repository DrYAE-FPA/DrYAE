// Coffre de mots de passe des sites web + profil de saisie automatique (navigateur DrYAE)
// Les mots de passe sont chiffrés par Windows (safeStorage / DPAPI). Une page ne reçoit que les identifiants
// de sa propre origine : l'origine est lue côté processus principal (senderFrame), jamais fournie par la page.
const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');

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
    ipcMain.handle('br:pwUnnever', (_e, origin) => { this.data.never = this.data.never.filter(x => x !== origin); this.save(); });
    ipcMain.handle('br:pwSettings', (_e, patch) => { this.settings.set({ browser: { vault: { ...this.P(), ...patch } } }); return this.P(); });
    ipcMain.handle('br:afGet', () => this.settings.get().browser.autofillProfile || { enabled: false, profile: {} });
    ipcMain.handle('br:afSet', (_e, v) => { this.settings.set({ browser: { autofillProfile: v } }); return v; });
  }
}
module.exports = { Vault };
