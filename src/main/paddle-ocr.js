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
async function recognize(img, b, R) {
  R = R || { sess: rec, dict };
  const { width: W, data } = img;
  let bw = Math.round(b.x1 - b.x0), bh = Math.round(b.y1 - b.y0);
  if (bw < 4 || bh < 4) return { text: '', score: 0 };
  // colonne verticale (japonais, chinois) : on la tourne pour la lire comme une ligne
  const vertical = bh > bw * 1.5;
  const cw = vertical ? bh : bw, ch = vertical ? bw : bh;
  const H = 48, Wt = Math.max(48, Math.min(1600, Math.ceil(H * cw / ch)));
  const t = new Float32Array(3 * H * Wt);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < Wt; x++) {
      // coordonnées dans la ligne (tournée de 90° pour une colonne)
      const u = x * cw / Wt, v = y * ch / H;
      const px = vertical ? b.x0 + (ch - 1 - v) : b.x0 + u, py = vertical ? b.y0 + u : b.y0 + v;
      const p = ((Math.min(img.height - 1, Math.max(0, Math.floor(py)))) * W + Math.min(W - 1, Math.max(0, Math.floor(px)))) * 4, o = y * Wt + x;
      t[o] = data[p + 2] / 127.5 - 1; t[H * Wt + o] = data[p + 1] / 127.5 - 1; t[2 * H * Wt + o] = data[p] / 127.5 - 1;
    }
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

const isCJK = s => /[぀-ヿ㐀-鿿가-힯]/.test(s);
// ligne à garder : assez sûre, avec de vraies lettres (pas un dessin lu comme du texte)
function good(l) {
  const s = l.text.replace(/\s+/g, '');
  if (!s || l.score < 0.6) return false;
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (isCJK(s)) return letters >= 1;
  return letters >= 2 && letters / s.length >= 0.5;
}

// ---- bulles : zones claires fermées autour du texte (repérées sur une image réduite) ----
// Deux lignes dans la même zone claire = même bulle ; deux bulles collées restent séparées.
// Donne aussi le contour et la couleur de fond de la bulle (pour effacer proprement le texte d'origine).
function bubbleMap(img) {
  const { width: W, height: H, data } = img;
  const k = Math.min(1, 700 / Math.max(W, 1), 2400 / Math.max(H, 1));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const lum = new Uint8Array(w * h), col = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (Math.min(H - 1, Math.floor(y / k)) * W + Math.min(W - 1, Math.floor(x / k))) * 4;
    lum[y * w + x] = (data[p] * 0.3 + data[p + 1] * 0.59 + data[p + 2] * 0.11) | 0;
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
    comps.push({ n, x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k, bg: `rgb(${(r / m) | 0},${(g / m) | 0},${(b / m) | 0})` });
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
    return { id: best, ...c };
  };
  return { of };
}

