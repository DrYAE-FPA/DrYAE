// Construit src/shared/locales.js à partir de locales/_source.json et locales/<lang>.tsv
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const src = require(path.join(R, 'locales/_source.json'));
const L = {}; let bad = 0;
const ph = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
for (const lang of ['en', 'es', 'pt', 'ru', 'ar']) {
  const lines = fs.readFileSync(path.join(R, 'locales', lang + '.tsv'), 'utf8').split('\n').filter(Boolean);
  if (lines.length !== src.length) { console.error(lang, 'lignes', lines.length, '≠', src.length); bad++; }
  const d = {};
  for (const ln of lines) {
    const i = ln.indexOf('\t'); const n = +ln.slice(0, i), t = ln.slice(i + 1);
    const k = src[n]; if (k === undefined) { console.error(lang, 'index', n); bad++; continue; }
    if (ph(k) !== ph(t)) { console.error(lang, n, 'variables', JSON.stringify(k), '→', JSON.stringify(t)); bad++; }
    if (!t.trim()) { console.error(lang, n, 'vide'); bad++; }
    d[k] = t;
  }
  L[lang] = d;
}
// textes ajoutés après coup : locales/_extra.tsv (fr, en, es, pt, ru, ar)
const ORDER = ['en', 'es', 'pt', 'ru', 'ar'];
for (const ln of fs.readFileSync(path.join(R, 'locales/_extra.tsv'), 'utf8').split('\n')) {
  if (!ln.trim() || ln.startsWith('#')) continue;
  const c = ln.split('\t'); if (c.length !== 6) { console.error('_extra colonnes', c.length, ln); bad++; continue; }
  ORDER.forEach((l, i) => { if (ph(c[0]) !== ph(c[i + 1])) { console.error('_extra', l, c[0]); bad++; } L[l][c[0]] = c[i + 1]; });
}
// « {0}Texte » (icône devant) : la page affiche aussi « Texte » seul
for (const l of ORDER) for (const [k, v] of Object.entries(L[l])) {
  const m = k.match(/^\{0\}([^{}]+)$/), n = v.match(/^\{0\}([^{}]+)$/);
  if (m && n && L[l][m[1]] === undefined) L[l][m[1]] = n[1];
}
if (bad) process.exit(1);
fs.writeFileSync(path.join(R, 'src/shared/locales.js'), '// Généré par tools/build-locales.js — ne pas modifier à la main.\n(function(){const L=' + JSON.stringify(L) + ";\nif(typeof module!=='undefined'&&module.exports)module.exports=L;else window.DRYAE_LOCALES=L;})();\n");
console.log('ok', Object.keys(L).map(k => k + ':' + Object.keys(L[k]).length).join(' '));
