// 1.6.4 : textes restés en français dans les nouvelles pages et menus (langue anglaise)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FR = /\b(le|la|les|des|du|une|est|pour|avec|dans|sur|aucun|aucune|télécharg\w*|paramètres|fichier\w*|lien\w*|navigateur|ajouter|onglet\w*|vidéo\w*|mot de passe|favori\w*|supprimer|afficher|traduire|historique)\b|[éèêàùç]/i;
const scan = () => { const out = new Set(); const w = document.createTreeWalker(document.body, 5); let n;
  while ((n = w.nextNode())) { if (n.nodeType === 3) { const p = n.parentElement; if (!p || p.closest('script,style,[data-notr],.notr,.name,.mono,.tab .t,code,textarea')) continue; const v = n.nodeValue.trim(); if (v) out.add(v); } else for (const a of ['placeholder', 'title']) { const v = n.getAttribute(a); if (v && !n.closest('.notr')) out.add('@' + v); } }
  return [...out]; };
(async () => {
  const lang = process.env.LANGX || 'en';
  const HOME = '/tmp/claude-0/uihome-v164e'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang, langChosen: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(() => window.dryae.call('openBrowser', 'about:blank'));
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  await b.waitForTimeout(1500);
  const left = new Set();
  // menus du navigateur
  const subs = await b.evaluate(() => mainMenu().filter(e => e && typeof e === 'object' && e.sub).length);
  await b.evaluate(() => menu(10, 10, mainMenu(), true)); await b.waitForTimeout(150); (await b.evaluate(scan)).forEach(x => left.add('menu:' + x));
  for (let i = 0; i < subs; i++) { await b.evaluate(i => { const s = mainMenu().filter(e => e && typeof e === 'object' && e.sub)[i]; menu(10, 10, s.sub()); }, i); await b.waitForTimeout(120); (await b.evaluate(scan)).forEach(x => left.add('menu:' + x)); }
  await b.evaluate(() => { $('#menu').classList.remove('on'); showShortcuts(); }); await b.waitForTimeout(200); (await b.evaluate(scan)).forEach(x => left.add('kb:' + x));
  for (const p of ['history', 'bookmarks', 'passwords', 'extensions', 'settings']) {
    await b.evaluate(n => B.call('br:openPage', n), p);
    let pg; for (let i = 0; i < 30 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith('dryae://' + p)); await new Promise(r => setTimeout(r, 200)); }
    await pg.waitForTimeout(1200);
    (await pg.evaluate(scan)).forEach(x => left.add(p + ':' + x));
    if (p === 'passwords') for (const v of ['check', 'cards', 'addresses', 'settings']) { await pg.evaluate(v => go(v), v); await pg.waitForTimeout(500); (await pg.evaluate(scan)).forEach(x => left.add(p + '/' + v + ':' + x)); }
    if (p === 'extensions') { await pg.evaluate(() => { view = 'keys'; draw(); }); await pg.waitForTimeout(200); (await pg.evaluate(scan)).forEach(x => left.add(p + '/keys:' + x)); }
    if (p === 'history') { await pg.evaluate(() => { clearDialog(); }); await pg.waitForTimeout(700); (await pg.evaluate(scan)).forEach(x => left.add(p + '/clear:' + x)); }
  }
  const bad = [...left].filter(x => FR.test(x.replace(/^[\w/]+:@?/, '').replace(/DrYAE|Chrome Web Store|Pwned Passwords|LibreTranslate|DeepL|Windows Hello|Wikipédia/g, '')));
  console.log(lang, 'restes :', bad.length); console.log(bad.join('\n'));
  await app.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
