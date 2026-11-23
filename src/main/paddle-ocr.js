// DrYAE — lecture du texte des images (traducteur de scans) avec les modèles PP-OCRv5 (PaddleOCR, Apache-2.0)
// exécutés sur le PC par ONNX Runtime (version WebAssembly, sans programme à installer).
// 1) détection : une carte de probabilité « texte » → rectangles de lignes ;
// 2) lecture : chaque ligne est lue par un modèle multilingue (français, anglais, espagnol, allemand…, japonais, chinois).
// La langue n'a pas besoin d'être choisie : le service de traduction la reconnaît ensuite.
const fs = require('fs');
const path = require('path');

let ort = null, det = null, rec = null, dict = null, loading = null;
const MODELS = () => path.dirname(require.resolve('pdfmarkdown-ppocrv5-models/package.json'));
const crypto = require('crypto');

// ---- modèles de lecture supplémentaires (PaddleOCR PP-OCRv5, Apache-2.0), téléchargés la première fois ----
// coréen, cyrillique, arabe, thaï, devanagari : écritures que le modèle multilingue ne lit pas
const EXTRA = {
  // 1.7.0 : langues latines (anglais, français, espagnol, portugais…) : moins de confusions U/L, G/6 que le modèle « toutes langues »
  latin: { label: 'Langues latines (anglais, français, espagnol, portugais…)', size: 8066518, sha: '497dbed20b7fd86334c9deb5082c2958982a316bb16e3589ebc6502cd85cae79', dsha: '7274e68c7675355e45dd75c360c83faa0d0624de33a704c799a7da8897662201' },
  korean: { label: 'Coréen', size: 13443278, sha: 'ee0dfde503d787c91fd0455daae2eb85311b4b5bdcddf85a54d8c1e0adc157de', dsha: 'a3792cbb41215a43e555e16ff4a7f7b18db5dd80cd058637098f0d872f2dd9d6' },
  eslav: { label: 'Russe, ukrainien, biélorusse', size: 7912122, sha: 'bb86cdbd09c21d6bd73c0c0d5dc50379a6f94fc0078f7200a192ed1087f3e6ac', dsha: '1bbd3d43860503821debcbba74fe9bf3f9e42caf50dcf6d2f5365d7f75769c91' },
  cyrillic: { label: 'Autres langues cyrilliques (bulgare, serbe…)', size: 8073294, sha: '0d91040605ef7bdca6868fad6cad1664840d031e9f6d40d54607df5b50fa280a', dsha: '90822a96058eb83f8e637ace75f90cbd36c41253f9dbdfb88fcf5a2bdd50d669' },
  arabic: { label: 'Arabe, persan, ourdou', size: 8023442, sha: 'b58f7d1cc7200566aae1d56ac26c17942881958ed100ac5a07d9a6e67150cbef', dsha: 'f6b5baf1335408e6e1fb5cc6e8268a26769f549c2bb37268e72a6804fe269b4c' },
  th: { label: 'Thaï', size: 7915510, sha: '6f07aa2af58713da04b4bdaf1524588d8051fc734db5a1ad7b7a65c1e7c7ec18', dsha: 'eaacae5cf9b0808d9078ce1152c9ea5c6099d1f563750e66b93c12854acea31a' },
  devanagari: { label: 'Hindi, marathi, népalais', size: 7936806, sha: '932e2d53fafdfd929131c4e20133f49901288e8ec1ba03b18317a4780b21f3ce', dsha: '4bfb5fc511c24da3b1f3a582ae4e07ecd16601997b70b864bb34e111fc646cfe' },
};
// code de langue (traduction) -> modèle
const EXTRA_OF = { ko: 'korean', ru: 'eslav', uk: 'eslav', be: 'eslav', bg: 'cyrillic', sr: 'cyrillic', mk: 'cyrillic', mn: 'cyrillic', kk: 'cyrillic', ar: 'arabic', fa: 'arabic', ur: 'arabic', th: 'th', hi: 'devanagari', mr: 'devanagari', ne: 'devanagari' };
const SOURCES = id => [
  `https://huggingface.co/snowfluke/ppu-paddle-ocr-models/resolve/main/recognition/multi/${id}/v5/`,
  `https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/multi/${id}/v5/`,
];
const DICT_SOURCES = id => [
  `https://huggingface.co/snowfluke/ppu-paddle-ocr-models/resolve/main/recognition/multi/${id}/v5/`,
  `https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main/recognition/multi/${id}/v5/`,
];
let extraDir = '';
function setDir(d) { extraDir = d; }
const files = id => ({ model: path.join(extraDir, `${id}_PP-OCRv5_mobile_rec_infer.onnx`), dict: path.join(extraDir, `ppocrv5_${id}_dict.txt`) });
const installed = () => Object.keys(EXTRA).filter(id => extraDir && fs.existsSync(files(id).model) && fs.existsSync(files(id).dict));
async function fetchVerified(urls, sha, onBytes) {
  const doFetch = (() => { try { return require('electron').net.fetch; } catch { return fetch; } })();
  let last = null;
  for (const u of urls) {
    try {
      const r = await doFetch(u);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const chunks = []; let n = 0; const rd = r.body.getReader();
      for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(Buffer.from(value)); n += value.length; onBytes?.(n); }
      const buf = Buffer.concat(chunks);
      if (crypto.createHash('sha256').update(buf).digest('hex') !== sha) throw new Error('fichier abîmé (empreinte différente)');
      return buf;
    } catch (e) { last = e; }
  }
  throw last || new Error('téléchargement impossible');
}
// téléchargement d'un modèle (avec vérification de l'empreinte SHA-256) ; progress(0…1)
async function download(id, progress) {
  const m = EXTRA[id]; if (!m) throw new Error('Modèle inconnu');
  fs.mkdirSync(extraDir, { recursive: true });
  const f = files(id);
  const dict = await fetchVerified(DICT_SOURCES(id).map(b => b + path.basename(f.dict)), m.dsha);
  const model = await fetchVerified(SOURCES(id).map(b => b + path.basename(f.model)), m.sha, n => progress?.(Math.min(0.99, n / m.size)));
  fs.writeFileSync(f.model + '.tmp', model); fs.renameSync(f.model + '.tmp', f.model);
  fs.writeFileSync(f.dict, dict);
  progress?.(1);
  return true;
}
function removeModel(id) { const f = files(id); for (const x of [f.model, f.dict]) try { fs.rmSync(x, { force: true }); } catch {} }
const recs = new Map();
async function recOf(id) {
  if (!id) return { sess: rec, dict };
  if (recs.has(id)) return recs.get(id);
  const f = files(id);
  const d = fs.readFileSync(f.dict, 'utf8').split(/\r?\n/); if (d[d.length - 1] === '') d.pop(); d.push(' ');
  const r = { sess: await ort.InferenceSession.create(fs.readFileSync(f.model)), dict: d };
  recs.set(id, r); return r;
}

async function load() {
  if (det && rec) return;
  if (loading) return loading;
  loading = (async () => {
    ort = require('onnxruntime-web');
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    const dir = MODELS();
    det = await ort.InferenceSession.create(fs.readFileSync(path.join(dir, 'detection', 'PP-OCRv5_mobile_det_infer.ort')));
    rec = await ort.InferenceSession.create(fs.readFileSync(path.join(dir, 'recognition', 'PP-OCRv5_mobile_rec_infer.onnx')));
    dict = fs.readFileSync(path.join(dir, 'recognition', 'ppocrv5_dict.txt'), 'utf8').split(/\r?\n/);
    if (dict[dict.length - 1] === '') dict.pop();
    dict.push(' ');
  })();
  try { await loading; } finally { loading = null; }
}

// image : { width, height, data: RGBA (Uint8Array / Buffer) }
// --- détection ---
async function detect(img, maxSide = 1280) {
  const { width: W, height: H, data } = img;
  const k = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(32, Math.round(W * k / 32) * 32), h = Math.max(32, Math.round(H * k / 32) * 32);
  const sx = W / w, sy = H / h;
  const t = new Float32Array(3 * w * h);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let y = 0; y < h; y++) {
    const yy = Math.min(H - 1, Math.floor(y * sy));
    for (let x = 0; x < w; x++) {
      const xx = Math.min(W - 1, Math.floor(x * sx)), p = (yy * W + xx) * 4, o = y * w + x;
      // ordre B, G, R (comme à l'entraînement)
      t[o] = (data[p + 2] / 255 - mean[0]) / std[0];
      t[w * h + o] = (data[p + 1] / 255 - mean[1]) / std[1];
      t[2 * w * h + o] = (data[p] / 255 - mean[2]) / std[2];
    }
  }
  const out = await det.run({ [det.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, h, w]) });
  const prob = out[det.outputNames[0]].data;
  // zones connexes au-dessus du seuil
  const seen = new Uint8Array(w * h), boxes = [], stack = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || prob[i] < 0.3) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0, sum = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(), x = j % w, y = (j / w) | 0;
      n++; sum += prob[j];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
      for (const q of nb) if (q >= 0 && !seen[q] && prob[q] >= 0.3) { seen[q] = 1; stack.push(q); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (n < 12 || Math.min(bw, bh) < 3 || sum / n < 0.55) continue;
    // élargissement (la carte est plus étroite que le texte réel)
    const d = (bw * bh * 1.6) / (2 * (bw + bh));
    boxes.push({ x0: Math.max(0, (x0 - d) * sx), y0: Math.max(0, (y0 - d) * sy), x1: Math.min(W, (x1 + 1 + d) * sx), y1: Math.min(H, (y1 + 1 + d) * sy), score: sum / n });
  }
  return boxes;
}

