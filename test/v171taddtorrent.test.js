// 1.7.1 : nouvelle fenêtre d'ajout de torrent : « Enregistrer dans » (Torrents par défaut, dossiers des catégories, Parcourir),
// options, informations, arbre des fichiers avec filtre, « Ne plus afficher »
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const be = v => typeof v === 'number' ? Buffer.from('i' + v + 'e') : Buffer.isBuffer(v) ? Buffer.concat([Buffer.from(v.length + ':'), v]) : typeof v === 'string' ? be(Buffer.from(v)) :
  Array.isArray(v) ? Buffer.concat([Buffer.from('l'), ...v.map(be), Buffer.from('e')]) : Buffer.concat([Buffer.from('d'), ...Object.keys(v).sort().flatMap(k => [be(k), be(v[k])]), Buffer.from('e')]);
(async () => {
  const HOME = '/tmp/claude-0/uihome-v171tadd'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.mkdirSync(HOME + '/Films', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', dir: HOME + '/dl', categorize: true, catDirs: { video: HOME + '/Films' } }));
  const files = [['Saison 1', 'Episode 01.mkv'], ['Saison 1', 'Episode 02.mkv'], ['Saison 2', 'Episode 01.mkv'], ['Lisez-moi.txt'], ['Bonus', 'Affiche.jpg']];
  const len = 40000, info = { name: 'Ma Serie Libre', 'piece length': 16384, files: files.map(p => ({ length: len, path: p })) };
  info.pieces = Buffer.concat(Array.from({ length: Math.ceil(len * files.length / 16384) }, () => crypto.randomBytes(20)));
  const TF = HOME + '/essai.torrent'; fs.writeFileSync(TF, be({ announce: 'udp://tracker.exemple.org:1337', comment: 'Fichier d\'essai', 'creation date': 1790000000, info }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(3000);
  await w.evaluate(f => showTorrent({ src: f }), TF); await wait(2500);
  const st = await w.evaluate(() => ({ vis: getComputedStyle(document.querySelector('#tInfoBox')).display !== 'none', opts: [...document.querySelectorAll('#tDirSel option')].map(o => o.textContent), path: document.querySelector('#tDirPath').textContent, kv: document.querySelector('#tKv').textContent, rows: document.querySelectorAll('#tFiles .tr').length }));
  ok('la fenêtre montre les réglages et les fichiers', st.vis, st);
  ok('« Enregistrer dans » : Torrents par défaut, puis les dossiers des catégories', /Torrents/.test(st.opts[0]) && st.opts.some(o => /Vidéos/.test(o)) && st.opts.length >= 5, st.opts);
  ok('chemin du dossier affiché', /Torrents/.test(st.path), st.path);
  ok('informations : taille, place libre, date, commentaire, empreinte', /place libre/.test(st.kv) && /Fichier d'essai/.test(st.kv) && /[0-9a-f]{40}/.test(st.kv), st.kv);
  ok('fichiers en arbre : un dossier racine ouvert, ses sous-dossiers fermés', st.rows === 5, st.rows);
  // ouvrir « Saison 1 », filtrer, décocher un dossier
  await w.evaluate(() => { [...document.querySelectorAll('#tFiles [data-tg]')].find(b => /Saison 1$/.test(b.dataset.tg)).click(); });
  const r2 = await w.evaluate(() => document.querySelectorAll('#tFiles .tr').length);
  ok('dossier déplié au clic', r2 === 7, r2);
  await w.evaluate(() => { const x = [...document.querySelectorAll('#tFiles [data-td]')].find(b => /Bonus$/.test(b.dataset.td)); x.checked = false; x.dispatchEvent(new Event('change', { bubbles: true })); });
  const sel = await w.evaluate(() => document.querySelector('#tSel').textContent);
  ok('décocher un dossier décoche ses fichiers', /4\/5/.test(sel), sel);
  await w.evaluate(() => { const f = document.querySelector('#tFilter'); f.value = 'episode 01'; f.dispatchEvent(new Event('input')); });
  const fl = await w.evaluate(() => [...document.querySelectorAll('#tFiles .tr .n')].map(n => n.textContent));
  ok('filtre des fichiers', fl.filter(n => /Episode 01/.test(n)).length === 2 && !fl.some(n => /Episode 02|Lisez/.test(n)), fl);
  await w.evaluate(() => { const f = document.querySelector('#tFilter'); f.value = ''; f.dispatchEvent(new Event('input')); });
  // dossier d'une catégorie, options, « Ne plus afficher »
  await w.evaluate(() => { const s = document.querySelector('#tDirSel'); s.value = [...s.options].find(o => /Vidéos/.test(o.textContent)).value; s.dispatchEvent(new Event('change')); });
  await wait(400);
  await w.evaluate(() => { document.querySelector('#tTop').checked = true; document.querySelector('#tStart').checked = false; document.querySelector('#tFL').checked = true; document.querySelector('#tRemember').checked = true; document.querySelector('#tNoAsk').checked = true; });
  await w.screenshot({ path: HOME + '/fenetre-torrent.png' }).catch(() => {});
  await w.evaluate(() => document.querySelector('#tOk').click()); await wait(1500);
  const list = await w.evaluate(() => window.dryae.call('list'));
  const t = (list || []).find(d => d.type === 'torrent') || {};
  ok('torrent ajouté dans le dossier de la catégorie choisie', t.dir === HOME + '/Films', t.dir);
  ok('options gardées : en haut de la file, pas démarré, premiers/derniers morceaux, 4 fichiers', t.top && t.status === 'paused' && t.firstLast && (t.selected || []).length === 4, { top: t.top, st: t.status, fl: t.firstLast, sel: t.selected });
  const S = await w.evaluate(() => window.dryae.call('getSettings'));
  ok('« Se souvenir du dernier dossier » et « Ne plus afficher » enregistrés', S.torrent.rememberDir && S.torrent.lastDir === HOME + '/Films' && S.torrent.askAdd === false, S.torrent);
  // fenêtre plus affichée : le torrent suivant est ajouté tout de suite
  const TF2 = HOME + '/essai2.torrent'; info.name = 'Autre Serie'; fs.writeFileSync(TF2, be({ info }));
  await w.evaluate(f => showTorrent({ src: f }), TF2); await wait(2500);
  const st2 = await w.evaluate(async () => ({ open: document.querySelector('#tModal').classList.contains('show') || getComputedStyle(document.querySelector('#tModal')).display !== 'none', n: (await window.dryae.call('list')).filter(d => d.type === 'torrent').length }));
  ok('« Ne plus afficher » : torrent suivant ajouté sans la fenêtre', !st2.open && st2.n === 2, st2);
  // dans le navigateur : torrent cliqué sur une page → même choix de dossier et mêmes options
  await w.evaluate(() => window.dryae.call('setSettings', { torrent: { askAdd: true, rememberDir: false } }));
  const TF3 = HOME + '/essai3.torrent'; info.name = 'Troisieme'; fs.writeFileSync(TF3, be({ info }));
  await w.evaluate(() => window.dryae.call('openBrowser', 'dryae://start'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); } await wait(2500);
  await b.evaluate(f => openQuickTorrent({ src: f, page: 'dryae://start' }), TF3); await wait(2500);
  const bq = await b.evaluate(() => ({ opts: [...document.querySelectorAll('#tDirSel option')].map(o => o.textContent), path: document.querySelector('#tDirPath')?.textContent, rows: document.querySelectorAll('#tFiles .tr').length, kv: document.querySelector('#tKv')?.textContent, wide: document.querySelector('#qs .modal').classList.contains('big'), ids: ['#tStart', '#tTop', '#tSeq', '#tFL', '#tSeed', '#tSchedule', '#tRemember', '#tNoAsk', '#tSaveFile', '#tFilter', '#tAll', '#tNone', '#tVideos', '#tOk'].filter(x => !document.querySelector(x)) }));
  ok('navigateur : la même fenêtre que le gestionnaire (dossiers, options, informations, arbre)', /Torrents/.test(bq.opts[0] || '') && bq.opts.some(o => /Vidéos/.test(o)) && bq.rows === 5 && /place libre/.test(bq.kv) && bq.wide && !bq.ids.length, bq);
  await b.evaluate(() => { const s = document.querySelector('#tDirSel'); s.value = [...s.options].find(o => /Vidéos/.test(o.textContent)).value; s.dispatchEvent(new Event('change')); document.querySelector('#tTop').checked = true; document.querySelector('#tFL').checked = true; });
  await wait(400); await b.screenshot({ path: HOME + '/navigateur-torrent.png' }).catch(() => {});
  await b.evaluate(() => document.querySelector('#tOk').click()); await wait(1500);
  const t3 = (await w.evaluate(() => window.dryae.call('list'))).find(d => d.name === 'Troisieme') || {};
  ok('navigateur : torrent ajouté dans le dossier choisi, avec ses options', t3.dir === HOME + '/Films' && t3.top && t3.firstLast, { dir: t3.dir, top: t3.top, fl: t3.firstLast });
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
