// 1.7.2 : nouvelle page d'accueil (raccourcis, recherche, carte des nouveautés, widgets, Personnaliser) et thèmes (DrYAE + boutique Chrome)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));
// petite image PNG 1×1
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const HOME = '/tmp/claude-0/uihome-v172home'; fs.rmSync(HOME, { recursive: true, force: true });
  const UD = HOME + '/.config/DrYAE'; fs.mkdirSync(UD, { recursive: true });
  fs.writeFileSync(UD + '/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  // faux thème installé depuis la boutique
  const TD = UD + '/extensions/aaaabbbbccccddddeeeeffffgggghhhh/1.0_0'; fs.mkdirSync(TD + '/images', { recursive: true });
  fs.writeFileSync(TD + '/manifest.json', JSON.stringify({ manifest_version: 3, name: 'Thème essai', version: '1.0', theme: { colors: { frame: [20, 40, 90], toolbar: [30, 60, 120], tab_text: [240, 240, 255], ntp_background: [10, 20, 60], ntp_text: [250, 250, 250] }, images: { theme_ntp_background: 'images/fond.png' } } }));
  fs.writeFileSync(TD + '/images/fond.png', PNG);
  // un favori existant → doit devenir un raccourci
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await wait(4000);
  const UI = async (fn, arg) => app.evaluate(async ({ BrowserWindow }, [src, a]) => {
    const w = BrowserWindow.getAllWindows()[0]; const v = w.contentView.children[0];
    return v.webContents.executeJavaScript('(' + src + ')(' + JSON.stringify(a) + ')');
  }, [fn.toString(), arg]);
  const inv = (ch, ...a) => app.evaluate(async ({ ipcMain }, [c, args]) => { const h = ipcMain._invokeHandlers?.get?.(c); return h ? h({ sender: null }, ...args) : '__none'; }, [ch, a]);

  // 1) page d'accueil
  await UI(async () => { if (typeof drawTiles === 'function') await drawTiles(); });
  await wait(800);
  const h = await UI(() => ({
    brand: !!document.querySelector('#start .brand h1'), q: !!document.getElementById('startQ'),
    tiles: [...document.querySelectorAll('#tiles .tile:not(.add)')].map(t => t.textContent.trim()),
    add: !!document.getElementById('ntAdd'), news: (n => !!n && n.innerHTML.length > 0 && getComputedStyle(n).display !== 'none')(document.getElementById('ntNews')),
    wid: document.querySelectorAll('#ntWid .w').length, edit: !!document.getElementById('ntpEdit'),
    oldPaste: /Coller un lien/.test(document.getElementById('start').textContent),
  }));
  ok('page d\'accueil : logo et nom, grande barre de recherche', h.brand && h.q, h);
  ok('raccourcis par défaut (Google, YouTube, Wikipédia, GitHub, Archive.org, Gmail) + « Ajouter »', h.tiles.length === 6 && h.add && h.tiles.some(t => /Wikip/.test(t)), h.tiles);
  ok('carte des nouveautés et bouton Personnaliser ; widgets cachés par défaut', h.news && h.wid === 0 && h.edit, h);
  ok('pas de « Coller un lien » ni de raccourcis d\'actions', !h.oldPaste);
  const tm = await UI(async () => { const b = document.querySelectorAll('#tiles .tmore')[1]; b.click(); await new Promise(r => setTimeout(r, 200)); const m = [...document.querySelectorAll('#menu button')].map(x => x.textContent.trim()); document.getElementById('menu').classList.remove('on'); const t = [...document.querySelectorAll('#tiles .tile')]; return { m, rows: new Set(t.map(x => Math.round(x.getBoundingClientRect().top))).size }; });
  ok('bouton ⋮ sur chaque raccourci : Modifier, Retirer, Ouvrir ; « + Ajouter » sur la même ligne', tm.m.join('|') === 'Modifier|Retirer|Ouvrir dans un nouvel onglet' && tm.rows === 1, tm);

  // 2) panneau Personnaliser + interrupteurs
  const p = await UI(async () => {
    document.getElementById('ntpEdit').click(); await new Promise(r => setTimeout(r, 400));
    const P = document.getElementById('ntPanel'); const open = P && P.classList.contains('on') || (P && getComputedStyle(P).display !== 'none' && P.innerHTML.length > 100);
    const keys = [...P.querySelectorAll('input.ntsw')].map(i => i.dataset.k);
    const more = [...P.querySelectorAll('button,a')].some(b => /davantage de thèmes/.test(b.textContent));
    return { open, keys, more };
  });
  ok('panneau Personnaliser à droite avec « Afficher davantage de thèmes »', p.open && p.more, p);
  ok('interrupteurs : fond, raccourcis, sites les plus visités, widgets, nouveautés, logo', ['bgOn', 'shortcuts', 'topSites', 'news', 'logo'].every(k => p.keys.includes(k)), p.keys);
  const off = await UI(async () => {
    const i = document.querySelector('#ntPanel input.ntsw[data-k="news"]'); if (i.checked) i.click();
    await new Promise(r => setTimeout(r, 600)); const n = document.getElementById('ntNews'); return n.innerHTML.length > 0 && getComputedStyle(n).display !== 'none';
  });
  ok('désactiver la carte des nouveautés la cache', !off);
  const w2 = await UI(async () => {
    const i = document.querySelector('#ntPanel input.ntsw[data-k="widgets.on"]'); if (!i.checked) i.click();
    await new Promise(r => setTimeout(r, 600)); return document.querySelectorAll('#ntWid .w').length;
  });
  ok('activer les widgets : minuteur et tâches', w2 === 2, w2);

  // 3) thèmes
  const th = await inv('br:themes');
  const list = (th && (th.list || th.themes)) || [];
  const chrome = list.find(t => t.kind === 'chrome');
  ok('thèmes de DrYAE intégrés (8)', list.filter(t => t.kind !== 'chrome').length >= 8, list.map(t => t.id));
  ok('thème de la boutique Chrome reconnu (nom, mode sombre)', chrome && chrome.name === 'Thème essai' && chrome.mode === 'dark', chrome);
  if (chrome) {
    await inv('br:themeSet', chrome.id); await wait(1200);
    const v = await UI(() => ({ bg: document.documentElement.style.getPropertyValue('--bg'), mode: document.documentElement.dataset.mode }));
    ok('activer le thème Chrome change les couleurs du navigateur', /\S/.test(v.bg) && v.mode === 'dark', v);
    const img = await inv('br:themeImage');
    ok('image de fond du thème Chrome disponible pour la page d\'accueil', typeof img === 'string' && img.startsWith('data:image/'), typeof img === 'string' ? img.slice(0, 30) : img);
  }
  await inv('br:themeSet', 'ocean'); await wait(800);
  const oc = await UI(() => document.documentElement.style.getPropertyValue('--accent'));
  ok('thème Océan appliqué', /\S/.test(oc), oc);
  await inv('br:themeSet', 'default'); await wait(800);
  const df = await UI(() => document.documentElement.style.getPropertyValue('--bg'));
  ok('retour au thème par défaut (variables retirées)', !/\S/.test(df), df);

  // 4) menu renommé
  const ext = fs.readFileSync(ROOT + '/src/pages/extensions.js', 'utf8');
  ok('page « Extensions et thèmes » avec vue Thèmes', /Extensions et thèmes/.test(ext) && /Explorer les thèmes/.test(ext));
  // 5) signalements : modèle sans champ obligatoire, adresse pas trop longue, rapport copié
  const br = await app.evaluate(async ({ shell, clipboard }, root) => {
    let clip = 0; clipboard.writeText = t => { clip = Math.max(clip, String(t).length); };
    const R = process.mainModule.require(root + '/src/main/reports.js').Reports.last; const urls = []; R.open = async u => { urls.push(u); };
    const long = Array.from({ length: 400 }, (_, i) => 'ligne ' + i + ' ' + 'x'.repeat(40)).join('\n');
    const a = await R.add({ kind: 'bug', title: 'Essai', msg: 'je cliquais', report: long, sig: 'h1' }); await R.send(a.id);
    const B = process.mainModule.require(root + '/src/main/bugreport.js');
    const t = await B.translation({ text: 'HELLO', tr: 'BONJOUR', from: 'en', to: 'fr' }); await R.send(t.id);
    return { u: urls, clip };
  }, ROOT);
  const u0 = new URL(br.u[0] || 'http://x'), u1 = new URL(br.u[1] || 'http://x');
  ok('signalement : modèle « rapport.yml » prérempli (que faisiez-vous, version, Windows, rapport)', u0.searchParams.get('template') === 'rapport.yml' && ['what', 'version', 'windows', 'report'].every(k => u0.searchParams.has(k)), u0.search.slice(0, 120));
  ok('adresse courte pour GitHub (rapport raccourci, complet dans le presse-papiers)', br.u[0].length <= 2800 && u0.searchParams.get('report').length > 100, br.u[0].length);
  ok('rapport complet copié dans le presse-papiers', br.clip > 10000, br.clip);
  ok('signalement de traduction : modèle « traduction.yml »', u1.searchParams.get('template') === 'traduction.yml' && /BONJOUR/.test(u1.searchParams.get('what')));
  const yml = fs.readFileSync(ROOT + '/.github/ISSUE_TEMPLATE/rapport.yml', 'utf8') + fs.readFileSync(ROOT + '/.github/ISSUE_TEMPLATE/traduction.yml', 'utf8');
  ok('aucun champ obligatoire dans les modèles préremplis', !/required:\s*true/.test(yml));
  await app.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