// --- lecture d'une ligne ---
// 1.7.2 : inv = lettres claires sur fond sombre (texte blanc sur noir) lues en négatif ; rot = angle (radians) d'un texte penché
// 1.7.2 : fond sombre autour des lettres ? (médiane de la luminosité du cadre de la ligne)
function darkBg(img, b) {
  const { width: W, height: H, data } = img, x0 = Math.max(0, b.x0 | 0), x1 = Math.min(W - 1, b.x1 | 0), y0 = Math.max(0, b.y0 | 0), y1 = Math.min(H - 1, b.y1 | 0);
  const st = Math.max(1, Math.round(Math.min(x1 - x0, y1 - y0) / 12)); const v = [];
  for (let y = y0; y <= y1; y += st) for (let x = x0; x <= x1; x += st) { const i = (y * W + x) * 4; v.push(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11); }
  if (v.length < 10) return false; v.sort((a, c) => a - c); return v[v.length >> 1] < 90;
}
// 1.7.2 : angle d'un texte penché : celui (entre -30° et 30°) où les rangées de pixels sombres sont les plus nettes
function tiltOf(img, b) {
  const { width: W, height: H, data } = img, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const lum = (x, y) => { x = Math.max(0, Math.min(W - 1, x | 0)); y = Math.max(0, Math.min(H - 1, y | 0)); const i = (y * W + x) * 4; return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11; };
  const score = a => { const co = Math.cos(a), si = Math.sin(a), rows = 24, cols = 48, prof = []; for (let r = 0; r < rows; r++) { let s = 0; const v = (r + 0.5) / rows * bh - bh / 2; for (let c = 0; c < cols; c++) { const u = (c + 0.5) / cols * bw - bw / 2; s += lum(cx + u * co - v * si, cy + u * si + v * co) < 110 ? 1 : 0; } prof.push(s); } const m = prof.reduce((x, y) => x + y, 0) / rows; return prof.reduce((x, y) => x + (y - m) * (y - m), 0); };
  let best = 0, bs = score(0);
  for (const d of [-30, -24, -18, -12, 12, 18, 24, 30]) { const a = d * Math.PI / 180, s = score(a); if (s > bs * 1.25) { bs = s; best = a; } }
  return best;
}
async function recognize(img, b, R, enh, shear, sharp, inv, rot) {
  R = R || { sess: rec, dict };
  const { width: W, data } = img;
  let bw = Math.round(b.x1 - b.x0), bh = Math.round(b.y1 - b.y0);
  if (bw < 4 || bh < 4) return { text: '', score: 0 };
  // colonne verticale (japonais, chinois) : on la tourne pour la lire comme une ligne
  const vertical = bh > bw * 1.5;
  let cw = vertical ? bh : bw, ch = vertical ? bw : bh;
  // 1.7.2 : ligne penchée : longueur et épaisseur réelles de la ligne dans son cadre droit
  // 1.7.3 : titre en lettres latines tourné d'un quart de tour (lu de bas en haut) : colonne lue dans l'autre sens
  const flip = rot === 'flip'; if (flip) rot = 0;
  const co = rot ? Math.cos(rot) : 1, si = rot ? Math.sin(rot) : 0, c2 = co * co - si * si;
  if (rot && !vertical) { const L = (bw * co - bh * Math.abs(si)) / c2, T2 = (bh * co - bw * Math.abs(si)) / c2; if (L > 8 && T2 > 4) { cw = L; ch = T2; } else rot = 0; }
  const H = 48, Wt = Math.max(48, Math.min(1600, Math.ceil(H * cw / ch)));
  const t = new Float32Array(3 * H * Wt);
  const IH = img.height;
  // 1.6.9 : échantillonnage lissé (bilinéaire) au lieu du pixel le plus proche : les petites lettres agrandies
  // restent nettes au lieu de devenir des escaliers
  const at = (x, y, c) => data[((Math.min(IH - 1, Math.max(0, y))) * W + Math.min(W - 1, Math.max(0, x))) * 4 + c];
  const smp = (px, py, c) => {
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    return (at(x0, y0, c) * (1 - fx) + at(x0 + 1, y0, c) * fx) * (1 - fy) + (at(x0, y0 + 1, c) * (1 - fx) + at(x0 + 1, y0 + 1, c) * fx) * fy;
  };
  const buf = new Float32Array(3 * H * Wt);
  let lo = 255, hi = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < Wt; x++) {
      // coordonnées dans la ligne (tournée de 90° pour une colonne)
      const u = (x + 0.5) * cw / Wt - 0.5, v = (y + 0.5) * ch / H - 0.5;
      // 1.7.0 : lettres penchées (italique) : la ligne est « redressée » en décalant chaque rangée
      let px = vertical ? (flip ? b.x0 + v : b.x0 + (ch - 1 - v)) : b.x0 + u + (shear ? shear * (ch / 2 - v) : 0), py = vertical ? (flip ? b.y1 - 1 - u : b.y0 + u) : b.y0 + v;
      // 1.7.2 : texte penché : la ligne est lue le long de son angle (tournée autour du centre du cadre)
      if (rot && !vertical) { const dx = u - cw / 2, dy = v - ch / 2; px = (b.x0 + b.x1) / 2 + dx * co - dy * si; py = (b.y0 + b.y1) / 2 + dx * si + dy * co; }
      const o = y * Wt + x;
      for (let c = 0; c < 3; c++) buf[c * H * Wt + o] = smp(px, py, c);
    }
  }
  // deuxième lecture (lignes peu sûres) : contraste étiré au maximum (texte bien noir sur fond bien blanc)
  const N = H * Wt;
  // 1.7.2 : bornes prises à 2 % et 98 % (un point de bruit ne fausse plus le contraste des scans flous ou tachés)
  if (enh) for (let i = 0; i < 3 * N; i++) { const val = buf[i]; if (val < lo) lo = val; if (val > hi) hi = val; }
  const k = enh && hi - lo > 30 ? 255 / (hi - lo) : 1, off = enh && hi - lo > 30 ? lo : 0;
  // 1.7.1 : lettres floues (scan flou, image agrandie) : netteté renforcée (masque flou soustrait)
  if (sharp) {
    const tmp = new Float32Array(N);
    for (let c = 0; c < 3; c++) {
      const B = c * N;
      for (let y = 0; y < H; y++) for (let x = 0; x < Wt; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= Wt) continue; sum += buf[B + yy * Wt + xx]; cnt++; } }
        tmp[y * Wt + x] = buf[B + y * Wt + x] + 0.9 * (buf[B + y * Wt + x] - sum / cnt);
      }
      for (let i = 0; i < N; i++) buf[B + i] = Math.max(0, Math.min(255, tmp[i]));
    }
  }
  if (inv) for (let i = 0; i < 3 * N; i++) buf[i] = 255 - buf[i];
  for (let i = 0; i < H * Wt; i++) {
    // ordre des couleurs attendu par le modèle : bleu, vert, rouge
    t[i] = Math.max(0, Math.min(255, (buf[2 * H * Wt + i] - off) * k)) / 127.5 - 1;
    t[H * Wt + i] = Math.max(0, Math.min(255, (buf[H * Wt + i] - off) * k)) / 127.5 - 1;
    t[2 * H * Wt + i] = Math.max(0, Math.min(255, (buf[i] - off) * k)) / 127.5 - 1;
  }
  const inT = new ort.Tensor('float32', t, [1, 3, H, Wt]);
  const out = await R.sess.run({ [R.sess.inputNames[0]]: inT });
  // 1.7.1 : sortie lue sur le modèle réellement utilisé (un modèle de lecture en plus peut nommer sa sortie autrement)
  const o = out[(R.sess.outputNames || rec.outputNames)[0]], [, T, C] = o.dims, p = o.data;
  let text = '', last = 0, sc = 0, n = 0;
  for (let i = 0; i < T; i++) {
    let best = 0, bv = -1;
    for (let c = 0; c < C; c++) { const v = p[i * C + c]; if (v > bv) { bv = v; best = c; } }
    if (best !== 0 && best !== last) { text += R.dict[best] || ''; sc += bv; n++; }
    last = best;
  }
  // 1.7.2 : tableaux de calcul libérés tout de suite (la mémoire ne grimpe plus au fil des pages)
  try { inT.dispose?.(); for (const k in out) out[k].dispose?.(); } catch {}
  return { text: text.trim(), score: n ? sc / n : 0, vertical };
}

