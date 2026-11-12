// 1.6.9 : déplacer les favoris de la barre (glisser-déposer) ; fenêtres d'extensions fermées par un clic dans la page
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const srv = http.createServer((q, r) => {
    if (q.url === '/favicon.ico') { r.writeHead(200, { 'Content-Type': 'image/png', 'Cross-Origin-Resource-Policy': 'same-origin' }); return r.end(PNG); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end('<title>Page</title><body style="height:2000px"><p id=p>Bonjour</p>'); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169bm'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { showBookmarksBar: true } }));
  const bm = (id, t) => ({ id, type: 'url', title: t, url: base + '/' + t, t: 1 });
  fs.writeFileSync(HOME + '/.config/DrYAE/browser.json', JSON.stringify({ bm: { bar: { id: 'bar', type: 'folder', title: 'Barre de favoris', children: [bm('a', 'Alpha'), bm('b', 'Bravo'), { id: 'f', type: 'folder', title: 'Dossier', children: [] }, bm('c', 'Charlie')] }, other: { id: 'other', type: 'folder', title: 'Autres favoris', children: [] } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await wait(2500);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await b.evaluate(u => navigate(cur, u), base + '/'); await wait(1500);
  const order = () => b.evaluate(() => [...document.querySelectorAll('#bmbar .bi[data-bm]')].map(x => x.textContent.trim()));
  console.log('avant', await order());
  const cw = (await b.locator('#bmbar [data-bm="c"]').boundingBox()).width; // bord droit de Charlie, quelle que soit la police
  await b.dragAndDrop('#bmbar [data-bm="a"]', '#bmbar [data-bm="c"]', { targetPosition: { x: Math.max(1, cw - 3), y: 8 } });
  await wait(800);
  const o1 = await order(); ok('Alpha déplacé après Charlie', o1.join(',') === 'Bravo,Dossier,Charlie,Alpha', o1);
  await b.dragAndDrop('#bmbar [data-bm="c"]', '#bmbar [data-bm="b"]', { targetPosition: { x: 2, y: 8 } });
  await wait(800);
  const o2 = await order(); ok('Charlie déplacé avant Bravo', o2[0] === 'Charlie', o2);
  await b.dragAndDrop('#bmbar [data-bm="f"]', '#bmbar [data-bm="a"]', { targetPosition: { x: 40, y: 8 } });
  await wait(800);
  const o3 = await order(); ok('un dossier se déplace aussi', o3[o3.length - 1] === 'Dossier', o3);
  await wait(1500);
  const fav = await b.evaluate(() => { const i = document.querySelector('.tab.on img, #tabs .tab img'); return i ? { src: i.src.slice(0, 30), w: i.naturalWidth } : null; });
  ok('icône de l\'onglet affichée (même interdite d\'affichage ailleurs)', fav && fav.src.startsWith('data:image/png') && fav.w === 1, fav);
  // fenêtre intégrée (lumières) puis clic dans la page -> fermée
  await b.evaluate(() => { const btn = document.querySelector('#tbItems [data-mod="lights"]') || document.querySelector('#tbItems button'); btn && btn.click(); }); await wait(600);
  const open1 = await b.evaluate(() => document.querySelector('#pop')?.classList.contains('on'));
  const wv = await b.$('webview'); const bx = await wv.boundingBox();
  await b.mouse.click(bx.x + 200, bx.y + 300); await wait(600);
  const open2 = await b.evaluate(() => document.querySelector('#pop')?.classList.contains('on'));
  ok('fenêtre fermée par un clic dans la page', open1 && !open2, { open1, open2 });
  // protection des yeux : la nouvelle page s'affiche (plus de page vide) ; lumières éteintes : restent sur la page suivante
  await b.evaluate(() => B.call('lights:pref', { eye: true })).catch(() => {});
  await b.evaluate(() => window.br.call('br:setModule', 'lights', { enabled: true })).catch(() => {});
  const pages = () => app.windows().filter(x => x.url().startsWith(base));
  await b.evaluate(u => navigate(cur, u), base + '/autre'); await wait(1800);
  let pg = pages().slice(-1)[0];
  const st = pg && await pg.evaluate(() => ({ txt: document.body && document.body.innerText, root: document.documentElement.tagName, after: getComputedStyle(document.documentElement, '::after').backgroundColor }));
  ok('protection des yeux : page affichée normalement', st && st.root === 'HTML' && /Bonjour/.test(st.txt) && /rgba\(255, 150, 40/.test(st.after), st);
  await b.evaluate(() => pageCmd('lights')); await wait(900);
  await b.evaluate(u => navigate(cur, u), base + '/troisieme'); await wait(2200);
  pg = pages().slice(-1)[0];
  const lit = await b.evaluate(() => cur.lit);
  ok('lumières éteintes gardées sur la page suivante', lit === true, lit);
  await b.evaluate(() => newTab(location.href.startsWith('file') ? '' : '')); 
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
