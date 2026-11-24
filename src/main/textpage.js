// DrYAE 1.7.2 — « mise en page fidèle » des pages de texte (crédits, notes, messages hors bulles sur un fond)
// Le texte d'une page de texte est souvent coupé en morceaux par la lecture (fond de deux couleurs : une silhouette
// derrière le texte), et les morceaux étaient rangés dans le désordre. Ici :
//   1. tous les morceaux hors bulles sont remis en vraies lignes (même hauteur, côte à côte) ;
//   2. les lignes qui se suivent, de même taille et de même couleur, forment un paragraphe (traduit en entier) ;
//   3. chaque ligne garde sa place, sa taille et sa couleur d'encre ; le fond sous la ligne est reconstruit
//      (colonne par colonne, entre le haut et le bas de la ligne) pour effacer le texte sans voiler le dessin.
// La traduction est ensuite écrite ligne après ligne dans les mêmes emplacements (voir page-preload.js).

// pixel (r,g,b) d'une image BGRA
function px(bm, W, H, x, y) {
  x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y)));
  const i = (y * W + x) * 4; return [bm[i + 2], bm[i + 1], bm[i]];
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const median = arr => { const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; };

// couleur du fond (bords de la ligne) et de l'encre (pixels bien différents du fond, à l'intérieur)
function colors(bm, W, H, b) {
  const ring = [];
  const st = Math.max(1, Math.round((b.x1 - b.x0) / 60));
  for (let x = b.x0; x <= b.x1; x += st) { ring.push(px(bm, W, H, x, b.y0 - 3), px(bm, W, H, x, b.y1 + 3)); }
  const bg = [0, 1, 2].map(k => median(ring.map(c => c[k])));
  const ink = []; const sy = Math.max(1, Math.round((b.y1 - b.y0) / 24)), sx = Math.max(1, Math.round((b.x1 - b.x0) / 120));
  for (let y = b.y0 + 1; y < b.y1; y += sy) for (let x = b.x0; x < b.x1; x += sx) { const c = px(bm, W, H, x, y); if (dist(c, bg) > 150) ink.push(c); }
  // encre : la couleur la plus « éloignée » du fond parmi celles trouvées (moyenne des 60 % les plus éloignés)
  let k = [0, 0, 0];
  if (ink.length) { ink.sort((a, c) => dist(c, bg) - dist(a, bg)); const top = ink.slice(0, Math.max(1, Math.round(ink.length * 0.6))); k = [0, 1, 2].map(j => top.reduce((s, c) => s + c[j], 0) / top.length); }
  else k = (bg[0] + bg[1] + bg[2]) / 3 > 128 ? [0, 0, 0] : [255, 255, 255];
  return { bg, ink: k };
}