// note de bruitage : « SFX: … », « SFX - … », « S.F.X »
// notes des traducteurs pour les bruitages (« SFX: FWIP »), y compris mal lues : « SFC:FOOM », « 5FX », « SPX », « SeX: », « 5FIX », « X:ROOM »
// bruitages anglais courants (dessinés sur la page, pas dits par un personnage)
// 1.7.2 : mots de la liste qui sont aussi de vrais mots anglais (actions) : jamais jetés dans une bulle normale
const ACTION_WORDS = new Set('grab clench shake shuffle tap knock stab slash nod glare stare squeeze grip step stand gasp sniff sob tremble flutter flap dash jolt flinch twitch'.split(' '));
const SFX_WORDS = new Set('clap claps cap ting ling ding dring tink clink stomp bam bäm boom crash thud slam whoosh swoosh bang crack snap grab clench rumble thump whack smack splash zoom wham pow clang click clack drip ding dong creak growl roar shake shuffle tap knock stab slash swish fwip fwoom whirl twirl poom foom fwoosh shing shink fwap thwack thwip krak kaboom vroom vrooom zing zap ziiing slurp gulp munch chomp crunch rustle rattle clatter tremble jolt flinch twitch nod glare stare squeeze grip step stand stomp gasp sniff sob tremble flutter flap whirr whirrr buzz bzz shff shf tmp tmp dash ba dum badum'.split(' '));
const SFX = /^\W*S\W?F\W?[XY]?\b|^\W*[S5$]\s?[FPE3]\s?I?[XKC]|^\W*[S5$]?[FPE3]?X\s?[:;]|^\W*(EFFETS? SONORES?|SOUND EFFECTS?)\W/i;
const isCJK = s => /[぀-ヿ㐀-鿿가-힯]/.test(s);
// ligne à garder : assez sûre, avec de vraies lettres (pas un dessin lu comme du texte)
function good(l, min = 0.6) {
  const s = l.text.replace(/\s+/g, '');
  if (!s || l.score < min) return false;
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (isCJK(s)) return letters >= 1;
  // 1.7.0 refaite : la ponctuation ne compte pas (« ...NO. » était rejeté : 2 lettres sur 6 signes)
  const core = s.replace(/[.…!?,;:'’"“”«»\-–—~*]/g, '');
  return letters >= 2 && letters / Math.max(1, core.length) >= 0.5;
}

// 1.7.1 : ligne peu sûre (score 0,35 à 0,6) où des chiffres ont été lus à la place des lettres (« 0O30 » pour DOJO,
// « 6OOD » pour GOOD) : gardée si, chiffres remplacés, chaque mot est un vrai mot. Renvoie le texte réparé, ou ''.
// Un vrai nombre (« 100 », « 600 YEN ») n'est jamais touché ; texte en majuscules seulement (lettrage de bulle).
function digitRescue(l) {
  const s = String(l.text || '');
  if (!(l.score >= 0.35) || !/\d/.test(s) || !/\p{L}/u.test(s) || /\p{Ll}/u.test(s) || s.length > 40) return '';
  try {
    const SF = require('./scan-fix'); if (!SF.digitRepair) return '';
    const t = SF.digitRepair(s); if (t === s) return '';
    // au moins un mot de 3 lettres ou plus réparé (mélange chiffres + lettres), et plus aucun chiffre dans les mots
    const a = s.split(/\s+/), b = t.split(/\s+/);
    if (a.length !== b.length || !a.some((w, i) => w !== b[i] && /\p{L}/u.test(w) && /\d/.test(w) && (b[i].match(/\p{L}/gu) || []).length >= 3)) return '';
    const ws = t.match(/[\p{L}\d]+/gu) || [];
    if (!ws.every(w => /^\d+$/.test(w) || (/^\p{L}+$/u.test(w) && (w.length < 3 || SF.plausibleAny(w))))) return '';
    return t;
  } catch { return ''; }
}

// ---- bulles : zones claires fermées autour du texte (repérées sur une image réduite) ----
// Deux lignes dans la même zone claire = même bulle ; deux bulles collées restent séparées.
// Donne aussi le contour et la couleur de fond de la bulle (pour effacer proprement le texte d'origine).

// Zone de couleur unie autour d'un texte (bulle colorée) : remplissage par couleur voisine sur une image réduite.
// Refusée si elle est trop grande (fond de case, fond de page) ou trop peu remplie.
// 1.7.2 : couleur du fond autour d'un texte : un anneau juste à l'extérieur du cadre du texte, médiane de chaque couleur
// 1.7.3 : image tournée d'un quart de tour (dir 1 : vers la gauche, le haut de l'image va à gauche ; -1 : vers la droite)
function rotate90(img, dir) {
  const { width: W, height: H, data } = img, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // dir 1 : pixel (x, y) va en (x' = y, y' = W-1-x) ; dir -1 : (x' = H-1-y, y' = x) ; nouvelle largeur = H
    const nx = dir === 1 ? y : H - 1 - y, ny = dir === 1 ? W - 1 - x : x, q = (y * W + x) * 4, o = (ny * H + nx) * 4;
    out[o] = data[q]; out[o + 1] = data[q + 1]; out[o + 2] = data[q + 2]; out[o + 3] = 255;
  }
  return { width: H, height: W, data: out };
}

function ringBg(img, g) {
  const { width: W, height: H, data } = img;
  const m = Math.max(2, Math.round((g.lh || 16) * 0.3));
  const x0 = Math.max(0, Math.floor(g.x0) - m), y0 = Math.max(0, Math.floor(g.y0) - m), x1 = Math.min(W - 1, Math.ceil(g.x1) + m), y1 = Math.min(H - 1, Math.ceil(g.y1) + m);
  const ix0 = Math.floor(g.x0), iy0 = Math.floor(g.y0), ix1 = Math.ceil(g.x1), iy1 = Math.ceil(g.y1);
  const per = 2 * ((x1 - x0) + (y1 - y0)) * m, st = Math.max(1, Math.round(per / 3000));
  const R = [], G = [], B = [];
  for (let y = y0; y <= y1; y += st) for (let x = x0; x <= x1; x += st) {
    if (x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1) continue;
    const q = (y * W + x) * 4; R.push(data[q]); G.push(data[q + 1]); B.push(data[q + 2]);
  }
  if (R.length < 12) return null;
  // 1.7.3 : le contour noir de la bulle et la trame du dessin autour tombent souvent dans l'anneau (petite bulle bien remplie) :
  // fond clair → la couleur la plus claire courante (80 % des points sont plus sombres), fond sombre → la plus sombre courante
  const idx = R.map((_, i) => i), lum = i => R[i] * 0.3 + G[i] * 0.59 + B[i] * 0.11;
  idx.sort((a, b) => lum(a) - lum(b));
  const mid = lum(idx[idx.length >> 1]), pick = mid >= 110 ? Math.floor(idx.length * 0.8) : Math.floor(idx.length * 0.2);
  // on prend la médiane des points autour de ce rang (moins de bruit qu'un seul point)
  const sl = idx.slice(Math.max(0, pick - 6), pick + 7), md = a => { a.sort((u, v) => u - v); return a[a.length >> 1]; };
  return `rgb(${md(sl.map(i => R[i]))},${md(sl.map(i => G[i]))},${md(sl.map(i => B[i]))})`;
}

function colorRegion(img, g) {
  const { width: W, height: H, data } = img;
  let G = img._cg;
  if (!G) {
    const k = Math.min(1, 480 / W), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k)), rgb = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = (Math.min(H - 1, Math.floor(y / k)) * W + Math.min(W - 1, Math.floor(x / k))) * 4, q = (y * w + x) * 3; rgb[q] = data[p]; rgb[q + 1] = data[p + 1]; rgb[q + 2] = data[p + 2]; }
    G = img._cg = { k, w, h, rgb };
  }
  const { k, w, h, rgb } = G;
  const bx0 = Math.max(0, Math.floor(g.x0 * k)), by0 = Math.max(0, Math.floor(g.y0 * k)), bx1 = Math.min(w - 1, Math.ceil(g.x1 * k)), by1 = Math.min(h - 1, Math.ceil(g.y1 * k));
  // couleur du fond : la plus fréquente (arrondie) dans le cadre du texte
  const hist = new Map();
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const q = (y * w + x) * 3, key = (rgb[q] >> 4) << 8 | (rgb[q + 1] >> 4) << 4 | (rgb[q + 2] >> 4); hist.set(key, (hist.get(key) || 0) + 1); }
  let best = -1, bn = 0; for (const [key, n] of hist) if (n > bn) { bn = n; best = key; }
  const tot = (bx1 - bx0 + 1) * (by1 - by0 + 1); if (best < 0 || bn < tot * 0.3) return null;
  let r = 0, gg = 0, b = 0, m = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const q = (y * w + x) * 3; if (((rgb[q] >> 4) << 8 | (rgb[q + 1] >> 4) << 4 | (rgb[q + 2] >> 4)) === best) { r += rgb[q]; gg += rgb[q + 1]; b += rgb[q + 2]; m++; } }
  r /= m; gg /= m; b /= m;
  const near = q => { const dr = rgb[q] - r, dg = rgb[q + 1] - gg, db = rgb[q + 2] - b; return dr * dr + dg * dg + db * db < 38 * 38; };
  const seen = new Uint8Array(w * h), st = [];
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * w + x; if (near(i * 3)) { seen[i] = 1; st.push(i); } }
  const max = w * h * 0.2; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, edge = 0;
  while (st.length) {
    const i = st.pop(), x = i % w, y = (i / w) | 0; n++;
    if (n > max) return null;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !seen[j] && near(j * 3)) { seen[j] = 1; st.push(j); }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // zone trop peu remplie (décor), qui touche le bord de la page, ou à peine plus grande que le texte
  if (n < bw * bh * 0.45 || edge > 2 || bw * bh < tot * 1.3) return null;
  const lum = r * 0.3 + gg * 0.59 + b * 0.11;
  return { box: { x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k }, bg: `rgb(${r | 0},${gg | 0},${b | 0})`, dark: lum < 90 };
}

