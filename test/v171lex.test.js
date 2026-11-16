// 1.7.1 (version perso) : lexique géré dans les paramètres (recherche, modification, mots courants repérés, suppression groupée)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const OUT = '/tmp/claude-0/v171'; fs.mkdirSync(OUT, { recursive: true });
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const HOME = '/tmp/claude-0/uihome-v171lex'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  const glossary = [{ s: 'TSUKUMOGAMI', t: 'TSUKUMOGAMI' }, { s: 'HERE', t: 'ICI' }, { s: 'THAT', t: 'QUE' }, { s: 'THERE IS', t: 'IL Y A' }, { s: 'SHINOBU', t: 'SHINOBU', n: true },
    { s: 'NOW, LET ME EXPLAIN THE NINE MASTERS TOURNAMENT ONCE MORE.', t: 'MAINTENANT…' }, { s: 'MASTERS', t: 'maîtres' }];
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager', browser: { scan: { glossary } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2000);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(1500);
  await b.evaluate(() => openPage('settings', 'lexique')); await wait(2500);
  const sp = app.windows().find(x => x.url().startsWith('dryae://settings'));
  sp.on('pageerror', e => console.log('[err]', e.message));
  const n = await sp.evaluate(() => document.querySelectorAll('#lexRows [data-li]').length);
  ok('lexique affiché dans les paramètres', n === 7, n);
  const common = await sp.evaluate(() => [...document.querySelectorAll('#lexRows [data-ls]')].filter(i => i.style.borderColor).map(i => i.value));
  ok('mots courants et phrase entière repérés (pas les noms)', ['HERE', 'THAT', 'THERE IS'].every(x => common.includes(x)) && common.some(x => x.startsWith('NOW,')) && !common.includes('TSUKUMOGAMI') && !common.includes('MASTERS'), common);
  await sp.screenshot({ path: OUT + '/lexique.png' });
  await sp.evaluate(() => { window.confirm = () => true; document.querySelector('#lexPickCommon').click(); }); await wait(300);
  await sp.evaluate(() => document.querySelector('#lexDelSel').click()); await wait(800);
  const left = await sp.evaluate(() => D.call('cfg').then(c => c.scan.glossary.map(g => g.s)));
  ok('suppression groupée des mots courants', left.length === 3 && left.includes('TSUKUMOGAMI') && left.includes('SHINOBU') && left.includes('MASTERS'), left);
  await sp.evaluate(() => { const i = document.querySelector('#lexQ'); i.value = 'tsuku'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
  ok('recherche', await sp.evaluate(() => document.querySelectorAll('#lexRows [data-li]').length) === 1);
  await sp.evaluate(() => { const i = document.querySelector('#lexQ'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  await sp.click('#lexAddS'); await sp.keyboard.type('Oriobana'); await sp.click('#lexAddT'); await sp.keyboard.type('Oriobana');
  await sp.click('#lexAdd'); await wait(800);
  const after = await sp.evaluate(() => D.call('cfg').then(c => c.scan.glossary.map(g => g.s)));
  ok('ajout depuis les paramètres', after.includes('Oriobana'), after);
  await sp.click('#lexQ'); await sp.keyboard.type('orio'); await wait(300);
  ok('recherche au clavier (lettre par lettre)', await sp.evaluate(() => document.querySelector('#lexQ').value === 'orio' && document.querySelectorAll('#lexRows [data-li]').length === 1));
  await sp.screenshot({ path: OUT + '/lexique2.png' });
  await Promise.race([app.close(), wait(5000)]); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
