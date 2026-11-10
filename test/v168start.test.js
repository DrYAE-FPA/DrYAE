// 1.6.8 : DrYAE s'ouvre sur le navigateur (par défaut) ou sur le gestionnaire (au choix)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, v === true || v === false ? '' : v);
async function run(startView) {
  const HOME = '/tmp/claude-0/uihome-v168s-' + (startView || 'def'); fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, ...(startView ? { startView } : {}) }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await new Promise(r => setTimeout(r, 4000));
  const st = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; const v = w.contentView.children[0]; return { title: w.getTitle(), visible: w.isVisible(), browser: !!(v && v.getVisible && v.getVisible()) }; });
  await app.close(); return st;
}
(async () => {
  const a = await run(); ok('par défaut : navigateur', a.visible && a.browser ? JSON.stringify(a) : JSON.stringify(a));
  const b = await run('manager'); ok('réglage gestionnaire', b.visible && !b.browser ? JSON.stringify(b) : JSON.stringify(b));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
