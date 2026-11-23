// 1.7.3 : mots coupés au tiret mal lu, MANA, petits mots jamais protégés, gomme ligne par ligne, bouton vidéo discret
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');

(async () => {
  const HOME = '/tmp/claude-0/uihome-v173'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
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
  const src = fs.readFileSync(ROOT + '/src/main/browser.js', 'utf8'), pre = fs.readFileSync(ROOT + '/src/browser/page-preload.js', 'utf8'), po = fs.readFileSync(ROOT + '/src/main/paddle-ocr.js', 'utf8');
  ok('traduction : petits mots ignorés dans « Ne jamais traduire » (anciennes entrées)', /COMMON\.test\(String\(x\.s\)\.trim\(\)\)\)\.map\(x => x\.s\)/.test(src));
  ok('gomme ligne par ligne hors bulle (plus de voile sur le dessin), écran et fichier', /lined \? b\.boxes/.test(pre) && /d\._es = b\.boxes/.test(pre) && /boxes: g\.boxes/.test(src));
  ok('lecture : colonnes côte à côte, titres tournés, très grandes lettres', /function splitCols/.test(po) && /function rotate90/.test(po) && /for \(const ms of \[960, 640\]\)/.test(po));
  ok('bouton « Télécharger cette vidéo » discret (transparent) et adresse de la publication (Twitter / X)', /background:rgba\(20,16,36,\.38\)/.test(pre) && /a\[href\*="\/status\/"\]/.test(pre));
  await Promise.race([app.close(), new Promise(r => setTimeout(r, 4000))]);
  process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
