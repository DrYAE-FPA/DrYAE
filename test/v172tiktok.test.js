// 1.7.2 : publication « photos » (diaporama images + son) : chaque image téléchargeable seule, le son à part au choix
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
(async () => {
  let port = 0;
  const srv = http.createServer((q, r) => {
    if (/\/photo\/\d+/.test(q.url)) {
      const im = n => ({ imageURL: { urlList: [`http://127.0.0.1:${port}/img${n}~tplv-photomode-image.webp`, `http://127.0.0.1:${port}/img${n}~tplv-photomode-image.jpeg?a=1`] }, imageWidth: 1080, imageHeight: 1440 });
      const data = { __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { id: '123', desc: 'Mon diaporama', author: { uniqueId: 'testeur' }, music: { playUrl: `http://127.0.0.1:${port}/son.mp3`, title: 'Son' }, imagePost: { images: [im(1), im(2), im(3)] } } } } } };
      r.writeHead(200, { 'content-type': 'text/html' });
      return r.end(`<!doctype html><html><head><title>Mon diaporama | TikTok</title></head><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script></body></html>`);
    }
    if (/\/img\d/.test(q.url)) { r.writeHead(200, { 'content-type': 'image/png', 'content-length': PNG.length }); return r.end(PNG); }
    if (/son\.mp3/.test(q.url)) { const b = Buffer.alloc(2048, 1); r.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': b.length }); return r.end(b); }
    r.writeHead(404); r.end();
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res)); port = srv.address().port;
  const HOME = '/tmp/claude-0/uihome-v172tiktok'; fs.rmSync(HOME, { recursive: true, force: true });
  const UD = HOME + '/.config/DrYAE'; fs.mkdirSync(UD, { recursive: true });
  const DL = HOME + '/dl'; fs.mkdirSync(DL, { recursive: true });
  fs.writeFileSync(UD + '/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, dir: DL, autoCategory: false }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config', DRYAE_TIKTOK_TEST: '127.0.0.1:' + port } });
  await app.firstWindow(); await wait(4000);
  const UI = async (fn, arg) => app.evaluate(async ({ BrowserWindow }, [src, a]) => {
    const w = BrowserWindow.getAllWindows().find(x => /ui\/index\.html/.test(x.webContents.getURL())) || BrowserWindow.getAllWindows()[0]; const wc = w.webContents;
    return wc.executeJavaScript('(' + src + ')(' + JSON.stringify(a) + ')');
  }, [fn.toString(), arg]);
  const url = `http://127.0.0.1:${port}/@testeur/photo/123?is_from_webapp=1`;
  await UI(async u => { await showAdd({ url: u, kind: 'ytdl' }); }, url);
  let st = null;
  for (let i = 0; i < 40; i++) { await wait(500); st = await UI(() => ({ title: document.getElementById('aYtTitle').textContent, meta: document.getElementById('aYtMeta').textContent, n: document.querySelectorAll('#aPhGrid [data-ph]').length, fmt: getComputedStyle(document.getElementById('aYtFmt')).display, music: getComputedStyle(document.getElementById('aPhMusicBox')).display, src: document.querySelector('#aPhGrid img')?.src || '' })); if (st.n) break; }
  ok('les 3 images de la publication sont listées, avec leur aperçu', st.n === 3 && /jpeg/.test(st.src), st);
  ok('titre et auteur affichés ; choix Vidéo/MP3 cachés ; case « son à part » proposée', st.title === 'Mon diaporama' && /@testeur/.test(st.meta) && st.fmt === 'none' && st.music !== 'none', st);
  // on décoche l'image 2, on coche le son
  await UI(() => { document.querySelector('#aPhGrid [data-ph="1"]').click(); document.getElementById('aPhMusic').click(); });
  const n2 = await UI(() => document.getElementById('aPhN').textContent);
  ok('compteur mis à jour', /2 \/ 3/.test(n2), n2);
  await UI(() => submitAdd(true));
  let files = [];
  for (let i = 0; i < 30; i++) { await wait(500); files = fs.readdirSync(DL, { recursive: true }).filter(f => /\.(jpg|mp3)$/.test(f)).map(f => path.basename(f)).sort(); if (files.length >= 3) break; }
  ok('images 1 et 3 + le son téléchargés, chacun à part, avec un nom clair', JSON.stringify(files) === JSON.stringify(['Mon diaporama - image 1.jpg', 'Mon diaporama - image 3.jpg', 'Mon diaporama - son.mp3']), files);
  { const f = fs.readdirSync(DL, { recursive: true }).find(x => x.endsWith('Mon diaporama - image 1.jpg')); ok('image enregistrée telle quelle (rangée dans Images)', !!f && /Images/.test(f) && fs.readFileSync(path.join(DL, f)).equals(PNG), f); }
  await app.close(); srv.close();
  process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
