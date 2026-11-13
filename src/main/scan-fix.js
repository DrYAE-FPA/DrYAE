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
const SPECIAL = { ts: "it's", tm: "i'm", im: "i'm", tve: "i've", ive: "i've", tll: "i'll", tid: "i'd", dint: "didn't", didnt: "didn't", cant: "can't", wont: "won't", youre: "you're", theyre: "they're", thats: "that's", whats: "what's", hes: "he's", shes: "she's", theres: "there's", heres: "here's", lts: "it's", "t's": "it's" };

// lettres que la lecture confond souvent dans les bulles (écriture « bande dessinée » en majuscules)
const CONF = {
  a: 'r', b: 'eor', c: 'gkoe', d: 'o', e: 'bfrc', f: 'pe', g: 'csob', h: 'nk', i: 'ltj', j: 'i', k: 'rch', l: 'iu', m: 'nw',
  n: 'mhr', o: 'dcq', p: 'fr', q: 'or', r: 'ekpab', s: 'g', t: 'il', u: 'lv', v: 'uy', w: 'mn', y: 'v', z: 's',
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
// mots collés (espace non lu) : « JUSTRECENTLY » → JUST RECENTLY, « IMNOT » → I'M NOT, « OURFAILURETO » → OUR FAILURE TO.
// Découpage en mots connus (un morceau peut avoir une lettre mal lue) ; le découpage le moins coûteux gagne.
const SHORT = new Set('a i of to in it is be as at so we he by or on do if me my up an go no us am oh ok'.split(' '));
function split(w) {
  if (w.length < 4) return '';
  const n = w.length, best = new Array(n + 1).fill(null); best[0] = { c: 0, fx: 0, ws: [] };
  const seg = s => {
    if (APOS.has(s)) return { w: APOS.get(s), c: 1.2 };
    if (s.length <= 2) return SHORT.has(s) ? { w: s, c: s.length === 1 ? 1.6 : 1.3 } : null;
    // mot exact : seulement un mot courant (« SUMIRE » ne devient pas « SUM IRE »)
    if (known(s) && rank(s) <= 1) return { w: s, c: 1 + rank(s) * 0.25 };
    if (s.length >= 4) { const c = correct1(s); if (c) return { w: c.w, c: 1.8 + c.c, fix: true }; }
    return null;
  };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    for (let j = i + 1; j <= Math.min(n, i + 16); j++) {
      const s = seg(w.slice(i, j)); if (!s) continue;
      const c = best[i].c + s.c;
      const fx = best[i].fx + (s.fix ? 1 : 0); if (fx > 1) continue;
      if (!best[j] || c < best[j].c) best[j] = { c, fx, ws: [...best[i].ws, s.w] };
    }
  }
  const r = best[n];
  // découpage douteux (« KAITANI » → KIT AN I, « YOUKA » → YOUR A) : morceaux trop courts en moyenne,
  // ou une lettre corrigée à côté d'un tout petit mot → on laisse le mot tel quel (souvent un nom)
  if (!r || r.ws.length < 2 || r.ws.length > 4 || r.c > r.ws.length * 2) return '';
  const tiny = r.ws.filter(x => x.replace(/'/g, '').length === 1).length;
  if (w.length / r.ws.length < 2.6 && !(r.ws.length === 2 && !tiny && !r.fx)) return '';
  if (r.fx && (tiny || r.ws.some(x => x.length <= 2 && !SHORT.has(x)))) return '';
  return r.ws.join(' ');
}
// une seule erreur de lettre (sert au découpage des mots collés)
function correct1(w) {
  let best = null;
  for (const [c, cost] of edits(w)) {
    if (APOS.has(c)) { const s = cost + 0.2; if (!best || s < best.c) best = { w: APOS.get(c), c: s }; continue; }
    if (!known(c) || rank(c) > 4) continue; const s = cost + rank(c) * 0.25; if (!best || s < best.c) best = { w: c, c: s };
  }
  return best && best.c <= 1.8 ? best : null;
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
    let w = m.toLowerCase().replace(/^'+|'+$/g, '');
    if (!/^[a-z']+$/.test(w)) return m;
    // apostrophe ou « I » non lus dans les formes courtes : « TS » → IT'S, « TVE » → I'VE, « DINT » → DIDN'T
    if (SPECIAL[w]) { const core = m.replace(/^'+|'+$/g, ''); return m.replace(core, likeCase(core, SPECIAL[w])); }
    // « EVERYTHINE'S » : on corrige le mot, le « 'S » reste
    const ps = /^([a-z]{4,})'s$/.exec(w);
    if (ps && !known(ps[1]) && !APOS.has(w)) { const c = correct1(ps[1]) || (correct(ps[1]) ? { w: correct(ps[1]) } : null); if (c) { const core = m.replace(/['’]s$/i, ''); return likeCase(core, c.w) + m.slice(core.length); } return m; }
    // « T'S » → IT'S
    // mot inconnu : d'abord une lettre mal lue toute simple, sinon des mots collés, sinon une correction plus large
    const c1 = known(w) || APOS.has(w) ? null : correct1(w);
    const c = (c1 && c1.c <= 1.25 ? c1.w : '') || split(w) || correct(w) || (w.includes("'") && known('i' + w) ? 'i' + w : '');
    const core = m.replace(/^'+|'+$/g, '');
    return c ? m.replace(core, likeCase(core, c)) : m;
  });
  // lettre isolée après « WILL », « TO »… : « BE » mal lu (« YOU WILL E ENTRUSTING »)
  text = String(text).replace(/\b(will|would|can|could|should|must|might|may|to|not|won't|can't|don't)(\s+)[eb]\b(?!['’])/gi, (m, a, s) => a + s + (a === a.toUpperCase() ? 'BE' : 'be'));
  return text;
}

// mot japonais écrit en lettres latines (noms : KANAKA, HIGASHINA, TSUKUMOGAMI) : syllabes consonne + voyelle
const ROMAJI = /^(?:(?:ts|sh|ch|[kgsztdnhbpmyrwfj])?y?[aeiou]|n)+$/i;
// mot plausible : anglais (corrigé ou non) ou nom japonais
const plausible = w => { load(); const l = w.toLowerCase(); return known(l) || APOS.has(l) || !!SPECIAL[l] || ROMAJI.test(l); };
// mot absent du dictionnaire (probablement un nom propre)
const isName = w => { load(); const l = w.toLowerCase(); return /^[a-z]{3,}$/.test(l) && !known(l) && !APOS.has(l); };

// --- noms de la série, appris en lisant (par site) ---
// distance entre deux mots (lettres ajoutées, enlevées ou changées)
function dist(a, b) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
const nameWords = t => (String(t).match(/[\p{L}]{4,}/gu) || []).filter(w => { const l = w.toLowerCase(); load(); return /^[a-z]+$/.test(l) && !known(l) && !APOS.has(l) && !SPECIAL[l]; });
// retient les noms vus sur cette page (une fois par page), garde les 400 plus fréquents
function learnNames(texts, names) {
  const seen = new Set(texts.flatMap(nameWords).map(w => w.toUpperCase()));
  for (const w of seen) names[w] = (names[w] || 0) + 1;
  const ks = Object.keys(names); if (ks.length > 400) ks.sort((a, b) => names[a] - names[b]).slice(0, ks.length - 400).forEach(k => delete names[k]);
}
// un mot inconnu rare, très proche d'un nom déjà bien lu souvent, est remplacé par ce nom
function fixNames(text, names) {
  if (!names) return text;
  const ks = Object.keys(names).filter(k => names[k] >= 3);
  if (!ks.length) return text;
  return String(text).replace(/[\p{L}]{4,}/gu, m => {
    const U = m.toUpperCase(), l = m.toLowerCase(); load();
    if (!/^[a-z]+$/.test(l) || known(l) || (names[U] || 0) >= 3) return m;
    let best = '', bd = 9;
    for (const k of ks) { const d = dist(U, k); if (d < bd && names[k] >= Math.max(3, (names[U] || 0) * 3)) { bd = d; best = k; } }
    const lim = U.length >= 8 ? 2 : 1;
    return best && bd <= lim ? (m === U ? best : best[0] + best.slice(1).toLowerCase()) : m;
  });
}
module.exports = { learnNames, fixNames, plausible, ROMAJI, isName, load, correct, fixParts, fixWords, englishRatio };