// regroupe les lignes d'une même bulle
function group(lines, bm) {
  if (bm) {
    // d'abord par bulle repérée ; les lignes hors bulle sont regroupées par proximité (plus bas)
    const by = new Map(), rest = [];
    for (const l of lines) { const c = bm.of(l); if (c) { if (!by.has(c.id)) by.set(c.id, { c, ls: [] }); by.get(c.id).ls.push(l); } else rest.push(l); }
    const out = [];
    for (const { c, ls } of by.values()) {
      const vert = ls.filter(l => l.vertical).length > ls.length / 2;
      for (const g of group(ls)) out.push({ ...g, bubble: { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }, bg: c.bg });
      void vert;
    }
    // lignes d'une même bulle encore séparées (trop espacées) : on les réunit
    const merged = [], seen = new Set();
    for (const g of out) {
      if (seen.has(g)) continue;
      const same = out.filter(o => o.bubble && g.bubble && o.bubble.x0 === g.bubble.x0 && o.bubble.y0 === g.bubble.y0);
      same.forEach(o => seen.add(o));
      if (same.length === 1) { merged.push(g); continue; }
      const v = same.every(o => o.vertical);
      same.sort((a, b) => v ? b.x1 - a.x1 : a.y0 - b.y0);
      merged.push({ ...g, x0: Math.min(...same.map(o => o.x0)), y0: Math.min(...same.map(o => o.y0)), x1: Math.max(...same.map(o => o.x1)), y1: Math.max(...same.map(o => o.y1)), text: same.map(o => o.text).join(/[぀-ヿ㐀-鿿]/.test(same[0].text) ? '' : ' '), vertical: v });
    }
    return [...merged, ...group(rest)];
  }
  const items = lines.map(l => ({ ...l, h: l.y1 - l.y0, w: l.x1 - l.x0 }));
  const vert = items.filter(i => i.vertical), hor = items.filter(i => !i.vertical);
  const out = [];
  hor.sort((a, b) => a.y0 - b.y0);
  for (const it of hor) {
    const g = out.find(g => !g.vertical && (() => { const gap = it.y0 - g.y1, lh = Math.max(g.lh, it.h), cx = (it.x0 + it.x1) / 2, gcx = (g.x0 + g.x1) / 2; const overlap = Math.min(g.x1, it.x1) - Math.max(g.x0, it.x0); return gap < lh * 0.9 && gap > -lh * 0.6 && (overlap > -lh * 0.3 || Math.abs(cx - gcx) < lh * 2); })());
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y1 = Math.max(g.y1, it.y1); g.parts.push(it.text); g.lh = Math.max(g.lh, it.h); }
    else out.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, parts: [it.text], lh: it.h, vertical: false });
  }
  vert.sort((a, b) => b.x1 - a.x1);
  for (const it of vert) {
    const g = out.find(g => g.vertical && (() => { const gap = g.x0 - it.x1, cw = Math.max(g.cw, it.w); const ov = Math.min(g.y1, it.y1) - Math.max(g.y0, it.y0); return gap < cw * 1.0 && gap > -cw && ov > -cw; })());
    if (g) { g.x0 = Math.min(g.x0, it.x0); g.x1 = Math.max(g.x1, it.x1); g.y0 = Math.min(g.y0, it.y0); g.y1 = Math.max(g.y1, it.y1); g.parts.push(it.text); g.cw = Math.max(g.cw, it.w); }
    else out.push({ x0: it.x0, y0: it.y0, x1: it.x1, y1: it.y1, parts: [it.text], cw: it.w, vertical: true });
  }
  return out.map(g => {
    // japonais / chinois : lignes collées ; coréen : séparées par une espace (comme les mots)
    const cjk = g.parts.some(p => /[぀-ヿ㐀-鿿]/.test(p)) && !g.parts.some(p => /[가-힯]/.test(p));
    // « PATHETICALL » + « Y » ou « EXAM- » + « PLE » : on recolle les mots coupés en fin de ligne
    let text = '';
    for (const p of g.parts) {
      if (!text) text = p;
      else if (cjk) text += p;
      else if (/-$/.test(text) && /^\p{Ll}/u.test(p)) text = text.slice(0, -1) + p;
      else if (/^\p{L}{1,2}$/u.test(p) && /\p{L}$/.test(text) && p === p.toUpperCase() && text === text.toUpperCase() && p.length === 1) text += p;
      else text += ' ' + p;
    }
    return { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, text: text.trim(), vertical: g.vertical };
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
  } else boxes = await detect(img);
  // choix du modèle de lecture : imposé, ou celui qui lit le mieux un échantillon de lignes
  let R = null, used = '';
  if (opts.model && installed().includes(opts.model)) { R = await recOf(opts.model); used = opts.model; }
  else if (opts.auto !== false && installed().length && boxes.length) {
    const sample = boxes.slice().sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0)).slice(0, 6);
    const mean = async RR => { let s = 0; for (const b of sample) s += (await recognize(img, b, RR)).score; return s / sample.length; };
    let best = await mean(null);
    if (best < 0.9) for (const id of installed()) { const RR = await recOf(id); const m = await mean(RR); if (m > best + 0.04) { best = m; R = RR; used = id; } }
  }
  const lines = [];
  for (const b of boxes) {
    const r = await recognize(img, b, R);
    const l = { ...b, ...r };
    if (good(l)) lines.push(l);
  }
  let bm = null; try { bm = bubbleMap(img); } catch {}
  const groups = group(lines, bm);
  groups.model = used;
  // page en écriture latine : on ignore les petits signes japonais/chinois isolés (bruitages dessinés)
  const latin = groups.filter(g => !isCJK(g.text)).length, cjk = groups.length - latin;
  // beaucoup de lignes trouvées mais illisibles : écriture que ce modèle ne connaît pas (coréen, cyrillique…)
  groups.unread = boxes.length - lines.length;
  const res = latin > cjk && used !== 'korean' ? groups.filter(g => !(isCJK(g.text) && g.text.replace(/[\s\p{P}]/gu, '').length <= 2)) : groups;
  res.model = used; res.unread = groups.unread;
  return res;
}

module.exports = { readBubbles, load, EXTRA, EXTRA_OF, installed, download, removeModel, setDir };
