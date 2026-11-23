// DrYAE 1.7.0 — « Traduction sur le PC » : traduction sans service extérieur, avec les modèles libres de Firefox
// Translations (licence MPL-2.0) et le moteur fxtranslate (MPL-2.0). Les modèles sont téléchargés une seule fois par
// paire de langues depuis les serveurs publics de Mozilla, puis tout marche sans internet. Rien d'autre n'est envoyé.
// Les paires sans modèle direct passent par l'anglais (japonais → anglais → français).
// La traduction elle-même tourne dans un processus à part, pour ne jamais figer DrYAE.
const path = require('path'); const fs = require('fs');
const { app, net, utilityProcess } = require('electron');

const FX = path.dirname(require.resolve('fxtranslate'));
const { Cache, ensureModel } = require(path.join(FX, 'cache.js'));
const { recordsUrl } = require(path.join(FX, 'fetch.js'));
let wasm = null; const W = () => wasm || (wasm = require(path.join(FX, '..', 'wasm', 'fxtranslate_wasm.js')));

const dir = () => path.join(app.getPath('userData'), 'mt-models');
const LOG = (...a) => { try { require('./log').write('info', 'local-mt', ...a); } catch {} };

// ---------- liste des modèles (gardée sur le disque : marche aussi sans internet) ----------
let body = null;
async function records(fresh) {
  const f = path.join(dir(), 'records.json');
  if (!fresh && body) return body;
  let old = null; try { old = fs.readFileSync(f, 'utf8'); } catch {}
  const age = (() => { try { return Date.now() - fs.statSync(f).mtimeMs; } catch { return Infinity; } })();
  if (old && !fresh && age < 7 * 864e5) return (body = old);
  try {
    const r = await net.fetch(recordsUrl()); if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text(); W().parseRecords(t); // vérifie que la liste est lisible
    fs.mkdirSync(dir(), { recursive: true }); fs.writeFileSync(f, t);
    return (body = t);
  } catch (e) { if (old) return (body = old); throw new Error('liste des modèles indisponible (connexion ?) : ' + e.message); }
}
// téléchargement par le réseau de DrYAE (proxy de Windows respecté), avec progression
const fetcher = onProgress => ({
  async get(url) { const r = await net.fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); },
  async download(url, prog) {
    // le serveur des fichiers refuse certaines demandes de compression (HTTP 406) : fichier demandé tel quel ;
    // en dernier recours, téléchargement par Node (sans le proxy de Windows)
    let r = await net.fetch(url, { headers: { 'Accept-Encoding': 'identity', Accept: '*/*' } }).catch(() => null);
    if (!r || !r.ok) { const r2 = await fetch(url).catch(() => null); if (r2 && r2.ok) r = r2; }
    if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : 'erreur réseau'));
    const total = +r.headers.get('content-length') || undefined, parts = []; let done = 0;
    const rd = r.body.getReader();
    for (;;) { const { done: end, value } = await rd.read(); if (end) break; parts.push(value); done += value.length; try { prog && prog(done, total); onProgress && onProgress(done, total); } catch {} }
    return new Uint8Array(Buffer.concat(parts.map(p => Buffer.from(p))));
  },
});

// ---------- itinéraire : direct, ou en passant par l'anglais ----------
async function route(src, trg) {
  const b = await records();
  try { return JSON.parse(W().resolveRoute(b, src, trg)); } catch { return null; }
}
// paires disponibles (pour les Paramètres)
async function pairs() { try { return JSON.parse(W().modelPairs(await records())); } catch { return []; } }

// fichiers d'une paire, téléchargés si besoin (une seule fois)
const pending = new Map();
async function ensurePair(src, trg, onProgress) {
  const k = src + '-' + trg;
  if (pending.has(k)) return pending.get(k);
  const p = (async () => {
    const recs = JSON.parse(W().parseRecords(await records()));
    const cache = new Cache(dir()); if (onProgress) cache.withProgress((name, done, total) => onProgress(k, done, total));
    return ensureModel(fetcher(), cache, recs, src, trg);
  })().finally(() => pending.delete(k));
  pending.set(k, p);
  return p;
}
function installed() { try { return new Cache(dir()).listCached().map(x => x.name || x); } catch { return []; } }
function sizeOnDisk() { const walk = d => { let t = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) t += e.isDirectory() ? walk(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size; } catch {} return t; }; return walk(dir()); }
function removeAll() { try { fs.rmSync(dir(), { recursive: true, force: true }); } catch {} body = null; stop(); }

