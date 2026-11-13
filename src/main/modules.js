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
let UA = '';
function setUserAgent(ua) { if (ua) UA = ua; }
async function fetchJson(url, opts = {}) {
  let r;
  try { r = await net.fetch(url, { ...opts, headers: { 'User-Agent': UA || 'DrYAE/' + app.getVersion(), ...(opts.headers || {}) } }); }
  catch { throw new Error('pas de connexion au service de traduction'); }
  if (r.status === 429) throw new Error('trop de demandes, réessayez dans une minute');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
// Google : un appel par lot de lignes (séparées par des retours à la ligne)
async function googleBatch(lines, to, from = 'auto') {
  const q = lines.map(s => s.replace(/\n+/g, ' ')).join('\n');
  const base = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}`;
  let j;
  // texte court : requête simple ; texte long (ou échec) : envoi du texte dans le corps de la requête
  try {
    if (q.length > 1500) throw 0;
    j = await fetchJson(base + '&q=' + encodeURIComponent(q));
  } catch (e) {
    if (e && /trop de demandes/.test(e.message)) throw e;
    j = await fetchJson(base, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'q=' + encodeURIComponent(q) });
  }
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

// ---------- traducteur de scans : préparation du texte lu ----------
// Bulles écrites en MAJUSCULES : les petites lettres lues par erreur (« YOue », « GuT ») sont remises en majuscules ;
// pour la traduction, le texte passe en minuscules « normales » (les traducteurs comprennent mal les majuscules).
const capsOf = s => { const L = s.match(/\p{L}/gu) || []; return L.length >= 3 && L.filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length / L.length > 0.7; };
function cleanScan(s) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/(\p{L})\s*\.\s*\.(?!\.)/gu, '$1...').replace(/\.{4,}/g, '...').replace(/\s+([,.!?…])/g, '$1')
    // « CADETS.IN » → « CADETS. IN » ; « .EXORCISTS » (points de suspension mal lus) → « ...EXORCISTS »
    .replace(/(\p{L}{2})([.,!?])(\p{L}{2})/gu, '$1$2 $3').replace(/^[.·]\s*(?=\p{L})/u, '...');
  const caps = capsOf(t);
  if (caps) t = t.toUpperCase();
  return { text: t, caps };
}
function forMT(s, caps, lang) {
  if (!caps) return s;
  let t = s.toLowerCase();
  // majuscule en début de phrase ; « i » anglais
  t = t.replace(/(^|[.!?…]\s+|["«“]\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b(?=['’\s,.!?]|$)/g, 'I');
  // mots inconnus du dictionaire anglais (noms des personnages, des lieux) : gardés avec une majuscule,
  // pour que le traducteur ne les traduise pas comme des mots ordinaires
  if (lang === 'en') try { const SF = require('./scan-fix'); SF.load(); t = t.replace(/\b\p{Ll}[\p{L}]{2,}\b/gu, w => SF.isName(w) ? w[0].toUpperCase() + w.slice(1) : w); } catch {}
  return t;
}

// ---------- traducteur de scans : traduction par IA (facultative, clé personnelle Gemini) ----------
// L'image et le texte lu partent chez Google (Gemini) ; l'IA corrige la lecture et traduit en tenant compte de l'histoire.
// En cas d'erreur (limite gratuite du jour atteinte, pas de connexion…), l'appelant revient à la traduction habituelle.
const LANG_NAMES = { fr: 'French', en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German', it: 'Italian', ru: 'Russian', ar: 'Arabic', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese', tr: 'Turkish', pl: 'Polish', vi: 'Vietnamese', id: 'Indonesian', th: 'Thai', hi: 'Hindi', nl: 'Dutch', uk: 'Ukrainian' };
async function aiScan(image, mime, texts, to, cfg) {
  const key = String(cfg.key || '').trim();
  if (!key) throw new Error('clé IA manquante');
  const model = String(cfg.model || 'gemini-flash-latest').replace(/[^\w.-]/g, '');
  const base = String(cfg.url || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const lang = LANG_NAMES[to] || to;
  const list = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const prompt = `This image is a page of a manga, manhwa or comic. Below are its ${texts.length} text bubbles in reading order, as read by an OCR program (it can make reading mistakes).
For each bubble, using the image: fix the OCR mistakes, then translate it into ${lang}. The translation must be natural and fit the conversation and the characters (casual or polite speech as in the original), short enough to fit in the bubble. Keep character names as they are. Do not add explanations.
Answer only with JSON: {"source_language": "<ISO 639-1 code>", "items": [{"i": 1, "text": "<corrected original>", "tr": "<translation>"}, ...]} with exactly ${texts.length} items, in the same order.

${list}`;
  let r;
  try {
    r = await net.fetch(`${base}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: Buffer.from(image).toString('base64') } }, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } }) });
  } catch { throw new Error('pas de connexion au service IA'); }
  if (r.status === 429) { const e = new Error('limite gratuite du jour atteinte'); e.quota = true; throw e; }
  if (r.status === 400 || r.status === 401 || r.status === 403) { const e = new Error('clé IA refusée'); e.badKey = true; throw e; }
  if (!r.ok) throw new Error('service IA : HTTP ' + r.status);
  const j = await r.json();
  const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  let o; try { o = JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('réponse IA illisible'); }
  const items = Array.isArray(o.items) ? o.items : [];
  if (items.length !== texts.length) throw new Error('réponse IA incomplète');
  return { texts: items.map(x => String(x.tr || '')), fixed: items.map((x, i) => String(x.text || texts[i])), from: String(o.source_language || '').toLowerCase().slice(0, 5) };
}

