// Traducteur de scans : correction du texte anglais lu dans les images, avant la traduction.
// La lecture automatique confond des lettres dessinées à la main (« PIVE » pour FIVE, « NEEO » pour NEED,
// « WLL » pour WILL) et perd parfois le tiret d'un mot coupé en fin de ligne (« EXCEL » / « LENT »).
// On compare chaque mot à une liste de mots anglais (SCOWL, voir assets/dict/SCOWL-LICENSE.txt) :
// un mot inconnu est remplacé par le mot courant le plus proche, seulement avec des confusions de lettres probables.
// Les noms propres et mots inconnus sans correction sûre restent tels quels.
const fs = require('fs');
const path = require('path');

let DICT = null; // mot -> rang de fréquence (0 = très courant … 6 = rare)
const CONTR = "isn't aren't wasn't weren't don't doesn't didn't can't couldn't won't wouldn't shouldn't haven't hasn't hadn't mustn't needn't ain't i'm i've i'll i'd you're you've you'll you'd he's he'll he'd she's she'll she'd it's it'll it'd we're we've we'll we'd they're they've they'll they'd that's there's here's what's who's where's how's let's y'all";
function load() {
  if (DICT) return DICT;
  DICT = new Map();
  try {
    let tier = 0;
    for (const l of fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'dict', 'en-words.txt'), 'utf8').split('\n')) {
      if (!l) continue;
      if (l[0] === '#') { tier = { 10: 0, 20: 1, 35: 2, 40: 3, 50: 4, 55: 5, 60: 6 }[l.slice(1)] ?? 6; continue; }
      if (!DICT.has(l)) DICT.set(l, tier);
    }
  } catch {}
  for (const c of CONTR.split(' ')) DICT.set(c, 0);
  // « ISNT », « DONT » (apostrophe non lue) : retrouvés grâce à la forme sans apostrophe
  APOS = new Map(); for (const c of CONTR.split(' ')) { const s = c.replace(/'/g, ''); if (!DICT.has(s)) APOS.set(s, c); }
  return DICT;
}
let APOS = new Map();

// lettres que la lecture confond souvent dans les bulles (écriture « bande dessinée » en majuscules)
const CONF = {
  a: 'r', b: 'eor', c: 'gkoe', d: 'o', e: 'bfrc', f: 'pe', g: 'cso', h: 'nk', i: 'ltj', j: 'i', k: 'rch', l: 'iu', m: 'nw',
  n: 'mhr', o: 'dcq', p: 'fr', q: 'o', r: 'ekpa', s: 'g', t: 'il', u: 'lv', v: 'uy', w: 'mn', y: 'v', z: 's',
};
const known = w => DICT.has(w);
const rank = w => DICT.get(w);

// variantes d'un mot avec leur « coût » (substitution probable 1, lettre oubliée i/l 1, autre lettre oubliée 1.6, lettre en trop 1.4)
function edits(w) {
  const out = [];
  for (let i = 0; i < w.length; i++) {
    for (const c of CONF[w[i]] || '') out.push([w.slice(0, i) + c + w.slice(i + 1), 1]);
    if (w.length > 3) out.push([w.slice(0, i) + w.slice(i + 1), 1.4]);
  }
  for (let i = 0; i <= w.length; i++) {
    for (const c of 'il') out.push([w.slice(0, i) + c + w.slice(i), 1]);
    for (const c of 'aeouwrdt') out.push([w.slice(0, i) + c + w.slice(i), 1.6]);
  }
  return out;
}
// meilleure correction d'un mot inconnu (minuscules), ou '' s'il n'y en a pas de sûre
function correct(w) {
  if (w.length < 3 || known(w)) return '';
  if (APOS.has(w)) return APOS.get(w);
  let best = '', bc = Infinity;
  const consider = (c, cost) => { if (!known(c)) return; const s = cost + rank(c) * 0.25; if (s < bc - 1e-9) { bc = s; best = c; } };
  const e1 = edits(w);
  for (const [c, cost] of e1) consider(c, cost);
  // deux erreurs dans un mot assez long (« ALOMED » → ALLOWED, « LSEO » → USED)
  if (!best && w.length >= 4) for (const [c1, k1] of e1) { if (k1 > 1 && w.length < 6) continue; for (const [c2, k2] of edits(c1)) { if (k2 > 1 && w.length < 6) continue; consider(c2, k1 + k2); } }
  // proposition trop lointaine ou trop rare : on garde le mot (nom propre, mot inventé)
  if (!best || bc > 2.6) return '';
  return best;
}
// recopie la casse du mot lu (MAJUSCULES, Majuscule initiale, minuscules)
const likeCase = (src, w) => src === src.toUpperCase() ? w.toUpperCase() : /^\p{Lu}/u.test(src) ? w[0].toUpperCase() + w.slice(1) : w;

// part des mots reconnus : le texte est-il de l'anglais ?
function englishRatio(texts) {
  load();
  let n = 0, k = 0;
  for (const t of texts) for (const w of String(t).toLowerCase().match(/[a-z']{2,}/g) || []) { n++; if (known(w) || APOS.has(w)) k++; }
  return n ? k / n : 0;
}

// lignes d'une bulle → texte : mots coupés en fin de ligne recollés (avec ou sans tiret lu), lettres mal lues corrigées
function fixParts(parts) {
  load();
  let text = '';
  for (const raw of parts) {
    const p = String(raw).trim(); if (!p) continue;
    if (!text) { text = p; continue; }
    const a = /([\p{L}']+)([-‐‑]?)$/u.exec(text), b = /^([\p{L}']+)/u.exec(p);
    if (a && b) {
      const A = a[1].toLowerCase(), Bw = b[1].toLowerCase(), AB = A + Bw;
      // « EXCEL- » + « LENT », ou tiret non lu : « RELATION » + « SHIP », « EXCEL » + « LENT »
      if (a[2] || (known(AB) && AB.length >= 7 && (!known(A) || !known(Bw) || rank(AB) <= Math.max(rank(A), rank(Bw)) + 1))) {
        text = text.slice(0, text.length - a[0].length) + a[1] + p; continue;
      }
    }
    text += ' ' + p;
  }
  return fixWords(text);
}
function fixWords(text) {
  load();
  text = String(text).replace(/[\p{L}']+/gu, m => {
    const w = m.toLowerCase().replace(/^'+|'+$/g, '');
    if (!/^[a-z']+$/.test(w)) return m;
    // « T'S » → IT'S
    const c = correct(w) || (w.includes("'") && known('i' + w) ? 'i' + w : '');
    const core = m.replace(/^'+|'+$/g, '');
    return c ? m.replace(core, likeCase(core, c)) : m;
  });
  // lettre isolée après « WILL », « TO »… : « BE » mal lu (« YOU WILL E ENTRUSTING »)
  text = String(text).replace(/\b(will|would|can|could|should|must|might|may|to|not|won't|can't|don't)(\s+)[eb]\b(?!['’])/gi, (m, a, s) => a + s + (a === a.toUpperCase() ? 'BE' : 'be'));
  return text;
}

// mot absent du dictionnaire (probablement un nom propre)
const isName = w => { load(); const l = w.toLowerCase(); return /^[a-z]{3,}$/.test(l) && !known(l) && !APOS.has(l); };
module.exports = { isName, load, correct, fixParts, fixWords, englishRatio };
