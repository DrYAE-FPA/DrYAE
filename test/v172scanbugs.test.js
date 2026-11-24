// 1.7.2 : signalements de traduction envoyés par l'utilisateur (GitHub #1 à #4)
const SF = require('../src/main/scan-fix.js');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const J = SF.joinBroken;
ok('#3 mot vertical coupé : « DETONA-TION DRILL » → DETONATION DRILL', J('DETONA-TION DRILL') === 'DETONATION DRILL', J('DETONA-TION DRILL'));
ok('#4 tiret lu « = » et lettre en trop : « MANIPU= ELATION » → MANIPULATION', J('INTERNAL SPIRITUAL POWER MANIPU= ELATION') === 'INTERNAL SPIRITUAL POWER MANIPULATION', J('INTERNAL SPIRITUAL POWER MANIPU= ELATION'));
ok('#1 « MANG FULL RELEASE » → MANA FULL RELEASE (MANGA pas touché)', J('MANG FULL RELEASE') === 'MANA FULL RELEASE' && J('READ THE MANGA') === 'READ THE MANGA');
const keepSame = ['WELL-DONE', 'SELF-ESTEEM', 'WH-WHAT?!', "I-I DON'T", 'MP2 PLAYER', 'KANA-CHAN', 'DEMON-SLAYER'];
ok('vrais tirets et bégaiements gardés', keepSame.every(s => J(s) === s), keepSame.map(J));
ok('anciens cas toujours bons (SPIRI2 TUAL, EXCEL- LENT)', J('SPIRI2 TUAL POWER') === 'SPIRITUAL POWER' && J('EXCEL- LENT') === 'EXCELLENT');
ok('#2 mot anglais resté dans la traduction repéré (« THIS La forme… »)', SF.leftoverEn('THIS FORM IS HARDER! FASTER!! STRONGER!!!', 'THIS La forme est plus dure ! Plus vite !! Plus Fort !!!').join() === 'THIS');
ok('pas de fausse alerte : noms gardés, mots identiques en français', !SF.leftoverEn('MANA FULL RELEASE', 'MANA version complète', ['MANA']).length && !SF.leftoverEn('THE MESSAGE IS ORANGE', 'Le message est orange').length && !SF.leftoverEn('I SEE IT! DABADA', 'Je le vois ! DABADA').length);
ok('tiret pas lu du tout : « MANIPU ELATION » → MANIPULATION ; « SOME’MANA » → SOME MANA', J('INTERNAL SPIRITUAL POWER MANIPU ELATION') === 'INTERNAL SPIRITUAL POWER MANIPULATION' && J("I WAS SAVING SOME'MANA TO") === 'I WAS SAVING SOME MANA TO' && J("QU'EST-CE QUE") === "QU'EST-CE QUE" && J('KAZU YA') === 'KAZU YA');
{ const g = [{ x0: 720, y0: 1072, x1: 1245, y1: 1628, text: 'CORE EXCI SPIRAL' }, { x0: 974, y0: 1272, x1: 1356, y1: 1430, text: 'TATION' }, { x0: 10, y0: 10, x1: 100, y1: 50, text: 'HELLO' }];
  const r = SF.joinGroups(g); ok('fin de mot lue à part (« EXCI » + « TATION ») remise dans son mot', r.length === 2 && r[0].text === 'CORE EXCITATION SPIRAL' && r[0].x1 === 1356, r.map(x => x.text)); }
ok('zones éloignées jamais recollées', SF.joinGroups([{ x0: 0, y0: 0, x1: 100, y1: 40, text: 'I SEE' }, { x0: 0, y0: 300, x1: 100, y1: 340, text: 'TATION' }]).length === 2);