// ---------- lecture du texte des images (traducteur de scans) ----------
// lues par le modèle multilingue (paddle-ocr.js) ; les autres par Tesseract
const PADDLE_LANGS = ['auto', 'eng', 'fra', 'spa', 'por', 'deu', 'ita', 'jpn', 'jpn_vert', 'chi_sim', 'chi_tra', 'chi_sim_vert', 'chi_tra_vert'];
const OCR_LANGS = { auto: 'Automatique (recommandé)', eng: 'Anglais', jpn: 'Japonais', jpn_vert: 'Japonais (vertical)', kor: 'Coréen', kor_vert: 'Coréen (vertical)', chi_sim: 'Chinois simplifié', chi_sim_vert: 'Chinois simplifié (vertical)', chi_tra: 'Chinois traditionnel', chi_tra_vert: 'Chinois traditionnel (vertical)', vie: 'Vietnamien', tha: 'Thaï', ind: 'Indonésien', fra: 'Français', spa: 'Espagnol', por: 'Portugais', deu: 'Allemand', ita: 'Italien', tur: 'Turc', pol: 'Polonais', rus: 'Russe', ukr: 'Ukrainien', ara: 'Arabe', hin: 'Hindi' };
let ocr = null, ocrLang = '', ocrBusy = Promise.resolve();
async function ocrWorker(lang) {
  if (ocr && ocrLang === lang) return ocr;
  if (ocr) { try { await ocr.terminate(); } catch {} ocr = null; }
  const { createWorker, PSM } = require('tesseract.js');
  const dir = path.join(app.getPath('userData'), 'ocr');
  fs.mkdirSync(dir, { recursive: true });
  ocr = await createWorker(lang, 1, { langPath: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main', gzip: false, cachePath: dir });
  // texte vertical (japonais, coréen, chinois) : lecture en colonnes ; sinon texte épars (bulles)
  await ocr.setParameters({ tessedit_pageseg_mode: /vert/.test(lang) ? PSM.SINGLE_BLOCK_VERT_TEXT : PSM.SPARSE_TEXT, preserve_interword_spaces: /^(jpn|chi|tha)/.test(lang) ? '0' : '1' });
  ocrLang = lang;
  return ocr;
}
// regroupe les lignes proches en bulles (texte horizontal) ou les colonnes proches (texte vertical)
function groupLines(lines, vertical, cjk) {
  const items = lines.filter(l => l.text.trim() && l.confidence > 35).map(l => ({ ...l.bbox, text: l.text.trim(), h: l.bbox.y1 - l.bbox.y0, w: l.bbox.x1 - l.bbox.x0 }));
  const join = (a, b) => (cjk ? a + b : a + ' ' + b).replace(/\s+/g, cjk ? '' : ' ');
  const groups = [];
  if (vertical) {
    // colonnes lues de droite à gauche
    items.sort((a, b) => b.x1 - a.x1);
    for (const it of items) {
      const g = groups.find(g => { const gap = g.x0 - it.x1, cw = Math.max(g.cw, it.w); const ov = Math.min(g.y1, it.y1) - Math.max(g.y0, it.y0); return gap < cw * 1.2 && gap > -cw && ov > -cw; });
      if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y0 = Math.min(g.y0, it.y0); g.y1 = Math.max(g.y1, it.y1); g.text = join(g.text, it.text); g.cw = Math.max(g.cw, it.w); }
      else groups.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, text: it.text, cw: it.w });
    }
  } else {
    items.sort((a, b) => a.y0 - b.y0);
    for (const it of items) {
      const g = groups.find(g => {
        const gap = it.y0 - g.y1, lh = Math.max(g.lh, it.h);
        const overlap = Math.min(g.x1, it.x1) - Math.max(g.x0, it.x0);
        return gap < lh * 1.1 && gap > -lh && overlap > -lh * 0.5;
      });
      if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y1 = Math.max(g.y1, it.y1); g.text = join(g.text, it.text); g.lh = Math.max(g.lh, it.h); }
      else groups.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, text: it.text, lh: it.h });
    }
  }
  return groups.filter(g => /[\p{L}\p{N}]/u.test(g.text) && g.text.replace(/\s/g, '').length > 1).map(({ x0, y0, x1, y1, text }) => ({ x0, y0, x1, y1, text, vertical: !!vertical }));
}
async function readImage(buf, lang) {
  const run = async () => {
    const w = await ocrWorker(lang || 'eng');
    const r = await w.recognize(buf, {}, { blocks: true });
    const lines = [];
    for (const b of r.data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) lines.push({ text: l.text, confidence: l.confidence, bbox: l.bbox });
    const L = String(lang || 'eng');
    return groupLines(lines, /vert/.test(L), /^(jpn|chi|kor_vert|tha)/.test(L));
  };
  const p = ocrBusy.then(run, run);
  ocrBusy = p.catch(() => {});
  return p;
}
// relit des zones précises (bulles déjà trouvées) avec Tesseract : sert aux langues dont le modèle multilingue
// ne connaît pas tous les signes (vietnamien, coréen, thaï, cyrillique…)
async function readRegions(buf, lang, rects) {
  const run = async () => {
    const w = await ocrWorker(lang);
    const { PSM } = require('tesseract.js');
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const out = [];
    try {
      for (const r of rects) {
        try {
          const res = await w.recognize(buf, { rectangle: { left: Math.max(0, Math.round(r.x0)), top: Math.max(0, Math.round(r.y0)), width: Math.max(4, Math.round(r.x1 - r.x0)), height: Math.max(4, Math.round(r.y1 - r.y0)) } });
          const t = String(res.data.text || '').replace(/\s+/g, ' ').trim();
          out.push(res.data.confidence >= 40 && /\p{L}{2}/u.test(t) ? t : '');
        } catch { out.push(''); }
      }
    } finally { try { await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }); } catch {} }
    return out;
  };
  const p = ocrBusy.then(run, run);
  ocrBusy = p.catch(() => {});
  return p;
}
// langue reconnue par le service de traduction → données de lecture plus précises pour cette langue
const OCR_FIX = { vi: 'vie', ko: 'kor', th: 'tha', ru: 'rus', uk: 'ukr', bg: 'bul', ar: 'ara', fa: 'fas', hi: 'hin', pl: 'pol', tr: 'tur', cs: 'ces', ro: 'ron', hu: 'hun', el: 'ell', he: 'heb', id: 'ind' };
function ocrDownloaded() {
  return [...PADDLE_LANGS, ...ocrFiles()];
}
function ocrFiles() {
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


// cris et onomatopées seuls dans une bulle (AHHH, HEHE, FUFU, HMM, GRRR…) : gardés tels quels, pas traduits
const INTERJ = /^(?:a+h*|o+h*|e+h+|u+h+|h+m+|hu+h+|he+h+|(?:he)+h*|(?:ha)+h*|(?:hi)+|(?:fu)+|(?:ku)+|u?fu+|gr+|tch|ts+k|pf+t?|phew|u+g+h+|a+r+g+h+|e+k|ky+a+|n+|m+|wh?oa+|w+o+w+|a+h*a+|a?(?:ha)+h?|y+a+y*|ya+h+o+|z+|u+m+|e+r+m*|hm+ph|o+p+s+)$/i;
// 1.7.0 : cri fait de une ou deux lettres répétées (HEHEHE, HAAAA, HMMM, OHHH, UFUFU, Haaaa…) ou cri connu (KYAAA, NYAA, EHE)
const INTERJ2 = /^(?:k?ya+h*|gya+|nya+|wa+h*|ba+h*|mu+h*|nu+|fu+n|hu+n|e?he+h*e*|eh+e+|ehe|kya+h*)$/i;
function interjWord(w) {
  if (INTERJ.test(w) || INTERJ2.test(w)) return true;
  const l = w.toLowerCase();
  if (l.length < 3 || !/^[a-zà-ÿ]+$/.test(l)) return false;
  // motif répété (HEHEHE, UFUFU, HAHAHA) ou lettre triplée (HAAAA, HMMM, OHHH), sans être un vrai mot (MAMA, COCO, SEE)
  const rep = /^(.{1,2})\1+.?$/.test(l) || /(.)\1\1/.test(l);
  if (!rep) return false;
  try { const SF = require('./scan-fix'); if (!/(.)\1\1/.test(l) && (SF.load().has(l) || SF.frKnown(l))) return false; } catch {}
  return true;
}
function interjection(t) {
  const ws = String(t || '').match(/\p{L}+/gu) || [];
  return ws.length > 0 && ws.length <= 6 && ws.every(w => interjWord(w));
}

// 1.7.0 : cris et noms protégés à l'intérieur d'une phrase : remplacés par des marques [1], [2]… que le traducteur
// recopie telles quelles, puis remis à leur place. Noms : forme d'un nom japonais (KA-NA-KA) ou liste « Ne jamais traduire ».
function protect(text, lang, never) {
  const keep = [];
  let SF = null; try { SF = require('./scan-fix'); } catch {}
  const isWord = w => { if (!SF) return true; const l = w.toLowerCase(); return lang === 'fr' ? SF.frKnown(l) : SF.isName ? !SF.isName(l) && l.length >= 3 ? true : !SF.isName(l) : true; };
  let t = String(text);
  // expressions « Ne jamais traduire » (plusieurs mots possibles), les plus longues d'abord
  for (const n of (never || []).filter(Boolean).sort((a, b) => b.length - a.length)) {
    const re = new RegExp('(^|[^\\p{L}])(' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}])', 'giu');
    t = t.replace(re, (m, a, b) => { keep.push(b); return a + '[' + keep.length + ']'; });
  }
  t = t.replace(/[\p{L}][\p{L}'’-]*/gu, w => {
    const core = w.replace(/['’]s$/i, ''), rest = w.slice(core.length);
    const parts = core.split('-');
    const interj = core.length >= 3 && parts.every(x => x.length >= 2 && interjWord(x));
    const name = !interj && SF && core.length >= 4 && parts.every(x => x.length >= 2 && SF.ROMAJI.test(x)) && parts.some(x => !isWord(x));
    if (!interj && !name) return w;
    // un texte fait seulement de cris est déjà gardé en entier ailleurs
    keep.push(core); return '[' + keep.length + ']' + rest;
  });
  return { t, keep };
}
function unprotect(t, keep) {
  if (!keep || !keep.length) return t;
  return String(t).replace(/[[［]\s*(\d+)\s*[\]］]/g, (m, k) => keep[+k - 1] != null ? keep[+k - 1] : m);
}
module.exports = { protect, unprotect, interjWord, interjection, cleanScan, forMT, aiScan, MODULES, MOD_DEFAULT, PROVIDERS, PADDLE_LANGS, OCR_FIX, readRegions, translate, setUserAgent, readImage, OCR_LANGS, ocrDownloaded, windowsHello, pwnedCount, weak, generatePassword };
