// Vidéos de démonstration de DrYAE (lancé par GitHub Actions : .github/workflows/demo-videos.yml).
// DrYAE est lancé sur un écran virtuel ; chaque scène est filmée avec ffmpeg. Images : Pepper&Carrot (CC BY 4.0).
// Rien de privé : pages de test écrites ici, et la BD libre de David Revoy.
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..'); const OUT = path.join(ROOT, 'dist', 'demo'); fs.mkdirSync(OUT, { recursive: true });
const PC = path.join(__dirname, 'pc'); const PAGES = fs.readdirSync(PC).filter(f => f.endsWith('.jpg')).sort();
const wait = ms => new Promise(r => setTimeout(r, ms));
const W = 1280, H = 800;
const BIG = Buffer.alloc(80 * 1048576, 7);
const srv = http.createServer((q, r) => {
  const m = /^\/pc\/(P\d+\.jpg)$/.exec(q.url); if (m && PAGES.includes(m[1])) { r.setHeader('Content-Type', 'image/jpeg'); return r.end(fs.readFileSync(path.join(PC, m[1]))); }
  if (q.url === '/fichier/Video-de-vacances.mp4') { r.setHeader('Content-Type', 'video/mp4'); r.setHeader('Content-Length', BIG.length); let i = 0; const push = () => { if (i >= BIG.length) return r.end(); r.write(BIG.subarray(i, i + 256 * 1024)); i += 256 * 1024; setTimeout(push, 40); }; return push(); }
  r.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (q.url === '/bd') return r.end(`<!doctype html><title>Pepper&Carrot — Episode 39</title><body style="margin:0;background:#1d1f24;font-family:sans-serif;color:#ddd"><p style="text-align:center;font-size:13px">Pepper&amp;Carrot — David Revoy — CC BY 4.0</p>${PAGES.map(p => `<img src="/pc/${p}" style="display:block;margin:0 auto 14px;width:720px">`).join('')}</body>`);
  r.end(`<!doctype html><html lang="en"><title>Learning to draw comics</title><body style="max-width:720px;margin:40px auto;font:18px/1.6 Georgia,serif;color:#222"><h1>Learning to draw comics</h1><p>Drawing comics is a wonderful hobby. You only need a pencil, some paper and a little patience.</p><p>Start with simple characters, then tell a short story in three or four panels. Do not worry about mistakes: every artist makes them.</p><p>Practice every day, read a lot of comics, and share your work with friends.</p></body></html>`);
}).listen(0);
const base = () => `http://127.0.0.1:${srv.address().port}`;
function rec(name) {
  const f = path.join(OUT, name + '.mp4');
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'x11grab', '-video_size', `${W}x${H}`, '-framerate', '20', '-i', process.env.DISPLAY + '+0,0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', f], { stdio: ['pipe', 'inherit', 'inherit'] });
  return () => new Promise(res => { p.on('close', res); p.stdin.write('q'); p.stdin.end(); });
}
(async () => {
  await new Promise(r => srv.once('listening', r));
  const HOME = path.join(OUT, 'home'); fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'browser', browser: { translate: { target: 'fr' } } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const fit = () => app.evaluate(({ BrowserWindow }, s) => BrowserWindow.getAllWindows().forEach(w => { if (w.isVisible()) w.setBounds({ x: 0, y: 0, width: s[0], height: s[1] }); }), [W, H]);
  const mgr = await app.firstWindow(); await wait(3000);
  let b; for (let i = 0; i < 60 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await fit();
  const pageOf = async rx => { let p; for (let i = 0; i < 60 && !p; i++) { p = app.windows().find(x => rx.test(x.url())); await wait(250); } return p; };
  const cache = () => { try { return JSON.parse(fs.readFileSync(HOME + '/.config/DrYAE/scan-cache.json', 'utf8')); } catch { return []; } };

  // 1. Traducteur de scans : bulles anglaises traduites en français, directement sur la page
  await b.evaluate(u => navigate(cur, u + '/bd'), base()); const pg = await pageOf(/\/bd$/); await wait(2500);
  let stop = rec('1-traducteur-de-scans'); await wait(1500);
  await b.evaluate(() => popOpen('scan', document.querySelector('#tbItems [data-key="mod:scan"]') || document.querySelector('#bExt'))); await wait(2500);
  await b.evaluate(() => { popClose(); pageCmd('scan'); });
  for (let i = 0; i < 60 && cache().length < 1; i++) await wait(500); await wait(2500);
  for (let y = 0; y < 2400; y += 60) { await pg.evaluate(y => scrollTo(0, y), y); await wait(120); }
  for (let i = 0; i < 30 && cache().length < 3; i++) await wait(500); await wait(2500);
  await stop();

  // 2. Lecteur de BD : un fichier .cbz ouvert dans DrYAE, page par page
  const cbz = path.join(OUT, 'Pepper-and-Carrot-ep39.cbz'); fs.rmSync(cbz, { force: true });
  const z = require('7zip-bin').path7za; try { fs.chmodSync(z, 0o755); } catch {}
  execFileSync(z, ['a', '-tzip', cbz, ...PAGES.map(p => path.join(PC, p))]);
  await app.evaluate(({ dialog }, f) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, cbz);
  stop = rec('2-lecteur-de-bd'); await wait(800);
  await b.evaluate(() => B.call('br:openComic', 'file')); const rd = await pageOf(/^dryae:\/\/bd\//); await wait(2500);
  await rd.evaluate(() => { const m = document.querySelector('#mode'); m.value = 'page'; m.onchange(); }); await wait(1500);
  for (let i = 0; i < 3; i++) { await rd.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))); await wait(1600); }
  await rd.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))); await wait(800);
  await b.evaluate(() => pageCmd('scan')); await wait(9000);
  await stop();

  // 3. Traduction sur le PC : sans service extérieur (modèles libres téléchargés une fois)
  await b.evaluate(() => openPage('settings', 'translate')); const st = await pageOf(/^dryae:\/\/settings/); await st.waitForSelector('#trProv', { timeout: 20000 }); await wait(1500);
  stop = rec('3-traduction-sur-le-pc'); await wait(1200);
  await st.evaluate(() => { const s = document.querySelector('#trProv'); s.value = 'local'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(1500);
  await st.evaluate(() => document.querySelector('#trLocal').scrollIntoView({ block: 'center' })); await wait(800);
  await st.evaluate(() => document.querySelector('#lmGet').click());
  for (let i = 0; i < 120; i++) { const t = await st.evaluate(() => document.querySelector('#lmInfo').textContent); if (/en-fr/.test(t) && !/%/.test(t)) break; await wait(500); }
  await wait(2000);
  await b.evaluate(u => newTab(u + '/article'), base()); await pageOf(/\/article$/); await wait(2000);
  await b.evaluate(() => pageCmd('translate-page')); await wait(7000);
  await stop();

  // 4. Gestionnaire de téléchargements
  await b.evaluate(() => B.call('br:openMain')); await wait(1500); await fit();
  stop = rec('4-gestionnaire'); await wait(1000);
  await mgr.evaluate(u => window.dryae.call('add', { urls: [u + '/fichier/Video-de-vacances.mp4'], startNow: true }), base()); await wait(12000);
  await stop();

  // 5. Travail et études : palette de commandes, mode concentration
  await mgr.evaluate(() => window.dryae.call('openBrowser', '')).catch(() => {}); await wait(1500); await fit();
  stop = rec('5-travail-et-etudes'); await wait(1000);
  await b.evaluate(() => window.WORK?.palette?.()); await wait(1200);
  await b.keyboard.type('concentration', { delay: 90 }); await wait(1500); await b.keyboard.press('Escape'); await wait(500);
  await b.evaluate(() => window.TABSX?.toggleSide('ws')); await wait(3000); await b.evaluate(() => window.TABSX?.toggleSide('ws')); await wait(800);
  await stop();

  await app.close().catch(() => {}); srv.close();
  // petite image animée pour la page GitHub (traducteur de scans)
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3', '-t', '9', '-i', path.join(OUT, '1-traducteur-de-scans.mp4'), '-vf', 'fps=8,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer', path.join(OUT, 'traducteur-de-scans.gif')]); } catch (e) { console.log('gif', e.message); }
  for (const f of fs.readdirSync(OUT)) if (/\.(mp4|gif)$/.test(f)) console.log('vidéo', f, Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' Ko');
})().catch(e => { console.log('ERREUR', e.stack || e.message); process.exit(1); });
