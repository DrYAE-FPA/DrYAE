// Mises à jour en un clic (GitHub Releases) + liens « Donner mon avis » / « Faire un don »
const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

// date de construction de cette copie de DrYAE (écrite par la construction sur GitHub) :
// une version refaite avec le même numéro (ex. 1.6.9 corrigée) est reconnue comme une mise à jour
function buildDate() {
  try { const d = Date.parse(require('../../package.json').dryaeBuild || ''); if (!isNaN(d)) return d; } catch {}
  // copie construite avant cette option (1.6.9 d'origine) : date d'installation de l'application
  try { return fs.statSync(path.join(process.resourcesPath || '', 'app.asar')).mtimeMs || 0; } catch { return 0; }
}
// version publiée plus récente : numéro plus grand, ou même numéro construit au moins 30 minutes après cette copie
function rebuilt(version, date) {
  const b = buildDate(), d = Date.parse(date || '');
  return !!(b && !isNaN(d) && version === app.getVersion() && d > b + 30 * 60e3);
}
function readConfig() {
  for (const p of [path.join(process.resourcesPath || '', 'dryae.config.json'), path.join(__dirname, '..', '..', 'dryae.config.json')]) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
  }
  return { github: { owner: '', repo: '' }, donateUrl: '' };
}

class Updater {
  constructor({ send, notify, T, auto, beforeInstall }) {
    this.send = send; this.notify = notify; this.T = T; this.auto = auto || (() => true); this.beforeInstall = beforeInstall || (() => {});
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
      autoUpdater.disableWebInstaller = true;
      // electron-updater a besoin du fichier app-update.yml : s'il manque (ancienne construction), on le crée
      const g = this.cfg.github;
      const yml = `provider: github\nowner: ${g.owner}\nrepo: ${g.repo}\nupdaterCacheDirName: dryae-updater\n`;
      const own = path.join(process.resourcesPath || '', 'app-update.yml');
      if (!fs.existsSync(own)) {
        const alt = path.join(app.getPath('userData'), 'app-update.yml');
        try { fs.writeFileSync(alt, yml); autoUpdater.updateConfigPath = alt; } catch {}
      }
      autoUpdater.setFeedURL({ provider: 'github', owner: g.owner, repo: g.repo });
      // même numéro de version mais construction plus récente (version refaite) : proposée aussi
      const orig = autoUpdater.isUpdateAvailable.bind(autoUpdater);
      autoUpdater.isUpdateAvailable = async info => (await orig(info)) || rebuilt(info && info.version, info && info.releaseDate);
      autoUpdater.on('checking-for-update', () => this.set({ status: 'checking', error: null }));
      autoUpdater.on('update-available', i => { const fix = i.version === app.getVersion(); this.set({ status: 'available', version: fix ? i.version + ' (' + this.T('version corrigée') + ')' : i.version, rebuilt: fix }); this.notify(this.T('Mise à jour disponible'), 'DrYAE ' + i.version + (fix ? ' — ' + this.T('version corrigée') : '')); });
      autoUpdater.on('update-not-available', () => this.set({ status: 'latest' }));
      autoUpdater.on('download-progress', p => this.set({ status: 'downloading', progress: p.percent || 0, transferred: p.transferred || 0, total: p.total || 0, speed: p.bytesPerSecond || 0 }));
      autoUpdater.on('update-downloaded', i => this.set({ status: 'ready', version: i.version === app.getVersion() ? i.version + ' (' + this.T('version corrigée') + ')' : i.version, progress: 100, speed: 0 }));
      autoUpdater.on('error', e => this.set({ status: 'error', error: String(e && e.message || e).split('\n')[0] }));
      this.au = autoUpdater;
      // vérification automatique (désactivable dans Paramètres → À propos)
      setTimeout(() => this.auto() && this.check(), 4000); // tôt : l'icône de mise à jour s'affiche dès l'ouverture
      setInterval(() => this.auto() && this.check(), 6 * 3600 * 1000);
    } catch (e) { console.error('updater', e.message); }
  }
  async check() {
    if (!this.repoUrl) return this.info();
    if (!this.au) { // version non installée : on lit simplement la dernière version publiée
      try {
        const r = await fetch(`https://api.github.com/repos/${this.cfg.github.owner}/${this.cfg.github.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
        if (r.ok) { const j = await r.json(); const v = String(j.tag_name || '').replace(/^v/, ''); const fix = rebuilt(v, j.published_at || j.created_at); this.set({ status: v && (newer(v, app.getVersion()) || fix) ? 'available' : 'latest', version: fix ? v + ' (' + this.T('version corrigée') + ')' : v, rebuilt: fix }); }
        else this.set({ status: 'error', error: 'GitHub ' + r.status });
      } catch (e) { this.set({ status: 'error', error: e.message }); }
      return this.info();
    }
    try { await this.au.checkForUpdates(); } catch (e) { this.set({ status: 'error', error: e.message }); }
    return this.info();
  }
  async install() {
    if (!this.au) { if (this.repoUrl) shell.openExternal(this.repoUrl + '/releases/latest'); return; }
    // installation silencieuse (sans fenêtre d'installation ni choix de langue), puis DrYAE se rouvre tout seul
    if (this.state.status === 'ready') { try { this.beforeInstall(); } catch {} return this.au.quitAndInstall(true, true); }
    this.set({ status: 'downloading', progress: 0 });
    try { await this.au.downloadUpdate(); } catch (e) { this.set({ status: 'error', error: e.message }); }
  }
}
function newer(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0), pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
}
module.exports = { Updater, rebuilt, buildDate };
