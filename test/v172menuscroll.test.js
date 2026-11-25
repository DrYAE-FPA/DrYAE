// 1.7.2 : le menu ⋮ ne sort jamais de la fenêtre ; petit écran : il se déroule (molette, ↑ ↓, petites flèches) ;
// → ouvre un sous-menu, ← revient ; grand écran : tout le menu s'affiche
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const HOME = '/tmp/claude-0/uihome-v172ms'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await wait(2500);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await wait(250); }
  await wait(1500);
  const size = async (W, H) => { await app.evaluate(({ BaseWindow }, [W, H]) => { for (const x of BaseWindow.getAllWindows()) { if (/Navigateur|DrYAE/.test(x.getTitle()) && x.contentView?.children?.length) { x.unmaximize(); x.setContentSize(W, H); } } }, [W, H]); await wait(900); };
  const st = () => b.evaluate(() => { const m = $('#menu'), r = m.getBoundingClientRect(); return { on: m.classList.contains('on'), top: Math.round(r.top), bottom: Math.round(r.bottom), ih: innerHeight, sh: m.scrollHeight, ch: m.clientHeight, st: m.scrollTop, dn: !!m.querySelector('.mscr.dn.on'), up: !!m.querySelector('.mscr.up.on'), focus: document.activeElement?.closest?.('#menu') ? document.activeElement.textContent.trim().slice(0, 30) : null }; });
  // petit écran
  await size(1100, 480);
  await b.click('#bMenu'); await wait(400);
  let s = await st();
  ok('petit écran : le menu reste dans la fenêtre', s.on && s.top >= 0 && s.bottom <= s.ih, s);
  if (process.env.SHOT) await b.screenshot({ path: '/tmp/menu-small.png' });
  ok('il se déroule (flèche ▾ en bas) et le clavier est dedans', s.sh > s.ch + 20 && s.dn && !s.up && !!s.focus, s);
  for (let i = 0; i < 14; i++) await b.keyboard.press('ArrowDown');
  await wait(300); s = await st();
  ok('↓ descend dans le menu et le fait défiler', s.st > 0 && s.up && !!s.focus, s);
  await b.keyboard.press('End'); await wait(300); s = await st();
  if (process.env.SHOT) await b.screenshot({ path: '/tmp/menu-small2.png' });
  ok('jusqu\'en bas (Quitter visible)', /Quitter/.test(s.focus || '') && s.st >= s.sh - s.ch - 3 && !s.dn, s);
  await b.keyboard.press('Home'); await wait(200);
  await b.mouse.move(1000, 200); await b.evaluate(() => { $('#menu').scrollTop = 0; });
  const box = await b.evaluate(() => { const r = $('#menu').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await b.mouse.move(box.x, box.y); await b.mouse.wheel(0, 300); await wait(400); s = await st();
  ok('la molette fait défiler le menu', s.st > 50, s);
  // → ouvre « Historique », ← revient
  await b.evaluate(() => { [...document.querySelectorAll('#menu [data-i]')].find(x => /Historique/.test(x.textContent)).focus(); });
  await b.keyboard.press('ArrowRight'); await wait(300);
  const sub = await b.evaluate(() => ({ back: !!$('#menu [data-back]'), t: $('#menu [data-back]')?.textContent.trim(), f: document.activeElement?.closest('#menu') ? document.activeElement.textContent.trim().slice(0, 30) : null }));
  ok('→ ouvre le sous-menu (panneau qui coulisse) avec le clavier dedans', sub.back && /Historique/.test(sub.t) && !!sub.f, sub);
  await b.keyboard.press('ArrowLeft'); await wait(300);
  ok('← revient au menu principal', await b.evaluate(() => !$('#menu [data-back]') && $('#menu').classList.contains('on') && /Historique/.test($('#menu').textContent)));
  await b.keyboard.press('Escape'); await wait(200);
  // grand écran : tout le menu
  await size(1300, 1000);
  await b.click('#bMenu'); await wait(400); s = await st();
  ok('grand écran : tout le menu s\'affiche, sans défilement', s.on && s.bottom <= s.ih && s.sh <= s.ch + 2 && !s.dn, s);
  await app.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
