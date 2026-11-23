// 1.7.1 : images ouvertes avec DrYAE depuis l'ordinateur : visionneuse des BD (images du dossier, image cliquée d'abord) ;
// réglages « Application torrent par défaut » et « Ouvrir les images et les BD avec DrYAE » ; lien magnet venu d'un autre programme
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
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
  const HOME = '/tmp/claude-0/uihome-v171img'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  const D = HOME + '/Photos vacances'; fs.mkdirSync(D + '/autre', { recursive: true });
  for (const [n, c] of [['photo 1.png', [200, 40, 40]], ['photo 2.png', [40, 200, 40]], ['photo 10.png', [40, 40, 200]], ['autre/cachee.png', [9, 9, 9]]]) fs.writeFileSync(D + '/' + n, png(300, 200, c));
  fs.writeFileSync(D + '/notes.txt', 'pas une image');
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  // double-clic sur « photo 2.png » dans l'Explorateur : Windows lance DrYAE avec le fichier
  await app.evaluate(({ app }, f) => app.emit('second-instance', {}, ['DrYAE.exe', f]), D + '/photo 2.png'); await wait(3500);
  const b = app.windows().find(x => x.url().includes('browser.html'));
  const tab = b && await b.evaluate(() => { const t = tabs.find(t => /dryae:\/\/bd\//.test(t.url)); return t ? t.wv.getWebContentsId() : 0; });
  ok('image ouverte dans la visionneuse de DrYAE', !!tab, tab);
  const pv = await app.evaluate(async ({ webContents }, id) => { const g = webContents.fromId(id); await new Promise(r => setTimeout(r, 1500)); return g.executeJavaScript(`({ n: document.querySelectorAll('#pages img').length, num: document.querySelector('#num').textContent, mode: document.querySelector('#mode').value, fit: document.querySelector('#fit').value, names: [...document.querySelectorAll('#pages img')].map(i => i.alt) })`); }, tab);
  ok('les images du dossier (pas les sous-dossiers ni les autres fichiers), dans l\'ordre', pv.n === 3 && pv.names.join('|') === 'photo 1.png|photo 2.png|photo 10.png', pv.names);
  ok('commence par l\'image ouverte', /^2 \/ 3/.test(pv.num), pv.num);
  ok('une image à la fois, à la hauteur de l\'écran', pv.mode === 'page' && pv.fit === 'height', pv);
  // lumières tamisées : disponibles dans la visionneuse (comme pour les BD)
  const lights = await b.evaluate(() => typeof pageCmd === 'function');
  ok('les outils de la page (lumières tamisées…) sont disponibles', lights);
  // réglages : deux nouvelles options
  await w.evaluate(() => window.dryae.call('openBrowser', 'dryae://settings')); await wait(3000);
  const sid = await b.evaluate(() => { const t = tabs.find(t => /dryae:\/\/settings/.test(t.url)); return t ? t.wv.getWebContentsId() : 0; });
  const rows = await app.evaluate(async ({ webContents }, id) => webContents.fromId(id).executeJavaScript(`[!!document.querySelector('#defTor'), !!document.querySelector('#defImg'), document.querySelector('#defFTxt')?.textContent]`), sid);
  ok('Paramètres : « Application torrent par défaut » et « Ouvrir les images et les BD avec DrYAE »', rows[0] && rows[1], rows);
  // lien magnet cliqué dans un autre navigateur : DrYAE s'affiche avec sa fenêtre d'ajout
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
  await app.evaluate(({ app }) => app.emit('second-instance', {}, ['DrYAE.exe', 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Essai']));
  await wait(2500);
  const st = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible());
  const dlg = await w.evaluate(() => getComputedStyle(document.querySelector('#tModal')).display !== 'none' || document.querySelector('#tModal').classList.contains('show'));
  ok('lien magnet venu d\'un autre programme : DrYAE s\'affiche avec la fenêtre d\'ajout', st && dlg, { st, dlg });
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
