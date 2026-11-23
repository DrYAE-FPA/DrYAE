// DrYAE 1.7.0 — lecteur de BD et de mangas : fichiers .cbz / .cbr / .cb7 (et .zip / .rar / .7z) et dossiers d'images.
// Les pages sont lues sur le PC, rien n'est envoyé. Seuls les fichiers ouverts par l'utilisateur (menu, « Ouvrir avec »)
// sont servis au lecteur, sous un numéro tiré au hasard : une page web ne peut pas lire les fichiers du PC.
// Lecture des archives : 7-Zip (7za, déjà fourni avec DrYAE) pour zip et 7z ; node-unrar-js (MIT, code UnRAR dont
// la licence permet l'extraction) pour les archives RAR.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto'); const { spawn, execFile } = require('child_process');
const IMG = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const open = new Map(); // id -> { path, kind, pages: [nom], name }
const cache = new Map(); // id|i -> Buffer (60 dernières pages)

function sevenZip() { try { const z = require('./tools').sevenZipPath(); if (z && process.platform !== 'win32') try { fs.accessSync(z, fs.constants.X_OK); } catch { try { fs.chmodSync(z, 0o755); } catch {} } return z; } catch { return null; } }
function kindOf(file) {
  const st = fs.statSync(file); if (st.isDirectory()) return 'dir';
  const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(8); fs.readSync(fd, b, 0, 8, 0); fs.closeSync(fd);
  if (b.slice(0, 4).toString('latin1') === 'Rar!') return 'rar';
  if (b[0] === 0x50 && b[1] === 0x4b) return 'zip';
  if (b.slice(0, 6).toString('latin1') === '7z\xbc\xaf\x27\x1c') return '7z';
  throw new Error('format non reconnu (cbz, cbr, cb7 ou dossier d\'images)');
}
function walk(dir, base = dir, out = [], depth = 0) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory() && depth < 3) walk(f, base, out, depth + 1);
    else if (e.isFile() && IMG.test(e.name)) out.push(path.relative(base, f));
  }
  return out;
}
const run7 = args => new Promise((ok, no) => { const z = sevenZip(); if (!z) return no(new Error('7-Zip introuvable')); execFile(z, args, { maxBuffer: 64e6, windowsHide: true }, (e, so) => e ? no(e) : ok(so)); });
let unrar = null;
async function rarExtractor(file) {
  if (!unrar) unrar = require('node-unrar-js');
  const wasmBinary = fs.readFileSync(path.join(path.dirname(require.resolve('node-unrar-js')), 'js', 'unrar.wasm')).buffer;
  return unrar.createExtractorFromData({ wasmBinary, data: fs.readFileSync(file).buffer });
}

async function list(file, kind) {
  if (kind === 'dir') return walk(file).sort(natural);
  if (kind === 'rar') { const x = await rarExtractor(file); return [...x.getFileList().fileHeaders].filter(h => !h.flags.directory && IMG.test(h.name)).map(h => h.name).sort(natural); }
  const out = await run7(['l', '-slt', '-ba', '-sccUTF-8', file]);
  const names = []; let cur = null;
  for (const l of out.split(/\r?\n/)) { const m = /^Path = (.*)$/.exec(l); if (m) cur = m[1]; if (/^Folder = \+/.test(l)) cur = null; if (l === '' && cur) { names.push(cur); cur = null; } }
  if (cur) names.push(cur);
  return names.filter(n => IMG.test(n)).sort(natural);
}

// 1.7.1 : une image ouverte avec DrYAE (Explorateur, « Ouvrir avec ») : toutes les images de son dossier, en commençant par elle
function registerImage(file) {
  file = path.resolve(file); const dir = path.dirname(file), base = path.basename(file);
  let id = [...open].find(([, c]) => c.path === dir && c.kind === 'imgs')?.[0];
  if (!id) {
    const pages = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && IMG.test(e.name)).map(e => e.name).sort(natural);
    if (!pages.includes(base)) pages.unshift(base);
    id = crypto.randomBytes(9).toString('hex');
    open.set(id, { path: dir, kind: 'imgs', pages, name: path.basename(dir) || dir, image: true, key: crypto.createHash('sha1').update('img:' + dir).digest('hex').slice(0, 16) });
  }
  const c = open.get(id);
  return { id, name: c.name, count: c.pages.length, start: Math.max(0, c.pages.indexOf(base)) };
}
async function register(file) {
  file = path.resolve(file);
  if (IMG.test(file) && fs.statSync(file).isFile()) return registerImage(file);
  for (const [id, c] of open) if (c.path === file) return { id, name: c.name, count: c.pages.length };
  const kind = kindOf(file), pages = await list(file, kind);
  if (!pages.length) throw new Error('aucune image dans ce fichier');
  const id = crypto.randomBytes(9).toString('hex');
  const name = path.basename(file).replace(/\.(cb[zr7t]|zip|rar|7z)$/i, '');
  open.set(id, { path: file, kind, pages, name, key: crypto.createHash('sha1').update(file).digest('hex').slice(0, 16) });
  return { id, name, count: pages.length };
}
function info(id) { const c = open.get(id); return c ? { name: c.name, count: c.pages.length, key: c.key, image: !!c.image, pages: c.pages.map(p => path.basename(p)) } : null; }

async function page(id, i) {
  const c = open.get(id); if (!c) throw new Error('fichier non ouvert');
  i = Math.max(0, Math.min(c.pages.length - 1, i | 0));
  const k = id + '|' + i; if (cache.has(k)) return { buf: cache.get(k), name: c.pages[i] };
  const name = c.pages[i]; let buf;
  if (c.kind === 'dir' || c.kind === 'imgs') buf = await fs.promises.readFile(path.join(c.path, name));
  else if (c.kind === 'rar') { const x = await rarExtractor(c.path); const r = x.extract({ files: [name] }); const f = [...r.files][0]; buf = Buffer.from(f.extraction); }
  else buf = await new Promise((ok, no) => { const z = sevenZip(); if (!z) return no(new Error('7-Zip introuvable')); const p = spawn(z, ['e', '-so', '-sccUTF-8', c.path, name], { windowsHide: true }); const parts = []; p.stdout.on('data', d => parts.push(d)); p.on('error', no); p.on('close', code => code === 0 ? ok(Buffer.concat(parts)) : no(new Error('lecture impossible (' + code + ')'))); });
  cache.set(k, buf); if (cache.size > 60) cache.delete(cache.keys().next().value);
  return { buf, name };
}
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp' };
const mimeOf = n => MIME[(/\.(\w+)$/.exec(n) || [])[1]?.toLowerCase()] || 'application/octet-stream';
const isComic = f => /\.(cb[zr7]|cbt)$/i.test(f || '');

module.exports = { register, info, page, mimeOf, isComic, IMG };
