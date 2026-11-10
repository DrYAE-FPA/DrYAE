// 1.6.4 : fenêtre de connexion reliée au site, téléchargement ordinaire (sans DrYAE), barre de favoris
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v164'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/file.zip') { r.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="archive-test.zip"', 'Content-Length': 300000 }); return r.end(Buffer.alloc(300000, 7)); }
    if (q.url === '/popup') { r.setHeader('Content-Type', 'text/html'); return r.end('<title>Connexion</title><script>window.opener && window.opener.postMessage("connecte", "*")</script>Connecté'); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8');
    r.end(`<title>Site</title><body><a id="dl" href="/file.zip">Télécharger</a><button id="b" onclick="window.open('/popup','login','width=480,height=600')">Se connecter</button><script>addEventListener('message',e=>document.title='reçu:'+e.data)</script></body>`);
  }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = '/tmp/claude-0/uihome-v164d'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  const DL = HOME + '/dl'; fs.mkdirSync(DL);
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { showBookmarksBar: true, nativeDl: { dir: DL }, modules: { capture: { enabled: false } } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  b.on('pageerror', e => console.log('[brerr]', e.message));
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  await pg.waitForTimeout(800);
  // fenêtre de connexion
  await pg.click('#b'); await pg.waitForTimeout(1500);
  console.log('fenêtre de connexion ouverte :', app.windows().some(x => x.url().endsWith('/popup')), '· message reçu par le site :', await pg.title());
  // téléchargement ordinaire
  await pg.click('#dl'); await pg.waitForTimeout(2000);
  console.log('fichier enregistré par le navigateur :', fs.readdirSync(DL), '· panneau :', await b.evaluate(() => panel), await b.evaluate(() => document.querySelector('#pBody').innerText.slice(0, 80).replace(/\n/g, ' | ')));
  await b.screenshot({ path: OUT + '/native-dl.png' });
  // barre de favoris : Ctrl+D ajoute, la barre affiche le favori
  await b.evaluate(() => starClick()); await b.waitForTimeout(600);
  await b.screenshot({ path: OUT + '/bm-edit.png' });
  await b.evaluate(() => $('#bmeOk').click()); await b.waitForTimeout(500);
  console.log('barre de favoris :', await b.evaluate(() => [...document.querySelectorAll('#bmbar .bi')].map(x => x.textContent.trim())));
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
