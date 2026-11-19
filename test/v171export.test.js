// 1.7.1 : enregistrer en PDF / .cbz depuis un lecteur en ligne « page par page » : toutes les pages du chapitre
// (avant : seule l'image affichée était enregistrée)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
function png(w, h, rgb) {
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const N = 8, seenRef = [];
  const srv = require('http').createServer((q, r) => {
    const m = /^\/up\/ch1-(\d+)\.png$/.exec(q.url);
    if (m) { seenRef.push(q.headers.referer || ''); r.setHeader('content-type', 'image/png'); return r.end(png(300, 420, [+m[1] * 25, 90, 160])); }
    if (q.url === '/logo/banniere.png') { r.setHeader('content-type', 'image/png'); return r.end(png(600, 300, [10, 10, 10])); }
    const P = 'http://site.test:' + srv.address().port, L = Array.from({ length: N }, (_, i) => `${P}/up/ch1-${i + 1}.png`);
    const L2 = L.map(u => u.replace('site.test', 'autre.test'));
    r.setHeader('content-type', 'text/html; charset=utf-8');
    r.end(`<!doctype html><title>Chapitre 1</title><body><img src="/logo/banniere.png"><div id="lecteur"><img src="${L[0]}"></div>
<script>lecteur.run(${JSON.stringify({ mode: 'single', sources: [{ source: 'S1', images: L }, { source: 'S2', images: L2 }] }).replace(/\//g, '\\/')});</script></body>`);
  }).listen(0); await new Promise(r => srv.once('listening', r)); const port = srv.address().port;
  const HOME = '/tmp/claude-0/uihome-v171ex'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--host-resolver-rules=MAP site.test 127.0.0.1, MAP autre.test 127.0.0.1'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(p => window.dryae.call('openBrowser', 'http://site.test:' + p + '/chapitre'), port);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(3000);
  let z = require('7zip-bin').path7za; try { fs.chmodSync(z, 0o755); } catch {}
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, HOME + '/orig.cbz');
  await b.evaluate(() => pageCmd('scan-export', { fmt: 'cbz', original: true }));
  for (let i = 0; i < 60 && !fs.existsSync(HOME + '/orig.cbz'); i++) await wait(500); await wait(800);
  let lo = ''; try { lo = execFileSync(z, ['l', HOME + '/orig.cbz']).toString(); } catch {}
  ok('toutes les pages du chapitre enregistrées (.cbz), sans la bannière du site', (lo.match(/\.jpg/g) || []).length === N, lo.split('\n').slice(-3).join(' '));
  ok('pages demandées comme le ferait le lecteur (page d\'origine indiquée)', seenRef.length >= N - 1 && seenRef.every(x => x.includes('/chapitre')), seenRef.slice(0, 2));
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, HOME + '/orig.pdf');
  await b.evaluate(() => pageCmd('scan-export', { fmt: 'pdf', original: true }));
  for (let i = 0; i < 60 && !fs.existsSync(HOME + '/orig.pdf'); i++) await wait(500); await wait(800);
  { const t = fs.existsSync(HOME + '/orig.pdf') ? fs.readFileSync(HOME + '/orig.pdf').toString('latin1') : ''; ok('PDF : une page par page du chapitre', new RegExp('/Count ' + N + '\\b').test(t), (t.match(/\/Count \d+/) || [])[0]); }
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
