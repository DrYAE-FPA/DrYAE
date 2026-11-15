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
  fs.copyFileSync(path.join(__dirname, 'fixtures', 'bulle.png'), `${D}/page0.png`);
  let z = require('7zip-bin').path7za; try { fs.chmodSync(z, 0o755); } catch {}
  execFileSync(z, ['a', '-tzip', HOME + '/Mon album.cbz', D + '/*']);
  const srv = require('http').createServer((q, r) => { let bd = ''; q.on('data', d => (bd += d)); q.on('end', () => { let qs = []; try { qs = [].concat(JSON.parse(bd).q); } catch {} r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: qs.map(t => 'FR:' + t), detectedLanguage: [{ language: 'en' }] })); }); }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const S = JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/settings.json', 'utf8')); S.browser = { translate: { provider: 'libre', libreUrl: `http://127.0.0.1:${srv.address().port}`, target: 'fr' } }; fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify(S));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', HOME + '/Mon album.cbz'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  let pg; for (let i = 0; i < 80 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith('dryae://bd/')); await wait(250); }
  ok('fichier .cbz ouvert avec DrYAE : lecteur de BD', !!pg, app.windows().map(w => w.url()));
  if (!pg) { await app.close(); return; }
  await wait(2500);
  const st = await pg.evaluate(() => ({ title: document.querySelector('#title').textContent, n: document.querySelectorAll('#pages img').length, num: document.querySelector('#num').textContent, first: document.querySelector('#pages img').alt, loaded: [...document.querySelectorAll('#pages img')].slice(0, 2).every(i => i.naturalWidth > 0) }));
  ok('13 pages, dans l\'ordre naturel, images affichées', st.n === 13 && st.first === 'page0.png' && st.loaded && st.title === 'Mon album', st);
  await pg.evaluate(() => { const m = document.querySelector('#mode'); m.value = 'page'; m.onchange(); });
  const key = k => pg.evaluate(k => dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), k);
  await key('ArrowRight'); await key('ArrowRight'); await wait(300);
  const p2 = await pg.evaluate(() => ({ num: document.querySelector('#num').textContent, vis: [...document.querySelectorAll('#pages img')].filter(i => getComputedStyle(i).display !== 'none' && !i.classList.contains('ahead')).map(i => i.alt), ahead: [...document.querySelectorAll('#pages img.ahead')].map(i => i.alt) }));
  ok('page par page : → avance, pages suivantes préparées à l\'avance', p2.num === '3 / 13' && p2.vis.length === 1 && p2.vis[0] === 'page2.png' && p2.ahead.length === 3, p2);
  await pg.evaluate(() => { const d = document.querySelector('#dir'); d.value = 'rtl'; d.onchange(); });
  await key('ArrowLeft'); await wait(200);
  ok('sens manga (droite → gauche) : ← avance', await pg.evaluate(() => document.querySelector('#num').textContent) === '4 / 13');
  // une page web ne peut pas lire un fichier non ouvert par l'utilisateur
  const deny = await pg.evaluate(async () => (await fetch('_img?id=00112233445566778899&i=0')).status);
  ok('numéro inconnu refusé', deny >= 400, deny);
  // page « normale » pour le traducteur de scans (pas de pont vers DrYAE)
  ok('lecteur sans accès au reste de DrYAE', await pg.evaluate(() => typeof window.dryae === 'undefined'));
  // traduction des bulles puis enregistrement du chapitre traduit (.cbz)
  const b = app.windows().find(x => x.url().includes('browser.html'));
  await pg.evaluate(() => { const m = document.querySelector('#mode'); m.value = 'scroll'; m.onchange(); scrollTo(0, 0); });
  await b.evaluate(() => pageCmd('scan'));
  const cache = () => { try { return JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/scan-cache.json', 'utf8')); } catch { return []; } };
  for (let i = 0; i < 160 && !cache().some(c => c[1].blocks.length); i++) await wait(500);
  const blocks = cache().flatMap(c => c[1].blocks);
  ok('bulle de la page lue et traduite dans le lecteur', blocks.some(x => /WHERE/i.test(x.text) && /^FR:/.test(x.tr)), blocks.map(x => [x.text, x.tr]));
  const outFile = HOME + '/export.cbz';
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, outFile);
  await b.evaluate(() => pageCmd('scan-export', { fmt: 'cbz' }));
  for (let i = 0; i < 40 && !fs.existsSync(outFile); i++) await wait(500); await wait(800);
  let list = ''; try { list = execFileSync(z, ['l', outFile]).toString(); } catch {}
  ok('chapitre traduit enregistré en .cbz (toutes les pages)', (list.match(/\.jpg/g) || []).length === 13, list.split('\n').slice(-3).join(' '));
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); }, HOME + '/export.pdf');
  await b.evaluate(() => pageCmd('scan-export', { fmt: 'pdf' }));
  for (let i = 0; i < 40 && !fs.existsSync(HOME + '/export.pdf'); i++) await wait(500); await wait(800);
  ok('chapitre traduit enregistré en PDF', fs.existsSync(HOME + '/export.pdf') && fs.readFileSync(HOME + '/export.pdf').slice(0, 4).toString() === '%PDF');
  await app.close().catch(() => {}); srv.close();
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
