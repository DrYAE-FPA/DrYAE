// 1.6.6 : image affichée par une adresse « blob: » retirée aussitôt  → le traducteur de scans la lit quand même
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v166'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/p.png') { r.setHeader('Content-Type', 'image/png'); return r.end(fs.readFileSync('/home/claude/ocrtest/en.png')); }
    if (q.url === '/translate') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { const j = JSON.parse(b); r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: [].concat(j.q).map(s => '[FR] ' + s), detectedLanguage: [{ language: 'en' }] })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    r.end(`<!doctype html><title>R</title><body style="margin:0;background:#222"><img id="m" style="width:700px;display:block;margin:auto"><script>fetch('/p.png').then(x=>x.blob()).then(b=>{const u=URL.createObjectURL(b);const i=document.getElementById('m');i.onload=()=>URL.revokeObjectURL(u);i.src=u;});</script></body>`);
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v166b'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.scrollTo(0, 600)); await pg.waitForTimeout(300);
  await b.evaluate(() => pageCmd('scan')); await pg.waitForTimeout(12000);
  await pg.screenshot({ path: OUT + '/blob-scan.png' });
  console.log('fini');
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
