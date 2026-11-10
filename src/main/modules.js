// Extensions intégrées de DrYAE : traduction, traducteur de scans (lecture du texte des images),
// et petits services : Windows Hello, vérification des mots de passe divulgués.
const { net, app, session } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ---------- liste des extensions intégrées ----------
const MODULES = [
  { id: 'adblock', name: 'Bloqueur de publicités', desc: 'Bloque les publicités, les traqueurs et, si vous le souhaitez, les bannières de cookies et les éléments gênants. Permet aussi de masquer un élément de la page à la main.', icon: 'shield', key: '' },
  { id: 'capture', name: 'Téléchargements par DrYAE', desc: 'Envoie les fichiers téléchargés dans le gestionnaire DrYAE (reprise, accélération, choix du format des vidéos). Désactivé, le navigateur télécharge les fichiers lui-même, comme un navigateur ordinaire.', icon: 'dl', key: '' },
  { id: 'translate', name: 'Traducteur', desc: 'Traduit le texte sélectionné dans une bulle, ou la page entière, dans votre langue.', icon: 'translate', key: 'Ctrl+Maj+E' },
  { id: 'scan', name: 'Traducteur de scans', desc: 'Lit le texte des images (mangas, manhwas, webtoons, captures) et affiche la traduction par-dessus chaque bulle.', icon: 'scan', key: 'Ctrl+Maj+S' },
  { id: 'lights', name: 'Lumières tamisées', desc: 'Assombrit toute la page autour de la vidéo pour la regarder comme au cinéma. Comprend aussi un mode nuit qui fonce les pages claires.', icon: 'bulb', key: 'Ctrl+Maj+L' },
  { id: 'pip', name: 'Image dans l\'image', desc: 'Ajoute un bouton sur les vidéos pour les détacher dans une petite fenêtre qui reste au premier plan.', icon: 'pip', key: 'Ctrl+Maj+U' },
];
const MOD_DEFAULT = { installed: true, enabled: true, pinned: true };

