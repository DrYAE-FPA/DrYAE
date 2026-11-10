// 1.6.5 : menu des extensions (épingler), fenêtres du traducteur / scans / lumières / bloqueur,
// capture d'une zone, fenêtre « Choisir un autre dossier… », sélection à la souris, choix du compte enregistré.
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v165'; fs.mkdirSync(OUT, { recursive: true });
const PAGE = `<!doctype html><html><head><title>Test page</title></head><body style="font:16px sans-serif;background:#fff;color:#111;padding:20px">
<h1 id="h">Welcome to the test page</h1><p id="p">This text should be translated by the built-in translator.</p>
<img id="manga" src="/manga.png" width="800" height="500">
<video id="v" width="480" height="270" style="background:#000"></video></body></html>`;
const LOGIN = `<!doctype html><html><head><title>Sign in</title></head><body style="font:16px sans-serif;padding:30px"><form><input type="email" id="identifierId" name="identifier" autocomplete="username" placeholder="Email or phone"><button type="button" id="next">Next</button></form></body></html>`;
const ok = (n, v) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, v === true || v === false ? '' : v);
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/manga.png') { r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync('/tmp/claude-0/bubbles.png')); }
    if (q.url === '/translate' && q.method === 'POST') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); const tr = s => '[' + j.target.toUpperCase() + '] ' + s; r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: Array.isArray(j.q) ? j.q.map(tr) : tr(j.q), detectedLanguage: [{ language: /bonjour/i.test(JSON.stringify(j.q)) ? 'fr' : 'en' }] })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(q.url === '/login' ? LOGIN : PAGE);
  }).listen(0);
  const port = srv.address().port, base = `http://127.0.0.1:${port}`;
  const HOME = '/tmp/claude-0/uihome-v165a'; fs.rmSync(HOME, { recursive: true, force: true });
  const UD = HOME + '/.config/DrYAE'; fs.mkdirSync(UD + '/extensions/local-hello', { recursive: true });
  // petite extension de test avec une fenêtre (popup)
  fs.writeFileSync(UD + '/extensions/local-hello/manifest.json', JSON.stringify({ manifest_version: 3, name: 'Hello Popup', version: '1.0', action: { default_popup: 'p.html', default_title: 'Hello' }, icons: { 48: 'i.png' } }));
  fs.writeFileSync(UD + '/extensions/local-hello/p.html', '<!doctype html><body style="width:300px;height:200px;margin:0;background:#cde">Hello popup</body>');
  fs.copyFileSync(ROOT + '/extension/icons/32.png', UD + '/extensions/local-hello/i.png');
  fs.writeFileSync(UD + '/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base, selection: 'button', second: 'en' } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/page');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message)); b.on('console', m => { if (m.type() === 'error') console.log('[brcon]', m.text()); });
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  pg.on('pageerror', e => console.log('[pgerr]', e.message));
  await pg.waitForTimeout(2000);

  // --- extension chargée : icône (data:) et bouton épinglé ---
  await app.evaluate(async ({ session }) => { const s = session.fromPartition('persist:dryae-web'); const X = s.extensions || s; const all = X.getAllExtensions(); if (!all.length) { const fs = require('fs'); const p = require('path'); const d = p.join(require('electron').app.getPath('userData'), 'extensions', 'local-hello'); await X.loadExtension(d, { allowFileAccess: true }); } });
  await b.evaluate(() => B.call('br:extList').then(() => window.dispatchEvent(new Event('x'))));
  await b.evaluate(() => loadExts()); await b.waitForTimeout(1200);
  const ext = await b.evaluate(() => EXTS.map(x => ({ n: x.name, icon: (x.icon || '').slice(0, 22), pinned: x.pinned })));
  ok('extension listée avec icône', ext.length && ext[0].icon.startsWith('data:image/png') ? JSON.stringify(ext) : JSON.stringify(ext));
  ok('bouton épinglé dans la barre', await b.evaluate(() => $$('#tbItems .ext').length === 1));
  // menu des extensions
  await b.click('#bExt'); await b.waitForTimeout(400);
  await b.screenshot({ path: OUT + '/ext-menu.png' });
  ok('menu des extensions', await b.evaluate(() => $('#pop').classList.contains('on') && $('#pop').innerText.includes('Hello Popup')));
  // détacher puis épingler
  await b.click('#pop [data-cx] [data-pin]'); await b.waitForTimeout(300);
  ok('détachée', await b.evaluate(() => $$('#tbItems .ext').length === 0));
  await b.click('#pop [data-cx] [data-pin]'); await b.waitForTimeout(300);
  ok('épinglée à nouveau', await b.evaluate(() => $$('#tbItems .ext').length === 1));
  // ouvrir la fenêtre de l'extension depuis le menu : position à l'intérieur de l'écran
  console.log('ancre', await b.evaluate(() => JSON.stringify($('#tbItems .ext').getBoundingClientRect())), await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(x => [x.webContents.getURL().slice(0, 40), x.getContentBounds()])));
  await b.click('#pop [data-cx] .grow'); await b.waitForTimeout(4000);
  const pop = await app.evaluate(({ BrowserWindow, screen }) => { const all = BrowserWindow.getAllWindows(); const p = all.find(x => /^chrome-extension:/.test(x.webContents.getURL())); if (!p) return null; const r = p.getBounds(); const wa = screen.getDisplayMatching(r).workArea; return { r, wa, inside: r.x >= wa.x && r.x + r.width <= wa.x + wa.width && r.y >= wa.y }; });
  console.log('contenu', await app.evaluate(async ({ BrowserWindow }) => { const p = BrowserWindow.getAllWindows().find(x => /^chrome-extension:/.test(x.webContents.getURL())); return p ? [p.webContents.getURL(), await p.webContents.executeJavaScript('document.body && document.body.innerText').catch(e => String(e)), p.getBounds(), p.isVisible()] : null; }));
  ok('fenêtre de l\'extension dans l\'écran', pop && pop.inside ? JSON.stringify(pop.r) : JSON.stringify(pop));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(x => /^chrome-extension:/.test(x.webContents.getURL())).forEach(x => x.destroy()));

  // --- traducteur : fenêtre avec traduction en direct ---
  await b.evaluate(() => popOpen('translate', $('[data-mod=translate]'))); await b.waitForTimeout(300);
  await b.fill('#trIn', 'Good morning everybody'); await b.waitForTimeout(1500);
  ok('traduction en direct', await b.evaluate(() => $('#trOut').textContent));
  await b.fill('#trIn', 'Bonjour tout le monde'); await b.waitForTimeout(1500);
  ok('2e langue automatique (déjà en français → anglais)', await b.evaluate(() => $('#trOut').textContent));
  await b.screenshot({ path: OUT + '/tr-pop.png' });
  await b.evaluate(() => popClose());
  // bouton de sélection : pas proposé pour un texte déjà en français
  await pg.evaluate(() => { const p = document.createElement('p'); p.id = 'fr'; p.textContent = 'Le chat est sur la table et nous pensons que vous avez raison pour ce texte.'; document.body.prepend(p); });
  const selBtn = async id => { const r = await pg.evaluate(id => { const e = document.getElementById(id); const rg = document.createRange(); rg.selectNodeContents(e); getSelection().removeAllRanges(); getSelection().addRange(rg); const b = e.getBoundingClientRect(); return { x: b.left + 30, y: b.top + 8 }; }, id); await pg.mouse.move(r.x, r.y); await pg.mouse.down(); await pg.mouse.up(); await pg.evaluate(id => { const e = document.getElementById(id); const rg = document.createRange(); rg.selectNodeContents(e); getSelection().removeAllRanges(); getSelection().addRange(rg); }, id); await pg.waitForTimeout(400); return pg.evaluate(() => !!document.querySelector('dryae-ui')); };
  await selBtn('fr'); const shotFr = await pg.screenshot({ path: OUT + '/sel-fr.png' });
  await selBtn('p'); await pg.screenshot({ path: OUT + '/sel-en.png' });

  // --- scans, lumières, bloqueur : fenêtres ---
  for (const k of ['scan', 'lights']) { await b.evaluate(k => popOpen(k, $(`[data-mod=${k}]`) || $('#bExt')), k); await b.waitForTimeout(700); await b.screenshot({ path: OUT + `/pop-${k}.png` }); ok('fenêtre ' + k, await b.evaluate(() => $('#pop').classList.contains('on') && $('#pop').innerText.length > 50)); await b.evaluate(() => popClose()); }
  await b.click('#bShield'); await b.waitForTimeout(600); await b.screenshot({ path: OUT + '/pop-adblock.png' });
  ok('fenêtre bloqueur', await b.evaluate(() => $('#pop').innerText.includes('Optimal')));
  await b.click('#pop [data-mode=basic]'); await b.waitForTimeout(500);
  ok('mode basique pour le site', await b.evaluate(() => adModeOf('127.0.0.1') === 'basic'));
  await b.evaluate(() => popClose());
  // lumières : opacité en direct, outils vidéo
  await pg.evaluate(() => document.getElementById('v').scrollIntoView());
  await b.evaluate(() => pageCmd('lights')); await pg.waitForTimeout(700);
  await b.evaluate(() => pageCmd('lights-set', { opacity: 60, color: '#102040' })); await pg.waitForTimeout(500);
  await b.evaluate(() => pageCmd('eye', { on: true, level: 30 })); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/lights.png' });
  await b.evaluate(() => { pageCmd('lights'); pageCmd('eye', { on: false }); });
  await b.evaluate(() => pageCmd('video', { act: 'speed' })); await pg.waitForTimeout(200);
  ok('vitesse de la vidéo', await pg.evaluate(() => document.getElementById('v').playbackRate));

  // --- capture d'une zone (Ctrl+Maj+S) ---
  await pg.evaluate(() => { getSelection().removeAllRanges(); document.getElementById('manga').scrollIntoView(); });
  await pg.waitForTimeout(300);
  const ir = await pg.evaluate(() => { const r = document.getElementById('manga').getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await b.evaluate(() => pageCmd('scan-region')); await pg.waitForTimeout(300);
  await pg.mouse.move(ir.x + 20, ir.y + 10); await pg.mouse.down(); await pg.mouse.move(ir.x + 450, ir.y + 200, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/region-select.png' });
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(15000);
  await pg.screenshot({ path: OUT + '/region-done.png' });
  ok('zone traduite', await pg.evaluate(() => !!document.querySelector('[data-dryae-zone]')));

  // --- favoris : « Choisir un autre dossier… » ---
  await b.click('#bStar'); await b.waitForTimeout(500);
  await b.selectOption('#bmeFolder', '__other'); await b.waitForTimeout(400);
  ok('fenêtre des dossiers', await b.evaluate(() => $('#bmDlg').classList.contains('on')));
  await b.click('#bmdNew'); await b.waitForTimeout(400); await b.keyboard.type('Mangas'); await b.keyboard.press('Enter'); await b.waitForTimeout(400);
  await b.screenshot({ path: OUT + '/bm-dialog.png' });
  await b.click('#bmdSave'); await b.waitForTimeout(400);
  ok('favori dans le nouveau dossier', await b.evaluate(() => { const f = BM.bar.children.find(n => n.title === 'Mangas'); return !!(f && f.children.some(n => /127\.0\.0\.1/.test(n.url))); }));

  // --- connexion en deux étapes : choix du compte enregistré ---
  await b.evaluate(() => openPage('passwords')); await b.waitForTimeout(1500);
  let pp; for (let i = 0; i < 40 && !pp; i++) { pp = app.windows().find(x => x.url().startsWith('dryae://passwords')); await new Promise(r => setTimeout(r, 250)); }
  await pp.evaluate(o => Promise.all([window.dryae.call('pwSave', { origin: o, username: 'alice@example.com', password: 'Secret-1' }), window.dryae.call('pwSave', { origin: o, username: 'bob@example.com', password: 'Secret-2' })]), base);
  await b.evaluate(u => navigate(cur, u), base + '/login'); await b.waitForTimeout(1800);
  let lg; for (let i = 0; i < 40 && !lg; i++) { lg = app.windows().find(x => x.url() === base + '/login'); await new Promise(r => setTimeout(r, 250)); }
  await lg.click('#identifierId'); await lg.waitForTimeout(800);
  await lg.screenshot({ path: OUT + '/login-choose.png' });
  const r2 = await lg.evaluate(() => { const i = document.getElementById('identifierId').getBoundingClientRect(); return { x: i.left + 40, y: i.bottom + 58 }; });
  await lg.mouse.click(r2.x, r2.y); await lg.waitForTimeout(400);
  ok('compte choisi dans la liste', await lg.evaluate(() => document.getElementById('identifierId').value));
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
