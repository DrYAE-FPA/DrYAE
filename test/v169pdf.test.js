// 1.6.9 : lecteur PDF de DrYAE (pdf.js) — ouverture, outils d'annotation et de signature
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v169'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => { if (q.url === '/doc.pdf') { r.setHeader('Content-Type', 'application/pdf'); return r.end(fs.readFileSync('/tmp/claude-0/test.pdf')); } r.end('ok'); }).listen(0);
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
