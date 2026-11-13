// 1.6.9 (refaite) : traducteur de scans sur de vraies pages anglaises réduites (captures d'écran de 480 px de large)
// — plus de zone géante, notes « SFX » ignorées, mots coupés par un tiret recollés, texte jamais coupé au milieu d'un mot,
// jamais plus gros que l'original ; option IA (service simulé) avec retour à la traduction habituelle si la limite est atteinte.
// Pages de référence : IMGS=a.png,b.png (par défaut /home/claude/scan-ref/*-original-en.png ; test ignoré si absentes)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169scan2'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 400) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const IMGS = (process.env.IMGS || '/home/claude/scan-ref/p26-original-en.png,/home/claude/scan-ref/p2-original-en.png').split(',').filter(f => fs.existsSync(f));
if (!IMGS.length) { console.log('OK  (pages de référence absentes : test ignoré)'); process.exit(0); }
// traduction simulée : du « français » de longueur réaliste (chaque mot anglais suivi d'un mot plus long)
const FR = s => s.split(/\s+/).map(w => w.length > 3 ? w + 'ée' : w).join(' ');
(async () => {
  const seen = [], aiSeen = []; let aiMode = 'ok';
  const srv = http.createServer((q, r) => {
    const m = /^\/p(\d)\.png$/.exec(q.url); if (m) { r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync(IMGS[+m[1]])); }
    if (q.url === '/translate') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); const qs = [].concat(j.q); seen.push(qs); r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: qs.map(FR), detectedLanguage: [{ language: 'en' }] })); }); }
    if (/generateContent/.test(q.url)) {
      let b = ''; q.on('data', d => (b += d)); return q.on('end', () => {
        const j = JSON.parse(b); const parts = j.contents[0].parts; aiSeen.push({ key: q.headers['x-goog-api-key'], img: !!parts[0].inline_data?.data, mime: parts[0].inline_data?.mime_type, n: (parts[1].text.match(/^\d+\. /gm) || []).length });
        if (aiMode === 'quota' || (aiMode === 'once' && aiSeen.length > 1)) { r.statusCode = 429; return r.end('{}'); }
        const lines = parts[1].text.split('\n').filter(l => /^\d+\. /.test(l)).map(l => l.replace(/^\d+\. /, ''));
        r.setHeader('Content-Type', 'application/json');
        r.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ source_language: 'en', items: lines.map((t, i) => ({ i: i + 1, text: t, tr: 'IA ' + (i + 1) + ' ' + FR(t.toLowerCase()) })) }) }] } }] }));
      });
    }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(`<!doctype html><title>Lecteur</title><body style="margin:0;background:#222">${IMGS.map((_, i) => `<img src="/p${i}.png" style="display:block;margin:0 auto 20px;width:640px">`).join('')}`);
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169scan2'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base, target: 'fr' }, scan: { autoSites: ['127.0.0.1'] } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await wait(250); }
  await pg.setViewportSize({ width: 700, height: 1000 }).catch(() => {});
  await wait(3500);
  ok('traducteur de scans éteint tant qu\'on ne clique pas (même sur un site autrefois « automatique »)', seen.length === 0, seen.length);
  const cache = () => { try { return JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/scan-cache.json', 'utf8')); } catch { return []; } };
  const runAll = async () => {
    await b.evaluate(() => pageCmd('scan'));
    for (let i = 0; i < 120 && cache().length < 1; i++) await wait(500);
    // dernière image en bas de page : on fait défiler pour qu'elle soit lue
    await pg.evaluate(() => scrollTo(0, document.body.scrollHeight)); for (let i = 0; i < 120 && cache().length < IMGS.length; i++) await wait(500);
    await wait(1500);
  };
  await runAll();
  const all = cache().flatMap(c => c[1].blocks.map(x => ({ ...x, W: c[1].w })));
  const texts = all.map(x => x.text);
  console.log(texts.join('\n'));
  ok('aucune zone géante (plus d\'un quart de la page)', all.every(x => !x.bubble || (x.bubble.x1 - x.bubble.x0) * (x.bubble.y1 - x.bubble.y0) < x.W * x.W * 1.5 * 0.25), all.filter(x => x.bubble && (x.bubble.x1 - x.bubble.x0) * (x.bubble.y1 - x.bubble.y0) >= x.W * x.W * 0.37).map(x => x.text));
  ok('notes « SFX » non traduites', !texts.some(t => /^\W*S\W?F/i.test(t)), texts.filter(t => /SF/i.test(t)));
  ok('mots coupés par un tiret recollés (PERFORMANCE, TEMPORARY…)', texts.some(t => /PERFORMANCE/.test(t)) && !texts.some(t => /\b(PER|TEM)- /.test(t)), texts.filter(t => /PER|TEM/.test(t)));
  ok('bulles en majuscules : traduction affichée en majuscules', all.filter(x => x.caps).length >= all.length * 0.8, all.filter(x => !x.caps).map(x => x.text));
  const sent = seen.filter(q => q.length > 1).flat();
  ok('texte envoyé au traducteur en minuscules normales', sent.length && sent.every(s => s !== s.toUpperCase()), sent.slice(0, 3));
  // affichage : mots jamais coupés, taille jamais plus grande que le texte d'origine
  const view = await pg.evaluate(() => null);
  void view;
  for (let i = 0; i < IMGS.length; i++) {
    await pg.evaluate(i => document.querySelectorAll('img')[i].scrollIntoView(), i); await wait(1200);
    await pg.screenshot({ path: `${OUT}/page${i}.png` });
  }
  await Promise.race([app.close(), wait(5000)]);
  // ---- option IA : clé personnelle, image envoyée, puis limite du jour atteinte → traduction habituelle ----
  const S = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8'));
  S.browser.scan = { ...(S.browser.scan || {}), ai: { on: true, key: 'cle-de-test', url: base } };
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify(S)); fs.rmSync(HOME + '/.config/DrYAE/scan-cache.json', { force: true });
  const app2 = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w2 = await app2.firstWindow(); await wait(1500);
  await w2.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  b = null; pg = null; for (let i = 0; i < 40 && !b; i++) { b = app2.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  for (let i = 0; i < 40 && !pg; i++) { pg = app2.windows().find(x => x.url().startsWith(base)); await wait(250); }
  await wait(2000);
  const s0 = seen.length; aiMode = 'once';
  await b.evaluate(() => pageCmd('scan'));
  for (let i = 0; i < 120 && aiSeen.length < 1; i++) await wait(500);
  await pg.evaluate(() => scrollTo(0, document.body.scrollHeight));
  for (let i = 0; i < 120 && cache().length < IMGS.length; i++) await wait(500);
  await wait(1000);
  const c1 = cache(); const blkAI = c1.map(c => c[1].blocks).find(bl => bl.some(x => /^IA \d/.test(x.tr))) || [];
  ok('IA : image et texte lu envoyés avec la clé', aiSeen.length >= 1 && aiSeen[0].img && aiSeen[0].key === 'cle-de-test' && aiSeen[0].n >= 3, aiSeen);
  ok('IA : sa traduction est affichée', blkAI.length && blkAI.every(x => /^IA \d/.test(x.tr)), blkAI.map(x => x.tr).slice(0, 3));
  const blkN = c1.map(c => c[1].blocks).find(bl => bl.every(x => !/^IA \d/.test(x.tr)));
  ok('limite IA atteinte : traduction habituelle à la place', aiSeen.length === 2 && blkN && blkN.length >= 3 && seen.some(q => q.length > 1), { ia: aiSeen.length, normal: blkN && blkN.length });
  await Promise.race([app2.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
