// 1.7.1 (version perso) : PDF ouvert depuis l'Explorateur pendant que DrYAE est ouvert : il va dans la fenêtre du navigateur
// utilisée en dernier ; le navigateur de la fenêtre principale fermé (dernier onglet) se rouvre normalement
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const HOME = '/tmp/claude-0/uihome-v171po'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  fs.writeFileSync(HOME + '/a.html', '<title>Page A</title><p>A</p>'); fs.writeFileSync(HOME + '/livre.pdf', '%PDF-1.4\n%%EOF\n');
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(u => window.dryae.call('openBrowser', u), 'file://' + HOME + '/a.html');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(1500);
  // une 2e fenêtre du navigateur (Ctrl+N), utilisée en dernier
  await b.evaluate(() => B.call('br:newWindow', '')); await wait(2500);
  const b2 = app.windows().filter(x => x.url().includes('browser.html')).find(x => x !== b);
  await app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows().sort((a, b) => b.id - a.id); ws[0].focus(); }); await wait(500);
  const urls = pg => pg.evaluate(() => tabs.map(t => t.url.replace(/.*\//, '')));
  const before = await urls(b);
  // double-clic sur un PDF dans l'Explorateur : Windows relance DrYAE avec le fichier
  await app.evaluate(({ app }, f) => app.emit('second-instance', {}, ['DrYAE.exe', f]), HOME + '/livre.pdf'); await wait(2500);
  const u2 = await urls(b2);
  ok('PDF ouvert dans la fenêtre utilisée en dernier', u2.some(x => /livre\.pdf/.test(x)), u2);
  ok('la fenêtre principale n\'a rien reçu', (await urls(b)).join() === before.join(), await urls(b));
  // la fenêtre principale : son dernier onglet fermé, puis le bouton « Navigateur » du gestionnaire
  await w.evaluate(() => window.focus()); await app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id); ws[0].focus(); }); await wait(300);
  await b.evaluate(() => { while (tabs.length) closeTab(tabs[0]); }).catch(() => {}); await wait(1500);
  const gone = await app.evaluate(({ webContents }) => !webContents.getAllWebContents().some(x => !x.isDestroyed() && /browser\.html(?!\?win=extra)/.test(x.getURL()) && !/win=extra/.test(x.getURL())));
  ok('dernier onglet fermé : le navigateur de la fenêtre principale est fermé', gone);
  const st = await app.evaluate(({ BrowserWindow }) => { const m = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id)[0]; return { vis: m.isVisible(), min: m.isMinimized() }; });
  ok('dernier onglet fermé : la fenêtre se ferme (pas de retour au gestionnaire)', !st.vis || st.min, st);
  await w.evaluate(u => window.dryae.call('openBrowser', u), 'file://' + HOME + '/a.html'); await wait(3000);
  const b3 = app.windows().find(x => x.url().includes('browser.html') && !x.url().includes('win=extra'));
  ok('bouton Navigateur : le navigateur se rouvre dans la fenêtre principale', !!b3 && (await urls(b3)).some(x => /a\.html/.test(x)), b3 && await urls(b3));
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
