// 1.7.0 refaite : la traduction IA ne reste plus bloquée (« Lecture des images… » sans fin).
const { spawnSync } = require('child_process'); const path = require('path');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const el = require('electron');
const p = spawnSync(el, ['--no-sandbox', path.join(__dirname, 'fixtures', 'ai-main.js')], { encoding: 'utf8', timeout: 60000 });
const line = (p.stdout || '').split('\n').find(l => l.startsWith('RESULT '));
if (!line) { ok('script IA lancé', false, (p.stderr || '').slice(-400)); process.exit(1); }
const R = Object.fromEntries(JSON.parse(line.slice(7)).map(x => [x.name, x]));
ok('réponse normale', R.normal.ok && R.normal.tr === 'BONJOUR', R.normal);
ok('service qui ne répond pas : erreur après le délai (pas de blocage)', !R.hang.ok && R.hang.ms < 5000 && /délai/.test(R.hang.err), R.hang);
ok('réglage de réflexion refusé : nouvel essai sans lui', R.thinking.ok && R.thinking.calls >= 2, R.thinking);
ok('limite par minute : attente puis nouvel essai réussi', R.minute.ok, R.minute);
ok('limite du jour : signalée comme telle', !R.day.ok && R.day.quota, R.day);
ok('clé refusée : signalée', !R.badkey.ok && R.badkey.badKey, R.badkey);
ok('vérification d\'une bonne clé', R['check-good'].ok === true, R['check-good']);
ok('vérification d\'une mauvaise clé', R['check-bad'].ok === false && R['check-bad'].bad === true, R['check-bad']);
// 1.7.1 : Google surchargé (HTTP 503)
ok('service surchargé une fois : nouvel essai réussi', R.busyonce.ok, R.busyonce);
ok('modèle surchargé : un autre modèle gratuit prend le relais', R.busyalt.ok, R.busyalt);
ok('tous surchargés : signalé comme surcharge (pas une clé refusée)', !R.busyall.ok && R.busyall.busy && !R.busyall.badKey, R.busyall);
