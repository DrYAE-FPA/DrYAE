// 1.7.0 refaite : connexion « identity » depuis le service de fond (service worker) d'une extension Chrome.
// Avant, chrome.identity n'existait pas dans ce service (Electron n'y lance pas les préchargements).
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/auth')) { r.writeHead(302, { Location: 'https://' + new URL(q.url, 'http://x').searchParams.get('id') + '.chromiumapp.org/cb?code=42' }); return r.end(); } r.setHeader('Content-Type', 'text/html'); r.end('<p>Hello</p>'); }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = (process.env.TMPH || '/tmp/claude-0') + '/uihome-v170extsw'; fs.rmSync(HOME, { recursive: true, force: true });
  const UD = HOME + '/.config/DrYAE', X = UD + '/extensions/local-x'; fs.mkdirSync(X, { recursive: true });
  fs.writeFileSync(X + '/manifest.json', JSON.stringify({ manifest_version: 3, name: 'swauth', version: '1.0', background: { service_worker: 'bg.js' }, permissions: ['identity'] }));
  fs.writeFileSync(X + '/bg.js', "setTimeout(() => chrome.identity.launchWebAuthFlow({ url: '" + base + "/auth?id=' + chrome.runtime.id, interactive: true }).then(u => console.log('SWAUTH OK ' + u), e => console.log('SWAUTH ERR ' + e.message)), 2000);");
  fs.writeFileSync(UD + '/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const logs = [];
  await app.evaluate(({ session }) => { const s = session.fromPartition('persist:dryae-web'); s.serviceWorkers.on('console-message', (e, d) => console.log('[sw] ' + ((d || e).message || ''))); });
  app.process().stdout.on('data', d => logs.push(String(d)));
  await app.firstWindow();
  let res = ''; for (let i = 0; i < 60 && !res; i++) { await wait(500); res = logs.join('').split('\n').find(l => /SWAUTH/.test(l)) || ''; }
  ok('chrome.identity dans le service de fond : connexion réussie', /SWAUTH OK https:\/\/[a-p]{32}\.chromiumapp\.org\/cb\?code=42/.test(res), res.trim());
  ok('fichier de connexion placé avant le script de fond', fs.existsSync(X + '/dryae-sw-entry.js') && JSON.parse(fs.readFileSync(X + '/manifest.json', 'utf8')).dryae_original_service_worker === 'bg.js');
  // un site web ne peut pas demander une connexion au nom d'une extension
  const code = await new Promise(r => http.get({ host: '127.0.0.1', port: 47811, path: '/dryae-id/auth?ext=' + 'a'.repeat(32) + '&u=https://x', headers: { Origin: 'https://site.example' } }, s => r(s.statusCode)).on('error', () => r(0)));
  ok('demande venant d\'un site web refusée', code === 403, code);
  await app.close(); srv.close();
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
