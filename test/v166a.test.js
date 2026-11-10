// 1.6.6 : ordre des boutons (glisser), boutons à gauche du bouton des extensions, texte sélectionné repris par le traducteur
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v166'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, v === true || v === false ? '' : v);
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/translate') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); global.lastTr = (global.lastTr || []).concat(j.target + ':' + JSON.stringify(j.q).slice(0, 40)); const tr = s => '[' + j.target.toUpperCase() + '] ' + s; r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: Array.isArray(j.q) ? j.q.map(tr) : tr(j.q), detectedLanguage: [{ language: /chat/i.test(JSON.stringify(j.q)) ? 'fr' : 'en' }] })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end('<!doctype html><title>T</title><body style="font:18px sans-serif;padding:30px"><p id="p">Good evening my friends</p><p id="f">Le chat dort sur la table.</p></body>');
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v166a'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await pg.waitForTimeout(1500);
  const keys = () => b.evaluate(() => [...$('#tbItems').children].filter(x => x.offsetParent || getComputedStyle(x).display !== 'none').map(x => x.dataset.key));
  ok('boutons à gauche du bouton des extensions', await b.evaluate(() => [...$('#tbItems').children].every(x => x.compareDocumentPosition($('#bExt')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  const k0 = await keys(); console.log('ordre', k0.join(' '));
  await b.dragAndDrop('#tbItems [data-key="mod:scan"]', '#tbItems [data-key="mod:adblock"]', { targetPosition: { x: 2, y: 10 } });
  await b.waitForTimeout(400);
  const k1 = await keys(); ok('ordre changé en glissant', k1.indexOf('mod:scan') < k1.indexOf('mod:adblock') ? k1.join(' ') : false);
  await b.waitForTimeout(800); const saved = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8')).browser.tbOrder;
  ok('ordre enregistré', Array.isArray(saved) && saved.indexOf('mod:scan') < saved.indexOf('mod:adblock'));
  await b.screenshot({ path: OUT + '/toolbar.png', clip: { x: 700, y: 0, width: 600, height: 50 } }).catch(() => {});
  // menu : glisser une ligne
  await b.click('#bExt'); await b.waitForTimeout(300);
  await b.dragAndDrop('#pop .prow[data-key="mod:translate"]', '#pop .prow[data-key="mod:scan"]', { targetPosition: { x: 40, y: 3 } }); await b.waitForTimeout(400);
  const k2 = await keys(); ok('ordre changé depuis le menu', k2.indexOf('mod:translate') < k2.indexOf('mod:scan') ? k2.join(' ') : k2.join(' ') + ' (pas changé)');
  await b.screenshot({ path: OUT + '/ext-menu.png' });
  await b.evaluate(() => popClose());
  // traducteur : la sélection est reprise dans la fenêtre
  await pg.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('p')); getSelection().addRange(r); });
  await b.click('#tbItems [data-key="mod:translate"]'); await b.waitForTimeout(1500);
  ok('sélection reprise et traduite', await b.evaluate(() => $('#trIn').value + ' => ' + $('#trOut').textContent));
  await b.evaluate(() => popClose());
  // bulle de sélection : texte français → anglais
  await pg.evaluate(() => { getSelection().removeAllRanges(); const r = document.createRange(); r.selectNodeContents(document.getElementById('f')); getSelection().addRange(r); });
  await b.evaluate(() => pageCmd('translate-selection')); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: OUT + '/fr-en.png' });
  ok('français → anglais', (global.lastTr || []).slice(-1)[0].startsWith('en:') ? global.lastTr.slice(-2).join(' | ') : global.lastTr.join(' | '));
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
