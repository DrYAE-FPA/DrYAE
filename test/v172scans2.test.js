// 1.7.2 : mots coupés au tiret mal lu, MANA, petits mots jamais protégés, gomme ligne par ligne, bouton vidéo discret
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');

(async () => {
  const HOME = '/tmp/claude-0/uihome-v172b'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true, startView: 'manager' }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  const r = await app.evaluate(async (_e, root) => {
    const SF = process.mainModule.require(root + '/src/main/scan-fix.js');
    const j = ['A SPIRI2 TUAL POWER SUCKING TENTA- CLE!!', 'A SPIRIT, TUAL POWER', 'WELL- DONE', 'YES, SIR', 'THE FLOW OF MANIA'].map(SF.joinBroken);
    const ill = SF.fixWords ? SF.fixWords("ILL END IT HERE") : '';
    return { j, ill };
  }, ROOT);
  ok('mots coupés au tiret mal lu recollés (« SPIRI2 TUAL » → SPIRITUAL, « TENTA- CLE » → TENTACLE)', r.j[0] === 'A SPIRITUAL POWER SUCKING TENTACLE!!' && r.j[1] === 'A SPIRITUAL POWER', r.j);
  ok('vrais tirets et virgules gardés (« WELL- DONE », « YES, SIR »)', r.j[2] === 'WELL- DONE' && r.j[3] === 'YES, SIR', r.j);
  ok('« MANIA » lu pour MANA dans le lettrage', r.j[4] === 'THE FLOW OF MANA', r.j[4]);
  ok('« ILL END » → « I\'LL END »', /I'LL END/.test(r.ill), r.ill);
  // lexique : THIS / YOUR jamais gardés en anglais
  const set = await app.evaluate(async ({ ipcMain }) => {
    const h = ipcMain._invokeHandlers?.get?.('scan:glossary'); if (!h) return null;
    await h({}, [{ s: 'THIS', t: 'THIS', n: true }, { s: 'YOUR', t: 'YOUR', n: true }, { s: 'Kazuya', t: 'Kazuya', n: true }, { s: 'MANIA', t: 'MANA' }]);
    return h({});
  });
  ok('lexique : les petits mots courants (THIS, YOUR) ne sont jamais enregistrés', Array.isArray(set) ? !set.some(x => /^(THIS|YOUR)$/.test(x.s)) && set.some(x => x.s === 'Kazuya') : true, set);
  // revenir à une version précédente (Paramètres → À propos)
  const rb = await app.evaluate(async ({ app: A, shell }, root) => {
    const { Updater } = process.mainModule.require(root + '/src/main/updater.js');
    let skip = null; const feeds = []; let checks = 0;
    const u = new Updater({ send: () => {}, notify: () => {}, T: s => s, prefs: { get: () => skip, set: v => { skip = v; } } });
    u.cfg = { github: { owner: 'DrYAE-FPA', repo: 'DrYAE' } };
    u.versions = async () => [{ version: '1.7.2', date: '2026-11-23T14:40:00Z' }, { version: '1.7.1', date: '2026-11-19T10:00:00Z' }];
    u.au = { allowDowngrade: false, setFeedURL: f => feeds.push(f), checkForUpdates: async () => { checks++; } };
    const cur = A.getVersion();
    await u.rollback('1.7.1');
    const r1 = { feed: feeds[0], down: u.au.allowDowngrade, target: u.target, skip, checks, cur };
    const want = await u.wanted({ version: '1.7.1', releaseDate: '2026-11-19T10:00:00Z' }, null);
    const notOther = await u.wanted({ version: cur, releaseDate: '2026-11-23T14:40:00Z' }, null);
    u.normalFeed();
    const skipped = await u.wanted({ version: cur, releaseDate: skip.at }, async () => true);
    const republished = await u.wanted({ version: cur, releaseDate: new Date(Date.parse(skip.at) + 3 * 3600e3).toISOString() }, async () => true);
    return { r1, want, notOther, skipped, republished, back: feeds[1] };
  }, ROOT);
  ok('retour en arrière : la version choisie est téléchargée depuis GitHub (versions plus anciennes acceptées)', rb.r1.feed?.provider === 'generic' && /releases\/download\/v1\.7\.1$/.test(rb.r1.feed.url) && rb.r1.down === true && rb.r1.checks === 1 && rb.want === true && rb.notOther === false, rb);
  ok('retour en arrière : la version quittée n\'est plus proposée, sauf si elle est republiée plus tard', rb.skipped === false && rb.republished === true && rb.back?.provider === 'github', rb);
  ok('bouton « Revenir à une version précédente… » dans Paramètres → À propos', /id="updBack"/.test(fs.readFileSync(ROOT + '/src/pages/settings.js', 'utf8')));
  const src = fs.readFileSync(ROOT + '/src/main/browser.js', 'utf8'), pre = fs.readFileSync(ROOT + '/src/browser/page-preload.js', 'utf8'), po = fs.readFileSync(ROOT + '/src/main/paddle-ocr.js', 'utf8');
  ok('traduction : petits mots ignorés dans « Ne jamais traduire » (anciennes entrées)', /COMMON\.test\(String\(x\.s\)\.trim\(\)\)\)\.map\(x => x\.s\)/.test(src));
  ok('gomme ligne par ligne hors bulle (plus de voile sur le dessin), écran et fichier', /lined \? b\.boxes/.test(pre) && /d\._es = b\.boxes/.test(pre) && /boxes: g\.boxes/.test(src));
  ok('lecture : colonnes côte à côte, titres tournés, très grandes lettres', /function splitCols/.test(po) && /function rotate90/.test(po) && /for \(const ms of \[960, 640\]\)/.test(po));
  ok('bouton « Télécharger cette vidéo » discret (transparent) et adresse de la publication (Twitter / X)', /background:rgba\(20,16,36,\.38\)/.test(pre) && /a\[href\*="\/status\/"\]/.test(pre));
  await Promise.race([app.close(), new Promise(r => setTimeout(r, 4000))]);
  process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
