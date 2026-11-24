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
// remplissage « du grossier au fin » : chaque trou prend la couleur moyenne de ce qui est connu autour, de plus en plus loin
function pushPull(w, h, known, getC) {
  let L = { w, h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), k: new Float32Array(w * h) };
  for (let i = 0; i < w * h; i++) if (known(i)) { const c = getC(i); L.r[i] = c[0]; L.g[i] = c[1]; L.b[i] = c[2]; L.k[i] = 1; }
  const lv = [L];
  while (L.w > 2 || L.h > 2) { const nw = Math.ceil(L.w / 2), nh = Math.ceil(L.h / 2), N = { w: nw, h: nh, r: new Float32Array(nw * nh), g: new Float32Array(nw * nh), b: new Float32Array(nw * nh), k: new Float32Array(nw * nh) };
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { let r = 0, g = 0, b = 0, kk = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = 2 * x + dx, Y = 2 * y + dy; if (X >= L.w || Y >= L.h) continue; const i = Y * L.w + X, q = L.k[i]; r += L.r[i] * q; g += L.g[i] * q; b += L.b[i] * q; kk += q; }
      const i = y * nw + x; if (kk > 0) { N.r[i] = r / kk; N.g[i] = g / kk; N.b[i] = b / kk; } N.k[i] = Math.min(1, kk); }
    lv.push(N); L = N; if (lv.length > 14) break; }
  for (let l = lv.length - 2; l >= 0; l--) { const Fl = lv[l], C = lv[l + 1];
    for (let y = 0; y < Fl.h; y++) for (let x = 0; x < Fl.w; x++) { const i = y * Fl.w + x; if (Fl.k[i] >= 1) continue;
      const fx = Math.max(0, Math.min(C.w - 1, (x - 0.5) / 2)), fy = Math.max(0, Math.min(C.h - 1, (y - 0.5) / 2)), ax = Math.floor(fx), ay = Math.floor(fy), bx = Math.min(C.w - 1, ax + 1), by = Math.min(C.h - 1, ay + 1), tx = fx - ax, ty = fy - ay;
      const at = (Ar, X, Y) => Ar[Y * C.w + X], bil = Ar => (at(Ar, ax, ay) * (1 - tx) + at(Ar, bx, ay) * tx) * (1 - ty) + (at(Ar, ax, by) * (1 - tx) + at(Ar, bx, by) * tx) * ty;
      const q = Fl.k[i]; Fl.r[i] = Fl.r[i] * q + bil(C.r) * (1 - q); Fl.g[i] = Fl.g[i] * q + bil(C.g) * (1 - q); Fl.b[i] = Fl.b[i] * q + bil(C.b) * (1 - q); Fl.k[i] = 1; } }
  return lv[0];
}

