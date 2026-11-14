// 1.7.0 : double-clic sur un PDF (DrYAE visionneuse par défaut) quand DrYAE n'est pas encore ouvert :
// le fichier doit s'ouvrir dans un onglet (avant, il était perdu pendant le chargement de la fenêtre)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const OUT = '/tmp/claude-0/v170open'; fs.mkdirSync(OUT, { recursive: true });
  // petit PDF valide écrit à la main
  const pdf = path.join(OUT, 'mon document.pdf');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream = 'BT /F1 18 Tf 40 100 Td (Bonjour PDF) Tj ET'; objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let body = '%PDF-1.4\n', offs = []; objs.forEach((o, i) => { offs.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length; body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.writeFileSync(pdf, body);
  const HOME = '/tmp/claude-0/uihome-v170open'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--browse', pdf], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  let b, t = []; for (let i = 0; i < 40; i++) { b = app.windows().find(x => x.url().includes('browser.html')); if (b) { t = await b.evaluate(() => tabs.map(x => x.url)).catch(() => []); if (t.some(u => /\.pdf$/.test(u))) break; } await wait(250); }
  ok('PDF ouvert au lancement de DrYAE (double-clic dans l\'Explorateur)', t.length === 1 && /mon%20document\.pdf$/.test(t[0]), t);
  await wait(1500); await b.screenshot({ path: OUT + '/pdf.png' });
  await app.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
