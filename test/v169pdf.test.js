// 1.6.9 : lecteur PDF de DrYAE (pdf.js) — ouverture, outils d'annotation et de signature
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
// petit PDF d'une page fabriqué ici (pas de fichier externe)
function makePdf() {
  const st = 'BT /F1 24 Tf 72 760 Td (Document PDF de test DrYAE) Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${st.length} >>\nstream\n${st}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
(async () => {
  const PDF = makePdf();
  const srv = http.createServer((q, r) => { if (q.url === '/doc.pdf') { r.setHeader('Content-Type', 'application/pdf'); return r.end(PDF); } r.end('ok'); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v169pdf'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await wait(2500);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  await b.evaluate(u => navigate(cur, u), base + '/doc.pdf'); await wait(5000);
  const u = await b.evaluate(() => cur.url);
  ok('PDF ouvert dans le lecteur de DrYAE', /^dryae:\/\/pdf\/web\/viewer\.html/.test(u), u);
  const pv = app.windows().find(x => x.url().startsWith('dryae://pdf/'));
  if (pv) {
    pv.on('console', m => { if (/error/i.test(m.type())) console.log('[pdf]', m.text().slice(0, 200)); });
    const st = await pv.evaluate(() => ({ pages: window.PDFViewerApplication?.pagesCount, text: document.querySelector('.textLayer')?.textContent || '', hl: !!document.querySelector('#editorHighlightButton'), ink: !!document.querySelector('#editorInkButton'), sig: !document.querySelector('#editorSignature')?.hidden, bridge: typeof window.dryae }));
    ok('page affichée avec son texte', st.pages === 1 && /Document PDF de test/.test(st.text), st);
    ok('outils : surligner, dessiner, signature', st.hl && st.ink && st.sig, st);
    ok('le lecteur n\'a pas accès au pont des pages internes', st.bridge === 'undefined', st.bridge);
    await pv.screenshot({ path: OUT + '/pdf.png' });
  }
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
