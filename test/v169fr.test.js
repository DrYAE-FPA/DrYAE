// 1.6.9 : lecture du français (BD, mangas en VF) — confusions de lettres corrigées, noms laissés tels quels ;
// cris gardés ; anglais toujours corrigé. Test sans fenêtre (module scan-fix seul).
const path = require('path');
const SF = require(path.join(__dirname, '..', 'src', 'main', 'scan-fix.js'));
const M = require(path.join(__dirname, '..', 'src', 'main', 'modules.js'));
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const eq = (n, a, b) => ok(n, a === b, a === b ? undefined : { lu: a, attendu: b });
eq('U lu L (SLIS, VOLS, NOLVEAU)', SF.fixFrench('COMME JE SLIS RAVI DE VOLS SAVOIR EN ViE ET DE NOLVEAU RÉLINiS'), 'COMME JE SUIS RAVI DE VOUS SAVOIR EN VIE ET DE NOUVEAU RÉUNIS');
eq('O lu Q (ALQRS)', SF.fixFrench('ALQRS, C\'EST QLOi ENCORE ?'), 'ALORS, C\'EST QUOI ENCORE ?');
eq('petit « i » des lettrages et Δ', SF.fixFrench('JADiNA! COMBiEN DE TEMPS POUR ARRIVER ΔOROBAN?'), 'JADINA! COMBIEN DE TEMPS POUR ARRIVER À OROBAN?');
eq('mots collés (TIENSA, MORDSMOI, DISTU)', SF.fixFrench('SI TU TIENSA LA VIE, MORDSMOI! QUE DISTU DE M\'NVITER'), 'SI TU TIENS À LA VIE, MORDS-MOI! QUE DIS-TU DE M\'INVITER');
eq('noms laissés tels quels (ABYSS, JU-HEE, DEL)', SF.fixFrench('JE SUIS ABYSS. MISS JU-HEE. ARTEMUS DEL'), 'JE SUIS ABYSS. MISS JU-HEE. ARTEMUS DEL');
eq('« ? » lu P, TUES en début de phrase', SF.fixFrench('TUES DESQLE? HEINP'), 'TU ES DESOLE? HEIN?');
ok('page française reconnue', SF.frenchRatio(['COMME JE SUIS RAVI DE VOUS SAVOIR EN VIE']) > 0.8 && SF.englishRatio(['COMME JE SUIS RAVI DE VOUS SAVOIR EN VIE']) < 0.35);
eq('anglais toujours corrigé', SF.fixWords('ISNT THAT THE OUTSIOER. WE ARE TQULY SORRY IFYOU'), "ISN'T THAT THE OUTSIDER. WE ARE TRULY SORRY IF YOU");
ok('cris gardés (AHHH, FUFU AHAHA)', M.interjection('AHHH...') && M.interjection('FUFU, AHAHA HA!') && !M.interjection('AHHH, IS THAT SOOO?'));
