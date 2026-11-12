// 1.6.9 : doublons, erreurs claires (genre + reprise auto), suppression avec fichier, rapport
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const data = Buffer.alloc(300 * 1024, 7);
  let n503 = 0;
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/404')) { r.statusCode = 404; return r.end('no'); }
    if (q.url.startsWith('/503')) { n503++; r.statusCode = 503; return r.end('busy'); }
    r.writeHead(200, { 'Content-Length': data.length, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="essai.bin"' }); r.end(data);
  }).listen(18769);
  const HOME = '/tmp/claude-0/uihome-v169dl'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  const DL = HOME + '/dl'; fs.mkdirSync(DL, { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', dir: DL, categorize: false }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  app.process().stderr.on('data', d => process.stdout.write('ERR ' + d)); console.log('launched'); const w = await app.firstWindow(); console.log('win'); await wait(3500);
  const call = (ch, ...a) => w.evaluate(([ch, a]) => window.dryae.call(ch, ...a), [ch, a]);
  const U = 'http://127.0.0.1:18769/f/essai.bin';
  console.log('lancé'); const r1 = await call('add', { urls: [U], startNow: true }); console.log('r1', JSON.stringify(r1).slice(0,200));
  let v; for (let i = 0; i < 40; i++) { await wait(300); v = (await call('list')).find(d => d.id === r1[0].id); if (v?.status === 'done') break; } console.log('v', v && v.status, v && v.error);
  ok('téléchargement terminé', v?.status === 'done', v?.status);
  const r2 = await call('add', { urls: [U], startNow: true });
  ok('doublon signalé avec le fichier existant', r2[0]?.duplicate && r2[0].duplicate.file && r2[0].duplicate.url === U, r2[0]?.duplicate);
  const r3 = await call('add', { urls: [U, 'http://127.0.0.1:18769/f/autre.bin'], startNow: false });
  ok('plusieurs liens : doublon séparé, l\'autre ajouté', r3.filter(x => x.duplicate).length === 1 && r3.filter(x => !x.duplicate).length === 1);
  const r4 = await call('add', { urls: ['http://127.0.0.1:18769/404/x.bin'], startNow: true });
  const r5 = await call('add', { urls: ['http://127.0.0.1:18769/503/y.bin'], startNow: true });
  await wait(4500);
  const L = await call('list');
  const e4 = L.find(d => d.id === r4[0].id), e5 = L.find(d => d.id === r5[0].id);
  ok('404 → « le fichier n\'existe plus sur le site »', e4?.errKind === 'gone' && /expiré/.test(e4.errText), { k: e4?.errKind, e: e4?.error });
  ok('503 → reprise automatique programmée', e5?.errKind === 'server' && e5.retryAt > Date.now(), { k: e5?.errKind, r: e5?.retryAt });
  // fenêtre « Retirer » avec la case « Supprimer aussi le fichier »
  await w.evaluate(id => { window.__rm = id; }, r1[0].id);
  await w.keyboard.press('Escape');
  const file = v.file;
  await w.evaluate(id => { removeItems([id], true); }, r1[0].id);
  await wait(400);
  const dlg = await w.evaluate(() => ({ on: document.querySelector('#askModal').classList.contains('on'), chk: document.querySelector('#askChk').checked, txt: document.querySelector('#askChkTxt').textContent }));
  ok('fenêtre Retirer : case cochée avec Maj+Suppr', dlg.on && dlg.chk && /Corbeille/.test(dlg.txt), dlg);
  await w.click('#askBtns .danger'); await wait(1200);
  ok('fichier retiré du disque', !fs.existsSync(file), file);
  // tests de résistance : dossier interdit, dossier disparu → messages clairs, rien ne se fige
  const RO = HOME + '/unfichier'; fs.writeFileSync(RO, 'x');
  const r6 = await call('add', { urls: ['http://127.0.0.1:18769/f/p.bin'], dir: RO + '/sous', startNow: true });
  const r7 = await call('add', { urls: ['http://127.0.0.1:18769/f/q.bin'], dir: '/dev/null/' + Date.now(), startNow: true });
  let L2; for (let i = 0; i < 30; i++) { await wait(400); L2 = await call('list'); if ([r6, r7].every(r => L2.find(d => d.id === r[0].id)?.status === 'error')) break; }
  const e6 = L2.find(d => d.id === r6[0].id), e7 = L2.find(d => d.id === r7[0].id);
  console.log(JSON.stringify([e6,e7].map(e=>e&&{s:e.status,d:e.dir,f:e.file})));
  ok('dossier impossible à créer → message clair', ['perm', 'nodir'].includes(e6?.errKind), { k: e6?.errKind, e: e6?.error });
  ok('dossier introuvable → message clair', ['nodir', 'perm'].includes(e7?.errKind), { k: e7?.errKind, e: e7?.error });
  const ui = await w.evaluate(() => document.title); ok('interface toujours réactive', !!ui);
  const rep = await call('report'); ok('rapport créé (sans adresse complète)', fs.existsSync(rep) && !fs.readFileSync(rep, 'utf8').includes('/f/essai.bin'), rep);
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
