// Importer favoris et historique depuis un autre navigateur installé sur ce PC (avec l'accord de l'utilisateur).
// Chrome, Edge, Brave, Vivaldi, Opera : fichier « Bookmarks » (JSON) et base « History » (SQLite).
// Firefox : base « places.sqlite ». Les bases sont copiées avant lecture (le navigateur peut être ouvert).
// Les mots de passe des autres navigateurs sont chiffrés par eux : on passe par leur export .csv.
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const ROAMING = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const CHROMIUM = [
  ['chrome', 'Google Chrome', path.join(LOCAL, 'Google', 'Chrome', 'User Data')],
  ['edge', 'Microsoft Edge', path.join(LOCAL, 'Microsoft', 'Edge', 'User Data')],
  ['brave', 'Brave', path.join(LOCAL, 'BraveSoftware', 'Brave-Browser', 'User Data')],
  ['vivaldi', 'Vivaldi', path.join(LOCAL, 'Vivaldi', 'User Data')],
  ['opera', 'Opera', path.join(ROAMING, 'Opera Software', 'Opera Stable')],
  ['operagx', 'Opera GX', path.join(ROAMING, 'Opera Software', 'Opera GX Stable')],
];

// profils de chaque navigateur trouvés sur ce PC
function detect(extraRoots = {}) {
  const out = [];
  for (const [id, name, root0] of CHROMIUM) {
    const root = extraRoots[id] || root0;
    if (!fs.existsSync(root)) continue;
    const dirs = fs.existsSync(path.join(root, 'Bookmarks')) ? [root] : fs.readdirSync(root).filter(d => /^(Default|Profile \d+)$/.test(d)).map(d => path.join(root, d));
    for (const d of dirs) {
      if (!fs.existsSync(path.join(d, 'Bookmarks')) && !fs.existsSync(path.join(d, 'History'))) continue;
      let pname = path.basename(d); try { const ls = JSON.parse(fs.readFileSync(path.join(root, 'Local State'), 'utf8')); pname = ls.profile?.info_cache?.[pname]?.name || pname; } catch {}
      out.push({ key: id + ':' + d, kind: 'chromium', name: dirs.length > 1 ? `${name} (${pname})` : name, dir: d });
    }
  }
  const ff = extraRoots.firefox || path.join(ROAMING, 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(ff)) for (const d of fs.readdirSync(ff)) { const p = path.join(ff, d); if (fs.existsSync(path.join(p, 'places.sqlite'))) out.push({ key: 'firefox:' + p, kind: 'firefox', name: 'Firefox' + (/default-release/.test(d) ? '' : ` (${d.replace(/^[^.]+\./, '')})`), dir: p }); }
  return out;
}

let SQL = null;
async function sqlite(file) {
  if (!SQL) SQL = await require('sql.js')({ locateFile: f => path.join(path.dirname(require.resolve('sql.js')), f) });
  const buf = fs.readFileSync(file); // copie en mémoire : la base peut être verrouillée par le navigateur ouvert
  return new SQL.Database(new Uint8Array(buf));
}
const rows = (db, q) => { const r = []; const st = db.prepare(q); while (st.step()) r.push(st.getAsObject()); st.free(); return r; };

// arbre DrYAE : { type: 'folder', title, children } / { type: 'url', title, url }
async function read(src, o = {}) {
  const res = { bookmarks: null, history: [] };
  if (src.kind === 'chromium') {
    if (o.bookmarks !== false) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(src.dir, 'Bookmarks'), 'utf8'));
        const conv = n => n.type === 'folder' ? { type: 'folder', title: n.name || '', children: (n.children || []).map(conv).filter(Boolean) } : /^https?:/.test(n.url || '') ? { type: 'url', title: n.name || n.url, url: n.url } : null;
        const R = j.roots || {};
        res.bookmarks = { type: 'folder', title: src.name, children: [R.bookmark_bar && { ...conv(R.bookmark_bar), title: 'Barre de favoris' }, R.other && conv(R.other), R.synced && conv(R.synced)].filter(x => x && x.children && x.children.length) };
      } catch {}
    }
    if (o.history !== false && fs.existsSync(path.join(src.dir, 'History'))) {
      try {
        const db = await sqlite(path.join(src.dir, 'History'));
        // dates Chrome : microsecondes depuis 1601
        res.history = rows(db, "SELECT url, title, last_visit_time AS t FROM urls WHERE url LIKE 'http%' AND hidden = 0 ORDER BY last_visit_time DESC LIMIT 5000").map(r => ({ url: r.url, title: r.title || r.url, t: Math.round(Number(r.t) / 1000 - 11644473600000) }));
        db.close();
      } catch {}
    }
  } else if (src.kind === 'firefox') {
    try {
      const db = await sqlite(path.join(src.dir, 'places.sqlite'));
      if (o.bookmarks !== false) {
        const bm = rows(db, 'SELECT b.id, b.parent, b.type, b.title, b.position, p.url FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id = b.fk ORDER BY b.parent, b.position');
        const by = new Map(); for (const b of bm) { if (!by.has(b.parent)) by.set(b.parent, []); by.get(b.parent).push(b); }
        const build = id => (by.get(id) || []).map(b => b.type === 2 ? { type: 'folder', title: b.title || '', children: build(b.id) } : b.type === 1 && /^https?:/.test(b.url || '') ? { type: 'url', title: b.title || b.url, url: b.url } : null).filter(Boolean);
        const roots = rows(db, "SELECT id, guid FROM moz_bookmarks WHERE guid IN ('toolbar_____','menu________','unfiled_____','mobile______')");
        const name = { 'toolbar_____': 'Barre de favoris', 'menu________': 'Menu des marque-pages', 'unfiled_____': 'Autres marque-pages', 'mobile______': 'Marque-pages du mobile' };
        res.bookmarks = { type: 'folder', title: src.name, children: roots.map(r => ({ type: 'folder', title: name[r.guid], children: build(r.id) })).filter(f => f.children.length) };
      }
      if (o.history !== false) res.history = rows(db, "SELECT url, title, last_visit_date AS t FROM moz_places WHERE url LIKE 'http%' AND last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT 5000").map(r => ({ url: r.url, title: r.title || r.url, t: Math.round(Number(r.t) / 1000) }));
      db.close();
    } catch {}
  }
  return res;
}

module.exports = { detect, read };
