// Journal des erreurs de DrYAE (%APPDATA%\DrYAE\logs\dryae.log, 1 Mo max, l'ancien est gardé en .1).
// Rien n'est envoyé sur internet : le rapport « Signaler un problème » est un fichier texte que
// l'utilisateur choisit d'envoyer. Les adresses sont réduites au nom du site, sans mots de passe ni historique.
const fs = require('fs');
const path = require('path');
const os = require('os');

let file = '', ver = '';
const MAX = 1024 * 1024;

// adresses -> nom du site seulement ; chemins personnels -> %USERPROFILE%
function clean(s) {
  let t = String(s ?? '');
  t = t.replace(/\b(https?|ftp|magnet):[^\s"'<>)]*/gi, m => { try { if (/^magnet:/i.test(m)) return 'magnet:…'; const u = new URL(m); return u.protocol + '//' + u.host + '/…'; } catch { return '…'; } });
  try { const home = os.homedir(); if (home) t = t.split(home).join('%USERPROFILE%'); } catch {}
  return t.replace(/(token|secret|password|passwd|pwd|cookie|authorization)=[^&\s]+/gi, '$1=…');
}

function init(userDir, version) {
  ver = version;
  try { fs.mkdirSync(path.join(userDir, 'logs'), { recursive: true }); file = path.join(userDir, 'logs', 'dryae.log'); } catch {}
  process.on('uncaughtException', e => write('erreur', 'exception', e && (e.stack || e.message || e)));
  process.on('unhandledRejection', e => write('erreur', 'promesse', e && (e.stack || e.message || e)));
}

function write(level, where, msg) {
  if (!file) return;
  try {
    const st = fs.existsSync(file) ? fs.statSync(file) : null;
    if (st && st.size > MAX) fs.renameSync(file, file + '.1');
    fs.appendFileSync(file, `${new Date().toISOString()} [${level}] ${where}: ${clean(msg).slice(0, 4000)}\n`);
  } catch {}
}

function tail(n = 400) {
  const out = [];
  for (const f of [file + '.1', file]) { try { out.push(...fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)); } catch {} }
  return out.slice(-n);
}

// rapport à joindre à un signalement : versions, système, réglages utiles (sans données personnelles), journal
function report(extra = {}) {
  const lines = [
    'Rapport DrYAE — à joindre à votre signalement sur GitHub',
    '(aucun mot de passe, historique ni adresse complète de page n’y figure)',
    '',
    `DrYAE ${ver} · Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
    `Windows : ${os.release()} ${os.arch()} · mémoire ${Math.round(os.totalmem() / 1073741824)} Go (libre ${Math.round(os.freemem() / 1073741824)} Go) · ${os.cpus().length} cœurs`,
    `Date : ${new Date().toISOString()}`,
    '',
  ];
  for (const [k, v] of Object.entries(extra)) lines.push(`${k} : ${clean(typeof v === 'string' ? v : JSON.stringify(v))}`);
  lines.push('', '--- Journal (dernières lignes) ---', ...tail());
  return lines.join('\r\n');
}

module.exports = { init, write, tail, report, clean };
