// 1.7.0 refaite : « Traduction sur le PC » (modèles libres de Mozilla, moteur fxtranslate).
// Les modèles ne peuvent être téléchargés que sur une machine avec internet (GitHub Actions) : ailleurs, test ignoré.
const { spawnSync } = require('child_process'); const path = require('path');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 900) : '');
const el = require('electron');
const p = spawnSync(el, ['--no-sandbox', path.join(__dirname, 'fixtures', 'localmt-main.js')], { encoding: 'utf8', timeout: 900000 });
const line = (p.stdout || '').split('\n').find(l => l.startsWith('RESULT '));
if (!line) { ok('script lancé', false, (p.stderr || p.stdout || '').slice(-600)); process.exit(1); }
const R = JSON.parse(line.slice(7));
if (R.skip) { console.log('OK  test ignoré (modèles inaccessibles ici) :', R.skip.slice(0, 120)); process.exit(0); }
console.log('RAPPORT ' + JSON.stringify(R));
ok('anglais → français traduit sur le PC', !R.enfr_first.error && R.enfr_first.texts.every(t => t && !/^[A-Z][a-z ]+\?$/.test(t)) && R.enfr_first.from === 'en', R.enfr_first);
ok('deuxième page plus rapide (modèle gardé en mémoire)', !R.enfr_again.error && R.enfr_again.ms < R.enfr_first.ms, { first: R.enfr_first.ms, again: R.enfr_again.ms });
ok('japonais → français en passant par l\'anglais', !R.jafr.error && R.jafr.from === 'ja' && R.jafr.pivot === 'en', R.jafr);
ok('anglais → espagnol', !R.enes.error, R.enes);
ok('langue reconnue sur le PC (fr, en, ja, ko)', R.detect.fr === 'fr' && R.detect.en === 'en' && R.detect.ja === 'ja' && R.detect.ko === 'ko', R.detect);
ok('modèles téléchargés (taille sur le disque)', R.installed.length >= 3 && R.size > 1e6, { paires: R.installed, Mo: Math.round(R.size / 1048576) });
