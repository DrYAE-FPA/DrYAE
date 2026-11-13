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
async function recognize(img, b, R, enh) {
  R = R || { sess: rec, dict };
  const { width: W, data } = img;
  let bw = Math.round(b.x1 - b.x0), bh = Math.round(b.y1 - b.y0);
  if (bw < 4 || bh < 4) return { text: '', score: 0 };
  // colonne verticale (japonais, chinois) : on la tourne pour la lire comme une ligne
  const vertical = bh > bw * 1.5;
  const cw = vertical ? bh : bw, ch = vertical ? bw : bh;
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
      const px = vertical ? b.x0 + (ch - 1 - v) : b.x0 + u, py = vertical ? b.y0 + u : b.y0 + v;
      const o = y * Wt + x;
      for (let c = 0; c < 3; c++) { const val = smp(px, py, c); buf[c * H * Wt + o] = val; if (enh) { if (val < lo) lo = val; if (val > hi) hi = val; } }
    }
  }
  // deuxième lecture (lignes peu sûres) : contraste étiré au maximum (texte bien noir sur fond bien blanc)
  const k = enh && hi - lo > 30 ? 255 / (hi - lo) : 1, off = enh && hi - lo > 30 ? lo : 0;
  for (let i = 0; i < H * Wt; i++) {
    // ordre des couleurs attendu par le modèle : bleu, vert, rouge
    t[i] = Math.min(255, (buf[2 * H * Wt + i] - off) * k) / 127.5 - 1;
    t[H * Wt + i] = Math.min(255, (buf[H * Wt + i] - off) * k) / 127.5 - 1;
    t[2 * H * Wt + i] = Math.min(255, (buf[i] - off) * k) / 127.5 - 1;
  }
  const out = await R.sess.run({ [R.sess.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, H, Wt]) });
  const o = out[rec.outputNames[0]], [, T, C] = o.dims, p = o.data;
  let text = '', last = 0, sc = 0, n = 0;
  for (let i = 0; i < T; i++) {
    let best = 0, bv = -1;
    for (let c = 0; c < C; c++) { const v = p[i * C + c]; if (v > bv) { bv = v; best = c; } }
    if (best !== 0 && best !== last) { text += R.dict[best] || ''; sc += bv; n++; }
    last = best;
  }
  return { text: text.trim(), score: n ? sc / n : 0, vertical };
}

// note de bruitage : « SFX: … », « SFX - … », « S.F.X »
// notes des traducteurs pour les bruitages (« SFX: FWIP »), y compris mal lues : « SFC:FOOM », « 5FX », « SPX », « SeX: », « 5FIX », « X:ROOM »
// bruitages anglais courants (dessinés sur la page, pas dits par un personnage)
const SFX_WORDS = new Set('clap claps cap ting ling ding dring tink clink stomp bam bäm boom crash thud slam whoosh swoosh bang crack snap grab clench rumble thump whack smack splash zoom wham pow clang click clack drip ding dong creak growl roar shake shuffle tap knock stab slash swish fwip fwoom whirl twirl poom foom fwoosh shing shink fwap thwack thwip krak kaboom vroom vrooom zing zap ziiing slurp gulp munch chomp crunch rustle rattle clatter tremble jolt flinch twitch nod glare stare squeeze grip step stand stomp gasp sniff sob tremble flutter flap whirr whirrr buzz bzz shff shf tmp tmp dash ba dum badum'.split(' '));
const SFX = /^\W*S\W?F\W?[XY]?\b|^\W*[S5$]\s?[FPE3]\s?I?[XKC]|^\W*[S5$]?[FPE3]?X\s?[:;]|^\W*(EFFETS? SONORES?|SOUND EFFECTS?)\W/i;
const isCJK = s => /[぀-ヿ㐀-鿿가-힯]/.test(s);
// ligne à garder : assez sûre, avec de vraies lettres (pas un dessin lu comme du texte)
function good(l, min = 0.6) {
  const s = l.text.replace(/\s+/g, '');
  if (!s || l.score < min) return false;
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (isCJK(s)) return letters >= 1;
  return letters >= 2 && letters / s.length >= 0.5;
}

// ---- bulles : zones claires fermées autour du texte (repérées sur une image réduite) ----
// Deux lignes dans la même zone claire = même bulle ; deux bulles collées restent séparées.
// Donne aussi le contour et la couleur de fond de la bulle (pour effacer proprement le texte d'origine).

