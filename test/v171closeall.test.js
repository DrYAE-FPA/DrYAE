// 1.7.1 : fermer le dernier onglet, ou fermer la fenêtre pendant qu'on est dans le navigateur : TOUS les onglets se ferment
// (plus de son en arrière-plan), la fenêtre va près de l'heure ; en la rouvrant, le navigateur repart selon les paramètres
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = require('http').createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(`<!doctype html><title>Page ${q.url}</title><body>Page ${q.url}</body>`); }).listen(0);
  await new Promise(r => srv.once('listening', r)); const U = 'http://127.0.0.1:' + srv.address().port;
  const HOME = '/tmp/claude-0/uihome-v171close'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', tray: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  const guests = () => app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(x => !x.isDestroyed() && x.getType() === 'webview').length);
  const mainState = () => app.evaluate(({ BrowserWindow }) => { const m = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id)[0]; return { vis: m.isVisible(), min: m.isMinimized() }; });
  const brUi = async () => { let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html') && !x.url().includes('win=extra')); if (!b) await wait(250); } return b; };
  // 1) dernier onglet fermé à la main
  await w.evaluate(u => window.dryae.call('openBrowser', u), U + '/a'); let b = await brUi(); await wait(2500);
  ok('un onglet ouvert', (await guests()) === 1, await guests());
  await b.evaluate(() => closeTab(tabs[0])).catch(() => {}); await wait(2000);
  ok('dernier onglet fermé : plus aucune page ouverte (plus de son)', (await guests()) === 0, await guests());
  { const st = await mainState(); ok('dernier onglet fermé : la fenêtre va près de l\'heure', !st.vis || st.min, st); }
  // 2) rouvrir (icône près de l'heure) : le navigateur repart
  await app.evaluate(({}) => { global.__dryaeOpen = true; });
  await w.evaluate(() => window.dryae.call('openBrowser', '')); b = await brUi(); await wait(2500);
  const n2 = await b.evaluate(() => tabs.length).catch(() => -1);
  ok('rouvert : le navigateur repart avec un onglet (page de départ des paramètres)', n2 >= 1 && (await mainState()).vis, n2);
  // 3) fenêtre fermée (croix) pendant qu'on est dans le navigateur, avec 2 onglets
  await b.evaluate(u => { newTab(u); }, U + '/b').catch(() => {}); await wait(2000);
  const g3 = await guests();
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id)[0].close(); }); await wait(2000);
  ok('fenêtre fermée dans le navigateur : tous les onglets fermés', g3 >= 2 && (await guests()) === 0, { avant: g3, apres: await guests() });
  { const st = await mainState(); ok('fenêtre fermée : DrYAE reste près de l\'heure', !st.vis || st.min, st); }
  await w.evaluate(() => window.dryae.call('openBrowser', '')); b = await brUi(); await wait(2500);
  ok('rouvert après la croix : navigateur de nouveau là', (await b.evaluate(() => tabs.length).catch(() => -1)) >= 1);
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
