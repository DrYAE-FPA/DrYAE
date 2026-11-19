// Version perso après 1.7.1 : menu ⋮ raccourci (Profils en tête), conteneurs au clic droit sur « + », loupe des onglets,
// BD dans Paramètres ; dossier de chaque catégorie et « dossier du moment » (gestionnaire et navigateur)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { autoFolder } = require('../src/main/util');
  const S0 = { dir: '/dl', categorize: true, catDirs: { video: '/films' }, tempDir: '' };
  ok('catégorie avec son dossier', autoFolder(S0, 'video') === '/films');
  ok('autres catégories rangées comme avant', autoFolder(S0, 'audio') === path.join('/dl', 'Musique') && autoFolder({ ...S0, categorize: false }, 'audio') === '/dl');
  ok('dossier du moment prioritaire', autoFolder({ ...S0, tempDir: '/moment' }, 'video') === '/moment');
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'application/octet-stream'); r.setHeader('content-disposition', 'attachment; filename="chanson.mp3"'); r.end(Buffer.alloc(5000, 1)); }).listen(0);
  const HOME = '/tmp/claude-0/uihome-v172m'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  const DL = HOME + '/Téléchargements', TMP = HOME + '/Moment'; fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', dir: DL, duplicate: 'rename' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(1500);
  const labels = await b.evaluate(() => mainMenu().filter(e => e && typeof e === 'object' && e.label).map(e => e.label));
  ok('Profils en tête du menu', labels[0] === 'Profils', labels.slice(0, 3));
  const gone = ['Nouvel onglet dans un conteneur', 'Ouvrir une BD ou un manga…', 'Rechercher dans les onglets…', 'Panneau latéral', 'Espaces de travail', 'Collections'];
  ok('éléments retirés du menu', gone.every(g => !labels.includes(g)), labels);
  ok('menu plus court', labels.length <= 22, labels.length);
  await b.click('#newTab', { button: 'right' }); await wait(300);
  ok('clic droit sur « + » : onglet privé et conteneur', await b.evaluate(() => /Nouvel onglet privé/.test($('#menu').innerText) && /conteneur/.test($('#menu').innerText)));
  await b.keyboard.press('Escape'); await b.evaluate(() => $('#menu').classList.remove('on'));
  await b.click('#tabFind'); await wait(300);
  ok('loupe : recherche dans les onglets', await b.evaluate(() => $('#tsDlg').classList.contains('on')));
  await b.keyboard.press('Escape');
  // BD dans Paramètres
  await b.evaluate(() => openPage('settings', 'scan')); await wait(2500);
  const st = app.windows().find(x => x.url().startsWith('dryae://settings'));
  ok('Paramètres → Traducteur de scans : lire une BD', !!st && await st.evaluate(() => !!document.querySelector('[data-comic="file"]') && /Lire une BD ou un manga/.test(document.body.innerText)));
  // gestionnaire : dossier de chaque catégorie
  await w.bringToFront?.(); await w.evaluate(() => showSettings('gen')); await wait(600);
  ok('dossier de chaque catégorie dans les paramètres', await w.evaluate(() => document.querySelectorAll('[data-cd]').length === 9));
  await w.fill('#cd_audio', HOME + '/MaMusique'); await w.evaluate(() => $('#sOk').click()); await wait(800);
  let saved = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8'));
  ok('dossier de la catégorie enregistré', saved.catDirs?.audio === HOME + '/MaMusique', saved.catDirs);
  const add = async () => { await w.evaluate(() => showAdd()); await wait(500); };
  const go = async u => { await w.evaluate(u => { $('#aUrls').value = u; }, u); await w.evaluate(() => $('#aOk').click()); await wait(3000); };
  await add(); await go(`http://127.0.0.1:${srv.address().port}/a`);
  ok('téléchargement rangé dans le dossier de sa catégorie', fs.existsSync(HOME + '/MaMusique/chanson.mp3'), fs.existsSync(HOME + '/MaMusique') && fs.readdirSync(HOME + '/MaMusique'));
  // dossier du moment
  await add(); await w.evaluate(t => { $('#aDir').value = t; }, TMP); await w.evaluate(() => { $('#aTmp').checked = true; $('#aTmp').dispatchEvent(new Event('change')); }); await wait(600);
  saved = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8'));
  ok('case cochée : dossier du moment enregistré', saved.tempDir === TMP, saved.tempDir);
  await w.evaluate(() => { $('#aDir').value = ''; }); await go(`http://127.0.0.1:${srv.address().port}/b`);
  ok('les téléchargements suivants vont dans le dossier du moment', fs.readdirSync(TMP).some(f => /chanson/.test(f)), fs.readdirSync(TMP));
  await add();
  ok('à la réouverture : dossier rempli et case cochée', await w.evaluate(t => $('#aDir').value === t && $('#aTmp').checked, TMP));
  await w.evaluate(() => { $('#aTmp').checked = false; $('#aTmp').dispatchEvent(new Event('change')); }); await wait(600);
  saved = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8'));
  ok('case décochée : retour aux dossiers des paramètres', saved.tempDir === '' && await w.evaluate(() => $('#aDir').value === ''));
  // navigateur : « Plus d'options »
  await app.evaluate(({}, t) => {}, null);
  await b.evaluate(() => B.call('br:tempDir', '/tmp/claude-0/x'));
  await b.evaluate(() => qsAdvInit('f.mp3')); await wait(600);
  ok('navigateur : options ouvertes avec le dossier du moment', await b.evaluate(() => $('#qaTmp').checked && $('#qaDir').value === '/tmp/claude-0/x' && $('#qsAdv').style.display === ''));
  await b.evaluate(() => { $('#qaTmp').checked = false; $('#qaTmp').dispatchEvent(new Event('change')); }); await wait(600);
  ok('navigateur : décoché = retour aux dossiers habituels', JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8')).tempDir === '');
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
