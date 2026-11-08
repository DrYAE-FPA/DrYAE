// 1.6.2 : navigateur (souris façon Windows, panneaux mots de passe / extensions)
const { _electron } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/claude-0/shots162b'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const HOME = '/tmp/claude-0/uihome-162b'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME, { recursive: true });
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: '/home/claude/dryae3', executablePath: '/home/claude/dryae3/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); w.on('pageerror', e => console.log('[uierr]', e.message)); await w.waitForTimeout(1500);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message)); b.on('console', m => { if (m.type() === 'error') console.log('[brcon]', m.text()); });
  await b.waitForTimeout(1200);
  const n0 = await b.evaluate(() => tabs.length);
  const r = await b.evaluate(() => { const t = document.querySelector('#tabs'), r = t.getBoundingClientRect(); return { x: r.right - 40, y: r.top + r.height / 2 }; });
  await b.mouse.dblclick(r.x, r.y); await b.waitForTimeout(300);
  const n1 = await b.evaluate(() => tabs.length);
  console.log('double-clic barre d\'onglets :', n0, '->', n1);
  // clic du milieu sur un onglet : fermeture
  const el = await b.$('.tab:last-of-type'); const bb = await (await b.$$('.tab')).at(-1).boundingBox();
  await b.mouse.click(bb.x + 20, bb.y + bb.height / 2, { button: 'middle' }); await b.waitForTimeout(300);
  console.log('clic du milieu sur un onglet :', await b.evaluate(() => tabs.length));
  // zoom par la molette (événement envoyé par le processus principal)
  await b.evaluate(() => { const t = newTab('data:text/html,<h1>zoom</h1>'); });
  await b.waitForTimeout(1500);
  const wcId = await b.evaluate(() => cur.wcId || cur.wv.getWebContentsId());
  await app.evaluate(({ webContents }, id) => webContents.fromId(id).emit('zoom-changed', {}, 'in'), wcId); await b.waitForTimeout(200);
  console.log('Ctrl+molette -> zoom :', await b.evaluate(() => cur.zoom), await b.evaluate(() => $('#zoom').textContent));
  // bouton latéral « précédent » (app-command)
  await b.evaluate(() => cur.wv.loadURL('data:text/html,<h1>page2</h1>')); await b.waitForTimeout(1200);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('app-command', {}, 'browser-backward')); await b.waitForTimeout(1000);
  console.log('bouton précédent :', await b.evaluate(() => cur.wv.getURL().slice(0, 40)));
  // panneau mots de passe
  await b.evaluate(() => togglePanel('passwords', true));
  await b.waitForTimeout(500);
  console.log('import csv :', !!(await b.$('#pwImp')), 'export :', !!(await b.$('#pwExp')));
  await b.screenshot({ path: OUT + '/pw.png' });
  await b.evaluate(() => togglePanel('extensions', true)); await b.waitForTimeout(600);
  console.log('installer avec un lien :', !!(await b.$('#exGo')));
  await b.fill('#exId', 'pas-un-id'); await b.click('#exGo'); await b.waitForTimeout(500);
  console.log('toast :', await b.evaluate(() => document.querySelector('.toast')?.textContent || ''));
  await b.screenshot({ path: OUT + '/ext.png' });
  console.log('userAgentFallback :', await app.evaluate(({ app }) => app.userAgentFallback.replace(/\d+\.0\.0\.0/, 'N')));
  await app.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
