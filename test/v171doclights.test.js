// 1.7.1 (version perso) : lumières tamisées et mode nuit sur les fichiers ouverts depuis l'ordinateur (PDF, texte, BD), sans connexion
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); 
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
// petit PDF d'une page fabriqué ici (pas de fichier externe)
function makePdf() {
  const st = 'BT /F1 24 Tf 72 760 Td (Document PDF de test DrYAE) Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${st.length} >>\nstream\n${st}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
(async () => {
  const HOME = '/tmp/claude-0/uihome-v171dl'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  fs.writeFileSync(HOME + '/roman.txt', 'Chapitre premier\n\n' + 'Il était une fois un long texte de roman. '.repeat(200));
  fs.writeFileSync(HOME + '/livre.pdf', makePdf());
  // fichiers lus sur le disque : rien ne passe par internet
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(u => window.dryae.call('openBrowser', u), 'file://' + HOME + '/roman.txt');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(2500);
  const lit = () => b.evaluate(() => !!cur.lit);
  const js = c => b.evaluate(c => cur.wv.executeJavaScript(c), c);
  // 1) texte (.txt) ouvert depuis l'ordinateur
  await b.evaluate(() => pageCmd('lights')); await wait(1000);
  ok('texte de l\'ordinateur : lumières éteintes', await lit());
  await b.evaluate(() => pageCmd('lights')); await wait(800);
  ok('texte : lumières rallumées', !(await lit()));
  await b.evaluate(() => pageCmd('night', { on: true })); await wait(600);
  const nt = await js(`getComputedStyle(document.documentElement).filter`);
  ok('texte : mode nuit appliqué', /invert/.test(nt), nt);
  await b.evaluate(() => pageCmd('night', { on: false })); await wait(400);
  // 2) PDF de l'ordinateur
  await b.evaluate(u => navigate(cur, u), 'file://' + HOME + '/livre.pdf'); await wait(4000);
  await b.evaluate(() => pageCmd('lights')); await wait(1000);
  ok('PDF de l\'ordinateur : lumières éteintes', await lit());
  await b.evaluate(() => pageCmd('lights')); await wait(600);
  await b.evaluate(() => pageCmd('night', { on: true })); await wait(800);
  const pf = await js(`[getComputedStyle(document.documentElement).filter, [...document.querySelectorAll('embed')].map(e => getComputedStyle(e).filter).join()]`);
  ok('PDF de l\'ordinateur : mode nuit, pages foncées aussi', /invert/.test(pf[0]) && !/invert/.test(pf[1]), pf);
  await b.evaluate(() => pageCmd('night', { on: false })); await wait(400);
  // 2b) lecteur PDF de DrYAE (PDF venu d'une adresse locale)
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'application/pdf'); r.end(makePdf()); }).listen(0);
  await b.evaluate(u => newTab(u), 'http://127.0.0.1:' + srv.address().port + '/livre.pdf'); await wait(5000);
  const u = await b.evaluate(() => cur.url);
  ok('PDF dans le lecteur de DrYAE', /^dryae:\/\/pdf\//.test(u), [u, await b.evaluate(() => tabs.map(t => t.url))]);
  await b.evaluate(() => pageCmd('lights')); await wait(1000);
  ok('lecteur PDF : lumières éteintes', await lit());
  await b.evaluate(() => pageCmd('night', { on: true })); await wait(800);
  const pv = app.windows().find(x => x.url().startsWith('dryae://pdf/'));
  const pf2 = pv ? await pv.evaluate(() => [getComputedStyle(document.documentElement).filter, [...document.querySelectorAll('canvas')].some(c => /invert/.test(getComputedStyle(c).filter))]) : [];
  ok('lecteur PDF : mode nuit, pages foncées aussi', /invert/.test(pf2[0] || '') && pf2[1] === false, pf2);
  srv.close();
  // 3) lumières éteintes partout : la page suivante (fichier de l'ordinateur) est sombre dès son ouverture
  await b.evaluate(u => newTab(u), 'file://' + HOME + '/roman.txt'); await wait(2500);
  ok('nouvel onglet (fichier) déjà dans le noir', await lit());
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
