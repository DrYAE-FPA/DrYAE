// Avertissement avant d'ouvrir un site connu pour l'hameçonnage (arnaques) ou les virus.
// La liste (Phishing.Database, MIT) est téléchargée sur le PC une fois par semaine : les adresses visitées
// ne sont JAMAIS envoyées à un service. Elle est gardée sous forme d'empreintes (deux nombres par nom de site)
// pour prendre peu de mémoire (≈ 3 Mo pour 400 000 sites).
const fs = require('fs');
const path = require('path');

const LIST_URL = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt';
const WEEK = 7 * 24 * 3600 * 1000;
let dir = '', A = null, Bh = null, meta = { updated: 0, count: 0 }, busy = null, log = () => {};

// deux empreintes indépendantes (FNV-1a et djb2) : une fausse alerte est pratiquement impossible
function h1(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function h2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h >>> 0; }

function build(text) {
  const pairs = [];
  for (let line of text.split('\n')) {
    line = line.trim().toLowerCase();
    if (!line || line.startsWith('#') || line.length > 253 || !line.includes('.')) continue;
    pairs.push([h1(line), h2(line)]);
  }
  pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  A = new Uint32Array(pairs.length); Bh = new Uint32Array(pairs.length);
  pairs.forEach((p, i) => { A[i] = p[0]; Bh[i] = p[1]; });
  return pairs.length;
}
function has(name) {
  if (!A || !A.length) return false;
  const a = h1(name), b = h2(name);
  let lo = 0, hi = A.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (A[m] < a) lo = m + 1; else if (A[m] > a) hi = m - 1;
    else { for (let k = m; k >= 0 && A[k] === a; k--) if (Bh[k] === b) return true; for (let k = m + 1; k < A.length && A[k] === a; k++) if (Bh[k] === b) return true; return false; }
  }
  return false;
}
// le site ou un de ses domaines parents (www.x.exemple.com → x.exemple.com → exemple.com)
function isBad(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host || /^(localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/.test(host)) return false;
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1 && i < 6; i++) if (has(parts.slice(i).join('.'))) return true;
  return false;
}

function init(userDir, logger) {
  dir = path.join(userDir, 'safe'); log = logger || log;
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch {}
  try { const t = fs.readFileSync(path.join(dir, 'list.txt'), 'utf8'); meta.count = build(t); } catch {}
}
// mise à jour : au plus une fois par semaine (fichier d'environ 10 Mo)
async function update(force) {
  if (busy) return busy;
  if (!force && Date.now() - (meta.updated || 0) < WEEK && A) return false;
  busy = (async () => {
    const doFetch = (() => { try { return require('electron').net.fetch; } catch { return fetch; } })();
    const r = await doFetch(LIST_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    if (text.length < 100000) throw new Error('liste trop courte');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'list.txt.tmp'), text); fs.renameSync(path.join(dir, 'list.txt.tmp'), path.join(dir, 'list.txt'));
    meta = { updated: Date.now(), count: build(text) };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    return true;
  })().catch(e => { log('sites dangereux', e.message); return false; }).finally(() => { busy = null; });
  return busy;
}
const info = () => ({ ...meta, loaded: !!(A && A.length) });
// pour les tests : liste fournie directement
function _load(text) { meta.count = build(text); }

module.exports = { init, update, isBad, info, _load };