// dark : bulles noires à texte blanc (pages sombres, souvenirs, nuit)
function bubbleMap(img, dark) {
  const { width: W, height: H, data } = img;
  const k = Math.min(1, 700 / Math.max(W, 1), 2400 / Math.max(H, 1));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const lum = new Uint8Array(w * h), col = new Uint32Array(w * h);
  // 1.6.9 : chaque point de la carte réduite garde le pixel le plus sombre de son carré
  // (un trait fin — bord d'une bulle, cadre — n'est plus perdu à la réduction : deux cadres voisins restent séparés)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ya = Math.min(H - 1, Math.floor(y / k)), yb = Math.min(H, Math.max(ya + 1, Math.floor((y + 1) / k)));
    const xa = Math.min(W - 1, Math.floor(x / k)), xb = Math.min(W, Math.max(xa + 1, Math.floor((x + 1) / k)));
    // bulles noires : on garde au contraire le pixel le plus clair (un bord blanc fin n'est pas perdu)
    let m = dark ? 0 : 255, mp = (ya * W + xa) * 4;
    for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) { const q = (yy * W + xx) * 4, v = (data[q] * 0.3 + data[q + 1] * 0.59 + data[q + 2] * 0.11) | 0; if (dark ? v > m : v < m) { m = v; } }
    const p = (Math.min(H - 1, (ya + yb) >> 1) * W + Math.min(W - 1, (xa + xb) >> 1)) * 4; void mp;
    lum[y * w + x] = dark ? 255 - m : m;
    col[y * w + x] = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
  }
  const lab = new Int32Array(w * h).fill(-1), comps = [], st = [];
  for (let i = 0; i < w * h; i++) {
    if (lab[i] !== -1 || lum[i] < 185) continue;
    const id = comps.length; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, r = 0, g = 0, b = 0;
    st.push(i); lab[i] = id;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (n % 7 === 0) { const c = col[j]; r += c >> 16; g += (c >> 8) & 255; b += c & 255; }
      if (x > 0 && lab[j - 1] === -1 && lum[j - 1] >= 185) { lab[j - 1] = id; st.push(j - 1); }
      if (x < w - 1 && lab[j + 1] === -1 && lum[j + 1] >= 185) { lab[j + 1] = id; st.push(j + 1); }
      if (y > 0 && lab[j - w] === -1 && lum[j - w] >= 185) { lab[j - w] = id; st.push(j - w); }
      if (y < h - 1 && lab[j + w] === -1 && lum[j + w] >= 185) { lab[j + w] = id; st.push(j + w); }
    }
    const m = Math.max(1, Math.floor(n / 7));
    comps.push({ n, x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k, dark: !!dark, bg: `rgb(${(r / m) | 0},${(g / m) | 0},${(b / m) | 0})` });
  }
  // zone d'une ligne : la zone claire la plus présente dans son rectangle
  const of = l => {
    const cnt = new Map();
    const xa = Math.max(0, Math.floor(l.x0 * k)), xb = Math.min(w - 1, Math.ceil(l.x1 * k)), ya = Math.max(0, Math.floor(l.y0 * k)), yb = Math.min(h - 1, Math.ceil(l.y1 * k));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { const c = lab[y * w + x]; if (c >= 0) cnt.set(c, (cnt.get(c) || 0) + 1); }
    let best = -1, bn = 0; for (const [c, n] of cnt) if (n > bn) { bn = n; best = c; }
    const c = comps[best];
    // trop grande (fond de la page) ou trop petite : pas une bulle
    if (!c || c.n > w * h * 0.35 || (c.x1 - c.x0) < (l.x1 - l.x0) * 0.9 || (c.y1 - c.y0) < (l.y1 - l.y0) * 0.9) return null;
    // 1.6.9 : zone qui couvre une grande partie de la page (fond, grande case blanche) ou peu remplie
    // (forme découpée, pas une bulle) : ce n'est pas une bulle
    const bw = (c.x1 - c.x0) * k, bh = (c.y1 - c.y0) * k;
    if ((bw > w * 0.6 && bh > h * 0.3) || bw * bh > w * h * 0.22 || c.n < bw * bh * 0.35) return null;
    return { id: best, ...c };
  };
  return { of };
}

// regroupe les lignes d'une même bulle
// 1.7.3 : lignes d'une bulle rangées en deux colonnes : toutes d'un côté ou de l'autre d'une coupure verticale,
// au moins 2 lignes de chaque côté, les deux colonnes à la même hauteur → [colonne de droite, colonne de gauche]
function splitCols(ls) {
  const hl = ls.filter(l => !l.vertical);
  if (hl.length < 4 || hl.length !== ls.length) return null;
  const hs = hl.map(l => l.y1 - l.y0).sort((a, b) => a - b), tol = Math.max(2, (hs[hs.length >> 1] || 20) * 0.3);
  const xs = [...new Set(hl.flatMap(l => [l.x0, l.x1]))].sort((a, b) => a - b);
  for (const sx of xs) {
    const L = hl.filter(l => l.x1 <= sx + tol), R = hl.filter(l => l.x0 >= sx - tol && !L.includes(l));
    if (L.length < 2 || R.length < 2 || L.length + R.length !== hl.length) continue;
    const ly0 = Math.min(...L.map(l => l.y0)), ly1 = Math.max(...L.map(l => l.y1)), ry0 = Math.min(...R.map(l => l.y0)), ry1 = Math.max(...R.map(l => l.y1));
    if (Math.min(ly1, ry1) - Math.max(ly0, ry0) < 0.5 * Math.min(ly1 - ly0, ry1 - ry0)) continue;
    // vrai espace entre les colonnes (pas des mots d'une même ligne coupés en deux cadres)
    const gapRows = L.filter(a => R.some(b => Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0)).length;
    if (gapRows < 2) continue;
    return [R, L];
  }
  return null;
}

