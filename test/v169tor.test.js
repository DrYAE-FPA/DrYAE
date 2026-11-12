// 1.6.9 : magnet — compteur de recherche de pairs, Annuler, torrent en double -> ajouter ses trackers
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const HOME = '/tmp/claude-0/uihome-v169tor'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', dir: HOME + '/dl' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(3000);
  const call = (ch, ...a) => w.evaluate(([ch, a]) => window.dryae.call(ch, ...a), [ch, a]);
  const H = '0123456789abcdef0123456789abcdef01234567';
  const M = `magnet:?xt=urn:btih:${H}&dn=Essai`;
  await w.evaluate(() => { window.__probe = []; window.dryae.on('torrent-probe', p => window.__probe.push(p)); });
  await w.evaluate(m => { window.__ins = window.dryae.call('torrent:inspect', m, {}).then(v => ({ v }), e => ({ e: e.message })); }, M);
  await wait(5000);
  const pr = await w.evaluate(() => window.__probe.slice(-1)[0]);
  ok('compteur « Recherche de pairs… » envoyé', pr && pr.hash === '0123456789abcdef0123456789abcdef01234567' && pr.s >= 2 && pr.max === 90, pr);
  await call('torrent:cancelProbe', H);
  const res = await w.evaluate(() => window.__ins);
  ok('Annuler arrête la recherche', /Annulé/.test(res.e || ''), res);
  const a = await call('torrent:addQuick', M + '&tr=udp%3A%2F%2Ftracker.exemple.org%3A1337');
  const b = await call('torrent:addQuick', M + '&tr=udp%3A%2F%2Fautre.exemple.net%3A80');
  ok('2e ajout du même torrent : signalé, avec ses trackers', a && a.id && b && b.duplicate && b.duplicate.newTrackers === 1, b);
  await call('torrent:trackers', b.duplicate.id, b.duplicate.trackers);
  const det = await call('details', a.id).catch(e => ({ e: e.message }));
  ok('trackers ajoutés au torrent existant', JSON.stringify(det).includes('autre.exemple.net'), (JSON.stringify(det) || '').slice(0, 120));
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
