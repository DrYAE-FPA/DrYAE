// 1.6.4 : extensions intégrées dans une vraie page (traduction, masquer un élément, scans, lumières, saisie)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v164'; fs.mkdirSync(OUT, { recursive: true });
const PAGE = `<!doctype html><html><head><title>Test page</title></head><body style="font:16px sans-serif;background:#fff;color:#111;padding:20px">
<h1 id="h">Welcome to the test page</h1><p id="p">This text should be translated by the built-in translator.</p>
<div id="ad" style="background:#fc0;padding:20px;margin:10px 0">ANNOYING BANNER</div>
<img id="manga" src="/manga.png" width="800" height="500">
<form id="f1" style="margin-top:20px"><input name="email" id="em" placeholder="Email"><input type="password" id="pw" name="password"><button>Log in</button></form>
<form id="f2"><input name="cardnumber" id="cc" autocomplete="cc-number"><input id="exp" autocomplete="cc-exp" placeholder="MM/YY"><input id="cn" autocomplete="cc-name"></form>
<video id="v" width="480" height="270" style="background:#000"></video></body></html>`;
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/manga.png') { r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync('/tmp/claude-0/bubbles.png')); }
    if (q.url === '/translate' && q.method === 'POST') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); const tr = s => '[FR] ' + s; r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: Array.isArray(j.q) ? j.q.map(tr) : tr(j.q), detectedLanguage: [{ language: 'en' }] })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(PAGE);
  }).listen(0);
  const port = srv.address().port, base = `http://127.0.0.1:${port}`;
  const HOME = '/tmp/claude-0/uihome-v164c'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base, selection: 'button' } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/page');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  pg.on('pageerror', e => console.log('[pgerr]', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('[pgcon]', m.text()); });
  await pg.waitForTimeout(1500);
  // traduction de la page
  await b.evaluate(() => pageCmd('translate-page'));
  await pg.waitForTimeout(1500);
  console.log('traduction :', await pg.evaluate(() => document.getElementById('p').textContent));
  console.log('barre :', await b.evaluate(() => document.querySelector('#trBar').classList.contains('on') && document.querySelector('#trTxt').textContent));
  await b.evaluate(() => pageCmd('translate-off')); await pg.waitForTimeout(400);
  console.log('original :', await pg.evaluate(() => document.getElementById('p').textContent));
  // masquer un élément
  const r = await pg.evaluate(() => { const b = document.getElementById('ad').getBoundingClientRect(); return { x: b.left + 20, y: b.top + 10 }; });
  await b.evaluate(o => pageCmd('picker', o), r); await pg.waitForTimeout(300);
  await pg.mouse.move(r.x, r.y); await pg.mouse.click(r.x, r.y); await pg.waitForTimeout(200); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  console.log('élément masqué :', await pg.evaluate(() => getComputedStyle(document.getElementById('ad')).display));
  // sélection de texte : bouton traduire
  await pg.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('h')); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await pg.mouse.move(100, 40); await pg.mouse.down(); await pg.mouse.up(); await pg.waitForTimeout(200);
  await pg.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('h')); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await b.evaluate(() => pageCmd('translate-selection')); await pg.waitForTimeout(800);
  await pg.screenshot({ path: OUT + '/page-bubble.png' });
  // scans
  await pg.evaluate(() => { getSelection().removeAllRanges(); document.getElementById('manga').scrollIntoView(); });
  await b.evaluate(() => pageCmd('scan'));
  await pg.waitForTimeout(20000);
  await pg.screenshot({ path: OUT + '/page-scan.png' });
  // lumières
  await b.evaluate(() => pageCmd('scan')); await pg.evaluate(() => document.getElementById('v').scrollIntoView());
  await b.evaluate(() => pageCmd('lights')); await pg.waitForTimeout(800);
  await pg.screenshot({ path: OUT + '/page-lights.png' });
  await b.evaluate(() => pageCmd('lights'));
  // mot de passe fort proposé (nouveau mot de passe)
  await pg.evaluate(() => { document.getElementById('pw').setAttribute('autocomplete', 'new-password'); scrollTo(0, 0); });
  await pg.waitForTimeout(600); await pg.evaluate(() => document.getElementById('pw').focus()); await pg.waitForTimeout(600);
  await pg.screenshot({ path: OUT + '/page-gen.png' });
  await b.screenshot({ path: OUT + '/browser-page.png' });
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