function lineMask(bm, W, H, b) {
  // 1.7.2 (demande de l'utilisateur : « l'image ne doit pas perdre sa qualité ») : seules les lettres sont effacées.
  // Pixels d'encre de la ligne (dans le cadre lu, ou reliés au cœur de la ligne pour les jambages et accents), un peu
  // élargis pour l'anticrénelage ; chacun est reconstruit à partir des pixels voisins qui ne sont pas des lettres,
  // de l'extérieur vers l'intérieur. Partout ailleurs, l'image d'origine reste telle quelle (pixels transparents).
  const hh = b.y1 - b.y0, pv = Math.max(3, Math.round(hh * 0.14)), pu = Math.round(Math.min(pv, b.padUp ?? pv)), pd = Math.round(Math.min(pv, b.padDn ?? pv));
  const ext = Math.max(4, Math.round(hh * 0.4)), R = Math.max(3, Math.round(hh * 0.15)); // assez large pour le contour clair des lettres (lettrage avec bord blanc)
  const x0 = Math.max(0, Math.floor(b.x0 - 3 - R)), x1 = Math.min(W - 1, Math.ceil(b.x1 + 3 + R)), y0 = Math.max(0, Math.floor(b.y0 - ext)), y1 = Math.min(H - 1, Math.ceil(b.y1 + ext));
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 2 || h < 2) return null;
  const sy0 = Math.floor(b.y0 - pu) - y0, sy1 = Math.ceil(b.y1 + pd) - y0, sx0 = Math.floor(b.x0 - 3) - x0, sx1 = Math.ceil(b.x1 + 3) - x0;
  // jamais sur la ligne voisine : on s'arrête juste avant elle
  // (cadres lus qui se chevauchent : on peut aller un peu au-delà, jusqu'au cœur de la ligne voisine, en suivant les lettres)
  const gy0 = Math.floor(b.y0 - Math.max(0, Math.min(ext, (b.gapUp ?? 99) + hh * 0.25))) - y0, gy1 = Math.ceil(b.y1 + Math.max(0, Math.min(ext, (b.gapDn ?? 99) + hh * 0.25))) - y0;
  const ink = b.ink || [0, 0, 0], bg = b.bg || [255, 255, 255], far = Math.max(90, dist(bg, ink) * 0.55);
  const col = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = px(bm, W, H, x0 + x, y0 + y), i = (y * w + x) * 3; col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2]; }
  // fond attendu sous la ligne, colonne par colonne (premier pixel au-dessus et au-dessous qui n'est pas de l'encre)
  const pick = (x, yy, dy) => { for (let k = 0; k < 16; k++) { const Y = yy + dy * k; if (Y < 0 || Y >= H) break; const c = px(bm, W, H, x0 + x, Y); if (dist(c, ink) > far) return c; } return bg; };
  const sm = arr => arr.map((_, i) => [0, 1, 2].map(k => median(arr.slice(Math.max(0, i - 3), i + 4).map(c => c[k]))));
  // un peu à l'écart de la ligne (le contour clair des lettres ne compte pas comme fond), médiane de plusieurs pixels
  const off = R + 2;
  const pickM = (x, yy, dy) => { const v = []; for (let k = 0; k < 7; k++) { const c = pick(x, yy + dy * (off + k), dy); v.push(c); } return [0, 1, 2].map(j => median(v.map(c => c[j]))); };
  const T = [], Bo = []; for (let x = 0; x < w; x++) { T.push(pickM(x, y0 + Math.max(0, sy0) - 1, -1)); Bo.push(pickM(x, y0 + Math.min(h - 1, sy1) + 1, 1)); }
  const TT = sm(T), BB = sm(Bo);
  // 1.7.2 (2e demande : « l'image doit rester identique ») : masque serré. Seule l'encre des lettres (reliée au cœur de
  // la ligne pour les jambages et accents) + son bord adouci / contour, cherché à quelques pixels seulement de l'encre :
  // la silhouette et le reste du dessin ne sont jamais pris, même juste à côté.
  const isInk = i => Math.abs(col[i * 3] - ink[0]) + Math.abs(col[i * 3 + 1] - ink[1]) + Math.abs(col[i * 3 + 2] - ink[2]) < far;
  const mine = new Uint8Array(w * h), st = [];
  for (let y = Math.max(0, sy0); y <= Math.min(h - 1, sy1); y++) for (let x = Math.max(0, sx0); x <= Math.min(w - 1, sx1); x++) { const i = y * w + x; if (isInk(i)) { mine[i] = 1; st.push(i); } }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!mine[j] && (Y < sy0 || Y > sy1) && Y >= gy0 && Y <= gy1 && isInk(j)) { mine[j] = 1; st.push(j); } } }
  // distance à l'encre (en pixels, jusqu'à RH)
  const RH = Math.max(3, Math.round(hh * 0.12)), dd = new Uint8Array(w * h).fill(255), q = [];
  for (let i = 0; i < w * h; i++) if (mine[i]) { dd[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % w, y = (i / w) | 0, d = dd[i] + 1; if (d > RH) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (dd[j] > d) { dd[j] = d; q.push(j); } } }
  // distance à n'importe quelle encre de la zone (les lignes voisines ont aussi leur contour clair)
  const da = new Uint8Array(w * h).fill(255), qa = [];
  for (let i = 0; i < w * h; i++) if (isInk(i)) { da[i] = 0; qa.push(i); }
  for (let k = 0; k < qa.length; k++) { const i = qa[k], x = i % w, y = (i / w) | 0, d = da[i] + 1; if (d > RH + 2) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (da[j] > d) { da[j] = d; qa.push(j); } } }
  // fond tout autour (loin de toute encre) : couleurs les plus fréquentes
  const qk = (r, g, bl) => (r >> 4) << 8 | (g >> 4) << 4 | (bl >> 4);
  const hist = new Map(); let tot = 0;
  for (let i = 0; i < w * h; i++) { if (da[i] <= RH + 2) continue; const k = qk(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); hist.set(k, (hist.get(k) || 0) + 1); tot++; }
  const pal = new Set(); for (const [k, n] of hist) if (n >= Math.max(8, tot * 0.01)) pal.add(k);
  const inPal = (r, g, bl) => { const R0 = r >> 4, G0 = g >> 4, B0 = bl >> 4; for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) if (pal.has((R0 + dr) << 8 | (G0 + dg) << 4 | (B0 + db))) return true; return false; };
  // bord des lettres : près de l'encre, couleur absente du fond, et relié à l'encre par d'autres pixels de bord
  const mask = new Uint8Array(w * h), st2 = [];
  for (let i = 0; i < w * h; i++) if (mine[i]) { mask[i] = 1; st2.push(i); }
  while (st2.length) { const i = st2.pop(), x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (mask[j] || dd[j] > RH) continue; if (dd[j] <= 2 || (pal.size && !inPal(col[j * 3], col[j * 3 + 1], col[j * 3 + 2]))) { mask[j] = 1; st2.push(j); } } }
  // contour clair (ou foncé) autour des lettres : comparé au fond tout proche (estimé à partir des pixels plus loin de
  // toute encre), tout pixel près de l'encre qui en diffère nettement fait partie de la lettre
  const DM = RH + 5, dd2 = new Uint8Array(w * h).fill(255), q2 = [];
  for (let i = 0; i < w * h; i++) if (mine[i]) { dd2[i] = 0; q2.push(i); }
  for (let k = 0; k < q2.length; k++) { const i = q2[k], x = i % w, y = (i / w) | 0, d = dd2[i] + 1; if (d > DM) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (dd2[j] > d) { dd2[j] = d; q2.push(j); } } }
  const LB = pushPull(w, h, i => da[i] > DM, i => [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]]);
  const st3 = []; for (let i = 0; i < w * h; i++) if (mask[i]) st3.push(i);
  while (st3.length) { const i = st3.pop(), x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (mask[j] || dd2[j] > DM) continue;
    if (dist([col[j * 3], col[j * 3 + 1], col[j * 3 + 2]], [LB.r[j], LB.g[j], LB.b[j]]) > 9) { mask[j] = 1; st3.push(j); } } }
  // + 1 pixel (dernier reflet du bord, compression JPEG)
  const m2 = new Uint8Array(mask);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) m2[Y * w + X] = 1; }
  mask.set(m2);
  return { x0, y0, w, h, mask };
}

