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
    for (const l of fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'dict', 'en-words.txt'), 'utf8').split(/\r?\n/)) {
      if (!l) continue;
      if (l[0] === '#') { tier = { 10: 0, 20: 1, 35: 2, 40: 3, 50: 4, 55: 5, 60: 6 }[l.slice(1)] ?? 6; continue; }
      if (!DICT.has(l)) DICT.set(l, tier);
    }
  } catch {}
  for (const c of CONTR.split(' ')) DICT.set(c, 0);
  // mots courants absents des listes américaines
  for (const w of 'axe axes colour honour favour armour grey okay barkeep gosh darn'.split(' ')) if (!DICT.has(w)) DICT.set(w, 1);
  // 1.7.0 refaite : mots des BD et mangas absents des listes (sinon coupés : « SCANLATION » → SCAN AT ION)
  for (const w of 'scanlation scanlations scanlator scanlators proofreader proofreaders proofreading typeset typesetter typesetting typesetters redrawer redrawers redraw raws speedscan tankobon tankoubon dojo dojos sensei senpai kohai onii onee nee nii chan kun sama yokai youkai katana ninja ninjas shinigami otaku manga mangaka manhwa manhua webtoon oni ramen sake kimono shrine kami'.split(' ')) if (!DICT.has(w)) DICT.set(w, 3);
  // « ISNT », « DONT » (apostrophe non lue) : retrouvés grâce à la forme sans apostrophe
  APOS = new Map(); for (const c of CONTR.split(' ')) { const s = c.replace(/'/g, ''); if (!DICT.has(s)) APOS.set(s, c); }
  return DICT;
}
let APOS = new Map();
// 1.7.2 : « EY, » = HEY dont le H n'a pas été lu (bord de bulle)
const SPECIAL = { ey: 'hey', ts: "it's", tm: "i'm", im: "i'm", tve: "i've", ive: "i've", tll: "i'll", tid: "i'd", dint: "didn't", didnt: "didn't", cant: "can't", wont: "won't", youre: "you're", theyre: "they're", thats: "that's", whats: "what's", hes: "he's", shes: "she's", theres: "there's", heres: "here's", lts: "it's", "t's": "it's" };

// lettres que la lecture confond souvent dans les bulles (écriture « bande dessinée » en majuscules)
const CONF = {
  a: 'r', b: 'eor', c: 'gkoe', d: 'o', e: 'bfrc', f: 'pe', g: 'csob', h: 'nku', i: 'ltj', j: 'i', k: 'rch', l: 'iu', m: 'nw',
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
  // 1.7.1 : un mot du dictionnaire (même rare : PROOFREADER, SWORDSMAN) n'est jamais coupé en deux
  if (w.length < 4 || known(w)) return '';
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

// ---- 1.7.1 : crédits de l'équipe (« TL: kim », « Cleaner - fdas ») ----
// Les pseudonymes ne sont pas des mots : ils ne sont jamais « corrigés » (KIM ne devient pas HIM).
// Rôle suivi de « : », « - », « = » ou « / » : ce qui suit, jusqu'au rôle suivant, est un pseudonyme.
const ROLE = String.raw`(?:tl|ts|pr|qc|cl|rd|tlc|tl\/ts|sfx|raws?|scans?|scan\s*trad|scanlat\w*|translat\w*|trad|traduc\w*|typeset\w*|clean\w*|redraw\w*|proof\w*|edit\w*|édit\w*|correct(?:eur|rice|ion|or)s?|relect\w*|check(?:er|ing)?s?|quality\s*check\w*|lettr\w*|letter(?:er|ing)s?|uploader?s?|admin\w*|staff|team|équipe|sc[ée]nar\w*|artistes?|story|art|dessin\w*|auteurs?|authors?|mangaka)`;
const ROLE_PAIR = new RegExp(String.raw`(^|[^\p{L}])(${ROLE})(\s*[:：=\/]\s*|\s+[-–—]\s*)`, 'giu');
// mots qui n'apparaissent que sur une page de crédits (comptés une fois chacun)
const CREDITS_WORDS = /\b(scanlations?|scanlators?|scantrad\w*|translators?|traducteurs?|traductrices?|typesett(?:er|ing)s?|typesetters?|typesets?|raws?|redrawers?|cleaners?|proofreaders?|proofreading|relecteurs?|relectrices?|correcteurs?|raw\s*providers?|credits?|crédits|staff|recruit\w*|recrut\w*|discord|patreon|ko-?fi|paypal|quality\s*check(?:er)?s?)\b/giu;
// adresses de sites (« MANGAS-ORIGINES.FR », « DISCORD.GG/… ») : jamais corrigées
const URL_RE = /(?:https?:\/\/|www\.)\S+|[\p{L}\d][\p{L}\d-]{2,}(?:\.[\p{L}\d-]+)*\.(?:fr|com|net|org|gg|io|info|xyz|club|site|cc)(?![\p{L}\d])(?:\/\S*)?/giu;
function creditsMask(text) {
  const keep = [];
  const s = String(text).replace(URL_RE, w => { keep.push(w); return '\uE000' + String.fromCharCode(0xE100 + keep.length - 1); });
  if (!ROLE_PAIR.test(s)) return { t: s, keep };
  ROLE_PAIR.lastIndex = 0;
  // position de chaque rôle ; le pseudonyme va jusqu'au rôle suivant (ou la fin du texte)
  const marks = []; let m;
  while ((m = ROLE_PAIR.exec(s))) marks.push([m.index + m[1].length, m.index + m[0].length]);
  let out = '', at = 0;
  marks.forEach(([st, en], i) => {
    const stop = i + 1 < marks.length ? marks[i + 1][0] : s.length;
    // le rôle lui-même (« TS », « TL ») n'est pas corrigé non plus (« TS » ne devient pas IT'S)
    out += s.slice(at, st) + s.slice(st, en).replace(/[\p{L}\d][\p{L}\d'’_.\/-]*/gu, w => { keep.push(w); return '\uE000' + String.fromCharCode(0xE100 + keep.length - 1); });
    const name = s.slice(en, stop);
    out += name.replace(/[\p{L}\d][\p{L}\d'’_.-]*/gu, w => { keep.push(w); return '\uE000' + String.fromCharCode(0xE100 + keep.length - 1); });
    at = stop;
  });
  return { t: out + s.slice(at), keep };
}
const creditsUnmask = (t, keep) => keep.length ? String(t).replace(/\uE000([\uE100-\uEFFF])/g, (x, c) => keep[c.charCodeAt(0) - 0xE100] ?? x) : t;
// page de crédits : plusieurs rôles avec un pseudonyme, ou plusieurs mots de crédits, ou une liste de petits blocs
// en minuscules hors des bulles avec au moins un rôle. La page est alors laissée telle quelle.
function isCreditsPage(texts, inBubbles = 0, totalGroups = 0) {
  const arr = (Array.isArray(texts) ? texts : [texts]).map(String);
  if (!arr.length) return false;
  const joined = arr.join('\n');
  const pairs = (joined.match(ROLE_PAIR) || []).length;
  const words = new Set((joined.match(CREDITS_WORDS) || []).map(w => w.toLowerCase().replace(/\s+/g, ' ')));
  if (pairs >= 2 || words.size >= 3 || (pairs >= 1 && words.size >= 1)) return true;
  if ((pairs || words.size) && totalGroups >= 4 && inBubbles === 0) {
    const lowShort = arr.filter(t => { const ws = t.match(/\p{L}+/gu) || []; return ws.length >= 1 && ws.length <= 4 && t === t.toLowerCase(); }).length;
    if (lowShort >= Math.max(3, Math.ceil(totalGroups * 0.6))) return true;
  }
  return false;
}
// ---- 1.7.1 : points de suspension abîmés (« ..NO. » → ...NO., « NON ..MAIS » → NON ...MAIS) ; « 1..5 » n'est pas touché ----
const fixEllipsis = text => String(text).replace(/(?<![.\d])\.\.(?![.\d])/g, '...');

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
// 1.7.0 refaite : bulle écrite en MAJUSCULES où un petit mot a été lu en minuscules (« ….ou ARE », « LIKE you. ») :
// remis en majuscules, comme le reste de la bulle
function capsLike(text) {
  const ws = String(text).match(/\p{L}+/gu) || [];
  const up = ws.filter(w => w.length >= 2 && w === w.toUpperCase()).length, low = ws.filter(w => w === w.toLowerCase());
  const mix = ws.filter(w => /^\p{Lu}\p{Ll}{1,5}$/u.test(w));
  if (up >= 3 && (low.length || mix.length) && low.length + mix.length <= Math.max(1, up / 4)) return String(text).replace(/\p{L}+/gu, w => ((w === w.toLowerCase() || /^\p{Lu}\p{Ll}{1,5}$/u.test(w)) && w.length <= 6 ? w.toUpperCase() : w));
  return text;
}
// bulle d'un seul mot dont le W du début n'a pas été lu : « HAT? » → WHAT?
const LOST_W = { hat: 'what', hy: 'why', ho: 'who', hen: 'when', here: null };
function fixWords(text) {
  load();
  // 1.7.1 : pseudonymes des crédits mis de côté pendant la correction
  const cm = creditsMask(text);
  return creditsUnmask(fixWords0(cm.t), cm.keep);
}
function fixWords0(text) {
  // 1.7.2 : « …H-HOW » dont deux points n'ont pas été lus : « .H-HOW » → « ...H-HOW »
  text = String(text).replace(/^(\s*)\.(?=\p{L})/u, '$1...');
  text = fixEllipsis(capsLike(text));
  { const m = /^(\s*)(\p{L}+)([?!]+\s*)$/u.exec(text); if (m && LOST_W[m[2].toLowerCase()] && /\?/.test(m[3])) text = m[1] + likeCase(m[2], LOST_W[m[2].toLowerCase()]) + m[3]; }
  text = digitWords(halfwidth(text), w => known(w), w => rank(w));
  const mixed = /\p{Ll}{3,}/u.test(text);
  text = String(text).replace(/[\p{L}']+/gu, (m, off, all) => {
    let w = m.toLowerCase().replace(/^'+|'+$/g, '');
    // 1.7.1 : lettres collées à des chiffres (« COVID19 », « MP3 », « R2D2 ») : un code, pas un mot mal lu
    if (/\d/.test(all[off - 1] || '') || /\d/.test(all[off + m.length] || '')) return m;
    // texte en minuscules : un mot à majuscule au milieu d'une phrase est un nom propre (« Rea », « Chaosah ») : pas touché
    if (mixed && /^\p{Lu}\p{Ll}+$/u.test(m) && off > 0 && !/[.!?…:"“«]\s*$/.test(all.slice(Math.max(0, off - 3), off)) && !known(w)) return m;
    if (!/^[a-z']+$/.test(w)) return m;
    // 1.7.2 : mot inconnu après un nombre (« TEN MILLION MARLS ») : une monnaie ou une unité de la série, pas un mot mal lu
    if (!known(w) && !SPECIAL[w] && w.length >= 4 && /(?:\d|\b(?:million|millions|thousand|hundred|billion|ten|twenty|hundreds|thousands))\s+$/i.test(all.slice(Math.max(0, off - 12), off))) return m;
    if (!known(w) && !APOS.has(w) && !SPECIAL[w] && /l/.test(w)) { const u = lToU(w, x => known(x), x => rank(x), w.length <= 2 ? 0 : 3); if (u) { const core = m.replace(/^'+|'+$/g, ''); return m.replace(core, likeCase(core, u)); } }
    // apostrophe ou « I » non lus dans les formes courtes : « TS » → IT'S, « TVE » → I'VE, « DINT » → DIDN'T
    if (SPECIAL[w]) { const core = m.replace(/^'+|'+$/g, ''); return m.replace(core, likeCase(core, SPECIAL[w])); }
    // « EVERYTHINE'S » : on corrige le mot, le « 'S » reste
    const ps = /^([a-z]{4,})'s$/.exec(w);
    if (ps && !known(ps[1]) && !APOS.has(w)) { const c = correct1(ps[1]) || (correct(ps[1]) ? { w: correct(ps[1]) } : null); if (c) { const core = m.replace(/['’]s$/i, ''); return likeCase(core, c.w) + m.slice(core.length); } return m; }
    // « T'S » → IT'S
    // mot inconnu : d'abord une lettre mal lue toute simple, sinon des mots collés, sinon une correction plus large
    // « I » collé au mot suivant : « IHOPE » → I HOPE, « ITHINK » → I THINK (avant : « HOPE », le I perdu)
    if (/^i[a-z]{3,}$/.test(w) && !known(w) && !APOS.has(w) && known(w.slice(1)) && rank(w.slice(1)) <= 2) { const core = m.replace(/^'+|'+$/g, ''); return m.replace(core, likeCase(core, 'i ' + w.slice(1)).replace(/^i /, 'I ')); }
    const c1 = known(w) || APOS.has(w) ? null : correct1(w);
    const c = (c1 && c1.c <= 1.25 ? c1.w : '') || split(w) || correct(w) || (w.includes("'") && known('i' + w) ? 'i' + w : '');
    const core = m.replace(/^'+|'+$/g, '');
    return c ? m.replace(core, likeCase(core, c)) : m;
  });
  // apostrophe non lue : « ILL HELP » → I'LL HELP ; « Y » non lu en début de bulle : « OU ARE » → YOU ARE
  text = String(text).replace(/\b(ill)(\s+)(be|help|go|do|get|take|make|show|tell|kill|find|come|give|need|have|try|protect|never|always|just|see|wait|bring|beat|win|stop|let|keep|leave|return|handle|teach|pay|call|buy|end|finish|fight|crush|destroy|save|use|tear|break|send|put|eat|look|be)\b/gi, (m, a, s2, v) => (a === a.toUpperCase() ? "I'LL" : "I'll") + s2 + v);
  text = String(text).replace(/(^|[.…!?"“«\s])(ou)(\s+)(are|were|know|can|can't|don't|will|won't|should|must|have|see|look|need|want|guys|bastard|idiot|again|too)\b/gi, (m, b, a, s2, v) => b + (a === a.toUpperCase() ? 'YOU' : 'you') + s2 + v);
  // lettre isolée après « WILL », « TO »… : « BE » mal lu (« YOU WILL E ENTRUSTING »)
  text = String(text).replace(/\b(will|would|can|could|should|must|might|may|to|not|won't|can't|don't)(\s+)[eb]\b(?!['’])/gi, (m, a, s) => a + s + (a === a.toUpperCase() ? 'BE' : 'be'));
  // 1.7.2 (pages gardées par le propriétaire) : « WHAT'S THIIIS? » allongé lu « THUS » ; « (~10 MILLION YEN) » lu « (ID MILLION »
  text = String(text).replace(/\b(what['’]?s|what is|is|was)(\s+)thu+s(?=\s*[?!.…]|$)/gi, (m, a, s2) => a + s2 + (a === a.toUpperCase() ? 'THIS' : 'this'));
  text = String(text).replace(/(^|[\s(~])(?:ID|lD|IO|lO)(\s+)(million|thousand|hundred|billion|yen|dollars?|euros?|kilos?|km|meters?|metres?|minutes?|seconds?|hours?|days?|years?)\b/gi, (m, b, s2, u) => b + '10' + s2 + u);
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
// 1.7.1 : page en français : un nom n'est ni un mot anglais ni un mot français (TIFAINE, BLUTCH, KAKU)
// 1.7.2 (signalement de l'utilisateur : « WHAT », « THERE », « YOUR », « DIDN'T » restés en anglais) : jamais un mot
// anglais ou français connu, ni le début d'une forme courte (« DIDN » de DIDN'T), ni un petit mot courant
const STEMS = new Set('didn couldn wouldn shouldn isn aren wasn weren doesn hasn haven hadn mustn needn mightn ain don won can shan'.split(' '));
const badName = (w, lang) => { load(); const l = String(w).toLowerCase(); return !/^[a-z]{4,}$/.test(l) || known(l) || APOS.has(l) || !!SPECIAL[l] || STEMS.has(l) || frKnown(l) && lang !== 'en-only'; };
const nameWords = (t, lang) => [...String(t).matchAll(/[\p{L}]{4,}(?!['’]\p{L})/gu)].map(m => m[0]).filter(w => !badName(w, lang));
// retient les noms vus sur cette page (une fois par page), garde les 400 plus fréquents
function learnNames(texts, names, lang) {
  const seen = new Set(texts.flatMap(t => nameWords(t, lang)).map(w => w.toUpperCase()));
  for (const w of seen) names[w] = (names[w] || 0) + 1;
  const ks = Object.keys(names); if (ks.length > 400) ks.sort((a, b) => names[a] - names[b]).slice(0, ks.length - 400).forEach(k => delete names[k]);
}
// un mot inconnu rare, très proche d'un nom déjà bien lu souvent, est remplacé par ce nom
function fixNames(text, names, lang) {
  if (!names) return text;
  const ks = Object.keys(names).filter(k => names[k] >= 3);
  if (!ks.length) return text;
  return String(text).replace(/[\p{L}]{4,}/gu, m => {
    const U = m.toUpperCase(), l = m.toLowerCase(); load();
    if (!/^[a-z]+$/.test(l) || known(l) || (lang === 'fr' && frKnown(l)) || (names[U] || 0) >= 3) return m;
    let best = '', bd = 9;
    for (const k of ks) { const d = dist(U, k); if (d < bd && names[k] >= Math.max(3, (names[U] || 0) * 3)) { bd = d; best = k; } }
    const lim = U.length >= 8 ? 2 : 1;
    return best && bd <= lim ? (m === U || mostlyUp(m) ? best : best[0] + best.slice(1).toLowerCase()) : m;
  });
}
// 1.7.1 : signes de crédits dans un bloc de texte (rôle + pseudonyme, ou mot propre aux crédits)
const creditsHint = t => (String(t).match(ROLE_PAIR) || []).length + (String(t).match(CREDITS_WORDS) || []).length;
module.exports = { badName, learnNames, fixNames, plausible, ROMAJI, isName, load, correct, fixParts, fixWords, englishRatio, isCreditsPage, creditsHint, fixEllipsis };

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
  // 1.7.1 : seulement un L entre une consonne et une consonne (ou la fin) : KAZLYA, TSUKLMOGAMI, TAIJL ;
  // pas « ULTI » (nom), « BLUE », « ALAIDE », « SEULEMENT » (devenaient UUTI, BUUE, AUAIDE, SEUUEMENT)
  const V = c => 'aeiou'.includes(c || 'a');
  if (w.length >= 4 && !ROMAJI.test(w)) for (let mask = 1; mask < (1 << ix.length); mask++) {
    const a = [...w]; let okL = true;
    ix.forEach((p, j) => { if (mask & (1 << j)) { a[p] = 'u'; if (p === 0 || V(w[p - 1]) || (p + 1 < w.length && V(w[p + 1]))) okL = false; } });
    const s = a.join(''); if (okL && ROMAJI.test(s)) return s;
  }
  return '';
}
// ---- 1.7.0 : chiffres lus à la place des lettres (« GO » lu « 60 », « GOD » lu « 600 », « GOOD » lu « 6OOD ») ----
// 1.7.1 : 3 peut aussi être un J (« DOJO » lu « 0O30 »)
const DIG = { 0: 'od', 1: 'il', 2: 'z', 3: 'ej', 4: 'a', 5: 's', 6: 'gb', 8: 'b', 9: 'g' };
// mots qui montrent qu'un nombre est un vrai nombre (« 60 ANS », « 600 YEN »)
const NUMCTX = /^(years?|yrs?|yen|dollars?|euros?|francs?|fcfa|cfa|%|times|people|persons?|men|women|meters?|metres?|km|kg|g|cm|mm|m|minutes?|mins?|seconds?|secs?|hours?|hrs?|days?|weeks?|months?|points?|pts|degrees?|ans?|années?|fois|personnes?|mètres?|secondes?|heures?|jours?|semaines?|mois|h|x|th|st|nd|rd|e|ème|er|ère)$/i;
function digitWords(text, isWord, rankOf, noPure) {
  if (!/\d/.test(text)) return text;
  const toks = String(text).split(/(\s+)/);
  for (let i = 0; i < toks.length; i++) {
    const m = /^([^\p{L}\d]*)([\p{L}\d]+)([^\p{L}\d]*)$/u.exec(toks[i]); if (!m || !/\d/.test(m[2])) continue;
    const core = m[2], pure = /^\d+$/.test(core);
    if (core.length < 2 || core.length > 9) continue;
    // 1.7.1 : en français, un nombre seul reste un nombre (« ÉPISODE 115 » devenait « ÉPISODE ILS »)
    if (pure && noPure) continue;
    // nombre suivi d'une unité, d'un mot comme « ANS », ou précédé d'un autre nombre : c'est un vrai nombre
    const next = (toks[i + 2] || '').replace(/[^\p{L}%]/gu, ''), prev = (toks[i - 2] || '');
    if (pure && (NUMCTX.test(next) || /\d/.test(prev) || /[.,:]\d/.test(toks[i]) || /^\d{4}$/.test(core) && +core > 1000 && +core < 2100)) continue;
    // le reste du texte doit être en majuscules (lettrage de bulle), sinon on ne touche pas aux nombres
    if (pure && /\p{Ll}/u.test(text)) continue;
    let opts = [''];
    for (const ch of core.toLowerCase()) { const alt = /\d/.test(ch) ? (DIG[ch] || '') : ch; if (!alt) { opts = []; break; } opts = opts.flatMap(o => [...alt].map(a => o + a)); if (opts.length > 128) { opts = []; break; } }
    let best = '', br = 99;
    for (const o of opts) if (isWord(o)) { const r = rankOf(o); if (r < br) { br = r; best = o; } }
    // nombre seul : seulement vers un mot très courant (« 60 » → GO, « 600 » → GOD, mais « 100 » reste 100) ;
    // 1.7.1 : chiffres et lettres mêlés (« 0O30 » → DOJO, « 6OOD » → GOOD) : mot assez courant ; « 1O » reste 1O (pas LO)
    if (best && (pure ? br <= 1 : br <= (core.length <= 2 ? 2 : 4))) toks[i] = m[1] + best.toUpperCase() + m[3];
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
  "un une vais va vas veux veut vie viens voilà voir vos votre vous vrai vraiment " +
  // 1.7.1
  "tiens vont font sait part").split(' ');
let FR = null, FRK = null, FRT = null;
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
function loadFr() {
  if (FR) return FR;
  FR = new Set(); FRK = new Map(); FRT = new Set(FR_TOP.map(strip));
  try {
    for (const w of fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'dict', 'fr-words.txt'), 'utf8').split(/\r?\n/)) {
      if (!w) continue; FR.add(w); const k = strip(w); if (!FRK.has(k)) FRK.set(k, w);
    }
  } catch {}
  for (const w of FR_TOP) { FR.add(w); const k = strip(w); if (!FRK.has(k) || FRT.has(k)) FRK.set(k, w); }
  // 1.7.1 : mots des mangas et des équipes de traduction absents de la liste (« MANGA » devenait MANGEA, « TRAD » TRAC)
  for (const w of FR_EXTRA.split(' ')) { FR.add(w); const k = strip(w); if (!FRK.has(k)) FRK.set(k, w); }
  return FR;
}
const FR_EXTRA = 'manga mangas mangaka mangakas manhwa manhua webtoon webtoons scan scans scantrad scantrads trad trads team teams raw raws ' +
  'clean check checker edit discord patreon otaku otakus ninja ninjas samouraï samouraïs shinobi sensei senpai kohai dojo dojos katana katanas ' +
  'kunai kunais chakra yokai yokais kami shonen shojo seinen anime animes cosplay spoil spoiler spoilers fan fans fanart okay ok cool boss ' +
  'sushi sushis ramen onigiri bento mecha mechas hokage shogun daimyo geisha ronin manga-ka';
// mot français connu, avec ou sans accents (les lettrages en majuscules oublient souvent les accents)
const frKnown = w => { loadFr(); return FRK.has(strip(w.toLowerCase())); };
// confusions de lettres fréquentes dans les lettrages français : U lu L, O lu Q, I lu L, À lu Δ
// 1.7.0 refaite : lettrages dessinés à la main (vieilles BD) : Y lu pour V, O pour G, D pour U
const FR_CONF = { l: 'ui', q: 'o', i: 'l', o: 'q', u: 'l', e: 'c', c: 'e', n: 'u', h: 'n', m: 'n', d: 'c' };
const FR_CONF_HAND = { ...FR_CONF, o: 'qg', d: 'cu', y: 'v' };
function frCorrect(w) {
  const k = strip(w.toLowerCase());
  if (k.length < 2) return '';
  const cands = [];
  // une ou deux confusions de lettres
  // deux lettres lues pour une (« LI » pour U, « RN » pour M, « CL » pour D)
  const PAIRS = { li: 'u', ll: 'u', rn: 'm', cl: 'd', vv: 'w', ii: 'u' };
  // lettrage à la main (mot inconnu, en majuscules, 4 lettres ou plus) : quelques confusions de plus
  const hand = w === w.toUpperCase() && k.length >= 4 && !FRK.has(k), CONF = hand ? FR_CONF_HAND : FR_CONF;
  const step = s => { const o = []; for (let i = 0; i < s.length; i++) { for (const c of CONF[s[i]] || '') o.push(s.slice(0, i) + c + s.slice(i + 1)); const p2 = PAIRS[s.slice(i, i + 2)]; if (p2) o.push(s.slice(0, i) + p2 + s.slice(i + 2)); } return o; };
  const e1 = step(k);
  for (const c of e1) if (FRK.has(c)) cands.push([c, (FRT.has(c) ? 0 : 1) + (c.length !== k.length ? 0.5 : 0)]);
  // lettre doublée par erreur (« ILLS » → ILS)
  // 1.7.1 : vers un mot très courant ou assez long, ou un I/U/L fin lu deux fois (« OUUF » → OUF) ; « POTTS », un nom, ne devient plus POTS
  if (!cands.length) for (let i = 1; i < k.length; i++) if (k[i] === k[i - 1]) { const s = k.slice(0, i) + k.slice(i + 1); if (FRK.has(s) && (FRT.has(s) || s.length >= 5 || 'iul'.includes(k[i]))) cands.push([s, FRT.has(s) ? 0.5 : 1.5]); }
  // lettre fine lue en trop (« UINE » → UNE, « VOIUS » → VOUS)
  if (k.length >= 4 && !FRK.has(k)) for (let i = 0; i < k.length; i++) if ('il'.includes(k[i])) { const s = k.slice(0, i) + k.slice(i + 1); if (FRK.has(s)) cands.push([s, FRT.has(s) ? 0.5 : 1.5]); }
  // lettre en trop à la fin, collée par le lettrage (« CHOSEH » → CHOSE, « DROITET » → DROITE)
  if (!cands.length && hand && k.length >= 5 && !'aye'.includes(k.slice(-1))) { const s = k.slice(0, -1); if (FRK.has(s) && (s.length >= 5 || FRT.has(s))) cands.push([s, FRT.has(s) ? 0.5 : 1.5]); }
  // lettre oubliée (« M'NVITER » → M'INVITER, « DEVRAENT » → DEVRAIENT) ; 1.7.1 : 6 lettres au moins (« GENOS », un nom, ne devient plus GENOIS)
  if (!cands.length && k.length >= 6) for (let i = 0; i < k.length; i++) for (const c of 'iuel') { const s = k.slice(0, i) + c + k.slice(i); if (FRK.has(s)) cands.push([s, FRT.has(s) ? 1 : 2]); }
  // deux confusions : 1.7.1 : 6 lettres au moins, ou 5 vers un mot très courant (« AISSI » → AUSSI ; « SOLAT » ne devient plus SQUAT)
  if (!cands.length && k.length >= 5) for (const c1 of e1) for (const c2 of step(c1)) if (FRK.has(c2) && (k.length >= 6 || FRT.has(c2))) cands.push([c2, FRT.has(c2) ? 1 : 2]);
  if (!cands.length) return '';
  cands.sort((a, b) => a[1] - b[1]);
  // mot court (noms coréens ou japonais : « JU-HEE ») : seulement vers un mot très courant (« QLE » → QUE)
  if (k.length <= 3 && !FRT.has(cands[0][0])) return '';
  // 1.7.1 : mot de 4 lettres sans U/L ni O/Q : seulement vers un mot très courant (« DANA », « MADS » sont des noms)
  if (k.length === 4 && !FRT.has(cands[0][0]) && !/[lq]/.test(k)) return '';
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
// pas de trait d'union après ces mots (« MAISTU » → MAIS TU ; 1.7.1 : « C'ESTLA » → C'EST LA, « ETRELA » → ÊTRE LA, « VOILALE » → VOILÀ LE)
const NO_HYPH = new Set(['mais', 'et', 'si', 'que', 'quand', 'comme', 'alors', 'donc', 'car', 'ou', 'puis', 'pour', 'avec', 'sans', 'chez', 'dans',
  'est', 'etre', 'voila', 'ete', 'sont', 'ont', 'suis', 'es', 'etait', 'sera', 'c']);
// verbe + pronom avec trait d'union (« DISTU » → DIS-TU) ; 1.7.1 : jamais entre deux pronoms (« VOUSVOUS » → VOUS VOUS),
// « -Y » et « -EN » seulement après un verbe en -S / -Z (« VASY » → VAS-Y ; « BONNEY », un nom, n'est pas coupé)
const hyph = (a, b) => { const x = strip(a.toLowerCase()), y = strip(b.toLowerCase()); return PRON.has(y) && x.length >= 3 && !NO_HYPH.has(x) && !PRON.has(x) && (!/^(y|en)$/.test(y) || /[sz]$/.test(x)); };
// mots collés : « TIENSA » → TIENS À, « DISTU » → DIS-TU, « MORDSMOI » → MORDS-MOI
function frSplit(k) {
  for (let i = k.length - 1; i >= 2; i--) {
    const a = k.slice(0, i), b = k.slice(i);
    if (!FRK.has(a)) continue;
    if (PRON.has(b) && hyph(a, b)) return FRK.get(a) + '-' + b;
    // 1.7.1 : deux pronoms collés (« ILSY » → ILS Y, « TULE » → TU LE)
    if (PRON.has(b) && PRON.has(a)) return a + ' ' + b;
    // « TIENSA » → TIENS À ; 1.7.1 : pas « MURATA » (nom : « murât » n'est qu'une forme rare du verbe murer)
    if (b === 'a' && a.length >= 3 && !/[âîû]t$/.test(FRK.get(a))) return FRK.get(a) + ' à';
    if (FRT.has(b) && FRT.has(a) && b.length >= 2) return FRK.get(a) + ' ' + FRK.get(b);
  }
  // « AFORCE » → À FORCE
  // 1.7.1 : mot courant ou de 5 lettres au moins après le À (« ALICE », un nom, ne devient pas À LICE)
  if (k[0] === 'a' && k.length >= 5 && FRK.has(k.slice(1)) && (FRT.has(k.slice(1)) || k.length >= 6)) return 'à ' + FRK.get(k.slice(1));
  return frSplitN(k);
}
// 1.7.0 : mots collés plus généraux (« JESUIS » → JE SUIS, « TROUVECA » → TROUVE ÇA, « SIURGEMMENT » → SI URGEMMENT,
// « SEUUEMENTUN » → SEULEMENT UN) : 2 ou 3 morceaux, chacun courant ou assez long ; un morceau peut avoir une lettre mal lue
const okPart = p => FRK.has(p) && (FRT.has(p) || p.length >= 4);
// morceau → [mot, coût, sorte] : 'x' exact, 'c' corrigé (1.7.1 : 7 lettres au moins : « MAREMENT » ne devient plus MA REMUENT),
// 'i' petit mot dont le I ou le U fin n'a pas été lu (1.7.1 : « BENENTRAINER » → BIEN ENTRAINER)
function partFix(p) {
  if (okPart(p)) return [FRK.get(p), 0, 'x'];
  if (p.length >= 7) { const c = frCorrect(p); if (c) return [c, 1, 'c']; }
  if (p.length === 3) for (let i = 1; i < 3; i++) for (const c of 'iu') { const s = p.slice(0, i) + c + p.slice(i); if (FRT.has(s)) return [FRK.get(s), 1, 'i']; }
  return null;
}
function frSplitN(k, exact) {
  if (k.length < 5 || k.length > 30) return '';
  let best = null;
  const take = (ps, cost) => {
    const parts = ps.map(x => x[0]), top = x => FRT.has(strip(x.toLowerCase()));
    // un petit mot très courant dans le découpage (« JE », « UN », « DE »)… ou « BIEN » retrouvé à côté d'un mot exact assez long
    const ins = ps.findIndex(x => x[2] === 'i');
    // 1.7.1 : ou deux mots exacts, un très courant et un assez long (« VOUSASSURE » → VOUS ASSURE)
    const two = ps.length === 2 && ps.every(x => x[2] === 'x') && parts.some(x => top(x)) && parts.some(x => x.length >= 5);
    if (ins >= 0 ? !(ps.length === 2 && ps[1 - ins][2] === 'x' && ps[1 - ins][0].length >= 5) : !two && !parts.some(x => x.length <= 3 && top(x))) return;
    // 1.7.1 : trois morceaux avec un mot peu courant : un seul petit mot (« TETETOUE » n'est plus TE TE TOUE)
    if (ps.length === 3 && parts.some(x => !top(x)) && parts.filter(x => x.length <= 2).length > 1) return;
    // 1.7.1 : trois morceaux : assez long en tout (« CESTUSE » n'est plus CES TU SE), chaque mot peu courant de 4 lettres au moins
    if (ps.length === 3 && (k.length < 8 || parts.some(x => !top(x) && x.length < 4))) return;
    const sc = cost * 1.5 + parts.length - parts.filter(x => top(x)).length * 0.6; if (!best || sc < best[1]) best = [parts, sc, cost];
  };
  for (let i = 2; i <= k.length - 2; i++) {
    const a = partFix(k.slice(0, i)); if (!a) continue;
    const b = partFix(k.slice(i)); if (b) take([a, b], a[1] + b[1]);
    for (let j = i + 2; j <= k.length - 2; j++) {
      const b2 = partFix(k.slice(i, j)), c2 = b2 && partFix(k.slice(j));
      if (b2 && c2 && b2[2] !== 'i' && c2[2] !== 'i' && a[2] !== 'i' && FRT.has(strip(b2[0])) + FRT.has(strip(c2[0])) + FRT.has(strip(a[0])) >= 2) take([a, b2, c2], a[1] + b2[1] + c2[1] + 0.2);
    }
  }
  if (!best || (exact && best[2])) return '';
  const common = best[0].every(x => FRT.has(strip(x.toLowerCase())));
  if (best[1] > (common ? 4 : 3)) return '';
  const P = best[0];
  // verbe + pronom (« DISTU » → DIS-TU), sauf après une conjonction (« MAISTU » → MAIS TU)
  if (P.length === 2 && hyph(P[0], P[1])) return P[0] + '-' + P[1];
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
  loadFr();
  // 1.7.1 : pseudonymes des crédits et adresses (« MANGAS-ORIGINES.FR ») mis de côté pendant la correction
  const cm = creditsMask(text);
  text = fixEllipsis(capsLike(cm.t));
  return creditsUnmask(fixFrench0(text).replace(/\b((?:qu|n|c)['’]est) (ce)\b/gi, '$1-$2'), cm.keep);
}
// mot surtout en majuscules (« QUOl », « RENDEZvOus ») : traité comme un mot en majuscules
const mostlyUp = w => { const u = (w.match(/\p{Lu}/gu) || []).length, l = (w.match(/\p{Ll}/gu) || []).length; return !l || (u >= 3 && u >= 2 * l); };
const SUBJ = /(\b(?:ON|IL|ILS|ELLE|ELLES|JE|TU|NOUS|VOUS)\s+|\b[NJ]['’])Y(\p{Lu}{3,})\b/gu;
function fixFrench0(text) {
  loadFr(); load();
  // 1.7.1 : un nombre seul reste un nombre (« ÉPISODE 115 »)
  text = digitWords(halfwidth(text), w => FRK.has(strip(w)), w => FRT.has(strip(w)) ? 0 : 3, true);
  text = frApos(text);
  // « TUES » en début de phrase : TU ES
  text = String(text).replace(/(^|[.!?…]\s*)TUES\b/g, '$1TU ES');
  const upText = mostlyUp(text);
  text = String(text)
    // 1.7.1 : À lu Å ou Ā (« ÅL'INTERIEUR »)
    .replace(/[Δ∆ÅĀĂ]/g, 'À').replace(/(?<!\p{L})[āå](?!\p{L})/gu, upText ? 'À' : 'à')
    .replace(/(?<!\p{L})À(?=\p{L}{2,})/gu, 'À ').replace(/(?<!\p{L})à(?=(\p{L})\p{L})/gu, (m, c) => c === c.toUpperCase() ? 'À ' : 'à ')
    // petit « i » des lettrages de BD dans un mot en majuscules : « CiEL » → CIEL
    .replace(/\p{L}+/gu, m => /\p{Lu}/u.test(m) && /i/.test(m) && m.replace(/i/g, '') === m.replace(/i/g, '').toUpperCase() ? m.replace(/i/g, 'I') : m)
    // 1.7.1 : petit « l » au milieu d'un mot en majuscules : un I sans pieds (« QUOl » → QUOI, « TOl » → TOI), un L si c'est le seul mot connu
    .replace(/\p{L}+/gu, m => {
      if (!/l/.test(m) || (m.match(/\p{Lu}/gu) || []).length < 2 || m.replace(/l/g, '') !== m.replace(/l/g, '').toUpperCase()) return m;
      const I = m.replace(/l/g, 'I'), L = m.replace(/l/g, 'L');
      return !frKnown(I) && frKnown(L) ? L : I;
    })
    // 1.7.1 : « VOUSMEME » → VOUS-MEME
    .replace(/\b(moi|toi|lui|elle|nous|vous|eux|elles|soi)(m[eê]mes?)\b/giu, '$1-$2')
    // 1.7.1 : « ON YENTRE » → ON Y ENTRE, « IL YAVAIT » → IL Y AVAIT (pas « VENTRE »)
    .replace(SUBJ, (m, a, r) => { const k = strip(r.toLowerCase()); return FRK.has(k) && !FRK.has('y' + k) ? a + 'Y ' + r : m; });
  return text.replace(/[\p{L}'’]+/gu, (m, off, all) => {
    // 1.7.1 : lettres collées à des chiffres (« MISSI0N64 », « R2D2 ») : un code, pas un mot
    if (/\d/.test(all[off - 1] || '') || /\d/.test(all[off + m.length] || '')) return m;
    let core = m.replace(/^(?:[Qq][Uu]|\p{L})['’]/u, ''); const pre = m.slice(0, m.length - core.length);
    if (core.length < 2 || !/^[\p{L}]+$/u.test(core)) return m;
    // 1.7.1 : « continuerà » → continuer à (pas « continuera »)
    if (/[àÀ]$/.test(core) && core.length >= 4 && !FR.has(core.toLowerCase()) && FRK.has(strip(core.slice(0, -1).toLowerCase()))) return pre + core.slice(0, -1) + ' ' + core.slice(-1);
    // 1.7.1 : casse mélangée par une lettre mal lue (« RENDEZvOus », « PERCOlS ») : traité en majuscules
    const mixedUp = core !== core.toUpperCase() && mostlyUp(core);
    if (mixedUp) core = core.toUpperCase();
    const k = strip(core.toLowerCase()), up = core === core.toUpperCase();
    // lettrage sans accents : on n'en ajoute pas (« DESQLE » → DESOLE, pas « DÉSOLE »)
    const acc = strip(core) !== core;
    const cap = /^\p{Lu}\p{Ll}/u.test(core);
    const out = s => pre + (up ? (acc ? s : s.split(' ').map(x => x === 'à' ? x : strip(x)).join(' ')).toUpperCase() : cap ? s[0].toUpperCase() + s.slice(1) : s);
    const same = () => mixedUp ? pre + core : m;
    // « ? » lu comme un P collé au mot (« HEINP » → HEIN?)
    if (/p$/.test(k) && k.length >= 3 && !FRK.has(k) && FRK.has(k.slice(0, -1))) return pre + core.slice(0, -1) + '?';
    // 1.7.1 : « ! » lu comme un I collé au dernier mot de la bulle (« CERTITUDESI » → CERTITUDES!)
    if (/i$/.test(k) && k.length >= 5 && !FRK.has(k) && FRK.has(k.slice(0, -1)) && !/\p{L}/u.test(all.slice(off + m.length))) return pre + core.slice(0, -1) + '!';
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
      return same();
    }
    // 1.7.1 : mot anglais courant dans une page en français (« NEEDLE », « Garden », « BLUE », « Designed ») :
    // corrigé seulement vers un mot français très courant (« LINE » → UNE)
    const en = k.length >= 4 && /^[a-z]+$/.test(k) && known(k) && rank(k) <= 3;
    const ok = r => r && (!en || (/[ -]/.test(r) ? r.split(/[ -]/).every(x => FRK.has(strip(x.toLowerCase()))) : FRT.has(strip(r.toLowerCase()))));
    // 1.7.1 : nom à la japonaise (« MURATA », « DANA ») : pas coupé en « MURA TA », « DAN À »
    const nameLike = r => { const P = String(r).split(/[ -]/); return ROMAJI.test(k) && /[aeiou]$/.test(k) && P.length >= 2 && strip(P[P.length - 1].toLowerCase()).length <= 2 && !FRT.has(strip(P[0].toLowerCase())); };
    if (/l/.test(k)) { const u = lToU(k, x => FRK.has(x), x => FRT.has(x) ? 0 : 2, k.length <= 2 ? 0 : 2); if (ok(u)) return out(FRK.get(u) || u); }
    // deux mots très courants collés : préférés à une correction vers un mot rare (« JESUIS » → JE SUIS, pas JÉSUS)
    const s0 = k.length >= 5 ? frSplitN(k) : '';
    const c = frCorrect(core);
    if (s0 && s0.split(' ').every(x => FRT.has(strip(x.toLowerCase()))) && !(c && FRT.has(strip(c)))) return out(s0);
    // 1.7.1 : mots exacts collés plutôt qu'une lettre enlevée ou ajoutée (« PARLERAU » → PARLER AU, pas PARLERA)
    // (pas un petit mot en fin de phrase : « SUR LA DROITET. » → DROITE, pas « DROIT ET. »)
    if (c && strip(c.toLowerCase()).length < k.length) {
      const sx = k.length >= 5 ? frSplitN(k, true) : '';
      const endS = /^\s*(?:[.!?…]|$)/.test(all.slice(off + m.length)), last = strip(String(sx).split(/[ -]/).pop().toLowerCase());
      if (ok(sx) && !nameLike(sx) && !(endS && /^(et|au|aux|de|du|des|le|la|les|un|une|ce|ces|mon|ma|ton|ta|son|sa|ou|a|en)$/.test(last))) return out(sx);
    }
    if (ok(c)) return out(c);
    const s = k.length >= 4 ? frSplit(k) : ''; if (ok(s) && !nameLike(s)) return out(s);
    return same();
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
// 1.7.1 : chiffres lus à la place des lettres, avec les mots anglais et français (sert à garder une ligne peu sûre : « 0O30 » → DOJO)
function digitRepair(text) { load(); loadFr(); return digitWords(halfwidth(text), w => known(w) || FRK.has(strip(w)), w => known(w) ? rank(w) : FRT.has(strip(w)) ? 0 : 3); }
const plausibleAny = w => plausible(w) || frKnown(w);
module.exports.digitRepair = digitRepair; module.exports.plausibleAny = plausibleAny;
module.exports.frAccent = frAccent; module.exports.frApos = frApos;
module.exports.fixFrench = fixFrench; module.exports.frenchRatio = frenchRatio; module.exports.frKnown = frKnown;

// ---------- 1.7.0 refaite : lettres répétées pour crier (« ATTENNNNNTION », « VAAAAS Y », « REAAALLLY ») ----------
// Chaque suite d'au moins 3 lettres identiques est réduite à 1 ou 2 lettres, jusqu'à trouver un vrai mot
// (anglais ou français selon la page). Les cris sans mot (AAAH, HMMM) ne sont pas touchés : ils restent tels quels.
function squeezeWord(w, lang) {
  if (!/(\p{L})\1\1/iu.test(w)) return w;
  const low = w.toLowerCase(), runs = [];
  const re = /(\p{L})\1{2,}/giu; let m;
  while ((m = re.exec(low))) runs.push([m.index, m[0].length]);
  if (runs.length > 4) return w;
  // rang de fréquence du mot (plus petit = plus courant), ou -1 s'il est inconnu
  const rank = x => {
    if (lang !== 'fr') { const D = load(); if (D.has(x) && D.get(x) <= 4) return [D.get(x), x]; }
    if (lang !== 'en') { loadFr(); const k = strip(x); if (FRK.has(k)) return [FRT.has(k) ? 0 : 2, FRK.get(k)]; }
    return null;
  };
  let best = null, bestR = 99, bestLen = 0;
  for (let k = 0; k < (1 << runs.length); k++) {
    let out = '', at = 0;
    runs.forEach(([i, n], j) => { out += low.slice(at, i) + low[i].repeat(k & (1 << j) ? 2 : 1); at = i + n; });
    out += low.slice(at);
    const r = out.length >= 2 && rank(out);
    // le mot le plus courant ; à égalité, la forme la plus longue (« TOOOO » → TOO plutôt que TO)
    if (r && (r[0] < bestR || (r[0] === bestR && out.length > bestLen))) { best = r[1]; bestR = r[0]; bestLen = out.length; }
  }
  if (!best) return w;
  return w === w.toUpperCase() ? best.toUpperCase() : w[0] === w[0].toUpperCase() ? best[0].toUpperCase() + best.slice(1) : best;
}
function squeeze(text, lang) { return String(text).replace(/\p{L}+/gu, w => squeezeWord(w, lang)); }
module.exports.squeeze = squeeze; module.exports.squeezeWord = squeezeWord;
// 1.7.2 : page en anglais : accent inventé par la lecture sur un mot inconnu (« DANTÓN ») retiré ; les vrais mots
// accentués (CAFÉ, NAÏVE…) et les mots d'une autre langue connue sont gardés
function enAccents(text) {
  load();
  return String(text).replace(/\p{L}*[À-ÖØ-öø-ÿ]\p{L}*/gu, w => {
    const l = w.toLowerCase(); if (known(l) || w.length < 3) return w;
    const plain = w.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return /^[A-Za-z]+$/.test(plain) ? plain : w;
  });
}
module.exports.enAccents = enAccents;

// 1.7.2 : texte hors des bulles : notes pour le lecteur (« NB : », « N.B. », « T/N : », « TL NOTE », « NOTE DU TRAD ») → 'note'
// (toujours traduites) ; crédits des équipes, adresses de sites, Discord, @pseudos, page de crédits → 'keep' (laissés en original)
const NOTE_RE = /^\W*(N\s?\.?\s?B\b|T\s?\/\s?N\b|TN\s?:|TL\s?NOTES?\b|NOTE\s+(DU|DE LA|DES)?\s*TRAD|TRANSLATOR'?S?\s+NOTE)/i;
const LINK_RE = /(https?:\/\/|www\.|discord\.(gg|com)|\.(com|net|org|io|fr|xyz|site)\b|@\w{3,})/i;
function outsideRule(text, o = {}) {
  const t = String(text || '');
  if (NOTE_RE.test(t)) return 'note';
  if (o.credPage || LINK_RE.test(t) || (creditsHint(t) > 0 && !o.bubble)) return 'keep';
  return null;
}
module.exports.outsideRule = outsideRule;

// 1.7.2 : mot coupé en fin de ligne dont le tiret a été mal lu (« SPIRI2 TUAL », « TENTA~ CLE », « CER- TAINLY ») :
// recollé quand les deux morceaux forment un mot connu ; et « MANA » (énergie magique) lu « MANIA » dans le lettrage des BD
function joinBroken(text) {
  load();
  // 1.7.2 (signalements de l'utilisateur) : aussi sans espace (« DETONA-TION », mot vertical coupé) et quand le
  // tiret est lu « = » avec une lettre en trop au début de la suite (« MANIPU= ELATION » → MANIPULATION)
  let t = String(text).replace(/(\p{L}{2,})([2~=—–‐‑,-])(\s*)(\p{L}{2,})/gu, (m, a, sep, sp, b) => {
    const A = a.toLowerCase(), Bw = b.toLowerCase(), w = A + Bw;
    if (!/^[a-z]+$/.test(w)) return m;
    // « SPIRIT, TUAL » : le tiret lu comme une lettre suivie d'une virgule
    if (sep === ',') return sp && !known(w) && known((a.slice(0, -1) + b).toLowerCase()) && !known(Bw) ? a.slice(0, -1) + b : m;
    if (!sp && sep === '2') return m; // « MP2 », « B2B »
    // « WH-WHAT », « I-I » : bégaiement, pas un mot coupé
    if (Bw.startsWith(A) || A.length < 2) return m;
    // « WELL-DONE », « SELF-ESTEEM » : vrai tiret entre deux mots connus
    if (known(A) && known(Bw) && /[-‐‑]/.test(sep) && !(known(w) && w.length >= 8 && rank(w) <= Math.max(rank(A), rank(Bw)))) return m;
    if (known(w)) return a + b;
    // une lettre de trop lue au début de la suite (« = ELATION » pour « -LATION »)
    if (Bw.length >= 4 && known(A + Bw.slice(1)) && (A + Bw).length >= 8 && !known(A)) return a + b.slice(1);
    // une seule lettre mal lue dans le mot recollé
    if (!known(A) && w.length >= 8) { const c = correct1(w); if (c && c.c <= 1.25 && c.w.length >= 7) return likeCase(a + b, c.w); }
    return m;
  });
  // 1.7.2 : tiret pas lu du tout, morceau seul suivi d'un mot avec une lettre en trop (« MANIPU ELATION ») ou d'une
  // fin de mot (« EXCI TATION ») : recollés seulement si le morceau n'est pas un mot et que le mot recollé est long et connu
  { // mot par mot (deux paires qui se suivent peuvent se chevaucher : « POWER MANIPU ELATION »)
    const P = t.split(/(\s+)/);
    for (let i = 0; i + 2 < P.length; i += 2) {
      const a = P[i], b = P[i + 2]; if (!/^\p{L}{3,}$/u.test(a) || !/^\p{L}{3,}/u.test(b)) continue;
      const bw = /^\p{L}+/u.exec(b)[0], A = a.toLowerCase(), Bw = bw.toLowerCase(), rest = b.slice(bw.length);
      if (!/^[a-z]+$/.test(A + Bw) || known(A) || APOS.has(A) || SPECIAL[A]) continue;
      let j = '';
      if (known(A + Bw) && (A + Bw).length >= 8 && (!known(Bw) || rank(Bw) >= 4)) j = a + bw;
      else if (Bw.length >= 5 && known(A + Bw.slice(1)) && (A + Bw).length >= 9) j = a + bw.slice(1);
      if (j) { P.splice(i, 3, j + rest); i -= 2; }
    }
    t = P.join('');
  }
  // « SOME'MANA » : apostrophe lue entre deux mots (pas « DON'T », « IT'S », « I'LL »…) → espace
  t = t.replace(/(\p{L}{3,})['’](\p{L}{3,})/gu, (m, a, b) => known((a + b).toLowerCase()) && !/^(s|t|re|ve|ll|d|m)$/i.test(b) ? a + b : (/^(s|t|re|ve|ll|d|m|em|clock|n)$/i.test(b) || !known(a.toLowerCase()) || !known(b.toLowerCase()) && !/^mana$/i.test(b)) ? m : a + ' ' + b);
  t = t.replace(/\bMANIA\b/g, 'MANA');
  // 1.7.2 : « MANG » (A final lu comme un G) : MANA ; « MANGA » n'est pas touché
  t = t.replace(/\bMANG\b(?!A)/g, 'MANA');
  return t;
}
module.exports.joinBroken = joinBroken;

// 1.7.2 (signalement de l'utilisateur) : mots anglais restés tels quels dans la traduction française
// (« THIS FORM IS HARDER! » → « THIS La forme est plus dure ») : mots du texte anglais, connus en anglais, inconnus en
// français, et qui ne sont pas des noms gardés exprès. Sert à refaire la traduction autrement (phrase par phrase).
function leftoverEn(src, out, keepWords = []) {
  load(); loadFr();
  const S = new Set((String(src).match(/\p{L}+/gu) || []).map(w => w.toLowerCase()));
  const K = new Set((keepWords || []).flatMap(k => String(k).toLowerCase().match(/\p{L}+/gu) || []));
  return (String(out).match(/\p{L}{2,}/gu) || []).filter(w => {
    const l = w.toLowerCase();
    return S.has(l) && !K.has(l) && /^[a-z]+$/.test(l) && known(l) && rank(l) <= 3 && !frKnown(l) && !ROMAJI.test(l);
  });
}
module.exports.leftoverEn = leftoverEn;

// 1.7.2 : fin d'un mot lue à part, comme une petite zone séparée (« CORE EXCI SPIRAL » + « TATION » à côté, gros
// lettrage sur un fond chargé) : le morceau est remis dans son mot quand le mot recollé est long et connu, et que les
// deux zones se touchent presque. Retourne la liste des zones (sans le morceau rattaché).
function joinGroups(groups) {
  load();
  const out = groups.slice(); const drop = new Set();
  const frag = w => /^[a-z]{3,}$/.test(w) && (!known(w) || rank(w) >= 4);
  for (let h = 0; h < out.length; h++) {
    const H = out[h]; const u = String(H.text || '').trim();
    if (!/^\p{L}{3,}[!?.…]*$/u.test(u)) continue;
    const uw = u.match(/^\p{L}+/u)[0], U = uw.toLowerCase(); if (!frag(U)) continue;
    const hh = H.y1 - H.y0;
    for (let g = 0; g < out.length; g++) {
      if (g === h || drop.has(g) || drop.has(h)) continue;
      const G = out[g];
      // les deux zones se touchent (écart de moins d'une hauteur de ligne)
      const gap = Math.max(G.x0 - H.x1, H.x0 - G.x1, G.y0 - H.y1, H.y0 - G.y1, 0); if (gap > hh * 1.2) continue;
      let done = false;
      const t = String(G.text).replace(/\p{L}{3,}/gu, w => {
        if (done) return w; const W = w.toLowerCase();
        if (known(W) && rank(W) < 4) return w;
        if (known(W + U) && (W + U).length >= 8) { done = true; return w + (w === w.toUpperCase() ? uw.toUpperCase() : uw.toLowerCase()); }
        return w;
      });
      if (!done) continue;
      out[g] = { ...G, text: t, x0: Math.min(G.x0, H.x0), y0: Math.min(G.y0, H.y0), x1: Math.max(G.x1, H.x1), y1: Math.max(G.y1, H.y1) };
      drop.add(h); break;
    }
  }
  const r = out.filter((_, i) => !drop.has(i));
  for (const k of Object.keys(groups)) if (!/^\d+$/.test(k)) r[k] = groups[k];
  return r;
}
module.exports.joinGroups = joinGroups;

// 1.7.2 : paragraphe d'une page de texte (« mise en page fidèle ») : traduit, sauf s'il est surtout fait de pseudonymes,
// d'adresses et de rôles (liste de crédits) ; les adresses et pseudonymes d'un paragraphe traduit restent tels quels
const LINK_TERM = /(?:https?:\/\/\S+(?:\s+\S+\.)?(?:\s*\S+)?|www\.\S+|@[\w.-]+(?:#\d{3,5})?|\w+#\d{3,5}|\(![\w]+\)|\/a\/\w*|[\w-]+\.(?:moe|com|net|org|io|gg|fr|xyz|site)\b\S*)/gi;
function linesRule(text) {
  const t = String(text || '');
  if (NOTE_RE.test(t)) return 'note';
  const words = (t.match(/[\p{L}\d]+/gu) || []).length || 1;
  const links = (t.match(LINK_TERM) || []).length, roles = (t.match(ROLE_PAIR) || []).length + (t.match(/\b(?:KR|JP|EN|CN)\s*-?\s*>\s*(?:EN|FR)\b/gi) || []).length + (t.match(/\s-\s/g) || []).length
    + (t.match(/\b(?:raws?|providers?|trans|typeset(?:ter|ting)?|clean(?:er|ing)?|proofread(?:er|ing)?|translators?|anons?|redraw(?:er)?s?|qc|uploaders?)\b/gi) || []).length;
  return (links * 3 + roles * 2) / words >= 0.45 ? 'keep' : null;
}
const linkTerms = text => [...new Set((String(text || '').match(LINK_TERM) || []).map(s => s.trim()).filter(s => s.length >= 3))];
module.exports.linesRule = linesRule;
module.exports.linkTerms = linkTerms;
