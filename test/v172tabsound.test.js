// 1.7.2 : haut-parleur sur l'onglet qui fait du son (un clic coupe le son sans changer d'onglet) ; plus de note de
// musique ni de voyant d'économie d'énergie dans la barre ; menu raccourci (Aide et signalements réunis)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // page qui joue un son (onde générée, en boucle)
  const sr = 8000, n = sr * 2, wav = Buffer.alloc(44 + n * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(Math.sin(i / sr * 2 * Math.PI * 440) * 12000), 44 + i * 2);
  const srv = http.createServer((q, r) => { if (q.url === '/s.wav') { r.writeHead(200, { 'content-type': 'audio/wav' }); return r.end(wav); } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>Son</title><audio src="/s.wav" autoplay loop></audio>'); }).listen(0);
  const HOME = '/tmp/claude-0/uihome-v172snd'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), `http://127.0.0.1:${srv.address().port}/`);
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(2500);
  ok('plus de note de musique ni de voyant d\'énergie dans la barre', await b.evaluate(() => !document.getElementById('bMedia') && !document.getElementById('bLeaf')));
  // un deuxième onglet devient l'onglet actif ; le premier joue le son en arrière-plan
  await b.evaluate(() => newTab('about:blank')); await wait(500);
  let st = null;
  for (let i = 0; i < 20; i++) { await wait(500); st = await b.evaluate(() => { const t = tabs[0]; const s = t.el.querySelector('.snd'); return { audible: t.el.classList.contains('audible'), shown: getComputedStyle(s).display !== 'none', cur: tabs.indexOf(cur) }; }); if (st.audible) break; }
  ok('haut-parleur affiché sur l\'onglet qui fait du son', st.audible && st.shown, st);
  await b.evaluate(() => tabs[0].el.querySelector('.snd').click()); await wait(800);
  const m = await b.evaluate(() => ({ muted: !!tabs[0].muted, cls: tabs[0].el.classList.contains('muted'), href: tabs[0].el.querySelector('.snd use').getAttribute('href'), title: tabs[0].el.querySelector('.snd').title, cur: tabs.indexOf(cur), shown: getComputedStyle(tabs[0].el.querySelector('.snd')).display !== 'none' }));
  ok('un clic coupe le son de cet onglet, sans y aller', m.muted && m.cls && m.href === '#i-sound-off' && m.cur === 1 && m.shown && /Réactiver/.test(m.title), m);
  // vrai clic de souris (l'onglet garde la souris quand on appuie : le clic doit quand même aller au haut-parleur)
  await b.click('#tabs .tab >> nth=0 >> .snd'); await wait(800);
  ok('un second clic remet le son', await b.evaluate(() => !tabs[0].muted && tabs[0].el.querySelector('.snd use').getAttribute('href') === '#i-sound'));
  const labels = await b.evaluate(() => mainMenu().filter(e => e && typeof e === 'object' && e.label).map(e => e.label));
  ok('menu : plus de Mode lecture ni de Lire à voix haute', !labels.some(l => /Mode lecture|voix haute/.test(l)), labels);
  const help = await b.evaluate(() => { const h = mainMenu().find(e => e && e.label === 'Aide et signalements'); return h ? h.sub().filter(Boolean).map(e => e.label) : null; });
  ok('« Aide et signalements » réunis dans un sous-menu', !!help && help[0] === 'Signalements' && help.includes("Mode d'emploi") && !labels.includes('Signalements') && !labels.includes('Aide'), help);
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