// ---------- traduction ----------
const PROVIDERS = {
  google: { name: 'Google Traduction (gratuit, sans compte)' },
  deepl: { name: 'DeepL (clé API personnelle)' },
  libre: { name: 'LibreTranslate (serveur au choix)' },
};
async function fetchJson(url, opts = {}) {
  const r = await net.fetch(url, { ...opts, headers: { 'User-Agent': 'DrYAE/' + app.getVersion(), ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
// Google : un appel par lot de lignes (séparées par des retours à la ligne)
async function googleBatch(lines, to, from = 'auto') {
  const q = lines.map(s => s.replace(/\n+/g, ' ')).join('\n');
  const j = await fetchJson(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'q=' + encodeURIComponent(q),
  });
  const out = (j[0] || []).map(x => x[0] || '').join('');
  const parts = out.split('\n');
  return { texts: parts.length === lines.length ? parts : null, from: j[2] || from };
}
async function google(texts, to, from) {
  const res = new Array(texts.length); let detected = from;
  // lots d'environ 4 000 caractères
  let batch = [], idx = [], size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const r = await googleBatch(batch, to, from);
    detected = r.from || detected;
    if (r.texts) r.texts.forEach((t, k) => { res[idx[k]] = t; });
    else for (let k = 0; k < batch.length; k++) { const one = await googleBatch([batch[k]], to, from); res[idx[k]] = (one.texts || [batch[k]]).join(' '); }
    batch = []; idx = []; size = 0;
  };
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (size + t.length > 4000) await flush();
    batch.push(t); idx.push(i); size += t.length + 1;
  }
  await flush();
  return { texts: res, from: detected };
}
async function deepl(texts, to, from, cfg) {
  const key = String(cfg.deeplKey || '').trim();
  if (!key) throw new Error('Clé DeepL manquante (Paramètres → Traduction).');
  const host = /:fx$/.test(key) ? 'api-free.deepl.com' : 'api.deepl.com';
  const T = to.toUpperCase() === 'EN' ? 'EN-US' : to.toUpperCase() === 'PT' ? 'PT-PT' : to.toUpperCase();
  const j = await fetchJson(`https://${host}/v2/translate`, { method: 'POST', headers: { Authorization: 'DeepL-Auth-Key ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: T, ...(from && from !== 'auto' ? { source_lang: from.toUpperCase() } : {}) }) });
  return { texts: j.translations.map(x => x.text), from: (j.translations[0]?.detected_source_language || from || '').toLowerCase() };
}
async function libre(texts, to, from, cfg) {
  const url = String(cfg.libreUrl || '').trim().replace(/\/+$/, '');
  if (!url) throw new Error('Adresse du serveur LibreTranslate manquante (Paramètres → Traduction).');
  const j = await fetchJson(url + '/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source: from || 'auto', target: to, format: 'text', ...(cfg.libreKey ? { api_key: cfg.libreKey } : {}) }) });
  const t = Array.isArray(j.translatedText) ? j.translatedText : [j.translatedText];
  return { texts: t, from: (j.detectedLanguage && (Array.isArray(j.detectedLanguage) ? j.detectedLanguage[0]?.language : j.detectedLanguage.language)) || from };
}
const cache = new Map();
async function translate(texts, to, from, cfg) {
  texts = texts.map(t => String(t || ''));
  const prov = { google, deepl, libre }[cfg.provider] || google;
  const key = t => (cfg.provider || 'google') + '|' + (from || 'auto') + '|' + to + '|' + t;
  const out = new Array(texts.length), miss = [], missI = [];
  let det = from;
  texts.forEach((t, i) => { if (!t.trim()) out[i] = t; else if (cache.has(key(t))) { const c = cache.get(key(t)); out[i] = c.t; if (!det || det === 'auto') det = c.from; } else { miss.push(t); missI.push(i); } });
  if (miss.length) {
    const r = await prov(miss, to, from || 'auto', cfg);
    det = r.from;
    r.texts.forEach((t, k) => { out[missI[k]] = t ?? miss[k]; if (t) cache.set(key(miss[k]), { t, from: r.from }); });
    if (cache.size > 5000) cache.clear();
  }
  return { texts: out, from: det };
}

// ---------- lecture du texte des images (traducteur de scans) ----------
const OCR_LANGS = { eng: 'Anglais', jpn: 'Japonais', jpn_vert: 'Japonais (vertical)', kor: 'Coréen', chi_sim: 'Chinois simplifié', chi_tra: 'Chinois traditionnel', fra: 'Français', spa: 'Espagnol', por: 'Portugais', rus: 'Russe', ara: 'Arabe' };
let ocr = null, ocrLang = '', ocrBusy = Promise.resolve();
async function ocrWorker(lang) {
  if (ocr && ocrLang === lang) return ocr;
  if (ocr) { try { await ocr.terminate(); } catch {} ocr = null; }
  const { createWorker, PSM } = require('tesseract.js');
  const dir = path.join(app.getPath('userData'), 'ocr');
  fs.mkdirSync(dir, { recursive: true });
  ocr = await createWorker(lang, 1, { langPath: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main', gzip: false, cachePath: dir });
  await ocr.setParameters({ tessedit_pageseg_mode: /vert/.test(lang) ? PSM.SINGLE_BLOCK_VERT_TEXT : PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
  ocrLang = lang;
  return ocr;
}
// regroupe les lignes proches en bulles
function groupLines(lines) {
  const items = lines.filter(l => l.text.trim() && l.confidence > 35).map(l => ({ ...l.bbox, text: l.text.trim(), h: l.bbox.y1 - l.bbox.y0 }));
  items.sort((a, b) => a.y0 - b.y0);
  const groups = [];
  for (const it of items) {
    const g = groups.find(g => {
      const gap = it.y0 - g.y1, lh = Math.max(g.lh, it.h);
      const overlap = Math.min(g.x1, it.x1) - Math.max(g.x0, it.x0);
      return gap < lh * 1.1 && gap > -lh && overlap > -lh * 0.5;
    });
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y1 = Math.max(g.y1, it.y1); g.text += ' ' + it.text; g.lh = Math.max(g.lh, it.h); }
    else groups.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, text: it.text, lh: it.h });
  }
  return groups.filter(g => /[\p{L}\p{N}]/u.test(g.text) && g.text.replace(/\s/g, '').length > 1);
}
async function readImage(buf, lang) {
  const run = async () => {
    const w = await ocrWorker(lang || 'eng');
    const r = await w.recognize(buf, {}, { blocks: true });
    const lines = [];
    for (const b of r.data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) lines.push({ text: l.text, confidence: l.confidence, bbox: l.bbox });
    return groupLines(lines);
  };
  const p = ocrBusy.then(run, run);
  ocrBusy = p.catch(() => {});
  return p;
}
function ocrDownloaded() {
  const dir = path.join(app.getPath('userData'), 'ocr');
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.traineddata')).map(f => f.replace('.traineddata', '')); } catch { return []; }
}

// ---------- Windows Hello (empreinte, visage ou code PIN) ----------
let helloOk = 0;
function windowsHello(message) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: true, unavailable: true });
  if (Date.now() - helloOk < 60000) return Promise.resolve({ ok: true });
  const msg = String(message || 'DrYAE').replace(/'/g, "''").slice(0, 200);
  const ps = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$m = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $t) { $task = $m.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$null = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]
$a = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
if ($a -ne 'Available') { Write-Output "UNAVAILABLE:$a"; exit }
$r = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('${msg}')) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
Write-Output "RESULT:$r"`;
  return new Promise(res => {
    require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true, timeout: 120000 }, (err, out) => {
      const s = String(out || '');
      if (/RESULT:Verified/.test(s)) { helloOk = Date.now(); return res({ ok: true }); }
      if (/UNAVAILABLE/.test(s) || err) return res({ ok: true, unavailable: true }); // pas de Windows Hello sur ce PC : on n'empêche rien
      res({ ok: false });
    });
  });
}

// ---------- mots de passe divulgués (service public « Pwned Passwords ») ----------
// seuls les 5 premiers caractères de l'empreinte SHA-1 sont envoyés : le mot de passe ne quitte jamais le PC
async function pwnedCount(pw) {
  const h = crypto.createHash('sha1').update(pw).digest('hex').toUpperCase();
  const r = await net.fetch('https://api.pwnedpasswords.com/range/' + h.slice(0, 5), { headers: { 'Add-Padding': 'true', 'User-Agent': 'DrYAE/' + app.getVersion() } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const line = (await r.text()).split(/\r?\n/).find(l => l.startsWith(h.slice(5)));
  return line ? parseInt(line.split(':')[1], 10) || 0 : 0;
}
// mot de passe faible : trop court, une seule sorte de caractères, suite ou mot très courant
const COMMON = new Set('123456 123456789 12345678 password azerty qwerty 111111 123123 abc123 password1 1234567 12345 000000 iloveyou 1234 soleil motdepasse doudou loulou marseille bonjour chouchou nicolas 654321 qwertyuiop azertyuiop 123321 666666 7777777 dragon monkey football baseball letmein welcome admin passw0rd sunshine princess master'.split(' '));
function weak(pw) {
  const s = String(pw || '');
  if (s.length < 8 || COMMON.has(s.toLowerCase())) return true;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter(r => r.test(s)).length;
  if (kinds < 2 && s.length < 14) return true;
  if (/^(.)\1+$/.test(s) || /^(0123456789|1234567890|abcdefgh)/i.test(s)) return true;
  return false;
}
function generatePassword(n = 16) {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '-_.!?@#%+='];
  const all = sets.join('');
  const pick = s => s[crypto.randomInt(s.length)];
  const out = sets.map(pick);
  while (out.length < n) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

module.exports = { MODULES, MOD_DEFAULT, PROVIDERS, translate, readImage, OCR_LANGS, ocrDownloaded, windowsHello, pwnedCount, weak, generatePassword };
