// 1.7.0 : longues sessions de travail — espaces de travail, collections (export Word / PDF), citer une page,
// surlignages et notes, conteneurs, recherche dans le texte des pages visitées, palette de commandes,
// calculs dans la barre d'adresse, vitesse des vidéos, mode présentation, onglets inactifs, rappels de pause
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v170'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/set')) { r.setHeader('Set-Cookie', 'who=' + q.url.split('=')[1] + '; Path=/'); r.end('<title>set</title>ok'); return; }
    if (q.url === '/who') { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(`<title>who</title><p id="w">${(q.headers.cookie || '').replace(/[<>]/g, '')}</p>`); return; }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); const n = q.url.slice(1) || 'accueil';
    r.end(`<html><head><title>Article ${n} - Le Journal</title><meta name="author" content="Marie Curie"><meta property="og:site_name" content="Le Journal"><meta property="article:published_time" content="2024-03-05T10:00:00Z"></head><body><h1>Article ${n}</h1><p>Le premier paragraphe parle de la photosynthèse des plantes vertes.</p><p>Un second paragraphe évoque le mot zygomorphe pour la recherche.</p><video src="data:video/mp4;base64," muted></video></body></html>`);
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v170'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { showBookmarksBar: true } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  app.on('console', m => { if (/Error|error/.test(m.text())) console.log('[main]', m.text().slice(0, 300)); });
  await app.firstWindow(); await wait(2500);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await b.evaluate(u => navigate(cur, u + '/un'), base);
  await b.evaluate(u => { newTab(u + '/deux', { background: true }); }, base);
  await wait(2500);

  // --- barre de favoris : invisible tant qu'aucun favori n'y est placé
  const bar0 = await b.evaluate(() => ({ on: document.querySelector('#bmbar').classList.contains('on'), h: document.querySelector('#bmbar').offsetHeight, txt: document.querySelector('#bmbar').textContent }));
  await b.evaluate(u => B.call('br:bmAdd', { parentId: 'bar', type: 'url', title: 'Mon favori', url: u + '/fav' }), base); await wait(600);
  const bar1 = await b.evaluate(() => ({ on: document.querySelector('#bmbar').classList.contains('on'), txt: document.querySelector('#bmbar').textContent }));
  ok('barre de favoris cachée sans favori, visible dès qu\'un favori y est placé', !bar0.on && bar0.h === 0 && !/Autres favoris/.test(bar0.txt) && bar1.on && /Mon favori/.test(bar1.txt), { bar0, bar1 });
  await b.evaluate(() => B.call('br:bmRemove', [BM.bar.children[0].id])); await wait(600);
  ok('barre de favoris de nouveau cachée quand elle est vide', !(await b.evaluate(() => document.querySelector('#bmbar').classList.contains('on'))));

  // --- espaces de travail
  await b.evaluate(() => TABSX.toggleSide('ws')); await wait(400);
  await b.fill('#wsName', 'Révisions maths'); await b.click('[data-w="ws-save"]'); await wait(500);
  const sp = await b.evaluate(() => B.call('br:spaces'));
  ok('espace de travail enregistré avec les 2 onglets', sp.length === 1 && sp[0].name === 'Révisions maths' && sp[0].tabs.length === 2, sp.map(x => [x.name, x.tabs.length]));
  await b.evaluate(() => { closeTab(tabs[1]); }); await wait(200);
  await b.evaluate(() => document.querySelector('[data-w="ws-replace"]').click()); await wait(300);
  await b.evaluate(() => document.querySelector('#askF .primary').click()); await wait(1500);
  const ws = await b.evaluate(() => tabs.map(t => t.url.replace(/^.*\//, '')));
  ok('« Remplacer les onglets » : les onglets de l\'espace sont rouverts', ws.join() === 'un,deux', ws);
  await b.evaluate(() => TABSX.drawSide()); await wait(300); await b.evaluate(() => document.querySelector('details.wsx')?.setAttribute('open', '')); await b.screenshot({ path: OUT + '/spaces.png' });

  // --- collections
  await b.evaluate(() => TABSX.toggleSide('col')); await wait(400);
  await b.evaluate(() => document.querySelector('[data-w="col-new"]').click()); await wait(500);
  await b.evaluate(() => document.querySelector('[data-w="col-page"]').click()); await wait(400);
  await b.evaluate(() => { const t = document.querySelector('#colNote'); t.value = 'Idée pour l\'exposé'; document.querySelector('[data-w="col-note"]').click(); }); await wait(400);
  await b.evaluate(() => B.call('br:cols').then(l => B.call('br:colAdd', l[0].id, { type: 'text', text: 'Passage copié', url: cur.url, title: cur.title })));
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAL0lEQVR4XmM8YWTEMBCAaSAsBYFRi+kGRoOabmA0qOkGRoOabmA0qOkGRoOabgAA2VcBVFMCnZgAAAAASUVORK5CYII=';
  await b.evaluate(p => B.call('br:cols').then(l => B.call('br:colAdd', l[0].id, { type: 'image', src: p, url: cur.url, title: 'Image' })), png); await wait(300);
  const cl = await b.evaluate(() => B.call('br:cols'));
  await b.evaluate(() => TABSX.drawSide()); await wait(400); await b.screenshot({ path: OUT + '/collections.png' });
  ok('collection : page, note, passage et image ajoutés', cl.length === 1 && cl[0].items.map(i => i.type).join() === 'page,note,text,image', cl[0].items.map(i => i.type));
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: o.defaultPath.endsWith('.pdf') ? f + '.pdf' : f + '.docx' }); }, OUT + '/collection');
  const fx = await b.evaluate(() => B.call('br:cols').then(l => Promise.all([B.call('br:colExport', l[0].id, 'docx'), B.call('br:colExport', l[0].id, 'pdf')])));
  const docOk = fs.existsSync(OUT + '/collection.docx') && fs.statSync(OUT + '/collection.docx').size > 1500, pdfOk = fs.existsSync(OUT + '/collection.pdf') && fs.readFileSync(OUT + '/collection.pdf').slice(0, 4).toString() === '%PDF';
  ok('collection exportée en Word (.docx) et en PDF', docOk && pdfOk, fx);
  try { const x = require('child_process').execSync(`unzip -p '${OUT}/collection.docx' word/document.xml`).toString(); const media = require('child_process').execSync(`unzip -l '${OUT}/collection.docx'`).toString(); ok('document Word lisible (titres, citation, note, image, langue)', /w:val="Heading1"/.test(x) && /Collection 1/.test(x) && /w:val="Quote"/.test(x) && /Passage copié/.test(x) && /w:val="Note"/.test(x) && /<w:drawing>/.test(x) && /word\/media\/image1\.png/.test(media) && /w:lang w:val="fr-FR"/.test(require('child_process').execSync(`unzip -p '${OUT}/collection.docx' word/styles.xml`).toString())); } catch (e) { ok('document Word lisible', false, e.message); }

  // --- surlignage + note, retrouvé après rechargement
  await b.evaluate(() => cur.wv.executeJavaScript(`(() => { const p = document.querySelectorAll('p')[0]; const t = p.firstChild; const r = document.createRange(); r.setStart(t, 3); r.setEnd(t, 27); getSelection().removeAllRanges(); getSelection().addRange(r); return String(getSelection()); })()`));
  await b.evaluate(() => pageCmd('hl', { color: 'green' })); await wait(500);
  const h1 = await b.evaluate(() => cur.wv.executeJavaScript(`[...document.querySelectorAll('mark.dryae-hl')].map(m => m.dataset.c + ':' + m.textContent).join('|')`));
  ok('passage surligné en vert', /^green:premier paragraphe parle$/.test(h1), h1);
  await b.evaluate(() => cur.wv.reload()); await wait(2500);
  const h2 = await b.evaluate(() => cur.wv.executeJavaScript(`[...document.querySelectorAll('mark.dryae-hl')].map(m => m.dataset.c + ':' + m.textContent).join('|')`));
  ok('surlignage retrouvé à la visite suivante', h1 === h2, h2);
  await b.evaluate(() => TABSX.toggleSide('notes')); await wait(500);
  const nm = await b.evaluate(() => document.querySelector('#sideBody').textContent);
  ok('panneau Notes : liste des surlignages de la page', /premier paragraphe parle/.test(nm));

  // --- citer cette page
  await b.evaluate(() => WORK.cite()); await wait(800);
  const ci = await b.evaluate(() => [...document.querySelectorAll('#ciOut .notr')].map(x => x.textContent));
  ok('citation APA / MLA / ISO 690', ci.length === 3 && /^Curie, M\. \(2024, 5 mars\)\. Article un\. Le Journal\./.test(ci[0]) && /^Curie, Marie\. « Article un\. » Le Journal, 5 mars 2024/.test(ci[1]) && /^CURIE, Marie\. Article un \[en ligne\]/.test(ci[2]), ci);
  await b.screenshot({ path: OUT + '/cite.png' });
  await b.keyboard.press('Escape'); await b.evaluate(() => document.querySelectorAll('.overlay.on').forEach(o => o.remove()));

  // --- palette de commandes
  await b.evaluate(() => onKey('k', true, false, false)); await wait(300);
  await b.keyboard.type('mode lect'); await wait(200);
  const pl = await b.evaluate(() => [...document.querySelectorAll('#palL [data-i]')].map(x => x.textContent.trim()));
  ok('Ctrl+K : palette de commandes, « mode lect » trouve « Mode lecture »', pl.length >= 1 && /Mode lecture/.test(pl[0]), pl.slice(0, 3));
  await b.keyboard.press('Escape'); await wait(200);
  ok('palette fermée par Échap', !(await b.evaluate(() => !!document.getElementById('palDlg'))));

  // --- calculs dans la barre d'adresse
  const cc = await b.evaluate(async () => [await WORK.calc('15 % de 2400'), await WORK.calc('5 km en miles'), await WORK.calc('(2+3)*4'), await WORK.calc('100 °F en °C')].map(x => x && x.text));
  ok('calculs et conversions', cc[0] === '15 % de 2400 = 360' && /= 3,106856 miles/.test(cc[1]) && /= 20$/.test(cc[2]) && /37,777778 °C/.test(cc[3]), cc);
  await b.click('#url'); await b.fill('#url', ''); await b.keyboard.type('2*21'); await wait(600);
  const sg = await b.evaluate(() => document.querySelector('#sug button')?.textContent);
  ok('résultat affiché dans les suggestions', /2\*21 = 42/.test(sg || ''), sg);
  await b.keyboard.press('Escape');

  // --- conteneurs : cookies séparés
  await b.evaluate(u => navigate(cur, u + '/set?v=normal'), base); await wait(1200);
  await b.evaluate(u => { const t = newTab(u + '/set?v=pro', { container: 'c1' }); }, base); await wait(1500);
  await b.evaluate(u => navigate(cur, u + '/who'), base); await wait(1200);
  const w1 = await b.evaluate(() => cur.wv.executeJavaScript('document.getElementById("w").textContent'));
  await b.evaluate(u => newTab(u + '/who'), base); await wait(1500);
  const w2 = await b.evaluate(() => cur.wv.executeJavaScript('document.getElementById("w").textContent'));
  ok('conteneur : cookies séparés de l\'onglet normal', w1 === 'who=pro' && w2 === 'who=normal', [w1, w2]);
  ok('onglet de conteneur marqué de sa couleur', await b.evaluate(() => tabs.some(t => t.container === 'c1' && t.el.classList.contains('ctn'))));

  // --- recherche dans le texte des pages visitées
  await b.evaluate(u => navigate(cur, u + '/trois'), base); await wait(6000);
  await b.evaluate(() => openPage('history')); await wait(2000);
  const res = await b.evaluate(() => cur.wv.executeJavaScript('call("history", "zygomorphe")')).catch(e => String(e));
  await b.evaluate(() => cur.wv.executeJavaScript('(() => { const q = document.querySelector("#q"); q.value = "zygomorphe"; q.dispatchEvent(new Event("input")); })()')); await wait(800);
  await b.screenshot({ path: OUT + '/history-text.png' });
  await b.evaluate(() => closeTab(cur)); await wait(300);
  ok('historique : page retrouvée par un mot de son texte', Array.isArray(res) && res.some(h => /trois/.test(h.url) && /zygomorphe/.test(h.snippet || '')), res);

  // --- vitesse des vidéos (mémorisée par site)
  await b.evaluate(() => B.call('br:speed', cur.wcId, 1.5)); await wait(500);
  const spd = await b.evaluate(() => B.call('br:settings').then(c => c.videoSpeed));
  ok('vitesse ×1,5 mémorisée pour le site', spd && spd['127.0.0.1'] === 1.5, spd);
  await b.evaluate(() => cur.wv.reload()); await wait(2000);
  const rate = await b.evaluate(() => cur.wv.executeJavaScript('document.querySelector("video").play().catch(()=>{}); new Promise(r => setTimeout(() => r(document.querySelector("video").playbackRate), 300))'));
  ok('vidéo relancée à ×1,5 sur ce site', rate === 1.5, rate);

  // --- mode présentation
  await b.evaluate(() => WORK.present(true)); await wait(800);
  const pr = await b.evaluate(() => ({ cls: document.body.classList.contains('present'), bar: getComputedStyle(document.querySelector('.toolbar')).display }));
  const full = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => w.isFullScreen()));
  ok('mode présentation : barres masquées, plein écran', pr.cls && pr.bar === 'none' && full, { ...pr, full });
  await b.screenshot({ path: OUT + '/present.png' });
  await b.evaluate(() => WORK.present(false)); await wait(800);
  ok('mode présentation quitté', !(await b.evaluate(() => document.body.classList.contains('present'))));

  // --- onglets inactifs rangés
  await b.evaluate(() => { tabs[0].seen = Date.now() - 9 * 864e5; });
  await b.evaluate(() => B.call('br:spaceAdd', 'inactive', [{ url: tabs[0].url, title: tabs[0].title }]));
  const ia = await b.evaluate(() => B.call('br:spaces').then(l => l.find(x => x.kind === 'inactive')));
  ok('onglets inactifs gardés dans un espace', ia && ia.tabs.length === 1, ia && ia.tabs.length);

  // --- rappel de pause
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; for (const v of w.contentView.children) v.webContents.send('break', 'eye'); });
  await wait(300);
  const tt = await b.evaluate(() => document.querySelector('#toast').textContent);
  ok('rappel de pause affiché', /Repos des yeux/.test(tt), tt);

  // --- paramètres : section Travail et études
  await b.evaluate(() => openPage('settings')); await wait(2000);
  let setOk = false;
  try { const t = await b.evaluate(() => cur.wv.executeJavaScript('document.querySelector("#s-work") ? document.querySelector("#s-work").textContent : ""')); setOk = /Rappels de pause/.test(t) && /Conteneurs/.test(t) && /Correcteur/.test(t); } catch {}
  ok('Paramètres : section « Travail et études »', setOk);
  await b.screenshot({ path: OUT + '/settings-work.png' });

  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
