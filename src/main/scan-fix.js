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
  // mots courants absents des listes américaines
  for (const w of 'axe axes colour honour favour armour grey okay barkeep gosh darn'.split(' ')) if (!DICT.has(w)) DICT.set(w, 1);
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
    // deux lettres lues pour une (« MLICH » → MUCH, « RN » pour M, « CL » pour D)
    const p2 = { li: 'u', ii: 'u', rn: 'm', cl: 'd', vv: 'w', iu: 'm' }[w.slice(i, i + 2)]; if (p2) out.push([w.slice(0, i) + p2 + w.slice(i + 2), 0.9]);
    if (w.length > 3) out.push([w.slice(0, i) + w.slice(i + 1), 1.4]);
  }
  // mot de 3 lettres avec une voyelle (« AXE », « REA ») : pas de lettre ajoutée (seulement « WLL » → WILL, « WTH » → WITH)
  if (w.length <= 3 && /[aeiouy]/.test(w)) return out;
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
    if (known(s) && (rank(s) <= 1 || (s.length >= 6 && rank(s) <= 3))) return { w: s, c: 1 + rank(s) * 0.25 };
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
  text = digitWords(halfwidth(text), w => known(w), w => rank(w));
  const mixed = /\p{Ll}{3,}/u.test(text);
  text = String(text).replace(/[\p{L}']+/gu, (m, off, all) => {
    let w = m.toLowerCase().replace(/^'+|'+$/g, '');
    // texte en minuscules : un mot à majuscule au milieu d'une phrase est un nom propre (« Rea », « Chaosah ») : pas touché
    if (mixed && /^\p{Lu}\p{Ll}+$/u.test(m) && off > 0 && !/[.!?…:"“«]\s*$/.test(all.slice(Math.max(0, off - 3), off)) && !known(w)) return m;
    if (!/^[a-z']+$/.test(w)) return m;
    if (!known(w) && !APOS.has(w) && !SPECIAL[w] && /l/.test(w)) { const u = lToU(w, x => known(x), x => rank(x), w.length <= 2 ? 0 : 3); if (u) { const core = m.replace(/^'+|'+$/g, ''); return m.replace(core, likeCase(core, u)); } }
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

// ponctuation « pleine largeur » (！？，) lue par le modèle multilingue dans un texte latin
function halfwidth(s) { return String(s).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' '); }


// ---- 1.7.0 : U lu comme L, même plusieurs fois dans un mot (« NOLS » → NOUS, « LP » → UP, « KAZLYA » → KAZUYA) ----
function lToU(w, isWord, rankOf, maxRank) {
  const ix = []; for (let i = 0; i < w.length; i++) if (w[i] === 'l') ix.push(i);
  if (!ix.length || ix.length > 5) return '';
  let best = '', br = 99;
  for (let mask = 1; mask < (1 << ix.length); mask++) {
    const a = [...w]; ix.forEach((p, j) => { if (mask & (1 << j)) a[p] = 'u'; });
    const s = a.join('');
    if (isWord(s)) { const r = rankOf(s); if (r < br) { br = r; best = s; } }
  }
  if (best && br <= maxRank) return best;
  // nom japonais : « KAZLYA » n'en a pas la forme, « KAZUYA » oui
  if (w.length >= 4 && !ROMAJI.test(w)) for (let mask = 1; mask < (1 << ix.length); mask++) {
    const a = [...w]; ix.forEach((p, j) => { if (mask & (1 << j)) a[p] = 'u'; });
    const s = a.join(''); if (ROMAJI.test(s)) return s;
  }
  return '';
}
// ---- 1.7.0 : chiffres lus à la place des lettres (« GO » lu « 60 », « GOD » lu « 600 », « GOOD » lu « 6OOD ») ----
const DIG = { 0: 'od', 1: 'il', 2: 'z', 3: 'e', 4: 'a', 5: 's', 6: 'gb', 8: 'b', 9: 'g' };
// mots qui montrent qu'un nombre est un vrai nombre (« 60 ANS », « 600 YEN »)
const NUMCTX = /^(years?|yrs?|yen|dollars?|euros?|francs?|fcfa|cfa|%|times|people|persons?|men|women|meters?|metres?|km|kg|g|cm|mm|m|minutes?|mins?|seconds?|secs?|hours?|hrs?|days?|weeks?|months?|points?|pts|degrees?|ans?|années?|fois|personnes?|mètres?|secondes?|heures?|jours?|semaines?|mois|h|x|th|st|nd|rd|e|ème|er|ère)$/i;
function digitWords(text, isWord, rankOf) {
  if (!/\d/.test(text)) return text;
  const toks = String(text).split(/(\s+)/);
  for (let i = 0; i < toks.length; i++) {
    const m = /^([^\p{L}\d]*)([\p{L}\d]+)([^\p{L}\d]*)$/u.exec(toks[i]); if (!m || !/\d/.test(m[2])) continue;
    const core = m[2], pure = /^\d+$/.test(core);
    if (core.length < 2 || core.length > 9) continue;
    // nombre suivi d'une unité, d'un mot comme « ANS », ou précédé d'un autre nombre : c'est un vrai nombre
    const next = (toks[i + 2] || '').replace(/[^\p{L}%]/gu, ''), prev = (toks[i - 2] || '');
    if (pure && (NUMCTX.test(next) || /\d/.test(prev) || /[.,:]\d/.test(toks[i]) || /^\d{4}$/.test(core) && +core > 1000 && +core < 2100)) continue;
    // le reste du texte doit être en majuscules (lettrage de bulle), sinon on ne touche pas aux nombres
    if (pure && /\p{Ll}/u.test(text)) continue;
    let opts = [''];
    for (const ch of core.toLowerCase()) { const alt = /\d/.test(ch) ? (DIG[ch] || '') : ch; if (!alt) { opts = []; break; } opts = opts.flatMap(o => [...alt].map(a => o + a)); if (opts.length > 64) break; }
    let best = '', br = 99;
    for (const o of opts) if (isWord(o)) { const r = rankOf(o); if (r < br) { br = r; best = o; } }
    // nombre seul : seulement vers un mot très courant (« 60 » → GO, « 600 » → GOD, mais « 100 » reste 100)
    if (best && (!pure || br <= 1)) toks[i] = m[1] + best.toUpperCase() + m[3];
  }
  return toks.join('');
}
// ===================== français =====================
// Liste de mots français (an-array-of-french-words, MIT, voir assets/dict/FR-WORDS-LICENSE.txt), chargée seulement
// pour une page en français. Pas de fréquences dans cette liste : les mots les plus courants sont donnés ici à la main.
const FR_TOP = ("à a au aux avec avoir ai as avez avons ont alors aussi autre autres avant après assez ah allez allons aller aime aimes " +
  "bien bon bonne beaucoup bas besoin bientôt " +
  "ça ce ces cet cette c'est ceux celui celle chez comme comment contre cœur coup crois croit " +
  "dans de des du deux dit dis dire donc dont depuis déjà devant doit dois " +
  "elle elles en encore entre es est et été êtes être eu " +
  "faire fais fait faut fois fin fort " +
  "grand grande gens " +
  "hein hé ici il ils " +
  "je jamais jour jusqu juste " +
  "la le les leur leurs lui là " +
  "ma mais me même merci mes mieux moi mon monde mort moins " +
  "ne ni non nos notre nous nouveau nouvelle " +
  "on ont ou où oui " +
  "par parce pas peu peut peux plus pour pourquoi pouvoir premier près puis puisque " +
  "qu que quel quelle quelque quoi qui quand " +
  "rien " +
  "sa sans se sera ses si sois soit son sont sous suis sur sûr " +
  "ta te tes toi ton tous tout toute toutes très trop tu " +
  "un une vais va vas veux veut vie viens voilà voir vos votre vous vrai vraiment").split(' ');
let FR = null, FRK = null, FRT = null;
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
function loadFr() {
  if (FR) return FR;
  FR = new Set(); FRK = new Map(); FRT = new Set(FR_TOP.map(strip));
  try {
    for (const w of fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'dict', 'fr-words.txt'), 'utf8').split('\n')) {
      if (!w) continue; FR.add(w); const k = strip(w); if (!FRK.has(k)) FRK.set(k, w);
    }
  } catch {}
  for (const w of FR_TOP) { FR.add(w); const k = strip(w); if (!FRK.has(k) || FRT.has(k)) FRK.set(k, w); }
  return FR;
}
// mot français connu, avec ou sans accents (les lettrages en majuscules oublient souvent les accents)
const frKnown = w => { loadFr(); return FRK.has(strip(w.toLowerCase())); };
// confusions de lettres fréquentes dans les lettrages français : U lu L, O lu Q, I lu L, À lu Δ
const FR_CONF = { l: 'ui', q: 'o', i: 'l', o: 'q', u: 'l', e: 'c', c: 'e', n: 'u', h: 'n', m: 'n', d: 'c' };
function frCorrect(w) {
  const k = strip(w.toLowerCase());
  if (k.length < 2) return '';
  const cands = [];
  // une ou deux confusions de lettres
  // deux lettres lues pour une (« LI » pour U, « RN » pour M, « CL » pour D)
  const PAIRS = { li: 'u', ll: 'u', rn: 'm', cl: 'd', vv: 'w', ii: 'u' };
  const step = s => { const o = []; for (let i = 0; i < s.length; i++) { for (const c of FR_CONF[s[i]] || '') o.push(s.slice(0, i) + c + s.slice(i + 1)); const p2 = PAIRS[s.slice(i, i + 2)]; if (p2) o.push(s.slice(0, i) + p2 + s.slice(i + 2)); } return o; };
  const e1 = step(k);
  for (const c of e1) if (FRK.has(c)) cands.push([c, (FRT.has(c) ? 0 : 1) + (c.length !== k.length ? 0.5 : 0)]);
  // lettre doublée par erreur (« ILLS » → ILS)
  if (!cands.length) for (let i = 1; i < k.length; i++) if (k[i] === k[i - 1]) { const s = k.slice(0, i) + k.slice(i + 1); if (FRK.has(s)) cands.push([s, FRT.has(s) ? 0.5 : 1.5]); }
  // lettre fine lue en trop (« UINE » → UNE, « VOIUS » → VOUS)
  if (k.length >= 4 && !FRK.has(k)) for (let i = 0; i < k.length; i++) if ('il'.includes(k[i])) { const s = k.slice(0, i) + k.slice(i + 1); if (FRK.has(s)) cands.push([s, FRT.has(s) ? 0.5 : 1.5]); }
  // lettre oubliée (« M'NVITER » → M'INVITER)
  if (!cands.length && k.length >= 5) for (let i = 0; i < k.length; i++) for (const c of 'iuel') { const s = k.slice(0, i) + c + k.slice(i); if (FRK.has(s)) cands.push([s, FRT.has(s) ? 1 : 2]); }
  if (!cands.length && k.length >= 5) for (const c1 of e1) for (const c2 of step(c1)) if (FRK.has(c2)) cands.push([c2, FRT.has(c2) ? 1 : 2]);
  if (!cands.length) return '';
  cands.sort((a, b) => a[1] - b[1]);
  // mot court (noms coréens ou japonais : « JU-HEE ») : seulement vers un mot très courant (« QLE » → QUE)
  if (k.length <= 3 && !FRT.has(cands[0][0])) return '';
  // plusieurs propositions également probables : on ne choisit pas au hasard
  if (cands.length > 1 && cands[1][1] === cands[0][1] && cands[1][0] !== cands[0][0]) return '';
  return FRK.get(cands[0][0]);
}
// part des mots français reconnus : le texte est-il du français ?
function frenchRatio(texts) {
  loadFr(); let n = 0, k = 0;
  for (const t of texts) for (const w of String(t).toLowerCase().match(/[\p{L}']{2,}/gu) || []) { n++; if (frKnown(w.replace(/^[a-z]'/, ''))) k++; }
  return n ? k / n : 0;
}
const PRON = new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi', 'lui', 'le', 'la', 'les', 'en', 'y']);
// mots collés : « TIENSA » → TIENS À, « DISTU » → DIS-TU, « MORDSMOI » → MORDS-MOI
function frSplit(k) {
  for (let i = k.length - 1; i >= 2; i--) {
    const a = k.slice(0, i), b = k.slice(i);
    if (!FRK.has(a)) continue;
    if (PRON.has(b) && i >= 3) return FRK.get(a) + '-' + b;
    if (b === 'a' && a.length >= 3) return FRK.get(a) + ' à';
    if (FRT.has(b) && FRT.has(a) && b.length >= 2) return FRK.get(a) + ' ' + FRK.get(b);
  }
  // « AFORCE » → À FORCE
  if (k[0] === 'a' && k.length >= 5 && FRK.has(k.slice(1))) return 'à ' + FRK.get(k.slice(1));
  return frSplitN(k);
}
// 1.7.0 : mots collés plus généraux (« JESUIS » → JE SUIS, « TROUVECA » → TROUVE ÇA, « SIURGEMMENT » → SI URGEMMENT,
// « SEUUEMENTUN » → SEULEMENT UN) : 2 ou 3 morceaux, chacun courant ou assez long ; un morceau peut avoir une lettre mal lue
const okPart = p => FRK.has(p) && (FRT.has(p) || p.length >= 4);
function partFix(p) { if (okPart(p)) return [FRK.get(p), 0]; if (p.length >= 5) { const c = frCorrect(p); if (c) return [c, 1]; } return null; }
function frSplitN(k) {
  if (k.length < 5 || k.length > 30) return '';
  let best = null;
  const take = (parts, cost) => { if (!parts.some(x => x.length <= 3 && FRT.has(strip(x.toLowerCase())))) return; const sc = cost * 1.5 + parts.length - parts.filter(x => FRT.has(strip(x))).length * 0.6; if (!best || sc < best[1]) best = [parts, sc]; };
  for (let i = 2; i <= k.length - 2; i++) {
    const a = partFix(k.slice(0, i)); if (!a) continue;
    const b = partFix(k.slice(i)); if (b) take([a[0], b[0]], a[1] + b[1]);
    for (let j = i + 2; j <= k.length - 2; j++) {
      const b2 = partFix(k.slice(i, j)), c2 = b2 && partFix(k.slice(j));
      if (b2 && c2 && FRT.has(strip(b2[0])) + FRT.has(strip(c2[0])) + FRT.has(strip(a[0])) >= 2) take([a[0], b2[0], c2[0]], a[1] + b2[1] + c2[1] + 0.2);
    }
  }
  if (!best) return '';
  const common = best[0].every(x => FRT.has(strip(x.toLowerCase())));
  if (best[1] > (common ? 4 : 3)) return '';
  const P = best[0];
  // verbe + pronom (« DISTU » → DIS-TU), sauf après une conjonction (« MAISTU » → MAIS TU)
  if (P.length === 2 && PRON.has(strip(P[1].toLowerCase())) && P[0].length >= 3 && !['mais', 'et', 'si', 'que', 'quand', 'comme', 'alors', 'donc', 'car', 'ou', 'puis', 'pour', 'avec', 'sans', 'chez', 'dans'].includes(strip(P[0].toLowerCase()))) return P[0] + '-' + P[1];
  return P.join(' ').replace(/\best ce\b/i, m => m.replace(' ', '-'));
}
// apostrophe oubliée ou mot collé devant l'apostrophe : « QUETAIT » → QU'ÉTAIT, « CEST » → C'EST, « AL'ACCUEIL » → À L'ACCUEIL,
// « ILN'AVAIT » → IL N'AVAIT, « JEM'ENTRAINAIS » → JE M'ENTRAÎNAIS
const ELID = ['qu', 'c', 'j', 'l', 'd', 'n', 's', 'm', 't'];
function frApos(text) {
  return String(text).replace(/[\p{L}]+(?:['’][\p{L}]+)*/gu, m => {
    const parts = m.split(/(['’])/);
    if (parts.length >= 3) {
      const h = parts[0], k = strip(h.toLowerCase());
      if (k.length >= 2 && !['qu', 'jusqu', 'lorsqu', 'puisqu', 'quoiqu', 'aujourd', 'presqu', 'quelqu'].includes(k) && 'ljdmnstc'.includes(k.slice(-1)) && FRK.has(k.slice(0, -1)) && FRT.has(k.slice(0, -1)))
        return h.slice(0, -1) + ' ' + h.slice(-1) + parts.slice(1).join('');
      return m;
    }
    const k = strip(m.toLowerCase());
    if (k.length < 4 || FRK.has(k)) return m;
    for (const e of ELID) if (k.startsWith(e) && /^[aeiouyh]/.test(k.slice(e.length)) && FRK.has(k.slice(e.length)) && k.length - e.length >= 2) {
      const rest = k.slice(e.length); if (!FRT.has(rest) && rest.length < 4) continue;
      return m.slice(0, e.length) + '\'' + m.slice(e.length);
    }
    return m;
  });
}
function fixFrench(text) {
  return fixFrench0(text).replace(/\b((?:qu|n|c)['’]est) (ce)\b/gi, '$1-$2');
}
function fixFrench0(text) {
  loadFr();
  text = digitWords(halfwidth(text), w => FRK.has(strip(w)), w => FRT.has(strip(w)) ? 0 : 3);
  text = frApos(text);
  // « TUES » en début de phrase : TU ES
  text = String(text).replace(/(^|[.!?…]\s*)TUES\b/g, '$1TU ES');
  text = String(text)
    .replace(/[Δ∆]/g, 'À').replace(/(?<!\p{L})À(?=\p{L}{2,})/gu, 'À ')
    // petit « i » des lettrages de BD dans un mot en majuscules : « CiEL » → CIEL
    .replace(/\p{L}+/gu, m => /\p{Lu}/u.test(m) && /i/.test(m) && m.replace(/i/g, '') === m.replace(/i/g, '').toUpperCase() ? m.replace(/i/g, 'I') : m);
  return text.replace(/[\p{L}'’]+/gu, m => {
    const core = m.replace(/^(?:[Qq][Uu]|\p{L})['’]/u, ''), pre = m.slice(0, m.length - core.length);
    if (core.length < 2 || !/^[\p{L}]+$/u.test(core)) return m;
    const k = strip(core.toLowerCase()), up = core === core.toUpperCase();
    // lettrage sans accents : on n'en ajoute pas (« DESQLE » → DESOLE, pas « DÉSOLE »)
    const acc = strip(core) !== core;
    const cap = /^\p{Lu}\p{Ll}/u.test(core);
    const out = s => pre + (up ? (acc ? s : s.split(' ').map(x => x === 'à' ? x : strip(x)).join(' ')).toUpperCase() : cap ? s[0].toUpperCase() + s.slice(1) : s);
    // « ? » lu comme un P collé au mot (« HEINP » → HEIN?)
    if (/p$/.test(k) && k.length >= 3 && !FRK.has(k) && FRK.has(k.slice(0, -1))) return pre + core.slice(0, -1) + '?';
    // mot connu mais rare, alors qu'un mot très courant n'est qu'à une confusion U/L ou O/Q (« VOLS » → VOUS, « NOLS » → NOUS, « QLE » → QUE)
    // « I'air » → l'air (L minuscule lu I devant l'apostrophe)
    const pre2 = /^I['’]$/.test(pre) && /^\p{Ll}/u.test(core) ? 'l' + pre.slice(1) : pre;
    if (pre2 !== pre) return pre2 + core;
    if (FRK.has(k)) {
      // majuscules avec un accent mal lu (« ÉTRE » → ÊTRE, « TÓI » → TOI)
      if (up && acc && !FR.has(core.toLowerCase())) { const w = FRK.get(k); return pre + (strip(w) === w ? w : w).toUpperCase(); }
      // mots collés très courants qui ressemblent à un mot rare (« JESUIS » lu « JESUS ») : séparés seulement s'ils étaient inconnus
      if (!up && !FR.has(core.toLowerCase()) && /^\p{Ll}+$/u.test(core)) return pre + FRK.get(k);
      if (!FRT.has(k)) { const c = frCorrect(core); if (c && FRT.has(strip(c)) && /[lq]/.test(k)) return out(c); }
      return m;
    }
    if (/l/.test(k)) { const u = lToU(k, x => FRK.has(x), x => FRT.has(x) ? 0 : 2, k.length <= 2 ? 0 : 2); if (u) return out(FRK.get(u) || u); }
    // deux mots très courants collés : préférés à une correction vers un mot rare (« JESUIS » → JE SUIS, pas JÉSUS)
    const s0 = k.length >= 5 ? frSplitN(k) : '';
    const c = frCorrect(core);
    if (s0 && s0.split(' ').every(x => FRT.has(strip(x.toLowerCase()))) && !(c && FRT.has(strip(c)))) return out(s0);
    if (c) return out(c);
    const s = k.length >= 4 ? frSplit(k) : ''; if (s) return out(s);
    return m;
  });
}
// 1.7.0 : pour la traduction seulement, accents remis aux mots écrits sans accents (lettrage en majuscules) :
// « ca » → ça, « etre » → être, « c'etait » → c'était, « bien sur » → bien sûr. Le texte affiché ne change pas.
function frAccent(text) {
  loadFr();
  return String(text).replace(/\b[Bb]ien sur\b/g, m => m.slice(0, 5) + 'sûr').replace(/[\p{L}]+/gu, w => {
    const lw = w.toLowerCase(); if (lw.length < 2 || FR.has(lw)) return w;
    const k = strip(lw); if (k !== lw) return w; // déjà accentué
    const a = FRK.get(k); if (!a || a === lw) return w;
    return w === lw ? a : w[0] === w[0].toUpperCase() && w.slice(1) === w.slice(1).toLowerCase() ? a[0].toUpperCase() + a.slice(1) : a.toUpperCase();
  });
}
module.exports.frAccent = frAccent; module.exports.frApos = frApos;
module.exports.fixFrench = fixFrench; module.exports.frenchRatio = frenchRatio; module.exports.frKnown = frKnown;
