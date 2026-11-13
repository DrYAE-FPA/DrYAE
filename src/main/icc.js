// Profil de couleur intégré à une image (ICC, type « matrice + courbes » : ProPhoto, Adobe RGB, Display P3…).
// Le navigateur affiche l'image convertie en sRGB ; DrYAE lit les pixels bruts. Pour que la gomme d'une bulle
// ait exactement la couleur affichée, la couleur trouvée est convertie de la même façon.
const zlib = require('zlib');

// profil ICC contenu dans un JPEG (segments APP2 « ICC_PROFILE ») ou un PNG (bloc iCCP)
function extract(buf) {
  if (!buf || buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const parts = []; let i = 2;
    while (i + 4 < buf.length && buf[i] === 0xff) {
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m === 0xda || m === 0xd9) break;
      if (m === 0xe2 && buf.toString('latin1', i + 4, i + 15) === 'ICC_PROFILE') parts.push([buf[i + 16], buf.subarray(i + 18, i + 2 + len)]);
      i += 2 + len;
    }
    return parts.length ? Buffer.concat(parts.sort((a, b) => a[0] - b[0]).map(p => p[1])) : null;
  }
  if (buf.toString('latin1', 1, 4) === 'PNG') {
    let i = 8;
    while (i + 8 < buf.length) {
      const len = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8);
      if (type === 'iCCP') { const d = buf.subarray(i + 8, i + 8 + len); const z = d.indexOf(0); try { return zlib.inflateSync(d.subarray(z + 2)); } catch { return null; } }
      if (type === 'IDAT') break;
      i += 12 + len;
    }
  }
  return null;
}

// courbe de tonalité (« curv » ou « para ») → fonction 0..1 → linéaire
function curve(p, off) {
  const t = p.toString('latin1', off, off + 4);
  if (t === 'curv') {
    const n = p.readUInt32BE(off + 8);
    if (n === 0) return v => v;
    if (n === 1) { const g = p.readUInt16BE(off + 12) / 256; return v => Math.pow(v, g); }
    const tab = []; for (let i = 0; i < n; i++) tab.push(p.readUInt16BE(off + 12 + i * 2) / 65535);
    return v => { const x = v * (n - 1), i = Math.min(n - 2, Math.floor(x)), f = x - i; return tab[i] * (1 - f) + tab[i + 1] * f; };
  }
  if (t === 'para') {
    const f = p.readUInt16BE(off + 8), k = [0, 1, 3, 4, 5, 7][f] ?? 0, q = [];
    for (let i = 0; i < k; i++) q.push(p.readInt32BE(off + 12 + i * 4) / 65536);
    const [g, a = 1, b = 0, c = 0, d = 0, e = 0, ff = 0] = q;
    if (f === 0) return v => Math.pow(v, g);
    if (f === 1) return v => v >= -b / a ? Math.pow(a * v + b, g) : 0;
    if (f === 2) return v => v >= -b / a ? Math.pow(a * v + b, g) + c : c;
    if (f === 3) return v => v >= d ? Math.pow(a * v + b, g) : c * v;
    return v => v >= d ? Math.pow(a * v + b, g) + e : c * v + ff;
  }
  return null;
}

// convertisseur rgb (du profil) → rgb sRGB, ou null si le profil n'est pas du type « matrice + courbes »
function converter(icc) {
  try {
    if (!icc || icc.length < 132 || icc.toString('latin1', 16, 20) !== 'RGB ') return null;
    const n = icc.readUInt32BE(128), tags = {};
    for (let i = 0; i < n; i++) { const o = 132 + i * 12; tags[icc.toString('latin1', o, o + 4)] = icc.readUInt32BE(o + 4); }
    const xyz = s => tags[s] != null ? [0, 1, 2].map(i => icc.readInt32BE(tags[s] + 8 + i * 4) / 65536) : null;
    const R = xyz('rXYZ'), G = xyz('gXYZ'), B = xyz('bXYZ');
    const tr = ['rTRC', 'gTRC', 'bTRC'].map(s => tags[s] != null ? curve(icc, tags[s]) : null);
    if (!R || !G || !B || tr.some(f => !f)) return null;
    // XYZ (D50, espace de connexion des profils) → sRGB linéaire (adaptation Bradford D50 → D65)
    const S = [[3.1338561, -1.6168667, -0.4906146], [-0.9787684, 1.9161415, 0.0334540], [0.0719453, -0.2289914, 1.4052427]];
    const enc = v => { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
    return (r, g, b) => {
      const l = [tr[0](r / 255), tr[1](g / 255), tr[2](b / 255)];
      const X = R[0] * l[0] + G[0] * l[1] + B[0] * l[2], Y = R[1] * l[0] + G[1] * l[1] + B[1] * l[2], Z = R[2] * l[0] + G[2] * l[1] + B[2] * l[2];
      return S.map(row => enc(row[0] * X + row[1] * Y + row[2] * Z));
    };
  } catch { return null; }
}

// couleur « rgb(r,g,b) » lue dans l'image → couleur affichée par le navigateur
function displayColor(buf) {
  const f = converter(extract(buf));
  if (!f) return null;
  return s => { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(String(s)); if (!m) return s; const [r, g, b] = f(+m[1], +m[2], +m[3]); return `rgb(${r},${g},${b})`; };
}

module.exports = { extract, converter, displayColor };
