// 1.7.2 : « Tutoyer dans les scans » : la traduction française passe du vouvoiement au tutoiement quand l'anglais
// parle à UNE personne (dans les mangas, les personnages se tutoient le plus souvent). « Vous » est gardé quand
// l'anglais parle à plusieurs personnes (« you guys », « all of you », « everyone »…) ou quand rien ne dit « you ».
'use strict';
const PLURAL = /\b(you\s+(guys|all|two|three|people|folks|lot|both|kids|boys|girls|men|bastards|idiots|fools)|all\s+of\s+you|both\s+of\s+you|each\s+of\s+you|y'?all|everyone|everybody|guys|ladies|gentlemen|you\s+lot)\b/i;
const SING = /\b(you|your|yours|yourself|you're|you've|you'll|you'd|ya|ur)\b/i;
// verbe conjugué avec « vous » → avec « tu »
const IRREG = { 'êtes': 'es', avez: 'as', allez: 'vas', pouvez: 'peux', voulez: 'veux', devez: 'dois', savez: 'sais', faites: 'fais', dites: 'dis', venez: 'viens', tenez: 'tiens', prenez: 'prends', comprenez: 'comprends', apprenez: 'apprends', voyez: 'vois', croyez: 'crois', buvez: 'bois', recevez: 'reçois', mettez: 'mets', battez: 'bats', vivez: 'vis', suivez: 'suis', écrivez: 'écris', lisez: 'lis', connaissez: 'connais', partez: 'pars', sortez: 'sors', dormez: 'dors', sentez: 'sens', servez: 'sers', courez: 'cours', mourez: 'meurs', ouvrez: 'ouvres', offrez: 'offres', souffrez: 'souffres', choisissez: 'choisis', finissez: 'finis', réussissez: 'réussis', agissez: 'agis', réfléchissez: 'réfléchis', obéissez: 'obéis', attendez: 'attends', entendez: 'entends', vendez: 'vends', rendez: 'rends', répondez: 'réponds', perdez: 'perds', descendez: 'descends', défendez: 'défends', êtiez: 'étais', étiez: 'étais', aviez: 'avais', alliez: 'allais', pouviez: 'pouvais', vouliez: 'voulais', saviez: 'savais', faisiez: 'faisais', serez: 'seras', aurez: 'auras', irez: 'iras', pourrez: 'pourras', voudrez: 'voudras', ferez: 'feras', serait: 'serait', seriez: 'serais', auriez: 'aurais', pourriez: 'pourrais', voudriez: 'voudrais', devriez: 'devrais', feriez: 'ferais' };
// impératif (« Attendez ! ») → « Attends ! »
const IMPER = { attendez: 'attends', arrêtez: 'arrête', regardez: 'regarde', écoutez: 'écoute', venez: 'viens', dites: 'dis', faites: 'fais', partez: 'pars', courez: 'cours', fuyez: 'fuis', laissez: 'laisse', donnez: 'donne', prenez: 'prends', montrez: 'montre', aidez: 'aide', sauvez: 'sauve', restez: 'reste', reculez: 'recule', suivez: 'suis', allez: 'va', soyez: 'sois', ayez: 'aie', ouvrez: 'ouvre', fermez: 'ferme', lâchez: 'lâche', tenez: 'tiens', mangez: 'mange', dormez: 'dors', répondez: 'réponds', ignorez: 'ignore', oubliez: 'oublie', pardonnez: 'pardonne', essayez: 'essaie', choisissez: 'choisis', finissez: 'finis', entrez: 'entre', sortez: 'sors', approchez: 'approche', bougez: 'bouge', parlez: 'parle', racontez: 'raconte', expliquez: 'explique', comptez: 'compte' };
const REFL = { 'taisez-vous': 'tais-toi', 'calmez-vous': 'calme-toi', 'dépêchez-vous': 'dépêche-toi', 'arrêtez-vous': 'arrête-toi', 'asseyez-vous': 'assieds-toi', 'levez-vous': 'lève-toi', 'reposez-vous': 'repose-toi', 'cachez-vous': 'cache-toi', 'rendez-vous': 'rends-toi', 'excusez-moi': 'excuse-moi', 'pardonnez-moi': 'pardonne-moi', 'laissez-moi': 'laisse-moi', 'aidez-moi': 'aide-moi', 'écoutez-moi': 'écoute-moi', 'regardez-moi': 'regarde-moi', 'suivez-moi': 'suis-moi', 'dites-moi': 'dis-moi', 'donnez-moi': 'donne-moi', 'montrez-moi': 'montre-moi', 'croyez-moi': 'crois-moi', 'attendez-moi': 'attends-moi', 'vous-même': 'toi-même' };
const VOW = /^[aeiouyàâéèêëîïôûùh]/i;
const keepCase = (src, t) => src === src.toUpperCase() && /\p{L}/u.test(src) ? t.toUpperCase() : /^\p{Lu}/u.test(src) ? t[0].toUpperCase() + t.slice(1) : t;
const FEM = /(e|ion|té|ure|ance|ence|ie|ude)$/i;
function verbTu(v) {
  const l = v.toLowerCase();
  if (IRREG[l]) return keepCase(v, IRREG[l]);
  if (/(erez|irez|vrez|rrez|aurez|tiendrez|viendrez|faudrez)$/.test(l)) return keepCase(v, l.replace(/ez$/, 'as')); // devrez → devras (futur)
  if (/iez$/.test(l) && l.length > 5) return keepCase(v, l.replace(/iez$/, 'ais')); // vouliez → voulais
  if (/ez$/.test(l) && l.length > 4) return keepCase(v, l.replace(/ez$/, 'es')); // parlez → parles
  return null;
}
function toTu(fr, en) {
  if (!fr || PLURAL.test(en || '')) return fr;
  let t = String(fr);
  // impératif (« Taisez-vous », « Attendez ! ») : l'anglais ne dit pas « you »
  const imper = s2 => s2.replace(/(^|[.!?…]\s*|["«“]\s*)(\p{L}+)(?=\s*[!.,…?]|\s+(?:ici|là|vite|un peu|ça|ce|cette|le|la|les|moi|ton|ta|tes)\b|$)/gu, (m, p, v) => { const l = v.toLowerCase(); return IMPER[l] ? p + keepCase(v, IMPER[l]) : m; });
  if (!SING.test(en || '')) { for (const [a, b] of Object.entries(REFL)) t = t.replace(new RegExp('(^|[^\\p{L}])(' + a + ')(?![\\p{L}])', 'giu'), (m, p, w) => p + keepCase(w, b)); return /^\s*\p{L}+\s*[!.]/u.test(en || '') || /\b(wait|stop|look|listen|run|come|go|shut|stay|get|leave|give|take|help|hurry|calm)\b/i.test(en || '') ? imper(t) : t; }
  if (!/\bvous|\bvotre|\bvos\b|\bvôtre|ez\b/i.test(t)) return t;
  for (const [a, b] of Object.entries(REFL)) t = t.replace(new RegExp('(^|[^\\p{L}])(' + a + ')(?![\\p{L}])', 'giu'), (m, p, w) => p + keepCase(w, b));
  // question inversée : « Où allez-vous ? » → « Où vas-tu ? », « Êtes-vous prêt ? » → « Es-tu prêt ? »
  t = t.replace(/(\p{L}+)-(vous)(?![\p{L}-])(?=[^.!]*\?)/giu, (m, v, a) => { const tv = verbTu(v); return tv ? tv + '-' + keepCase(a, 'tu') : m; });
  // « vous vous VERBEZ » → « tu te VERBES »
  t = t.replace(/(^|[^\p{L}])(vous)(\s+)(vous)(\s+)(\p{L}+)/giu, (m, p, a, s1, b, s2, v) => { const tv = verbTu(v); return tv ? p + keepCase(a, 'tu') + s1 + keepCase(b, VOW.test(tv) ? "t'" : 'te') + (VOW.test(tv) ? '' : s2) + tv : m; });
  // sujet : « vous VERBEZ » → « tu VERBES » (aussi « vous ne VERBEZ »)
  t = t.replace(/(^|[^\p{L}'’])(vous)(\s+)(ne\s+|n['’])?(\p{L}+)/giu, (m, p, a, s1, ne, v) => { const tv = verbTu(v); return tv ? p + keepCase(a, 'tu') + s1 + (ne || '') + tv : m; });
  // après une préposition : « avec vous » → « avec toi »
  t = t.replace(/(\b(?:avec|pour|à|chez|de|sans|contre|comme|que|sur|vers|derrière|devant|après|avant|entre|et|ou|c['’]est)\s+)(vous)(?![\p{L}-])/giu, (m, p, a) => p + keepCase(a, 'toi'));
  // complément devant un verbe : « je vous aime » → « je t'aime », « il vous a vu » → « il t'a vu »
  t = t.replace(/(^|[^\p{L}])(vous)(\s+)(\p{L}+)/giu, (m, p, a, s1, v) => p + (VOW.test(v) ? keepCase(a, "t'") : keepCase(a, 'te') + s1) + v);
  t = t.replace(/(^|[^\p{L}])(vos)(?=\s)/giu, (m, p, a) => p + keepCase(a, 'tes'));
  t = t.replace(/(^|[^\p{L}])(la vôtre|le vôtre|les vôtres)(?![\p{L}])/giu, (m, p, a) => p + keepCase(a, { 'la vôtre': 'la tienne', 'le vôtre': 'le tien', 'les vôtres': 'les tiens' }[a.toLowerCase()]));
  t = t.replace(/(^|[^\p{L}])(votre)(\s+)(\p{L}+)/giu, (m, p, a, s1, n) => p + keepCase(a, VOW.test(n) ? 'ton' : FEM.test(n) ? 'ta' : 'ton') + s1 + n);
  // impératif en début de phrase : « Attendez ! » → « Attends ! »
  return imper(t);
}
module.exports = { toTu };
