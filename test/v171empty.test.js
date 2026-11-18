// 1.7.1 (version perso) : liste du gestionnaire vide : le message est au milieu de la page dans tous les affichages
const { _electron } = require('playwright'); const fs = require('fs');
const path = require('path'); const ROOT = path.resolve(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const HOME = '/tmp/claude-0/uihome-v171empty'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 0, y: 0, width: 1280, height: 800 })); await wait(500);
  for (const v of ['icons-m', 'details', 'content']) {
    await w.evaluate(v => setView(v), v); await wait(400);
    const r = await w.evaluate(() => { const l = document.querySelector('#list').getBoundingClientRect(), e = document.querySelector('#list .empty b').getBoundingClientRect(); return { dx: Math.round((e.left + e.right) / 2 - (l.left + l.right) / 2), dy: Math.round((e.top + e.bottom) / 2 - (l.top + l.bottom) / 2), lines: Math.round(e.height / 18) }; });
    console.log((Math.abs(r.dx) < 20 && Math.abs(r.dy) < 120 && r.lines <= 1 ? 'OK  ' : 'ÉCHEC ') + v, JSON.stringify(r));
  }
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
