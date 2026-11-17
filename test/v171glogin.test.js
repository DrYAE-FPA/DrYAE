// 1.7.1 (version perso) : « Se connecter avec Google » qui recharge sa page en boucle : DrYAE le repère et propose Chrome / l'e-mail
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => {
    r.setHeader('content-type', 'text/html; charset=utf-8');
    if (q.headers.host.startsWith('accounts.google.com')) return r.end('<title>Connexion</title><form method="get" action="/signin/oauth/id"><input type="hidden" name="part" value="abc"><button id="go">Continuer</button></form>');
    r.end('<title>Boutique</title><a id="g" href="http://accounts.google.com:' + srv.address().port + '/signin/oauth/id?part=abc">Google</a>');
  }).listen(0); const port = srv.address().port;

  const HOME = '/tmp/claude-0/uihome-v171gl'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--host-resolver-rules=MAP accounts.google.com 127.0.0.1, MAP boutique.test 127.0.0.1'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(p => window.dryae.call('openBrowser', 'http://boutique.test:' + p + '/'), port);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(2500);
  const js = code => b.evaluate(c => cur.wv.executeJavaScript(c), code);
  const url = () => b.evaluate(() => cur.wv.getURL());
  // la vraie page de Google n'est pas joignable ici : on rejoue les deux chargements (page de Google, puis la même rechargée)
  const wcId = await b.evaluate(() => cur.wcId);
  const nav = u => app.evaluate(({ webContents }, [id, u]) => webContents.fromId(id).emit('did-navigate', {}, u), [wcId, u]);
  await nav('https://accounts.google.com/v3/signin/accountchooser?client_id=1'); await wait(200);
  await nav('https://accounts.google.com/signin/oauth/id?authuser=0&part=abc'); await wait(500);
  ok('une seule page de Google : pas d\'alerte (connexion normale)', !(await b.evaluate(() => document.querySelector('#askDlg').classList.contains('on'))));
  await nav('https://accounts.google.com/signin/oauth/id?authuser=0&part=abc'); await wait(1200);
  const shown = await b.evaluate(() => getComputedStyle(document.querySelector('#askDlg')).display !== 'none' && document.querySelector('#askDlg').classList.contains('on') ? document.querySelector('#askH').textContent : '');
  ok('boucle de connexion Google repérée', /Google refuse/.test(shown), shown);
  await b.evaluate(() => document.querySelector('#askF [data-v="back"]').click()); await wait(1500);
  const u = await url();
  ok('« Revenir au site » ramène sur la boutique', /boutique\.test/.test(u), u);
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
