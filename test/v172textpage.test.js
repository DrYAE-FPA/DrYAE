// 1.7.2 : « mise en page fidèle » des pages de texte : morceaux d'une même ligne coupés par un fond de deux couleurs
// (silhouette derrière le texte) remis dans l'ordre, paragraphes par taille et couleur, fond reconstruit sous chaque ligne
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
(async () => {
  const HOME = '/tmp/claude-0/uihome-v172tp'; fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME + '/.config/DrYAE', { recursive: true });
  fs.writeFileSync(HOME + '/.config/DrYAE/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  const app = await _electron.launch({ args: ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  await app.firstWindow();
  const r = await app.evaluate(async ({ nativeImage }, root) => {
    const TP = process.mainModule.require(root + '/src/main/textpage.js');
    // page 600×500 : fond gris, silhouette bleue à droite ; 3 lignes rouges (grandes), 2 lignes noires (petites)
    const W = 600, H = 500, bm = Buffer.alloc(W * H * 4);
    const set = (x0, y0, x1, y1, [r, g, b]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; bm[i] = b; bm[i + 1] = g; bm[i + 2] = r; bm[i + 3] = 255; } };
    set(0, 0, W, H, [184, 184, 184]); set(330, 0, W, H, [187, 228, 241]);
    const red = [246, 2, 2], blk = [10, 10, 10];
    const L = [[20, 40, 70, red], [20, 90, 120, red], [20, 140, 170, red], [20, 220, 236, blk], [20, 240, 256, blk]];
    for (const [x, y0, y1, c] of L) for (let k = 0; k < 10; k++) set(x + k * 55, y0 + 3, x + k * 55 + 40, y1 - 3, c);
    // morceaux lus dans le désordre, rangés en deux groupes selon la couleur du fond (comme la lecture le fait)
    const words = [['THIS IS A', 'FREE WORK'], ['FOR THE', 'FANS BY'], ['THE FANS', 'PLEASE'], ['Support the', 'authors.'], ['Thank', 'you!']];
    const left = { parts: [], boxes: [] }, right = { parts: [], boxes: [] };
    L.forEach(([x, y0, y1], i) => { left.parts.push(words[i][0]); left.boxes.push([15, y0, 320, y1]); right.parts.push(words[i][1]); right.boxes.push([335, y0, 580, y1]); });
    const gs = [{ ...right, x0: 335, y0: 40, x1: 580, y1: 256, text: right.parts.join(' ') }, { ...left, x0: 15, y0: 40, x1: 320, y1: 256, text: left.parts.join(' ') }];
    for (let i = 0; i < 4; i++) gs.push({ parts: ['x' + i], boxes: [[10, 300 + i * 30, 40, 320 + i * 30]], x0: 10, y0: 300 + i * 30, x1: 40, y1: 320 + i * 30, text: 'word word word word word word word word word word ' + i });
    const out = TP.relayout(gs, { width: W, height: H, data: bm }, nativeImage);
    const P = out.filter(g => g.layout === 'lines');
    return P.map(g => ({ text: g.text, n: g.slots.length, ink: g.slots[0].ink, bg: g.slots[0].bg, patch: !!(g.slots[0].patch && /^data:image\/png/.test(g.slots[0].patch.src)) }));
  }, ROOT);
  const red = r.find(p => /THIS/.test(p.text)), blk = r.find(p => /Support/.test(p.text));
  ok('lignes coupées par le fond remises dans l\'ordre (paragraphe rouge)', red && red.text === 'THIS IS A FREE WORK FOR THE FANS BY THE FANS PLEASE' && red.n === 3, r);
  ok('autre taille et autre couleur : autre paragraphe', blk && blk.text === 'Support the authors. Thank you!' && blk.n === 2, blk);
  ok('couleur de l\'encre gardée (rouge / noir)', red && /^#f[0-9a-f]0[0-9a-f]0[0-9a-f]$/.test(red.ink) && blk && /^#0[0-9a-f]0[0-9a-f]0[0-9a-f]$/.test(blk.ink), [red && red.ink, blk && blk.ink]);
  ok('fond reconstruit sous chaque ligne (image)', red && red.patch && blk && blk.patch);
  await app.close(); process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
