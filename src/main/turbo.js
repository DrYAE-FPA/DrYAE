// 1.7.2 (version perso) : « Mode turbo » — laisser toute la connexion à DrYAE pendant les gros téléchargements.
// Prudent par principe : on ne coupe rien d'autre que ces gros consommateurs connus, et tout revient tout seul.
//  - OneDrive : arrêté proprement (« OneDrive.exe /shutdown »), relancé à la fin du mode turbo (ou au prochain démarrage
//    de DrYAE s'il s'était fermé entre-temps).
//  - Windows Update et l'Optimisation de la distribution (et BITS) : arrêtés avec l'accord de Windows (fenêtre
//    « Autoriser cette application… ») ; Windows les relance de lui-même dès qu'il en a besoin.
//  - Dans DrYAE : la mise à jour de la liste des trackers est repoussée pendant le turbo.
// Le mode s'arrête tout seul quand il n'y a plus de téléchargement en cours (réglable).
const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const isWin = process.platform === 'win32';
const SERVICES = ['DoSvc', 'BITS', 'wuauserv']; // Optimisation de la distribution, transfert en arrière-plan, Windows Update

function run(cmd, args, ms = 15000) {
  if (process.env.DRYAE_TURBO_FAKE) { (global.__turboLog = global.__turboLog || []).push([cmd, ...args].join(' ')); return Promise.resolve({ ok: true, out: global.__turboFake?.[cmd] || '' }); }
  return new Promise(res => execFile(cmd, args, { windowsHide: true, timeout: ms }, (e, out) => res({ ok: !e, out: String(out || '') })));
}
function oneDrivePath() {
  const c = [path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'OneDrive', 'OneDrive.exe'), path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft OneDrive', 'OneDrive.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft OneDrive', 'OneDrive.exe')];
  if (process.env.DRYAE_TURBO_FAKE) return c[0] || 'OneDrive.exe';
  return c.find(p => p && fs.existsSync(p)) || null;
}
async function oneDriveRunning() {
  const r = await run('tasklist', ['/FI', 'IMAGENAME eq OneDrive.exe', '/NH']);
  return r.ok && /OneDrive\.exe/i.test(r.out);
}

class Turbo {
  constructor(settings, file) {
    this.settings = settings; this.file = file;
    this.st = { on: false, since: 0, onedrive: 'none', winupdate: 'none' }; // 'paused' | 'none' | 'refused' | 'n/a'
    this.restoreLeftover();
  }
  cfg() { return { auto: false, stopWhenDone: true, onedrive: true, winupdate: true, ...(this.settings.get().turbo || {}) }; }
  save() { try { fs.writeFileSync(this.file, JSON.stringify(this.st)); } catch {} }
  // DrYAE fermé pendant le turbo (plantage, coupure) : on relance OneDrive au démarrage suivant
  restoreLeftover() {
    let old = null; try { old = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
    if (old && old.on && old.onedrive === 'paused') this.startOneDrive();
    try { fs.unlinkSync(this.file); } catch {}
  }
  startOneDrive() {
    const p = oneDrivePath(); if (!p) return;
    if (process.env.DRYAE_TURBO_FAKE) { run(p, ['/background']); return; }
    try { spawn(p, ['/background'], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch {}
  }
  status() { return { ...this.st, win: isWin || !!process.env.DRYAE_TURBO_FAKE, cfg: this.cfg() }; }
  async start() {
    if (this.st.on) return this.status();
    const C = this.cfg(), win = isWin || !!process.env.DRYAE_TURBO_FAKE;
    this.st = { on: true, since: Date.now(), onedrive: win ? 'none' : 'n/a', winupdate: win ? 'none' : 'n/a' };
    this.save();
    if (win && C.onedrive) {
      const p = oneDrivePath();
      if (p && await oneDriveRunning()) { await run(p, ['/shutdown'], 20000); this.st.onedrive = 'paused'; }
    }
    if (win && C.winupdate) {
      // une seule demande d'accord à Windows ; refusée = on continue sans
      const cmd = '/c ' + SERVICES.map(s => `net stop ${s} /y`).join(' & ');
      const ps = `Start-Process -FilePath cmd.exe -ArgumentList '${cmd}' -Verb RunAs -WindowStyle Hidden -Wait`;
      const r = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], 120000);
      this.st.winupdate = r.ok ? 'paused' : 'refused';
    }
    this.save();
    return this.status();
  }
  async stop() {
    if (!this.st.on) return this.status();
    if (this.st.onedrive === 'paused') this.startOneDrive();
    // Windows Update / BITS / Optimisation de la distribution : services « au besoin », Windows les relance tout seul
    this.st = { on: false, since: 0, onedrive: 'none', winupdate: 'none' };
    try { fs.unlinkSync(this.file); } catch {}
    return this.status();
  }
}
module.exports = { Turbo, SERVICES };