// fond reconstruit sous une ligne (PNG en « data: »), colonne par colonne : du haut vers le bas de la ligne.
// Pour chaque colonne, on prend au-dessus et au-dessous le premier pixel qui n'est pas de l'encre (une ligne voisine
// très proche ne laisse donc pas de traînée), sinon la couleur du fond de la ligne.
function patch(bm, W, H, b, nativeImage) {
  // zone sûre (cadre lu, sans toucher les lignes voisines) + au-dessus et au-dessous, seulement les lettres de cette
  // ligne (jambages, accents : pixels d'encre reliés au cœur de la ligne), le reste de l'image reste visible
  const hh = b.y1 - b.y0, pv = Math.max(3, Math.round(hh * 0.14)), pu = Math.round(Math.min(pv, b.padUp ?? pv)), pd = Math.round(Math.min(pv, b.padDn ?? pv));
  const ext = Math.max(4, Math.round(hh * 0.4));
  const x0 = Math.max(0, Math.floor(b.x0 - 3)), x1 = Math.min(W - 1, Math.ceil(b.x1 + 3)), y0 = Math.max(0, Math.floor(b.y0 - ext)), y1 = Math.min(H - 1, Math.ceil(b.y1 + ext));
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 2 || h < 2) return '';
  const sy0 = Math.floor(b.y0 - pu), sy1 = Math.ceil(b.y1 + pd);
  const ink = b.ink || [0, 0, 0], bg = b.bg || [255, 255, 255], far = Math.max(90, dist(bg, ink) * 0.55);
  // pixels d'encre de la zone, puis ceux reliés au cœur de la ligne
  const isInk = new Uint8Array(w * h), mine = new Uint8Array(w * h), st = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dist(px(bm, W, H, x0 + x, y0 + y), ink) < far) isInk[y * w + x] = 1;
  const c0 = Math.max(0, Math.round(b.y0 + hh * 0.15) - y0), c1 = Math.min(h - 1, Math.round(b.y1 - hh * 0.15) - y0);
  for (let y = c0; y <= c1; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (isInk[i] && !mine[i]) { mine[i] = 1; st.push(i); } }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (isInk[j] && !mine[j]) { mine[j] = 1; st.push(j); } } }
  const pick = (x, y, dy) => { for (let k = 0; k < 14; k++) { const yy = y + dy * k; if (yy < 0 || yy >= H) break; const c = px(bm, W, H, x, yy); if (dist(c, ink) > far) return c; } return bg; };
  const top = [], bot = [];
  for (let x = x0; x <= x1; x++) { top.push(pick(x, sy0 - 1, -1)); bot.push(pick(x, sy1 + 1, 1)); }
  const sm = arr => arr.map((_, i) => [0, 1, 2].map(k => median(arr.slice(Math.max(0, i - 4), i + 5).map(c => c[k]))));
  const T = sm(top), B = sm(bot);
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const Y = y0 + y, t = Math.max(0, Math.min(1, (Y - sy0) / Math.max(1, sy1 - sy0))), safe = Y >= sy0 && Y <= sy1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // hors de la zone sûre : seulement les lettres de la ligne, un peu élargies
      let on = safe;
      if (!on) for (let dy = -2; dy <= 2 && !on; dy++) for (let dx = -2; dx <= 2 && !on; dx++) { const X = x + dx, YY = y + dy; if (X >= 0 && YY >= 0 && X < w && YY < h && mine[YY * w + X]) on = true; }
      if (!on) continue;
      // au-dessus et au-dessous de la zone sûre : couleur du fond juste à côté (au-dessus ou au-dessous)
      const a = T[x], c = B[x];
      const m = Y < sy0 ? a : Y > sy1 ? c : dist(a, c) < 40 ? [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2] : [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
      buf[i] = m[2]; buf[i + 1] = m[1]; buf[i + 2] = m[0]; buf[i + 3] = 255;
    }
  }
  try { return { x0, y0, x1: x1 + 1, y1: y1 + 1, src: 'data:image/png;base64,' + nativeImage.createFromBitmap(buf, { width: w, height: h }).toPNG().toString('base64') }; } catch { return null; }
}
// lettres de la ligne pas lues (« & » au début d'une ligne) : la ligne est élargie jusqu'à elles
function widen(bm, W, H, L, P) {
  const inkAt = (x) => { let n = 0; for (let y = L.y0 + 2; y < L.y1 - 1; y += 2) if (dist(px(bm, W, H, x, y), L.ink) < 120) n++; return n; };
  let x = Math.floor(L.x0) - 2, last = L.x0, lim = Math.max(0, Math.min(P.x0, L.x0) - L.h * 0.5);
  for (; x >= lim; x--) if (inkAt(x) >= 2) last = x; else if (last - x > L.h * 0.8) break;
  L.x0 = Math.min(L.x0, Math.max(0, last - 3));
  x = Math.ceil(L.x1) + 2; last = L.x1; lim = Math.min(W - 1, Math.max(P.x1, L.x1) + L.h * 0.5);
  for (; x <= lim; x++) if (inkAt(x) >= 2) last = x; else if (x - last > L.h * 0.8) break;
  L.x1 = Math.max(L.x1, Math.min(W - 1, last + 3));
}