function group(lines, bm, inBubble) {
  if (bm) {
    // d'abord par bulle repérée ; les lignes hors bulle sont regroupées par proximité (plus bas)
    const by = new Map(), rest = [];
    for (const l of lines) { const c = bm.of(l) || (bm.dk && bm.dk.of(l)); if (c) { const id = (c.dark ? 'd' : 'l') + c.id; if (!by.has(id)) by.set(id, { c, ls: [] }); by.get(id).ls.push(l); } else rest.push(l); }
    const merged = [];
    for (const { c, ls } of by.values()) {
      // (1.7.1 : le texte d'une bulle n'est jamais coupé en paragraphes de livre)
      // 1.7.3 : deux colonnes de texte côte à côte dans une même bulle (« ASCEN-SION IS CER-TAINLY STRONG! » à droite de
      // « YOUR SENSES, YOUR SPEED… ») : avant, lues ensemble rangée par rangée (« CERYOUR SPEED ») ; chaque colonne à part
      const cols = splitCols(ls);
      const gs = cols ? cols.flatMap(c => group(c, null, true)) : group(ls, null, true), v = gs.every(o => o.vertical);
      // 1.6.9 : dans une même zone claire, les groupes de lignes proches forment une bulle ;
      // un grand espace vide entre eux (deux cadres collés, deux bulles qui se touchent) les garde séparés
      gs.sort((a, b) => v ? b.x1 - a.x1 : a.y0 - b.y0);
      const clusters = [];
      for (const g of gs) {
        // 1.7.2 : deux bulles côte à côte qui se touchent (« HEY, DANTON. » à droite de « I CAN'T UNDERSTAND… ») :
        // un espace vide vertical entre les deux colonnes de texte les garde séparées ; on rejoint le groupe de sa colonne
        // 1.7.2 : deux groupes à la même hauteur, côte à côte sans se recouvrir en largeur = deux bulles (dans une bulle, les lignes sont empilées)
        const sideBySide = c => { if (v) return false; const hx = Math.max(g.x0 - c.x1, c.x0 - g.x1), oy = Math.min(g.y1, c.y1) - Math.max(g.y0, c.y0); return hx > 0 && oy > 0.5 * Math.min(g.y1 - g.y0, c.y1 - c.y0); };
        const fits = c => { const lh = Math.max(g.lh || 0, c.lh) || 20; const gap = v ? c.x0 - g.x1 : g.y0 - c.y1; return gap < lh * 2.2 && (v || Math.max(g.x0 - c.x1, c.x0 - g.x1) <= lh * 0.8) && !sideBySide(c); };
        const last = v ? clusters[clusters.length - 1] : [...clusters].reverse().find(fits);
        if (last && fits(last)) { last.items.push(g); last.y0 = Math.min(last.y0, g.y0); last.y1 = Math.max(last.y1, g.y1); last.x0 = Math.min(last.x0, g.x0); last.x1 = Math.max(last.x1, g.x1); last.lh = Math.max(last.lh, g.lh || 0); }
        else clusters.push({ items: [g], y0: g.y0, y1: g.y1, x0: g.x0, x1: g.x1, lh: g.lh || 0 });
      }
      clusters.forEach((cl, ci) => {
        const same = cl.items, cj = /[぀-ヿ㐀-鿿]/.test(same[0].text);
        const parts = same.flatMap(o => o.parts || [o.text]);
        const txt = same.map(o => o.text).reduce((a, s) => !a ? s : cj ? a + s : /\p{L}[-‐‑]$/u.test(a) && /^\p{L}/u.test(s) ? a.slice(0, -1) + s : a + ' ' + s, '');
        const g = { x0: Math.min(...same.map(o => o.x0)), y0: Math.min(...same.map(o => o.y0)), x1: Math.max(...same.map(o => o.x1)), y1: Math.max(...same.map(o => o.y1)), text: txt, parts, boxes: same.flatMap(o => o.boxes || [[o.x0, o.y0, o.x1, o.y1].map(Math.round)]), vertical: v, lh: Math.max(...same.map(o => o.lh || 0)), n: same.reduce((a, o) => a + (o.n || 1), 0), bg: c.bg, ck: Math.round(c.x0) + ',' + Math.round(c.y0) };
        // bulle partagée : chaque groupe n'a que sa part de la zone (jusqu'au milieu de l'espace qui le sépare du voisin)
        const bb = { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 };
        if (clusters.length > 1) {
          const prev = clusters[ci - 1], next = clusters[ci + 1];
          const lo = it => Math.min(...it.items.map(o => v ? o.x0 : o.y0)), hi = it => Math.max(...it.items.map(o => v ? o.x1 : o.y1));
          // largeur : celle du texte, un peu élargie (la zone claire voisine peut appartenir à l'autre cadre)
          const m = (g.lh || 20) * 0.6;
          // voisin à côté (pas au-dessus ni en dessous) : on ne coupe pas en hauteur, la largeur suffit
          const beside = it => it && (Math.max(g.x0 - it.x1, it.x0 - g.x1) > (g.lh || 20) * 0.8);
          if (!v) { if (prev && !beside(prev)) bb.y0 = (hi(prev) + g.y0) / 2; if (next && !beside(next)) bb.y1 = (g.y1 + lo(next)) / 2; bb.x0 = Math.max(bb.x0, g.x0 - m); bb.x1 = Math.min(bb.x1, g.x1 + m); }
          else { if (prev) bb.x1 = (lo(prev) + g.x1) / 2; if (next) bb.x0 = (g.x0 + hi(next)) / 2; bb.y0 = Math.max(bb.y0, g.y0 - m); bb.y1 = Math.min(bb.y1, g.y1 + m); }
        }
        g.bubble = bb; merged.push(g);
      });
    }
    return [...merged, ...group(rest)];
  }
  const items = lines.map(l => ({ ...l, h: l.y1 - l.y0, w: l.x1 - l.x0 }));
  const vert = items.filter(i => i.vertical), hor = items.filter(i => !i.vertical);
  const out = [];
  hor.sort((a, b) => a.y0 - b.y0);
  for (const it of hor) {
    // 1.7.3 : lettres de taille très différente (grand cri « I'LL END IT HERE!!! » au-dessus d'un petit cadre de texte) : pas le même texte
    const sizeOk = g => { const hs = g.hs.slice().sort((a, b) => a - b), m = hs[hs.length >> 1] || it.h; return Math.max(m, it.h) / Math.max(1, Math.min(m, it.h)) < 2.2; };
    const ok = g => !g.vertical && sizeOk(g) && (() => { const gap = it.y0 - g.y1, lh = Math.max(g.lh, it.h), cx = (it.x0 + it.x1) / 2, gcx = (g.x0 + g.x1) / 2; const overlap = Math.min(g.x1, it.x1) - Math.max(g.x0, it.x0); return gap < lh * 0.9 && gap > -lh * 0.6 && (overlap > -lh * 0.3 || Math.abs(cx - gcx) < lh * 2); })();
    const g = out.find(ok);
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y1 = Math.max(g.y1, it.y1); g.parts.push(it.text); g.lh = Math.max(g.lh, it.h); g.hs.push(it.h); g.ls.push(it); }
    else out.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, parts: [it.text], lh: it.h, hs: [it.h], vertical: false, ls: [it] });
  }
  vert.sort((a, b) => b.x1 - a.x1);
  for (const it of vert) {
    const g = out.find(g => g.vertical && (() => { const gap = g.x0 - it.x1, cw = Math.max(g.cw, it.w); const ov = Math.min(g.y1, it.y1) - Math.max(g.y0, it.y0); return gap < cw * 1.0 && gap > -cw && ov > -cw; })());
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y0 = Math.min(g.y0, it.y0); g.y1 = Math.max(g.y1, it.y1); g.parts.push(it.text); g.cw = Math.max(g.cw, it.w); g.hs.push(it.w); g.ls.push(it); }
    else out.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, parts: [it.text], cw: it.w, hs: [it.w], vertical: true, ls: [it] });
  }
  return (inBubble ? out : out.flatMap(splitProse)).map(g => {
    // japonais / chinois : lignes collées ; coréen : séparées par une espace (comme les mots)
    const cjk = g.parts.some(p => /[぀-ヿ㐀-鿿]/.test(p)) && !g.parts.some(p => /[가-힯]/.test(p));
    // « PATHETICALL » + « Y » ou « EXAM- » + « PLE » : on recolle les mots coupés en fin de ligne
    let text = '';
    for (const p of g.parts) {
      if (!text) text = p;
      else if (cjk) text += p;
      // 1.6.9 : aussi en majuscules (« EXCEL- » + « LENT », « TSUKUMO- » + « GAMI »)
      else if (/\p{L}[-‐‑]$/u.test(text) && /^\p{L}/u.test(p)) text = text.slice(0, -1) + p;
      else if (/^\p{L}{1,2}$/u.test(p) && /\p{L}$/.test(text) && p === p.toUpperCase() && text === text.toUpperCase() && p.length === 1) text += p;
      else text += ' ' + p;
    }
    // hauteur d'une ligne d'origine : la traduction ne sera jamais écrite plus gros
    const hs = g.hs.slice().sort((a, b) => a - b), lh = hs[hs.length >> 1] || 0;
    // 1.7.3 : cadre de chaque ligne (la gomme efface ligne par ligne, sans voiler le dessin entre elles)
    const boxes = (g.ls || []).map(l => [l.x0, l.y0, l.x1, l.y1].map(Math.round));
    return { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, text: text.trim(), parts: g.parts, vertical: g.vertical, lh, n: g.parts.length, ...(boxes.length ? { boxes } : {}), ...(g.prose ? { prose: true } : {}) };
  }).filter(g => g.text.replace(/\s/g, '').length >= (isCJK(g.text) ? 1 : 2));
}

