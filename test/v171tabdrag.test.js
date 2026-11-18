// 1.7.1 (version perso) : déplacer un onglet à la souris — réordonner, nouvelle fenêtre, autre fenêtre
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end('<title>Page ' + q.url.slice(1) + '</title><body style="background:#fff"><h1>' + q.url + '</h1></body>'); }).listen(0); const port = srv.address().port;
  const U = n => 'http://site.test:' + port + '/' + n;
  const HOME = '/tmp/claude-0/uihome-v171td'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--host-resolver-rules=MAP site.test 127.0.0.1'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(u => window.dryae.call('openBrowser', u), U('a'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(1500);
  await b.evaluate(us => us.forEach(u => newTab(u, { background: true })), [U('b'), U('c')]); await wait(1500);
  const urls = pg => pg.evaluate(() => tabs.map(t => t.url.replace(/.*\//, '')));
  ok('3 onglets au départ', (await urls(b)).join() === 'a,b,c', await urls(b));
  const box = async (pg, i) => pg.evaluate(i => { const r = tabs[i].el.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2, w: r.width }; }, i);

  // 1) réordonner dans la barre : « a » glissé après « b »
  let s = await box(b, 0), t = await box(b, 1);
  await b.mouse.move(s.x, s.y); await b.mouse.down(); await b.mouse.move(s.x + 20, s.y, { steps: 3 }); await b.mouse.move(t.x + t.w - 20, s.y, { steps: 8 }); await wait(150);
  const lifted = await b.evaluate(() => !!document.querySelector('.tab.dragging.lift'));
  await b.mouse.up(); await wait(400);
  ok('onglet soulevé pendant qu\'on le tient', lifted);
  ok('onglet déplacé dans la barre', (await urls(b)).join() === 'b,a,c', await urls(b));

  // 2) sortir « c » vers le bas : nouvelle fenêtre
  const nWin = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(x => !x.isDestroyed() && x.isVisible() && x.getTitle().includes('Navigateur') || false).length);
  const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  s = await box(b, 2);
  await b.mouse.move(s.x, s.y); await b.mouse.down(); await b.mouse.move(s.x + 10, s.y + 10, { steps: 2 }); await b.mouse.move(s.x + 40, s.y + 260, { steps: 10 }); await wait(500);
  const ghost = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(x => !x.isDestroyed() && x.isVisible() && /^data:text\/html/.test(x.webContents.getURL())));
  ok('vignette de l\'onglet visible pendant le glisser', ghost);
  await b.mouse.up(); await wait(3000);
  const after = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(x => !/^data:/.test(x.webContents.getURL())).length);
  ok('onglet sorti : nouvelle fenêtre ouverte', after === before + 1, { before, after });
  ok('onglet retiré de la première fenêtre', (await urls(b)).join() === 'b,a', await urls(b));
  const b2 = app.windows().filter(x => x.url().includes('browser.html')).find(x => x !== b);
  ok('la nouvelle fenêtre montre la page', b2 && (await urls(b2)).join() === 'c', b2 && await urls(b2));
  ok('plus de vignette après le lâcher', !(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(x => !x.isDestroyed() && /^data:text\/html/.test(x.webContents.getURL())))));

  // 3) glisser « b » de la 1re fenêtre sur la 2e (posées côte à côte)
  await app.evaluate(({ BrowserWindow }) => { const ws = BrowserWindow.getAllWindows().filter(x => !/^data:/.test(x.webContents.getURL())).sort((a, b) => a.id - b.id); ws[0].setBounds({ x: 0, y: 0, width: 900, height: 600 }); ws[1].setBounds({ x: 950, y: 0, width: 900, height: 600 }); }); await wait(800);
  s = await box(b, 0);
  await b.mouse.move(s.x, s.y); await b.mouse.down(); await b.mouse.move(s.x + 10, s.y + 60, { steps: 3 }); await b.mouse.move(1000, 200, { steps: 12 }); await wait(400);
  const shown = await b2.evaluate(() => document.body.classList.contains('tabin'));
  await b.mouse.move(1010, 30, { steps: 4 }); await wait(300);
  // lâché hors de la fenêtre de départ : l'écran virtuel des tests ne renvoie pas ce lâcher, on le rejoue (Windows le fait)
  await b.evaluate(() => tdEnd()); await b.mouse.up(); await wait(2500);
  ok('l\'autre fenêtre montre qu\'elle va recevoir l\'onglet', shown);
  ok('onglet passé dans l\'autre fenêtre', (await urls(b2)).includes('b'), await urls(b2));
  ok('onglet retiré de la fenêtre de départ', (await urls(b)).join() === 'a', await urls(b));
  // 4) seul onglet de la fenêtre principale : la fenêtre suit la souris, puis se fond dans l'autre fenêtre
  const pos0 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(x => !/^data:/.test(x.webContents.getURL())).sort((a, b) => a.id - b.id)[0].getBounds());
  s = await box(b, 0);
  await b.mouse.move(s.x, s.y); await b.mouse.down(); await b.mouse.move(s.x + 4, s.y + 4); await b.mouse.move(s.x + 20, s.y + 120); await wait(400);
  const pos1 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(x => !/^data:/.test(x.webContents.getURL())).sort((a, b) => a.id - b.id)[0].getBounds());
  ok('seul onglet : la fenêtre entière suit la souris', pos1.x !== pos0.x || pos1.y !== pos0.y, { pos0, pos1 });
  await b.evaluate(() => { TD.sx = 1200; TD.sy = 300; }); await b.evaluate(() => tdEnd()); await b.mouse.up().catch(() => {}); /* fenêtre fermée : normal */ await wait(2500);
  ok('fenêtre fondue dans l\'autre : son onglet y est passé', (await urls(b2)).includes('a'), await urls(b2));
  ok('DrYAE reste ouvert', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length >= 1));
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
