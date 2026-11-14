// 1.7.0 : onglets de publicité ouverts par un clic n'importe où sur la page (ou un calque invisible) : bloqués ;
// un vrai lien vers un autre site et les onglets du même site restent permis
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let port;
  const srv = http.createServer((q, r) => {
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (q.url === '/page') return r.end(`<title>page</title><body style="margin:0;height:100vh">
      <p id="txt" style="padding:20px">Texte du chapitre</p>
      <a id="real" target="_blank" href="http://localhost:${port}/lien">Lien vers un autre site</a>
      <a id="same" target="_blank" href="http://127.0.0.1:${port}/meme">Même site</a>
      <button id="next" onclick="window.open('/suivant')">Page suivante (même site)</button>
      <a id="over" target="_blank" href="http://localhost:${port}/calque" style="position:fixed;left:0;top:300px;width:100vw;height:60vh"></a>
      <script>document.getElementById('txt').addEventListener('click', () => window.open('http://localhost:${port}/pub'));</script></body>`);
    r.end('<title>' + q.url + '</title>ok');
  }).listen(0); port = srv.address().port;
  const HOME = '/tmp/claude-0/uihome-v170ad'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await wait(2500);
  const b = app.windows().find(x => x.url().includes('browser.html'));
  await b.evaluate(u => navigate(cur, u), `http://127.0.0.1:${port}/page`); await wait(2000);
  const urls = () => b.evaluate(() => tabs.map(t => t.url.replace(/^.*\//, '/')));
  const clickIn = async sel => { const r = await b.evaluate(s => cur.wv.executeJavaScript(`(() => { const e = document.querySelector(${JSON.stringify(s)}).getBoundingClientRect(); return [e.left + 5, e.top + 5]; })()`), sel); const o = await b.evaluate(() => { const r = cur.wv.getBoundingClientRect(); return [r.left, r.top]; }); await b.mouse.click(o[0] + r[0], o[1] + r[1]); await wait(1200); };
  const page = await b.evaluate(() => cur);
  await clickIn('#txt'); let u = await urls();
  ok('clic sur le texte → onglet de pub vers un autre site : bloqué', !u.includes('/pub'), u);
  const toast = await b.evaluate(() => document.querySelector('#toast').textContent); ok('message « Onglet de publicité bloqué »', /Onglet de publicité bloqué/.test(toast), toast);
  await b.evaluate(() => select(tabs[0]));
  await clickIn('#over'); u = await urls(); ok('calque invisible qui couvre la page : bloqué', !u.includes('/calque'), u);
  await b.evaluate(() => select(tabs[0]));
  await clickIn('#real'); u = await urls(); ok('vrai lien vers un autre site : ouvert', u.includes('/lien'), u);
  await b.evaluate(() => select(tabs[0]));
  await wait(500); await clickIn('#same'); await wait(800); u = await urls(); console.log('toast', await b.evaluate(() => document.querySelector('#toast').textContent), await b.evaluate(() => cur.url)); ok('lien du même site : ouvert', u.includes('/meme'), u);
  await b.evaluate(() => select(tabs[0]));
  await clickIn('#next'); u = await urls(); ok('bouton qui ouvre une page du même site : ouvert', u.includes('/suivant'), u);
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
