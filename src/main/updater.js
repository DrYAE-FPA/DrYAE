// Mises à jour en un clic (GitHub Releases) + liens « Donner mon avis » / « Faire un don »
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

function readConfig() {
  for (const p of [path.join(process.resourcesPath || '', 'dryae.config.json'), path.join(__dirname, '..', '..', 'dryae.config.json')]) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
  }
  return { github: { owner: '', repo: '' }, donateUrl: '' };
}

class Updater {
  constructor({ send, notify, T }) {
    this.send = send; this.notify = notify; this.T = T;
    this.cfg = readConfig();
    this.state = { status: 'idle', version: null, progress: 0, error: null };
    this.au = null;
  }
  get repoUrl() { const g = this.cfg.github || {}; return g.owner && g.repo ? `https://github.com/${g.owner}/${g.repo}` : ''; }
  info() {
    return { configured: !!this.repoUrl, repoUrl: this.repoUrl, feedbackUrl: this.repoUrl ? this.repoUrl + '/issues/new/choose' : '', releasesUrl: this.repoUrl ? this.repoUrl + '/releases' : '',
      donateUrl: this.cfg.donateUrl || '', current: app.getVersion(), installed: this.isInstalled(), ...this.state };
  }
  // la version portable (zip) ne peut pas se remplacer elle-même : on ouvre alors la page des versions
  isInstalled() { try { return fs.existsSync(path.join(path.dirname(process.execPath), 'Uninstall DrYAE.exe')); } catch { return false; } }
  set(s) { Object.assign(this.state, s); this.send('update-state', this.info()); }
  init() {
    if (!this.repoUrl || !app.isPackaged) return;
    try {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.setFeedURL({ provider: 'github', owner: this.cfg.github.owner, repo: this.cfg.github.repo });
      autoUpdater.on('checking-for-update', () => this.set({ status: 'checking', error: null }));
      autoUpdater.on('update-available', i => { this.set({ status: 'available', version: i.version }); this.notify(this.T('Mise à jour disponible'), 'DrYAE ' + i.version); });
      autoUpdater.on('update-not-available', () => this.set({ status: 'latest' }));
      autoUpdater.on('download-progress', p => this.set({ status: 'downloading', progress: p.percent || 0 }));
      autoUpdater.on('update-downloaded', i => this.set({ status: 'ready', version: i.version }));
      autoUpdater.on('error', e => this.set({ status: 'error', error: String(e && e.message || e).split('\n')[0] }));
      this.au = autoUpdater;
      setTimeout(() => this.check(), 15000);
      setInterval(() => this.check(), 6 * 3600 * 1000);
    } catch (e) { console.error('updater', e.message); }
  }
  async check() {
    if (!this.repoUrl) return this.info();
    if (!this.au) { // version non installée : on lit simplement la dernière version publiée
      try {
        const r = await fetch(`https://api.github.com/repos/${this.cfg.github.owner}/${this.cfg.github.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
        if (r.ok) { const j = await r.json(); const v = String(j.tag_name || '').replace(/^v/, ''); this.set({ status: v && newer(v, app.getVersion()) ? 'available' : 'latest', version: v }); }
        else this.set({ status: 'error', error: 'GitHub ' + r.status });
      } catch (e) { this.set({ status: 'error', error: e.message }); }
      return this.info();
    }
    try { await this.au.checkForUpdates(); } catch (e) { this.set({ status: 'error', error: e.message }); }
    return this.info();
  }
  async install() {
    if (!this.au) { if (this.repoUrl) shell.openExternal(this.repoUrl + '/releases/latest'); return; }
    if (this.state.status === 'ready') return this.au.quitAndInstall(false, true);
    this.set({ status: 'downloading', progress: 0 });
    try { await this.au.downloadUpdate(); } catch (e) { this.set({ status: 'error', error: e.message }); }
  }
}
function newer(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0), pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
}
module.exports = { Updater };