// fond de toute la page reconstruit d'un coup sous l'ensemble des lettres (les lignes serrées ne laissent presque pas
// de fond entre elles : chaque ligne seule n'aurait rien pour se refaire). Remplissage « du grossier au fin » à partir
// de tout le fond visible autour, puis chaque pixel refait est ramené à la couleur du fond la plus proche (bord net
// de la silhouette, pas de couleur inventée). Hors des lettres, rien ne change.
function fillPage(bm, W, H, ms) {
  let X0 = W, Y0 = H, X1 = 0, Y1 = 0;
  for (const m of ms) if (m) { X0 = Math.min(X0, m.x0); Y0 = Math.min(Y0, m.y0); X1 = Math.max(X1, m.x0 + m.w - 1); Y1 = Math.max(Y1, m.y0 + m.h - 1); }
  if (X1 < X0) return null;
  const M = 48; X0 = Math.max(0, X0 - M); Y0 = Math.max(0, Y0 - M); X1 = Math.min(W - 1, X1 + M); Y1 = Math.min(H - 1, Y1 + M);
  const w = X1 - X0 + 1, h = Y1 - Y0 + 1, hole = new Uint8Array(w * h);
  for (const m of ms) if (m) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.mask[y * m.w + x]) hole[(m.y0 + y - Y0) * w + (m.x0 + x - X0)] = 1;
  // marge de sécurité de 3 pixels : le bord adouci des lettres ne sert jamais de fond
  const bad = new Uint8Array(hole);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (hole[y * w + x]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) bad[Y * w + X] = 1; }
  // niveau 0
  let L = { w, h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), k: new Float32Array(w * h) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, j = ((Y0 + y) * W + X0 + x) * 4; if (bad[i]) continue; L.r[i] = bm[j + 2]; L.g[i] = bm[j + 1]; L.b[i] = bm[j]; L.k[i] = 1; }
  const levels = [L];
  while (L.w > 2 || L.h > 2) {
    const nw = Math.ceil(L.w / 2), nh = Math.ceil(L.h / 2), N = { w: nw, h: nh, r: new Float32Array(nw * nh), g: new Float32Array(nw * nh), b: new Float32Array(nw * nh), k: new Float32Array(nw * nh) };
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { let r = 0, g = 0, b = 0, k = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = 2 * x + dx, Y = 2 * y + dy; if (X >= L.w || Y >= L.h) continue; const i = Y * L.w + X, kk = L.k[i]; r += L.r[i] * kk; g += L.g[i] * kk; b += L.b[i] * kk; k += kk; }
      const i = y * nw + x; if (k > 0) { N.r[i] = r / k; N.g[i] = g / k; N.b[i] = b / k; } N.k[i] = Math.min(1, k); }
    levels.push(N); L = N; if (levels.length > 14) break;
  }
  for (let l = levels.length - 2; l >= 0; l--) {
    const F = levels[l], C = levels[l + 1];
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) { const i = y * F.w + x; if (F.k[i] >= 1) continue;
      // couleur du niveau grossier, interpolée
      const fx = Math.max(0, Math.min(C.w - 1, (x - 0.5) / 2)), fy = Math.max(0, Math.min(C.h - 1, (y - 0.5) / 2)), ax = Math.floor(fx), ay = Math.floor(fy), bx = Math.min(C.w - 1, ax + 1), by = Math.min(C.h - 1, ay + 1), tx = fx - ax, ty = fy - ay;
      const at = (A, X, Y) => A[Y * C.w + X], bil = A => (at(A, ax, ay) * (1 - tx) + at(A, bx, ay) * tx) * (1 - ty) + (at(A, ax, by) * (1 - tx) + at(A, bx, by) * tx) * ty;
      const k = F.k[i]; F.r[i] = F.r[i] * k + bil(C.r) * (1 - k); F.g[i] = F.g[i] * k + bil(C.g) * (1 - k); F.b[i] = F.b[i] * k + bil(C.b) * (1 - k); F.k[i] = 1; }
  }
  const F = levels[0];
  // 1.7.2 : en travers de chaque trait de lettre, par le chemin le plus court (8 directions) : couleur interpolée entre
  // les deux bords connus. Un bord de silhouette qui passe sous une lettre continue ainsi tout droit, sans bavure.
  const dirs = []; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 8; dirs.push([Math.cos(a), Math.sin(a)]); }
  const LMAX = 80, near = (x, y, dx, dy) => { for (let t = 1; t <= LMAX; t++) { const X = Math.round(x + dx * t), Y = Math.round(y + dy * t); if (X < 0 || Y < 0 || X >= w || Y >= h) return null; const j = Y * w + X; if (!bad[j]) return [t, j]; } return null; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!hole[i]) continue;
    // toutes les traversées comptent, les plus courtes beaucoup plus (résultat régulier d'un pixel à l'autre)
    let r = 0, g = 0, bl = 0, wt = 0, lmin = 1e9; const cr = [];
    for (const [dx, dy] of dirs) { const A = near(x, y, dx, dy); if (!A) continue; const B = near(x, y, -dx, -dy); if (!B) continue; const len = A[0] + B[0]; lmin = Math.min(lmin, len); cr.push([len, A, B]); }
    if (!cr.length) continue;
    for (const [len, A, B] of cr) { if (len > lmin * 2) continue; const q = 1 / Math.pow(len, 4), t = B[0] / len, ja = ((Y0 + ((A[1] / w) | 0)) * W + X0 + A[1] % w) * 4, jb = ((Y0 + ((B[1] / w) | 0)) * W + X0 + B[1] % w) * 4;
      r += q * (bm[ja + 2] * t + bm[jb + 2] * (1 - t)); g += q * (bm[ja + 1] * t + bm[jb + 1] * (1 - t)); bl += q * (bm[ja] * t + bm[jb] * (1 - t)); wt += q; }
    F.r[i] = r / wt; F.g[i] = g / wt; F.b[i] = bl / wt;
  }
  // couleurs du fond autour des lettres (les plus fréquentes, juste à côté des trous)
  const hist = new Map(); let tot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (bad[i]) continue; let near = false; for (let d = 3; d <= 12 && !near; d += 3) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && hole[Y * w + X]) { near = true; break; } } if (!near) continue;
    const j = ((Y0 + y) * W + X0 + x) * 4, k = (bm[j + 2] >> 4) << 8 | (bm[j + 1] >> 4) << 4 | (bm[j] >> 4), e = hist.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += bm[j + 2]; e.g += bm[j + 1]; e.b += bm[j]; hist.set(k, e); tot++; }
  const pal = [];
  for (const [, e] of [...hist.entries()].sort((a, b) => b[1].n - a[1].n)) { if (e.n < tot * 0.03) break; const c = [e.r / e.n, e.g / e.n, e.b / e.n]; const m = pal.find(p => dist(p.c, c) < 30); if (m) { m.c = m.c.map((v, q) => (v * m.n + c[q] * e.n) / (m.n + e.n)); m.n += e.n; } else pal.push({ c, n: e.n }); if (pal.length >= 6) break; }
  const out = new Uint8ClampedArray(w * h * 3);
  for (let i = 0; i < w * h; i++) if (hole[i]) { out[i * 3] = F.r[i]; out[i * 3 + 1] = F.g[i]; out[i * 3 + 2] = F.b[i]; }
  // 1.7.2 (3e demande : « l'image doit être identique ») : fond à deux couleurs (ex. gris + silhouette bleue).
  // Le bord entre les deux est prolongé sous les lettres : là où il entre dans une lettre, on mesure sa direction et on
  // la suit tout droit (moyenne des bords les plus proches) ; chaque côté est ensuite rempli avec sa propre couleur,
  // prise uniquement de son côté. Bord net et à sa place, sans bavure ni marches d'escalier.
  if (pal.length >= 2) {
    const A = pal[0].c, Bc = pal[1].c, sep = dist(A, Bc);
    if (sep > 30) {
      const lab = new Int8Array(w * h).fill(-1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (bad[i]) continue; const j = ((Y0 + y) * W + X0 + x) * 4, c = [bm[j + 2], bm[j + 1], bm[j]]; lab[i] = dist(c, A) <= dist(c, Bc) ? 0 : 1; }
      // points du bord, juste à côté des lettres
      const G = 24, gw = Math.ceil(w / G), gh = Math.ceil(h / G), grid = Array.from({ length: gw * gh }, () => []);
      const nearHole = (x, y) => { for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && hole[Y * w + X]) return true; } return false; };
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (lab[i] < 0) continue; if (!((lab[i + 1] >= 0 && lab[i + 1] !== lab[i]) || (lab[i + w] >= 0 && lab[i + w] !== lab[i]))) continue; if (!nearHole(x, y) || bad[i]) continue; if (hole[i - 3] || hole[i + 3] || hole[i - 3 * w] || hole[i + 3 * w]) continue;
        // direction du bord : vers le côté B, mesurée sur les pixels connus autour (rayon 6)
        let nx = 0, ny = 0, n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const l = lab[Y * w + X]; if (l < 0) continue; nx += dx * (l - 0.5); ny += dy * (l - 0.5); n++; }
        const L = Math.hypot(nx, ny); if (L < n * 0.4) continue; // pas un vrai bord net (bruit)
        const ux = nx / L, uy = ny / L;
        // le bord continue-t-il vraiment de l'autre côté de la lettre ? (même direction, même côtés) — sinon (bord qui
        // ne fait que frôler la lettre, ou qui tourne), il ne compte que tout près de lui
        let ok = false;
        const lab3 = (X, Y) => { X = Math.round(X); Y = Math.round(Y); return X < 0 || Y < 0 || X >= w || Y >= h ? -1 : lab[Y * w + X]; };
        for (const sg of [1, -1]) { let crossed = false; for (let k = 2; k <= LMAX; k++) { const X = x + 0.5 - uy * k * sg, Y = y + 0.5 + ux * k * sg, Xi = Math.round(X), Yi = Math.round(Y); if (Xi < 0 || Yi < 0 || Xi >= w || Yi >= h) break; const j = Yi * w + Xi;
            if (hole[j]) { crossed = true; continue; } if (bad[j]) continue; if (!crossed) continue;
            let good = false; for (let o = -3; o <= 3 && !good; o++) { const Xo = X - uy * o * sg, Yo = Y + ux * o * sg; const a = lab3(Xo + ux * 4, Yo + uy * 4), b = lab3(Xo - ux * 4, Yo - uy * 4); if (a === 1 && b === 0) good = true; }
            ok = good; break; }
          if (ok) break; }
        grid[((y / G) | 0) * gw + ((x / G) | 0)].push([x + 0.5, y + 0.5, ux, uy, ok ? 1 : 0]); }
      const RT = 72;
      const side = new Float32Array(w * h).fill(NaN);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!hole[i]) continue;
        let sw = 0, ss = 0, gx = (x / G) | 0, gy = (y / G) | 0, R = Math.ceil(RT / G);
        let dmin = 1e9; const cand = [];
        for (let cy = Math.max(0, gy - R); cy <= Math.min(gh - 1, gy + R); cy++) for (let cx = Math.max(0, gx - R); cx <= Math.min(gw - 1, gx + R); cx++) for (const t of grid[cy * gw + cx]) { const d2 = (t[0] - x) ** 2 + (t[1] - y) ** 2; if (d2 > (t[4] ? RT * RT : RT * RT / 9)) continue; cand.push([d2, t]); if (d2 < dmin) dmin = d2; }
        if (!cand.length) continue;
        for (const [d2, t] of cand) { if (d2 > dmin * 6 + 64) continue; const wgt = 1 / (d2 + 4) ** 1.5; ss += wgt * ((x + 0.5 - t[0]) * t[2] + (y + 0.5 - t[1]) * t[3]); sw += wgt; }
        side[i] = ss / sw; }
      // remplissage de chaque côté avec ses seules couleurs (du grossier au fin)
      // couleurs prises un peu plus loin des lettres (le dernier reflet du bord, même invisible, éclaircissait le remplissage)
      const far6 = new Uint8Array(bad); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (hole[y * w + x]) for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) far6[Y * w + X] = 1; }
      const fillSide = k => { let L = { w, h, r: new Float32Array(w * h), g: new Float32Array(w * h), b: new Float32Array(w * h), k: new Float32Array(w * h) };
        for (let i = 0; i < w * h; i++) if (lab[i] === k && !far6[i]) { const j = ((Y0 + ((i / w) | 0)) * W + X0 + i % w) * 4; L.r[i] = bm[j + 2]; L.g[i] = bm[j + 1]; L.b[i] = bm[j]; L.k[i] = 1; }
        const lv = [L];
        while (L.w > 2 || L.h > 2) { const nw = Math.ceil(L.w / 2), nh = Math.ceil(L.h / 2), N = { w: nw, h: nh, r: new Float32Array(nw * nh), g: new Float32Array(nw * nh), b: new Float32Array(nw * nh), k: new Float32Array(nw * nh) };
          for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { let r = 0, g = 0, b = 0, kk = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = 2 * x + dx, Y = 2 * y + dy; if (X >= L.w || Y >= L.h) continue; const i = Y * L.w + X, q = L.k[i]; r += L.r[i] * q; g += L.g[i] * q; b += L.b[i] * q; kk += q; }
            const i = y * nw + x; if (kk > 0) { N.r[i] = r / kk; N.g[i] = g / kk; N.b[i] = b / kk; } N.k[i] = Math.min(1, kk); }
          lv.push(N); L = N; if (lv.length > 14) break; }
        for (let l = lv.length - 2; l >= 0; l--) { const Fl = lv[l], C = lv[l + 1];
          for (let y = 0; y < Fl.h; y++) for (let x = 0; x < Fl.w; x++) { const i = y * Fl.w + x; if (Fl.k[i] >= 1) continue;
            const fx = Math.max(0, Math.min(C.w - 1, (x - 0.5) / 2)), fy = Math.max(0, Math.min(C.h - 1, (y - 0.5) / 2)), ax = Math.floor(fx), ay = Math.floor(fy), bx = Math.min(C.w - 1, ax + 1), by = Math.min(C.h - 1, ay + 1), tx = fx - ax, ty = fy - ay;
            const at = (Ar, X, Y) => Ar[Y * C.w + X], bil = Ar => (at(Ar, ax, ay) * (1 - tx) + at(Ar, bx, ay) * tx) * (1 - ty) + (at(Ar, ax, by) * (1 - tx) + at(Ar, bx, by) * tx) * ty;
            const q = Fl.k[i]; Fl.r[i] = Fl.r[i] * q + bil(C.r) * (1 - q); Fl.g[i] = Fl.g[i] * q + bil(C.g) * (1 - q); Fl.b[i] = Fl.b[i] * q + bil(C.b) * (1 - q); Fl.k[i] = 1; } }
        return lv[0]; };
      const S0 = fillSide(0), S1 = fillSide(1);
      for (let i = 0; i < w * h; i++) if (hole[i] && Number.isNaN(side[i])) { const f = [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]]; side[i] = dist(f, A) <= dist(f, Bc) ? -9 : 9; }
      // bord lissé (pas de marches d'escalier) : moyenne locale du côté, dans les lettres seulement
      for (let pass = 0; pass < 3; pass++) { const s2 = new Float32Array(side);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!hole[i]) continue; let a = 0, n = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!hole[j]) continue; a += Math.max(-6, Math.min(6, side[j])); n++; }
          s2[i] = a / n; }
        side.set(s2); }
      for (let i = 0; i < w * h; i++) { if (!hole[i]) continue; const s = side[i];
        const t = Math.max(0, Math.min(1, 0.5 + s / 1.6)); // bord adouci sur ~1,5 pixel, comme l'original
        out[i * 3] = S0.r[i] * (1 - t) + S1.r[i] * t; out[i * 3 + 1] = S0.g[i] * (1 - t) + S1.g[i] * t; out[i * 3 + 2] = S0.b[i] * (1 - t) + S1.b[i] * t; }
    }
  }
  return { X0, Y0, w, h, out };
}
function patchFrom(fp, m, nativeImage) {
  if (!fp || !m) return null;
  const buf = Buffer.alloc(m.w * m.h * 4);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; if (!m.mask[i]) continue; const k = ((m.y0 + y - fp.Y0) * fp.w + (m.x0 + x - fp.X0)) * 3, o = i * 4; buf[o] = fp.out[k + 2]; buf[o + 1] = fp.out[k + 1]; buf[o + 2] = fp.out[k]; buf[o + 3] = 255; }
  try { return { x0: m.x0, y0: m.y0, x1: m.x0 + m.w, y1: m.y0 + m.h, src: 'data:image/png;base64,' + nativeImage.createFromBitmap(buf, { width: m.w, height: m.h }).toPNG().toString('base64') }; } catch { return null; }
}
// lettres de la ligne pas lues (« & » au début d'une ligne) : la ligne est élargie jusqu'à elles
function widen(bm, W, H, L, P) {
  const inkAt = (x) => { let n = 0; for (let y = L.y0 + 2; y < L.y1 - 1; y += 2) if (dist(px(bm, W, H, x, y), L.ink) < 120) n++; return n; };
  let x = Math.floor(L.x0) - 2, last = L.x0, lim = Math.max(0, Math.min(P.x0, L.x0) - L.h * 0.5), first = null, top = 0;
  for (; x >= lim; x--) { const n = inkAt(x); if (n >= 2) { last = x; if (first === null) first = x; top = Math.max(top, n); } else if (last - x > L.h * 0.8) break; }
  // un seul signe pas lu au début de la ligne, haut comme une lettre et séparé du mot suivant : c'est presque toujours « & »
  if (first !== null) { const gw = first - last, gap = L.x0 - first, half = (L.y1 - L.y0 - 3) / 2; L.lead = gw >= L.h * 0.4 && gw <= L.h * 1.1 && gap >= L.h * 0.12 && top >= half * 0.5; }
  L.x0 = Math.min(L.x0, Math.max(0, last - 3));
  x = Math.ceil(L.x1) + 2; last = L.x1; lim = Math.min(W - 1, Math.max(P.x1, L.x1) + L.h * 0.5);
  first = null; top = 0;
  for (; x <= lim; x++) { const n = inkAt(x); if (n >= 2) { last = x; if (first === null) first = x; top = Math.max(top, n); } else if (x - last > L.h * 0.8) break; }
  if (first !== null) { const gw = last - first, gap = first - L.x1, half = (L.y1 - L.y0 - 3) / 2; L.trail = gw >= L.h * 0.4 && gw <= L.h * 1.1 && gap >= L.h * 0.12 && top >= half * 0.5; }
  L.x1 = Math.max(L.x1, Math.min(W - 1, last + 3));
}

