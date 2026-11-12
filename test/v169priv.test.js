// 1.6.9 : sites dangereux, autorisations par site, bandeaux de cookies refusés, contrôle de sécurité, profils, export chiffré
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // export / import : aller-retour chiffré (sans fenêtre)
  const TX = require('../src/main/transfer');
  const sealed = TX.seal({ format: TX.FORMAT, a: 1, vault: { logins: [{ origin: 'https://x.org', username: 'awa', password: 'S3cret!' }] } }, 'motdepasse');
  const tmp = '/tmp/claude-0/t-export.dryae'; fs.writeFileSync(tmp, JSON.stringify(sealed));
  ok('export chiffré : illisible sans mot de passe', !fs.readFileSync(tmp, 'utf8').includes('S3cret'));
  let bad = ''; try { TX.open(tmp, 'faux'); } catch (e) { bad = e.code; }
  ok('mauvais mot de passe refusé', bad === 'badpw', bad);
  ok('bon mot de passe : données retrouvées', TX.open(tmp, 'motdepasse').vault.logins[0].password === 'S3cret!');

  const srv = http.createServer((q, r) => {
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (q.url === '/cookies') return r.end(`<title>Bandeau</title><div id="cookie-banner" class="cookie-consent">Nous utilisons des cookies. <button onclick="document.title='accepté'">Tout accepter</button> <button onclick="document.title='refusé'">Tout refuser</button></div>`);
    if (q.url === '/geo') return r.end(`<title>Géo</title><script>setTimeout(()=>navigator.geolocation.getCurrentPosition(()=>document.title='pos',e=>document.title='err:'+e.code),300)</script>`);
    r.end('<title>Accueil</title>ok');
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169priv'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE/safe', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/safe/list.txt', 'arnaque-exemple.test\nfaux-banque.test\n'); fs.writeFileSync(HOME + '/.config/DrYAE/safe/meta.json', JSON.stringify({ updated: Date.now(), count: 2 }));
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  const call = (ch, ...a) => w.evaluate(([ch, a]) => window.dryae.call(ch, ...a), [ch, a]);
  // profils
  const id = await call('profileAdd', 'Travail');
  const pl = await call('profiles');
  ok('profil « Travail » créé (dossier séparé)', id === 'travail' && pl.list.some(p => p.id === 'travail'), pl);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/cookies');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await wait(2500);
  ok('bandeau de cookies : « Tout refuser » cliqué', (await b.evaluate(() => cur.title)) === 'refusé', await b.evaluate(() => cur.title));
  // site dangereux
  await wait(7000); // la liste est lue 8 s après le démarrage
  await b.evaluate(() => navigate(cur, 'http://www.arnaque-exemple.test/connexion')); await wait(2000);
  const u = await b.evaluate(() => cur.url);
  ok('site dangereux : page d\'avertissement', /^dryae:\/\/danger/.test(u), u);
  const dpg = app.windows().find(x => x.url().startsWith('dryae://danger'));
  if (dpg) await dpg.screenshot({ path: OUT + '/danger.png' });
  // autorisation demandée par un site
  await b.evaluate(u => navigate(cur, u), base + '/geo'); await wait(1500);
  const asked = await b.evaluate(() => ({ on: $('#askDlg').classList.contains('on'), t: $('#askP').textContent }));
  ok('position demandée : question posée', asked.on && /position/.test(asked.t), asked);
  await b.click('#askF .primary'); await wait(800);
  const perms = await b.evaluate(() => B.call('br:sitePerms', '127.0.0.1'));
  ok('« Autoriser » retenu pour ce site', perms.perms.geolocation === 'allow', perms.perms);
  // cadenas : fenêtre des autorisations
  await b.click('#lockB'); await wait(700);
  ok('cadenas : fenêtre des autorisations', await b.evaluate(() => POP.kind === 'site' && !!document.querySelector('#pop [data-perm="camera"]')));
  // contrôle de sécurité (page Paramètres)
  await b.evaluate(() => openPage('settings', 'privacy')); await wait(2000);
  const sp = app.windows().find(x => x.url().startsWith('dryae://settings'));
  const sc = await sp.evaluate(() => D.call('safetyCheck'));
  ok('contrôle de sécurité : résultats', sc && sc.version && sc.safe && sc.safe.count === 2, { v: sc.version, safe: sc.safe });
  await sp.evaluate(() => runSafety()); await wait(800);
  await sp.screenshot({ path: OUT + '/safety.png' });
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
