// 1.7.1 (version perso) : « Traduire la page » traduit aussi un très long paragraphe d'un seul bloc (romans en ligne)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 200) : '');
const LONG = Array.from({ length: 90 }, (_, k) => `Sentence number ${k} of a very long chapter, written without any break at all.`).join(' ');
const PAGE = `<!doctype html><html><head><title>Novel</title></head><body><p id="s">A short line.</p><p id="l">${LONG}</p><p id="e">The end.</p></body></html>`;
(async () => {
  let calls = 0, maxLen = 0;
  const srv = http.createServer((q, r) => {
    if (q.url === '/translate' && q.method === 'POST') { let b = ''; q.on('data', d => (b += d)); return q.on('end', () => { calls++; const j = JSON.parse(b); [].concat(j.q).forEach(s => { maxLen = Math.max(maxLen, s.length); }); const tr = s => '[FR] ' + s; r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify({ translatedText: Array.isArray(j.q) ? j.q.map(tr) : tr(j.q), detectedLanguage: [{ language: 'en' }] })); }); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(PAGE);
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v171long'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { translate: { provider: 'libre', libreUrl: base, selection: 'button' } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/novel');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  await new Promise(r => setTimeout(r, 2500));
  await b.evaluate(() => pageCmd('translate-page')); await new Promise(r => setTimeout(r, 2500));
  const t = await b.evaluate(() => cur.wv.executeJavaScript("[document.getElementById('s').textContent, document.getElementById('l').textContent, document.getElementById('e').textContent]"));
  ok('paragraphe court traduit', t[0].startsWith('[FR]'), t[0]);
  ok('long paragraphe (' + LONG.length + ' caractères) traduit en entier, en morceaux', t[1].startsWith('[FR]') && (t[1].match(/\[FR\]/g) || []).length >= 3 && t[1].includes('Sentence number 89'), t[1].length);
  ok('morceaux envoyés de taille raisonnable', maxLen <= 2600, maxLen);
  ok('la suite de la page est traduite aussi', t[2].startsWith('[FR]'), t[2]);
  await Promise.race([app.close(), new Promise(r => setTimeout(r, 5000))]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
