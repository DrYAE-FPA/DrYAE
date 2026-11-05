// Extrait les textes français de l'interface (HTML + chaînes JS) -> locales/_source.json
// Les ${...} des gabarits deviennent {0}, {1}… ; la traduction à l'exécution les reconnaît.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['src/ui/index.html', 'src/ui/app.js', 'src/ui/player.html', 'src/browser/browser.html', 'src/browser/browser.js', 'src/browser/page-preload.js',
  'src/main/main.js', 'src/main/browser.js', 'src/main/manager.js', 'src/main/tools.js', 'src/main/engine/http.js', 'src/main/engine/hls.js', 'src/main/engine/torrent.js', 'src/main/engine/ytdl.js', 'src/main/vault.js', 'src/main/util.js', 'src/main/updater.js', 'extension/popup.html', 'extension/popup.js', 'extension/background.js'];
const out = new Set();
const FR = /[a-zA-ZÀ-ÿ]/;
const looksUi = s => {
  s = s.trim();
  if (s.length < 2 || !FR.test(s)) return false;
  if (/^(https?:|chrome|file:|magnet:|data:|#|\.|\/)/.test(s)) return false;
  if (/^[\w-]+$/.test(s) && !/[À-ÿ]/.test(s) && !/^[A-ZÀ-Ý][a-zà-ÿ]+$/.test(s)) return false; // identifiants
  if (/[{};<>]|=>|\w=['"\w]|\bfunction\b|\bconst\b|\breturn\b|\.join\(/.test(s)) return false;
  if (/^[a-z]+(-[a-z]+)+$/.test(s)) return false; // classes css
  if (/^(GET|POST|utf-8|latin1|hex|base64|md5|sha\d+|mp4|mp3|m4a|ts|json|text\/|video\/|audio\/|application\/|image\/)/i.test(s)) return false;
  if (/^[\d\s.:%,+\-()/]+$/.test(s)) return false;
  return /\s/.test(s) || /[À-ÿ]/.test(s) || /^[A-ZÀ-Ý][a-zà-ÿ'’]+$/.test(s);
};
function addTpl(res) {
  // couper aux balises HTML : chaque nœud texte est traduit séparément
  for (let part of res.split(/<[^>]*>/)) {
    part = part.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    let k = 0;
    const key = part.trim().replace(/\u0001/g, () => '{' + (k++) + '}');
    if (key.replace(/\{\d+\}/g, '').trim().length >= 2 && looksUi(key.replace(/\{\d+\}/g, 'x'))) out.add(key);
  }
}
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  let src = fs.readFileSync(p, 'utf8');
  if (f.endsWith('.html')) {
    src = src.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
    for (const m of src.matchAll(/(?:placeholder|title|aria-label)="([^"]+)"/g)) if (looksUi(m[1])) out.add(m[1].trim());
    for (const t of src.split(/<[^>]*>/)) { const s = t.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); if (looksUi(s)) out.add(s); }
    const scripts = fs.readFileSync(p, 'utf8').match(/<script>[\s\S]*?<\/script>/g) || [];
    for (const sc of scripts) scanJs(sc.replace(/<\/?script>/g, ""));
  } else scanJs(src);
}
function scanJs(src) {
  // analyse syntaxique (acorn, outil de développement uniquement : npm i acorn acorn-walk)
  let acorn, walk;
  try { acorn = require('acorn'); walk = require('acorn-walk'); } catch { acorn = require('/home/claude/tooldeps/node_modules/acorn'); walk = require('/home/claude/tooldeps/node_modules/acorn-walk'); }
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true }); }
  catch { try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e) { console.error('parse', e.message); return; } }
  walk.full(ast, n => {
    if (n.type === 'Literal' && typeof n.value === 'string') {
      if (n.value.includes('<')) addHtml(n.value); else { const s = n.value.replace(/\s+/g, ' ').trim(); if (looksUi(s)) out.add(s); }
    } else if (n.type === 'TemplateLiteral') {
      addTpl(n.quasis.map(q => q.value.cooked ?? q.value.raw).join('\u0001'));
    }
  });
}
function addHtml(h) { addTpl(h); }
const list = [...out].sort();
fs.mkdirSync(path.join(ROOT, 'locales'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'locales', '_source.json'), JSON.stringify(list, null, 1));
console.log(list.length, 'textes');
