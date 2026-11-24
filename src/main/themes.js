// 1.7.2 : thèmes de DrYAE et thèmes de la boutique Chrome (Chrome Web Store)
// Un thème change les couleurs de DrYAE (barre des onglets, barre d'outils, pages) et le fond de la page d'accueil.
// Les thèmes de la boutique Chrome sont de petits paquets (manifest.json avec une clé « theme ») : DrYAE lit leurs
// couleurs et leur image de page d'accueil ; rien d'autre n'est exécuté.
const fs = require('fs'); const path = require('path');

// couleurs de base (mode sombre de DrYAE) : fond, panneaux, lignes, texte
const dark = (bg, panel, panel2, panel3, line, line2, accent, ntp) => ({ mode: 'dark', accent, ntp, vars: { '--bg': bg, '--panel': panel, '--panel2': panel2, '--panel3': panel3, '--line': line, '--line2': line2 } });
const BUILTIN = [
  { id: 'default', name: 'Par défaut', desc: 'Les couleurs habituelles de DrYAE.', theme: null, preview: ['#13161d', '#8b5cf6'] },
  { id: 'aube', name: 'Aube', desc: 'Brun chaud et orangé.', theme: dark('#140d09', '#1c130d', '#241811', '#2d1f16', '#33241a', '#43301f', '#f59e0b', '#1a110b'), preview: ['#241811', '#f59e0b'] },
  { id: 'braise', name: 'Braise', desc: 'Rouge sombre.', theme: dark('#160a0b', '#1f0f11', '#291417', '#331a1d', '#3a1e22', '#4d272c', '#f43f5e', '#1c0c0e'), preview: ['#291417', '#f43f5e'] },
  { id: 'prune', name: 'Prune', desc: 'Violet et rose.', theme: dark('#140b17', '#1c1020', '#25152a', '#2e1b35', '#341f3b', '#45294e', '#d946ef', '#190e1d'), preview: ['#25152a', '#d946ef'] },
  { id: 'ocean', name: 'Océan', desc: 'Bleu nuit.', theme: dark('#0a0f1c', '#0e1526', '#131c32', '#18233e', '#1c2846', '#26355c', '#3b82f6', '#0c1322'), preview: ['#131c32', '#3b82f6'] },
  { id: 'foret', name: 'Forêt', desc: 'Vert sombre.', theme: dark('#08130e', '#0c1b14', '#10241a', '#152d21', '#183324', '#214431', '#22c55e', '#0a1811'), preview: ['#10241a', '#22c55e'] },
  { id: 'lagon', name: 'Lagon', desc: 'Bleu-vert.', theme: dark('#071315', '#0a1b1e', '#0e2428', '#122d32', '#153338', '#1d444a', '#14b8a6', '#09171a'), preview: ['#0e2428', '#14b8a6'] },
  { id: 'graphite', name: 'Graphite', desc: 'Gris neutre, sans couleur.', theme: dark('#111111', '#181818', '#202020', '#282828', '#2c2c2c', '#3a3a3a', '#a3a3a3', '#151515'), preview: ['#202020', '#a3a3a3'] },
];

const hex = c => Array.isArray(c) && c.length >= 3 ? '#' + c.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, '0')).join('') : null;
const lum = h => { const n = parseInt(String(h).slice(1, 7), 16); return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255; };
const mix = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

// couleurs DrYAE à partir des couleurs d'un thème de la boutique Chrome
function fromChrome(mf, dir) {
  const T = mf.theme || {}, C = T.colors || {}, I = T.images || {};
  const frame = hex(C.frame) || hex(C.frame_inactive) || null, toolbar = hex(C.toolbar) || frame;
  const ntp = hex(C.ntp_background) || toolbar || frame;
  if (!frame && !toolbar && !I.theme_ntp_background && !I.theme_frame) return null;
  const base = toolbar || frame || '#13161d', light = lum(base) > 0.55;
  const text = hex(C.tab_text) || hex(C.bookmark_text) || hex(C.toolbar_text) || (light ? '#151821' : '#e7e9ef');
  const vars = {
    '--bg': frame || base, '--panel': base, '--panel2': mix(base, light ? '#000000' : '#ffffff', 0.05), '--panel3': mix(base, light ? '#000000' : '#ffffff', 0.09),
    '--line': mix(base, light ? '#000000' : '#ffffff', 0.12), '--line2': mix(base, light ? '#000000' : '#ffffff', 0.2), '--text': text, '--muted': mix(text, base, 0.4),
  };
  const img = k => { const f = I[k]; if (!f || !dir) return ''; const p = path.join(dir, String(f).replace(/^\//, '')); return fs.existsSync(p) ? p : ''; };
  return { mode: light ? 'light' : 'dark', accent: hex(C.ntp_link) || hex(C.button_background) || null, ntp, ntpText: hex(C.ntp_text) || null, vars, ntpImage: img('theme_ntp_background'), frameImage: img('theme_frame') };
}

// thèmes installés depuis la boutique Chrome (dossier des extensions : <id>/<version>/manifest.json, ou local-…)
function installed(extDir) {
  const out = [];
  let ids = []; try { ids = fs.readdirSync(extDir); } catch {}
  for (const id of ids) {
    const base = path.join(extDir, id);
    let dirs = [base]; try { const sub = fs.readdirSync(base).filter(v => fs.existsSync(path.join(base, v, 'manifest.json'))).sort(); if (sub.length) dirs = [path.join(base, sub[sub.length - 1])]; } catch {}
    for (const d of dirs) {
      let mf; try { mf = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')); } catch { continue; }
      if (!mf || !mf.theme) continue;
      const t = fromChrome(mf, d); if (!t) continue;
      const name = msg(d, mf, mf.name) || id;
      out.push({ id: 'chrome:' + id.replace(/^local-/, ''), extId: id, name, desc: msg(d, mf, mf.description || ''), kind: 'chrome', dir: d, theme: t, preview: [t.vars['--panel'], t.accent || t.vars['--line2']] });
    }
  }
  return out;
}
// « __MSG_appName__ » : nom traduit lu dans _locales
function msg(dir, mf, s) {
  const m = /^__MSG_(\w+)__$/.exec(s || ''); if (!m) return s || '';
  for (const l of ['fr', mf.default_locale || 'en', 'en']) {
    try { const j = JSON.parse(fs.readFileSync(path.join(dir, '_locales', l, 'messages.json'), 'utf8')); const k = Object.keys(j).find(k => k.toLowerCase() === m[1].toLowerCase()); if (k) return j[k].message; } catch {}
  }
  return s;
}
// image en data: (pour la page d'accueil), gardée en mémoire
const cache = new Map();
function dataUrl(f) {
  if (!f) return '';
  if (cache.has(f)) return cache.get(f);
  try { const ext = path.extname(f).slice(1).toLowerCase() || 'png'; const u = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + fs.readFileSync(f).toString('base64'); cache.set(f, u); return u; } catch { return ''; }
}
module.exports = { BUILTIN, fromChrome, installed, dataUrl, lum };
