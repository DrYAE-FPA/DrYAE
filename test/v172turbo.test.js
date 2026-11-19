// Mode turbo : OneDrive mis en pause puis relancé, Windows Update arrêté avec l'accord de Windows, retour au démarrage
// suivant si DrYAE s'est fermé pendant le turbo ; bouton « Turbo » du gestionnaire (commandes simulées, aucun programme lancé)
process.env.DRYAE_TURBO_FAKE = '1';
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { Turbo } = require('../src/main/turbo');
  const file = '/tmp/claude-0/turbo-test.json'; fs.mkdirSync('/tmp/claude-0', { recursive: true }); try { fs.unlinkSync(file); } catch {}
  let data = {}; const settings = { get: () => data };
  global.__turboFake = { tasklist: 'OneDrive.exe   1234 Console   1   80 000 K' };
  const t = new Turbo(settings, file);
  let st = await t.start(); const L = global.__turboLog;
  ok('OneDrive arrêté proprement', st.onedrive === 'paused' && L.some(c => /OneDrive\.exe \/shutdown$/.test(c)), L);
  ok('Windows Update, BITS et Optimisation de la distribution arrêtés avec l\'accord de Windows', st.winupdate === 'paused' && L.some(c => /RunAs/.test(c) && /net stop DoSvc/.test(c) && /net stop BITS/.test(c) && /net stop wuauserv/.test(c)));
  ok('état gardé sur le disque (au cas où DrYAE se fermerait)', JSON.parse(fs.readFileSync(file, 'utf8')).onedrive === 'paused');
  global.__turboLog = [];
  st = await t.stop();
  ok('fin du turbo : OneDrive relancé', !st.on && global.__turboLog.some(c => /OneDrive\.exe \/background$/.test(c)), global.__turboLog);
  ok('fichier d\'état effacé', !fs.existsSync(file));
  // DrYAE fermé pendant le turbo → OneDrive relancé au démarrage suivant
  await t.start(); global.__turboLog = [];
  new Turbo(settings, file);
  ok('démarrage suivant : OneDrive relancé', global.__turboLog.some(c => /\/background$/.test(c)));
  // réglages : OneDrive et Windows Update désactivés → rien n'est touché
  data = { turbo: { onedrive: false, winupdate: false } }; global.__turboLog = [];
  const t2 = new Turbo(settings, file); st = await t2.start();
  ok('réglages respectés : rien d\'autre n\'est arrêté', st.on && st.onedrive === 'none' && st.winupdate === 'none' && !global.__turboLog.length, global.__turboLog);
  await t2.stop();
  // bouton du gestionnaire
  const HOME = '/tmp/claude-0/uihome-v172t'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  await w.click('#turboChip'); await wait(1200);
  ok('bouton Turbo allumé', await w.evaluate(() => document.querySelector('#turboChip').classList.contains('on')));
  ok('message clair', /Mode turbo actif/.test(await w.evaluate(() => document.body.innerText)));
  await w.click('#turboChip'); await wait(1200);
  ok('bouton Turbo éteint, tout revient', !(await w.evaluate(() => document.querySelector('#turboChip').classList.contains('on'))) && /Mode turbo arrêté/.test(await w.evaluate(() => document.body.innerText)));
  await w.evaluate(() => showSettings('net')); await wait(500);
  await w.evaluate(() => { document.querySelector('#tbAuto').click(); }); await wait(200);
  await w.evaluate(() => document.querySelector('#sOk').click()); await wait(1000);
  const saved = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8')).turbo;
  ok('réglages du mode turbo enregistrés', saved && saved.auto === true && saved.onedrive === true, saved);
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
