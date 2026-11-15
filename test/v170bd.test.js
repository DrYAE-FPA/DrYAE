// 1.7.0 refaite : lecteur de BD et de mangas (.cbz, .cb7, dossier d'images), ouvert avec DrYAE
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
// petite image PNG d'une couleur unie (sans bibliothèque)
function png(w, h, rgb) {
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const HOME = '/tmp/claude-0/uihome-v170bd'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'browser' }));
  const D = HOME + '/album'; fs.mkdirSync(D);
  // pages 1 à 12 (ordre naturel : page2 avant page10)
  for (let i = 1; i <= 12; i++) fs.writeFileSync(`${D}/page${i}.png`, png(300, 420, [i * 20, 80, 200 - i * 10]));
  let z = require('7zip-bin').path7za; try { fs.chmodSync(z, 0o755); } catch {}
  execFileSync(z, ['a', '-tzip', HOME + '/Mon album.cbz', D + '/*']);
  const app = await _electron.launch({ args: ['.', '--no-sandbox', HOME + '/Mon album.cbz'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  let pg; for (let i = 0; i < 80 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith('dryae://bd/')); await wait(250); }
  ok('fichier .cbz ouvert avec DrYAE : lecteur de BD', !!pg, app.windows().map(w => w.url()));
  if (!pg) { await app.close(); return; }
  await wait(2500);
  const st = await pg.evaluate(() => ({ title: document.querySelector('#title').textContent, n: document.querySelectorAll('#pages img').length, num: document.querySelector('#num').textContent, first: document.querySelector('#pages img').alt, loaded: [...document.querySelectorAll('#pages img')].slice(0, 2).every(i => i.naturalWidth === 300) }));
  ok('12 pages, dans l\'ordre naturel, images affichées', st.n === 12 && st.first === 'page1.png' && st.loaded && st.title === 'Mon album', st);
  await pg.evaluate(() => { const m = document.querySelector('#mode'); m.value = 'page'; m.onchange(); });
  const key = k => pg.evaluate(k => dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), k);
  await key('ArrowRight'); await key('ArrowRight'); await wait(300);
  const p2 = await pg.evaluate(() => ({ num: document.querySelector('#num').textContent, vis: [...document.querySelectorAll('#pages img')].filter(i => getComputedStyle(i).display !== 'none' && !i.classList.contains('ahead')).map(i => i.alt), ahead: [...document.querySelectorAll('#pages img.ahead')].map(i => i.alt) }));
  ok('page par page : → avance, pages suivantes préparées à l\'avance', p2.num === '3 / 12' && p2.vis.length === 1 && p2.vis[0] === 'page3.png' && p2.ahead.length === 3, p2);
  await pg.evaluate(() => { const d = document.querySelector('#dir'); d.value = 'rtl'; d.onchange(); });
  await key('ArrowLeft'); await wait(200);
  ok('sens manga (droite → gauche) : ← avance', await pg.evaluate(() => document.querySelector('#num').textContent) === '4 / 12');
  // une page web ne peut pas lire un fichier non ouvert par l'utilisateur
  const deny = await pg.evaluate(async () => (await fetch('_img?id=00112233445566778899&i=0')).status);
  ok('numéro inconnu refusé', deny >= 400, deny);
  // page « normale » pour le traducteur de scans (pas de pont vers DrYAE)
  ok('lecteur sans accès au reste de DrYAE', await pg.evaluate(() => typeof window.dryae === 'undefined'));
  await app.close().catch(() => {});
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