// page de texte ? beaucoup de morceaux hors bulles, et peu de bulles
function isTextPage(groups) {
  const out = groups.filter(g => !g.bubble && !g.vertical);
  const frags = out.reduce((n, g) => n + ((g.parts || []).length || 1), 0);
  const words = out.reduce((n, g) => n + (String(g.text).match(/[\p{L}\d]+/gu) || []).length, 0);
  const bubbles = groups.filter(g => g.bubble).length;
  // (une page de BD avec quelques bulles et des bruitages n'est jamais prise pour une page de texte)
  return words >= 40 && bubbles === 0 && frags >= 12;
}

// morceaux → lignes → paragraphes. bmp : { data (BGRA), width, height }
function relayout(groups, bmp, nativeImage) {
  if (!Array.isArray(groups) || !isTextPage(groups)) return groups;
  const W = bmp.width, H = bmp.height, bm = bmp.data;
  const keep = [], frags = [];
  for (const g of groups) {
    if (g.bubble || g.vertical) { keep.push(g); continue; }
    const parts = g.parts || [g.text], boxes = g.boxes && g.boxes.length === parts.length ? g.boxes : null;
    if (!boxes) { if (parts.length === 1) frags.push({ x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, text: String(parts[0]).trim() }); else keep.push(g); continue; }
    parts.forEach((t, i) => { const q = boxes[i]; if (String(t).trim()) frags.push({ x0: q[0], y0: q[1], x1: q[2], y1: q[3], text: String(t).trim() }); });
  }
  if (frags.length < 12) return groups;
  // 1. lignes : morceaux à la même hauteur, de taille proche, assez proches en largeur
  frags.forEach(f => { f.h = f.y1 - f.y0; f.cy = (f.y0 + f.y1) / 2; });
  frags.sort((a, b) => a.cy - b.cy || a.x0 - b.x0);
  const lines = [];
  for (const f of frags) {
    const L = lines.find(l => {
      const ov = Math.min(l.y1, f.y1) - Math.max(l.y0, f.y0);
      if (ov < 0.55 * Math.min(l.h, f.h) || Math.max(l.h, f.h) / Math.min(l.h, f.h) > 1.45) return false;
      const gap = Math.max(l.x0 - f.x1, f.x0 - l.x1);
      return gap < Math.max(l.h, f.h) * (ov >= 0.75 * Math.min(l.h, f.h) ? 8 : 2.2);
    });
    if (L) { L.items.push(f); L.x0 = Math.min(L.x0, f.x0); L.x1 = Math.max(L.x1, f.x1); L.y0 = Math.min(L.y0, f.y0); L.y1 = Math.max(L.y1, f.y1); L.h = median(L.items.map(i => i.h)); }
    else lines.push({ items: [f], x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, h: f.h });
  }
  // morceaux d'une même ligne rangés dans deux lignes différentes (ordre de passage) : réunis
  const sameLine = (a, b) => { const ov = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), m = Math.min(a.h, b.h); if (ov < 0.55 * m || Math.max(a.h, b.h) / m > 1.45) return false; const gap = Math.max(a.x0 - b.x1, b.x0 - a.x1); return gap < Math.max(a.h, b.h) * (ov >= 0.75 * m ? 8 : 2.2); };
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < lines.length && !again; i++) for (let j = i + 1; j < lines.length && !again; j++) {
      const a = lines[i], b = lines[j]; if (!sameLine(a, b)) continue;
      a.items.push(...b.items); a.x0 = Math.min(a.x0, b.x0); a.x1 = Math.max(a.x1, b.x1); a.y0 = Math.min(a.y0, b.y0); a.y1 = Math.max(a.y1, b.y1); a.h = median(a.items.map(x => x.h));
      lines.splice(j, 1); again = true;
    }
  }
  for (const L of lines) {
    L.items.sort((a, b) => a.x0 - b.x0);
    L.text = L.items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
    const c = colors(bm, W, H, { x0: Math.round(L.x0), y0: Math.round(L.y0), x1: Math.round(L.x1), y1: Math.round(L.y1) });
    L.bg = c.bg; L.ink = c.ink;
  }
  lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  // espace libre au-dessus et au-dessous de chaque ligne (pour ne pas effacer la ligne voisine)
  for (const L of lines) {
    let up = 99, dn = 99;
    for (const M of lines) { if (M === L || Math.min(M.x1, L.x1) - Math.max(M.x0, L.x0) <= 0) continue; const mc = (M.y0 + M.y1) / 2, lc = (L.y0 + L.y1) / 2; if (mc < lc - L.h * 0.5) up = Math.min(up, L.y0 - M.y1); else if (mc > lc + L.h * 0.5) dn = Math.min(dn, M.y0 - L.y1); }
    // lignes qui se touchent (cadre lu un peu trop grand) : l'effacement s'arrête avant la ligne voisine
    const pad = g => g <= 2 ? g - 3 : Math.floor(g / 2) - 1;
    L.padUp = Math.max(-L.h * 0.35, pad(up)); L.padDn = Math.max(-L.h * 0.35, pad(dn));
  }
  // 2. paragraphes : lignes qui se suivent, même taille, même encre, alignées, peu d'espace entre elles
  const paras = [];
  for (const L of lines) {
    const P = paras[paras.length - 1], last = P && P.lines[P.lines.length - 1];
    const ok = last && (() => {
      const gap = L.y0 - last.y1, hh = Math.max(L.h, last.h);
      if (gap > hh * 0.75 || gap < -hh * 0.4) return false;
      if (Math.max(L.h, last.h) / Math.min(L.h, last.h) > 1.15) return false;
      if (dist(L.ink, last.ink) > 120) return false;
      return Math.min(L.x1, P.x1) - Math.max(L.x0, P.x0) > 0;
    })();
    if (ok) { P.lines.push(L); P.x0 = Math.min(P.x0, L.x0); P.x1 = Math.max(P.x1, L.x1); P.y1 = Math.max(P.y1, L.y1); }
    else paras.push({ lines: [L], x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 });
  }
  // 3. un groupe par paragraphe, avec ses emplacements de lignes (fond reconstruit, encre, hauteur)
  const made = paras.map(P => {
    const parts = P.lines.map(l => l.text);
    const slots = P.lines.map(l => {
      widen(bm, W, H, l, P);
      const p = patch(bm, W, H, l, nativeImage);
      return { x0: Math.round(l.x0), y0: Math.round(l.y0), x1: Math.round(l.x1), y1: Math.round(l.y1), h: Math.round(l.h), bg: hex(l.bg), ink: hex(l.ink), ...(p ? { patch: p } : {}) };
    });
    const cs = P.lines.map(l => (l.x0 + l.x1) / 2), x0s = P.lines.map(l => l.x0);
    const center = P.lines.length > 1 && Math.max(...cs) - Math.min(...cs) < median(P.lines.map(l => l.h)) * 0.8 && Math.max(...x0s) - Math.min(...x0s) > median(P.lines.map(l => l.h));
    let text = '';
    for (const p of parts) text = !text ? p : /\p{L}[-‐‑]$/u.test(text) && /^\p{Ll}/u.test(p) ? text.slice(0, -1) + p : text + ' ' + p;
    return { x0: P.x0, y0: P.y0, x1: P.x1, y1: P.y1, text, parts, lh: median(P.lines.map(l => l.h)), n: parts.length, bg: hex(P.lines[0].bg), slots, layout: 'lines', align: center ? 'center' : 'left', boxes: P.lines.map(l => [l.x0, l.y0, l.x1, l.y1].map(Math.round)) };
  });
  const r = [...keep, ...made];
  for (const k of Object.keys(groups)) if (!/^\d+$/.test(k)) r[k] = groups[k];
  return r;
}

module.exports = { relayout, isTextPage };
