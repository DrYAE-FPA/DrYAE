// Pages internes du navigateur DrYAE (dryae://history, dryae://passwords…).
// Elles s'ouvrent dans un onglet. Seules ces pages reçoivent le pont « dryae » (voir page-preload.js),
// et le processus principal vérifie l'adresse de la page à chaque appel : un site web ne peut pas s'en servir.
const { protocol, ipcMain, webContents } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = { '': path.join(ROOT, 'pages'), _shared: path.join(ROOT, 'shared'), _ui: path.join(ROOT, 'ui'), _assets: path.join(ROOT, '..', 'assets') };
const PAGES = ['history', 'bookmarks', 'passwords', 'extensions', 'settings', 'downloads'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

function registerScheme() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'dryae', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
}

function resolve(u) {
  let x; try { x = new URL(u); } catch { return null; }
  const page = x.hostname;
  if (!PAGES.includes(page)) return null;
  let p = decodeURIComponent(x.pathname || '/');
  if (p === '/' || p === '') return path.join(DIRS[''], page + '.html');
  const parts = p.split('/').filter(Boolean);
  let base = DIRS[''];
  if (DIRS[parts[0]] && parts[0]) { base = DIRS[parts[0]]; parts.shift(); }
  const f = path.normalize(path.join(base, ...parts));
  if (!f.startsWith(base + path.sep)) return null; // pas de « ../ »
  return f;
}

function handleSession(ses) {
  if (ses._dryaePages) return;
  ses._dryaePages = true;
  try {
    ses.protocol.handle('dryae', async req => {
      const f = resolve(req.url);
      if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response('Page introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      const body = await fs.promises.readFile(f);
      return new Response(body, { status: 200, headers: { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store',
        'content-security-policy': "default-src 'self' dryae:; img-src * data: blob: crx:; style-src 'self' 'unsafe-inline' dryae:; script-src 'self' dryae:; connect-src 'self' dryae:" } });
    });
  } catch (e) { console.error('dryae protocol', e.message); }
}

// un appel n'est accepté que s'il vient du cadre principal d'une page dryae:// affichée dans un onglet
function trusted(e) {
  const f = e.senderFrame;
  if (!f || f !== e.sender.mainFrame) return false;
  if (!/^dryae:\/\//.test(f.url || '')) return false;
  return e.sender.getType() === 'webview';
}

const handlers = new Map();
function on(name, fn) { handlers.set(name, fn); }
ipcMain.handle('dp', async (e, name, ...args) => {
  if (!trusted(e)) throw new Error('refusé');
  const fn = handlers.get(name);
  if (!fn) throw new Error('inconnu : ' + name);
  module.exports.sender = e.sender; // page qui appelle (lu tout de suite par la fonction appelée)
  return fn(...args);
});
// envoi d'un événement à toutes les pages internes ouvertes
function broadcast(name, data) {
  for (const wc of webContents.getAllWebContents()) {
    try { if (!wc.isDestroyed() && wc.getType() === 'webview' && /^dryae:\/\//.test(wc.getURL())) wc.send('dp-ev', name, data); } catch {}
  }
}
const isPageUrl = u => /^dryae:\/\//i.test(String(u || ''));

module.exports = { registerScheme, handleSession, on, broadcast, isPageUrl, PAGES };
