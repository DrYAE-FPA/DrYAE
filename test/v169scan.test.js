// 1.6.9 : traducteur de scans — modèle coréen, bulles repérées (couleur de fond), ordre de lecture, mémoire, correction, lexique
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const IMG = process.env.IMG || '/tmp/scan/kr.png', MODEL = process.env.MODEL !== '0';
(async () => {
  const seen = [];
  const srv = http.createServer((q, r) => {
    if (q.url === '/page.png') { r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync(IMG)); }
    if (q.url === '/translate') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); const qs = [].concat(j.q); seen.push(qs); const ko = qs.some(s => /[가-힯]/.test(s)); r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: qs.map(s => 'FR: ' + s), detectedLanguage: qs.map(() => ({ language: ko ? 'ko' : 'en', confidence: 90 })) })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end('<!doctype html><title>Lecteur</title><body style="margin:0;background:#222"><img id=i src="/page.png" style="display:block;margin:auto;width:900px">');
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169scan'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE/ocr-models', { recursive: true });
  if (MODEL) for (const f of ['korean_PP-OCRv5_mobile_rec_infer.onnx', 'ppocrv5_korean_dict.txt']) fs.copyFileSync('/tmp/mdl/m/' + f, HOME + '/.config/DrYAE/ocr-models/' + f);
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base }, scan: { glossary: [{ s: '학교', t: 'Konoha' }] } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await wait(1500);
  const scan = () => pg.evaluate(() => window.__r = null).then(() => b.evaluate(() => B.call('br:models-noop').catch(() => 0)));
  // appel direct de la lecture (même chemin que l'icône), puis affichage par la commande de la page
  const res = await pg.evaluate(async () => { const { ipcRenderer } = window; return null; }).catch(() => null);
  const t0 = Date.now();
  await b.evaluate(() => pageCmd('scan'));
  let n = 0; for (let i = 0; i < (MODEL ? 60 : 16); i++) { await wait(500); n = seen.length; if (n >= 2) break; }
  await wait(1500);
  await pg.screenshot({ path: OUT + '/scan-' + path.basename(IMG) });
  console.log('durée', Date.now() - t0, 'ms');
  await wait(2500);
  const q = seen[seen.length - 1] || [];
  if (MODEL) {
    ok('coréen lu avec son modèle, une bulle = un texte', q.length === 3 && q.every(s => /[가-힯]/.test(s)), q);
    ok('lexique appliqué avant la traduction', q.some(s => s.includes('Konoha')), q);
  }
  let cache = []; try { cache = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/scan-cache.json', 'utf8')); } catch {}
  const blk = cache[0] && cache[0][1].blocks;
  if (MODEL) ok('bulles repérées avec leur couleur (jaune pour la 3e)', blk && blk.length >= 2 && blk.some(x => /rgb\(25\d,2[23]\d,1[34]\d\)/.test(x.bg)), blk && blk.map(x => x.bg));
  if (!MODEL) { console.log('appels', JSON.stringify(seen).slice(0, 200)); const tip = await b.evaluate(() => document.querySelector('#toast')?.textContent || ''); ok('texte illisible : modèle de lecture proposé', /modèle de lecture/i.test(tip), tip); }
  // 2e lecture : réponse immédiate (mémoire), sans nouvel appel au traducteur
  const before = seen.length;
  await b.evaluate(() => cur.wv.reload()); await wait(2500);
  await b.evaluate(() => pageCmd('scan')); await wait(3000);
  ok('image déjà traduite : affichée sans retraduire', seen.length === before, { before, after: seen.length });
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
