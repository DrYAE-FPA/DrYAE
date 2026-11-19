// 1.7.1 : corrections du document de tests — codes <0xC3><0x87> à la place de « Ç », PDF sans page blanche
const { _electron } = require('playwright'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
(async () => {
  const { bytesFix } = require('../src/main/local-mt'); const M = require('../src/main/modules');
  ok('« <0xC3><0x87>a suffit » → « Ça suffit »', bytesFix('<0xC3><0x87>a suffit, Marie ?') === 'Ça suffit, Marie ?');
  ok('en majuscules aussi (bulle déjà mise en capitales)', M.unprotect('<0XC3><0X87>A NE VA PAS', []) === 'ÇA NE VA PAS');
  ok('texte normal inchangé', bytesFix('Où vas-tu ?') === 'Où vas-tu ?' && M.unprotect('[1] arrive', ['Paul']) === 'Paul arrive');
  // PDF : une page par image, à la taille de l'image
  const HOME = '/tmp/claude-0/uihome-v171b'; fs.mkdirSync(HOME, { recursive: true });
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const jpgs = await app.evaluate(({ nativeImage }) => [[800, 1150], [800, 1200], [1600, 1150]].map(([w, h]) => { const b = Buffer.alloc(w * h * 4, 200); return [...nativeImage.createFromBitmap(b, { width: w, height: h }).toJPEG(80)]; }));
  await app.close().catch(() => {});
  const { imagesToPdf, jpegSize } = require('../src/main/pdf-images');
  const bufs = jpgs.map(a => Buffer.from(a));
  ok('taille des images lue', JSON.stringify(bufs.map(jpegSize).map(s => [s.w, s.h])) === '[[800,1150],[800,1200],[1600,1150]]');
  const r = imagesToPdf(bufs); fs.writeFileSync('/tmp/claude-0/v171b.pdf', r.pdf);
  const txt = r.pdf.toString('latin1');
  ok('3 images → 3 pages (aucune page blanche)', r.pages === 3 && /\/Count 3/.test(txt));
  ok('chaque page a la taille de son image', /MediaBox \[0 0 600 862\.5\]/.test(txt) && /MediaBox \[0 0 1200 862\.5\]/.test(txt));
  ok('fichier PDF complet', txt.startsWith('%PDF-1.4') && /%%EOF\n$/.test(txt));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
