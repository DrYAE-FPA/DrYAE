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
