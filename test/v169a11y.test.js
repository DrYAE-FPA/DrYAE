// 1.6.9 : accessibilité — contraste élevé, lecture facilitée, mode simple, taille du texte, mode lecture, lecture à voix haute, noms des boutons
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 400) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const para = 'Les bibliothèques publiques jouent un rôle essentiel dans la vie des quartiers. Elles offrent un accès libre aux livres, aux journaux et à internet, et accueillent des ateliers pour tous les âges. ';
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(`<!doctype html><html lang="fr"><title>Article de test</title><body><nav>Menu Accueil Contact</nav><div class="pub">PUBLICITÉ</div><article><h1>Les bibliothèques de quartier</h1><p class="by">Par Awa Diallo</p>${Array(8).fill('<p>' + para + '</p>').join('')}<script>window.x=1</script></article><footer>Pied de page</footer></body></html>`); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169a11y'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', a11y: { scale: 120, contrast: 'on', easy: true, motion: 'on', simple: true } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  const mcls = await w.evaluate(() => document.documentElement.className);
  ok('gestionnaire : contraste élevé, lecture facilitée, animations réduites, mode simple', /a-hc/.test(mcls) && /a-easy/.test(mcls) && /a-rm/.test(mcls) && /a-simple/.test(mcls), mcls);
  const torVis = await w.evaluate(() => getComputedStyle(document.querySelector('[data-f="torrent"]')).display);
  ok('mode simple : filtres avancés cachés', torVis === 'none', torVis);
  const zf = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());
  ok('taille du texte 120 %', Math.abs(zf - 1.2) < 0.01, zf);
  await w.screenshot({ path: OUT + '/a11y-manager.png' });
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await wait(2500);
  const bc = await b.evaluate(() => ({ cls: document.documentElement.className, ext: getComputedStyle(document.querySelector('#bExt')).display }));
  ok('navigateur : réglages appliqués, extensions cachées en mode simple', /a-hc/.test(bc.cls) && bc.ext === 'none', bc);
  // boutons sans nom pour un lecteur d'écran
  const noName = await b.evaluate(() => [...document.querySelectorAll('button')].filter(x => x.offsetParent !== null && !x.textContent.trim() && !x.getAttribute('aria-label') && !x.title).map(x => x.id || x.className).slice(0, 10));
  ok('navigateur : chaque bouton visible a un nom', !noName.length, noName);
  const noName2 = await w.evaluate(() => [...document.querySelectorAll('button')].filter(x => x.offsetParent !== null && !x.textContent.trim() && !x.getAttribute('aria-label') && !x.title).map(x => x.id || x.className).slice(0, 10));
  ok('gestionnaire : chaque bouton visible a un nom', !noName2.length, noName2);
  // menu au clavier
  await b.evaluate(() => onKey('f', false, false, true)); await wait(300);
  const foc = await b.evaluate(() => document.activeElement?.getAttribute('role'));
  ok('Alt+F ouvre le menu avec le premier choix sélectionné', foc === 'menuitem', foc);
  await b.keyboard.press('ArrowDown'); await b.keyboard.press('Escape'); await wait(200);
  ok('Échap ferme le menu', !(await b.evaluate(() => $('#menu').classList.contains('on'))));
  // mode lecture
  await b.evaluate(() => readerMode()); await wait(1500);
  let pg = app.windows().find(x => x.url().startsWith(base));
  await b.screenshot({ path: OUT + '/a11y-reader.png' });
  const rd = await b.evaluate(() => cur.reader);
  ok('mode lecture ouvert', rd === true, rd);
  await b.evaluate(() => readerMode()); await wait(500);
  ok('mode lecture refermé', (await b.evaluate(() => cur.reader)) === false);
  // lecture à voix haute : la carte de contrôle apparaît
  const art = await b.evaluate(() => B.call('br:article', cur.wcId));
  ok('article extrait sans le menu ni la publicité', art && /bibliothèques publiques/.test(art.text) && !/PUBLICITÉ|Pied de page/.test(art.text), art && art.title);
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