// signe pas lu entre deux morceaux d'une ligne (« THEIR WORK & STOP ») : « & » remis dans le texte
function midGlyphs(bm, W, H, L) {
  if (!L.items || L.items.length < 2) return;
  const inkAt = (x) => { let n = 0; for (let y = L.y0 + 2; y < L.y1 - 1; y += 2) if (dist(px(bm, W, H, x, y), L.ink) < 120) n++; return n; };
  const half = (L.y1 - L.y0 - 3) / 2, out = [L.items[0].text];
  for (let k = 1; k < L.items.length; k++) {
    const a = L.items[k - 1], b = L.items[k]; let first = null, last = null, top = 0;
    for (let x = Math.ceil(a.x1) + 1; x < Math.floor(b.x0) - 1; x++) { const n = inkAt(x); if (n >= 2) { if (first === null) first = x; last = x; top = Math.max(top, n); } }
    if (first !== null && !/&$/.test(a.text) && !/^&/.test(b.text)) { const gw = last - first; if (gw >= L.h * 0.4 && gw <= L.h * 1.1 && first - a.x1 >= L.h * 0.12 && b.x0 - last >= L.h * 0.12 && top >= half * 0.5) out.push('&'); }
    out.push(b.text);
  }
  L.text = out.join(' ').replace(/\s+/g, ' ').trim();
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
    L.padUp = Math.max(-L.h * 0.35, pad(up)); L.padDn = Math.max(-L.h * 0.35, pad(dn)); L.gapUp = up; L.gapDn = dn;
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
  for (const P of paras) P.lines.forEach((l, i) => {
    midGlyphs(bm, W, H, l); widen(bm, W, H, l, P); l.m = lineMask(bm, W, H, l);
    if (l.lead && i > 0 && !/^[&+]/.test(l.text)) l.text = '& ' + l.text;
    if (l.trail && i < P.lines.length - 1 && !/[&+.!?,:;]$/.test(l.text)) l.text += ' &';
    // phrase en minuscules coupée en lignes : petit mot de liaison avec une majuscule en début de ligne (« … fournies Par les »)
    if (i > 0 && !/[.!?:]$/.test(P.lines[i - 1].text) && /\p{Ll}/u.test(P.lines[i - 1].text)) l.text = l.text.replace(/^(By|During|With|And|For|The|Of|To|In|On|From|Or|At|As|While|When)\b(?=\s+\p{Ll}|\s+\/)/u, w => w.toLowerCase());
  });
  const fp = fillPage(bm, W, H, paras.flatMap(P => P.lines.map(l => l.m)));
  const made = paras.map(P => {
    const parts = P.lines.map(l => l.text);
    const slots = P.lines.map(l => {
      const p = patchFrom(fp, l.m, nativeImage);
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
