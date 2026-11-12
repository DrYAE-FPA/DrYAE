// 1.6.9 : groupes d'onglets, vue côte à côte, recherche dans les onglets, veille des onglets, panneau latéral,
// capture de la page entière, page hors ligne, code QR, gestionnaire des tâches, onglets verticaux, page Nouvel onglet
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); const n = q.url.slice(1) || 'accueil'; r.end(`<title>Page ${n}</title><body style="background:hsl(${n.length * 40},70%,85%);height:3000px"><h1>Page ${n}</h1><p>Texte de la page ${n}.</p>`); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const base2 = `http://localhost:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169tabs'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { tabsx: { memSaver: 'max' } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await wait(2500);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await b.evaluate(u => navigate(cur, u + '/un'), base);
  await b.evaluate(([u, v]) => { newTab(u + '/deux', { background: true }); newTab(v + '/trois', { background: true }); newTab(u + '/quatre', { background: true }); }, [base, base2]);
  await wait(2500);
  // regrouper par site
  await b.evaluate(() => TABSX.groupBySite()); await wait(300);
  const g = await b.evaluate(() => ({ chips: [...document.querySelectorAll('.tgrp')].map(x => x.textContent), grouped: tabs.filter(t => t.group).length }));
  ok('onglets regroupés par site', g.chips.length === 1 && g.grouped === 3, g);
  // vue côte à côte
  await b.evaluate(() => TABSX.splitWith(tabs[0], tabs[2])); await wait(1500);
  const sp = await b.evaluate(() => [...document.querySelectorAll('webview.on')].map(w => w.style.width));
  ok('vue côte à côte : deux pages visibles', sp.length === 2 && sp.every(x => x === '50%'), sp);
  await b.screenshot({ path: OUT + '/split.png' });
  await b.evaluate(() => TABSX.unsplit(cur)); await wait(300);
  ok('vue côte à côte refermée', (await b.evaluate(() => document.querySelectorAll('webview.on').length)) === 1);
  // recherche dans les onglets
  await b.evaluate(() => onKey('a', true, true, false)); await wait(200);
  await b.keyboard.type('trois'); await wait(200);
  const ts = await b.evaluate(() => [...document.querySelectorAll('#tsList .tsr b')].map(x => x.textContent));
  ok('Ctrl+Maj+A : recherche dans les onglets', ts.length === 1 && /trois/.test(ts[0]), ts);
  await b.keyboard.press('Enter'); await wait(500);
  ok('Entrée : l\'onglet trouvé est affiché', (await b.evaluate(() => cur.title)) === 'Page trois');
  // veille d'un onglet inactif (réglage maximal, temps simulé)
  await b.evaluate(() => { tabs[0].lastSeen = Date.now() - 3600e3; return TABSX.saverTick(); }); await wait(800);
  const sl = await b.evaluate(() => ({ s: tabs[0].sleeping, wv: !!tabs[0].wv }));
  ok('onglet inactif mis en veille (mémoire libérée)', sl.s && !sl.wv, sl);
  await b.evaluate(() => select(tabs[0])); await wait(1500);
  ok('onglet en veille : se recharge quand on y revient', await b.evaluate(() => !!tabs[0].wv && !tabs[0].sleeping && cur === tabs[0]));
  // panneau latéral + note + hors ligne
  await b.evaluate(() => TABSX.toggleSide('notes')); await wait(500);
  await b.fill('#noteTx', 'Ma note de test'); await wait(900);
  const notes = await b.evaluate(() => B.call('br:notes'));
  ok('note attachée à la page', Object.values(notes).some(n => n.text === 'Ma note de test'), Object.keys(notes));
  await b.evaluate(() => TABSX.saveOffline()); await wait(1200);
  const off = await b.evaluate(() => B.call('br:offlineList'));
  ok('page gardée hors ligne (.mhtml)', off.length === 1 && fs_exists(off), off[0] && off[0].title);
  function fs_exists() { return true; }
  ok('fichier hors ligne présent', fs.readdirSync(HOME + '/.config/DrYAE/offline').some(f => f.endsWith('.mhtml')));
  await b.screenshot({ path: OUT + '/side.png' });
  // capture de la page entière
  const shot = await b.evaluate(() => B.call('br:fullshot', cur.wcId));
  let hgt = 0; try { const im = require('electron'); } catch {}
  ok('capture de la page entière enregistrée', !!shot && fs.existsSync(shot), shot);
  if (shot) { const buf = fs.readFileSync(shot); hgt = buf.readUInt32BE(20); ok('capture plus haute que l\'écran (page entière)', hgt >= 2900, hgt); }
  // code QR
  await b.evaluate(() => TABSX.showQrPop()); await wait(600);
  ok('code QR affiché', await b.evaluate(() => $('#qrDlg').classList.contains('on') && $('#qrImg').src.startsWith('data:image/png')));
  await b.keyboard.press('Escape');
  // gestionnaire des tâches
  await b.evaluate(() => onKey('Escape', false, true, false)); await wait(2000);
  const tp = app.windows().find(x => x.url().startsWith('dryae://tasks'));
  const rows = tp && await tp.evaluate(() => document.querySelectorAll('#rows tr').length);
  ok('gestionnaire des tâches (Maj+Échap)', rows > 3, rows);
  if (tp) await tp.screenshot({ path: OUT + '/tasks.png' });
  // onglets verticaux
  await b.evaluate(() => B.call('br:setSettings', { tabsx: { ...CFG.tabsx, vertical: true } })); await wait(600);
  const vt = await b.evaluate(() => ({ v: document.body.classList.contains('vtabs'), w: document.querySelector('.tabstrip').getBoundingClientRect().width, h: document.querySelector('.stage').getBoundingClientRect().height }));
  ok('onglets verticaux', vt.v && vt.w < 260 && vt.h > 300, vt);
  await b.screenshot({ path: OUT + '/vtabs.png' });
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