// 1.7.1 : texte de livre ou de roman (hors bulles) : un bloc de lignes longues est coupé en paragraphes
// (retrait de première ligne, ligne courte qui finit une phrase, grand espace, titre centré). Chaque paragraphe
// est traduit en entier et réécrit comme un paragraphe (aligné à gauche), au lieu d'une grosse « bulle ».
function splitProse(g) {
  const ls = (g.ls || []).slice().sort((a, b) => a.y0 - b.y0);
  if (g.vertical || ls.length < 3) return [g];
  const words = l => (String(l.text).match(/[\p{L}\d'’]+/gu) || []).length;
  const avgW = ls.reduce((a, l) => a + words(l), 0) / ls.length;
  // la plupart des lignes sont longues (une liste de noms ou de crédits n'est pas un texte de livre)
  if (avgW < 5 || ls.filter(l => words(l) >= 5).length < ls.length * 0.6) return [g];
  // un livre s'écrit surtout en minuscules ; le lettrage des BD et des mangas est en majuscules (jamais coupé ici)
  const all = ls.map(l => l.text).join(' '), low = (all.match(/\p{Ll}/gu) || []).length, up = (all.match(/\p{Lu}/gu) || []).length;
  if (low < (low + up) * 0.6) return [g];
  const hs = ls.map(l => l.h).sort((a, b) => a - b), lh = hs[hs.length >> 1] || 20;
  const left = Math.min(...ls.map(l => l.x0)), right = Math.max(...ls.map(l => l.x1)), W = right - left;
  if (W < lh * 12) return [g];
  const gaps = ls.slice(1).map((l, k) => l.y0 - ls[k].y1).sort((a, b) => a - b), mg = gaps.length ? gaps[gaps.length >> 1] : lh * 0.5;
  const paras = []; let cur = [];
  ls.forEach((l, k) => {
    const prev = ls[k - 1];
    const title = (l.x1 - l.x0) < W * 0.6 && Math.abs((l.x0 + l.x1) / 2 - (left + right) / 2) < W * 0.08 && l.x0 > left + lh;
    const newPara = !prev || title || (prev && prev._title)
      || l.x0 > left + lh * 0.9                                               // retrait de première ligne
      || (l.y0 - prev.y1) > Math.max(mg * 1.8, lh * 0.6)                      // grand espace
      || (prev.x1 < right - lh * 3 && /[.!?…»"”:]\s*$/.test(prev.text));       // ligne précédente courte qui finit une phrase
    if (newPara && cur.length) { paras.push(cur); cur = []; }
    l._title = title; cur.push(l);
  });
  if (cur.length) paras.push(cur);
  return paras.map(p => ({ x0: Math.min(...p.map(l => l.x0)), y0: Math.min(...p.map(l => l.y0)), x1: Math.max(...p.map(l => l.x1)), y1: Math.max(...p.map(l => l.y1)),
    parts: p.map(l => l.text), lh: Math.max(...p.map(l => l.h)), hs: p.map(l => l.h), vertical: false, ls: p, prose: p.length >= 2 || words(p[0]) >= 5 }));
}

// lit une image et renvoie les bulles de texte (coordonnées en pixels de l'image)
// opts.model : modèle supplémentaire imposé ('korean'…) ; sinon « auto » essaie aussi les modèles installés
async function readBubbles(img, opts = {}) {
  await load();
  const { width: W, height: H } = img;
  let boxes = [];
  if (H > W * 2.2) {
    // image très haute (webtoon) : lue par morceaux qui se chevauchent
    const step = Math.round(W * 1.4), over = Math.round(W * 0.25);
    for (let y = 0; y < H; y += step) {
      const y0 = Math.max(0, y - over), y1 = Math.min(H, y + step + over);
      const part = { width: W, height: y1 - y0, data: img.data.subarray(y0 * W * 4, y1 * W * 4) };
      // 1.7.2 : chaque morceau lu plus finement (petites lettres des webtoons), sans aller jusqu’à couper les points d’exclamation
      for (const b of await detect(part, 1600)) boxes.push({ ...b, y0: b.y0 + y0, y1: b.y1 + y0 });
    }
    // doublons dans les zones de chevauchement
    boxes.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
    boxes = boxes.filter((b, i) => !boxes.slice(0, i).some(a => { const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return ix > 0 && iy > 0 && ix * iy > 0.5 * (b.x1 - b.x0) * (b.y1 - b.y0); }));
  } else boxes = await detect(img, 2048);
  // 1.7.3 : page avec peu de texte trouvé (double page, grand titre) : titres latins tournés d'un quart de tour
  // (« DAEMON DABADA » de haut en bas, « ABSOLUTE TENTAREA!!!! » de bas en haut) : cherchés sur l'image tournée
  if (H <= W * 2.2 && boxes.filter(b => Math.min(b.x1 - b.x0, b.y1 - b.y0) >= 12 && (b.x1 - b.x0) * (b.y1 - b.y0) > 1500).length < 8) {
    // 1.7.3 : très grandes lettres (« EIGHT FOLD BLADE!!!! », titres d'attaque) : trop grosses pour la recherche habituelle,
    // cherchées sur l'image réduite ; puis la ligne juste au-dessus et au-dessous est essayée (mot manquant du même titre)
    try {
      const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const big = [];
      for (const ms of [960, 640]) for (const b of await detect(img, ms)) {
        if (b.y1 - b.y0 < 40 || (b.x1 - b.x0) * (b.y1 - b.y0) < 4000) continue;
        if (boxes.some(a => inter(a, b) > 0.5 * (b.x1 - b.x0) * (b.y1 - b.y0))) continue;
        // une vraie ligne de texte déjà trouvée dedans (« MANGA MOINS » dans un logo) : on garde la ligne, pas le grand cadre
        const inside = boxes.filter(a => inter(a, b) >= 0.5 * (a.x1 - a.x0) * (a.y1 - a.y0));
        if (inside.some(a => a.x1 - a.x0 > (a.y1 - a.y0) * 2 && a.y1 - a.y0 >= 14)) continue;
        // seulement un mot bien lu (pas un dessin ou un logo pris pour du texte)
        const rb = await recognize(img, b, null, true); if (rb.score < 0.85 || !/\p{L}{2,}/u.test(rb.text)) continue;
        boxes = boxes.filter(a => !inside.includes(a));
        boxes.push(b); big.push(b);
      }
      const TITLE = /^[A-Z0-9!?'.,\- ]{2,}$/;
      for (const b0 of big) for (const dy of [-1, 1]) {
        let b = b0;
        for (let n = 0; n < 3; n++) {
          const h = b.y1 - b.y0, pad = (b.x1 - b.x0) * 0.12;
          const c = { x0: Math.max(0, b.x0 - pad), x1: Math.min(W - 1, b.x1 + pad), y0: dy < 0 ? b.y0 - h * 1.05 : b.y1 + h * 0.05, y1: dy < 0 ? b.y0 - h * 0.05 : b.y1 + h * 1.05 };
          if (c.y0 < 0 || c.y1 > H - 1 || boxes.some(a => inter(a, c) > 0.2 * (c.x1 - c.x0) * (c.y1 - c.y0))) break;
          const r = await recognize(img, c, null, true);
          if (r.score < 0.85 || !TITLE.test(r.text.trim())) break;
          boxes.push(c); b = c;
        }
      }
    } catch {}
    try {
      for (const dir of [1, -1]) {
        const R = rotate90(img, dir);
        for (const rb of await detect(R, 2048)) {
          // dir 1 (image tournée vers la gauche) : x = W-1-y', y = x' ; dir -1 (vers la droite) : x = y', y = H-1-x'
          const b = dir === 1 ? { x0: W - 1 - rb.y1, x1: W - 1 - rb.y0, y0: rb.x0, y1: rb.x1 } : { x0: rb.y0, x1: rb.y1, y0: H - 1 - rb.x1, y1: H - 1 - rb.x0 };
          if (b.y1 - b.y0 < (b.x1 - b.x0) * 2.5 || b.y1 - b.y0 < 60) continue;
          const area = (b.x1 - b.x0) * (b.y1 - b.y0), inter = a => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
          // déjà trouvé (une grande partie de la colonne est déjà un texte lu) : on garde l'ancien, sauf s'il n'en était qu'un morceau
          const big = boxes.find(a => inter(a) > 0.3 * area);
          if (big && !(big.y1 - big.y0 > (big.x1 - big.x0) * 1.5 && b.y1 - b.y0 > (big.y1 - big.y0) * 1.3)) continue;
          // les petits morceaux trouvés à l'intérieur (taches, morceau de lettre, « DABAD ») sont remplacés par la colonne entière
          boxes = boxes.filter(a => inter(a) < 0.5 * (a.x1 - a.x0) * (a.y1 - a.y0));
          boxes.push(b);
        }
      }
    } catch {}
  }
  // choix du modèle de lecture : imposé, ou celui qui lit le mieux un échantillon de lignes
  let R = null, used = '';
  if (opts.model && installed().includes(opts.model)) { R = await recOf(opts.model); used = opts.model; }
  else if (opts.auto !== false && installed().length && boxes.length) {
    const sample = boxes.slice().sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0)).slice(0, 6);
    const mean = async RR => { let s = 0; for (const b of sample) s += (await recognize(img, b, RR)).score; return s / sample.length; };
    let best = await mean(null);
    // 1.7.0 : page en écriture latine et modèle « langues latines » installé : il est préféré (moins de U/L, G/6)
    if (installed().includes('latin')) {
      const smp = []; for (const b of sample.slice(0, 3)) smp.push((await recognize(img, b, null)).text);
      const s = smp.join(''), lat = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      if (lat >= 6 && lat >= s.replace(/[\s\p{P}\d]/gu, '').length * 0.8) { const RR = await recOf('latin'); const m = await mean(RR); if (m >= best - 0.02) { best = Math.max(best, m); R = RR; used = 'latin'; } }
    }
    if (best < 0.9 && used !== 'latin') for (const id of installed()) { const RR = await recOf(id); const m = await mean(RR); if (m > best + 0.04) { best = m; R = RR; used = id; } }
  }
  let bm = null; try { bm = bubbleMap(img); bm.dk = bubbleMap(img, true); } catch {}
  if (process.env.DRYAE_OCR_DEBUG) console.log("BOXES", JSON.stringify(boxes.map(b => [b.x0, b.y0, b.x1, b.y1].map(Math.round))));
  const lines = [], fails = new Map(), kept = new Map();
  const bkey = c => c ? Math.round(c.x0) + ',' + Math.round(c.y0) : '';
  for (const b of boxes) {
    let r = await recognize(img, b, R);
    // 1.6.9 : lecture en deux passes — ligne peu sûre (petites lettres, image floue) relue avec le contraste renforcé
    // et un cadre un peu plus large ; on garde la lecture la plus sûre
    if (r.score < 0.9 && r.text.replace(/\s/g, '').length >= 2) {
      const p = Math.max(1, (b.y1 - b.y0) * 0.08);
      const r2 = await recognize(img, { x0: Math.max(0, b.x0 - p), y0: Math.max(0, b.y0 - p), x1: Math.min(img.width, b.x1 + p), y1: Math.min(img.height, b.y1 + p) }, R, true);
      if (r2.score > r.score + 0.02) r = r2;
      // 1.7.0 : toujours peu sûre : peut-être de l'italique (cris, pensées, voix lointaines) → relue redressée
      if (r.score < 0.9 && b.x1 - b.x0 > (b.y1 - b.y0) * 1.5) for (const sh of [0.22, -0.18]) {
        const r3 = await recognize(img, b, R, true, sh);
        if (r3.score > r.score + 0.03) r = r3;
        if (r.score >= 0.9) break;
      }
    }
    // 1.7.3 : colonne haute et étroite qui n'est pas du japonais : peut-être un titre latin tourné (« ABSOLUTE TENTAREA!!!! »
    // lu de bas en haut, « DAEMON DABADA » de haut en bas) : les deux sens sont essayés, le plus sûr est gardé
    if (b.y1 - b.y0 > (b.x1 - b.x0) * 2.5 && !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(r.text) && r.score < 0.93) {
      const r8 = await recognize(img, b, R, true, 0, false, false, 'flip'); if (r8.score > r.score + 0.03) r = r8;
      if (r.score < 0.85) { const r9 = await recognize(img, b, R, true); if (r9.score > r.score + 0.03) r = r9; }
    }
    // 1.7.2 : lettres claires sur fond sombre (souvenirs, nuit, cadres noirs) : relue en négatif (noir sur blanc)
    if (r.score < 0.85 && r.text.replace(/\s/g, '').length >= 1 && darkBg(img, b)) { const r6 = await recognize(img, b, R, true, 0, false, true); if (r6.score > r.score + 0.03) r = r6; }
    // 1.7.2 : texte penché (10 à 30°) : angle estimé sur la ligne, relue le long de cet angle
    if (r.score < 0.75 && b.x1 - b.x0 > (b.y1 - b.y0) * 1.8) { const a = tiltOf(img, b); if (a) { const r7 = await recognize(img, b, R, true, 0, false, false, a); if (r7.score > r.score + 0.04) r = r7; } }
    // 1.7.0 refaite : ligne toujours peu sûre (« DOJO » lu « 0O30 ») : relue avec les autres modèles installés
    // (modèle « langues latines » ou modèle de base) ; on garde la lecture la plus sûre
    // 1.7.2 : seulement le modèle de base et « langues latines » (avant : tous les modèles installés, très lent), arrêt dès que c'est assez sûr
    if (r.score < 0.75 && r.text.replace(/\s/g, '').length >= 2) for (const id of ['', ...installed().filter(x => x === 'latin')]) {
      if (id === used || r.score >= 0.85) continue;
      try { const RR = id ? await recOf(id) : null; const r4 = await recognize(img, b, RR, true); if (r4.score > r.score + 0.05) r = r4; } catch {}
    }
    // 1.7.1 : toujours peu sûre : lettres floues (vieux scan, image agrandie) → relue avec la netteté renforcée
    // (une ligne trop peu sûre au départ n'est gardée grâce à elle que si la relecture est assez sûre : pas un dessin pris pour du texte)
    if (r.score < 0.75 && r.text.replace(/\s/g, '').length >= 2) { const r5 = await recognize(img, b, R, true, 0, true); if (r5.score > r.score + 0.03 && (r.score >= 0.6 || r5.score >= 0.7)) r = r5; }
    const l = { ...b, ...r };
    const c = bm ? (bm.of(l) || bm.dk.of(l)) : null, k = bkey(c);
    // ligne un peu moins sûre (« IN », « GUT ») : gardée si elle est dans une vraie bulle
    let keep = good(l) || (good(l, 0.45) && c);
    // 1.7.1 : « 0O30 » lu pour DOJO avec un score bas : gardée, chiffres remplacés par les lettres
    if (!keep) { const t = digitRescue(l); if (t) { l.text = t; keep = true; } }
    // 1.7.3 : cadre de quelques points de large (« MA » lu dans un trait du dessin) : pas un texte
    if (keep && Math.min(b.x1 - b.x0, b.y1 - b.y0) < 9 && l.text.replace(/\s/g, '').length >= 2 && !isCJK(l.text)) keep = false;
    if (keep) { lines.push(l); if (k) kept.set(k, (kept.get(k) || 0) + 1); }
    else if (k) fails.set(k, (fails.get(k) || 0) + 1);
  }
  // notes ajoutées par les traducteurs (« SFX: FWIP », « SFX : debout ») : bruitages, non traduits ;
  // zone surtout illisible (petites lettres d'une affiche, d'un panneau) : laissée telle quelle plutôt que traduite au hasard
  // 1.7.2 : japonais : petits caractères de lecture (furigana) à côté des kanji : retirés (ils se collaient au mot)
  try {
    const KANA = /^[\u3040-\u30ffー・]+$/, vw = lines.filter(l => l.vertical).map(l => l.x1 - l.x0).sort((a, b) => a - b), mw = vw.length >= 3 ? vw[vw.length >> 1] : 0;
    if (mw) for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i]; if (!l.vertical || !KANA.test(l.text) || l.x1 - l.x0 > mw * 0.6) continue;
      const w = l.x1 - l.x0;
      if (lines.some(o => o !== l && o.vertical && o.x1 - o.x0 >= mw * 0.8 && /[\u3400-\u9fff]/.test(o.text) && Math.min(Math.abs(l.x0 - o.x1), Math.abs(o.x0 - l.x1)) < w * 1.5 && Math.min(l.y1, o.y1) - Math.max(l.y0, o.y0) > 0)) lines.splice(i, 1);
    }
  } catch {}
  let groups = group(lines, bm).filter(g => !SFX.test(g.text) && !(g.ck && (fails.get(g.ck) || 0) >= 3 && (fails.get(g.ck) || 0) >= (kept.get(g.ck) || 0)));
  // 1.6.9 : mot coupé en fin de ligne (« SUMI- » / « RE ») dont la fin a été prise pour une autre bulle :
  // les deux morceaux sont réunis avant toute traduction
  for (let again = true; again;) {
    again = false;
    for (const a of groups) {
      if (a.vertical || !/\p{L}[-‐‑]$/u.test(a.text)) continue;
      const lh = a.lh || 20;
      const b = groups.find(o => o !== a && !o.vertical && o.y0 >= a.y1 - lh * 0.5 && o.y0 - a.y1 < lh * 3.5 && Math.min(a.x1, o.x1) - Math.max(a.x0, o.x0) > -lh && /^\p{L}/u.test(o.text));
      if (!b) continue;
      a.text = a.text.slice(0, -1) + b.text; a.parts = [...(a.parts || [a.text]).slice(0, -1), String((a.parts || []).slice(-1)[0] || '').replace(/[-‐‑]$/, '') + String((b.parts || [b.text])[0]), ...(b.parts || [b.text]).slice(1)];
      a.x0 = Math.min(a.x0, b.x0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1); a.n = (a.n || 1) + (b.n || 1);
      if (a.boxes || b.boxes) a.boxes = [...(a.boxes || [[a.x0, a.y0, a.x1, a.y1]]), ...(b.boxes || [[b.x0, b.y0, b.x1, b.y1]])];
      if (a.bubble && b.bubble) a.bubble = { x0: Math.min(a.bubble.x0, b.bubble.x0), y0: Math.min(a.bubble.y0, b.bubble.y0), x1: Math.max(a.bubble.x1, b.bubble.x1), y1: Math.max(a.bubble.y1, b.bubble.y1) };
      groups.splice(groups.indexOf(b), 1); again = true; break;
    }
  }
  // 1.6.9 : note de bruitage trop mal lue pour être reconnue (« S MESSY », « X TAN U », « HOO ») : une seule petite ligne,
  // hors de toute bulle, bien plus petite que le texte des bulles, 3 mots au plus → bruitage, non traduit
  const hs = groups.filter(g => g.bubble && !g.vertical).map(g => g.lh || 0).filter(Boolean).sort((a, b) => a - b);
  const med = hs.length ? hs[hs.length >> 1] : 0;
  if (med) groups = groups.filter(g => !(!g.bubble && (g.n || 1) === 1 && !g.vertical && (g.lh || 0) < med * 0.72 && (g.text.match(/\p{L}+/gu) || []).length <= 3 && !isCJK(g.text)));
  // « XWHOOSH » (SFX: collé et mal lu), hors bulle
  groups = groups.filter(g => !(!g.bubble && /^\W*[S5]?[FP]?X\p{Lu}{3,}\W*$/u.test(g.text)));
  // 1.6.9 : texte blanc sur fond sombre hors d'une bulle reconnue (bulles noires aux bords flous) :
  // la couleur du fond est prise autour du texte, pour l'effacer et écrire la traduction en blanc
  // 1.6.9 : bulles de couleur unie (vertes, jaunes, roses… des BD) : zone de la même couleur que le fond du texte, fermée
  for (const g of groups) { if (!g.bubble && !g.vertical) { const r = colorRegion(img, g); if (r) { g.bubble = r.box; g.bg = r.bg; g.dark = r.dark; } } }
  for (const g of groups) {
    if (g.bubble || g.vertical) continue;
    const { width: W, height: H, data } = img; const lv = [];
    const x0 = Math.max(0, Math.floor(g.x0)), x1 = Math.min(W - 1, Math.ceil(g.x1)), y0 = Math.max(0, Math.floor(g.y0)), y1 = Math.min(H - 1, Math.ceil(g.y1));
    const st = Math.max(1, Math.round(Math.sqrt((x1 - x0) * (y1 - y0) / 4000)));
    for (let y = y0; y <= y1; y += st) for (let x = x0; x <= x1; x += st) { const q = (y * W + x) * 4; lv.push([(data[q] * 0.3 + data[q + 1] * 0.59 + data[q + 2] * 0.11) | 0, q]); }
    if (lv.length < 20) continue;
    lv.sort((a, b) => a[0] - b[0]);
    const md = lv[lv.length >> 1];
    if (md[0] < 90) {
      let r = 0, gg = 0, b = 0, n = 0; for (const [, q] of lv.slice(0, lv.length >> 1)) { r += data[q]; gg += data[q + 1]; b += data[q + 2]; n++; }
      g.bg = `rgb(${(r / n) | 0},${(gg / n) | 0},${(b / n) | 0})`; g.dark = true;
      const m = (g.lh || 20) * 0.35; g.bubble = { x0: g.x0 - m, y0: g.y0 - m, x1: g.x1 + m, y1: g.y1 + m };
    }
  }
  // 1.7.2 : couleur de la gomme prise dans la petite marge autour du texte (sans les lettres), couleur du milieu (médiane)
  // pour ignorer les traits ; avant, sans couleur trouvée, la gomme était blanc pur (visible sur une bulle crème ou grise)
  for (const g of groups) { if (!g.bg) { const c = ringBg(img, g); if (c) g.bg = c; } }
  // qualité de la lecture (sert à n'envoyer à l'IA que les pages difficiles)
  const sc = lines.map(l => l.score || 0); groups.quality = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 1;
  // 1.6.9 : page en anglais (au moins un bon tiers de mots anglais : les noms des personnages n'en sont pas) :
  // lettres mal lues corrigées, mots coupés en fin de ligne recollés (même sans tiret lu) ;
  // zone devenue du charabia après correction (petites lettres d'une affiche floue) : laissée telle quelle
  try {
    const SF = require('./scan-fix');
    const txs = groups.map(g => g.text), er = SF.englishRatio(txs), fr = er >= 0.6 ? 0 : SF.frenchRatio(txs);
    // 1.7.1 : page de crédits de l'équipe (rôles + pseudonymes, adresses, « Discord ») : laissée telle quelle, les pseudonymes
    // ne sont pas des mots à corriger. Une page d'histoire avec un seul bloc de crédits est corrigée (pseudonymes mis de côté).
    // (si scan-fix.js est une ancienne version sans ces fonctions : pas de détection, le reste marche comme avant)
    const credLike = SF.creditsHint ? groups.filter(g => SF.creditsHint(g.text) > 0).length : 0;
    // 1.7.2 : page de crédits découpée en beaucoup de petits morceaux (rôles en minuscules, pseudonymes, flèches) :
    // au moins 3 mots de crédits différents répartis dans 3 morceaux, et aucune bulle de dialogue
    const credWords = SF.creditsHint ? new Set(txs.flatMap(t => (String(t).match(/\b(scanlations?|credits?|typeset\w*|proofread\w*|raws?|translat\w*|clean\w*|redraw\w*|staff)\b/gi) || []).map(w => w.toLowerCase().replace(/s$/, '')))).size : 0;
    const manyBits = credLike >= 3 && credWords >= 3 && groups.filter(g => g.bubble).length === 0;
    if (credLike && SF.isCreditsPage(txs, groups.filter(g => g.bubble).length, groups.length) && (credLike >= Math.max(2, groups.length * 0.4) || manyBits)) {
      groups.credits = true; groups.lang = fr >= 0.35 && fr > er ? 'fr' : er >= 0.35 ? 'en' : '';
    } else
    // 1.6.9 : page en français (BD, mangas en VF) : confusions U/L, O/Q, petit « i » des lettrages, « Δ » pour À, mots collés
    if (fr >= 0.35 && fr > er) {
      for (const g of groups) if (!isCJK(g.text) && !g.vertical) { const p = g.parts || [g.text]; g.text = SF.fixFrench(p.reduce((a, s) => !a ? s : /\p{L}[-‐‑]$/u.test(a) && /^\p{L}/u.test(s) ? a.slice(0, -1) + s : a + ' ' + s, '')); }
      groups.lang = 'fr';
    } else if (er >= 0.35) {
      groups.lang = 'en';
      for (const g of groups) if (!isCJK(g.text) && !g.vertical) g.text = SF.fixParts(g.parts || [g.text]);
      // mots ni anglais ni noms japonais (« FERFOOMNNCE ») : charabia
      let odd = 0, all = 0;
      for (let i = groups.length - 1; i >= 0; i--) {
        const ws = groups[i].text.match(/\p{L}{3,}/gu) || [], bad = ws.filter(w => !SF.plausible(w)).length;
        all += ws.length; odd += bad;
        if (ws.length >= 6 && bad >= 4 && bad / ws.length >= 0.3) { odd -= bad; all -= ws.length; groups.splice(i, 1); }
      }
      groups.odd = all ? odd / all : 0;
    }
  } catch {}
  // 1.6.9 : bruitages dessinés en lettres latines (« GWH », « STOMP », « BAM ») : jamais traduits, le dessin reste intact
  {
    const hs2 = groups.filter(g => !g.vertical).map(g => g.lh || 0).filter(Boolean).sort((a, b) => a - b), md = hs2.length ? hs2[hs2.length >> 1] : 0;
    groups = Object.assign(groups.filter(g => {
      const ws = (g.text.match(/\p{L}+/gu) || []); if (!ws.length || isCJK(g.text)) return true;
      // « CLAP CLAP CLAP CAP CLAP » : surtout des bruitages (même si un mot est mal lu)
      const ns = ws.filter(w => SFX_WORDS.has(w.toLowerCase()) || w.length === 1).length;
      if (ws.length > 2) return !(ns >= ws.length * 0.6 && (groups.lang === 'fr' || !g.bubble || (md && (g.lh || 0) > md * 1.6)));
      if (ws.length === 1 && ws[0].length <= 6 && !/[aeiouyàâéèêëîïôûù]/i.test(ws[0]) && !/^(hmm+|pff+|grr+|tch|psst)$/i.test(ws[0])) return false;
      const sfx = ws.every(w => SFX_WORDS.has(w.toLowerCase()));
      // 1.7.2 : vrais mots d'action (STARE, NOD, STEP, GRAB…) dans une vraie bulle, à la taille du texte : une réplique, gardée
      const act = ws.some(w => ACTION_WORDS.has(w.toLowerCase())) && g.bubble && !(md && (g.lh || 0) > md * 1.6);
      if (sfx && !act && (groups.lang === 'fr' || !g.bubble || (md && (g.lh || 0) > md * 1.6))) return false;
      return true;
    }), { lang: groups.lang, odd: groups.odd, quality: groups.quality, unread: groups.unread, credits: groups.credits });
  }
  // caractère japonais isolé au milieu d'un texte latin (« hegr分my ») : lecture parasite, retiré
  for (const g of groups) if ((g.text.match(/[a-zA-Z]/g) || []).length > 3 * (g.text.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length && /[a-zA-Z]{3}/.test(g.text)) g.text = g.text.replace(/\s*[\u3040-\u30ff\u3400-\u9fff]+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  groups.model = used;
  // page en écriture latine : on ignore les petits signes japonais/chinois isolés (bruitages dessinés)
  const latin = groups.filter(g => !isCJK(g.text)).length, cjk = groups.length - latin;
  // beaucoup de lignes trouvées mais illisibles : écriture que ce modèle ne connaît pas (coréen, cyrillique…)
  groups.unread = boxes.length - lines.length;
  // page anglaise ou française : les lettres japonaises sont des bruitages dessinés → jamais traduites
  const res = latin > cjk && used !== 'korean' ? groups.filter(g => !(isCJK(g.text) && (latin >= 2 * cjk || !g.bubble || g.text.replace(/[\s\p{P}]/gu, '').length <= 2))) : groups;
  res.model = used; res.unread = groups.unread; res.quality = groups.quality; res.odd = groups.odd || 0; res.lang = groups.lang || ''; res.credits = !!groups.credits;
  try { res.panels = panelsOf(img); } catch {}
  return res;
}

// 1.7.2 : cases de la page (ordre de lecture case par case) : bandes vides (blanches ou noires) qui traversent
// toute la page, puis, dans chaque bande, les séparations verticales ; une double page est coupée au milieu.
// Retour : liste de rectangles { x0, y0, x1, y1 } dans l'ordre haut → bas (gauche → droite ; l'ordre manga est fait à l'appel)
function panelsOf(img) {
  const { width: W, height: H, data } = img;
  if (H > W * 2.2) return null; // webtoon : pas de cases
  const k = Math.min(1, 500 / Math.max(W, H)), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
  const L = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((Math.min(H - 1, (y / k) | 0)) * W + Math.min(W - 1, (x / k) | 0)) * 4; L[y * w + x] = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) | 0; }
  const plain = (vals) => { let lo = 255, hi = 0, white = 0, black = 0; for (const v of vals) { if (v > 225) white++; else if (v < 35) black++; } return white >= vals.length * 0.985 || black >= vals.length * 0.985; };
  const runs = (n, isGap, minRun) => { const cuts = []; let st = -1; for (let i = 0; i <= n; i++) { const g = i < n && isGap(i); if (g && st < 0) st = i; if (!g && st >= 0) { if (i - st >= minRun && st > 0 && i < n) cuts.push((st + i) / 2); st = -1; } } return cuts; };
  const row = (y, x0, x1) => { const v = []; for (let x = x0; x < x1; x++) v.push(L[y * w + x]); return v; };
  const col = (x, y0, y1) => { const v = []; for (let y = y0; y < y1; y++) v.push(L[y * w + x]); return v; };
  const ys = [0, ...runs(h, y => plain(row(y, 0, w)), Math.max(2, Math.round(h * 0.006))), h];
  const out = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = Math.round(ys[i]), y1 = Math.round(ys[i + 1]); if (y1 - y0 < 4) continue;
    let xs = [0, ...runs(w, x => plain(col(x, y0, y1)), Math.max(2, Math.round(w * 0.006))), w];
    // double page sans séparation visible : coupée au milieu
    if (xs.length === 2 && W > H * 1.2) xs = [0, w / 2, w];
    for (let j = 0; j < xs.length - 1; j++) out.push({ x0: xs[j] / k, y0: y0 / k, x1: xs[j + 1] / k, y1: y1 / k, band: i, colIndex: j });
  }
  return out.length > 1 ? out : null;
}

module.exports = { detect, recognize, readBubbles, SFX, load, EXTRA, EXTRA_OF, installed, download, removeModel, setDir, splitProse };
module.exports.ringBg = ringBg; module.exports.rotate90 = rotate90;
