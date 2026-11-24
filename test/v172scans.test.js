// 1.7.2 : Traducteur de scans — tutoiement, honorifiques, notes « NB » traduites et crédits gardés, couleur de la gomme,
// zones d'écriture partagées entre bulles voisines, coupures de mots, scans traduits sur le PC, arrêt du travail en cours,
// et au démarrage : la page d'accueil (les anciens onglets seulement si on l'a choisi soi-même)
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 400) : '');

// fonctions de mise en page des bulles (dans le script de la page), essayées seules
function layout() {
  const s = fs.readFileSync(ROOT + '/src/browser/page-preload.js', 'utf8');
  const a = s.indexOf('  function scanZones(it)'), b = s.indexOf('  // couleur du texte lisible');
  const m = { exports: {} };
  new Function('module', s.slice(a, b) + '\nmodule.exports = { scanZones, hyphenate, fitCanvas };')(m);
  return m.exports;
}

async function launch(name, settings) {
  const HOME = '/tmp/claude-0/uihome-' + name; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify(settings));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, DRYAE_SCAN_TR: '', HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  return { app, file: HOME + '/.config/DrYAE/settings.json' };
}
const close = app => Promise.race([app.close(), new Promise(r => setTimeout(r, 4000))]);

(async () => {
  // ---- mise en page (sans DrYAE) ----
  const L = layout();
  const hy = L.hyphenate('MAINTENANT JE COMPRENDS', 'fr');
  ok('coupures de syllabes dans les longs mots français (« MAIN-TE-NANT »)', hy.split('­').length >= 3 && hy.replace(/­/g, '') === 'MAINTENANT JE COMPRENDS', hy.replace(/­/g, '|'));
  ok('pas de coupures inventées pour l\'arabe', L.hyphenate('maintenant', 'ar') === 'maintenant');
  // deux bulles côte à côte dans une case : leurs zones agrandies ne se chevauchent plus
  const it = { blocks: [{ x0: 10, y0: 10, x1: 60, y1: 40, bubble: { x0: 0, y0: 0, x1: 140, y1: 60 } }, { x0: 90, y0: 12, x1: 150, y1: 42, bubble: { x0: 70, y0: 0, x1: 220, y1: 60 } }] };
  const Z = L.scanZones(it);
  ok('deux bulles voisines : zones d\'écriture partagées, sans chevauchement', Z[0][2] <= Z[1][0] && Z[0][2] >= 60 && Z[1][0] <= 90, Z);
  const ctx = { font: '', measureText: t => ({ width: t.length * parseFloat(ctx.font.split(' ')[1]) * 0.6 }) };
  const f0 = L.fitCanvas(ctx, 'MAINTENANT EXTRAORDINAIREMENT', 60, 60, 'x', 24, 5, 'fr');
  ok('enregistrement : un mot trop long est coupé à une syllabe plutôt que d\'écrire minuscule', f0.size > 8 && f0.lines.some(l => /-$/.test(l)), f0);
  const f1 = L.fitCanvas(ctx, 'Salut toi', 60, 60, 'x', 24, 5, 'fr');
  ok('enregistrement : un texte court n\'est jamais coupé', f1.lines.every(l => !/-$/.test(l)) && f1.size > 15, f1);

  // ---- fonctions de DrYAE ----
  const { app } = await launch('v172scans', { lang: 'fr', langChosen: true, startView: 'manager' });
  const r = await app.evaluate(async ({ app: _a }, root) => {
    const rq = process.mainModule.require;
    const T = rq(root + '/src/main/tutoie.js'), M = rq(root + '/src/main/modules.js'), SF = rq(root + '/src/main/scan-fix.js'), P = rq(root + '/src/main/paddle-ocr.js'), OP = rq(root + '/src/main/ocr-pool.js');
    const tu = [['Vous êtes fou ! Attendez-moi !', 'You are crazy! Wait for me!'], ['Vous êtes tous fous.', 'You guys are all crazy.'], ['Où allez-vous ?', 'Where are you going?'], ['Taisez-vous !', 'Shut up!'], ['Votre épée est cassée.', 'Your sword is broken.']].map(([f, e]) => T.toTu(f, e));
    const hon = ['KAITO-SAN, WAIT!', 'Thank you, Rin-sama.', 'ONII-CHAN!', 'Good morning, sensei.'].map(M.honorifics);
    const rule = ['NB : le mana est l\'énergie magique', 'T/N: onigiri = rice ball', 'discord.gg/team', 'TRANSLATOR: Bob REDRAW: Joe', 'WHAT ARE YOU DOING?'].map(t => SF.outsideRule(t, {}));
    // gomme : couleur du fond prise autour des lettres (bulle crème, lettres noires)
    const W = 40, H = 30, d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { d[i * 4] = 240; d[i * 4 + 1] = 230; d[i * 4 + 2] = 200; d[i * 4 + 3] = 255; }
    for (let y = 10; y < 20; y++) for (let x = 10; x < 30; x++) { const q = (y * W + x) * 4; d[q] = d[q + 1] = d[q + 2] = 0; }
    const bg = P.ringBg({ width: W, height: H, data: d }, { x0: 10, y0: 10, x1: 30, y1: 20, lh: 10 });
    let cancel = 'ok'; try { OP.cancel(12345); } catch (e) { cancel = e.message; }
    return { tu, hon, rule, bg, cancel };
  }, ROOT);
  ok('tutoiement : « Vous êtes fou ! Attendez-moi ! » → « Tu es fou ! Attends-moi ! »', r.tu[0] === 'Tu es fou ! Attends-moi !', r.tu[0]);
  ok('tutoiement : « vous » gardé pour un groupe (« you guys »)', r.tu[1] === 'Vous êtes tous fous.', r.tu[1]);
  ok('tutoiement : question inversée « Où allez-vous ? » → « Où vas-tu ? »', r.tu[2] === 'Où vas-tu ?', r.tu[2]);
  ok('tutoiement : « Taisez-vous ! » → « Tais-toi ! »', r.tu[3] === 'Tais-toi !', r.tu[3]);
  ok('tutoiement : « Votre épée » → « Ton épée »', r.tu[4] === 'Ton épée est cassée.', r.tu[4]);
  ok('honorifiques traduits (-SAN retiré, -SAMA, ONII-CHAN, SENSEI)', r.hon[0] === 'KAITO, WAIT!' && /lord Rin/i.test(r.hon[1]) && r.hon[2] === 'BIG BROTHER!' && /teacher/.test(r.hon[3]), r.hon);
  ok('notes pour le lecteur (« NB : », « T/N : ») toujours traduites', r.rule[0] === 'note' && r.rule[1] === 'note', r.rule);
  ok('crédits et adresses (Discord) laissés en original ; une réplique normale est traduite', r.rule[2] === 'keep' && r.rule[3] === 'keep' && r.rule[4] === null, r.rule);
  ok('gomme : couleur de la bulle crème (pas celle des lettres, pas du blanc pur)', r.bg === 'rgb(240,230,200)', r.bg);
  ok('arrêt du traducteur : l\'arrêt du travail en cours ne plante pas', r.cancel === 'ok', r.cancel);
  // 1.7.2 : aider à améliorer DrYAE (accord demandé, signalement prérempli que l'utilisateur envoie lui-même)
  const br = await app.evaluate(async ({ dialog, shell }, root) => {
    const rq = process.mainModule.require, BR = rq(root + '/src/main/bugreport.js'), LOG = rq(root + '/src/main/log.js');
    const opened = [], boxes = [];
    shell.openExternal = async u => { opened.push(u); };
    dialog.showMessageBox = async (...a) => { boxes.push((a[1] || a[0]).message); return { response: 0 }; };
    const kept = await BR.translation({ text: 'WHERE ARE YOU GOING?', tr: 'OÙ ALLEZ-VOUS ?', from: 'en', to: 'fr' });
    const R = rq(root + '/src/main/reports.js').Reports.last; const tr = R.url(R.get(kept.id));
    const long = BR.issueUrl('bug.yml', 'x', { what: 'a', report: Array.from({ length: 3000 }, (_, i) => 'ligne ' + i).join('\n') });
    return { tr, longLen: long.length, longOk: /report=/.test(long), hook: typeof LOG.onError, opened: opened.length, boxes };
  }, ROOT);
  ok('signalement de traduction : gardé dans Signalements, puis GitHub prérempli (texte lu et traduction, pas d\'adresse de page)', /issues\/new\?template=traduction\.yml/.test(br.tr) && /what=/.test(br.tr) && decodeURIComponent(br.tr).includes('WHERE ARE YOU GOING?') && !/https?%3A/.test(br.tr.split('?')[1]), br.tr.slice(0, 160));
  ok('signalement : un long journal est raccourci (adresse acceptée par GitHub)', br.longLen <= 7000 && br.longOk, br.longLen);
  ok('erreurs du journal reliées au signalement', br.hook === 'function');
  const pre = fs.readFileSync(ROOT + '/src/browser/page-preload.js', 'utf8');
  const mr = pre.slice(pre.indexOf('  const misread = '), pre.indexOf('  const lexCommon'));
  const misread = new Function(mr + '\nreturn misread;')();
  ok('lexique : « MANIA → MANA » signalé comme mot mal lu, pas « ONIGIRI → boulette de riz »', misread('MANIA', 'MANA') && !misread('ONIGIRI', 'boulette de riz'), [misread('MANIA', 'MANA'), misread('ONIGIRI', 'boulette de riz')]);
  ok('réglage « Aider à améliorer DrYAE » dans Paramètres → Système', /row\('Aider à améliorer DrYAE'/.test(fs.readFileSync(ROOT + '/src/pages/settings.js', 'utf8')));
  // traduction des scans toujours sur le PC, même si Google est choisi dans les réglages
  const src = fs.readFileSync(ROOT + '/src/main/browser.js', 'utf8');
  ok('scans : traduction forcée sur le PC (rien n\'est envoyé)', /scanTr\(\)[^\n]*provider: 'local'/.test(src) && /ipcMain\.handle\('scan:cancel'/.test(src));
  await close(app);

  // ---- au démarrage : page d'accueil par défaut ----
  const a1 = await launch('v172start1', { lang: 'fr', langChosen: true, startView: 'browser', restoreSession: true, browser: { startup: 'restore' } });
  await new Promise(r => setTimeout(r, 1500)); await close(a1.app);
  const s1 = JSON.parse(fs.readFileSync(a1.file, 'utf8'));
  ok('ancien réglage par défaut « rouvrir les onglets » → page d\'accueil', s1.browser.startup === 'newtab' && s1.restoreSession === false, { startup: s1.browser.startup, restore: s1.restoreSession });
  const a2 = await launch('v172start2', { lang: 'fr', langChosen: true, startView: 'browser', restoreSession: true, browser: { startup: 'restore', startupChosen: true } });
  await new Promise(r => setTimeout(r, 1500)); await close(a2.app);
  const s2 = JSON.parse(fs.readFileSync(a2.file, 'utf8'));
  ok('« rouvrir les onglets » choisi soi-même : gardé', s2.browser.startup === 'restore' && s2.restoreSession === true, { startup: s2.browser.startup, restore: s2.restoreSession });
  process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
