// 1.6.4 : chaque page interne s'ouvre sans erreur (captures d'écran)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v164'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const HOME = '/tmp/claude-0/uihome-v164b'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: process.env.LANGX || 'fr', langChosen: true }));
  const now = Date.now();
  fs.writeFileSync(HOME + '/.config/DrYAE/browser.json', JSON.stringify({ history: [{ url: 'https://fr.wikipedia.org/wiki/Manga', title: 'Manga — Wikipédia', t: now - 60e3 }, { url: 'https://www.youtube.com/watch?v=abc', title: 'Une vidéo - YouTube', t: now - 3600e3 }, { url: 'https://github.com/DrYAE-FPA/DrYAE', title: 'DrYAE sur GitHub', t: now - 30 * 3600e3 }], bookmarks: [{ url: 'https://www.youtube.com', title: 'YouTube', t: now }, { url: 'https://mail.google.com', title: 'Gmail', t: now }] }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); w.on('pageerror', e => console.log('[uierr]', e.message)); await w.waitForTimeout(1500);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message)); b.on('console', m => { if (m.type() === 'error') console.log('[brcon]', m.text()); });
  await b.setViewportSize({ width: 1280, height: 800 }).catch(() => {});
  await b.waitForTimeout(1500);
  for (const p of (process.env.PAGES || 'history,bookmarks,passwords,extensions,settings').split(',')) {
    await b.evaluate(n => B.call('br:openPage', n), p);
    let pg; for (let i = 0; i < 30 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith('dryae://' + p)); await new Promise(r => setTimeout(r, 200)); }
    if (!pg) { console.log('PAS DE PAGE', p); continue; }
    pg.on('pageerror', e => console.log('[' + p + ' err]', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('[' + p + ' con]', m.text()); });
    await pg.waitForTimeout(1500);
    console.log(p, 'OK :', (await pg.evaluate(() => document.querySelector('#wrap').innerText)).slice(0, 160).replace(/\n+/g, ' | '));
    await pg.screenshot({ path: `${OUT}/${p}.png` });
  }
  await b.click('#bMenu'); await b.waitForTimeout(400); await b.screenshot({ path: `${OUT}/menu.png` });
  await app.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
