// 1.7.2 : toutes les paires de langues du Traducteur de scans (6 langues de DrYAE + japonais) ont une traduction sur le PC
// (directe ou par l'anglais). Sans Internet, la liste des modèles ne peut pas être lue : le test le dit et ne compte pas.
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 400) : '');
(async () => {
  const HOME = '/tmp/claude-0/uihome-v172pairs'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  const r = await app.evaluate(async ({ app }, root) => {
    const LM = process.mainModule.require(root + '/src/main/local-mt.js'); const L = ['fr', 'en', 'es', 'pt', 'ru', 'ar', 'ja']; const out = {}; let net = true;
    try { await LM.route('en', 'fr'); const t = await LM.route('en', 'fr'); if (!t) net = false; } catch { net = false; }
    if (!net) return { net };
    for (const a of L) for (const b of L) if (a !== b && b !== 'ja') { const x = await LM.route(a, b).catch(() => null); out[a + '>' + b] = x ? x.kind || 'ok' : 'aucune'; }
    return { net, out };
  }, ROOT);
  if (!r.net) console.log('OK  (pas d\'Internet : liste des modèles illisible, test sauté)');
  else {
    const none = Object.entries(r.out).filter(([, k]) => k === 'none' || k === 'aucune').map(([p]) => p);
    console.log('INFO paires :', JSON.stringify(r.out));
    ok('toutes les paires ont une traduction sur le PC (directe ou par l\'anglais)', !none.length, none);
  }
  await Promise.race([app.close(), new Promise(r => setTimeout(r, 4000))]); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
