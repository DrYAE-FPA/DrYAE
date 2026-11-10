// 1.6.4 : pages internes dryae:// (historique), pont sécurisé, menu, favoris
const { _electron } = require('playwright'); const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
(async () => {
  const HOME = '/tmp/claude-0/uihome-v164a'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME, { recursive: true });
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); w.on('pageerror', e => console.log('[uierr]', e.message)); await w.waitForTimeout(1500);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message)); b.on('console', m => { if (m.type() === 'error') console.log('[brcon]', m.text()); });
  await b.waitForTimeout(1500);
  await b.evaluate(() => B.call('br:openPage', 'history'));
  await b.waitForTimeout(2500);
  const pages = app.windows().map(x => x.url()); console.log('fenêtres', pages);
  let h = app.windows().find(x => x.url().startsWith('dryae://history'));
  if (h) {
    h.on('pageerror', e => console.log('[pgerr]', e.message)); h.on('console', m => console.log('[pgcon]', m.type(), m.text()));
    await h.waitForTimeout(800);
    console.log('pont', await h.evaluate(() => typeof window.dryae), 'titre', await h.title());
    console.log('contenu', (await h.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n+/g, ' | '));
    await h.screenshot({ path: '/tmp/claude-0/v164-history.png' });
  }
  await b.screenshot({ path: '/tmp/claude-0/v164-browser.png' });
  await app.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
