// 1.7.0 (correction) : lecture des BD et mangas en français — erreurs relevées sur de vraies pages (gardées en privé) :
// mots collés, apostrophe oubliée, lettre fine en trop, accent mal lu ; et accents remis pour la traduction seulement
const path = require('path');
const SF = require(path.resolve(__dirname, '../src/main/scan-fix.js'));
const M = require(path.resolve(__dirname, '../src/main/modules.js'));
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const cases = [
  ["J'AIPEUR", "J'AI PEUR"], ['JESUIS PAS', 'JE SUIS PAS'], ["AL'ACCLEIL", "A L'ACCUEIL"], ["ILN'AVAIT", "IL N'AVAIT"],
  ['TROUVECA', 'TROUVE CA'], ['UINE FILLE', 'UNE FILLE'], ["D'UINE", "D'UNE"], ['SEUUEMENTUN', 'SEULEMENT UN'],
  ["QU'ESTCE QUI", "QU'EST-CE QUI"], ["N'ESTCEPAS", "N'EST-CE PAS"], ['ÉTRE', 'ÊTRE'], ['TÓI', 'TOI'], ['SÜR', 'SÛR'],
  ["JEM'ENTRAINAIS", "JE M'ENTRAINAIS"], ['AUMANIEMENT', 'AU MANIEMENT'], ['CEST', "C'EST"], ['NAURAIT', "N'AURAIT"],
  ['DISTU', 'DIS-TU'], ['MAISTU', 'MAIS TU'], ['POUR MAPART', 'POUR MA PART'],
  // ne pas abîmer : noms, mots justes, mots absents du dictionnaire
  ['TELS QUE VOUS', 'TELS QUE VOUS'], ['NATHAN', 'NATHAN'], ['TIFAINE', 'TIFAINE'], ['KOMACHIYO', 'KOMACHIYO'],
  ['PLATEFORME', 'PLATEFORME'], ["QU'IL", "QU'IL"], ["AUJOURD'HUI", "AUJOURD'HUI"], ["QUELQU'UN", "QUELQU'UN"], ['BELLE VILLE', 'BELLE VILLE'],
];
for (const [a, b] of cases) { const r = SF.fixFrench(a); ok(`${a} → ${b}`, r === b, r); }
const t = M.forMT("CA FAIT DES ANNEES QU'ON EST AMIS. C'ETAIT BIEN SUR PREVU, PEUT-ETRE.", true, 'fr');
ok('accents remis pour la traduction (texte affiché inchangé)', t === "Ça fait des années qu'on est amis. C'était bien sûr prévu, peut-être.", t);
const e = M.forMT('WE ARE GOING TO THE STATION.', true, 'en');
ok('anglais : pas d\'accents ajoutés', !/[À-ÿ]/.test(e), e);
// 1.7.0 refaite : lettres répétées pour crier
{
  const SF2 = require('../src/main/scan-fix.js');
  for (const [x, l, y] of [['ATTENNNNNTION', 'fr', 'ATTENTION'], ['VAAAAAS Y !', 'fr', 'VAS Y !'], ['REAAALLLY ?', 'en', 'REALLY ?'], ['GOOOOD', 'en', 'GOOD'], ['TOOOO MUCH', 'en', 'TOO MUCH'], ['HMMMM', 'en', 'HMMMM'], ['Attennnnntion', 'fr', 'Attention']]) {
    const r = SF2.squeeze(x, l); console.log((r === y ? 'OK  ' : 'ÉCHEC ') + `cri « ${x} » → ${y}`, JSON.stringify(r));
  }
}
// 1.7.0 refaite : lettrage dessiné à la main (vieilles BD)
{
  const SF3 = require('../src/main/scan-fix.js');
  for (const [x, y] of [['COURANT, YOUS?', 'COURANT, VOUS?'], ['POUR QUELQUE CHOSEH', 'POUR QUELQUE CHOSE'], ['SI VOUS N\'ÉTIEZ PAS INTERVEND', 'SI VOUS N\'ÉTIEZ PAS INTERVENU'], ['LE SEROENT', 'LE SERGENT'], ['UNE LUEDR', 'UNE LUEUR'], ['J\'ai quelques questions', 'J\'ai quelques questions'], ['MAIS QUELS IDIOTS!', 'MAIS QUELS IDIOTS!'], ["IL N'YA RIEN", "IL N'YA RIEN"]]) {
    const r = SF3.fixFrench(x); console.log((r === y ? 'OK  ' : 'ÉCHEC ') + `lettrage à la main « ${x} » → ${y}`, JSON.stringify(r));
  }
}
// 1.7.0 refaite : images enregistrées par l'utilisateur (15 nov.)
{
  const SF4 = require('../src/main/scan-fix.js');
  for (const [x, y] of [['….ou ARE MY ENEMIES.', '….YOU ARE MY ENEMIES.'], ['IF ONLY ALL OWNERS WERE LIKE you.', 'IF ONLY ALL OWNERS WERE LIKE YOU.'], ['...You ARE MY ENEMIES.', '...YOU ARE MY ENEMIES.'], ['HAT?', 'WHAT?'], ['SPARE SPIRITHAL POWER.', 'SPARE SPIRITUAL POWER.'], ['SCANLATION', 'SCANLATION'], ['Hello you are nice', 'Hello you are nice'], ['THE HAT IS RED', 'THE HAT IS RED']]) {
    const r = SF4.fixWords(x); console.log((r === y ? 'OK  ' : 'ÉCHEC ') + `« ${x} » → ${y}`, JSON.stringify(r));
  }
}
// 1.7.1 (version perso) : mots du dictionnaire jamais coupés, crédits, chiffres lus pour des lettres, points de suspension,
// lettrages des vieilles BD ; et les noms ou nombres qui ne doivent pas changer
{
  const SF5 = require('../src/main/scan-fix.js');
  const en = [['PROOFREADER', 'PROOFREADER'], ['SWORDSMAN', 'SWORDSMAN'], ['PROOFREADERS: KIM', 'PROOFREADERS: KIM'], ['TL: KIM / TS: BEC', 'TL: KIM / TS: BEC'],
    ['THIS IS MY 0O30!', 'THIS IS MY DOJO!'], ['6OOD JOB!', 'GOOD JOB!'], ['100 YEARS', '100 YEARS'], ['I HAVE 600 YEN', 'I HAVE 600 YEN'], ['HE IS 1O', 'HE IS 1O'],
    ['..NO.', '...NO.'], ['WAIT..', 'WAIT...'], ['Hello You are', 'Hello You are'], ['COVID19', 'COVID19'], ['CHECK THIS OUT!', 'CHECK THIS OUT!']];
  for (const [x, y] of en) { const r = SF5.fixWords(x); console.log((r === y ? 'OK  ' : 'ÉCHEC ') + `1.7.1 « ${x} » → ${y}`, JSON.stringify(r)); }
  const fr = [['ILS DEVRAENT VENIR.', 'ILS DEVRAIENT VENIR.'], ['IL FAUT BENENTRAINER.', 'IL FAUT BIEN ENTRAINER.'], ['ON YENTRE, MAIS', 'ON Y ENTRE, MAIS'],
    ["C'ESTLA", "C'EST LA"], ['VOUSMEME', 'VOUS-MEME'], ['MAISILSVONT', 'MAIS ILS VONT'], ['ILSY VONT', 'ILS Y VONT'], ['PARLERAU CHEF', 'PARLER AU CHEF'],
    ['REGARDEZ SUR LA DROITET.', 'REGARDEZ SUR LA DROITE.'], ['QUOl,', 'QUOI,'], ['LINE FILLE', 'UNE FILLE'], ['JE VOUSASSURE...', 'JE VOUS ASSURE...'],
    ['il faut continuerà', 'il faut continuer à'], ["ÅL'INTERIEUR", "À L'INTERIEUR"], ['TU VOIS..', 'TU VOIS...'],
    // ne pas abîmer : nombres, noms, mots des mangas, adresses, crédits, mots anglais
    ['ÉPISODE 115', 'ÉPISODE 115'], ['YUSUKE MURATA', 'YUSUKE MURATA'], ['RIEN, DANA.', 'RIEN, DANA.'], ['BONNEY', 'BONNEY'], ['ULTI,', 'ULTI,'], ['GENOS.', 'GENOS.'],
    ['SERGENT POTTS', 'SERGENT POTTS'], ['MANGA', 'MANGA'], ['TRAD', 'TRAD'], ['TRADUCTION :SEBASTIEN LUDMANN', 'TRADUCTION :SEBASTIEN LUDMANN'],
    ['SURMANGAS-ORIGINES.FR', 'SURMANGAS-ORIGINES.FR'], ['NEEDLE!', 'NEEDLE!'], ['BLUE', 'BLUE'], ['MISSI0N64', 'MISSI0N64']];
  for (const [x, y] of fr) { const r = SF5.fixFrench(x); console.log((r === y ? 'OK  ' : 'ÉCHEC ') + `1.7.1 « ${x} » → ${y}`, JSON.stringify(r)); }
  const cr = SF5.isCreditsPage(['RAW: KHALID ICLEANER: DIZAI', 'ÉDITEUR: DIZAI Q-CHECK: TOSHIRO', 'DISCORD.GG/abc'], 3, 3), st = SF5.isCreditsPage(["ICI, C'EST LE PIRE AQUARIUM DU MONDE.", 'TU VOIS LA TRADUCTION?', 'JE VAIS CHECK'], 3, 3);
  console.log((cr && !st ? 'OK  ' : 'ÉCHEC ') + '1.7.1 page de crédits reconnue, page d\'histoire non', JSON.stringify([cr, st]));
  const N = {}; for (let i = 0; i < 3; i++) SF5.learnNames(['TIFAINE, TU SAIS QUE NATHAN EST LÀ ?'], N, 'fr');
  const nf = SF5.fixNames('TIFAlNE ARRIVE', N, 'fr');
  console.log((nf === 'TIFAINE ARRIVE' && !N.SAIS ? 'OK  ' : 'ÉCHEC ') + '1.7.1 noms appris aussi en français', JSON.stringify([nf, N]));
}
// 1.7.1 (version perso) : tableau de noms (2 colonnes de cases régulières) laissé tel quel ; bulles normales traduites
{
  const M7 = require('../src/main/modules.js');
  const g = [{ x0: 220, y0: 800, x1: 500, y1: 1140, text: 'HUGE UPSET!!' }, { x0: 56, y0: 1565, x1: 305, y1: 1867, text: '...BUT NOW HERE WE ARE AT FOUR AND FOUR!!' }];
  const names = ['MADARAI MASUJI', 'SUSUZUMI SUGURU', 'SHIOIORI SHIORI', 'TAGUSARI TAKUMI', 'WASHIGAMI WAKANA'], right = ['KAGAMI KAZU', 'FOX MASK', 'ORIOBANA OU', 'SHISHIZAKI SHINKUROU', 'HIGASHINA HIYORI'];
  names.forEach((t, k) => g.push({ x0: 400, y0: 1570 + k * 80, x1: 630, y1: 1610 + k * 80, text: t }));
  right.forEach((t, k) => g.push({ x0: 870, y0: 1570 + k * 80, x1: 1100, y1: 1610 + k * 80, text: t }));
  const t = M7.tableCells(g);
  console.log((t.slice(2).every(Boolean) && !t[0] && !t[1] ? 'OK  ' : 'ÉCHEC ') + '1.7.1 tableau de noms gardé tel quel, bulles traduites', JSON.stringify(t));
  const one = M7.tableCells(g.slice(0, 2).concat(g.slice(2, 6)));
  console.log((!one.some(Boolean) ? 'OK  ' : 'ÉCHEC ') + '1.7.1 une seule colonne : pas un tableau', JSON.stringify(one));
}