// ---------- processus de traduction ----------
let child = null, seq = 0; const waits = new Map();
function proc() {
  if (child) return child;
  child = utilityProcess.fork(path.join(__dirname, 'local-mt-child.js'), [], { serviceName: 'DrYAE traduction sur le PC' });
  child.on('message', m => { const w = waits.get(m.id); if (!w) return; waits.delete(m.id); clearTimeout(w.t); m.error ? w.no(new Error(m.error)) : w.ok(m); });
  child.on('exit', () => { child = null; for (const w of waits.values()) w.no(new Error('traduction sur le PC interrompue')); waits.clear(); });
  return child;
}
function stop() { try { child && child.kill(); } catch {} child = null; }
const ask = (msg, timeout = 120000) => new Promise((ok, no) => { const id = ++seq; const w = { ok, no }; waits.set(id, w); proc().postMessage({ ...msg, id }); w.t = setTimeout(() => { if (waits.has(id)) { waits.delete(id); no(new Error('traduction sur le PC trop lente')); } }, timeout); });

// ---------- détection de la langue (sur le PC, sans rien envoyer) ----------
const SCRIPT = [['ja', /[぀-ヿ]/g], ['ko', /[가-힯]/g], ['zh', /[一-鿿]/g], ['ru', /[Ѐ-ӿ]/g], ['ar', /[؀-ۿ]/g], ['el', /[Ͱ-Ͽ]/g], ['hi', /[ऀ-ॿ]/g], ['he', /[֐-׿]/g]];
const STOP = {
  fr: /\b(le|la|les|des|est|et|une|pour|que|qui|dans|pas|vous|avec|sur|ce|il|nous|je|tu|mais|on|ça|c'est|j'ai|moi|toi)\b/gi,
  en: /\b(the|and|is|are|of|to|in|that|it|for|you|with|on|this|was|have|be|i|my|me|what|i'm|don't|it's|we|he|she)\b/gi,
  es: /\b(el|los|las|es|y|que|de|en|un|una|por|con|para|del|se|no|lo|yo|tú|está|qué)\b/gi,
  pt: /\b(o|os|as|é|e|que|de|em|um|uma|para|com|não|do|da|se|por|eu|você|está)\b/gi,
  de: /\b(der|die|das|und|ist|nicht|ein|eine|zu|mit|den|ich|sie|es|auf|du|wir)\b/gi,
  it: /\b(il|lo|gli|è|e|che|di|un|una|per|con|non|del|della|sono|io|tu)\b/gi,
};
function detect(text) {
  const t = String(text || ''); const letters = (t.match(/\p{L}/gu) || []).length || 1;
  // le japonais mélange kana et kanji : les kana suffisent à le reconnaître
  for (const [l, re] of SCRIPT) { const n = (t.match(re) || []).length; if (n / letters > (l === 'ja' ? 0.05 : 0.3)) return l === 'zh' && (t.match(SCRIPT[0][1]) || []).length ? 'ja' : l; }
  const sc = Object.fromEntries(Object.entries(STOP).map(([l, re]) => [l, (t.match(re) || []).length]));
  // textes courts (bulles) : dictionnaires anglais et français de DrYAE
  try { const SF = require('./scan-fix'); const words = t.split(/\s+/).filter(Boolean); if (words.length) { sc.en += SF.englishRatio([t]) * 3; sc.fr += SF.frenchRatio([t]) * 3; } } catch {}
  const best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'en';
}

// ---------- traduction ----------
// texts : liste de textes ; to : langue d'arrivée ; from : langue de départ ou 'auto'
// 1.7.1 : « <0xC3><0x87> » (octets écrits en clair par le modèle) → « Ç » ; aussi refait ici par sécurité
function bytesFix(t) {
  return String(t ?? '').replace(/(?:<0x[0-9a-f]{2}>)+/gi, run => {
    const s = Buffer.from(run.match(/[0-9a-f]{2}(?=>)/gi).map(h => parseInt(h, 16))).toString('utf8');
    return s.includes('\uFFFD') ? '' : s;
  });
}
async function translate(texts, to, from, onProgress) {
  to = String(to || 'fr').split('-')[0].toLowerCase();
  let src = from && from !== 'auto' ? String(from).split('-')[0].toLowerCase() : detect(texts.join(' \n '));
  if (src === to) return { texts: texts.slice(), from: src };
  const r = await route(src, to);
  if (!r || r.kind === 'none' || r.error) throw new Error(`pas de modèle de traduction ${src} → ${to}`);
  const legs = r.kind === 'pivot' ? [[r.src, r.pivot], [r.pivot, r.trg]] : [[r.src || src, r.trg || to]];
  const files = [];
  for (const [a, b] of legs) files.push(await ensurePair(a, b, onProgress));
  const t0 = Date.now();
  const res = await ask({ cmd: 'translate', legs: files, texts });
  LOG(`${src}→${to}${r.kind === 'pivot' ? ' (par ' + r.pivot + ')' : ''} : ${texts.length} texte(s) en ${Date.now() - t0} ms`);
  return { texts: res.texts.map(bytesFix), from: src, pivot: r.kind === 'pivot' ? r.pivot : '' };
}

module.exports = { bytesFix, translate, detect, ensurePair, pairs, installed, sizeOnDisk, removeAll, records, route, stop, dir };
