// Exporter / importer TOUTES ses données DrYAE dans un seul fichier (.dryae), sans compte en ligne :
// réglages, favoris, historique (au choix), liste des téléchargements, extensions, mots de passe (au choix,
// et alors le fichier entier est chiffré avec un mot de passe : AES-256-GCM, clé dérivée par scrypt).
const fs = require('fs');
const crypto = require('crypto');

const FORMAT = 'dryae-export';
// réglages qui ne doivent pas quitter ce PC (identifiants enregistrés pour des sites de téléchargement)
const SECRET_KEYS = ['passwords'];

function seal(obj, password) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { format: FORMAT, enc: { alg: 'aes-256-gcm/scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') } };
}
function open(file, password) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (j.format !== FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde DrYAE");
  if (!j.enc) return j;
  if (!password) { const e = new Error('Mot de passe nécessaire'); e.code = 'needpw'; throw e; }
  const key = crypto.scryptSync(password, Buffer.from(j.enc.salt, 'base64'), 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(j.enc.iv, 'base64'));
  d.setAuthTag(Buffer.from(j.enc.tag, 'base64'));
  try { return JSON.parse(Buffer.concat([d.update(Buffer.from(j.enc.data, 'base64')), d.final()]).toString('utf8')); } catch { const e = new Error('Mot de passe incorrect'); e.code = 'badpw'; throw e; }
}

// ctx : { settings, browser, manager, vault, version }
function build(ctx, o = {}) {
  const S = JSON.parse(JSON.stringify(ctx.settings.get()));
  for (const k of SECRET_KEYS) delete S[k];
  const st = ctx.browser.store;
  const out = {
    format: FORMAT, version: ctx.version, date: new Date().toISOString(),
    settings: S,
    browser: { bm: st.bm, typed: o.history ? st.typed : [], history: o.history ? st.history : [], perms: st.perms || {}, hides: st.hides || {}, extDisabled: st.extDisabled || [] },
    downloads: ctx.manager.list.map(d => d.toJSON()).map(d => ({ ...d, headers: {} })), // sans cookies
    extensions: (ctx.browser.extList() || []).filter(x => x.id).map(x => ({ id: x.id, name: x.name })),
  };
  if (o.passwords) out.vault = { logins: ctx.vault.data.logins.map(l => ({ origin: l.origin, username: l.username, password: ctx.vault.dec(l.password), note: l.note ? ctx.vault.dec(l.note) : '', t: l.t })), addresses: ctx.vault.data.addresses || [], never: ctx.vault.data.never || [] };
  return out;
}

// fusion : rien n'est perdu sur ce PC (favoris importés rangés dans un dossier, doublons ignorés)
async function apply(ctx, d, o = {}) {
  const done = { settings: false, bookmarks: 0, history: 0, downloads: 0, extensions: 0, passwords: 0 };
  if (o.settings !== false && d.settings) {
    const keep = { lang: ctx.settings.get().lang, dir: ctx.settings.get().dir };
    const S = { ...d.settings }; delete S.v161; for (const k of SECRET_KEYS) delete S[k];
    ctx.settings.set({ ...S, ...(o.keepDir ? { dir: keep.dir } : {}) });
    done.settings = true;
  }
  const B = ctx.browser, st = B.store;
  if (d.browser?.bm) {
    const have = new Set(B.bmFlat().map(b => b.url));
    const count = n => (n.type === 'url' ? (have.has(n.url) ? 0 : 1) : (n.children || []).reduce((a, c) => a + count(c), 0));
    const clean = n => (n.type === 'url' ? (have.has(n.url) ? null : { ...n, id: undefined }) : { ...n, id: undefined, children: (n.children || []).map(clean).filter(Boolean) });
    const add = (node, parentId) => { if (node.type === 'url') B.bmAdd({ parentId, url: node.url, title: node.title, fav: node.fav || '' }); else { const f = B.bmAdd({ parentId, type: 'folder', title: node.title }); for (const c of node.children) add(c, f.id); } };
    const n = count(d.browser.bm.bar) + count(d.browser.bm.other);
    if (n) {
      const date = new Date(d.date || Date.now()).toLocaleDateString('fr-FR');
      const f = B.bmAdd({ parentId: 'other', type: 'folder', title: 'Importés (' + date + ')' });
      for (const c of clean(d.browser.bm.bar).children) add(c, f.id);
      for (const c of clean(d.browser.bm.other).children) add(c, f.id);
      done.bookmarks = n;
    }
  }
  if (d.browser?.history?.length) {
    const seen = new Set(st.history.map(h => h.t + '|' + h.url));
    const extra = d.browser.history.filter(h => h && h.url && !seen.has(h.t + '|' + h.url));
    st.history = [...st.history, ...extra].sort((a, b) => b.t - a.t).slice(0, 10000); done.history = extra.length;
  }
  if (d.browser?.perms) st.perms = { ...d.browser.perms, ...(st.perms || {}) };
  if (d.browser?.hides) st.hides = { ...d.browser.hides, ...(st.hides || {}) };
  B.saveStore?.(); B.bmChanged?.();
  if (Array.isArray(d.downloads)) {
    const have = new Set(ctx.manager.list.map(x => x.id));
    for (const j of d.downloads) {
      if (!j || have.has(j.id)) continue;
      const it = ctx.manager.create({ ...j, status: j.status === 'done' ? 'done' : 'paused' });
      ctx.manager.attach(it); done.downloads++;
    }
    ctx.manager.save(); ctx.manager.emit('reload');
  }
  if (o.extensions !== false && Array.isArray(d.extensions)) {
    const have = new Set((B.extList() || []).map(x => x.id));
    for (const x of d.extensions) { if (!x.id || have.has(x.id) || !/^[a-p]{32}$/.test(x.id)) continue; try { await B.extInstall(x.id); done.extensions++; } catch {} }
  }
  if (d.vault?.logins) {
    for (const l of d.vault.logins) { if (!l.origin || !l.password) continue; ctx.vault.upsert({ origin: l.origin, username: l.username || '', password: l.password, note: l.note || '' }); done.passwords++; }
    const V = ctx.vault.data;
    for (const a of d.vault.addresses || []) if (!V.addresses.some(x => x.id === a.id)) V.addresses.push(a);
    for (const n of d.vault.never || []) if (!V.never.includes(n)) V.never.push(n);
    ctx.vault.save();
  }
  return done;
}

module.exports = { seal, open, build, apply, FORMAT };