// Zone de couleur unie autour d'un texte (bulle colorée) : remplissage par couleur voisine sur une image réduite.
// Refusée si elle est trop grande (fond de case, fond de page) ou trop peu remplie.
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
function group(lines, bm) {
  if (bm) {
    // d'abord par bulle repérée ; les lignes hors bulle sont regroupées par proximité (plus bas)
    const by = new Map(), rest = [];
    for (const l of lines) { const c = bm.of(l) || (bm.dk && bm.dk.of(l)); if (c) { const id = (c.dark ? 'd' : 'l') + c.id; if (!by.has(id)) by.set(id, { c, ls: [] }); by.get(id).ls.push(l); } else rest.push(l); }
    const merged = [];
    for (const { c, ls } of by.values()) {
      const gs = group(ls), v = gs.every(o => o.vertical);
      // 1.6.9 : dans une même zone claire, les groupes de lignes proches forment une bulle ;
      // un grand espace vide entre eux (deux cadres collés, deux bulles qui se touchent) les garde séparés
      gs.sort((a, b) => v ? b.x1 - a.x1 : a.y0 - b.y0);
      const clusters = [];
      for (const g of gs) {
        const last = clusters[clusters.length - 1], lh = Math.max(g.lh || 0, last ? last.lh : 0) || 20;
        const gap = !last ? Infinity : v ? last.x0 - g.x1 : g.y0 - last.y1;
        if (last && gap < lh * 2.2) { last.items.push(g); last.y1 = Math.max(last.y1, g.y1); last.x0 = Math.min(last.x0, g.x0); last.lh = Math.max(last.lh, g.lh || 0); }
        else clusters.push({ items: [g], y1: g.y1, x0: g.x0, lh: g.lh || 0 });
      }
      clusters.forEach((cl, ci) => {
        const same = cl.items, cj = /[぀-ヿ㐀-鿿]/.test(same[0].text);
        const parts = same.flatMap(o => o.parts || [o.text]);
        const txt = same.map(o => o.text).reduce((a, s) => !a ? s : cj ? a + s : /\p{L}[-‐‑]$/u.test(a) && /^\p{L}/u.test(s) ? a.slice(0, -1) + s : a + ' ' + s, '');
        const g = { x0: Math.min(...same.map(o => o.x0)), y0: Math.min(...same.map(o => o.y0)), x1: Math.max(...same.map(o => o.x1)), y1: Math.max(...same.map(o => o.y1)), text: txt, parts, vertical: v, lh: Math.max(...same.map(o => o.lh || 0)), n: same.reduce((a, o) => a + (o.n || 1), 0), bg: c.bg, ck: Math.round(c.x0) + ',' + Math.round(c.y0) };
        // bulle partagée : chaque groupe n'a que sa part de la zone (jusqu'au milieu de l'espace qui le sépare du voisin)
        const bb = { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 };
        if (clusters.length > 1) {
          const prev = clusters[ci - 1], next = clusters[ci + 1];
          const lo = it => Math.min(...it.items.map(o => v ? o.x0 : o.y0)), hi = it => Math.max(...it.items.map(o => v ? o.x1 : o.y1));
          // largeur : celle du texte, un peu élargie (la zone claire voisine peut appartenir à l'autre cadre)
          const m = (g.lh || 20) * 0.6;
          if (!v) { if (prev) bb.y0 = (hi(prev) + g.y0) / 2; if (next) bb.y1 = (g.y1 + lo(next)) / 2; bb.x0 = Math.max(bb.x0, g.x0 - m); bb.x1 = Math.min(bb.x1, g.x1 + m); }
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
    const g = out.find(g => !g.vertical && (() => { const gap = it.y0 - g.y1, lh = Math.max(g.lh, it.h), cx = (it.x0 + it.x1) / 2, gcx = (g.x0 + g.x1) / 2; const overlap = Math.min(g.x1, it.x1) - Math.max(g.x0, it.x0); return gap < lh * 0.9 && gap > -lh * 0.6 && (overlap > -lh * 0.3 || Math.abs(cx - gcx) < lh * 2); })());
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y1 = Math.max(g.y1, it.y1); g.parts.push(it.text); g.lh = Math.max(g.lh, it.h); g.hs.push(it.h); }
    else out.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, parts: [it.text], lh: it.h, hs: [it.h], vertical: false });
  }
  vert.sort((a, b) => b.x1 - a.x1);
  for (const it of vert) {
    const g = out.find(g => g.vertical && (() => { const gap = g.x0 - it.x1, cw = Math.max(g.cw, it.w); const ov = Math.min(g.y1, it.y1) - Math.max(g.y0, it.y0); return gap < cw * 1.0 && gap > -cw && ov > -cw; })());
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y0 = Math.min(g.y0, it.y0); g.y1 = Math.max(g.y1, it.y1); g.parts.push(it.text); g.cw = Math.max(g.cw, it.w); g.hs.push(it.w); }
    else out.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, parts: [it.text], cw: it.w, hs: [it.w], vertical: true });
  }
  return out.map(g => {
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
    return { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, text: text.trim(), parts: g.parts, vertical: g.vertical, lh, n: g.parts.length };
  }).filter(g => g.text.replace(/\s/g, '').length >= (isCJK(g.text) ? 1 : 2));
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
      for (const b of await detect(part)) boxes.push({ ...b, y0: b.y0 + y0, y1: b.y1 + y0 });
    }
    // doublons dans les zones de chevauchement
    boxes.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
    boxes = boxes.filter((b, i) => !boxes.slice(0, i).some(a => { const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return ix > 0 && iy > 0 && ix * iy > 0.5 * (b.x1 - b.x0) * (b.y1 - b.y0); }));
  } else boxes = await detect(img, 2048);
  // choix du modèle de lecture : imposé, ou celui qui lit le mieux un échantillon de lignes
  let R = null, used = '';
  if (opts.model && installed().includes(opts.model)) { R = await recOf(opts.model); used = opts.model; }
  else if (opts.auto !== false && installed().length && boxes.length) {
    const sample = boxes.slice().sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0)).slice(0, 6);
    const mean = async RR => { let s = 0; for (const b of sample) s += (await recognize(img, b, RR)).score; return s / sample.length; };
    let best = await mean(null);
    if (best < 0.9) for (const id of installed()) { const RR = await recOf(id); const m = await mean(RR); if (m > best + 0.04) { best = m; R = RR; used = id; } }
  }
  let bm = null; try { bm = bubbleMap(img); bm.dk = bubbleMap(img, true); } catch {}
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
    }
    const l = { ...b, ...r };
    const c = bm ? (bm.of(l) || bm.dk.of(l)) : null, k = bkey(c);
    // ligne un peu moins sûre (« IN », « GUT ») : gardée si elle est dans une vraie bulle
    if (good(l) || (good(l, 0.45) && c)) { lines.push(l); if (k) kept.set(k, (kept.get(k) || 0) + 1); }
    else if (k) fails.set(k, (fails.get(k) || 0) + 1);
  }
  // notes ajoutées par les traducteurs (« SFX: FWIP », « SFX : debout ») : bruitages, non traduits ;
  // zone surtout illisible (petites lettres d'une affiche, d'un panneau) : laissée telle quelle plutôt que traduite au hasard
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
  // qualité de la lecture (sert à n'envoyer à l'IA que les pages difficiles)
  const sc = lines.map(l => l.score || 0); groups.quality = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 1;
  // 1.6.9 : page en anglais (au moins un bon tiers de mots anglais : les noms des personnages n'en sont pas) :
  // lettres mal lues corrigées, mots coupés en fin de ligne recollés (même sans tiret lu) ;
  // zone devenue du charabia après correction (petites lettres d'une affiche floue) : laissée telle quelle
  try {
    const SF = require('./scan-fix');
    const txs = groups.map(g => g.text), er = SF.englishRatio(txs), fr = er >= 0.6 ? 0 : SF.frenchRatio(txs);
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
      if (sfx && (groups.lang === 'fr' || !g.bubble || (md && (g.lh || 0) > md * 1.6))) return false;
      return true;
    }), { lang: groups.lang, odd: groups.odd, quality: groups.quality, unread: groups.unread });
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
  res.model = used; res.unread = groups.unread; res.quality = groups.quality; res.odd = groups.odd || 0; res.lang = groups.lang || '';
  return res;
}

module.exports = { detect, recognize, readBubbles, SFX, load, EXTRA, EXTRA_OF, installed, download, removeModel, setDir };
