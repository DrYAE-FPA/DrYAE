// 1.7.2 : centre des signalements — boîte gardée sur le PC (même hors connexion), menu avec pastille rouge, Alt+Maj+I,
// page Paramètres → Signalements (phrases prêtes, section, envoi validé par la page GitHub), suivi des réponses, doublons,
// téléchargement repris par le navigateur quand DrYAE ne peut pas le faire
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const HOME = '/tmp/claude-0/uihome-v172rep'; fs.rmSync(HOME, { recursive: true, force: true });
  const UD = HOME + '/.config/DrYAE'; fs.mkdirSync(UD, { recursive: true });
  fs.writeFileSync(UD + '/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, browser: { bugHelp: true } }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow(); await wait(4000);
  const M = (fn, arg) => app.evaluate(async (_el, [src, a, root]) => { const R = process.mainModule.require(root + '/src/main/reports.js').Reports.last; return eval('(' + src + ')')(R, a, root); }, [fn.toString(), arg, ROOT]);
  const UI = (fn, arg) => app.evaluate(async ({ BrowserWindow }, [src, a]) => { const v = BrowserWindow.getAllWindows()[0].contentView.children[0]; return v.webContents.executeJavaScript('(' + src + ')(' + JSON.stringify(a) + ')'); }, [fn.toString(), arg]);
  const PG = (fn, arg) => app.evaluate(async ({ webContents }, [src, a]) => { const w = webContents.getAllWebContents().find(x => /^dryae:\/\/settings/.test(x.getURL())); if (!w) return '__nopage'; return w.executeJavaScript('(async () => (' + src + ')(' + JSON.stringify(a) + '))()'); }, [fn.toString(), arg]);

  // faux GitHub (lecture publique) et ouverture de page interceptée
  await M(R => {
    global.__opened = []; global.__gh = { issues: [], comments: {} };
    R.open = async u => { global.__opened.push(u); };
    R.fetch = async u => { const p = u.replace('https://api.github.com/repos/DrYAE-FPA/DrYAE', ''); const m = p.match(/^\/issues\/(\d+)\/comments/); const body = m ? (global.__gh.comments[m[1]] || []) : global.__gh.issues; return { ok: true, status: 200, json: async () => body }; };
    return true;
  });

  // 1) une erreur de DrYAE est gardée (même deux fois : une seule ligne, « arrivé 2 fois »)
  await M((R, a, root) => { const L = process.mainModule.require(root + '/src/main/log.js'); L.write('erreur', 'exception', 'TypeError: essai de signalement at x.js:1'); return true; });
  await wait(2500);
  await M((R, a, root) => { const L = process.mainModule.require(root + '/src/main/log.js'); L.write('erreur', 'exception', 'TypeError: essai de signalement at x.js:2'); return true; });
  await wait(800);
  const b1 = await M(R => ({ n: R.list.length, x: R.list[0] && { auto: R.list[0].auto, count: R.list[0].count, state: R.list[0].state, code: R.list[0].code }, c: R.counts() }));
  ok('erreur détectée gardée dans la boîte (même hors connexion), répétée = une seule ligne', b1.n === 1 && b1.x.auto && b1.x.count === 2 && b1.x.state === 'draft' && /^R-[0-9A-F]{4}$/.test(b1.x.code), b1);
  ok('compteur « à envoyer » pour l\'icône rouge', b1.c.pending === 1, b1.c);
  const saved = JSON.parse(fs.readFileSync(UD + '/reports.json', 'utf8'));
  ok('boîte enregistrée sur le disque (reports.json)', saved.list && saved.list.length === 1);
  await wait(600);
  const dot = await UI(() => { menu(0, 0, mainMenu()); const b = [...document.querySelectorAll('#menu button')].find(x => /Aide et signalements/.test(x.textContent)); const sub = mainMenu().find(e => e && e.label === 'Aide et signalements')?.sub?.().find(e => e && e.label === 'Signalements'); const r = { dot: document.getElementById('bMenu').classList.contains('repdot'), item: !!b, badge: b?.querySelector('.mbadge')?.textContent || '', kbd: sub?.key || '' }; document.getElementById('menu').classList.remove('on'); return r; });
  ok('menu : « Aide et signalements » avec pastille rouge, « Signalements » (Alt+Maj+I) dedans ; point rouge sur le bouton du menu', dot.item && dot.badge === '1' && dot.dot && /Alt\+Maj\+I/.test(dot.kbd), dot);

  // 2) Alt+Maj+I : nouveau signalement, la page Paramètres → Signalements s'ouvre dessus
  await UI(() => onKey('I', false, true, true));
  await wait(3000);
  const p1 = await PG(() => new Promise(r => setTimeout(() => r({ box: !!document.getElementById('repBox'), open: !!document.querySelector('#repBox [data-rk="msg"]'), chips: document.querySelectorAll('#repBox [data-rph]').length, hash: location.hash }), 800)));
  ok('Alt+Maj+I ouvre Paramètres → Signalements sur un nouveau signalement', p1 && p1.box && p1.open, p1);
  // section Téléchargements, phrase prête, puis envoi
  const p2 = await PG(async () => {
    const s = document.querySelector('#repBox [data-rk="section"]'); s.value = 'downloads'; s.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));
    const chip = [...document.querySelectorAll('#repBox [data-rph]')].find(b => /ne démarre pas/.test(b.dataset.rph)); chip.click();
    await new Promise(r => setTimeout(r, 600));
    return { msg: document.querySelector('#repBox [data-rk="msg"]').value, title: document.querySelector('#repBox [data-rk="title"]').value };
  });
  ok('phrases prêtes par section : la phrase remplit le message et le titre', /ne démarre pas/.test(p2.msg) && /ne démarre pas/.test(p2.title), p2);
  await PG(async () => { document.querySelector('#repBox [data-rk="msg"]').value += '\nPièce jointe de messagerie.'; document.querySelector('#repBox [data-rsend]').click(); await new Promise(r => setTimeout(r, 1500)); return true; });
  const s1 = await M(R => { const x = R.list.find(y => y.section === 'downloads'); return { u: global.__opened.slice(-1)[0] || '', st: x?.state, msg: x?.msg }; });
  const U = s1.u ? new URL(s1.u) : null;
  ok('« Valider et envoyer » ouvre la page GitHub préremplie (code, section, message)', U && U.searchParams.get('template') === 'rapport.yml' && /^\[R-[0-9A-F]{4}\] \[Téléchargements\]/.test(U.searchParams.get('title')) && /Pièce jointe/.test(U.searchParams.get('what')) && /Signature : /.test(U.searchParams.get('report')) && s1.st === 'sent', { t: U && U.searchParams.get('title'), st: s1.st });

  // 3) hors connexion : validé → en attente ; la connexion revient → envoi après le clic
  const q = await M(async R => {
    R.online = () => false;
    const x = await R.add({ kind: 'bug', title: 'hors ligne', msg: 'essai', sig: 'off1' });
    const r1 = await R.send(x.id); const st1 = R.get(x.id).state;
    R.online = () => true; const n = await R.sendQueued();
    return { r1, st1, n, st2: R.get(x.id).state };
  });
  ok('hors connexion : « En attente d\'internet », puis envoyé quand la connexion revient', q.r1.queued && q.st1 === 'queued' && q.n === 1 && q.st2 === 'sent', q);

  // 4) suivi : réponse lue sur GitHub, puis « Corrigé dans la 1.7.3 »
  const t1 = await M(async R => {
    const x = R.list.find(y => y.section === 'downloads');
    global.__gh.issues = [{ number: 42, title: `[${x.code}] [Téléchargements] essai`, html_url: 'https://github.com/DrYAE-FPA/DrYAE/issues/42', user: { login: 'quelquun' }, comments: 1, state: 'open', labels: [], body: 'Signature : ' + x.sig }];
    global.__gh.comments['42'] = [{ user: { login: 'DrYAE-FPA' }, created_at: new Date().toISOString(), body: 'Merci ! Quel fichier ?' }];
    R._iss = null; const r = await R.check(true); const y = R.get(x.id);
    return { r, st: y.state, issue: y.issue, unread: y.unread, c: R.counts(), rep: (y.replies || [])[0]?.body };
  });
  ok('réponse trouvée sur GitHub : « Réponse reçue », numéro #42, pastille « Nouvelle réponse »', t1.st === 'answered' && t1.issue === 42 && t1.unread && t1.c.answers === 1 && /Quel fichier/.test(t1.rep), t1);
  const t2 = await M(async R => {
    const x = R.list.find(y => y.issue === 42);
    global.__gh.issues[0].state = 'closed'; global.__gh.issues[0].state_reason = 'completed'; global.__gh.issues[0].comments = 2;
    global.__gh.comments['42'].push({ user: { login: 'DrYAE-FPA' }, created_at: new Date().toISOString(), body: 'Corrigé dans la 1.7.3.' });
    R._iss = null; await R.check(true); const y = R.get(x.id); const v = R.view().list.find(z => z.id === x.id);
    return { st: y.state, fixedIn: y.fixedIn, here: v.fixedHere };
  });
  ok('signalement fermé : « Corrigé dans la 1.7.3 » (mise à jour à venir)', t2.st === 'fixed' && t2.fixedIn === '1.7.3' && t2.here === false, t2);

  // 4 bis) le créateur de DrYAE répond depuis le même compte que le signalement : la réponse et la version comptent
  const t3 = await M(async R => {
    const x = await R.add({ kind: 'bug', title: 'meme compte', msg: 'm', sig: 'own1' }); await R.send(x.id);
    global.__gh.issues.unshift({ number: 60, title: `[${x.code}] [Autre] meme compte`, html_url: 'u', user: { login: 'DrYAE-FPA' }, comments: 1, state: 'closed', state_reason: 'completed', labels: [], body: '' });
    global.__gh.comments['60'] = [{ user: { login: 'DrYAE-FPA' }, created_at: new Date().toISOString(), body: 'Corrigé dans la 1.7.2 (mise à jour du 24 novembre 2026).' }];
    R._iss = null; await R.check(true); const y = R.get(x.id); return { st: y.state, fixedIn: y.fixedIn, here: R.view().list.find(z => z.id === x.id).fixedHere };
  });
  ok('réponse du créateur depuis le même compte : « Corrigé dans la 1.7.2 » (déjà installée)', t3.st === 'fixed' && t3.fixedIn === '1.7.2' && t3.here === true, t3);

  // 5) doublon : la même erreur déjà signalée par quelqu'un d'autre
  const d = await M(async R => {
    const x = await R.add({ kind: 'bug', title: 'dup', msg: 'm', sig: 'abcabcabcabc' });
    global.__gh.issues.push({ number: 50, title: '[R-0000] [Autre] dup', html_url: 'https://github.com/DrYAE-FPA/DrYAE/issues/50', user: { login: 'autre' }, comments: 0, state: 'open', labels: [], body: 'Signature : abcabcabcabc' });
    R._iss = null; const dp = await R.dup(x.id); await R.comment(x.id, dp.number, ''); const y = R.get(x.id);
    return { dp, issue: y.issue, st: y.state, u: global.__opened.slice(-1)[0] };
  });
  ok('doublon repéré : « Ajouter mon cas » ouvre le signalement existant (#50)', d.dp && d.dp.number === 50 && d.issue === 50 && d.st === 'sent' && /issues\/50/.test(d.u), d);

  // 6) traduction de scan : gardée dans la boîte, section Traducteur de scans
  const tr = await app.evaluate(async ({ ipcMain }) => { const h = ipcMain._invokeHandlers?.get?.('scan:report'); return h ? h({}, { text: 'WHERE ARE YOU GOING?', tr: 'OÙ VAS-TU ?', from: 'en', to: 'fr' }) : '__none'; });
  const tr2 = await M(R => { const x = R.list.find(y => y.kind === 'translation'); return x && { section: x.section, msg: x.msg.slice(0, 80) }; });
  ok('« Signaler cette traduction » : gardé dans Signalements (Traducteur de scans)', tr === 'kept' && tr2 && tr2.section === 'scans', { tr, tr2 });

  // 7) capture et adresse : jointes seulement si cochées ; rapport : une ligne retirée
  const sh = await M(async R => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const x = await R.add({ kind: 'bug', title: 'capture', msg: 'm', page: 'https://exemple.test/page?id=3', shot: jpg, report: 'ligne A\nligne B\nligne C', sig: 'shot1' });
    const u1 = R.url(R.get(x.id));
    R.update(x.id, { pageOn: false, dropLines: [1] });
    const u2 = R.url(R.get(x.id));
    return { shotOn: x.shotOn, file: !!x.shot, p1: decodeURIComponent(u1).includes('Page : https://exemple.test/page?id=3'), p2: decodeURIComponent(u2).includes('Page : '), b: decodeURIComponent(u2).includes('ligne B'), cap: /Ctrl\+V/.test(decodeURIComponent(u1)) };
  });
  ok('adresse de la page jointe si cochée, retirée sinon ; ligne du rapport retirée ; capture rappelée (Ctrl+V)', sh.file && sh.shotOn && sh.p1 && !sh.p2 && !sh.b && sh.cap, sh);

  // 8) téléchargement que DrYAE ne peut pas faire (session du site) : relancé une fois par le navigateur
  const nf = await app.evaluate(async (_el, root) => {
    const { WebBrowser } = process.mainModule.require(root + '/src/main/browser.js');
    const calls = []; const fake = { _fromBr: new Map([['https://mail.exemple.test/att?id=1', { url: 'https://mail.exemple.test/att?id=1', ses: { downloadURL: u => calls.push(u) }, t: Date.now() }]]) };
    const a = WebBrowser.prototype.nativeFallback.call(fake, { url: 'https://mail.exemple.test/att?id=1' });
    const b = WebBrowser.prototype.nativeFallback.call(fake, { url: 'https://mail.exemple.test/att?id=1' });
    return { a, b, calls, bypass: [...(fake._bypass || [])] };
  }, ROOT);
  ok('téléchargement refusé à DrYAE : relancé une seule fois par le navigateur', nf.a === true && nf.b === false && nf.calls.length === 1 && nf.bypass.length === 1, nf);

  // 8 bis) pièce jointe de messagerie : l'objet du téléchargement est détruit pendant l'attente des cookies
  const ic = await app.evaluate(async (_el, root) => {
    const { WebBrowser } = process.mainModule.require(root + '/src/main/browser.js');
    let dead = false, got = null;
    const item = { getURL: () => 'https://mail.exemple.test/att?id=2', getFilename: () => 'piece.pdf', getMimeType: () => 'application/pdf', getTotalBytes: () => { if (dead) throw new Error('DownloadItem used after being destroyed'); return 12345; } };
    const fake = { modOn: () => true, cookieHeader: async () => { dead = true; return 'SID=1'; }, quickFile: o => { got = o; }, ua: () => 'ua' };
    let err = null; try { await WebBrowser.prototype.interceptDownload.call(fake, { preventDefault() {} }, item, null, {}); } catch (e) { err = e.message; }
    return { err, got: got && { size: got.size, name: got.name, cookie: got.headers.Cookie } };
  }, ROOT);
  ok('pièce jointe : plus d\'erreur « DownloadItem used after being destroyed », le téléchargement part', !ic.err && ic.got && ic.got.size === 12345 && ic.got.cookie === 'SID=1', ic);
  // 8 ter) adresse GitHub courte (sinon « Whoops, something went wrong! » avec un compte connecté) ; rapport complet copié
  const lg = await M(async R => {
    const long = Array.from({ length: 500 }, (_, i) => 'ligne ' + i + ' ' + 'y'.repeat(50)).join('\n');
    const x = await R.add({ kind: 'bug', title: 'promesse: Error: essai long', msg: 'message', report: long, sig: 'long1' });
    const b = R.build(R.get(x.id)); return { len: b.url.length, cut: b.cut, last: decodeURIComponent(b.url).includes('ligne 499'), sig: decodeURIComponent(b.url).includes('Signature : long1'), note: /Ctrl\+V/.test(decodeURIComponent(b.url)) };
  });
  ok('adresse GitHub courte (≤ 2800), garde la signature et les dernières lignes, rapport complet copié', lg.len <= 2800 && lg.cut && lg.last && lg.sig && lg.note, lg);

  // 9) page : liste, états, tout effacer
  const p3 = await PG(() => new Promise(r => setTimeout(() => r({ items: document.querySelectorAll('#repBox [data-rid]').length, tags: [...document.querySelectorAll('#repBox .tag')].map(t => t.textContent) }), 1200)));
  ok('page Signalements : la liste avec les états (Corrigé, À envoyer…)', p3.items >= 5 && p3.tags.some(t => /Corrigé/.test(t)) && p3.tags.some(t => /À envoyer/.test(t)), p3);
  await app.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
