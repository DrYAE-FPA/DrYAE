// DrYAE — lecture du texte des images (traducteur de scans) avec les modèles PP-OCRv5 (PaddleOCR, Apache-2.0)
// exécutés sur le PC par ONNX Runtime (version WebAssembly, sans programme à installer).
// 1) détection : une carte de probabilité « texte » → rectangles de lignes ;
// 2) lecture : chaque ligne est lue par un modèle multilingue (français, anglais, espagnol, allemand…, japonais, chinois).
// La langue n'a pas besoin d'être choisie : le service de traduction la reconnaît ensuite.
const fs = require('fs');
const path = require('path');

let ort = null, det = null, rec = null, dict = null, loading = null;
const MODELS = () => path.dirname(require.resolve('pdfmarkdown-ppocrv5-models/package.json'));

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
async function recognize(img, b) {
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
  const out = await rec.run({ [rec.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, H, Wt]) });
  const o = out[rec.outputNames[0]], [, T, C] = o.dims, p = o.data;
  let text = '', last = 0, sc = 0, n = 0;
  for (let i = 0; i < T; i++) {
    let best = 0, bv = -1;
    for (let c = 0; c < C; c++) { const v = p[i * C + c]; if (v > bv) { bv = v; best = c; } }
    if (best !== 0 && best !== last) { text += dict[best] || ''; sc += bv; n++; }
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

// regroupe les lignes d'une même bulle
function group(lines) {
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
    const cjk = g.parts.some(isCJK);
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
async function readBubbles(img) {
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
  const lines = [];
  for (const b of boxes) {
    const r = await recognize(img, b);
    const l = { ...b, ...r };
    if (good(l)) lines.push(l);
  }
  const groups = group(lines);
  // page en écriture latine : on ignore les petits signes japonais/chinois isolés (bruitages dessinés)
  const latin = groups.filter(g => !isCJK(g.text)).length, cjk = groups.length - latin;
  return latin > cjk ? groups.filter(g => !(isCJK(g.text) && g.text.replace(/[\s\p{P}]/gu, '').length <= 2)) : groups;
}

module.exports = { readBubbles, load };
