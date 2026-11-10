// 1.6.6 : traducteur de scans sur une page « lecteur » (images blob:, pages cachées, conteneur qui défile)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v166'; fs.mkdirSync(OUT, { recursive: true });
const IMG = process.env.IMG || '/home/claude/ocrtest/md1.png';
const PAGE = `<!doctype html><html><head><title>Reader</title><style>body{margin:0;background:#191a1c}.wrap{height:100vh;overflow:auto;display:flex;justify-content:center}.img{max-height:100vh;max-width:100%}</style></head><body><div class="wrap"><div class="md--page"><img class="img a"><img class="img b" style="display:none"></div></div>
<script>(async()=>{ const b = await (await fetch('/page.png')).blob(); for (const i of document.querySelectorAll('img')) i.src = URL.createObjectURL(b); })();</script></body></html>`;
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/page.png') { r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync(IMG)); }
    if (q.url === '/translate') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); const tr = s => j.target.toUpperCase() + ': ' + s.toLowerCase(); console.log('[tr]', j.source, j.target, JSON.stringify(j.q).slice(0, 300)); r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: Array.isArray(j.q) ? j.q.map(tr) : tr(j.q), detectedLanguage: [{ language: /KHONG|TOI|NOI|kh[oô]ng/i.test(JSON.stringify(j.q)) ? 'vi' : 'pt' }] })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); if (process.env.TT) r.setHeader('Content-Security-Policy', "object-src 'none'; base-uri 'none'; require-trusted-types-for 'script';"); r.end(PAGE);
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v166scan'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  app.process().stderr.on('data', d => { const s = String(d); if (/scan|ocr|Error/i.test(s)) process.stdout.write('[main] ' + s); });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  pg.on('console', m => console.log('[page]', m.text().slice(0, 200)));
  await pg.waitForTimeout(2000);
  const t0 = Date.now();
  await b.evaluate(() => pageCmd('scan'));
  await pg.waitForTimeout(+process.env.WAIT || 15000);
  await pg.screenshot({ path: OUT + '/reader-scan.png' });
  console.log('fini en', Date.now() - t0);
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
