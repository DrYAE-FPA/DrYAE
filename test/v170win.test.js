// 1.7.0 refaite : panneau des extensions (⋮ pour toutes, menu au-dessus du panneau), mode téléphone visible,
// « Rouvrir aussi les autres fenêtres » (option), « Ne jamais traduire » dans « Corriger la bulle »
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const HOME = '/tmp/claude-0/uihome-v170win';
const launch = () => _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
const brOf = async app => { let b; for (let i = 0; i < 60 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html') && !x.url().includes('win=extra')); await wait(250); } return b; };
(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(`<title>Page ${q.url.slice(1)}</title><p>${q.url}</p>`); }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, restoreSession: true, browser: { restoreAllWindows: true } }));
  let app = await launch(); await app.firstWindow(); await wait(2500);
  let b = await brOf(app); b.on('pageerror', e => console.log('[brerr]', e.message));
  await b.evaluate(u => navigate(cur, u + '/un'), base); await wait(1500);

  // panneau des extensions : pas d'interrupteur, un bouton ⋮ par extension intégrée, menu au-dessus du panneau
  await b.evaluate(() => popOpen('ext', document.querySelector('#bExt'))); await wait(500);
  const pan = await b.evaluate(() => ({ toggles: document.querySelectorAll('#pop [data-tg^="mod:"]').length, more: document.querySelectorAll('#pop [data-mod] [data-more]').length }));
  ok('panneau des extensions : pas d\'interrupteur, ⋮ pour chaque extension intégrée', pan.toggles === 0 && pan.more >= 5, pan);
  await b.evaluate(() => document.querySelector('#pop [data-mod="translate"] [data-more]').click()); await wait(300);
  const z = await b.evaluate(() => { const m = document.querySelector('#menu'); const r = m.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { on: m.classList.contains('on'), mz: +getComputedStyle(m).zIndex, pz: +getComputedStyle(document.querySelector('#pop')).zIndex, menuOnTop: m.contains(top), labels: [...m.querySelectorAll('.ml')].map(x => x.textContent) }; });
  ok('menu ⋮ affiché au-dessus du panneau', z.on && z.menuOnTop && z.mz > z.pz, z);
  ok('menu ⋮ : pas de « Désactiver » (seulement dans les paramètres)', !z.labels.some(l => /Désactiver/.test(l)) && z.labels.some(l => /Paramètres/.test(l)), z.labels);
  await b.keyboard.press('Escape'); await b.evaluate(() => popClose && popClose());

  // mode téléphone : icône dans la barre d'adresse et entrée du menu principal
  const m0 = await b.evaluate(() => getComputedStyle(document.querySelector('#bMobile')).display);
  await b.evaluate(() => setUaMode('mobile')); await wait(800);
  const m1 = await b.evaluate(() => ({ disp: getComputedStyle(document.querySelector('#bMobile')).display, ua: CFG.ua }));
  ok('icône téléphone cachée en mode ordinateur, visible en mode téléphone', m0 === 'none' && m1.disp !== 'none' && m1.ua === 'mobile', { m0, m1 });
  await b.evaluate(() => document.querySelector('#bMobile').click()); await wait(800);
  ok('clic sur l\'icône : retour au mode ordinateur', await b.evaluate(() => CFG.ua !== 'mobile' && getComputedStyle(document.querySelector('#bMobile')).display === 'none'));

  // autre fenêtre (Ctrl+N) avec deux onglets, puis on quitte DrYAE : elle revient au démarrage suivant
  await b.evaluate(u => B.call('br:newWindow', u + '/fenetre-a'), base); await wait(3000);
  const xb = app.windows().find(x => x.url().includes('win=extra'));
  await xb.evaluate(u => newTab(u + '/fenetre-b'), base); await wait(2500);
  await app.evaluate(({ app }) => app.quit()).catch(() => {}); await wait(2500);
  const store = (() => { for (const f of ['browser.json', 'browser-store.json', 'store.json']) try { return JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/' + f, 'utf8')); } catch {} return {}; })();
  ok('onglets de l\'autre fenêtre gardés en quittant', Object.values(store.extraSessions || {}).some(s => s.tabs.length === 2), store.extraSessions);
  app = await launch(); await app.firstWindow(); await wait(6000);
  const extras = app.windows().filter(x => x.url().includes('win=extra'));
  let urls = []; if (extras[0]) urls = await extras[0].evaluate(() => tabs.map(t => t.url));
  ok('au démarrage suivant, l\'autre fenêtre revient avec ses onglets', extras.length === 1 && urls.some(u => /fenetre-a/.test(u)) && urls.some(u => /fenetre-b/.test(u)), urls);
  await app.close().catch(() => {}); srv.close();
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
