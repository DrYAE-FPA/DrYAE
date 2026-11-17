// 1.7.1 (version perso) : « Lumières éteintes » toujours actif → la page suivante est sombre dès le début du chargement
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => {
    r.setHeader('content-type', 'text/html; charset=utf-8');
    if (q.url.startsWith('/lent')) { r.write('<!doctype html><html><head><title>Lent</title></head><body style="background:#fff"><p>' + 'Texte clair. '.repeat(400) + '</p><script>setTimeout(()=>{const s=getComputedStyle(document.documentElement,"::before");window.__v={op:+s.opacity,pos:s.position,bg:s.backgroundColor,state:document.readyState}},300)</script>'); return setTimeout(() => r.end('<p id="fin">fin</p></body></html>'), 4000); }
    r.end('<title>Accueil</title><body style="background:#fff"><p>Bonjour</p></body>');
  }).listen(0); const port = srv.address().port;
  const HOME = '/tmp/claude-0/uihome-v171li'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--host-resolver-rules=MAP site.test 127.0.0.1'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(p => window.dryae.call('openBrowser', 'http://site.test:' + p + '/'), port);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(2500);
  const js = code => b.evaluate(c => cur.wv.executeJavaScript(c), code);
  await b.evaluate(() => pageCmd('lights')); await wait(1200);
  ok('lumières éteintes sur la première page', await b.evaluate(() => !!cur.lit));
  await b.evaluate(p => { cur.wv.loadURL('http://site.test:' + p + '/lent').catch(() => {}); }, port);
  // pendant le chargement (la fin de la page arrive 4 s plus tard) : la page note elle-même ce qu'elle affiche
  await wait(5500);
  const seen = await js('window.__v || null');
  ok('page sombre pendant le chargement (avant la fin)', seen && seen.state === 'loading' && seen.pos === 'fixed' && seen.op > 0.3, seen);
  const after = await js(`(()=>({ fin: !!document.getElementById('fin'), early: getComputedStyle(document.documentElement, '::before').position === 'fixed' }))()`);
  ok('page chargée : le voile du début a laissé la place au vrai voile', after.fin && !after.early, after);
  ok('lumières toujours éteintes après le chargement', await b.evaluate(() => !!cur.lit));
  await Promise.race([app.close(), wait(5000)]); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
