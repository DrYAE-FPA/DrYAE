// 1.6.9 : capture haute définition — image protégée (le fichier ne peut pas être récupéré) affichée en petit :
// la zone est redessinée plus grande avant la lecture, le texte reste lisible.
// Page de référence : IMG (par défaut /home/claude/scan-ref/p26-original-en.png ; test ignoré si absente)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 400) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const IMG = process.env.IMG || '/home/claude/scan-ref/p26-original-en.png';
if (!fs.existsSync(IMG)) { console.log('OK  (page de référence absente : test ignoré)'); process.exit(0); }
(async () => {
  const seen = []; let blocked = 0;
  const srv = http.createServer((q, r) => {
    if (q.url === '/prot.png') {
      // image protégée : seulement pour l'affichage dans la page, pas pour un téléchargement direct
      if (q.headers['sec-fetch-dest'] !== 'image') { blocked++; r.statusCode = 403; return r.end(); }
      r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync(IMG));
    }
    if (q.url === '/translate') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); const qs = [].concat(j.q); seen.push(qs); r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: qs.map(s => 'FR ' + s), detectedLanguage: { language: 'en' } })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end('<!doctype html><title>Lecteur</title><body style="margin:0;background:#fff"><img src="/prot.png" style="display:block;margin:20px auto;width:330px">');
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169scan3'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base, target: 'fr' } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await wait(250); }
  await wait(2500);
  await b.evaluate(() => pageCmd('scan'));
  for (let i = 0; i < 120 && !seen.some(q => q.length > 1); i++) await wait(500);
  const txt = seen.filter(q => q.length > 1).flat().join(' ');
  console.log(txt);
  ok('image protégée : fichier refusé, lecture faite sur la page', blocked > 0 && txt.length > 0, { blocked });
  const words = txt.toUpperCase().match(/[A-Z]{3,}/g) || [];
  ok('capture haute définition : texte lisible (EXORCIST, PERFORMANCE, OUTSIDER)', /EXORCIST/i.test(txt) && /PERFORMANCE/i.test(txt) && /OUTSIDER/i.test(txt), words.length);
  // 1.7.0 : lumières tamisées allumées (page assombrie à l'écran) : la lecture se fait quand même sur l'image normale
  seen.length = 0;
  await b.evaluate(() => pageCmd('lights')); await wait(1200);
  const dark = await pg.evaluate(() => { const d = [...document.querySelectorAll('body > *')].length; return d; }).catch(() => 0);
  await b.evaluate(() => pageCmd('scan')); await wait(500); await b.evaluate(() => pageCmd('scan'));
  for (let i = 0; i < 120 && !seen.some(q => q.length > 1); i++) await wait(500);
  const txt2 = seen.filter(q => q.length > 1).flat().join(' ');
  ok('lumières tamisées : l\'image est lue sans le voile (EXORCIST, PERFORMANCE)', /EXORCIST/i.test(txt2) && /PERFORMANCE/i.test(txt2), txt2.slice(0, 160));
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error('ÉCHEC', e); process.exit(1); });
