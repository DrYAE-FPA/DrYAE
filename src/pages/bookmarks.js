/* dryae://bookmarks — gestionnaire de favoris */
let TREE = null, folderId = 'bar', q = '', clip = null, undoList = null, collapsed = new Set();
shell('Favoris', null, 'Rechercher dans les favoris');
const search = $('#q');
const nav = new ListNav({
  root: $('#wrap'), search,
  onSel: ks => { const b = $('#selbar'); if (!b) return; b.classList.toggle('on', ks.length > 1); $('#selN').textContent = TRF('{0} sélectionné(s)', ks.length); },
  onOpen: (k, e) => { const n = node(k); if (!n) return; if (n.type === 'folder') openFolder(n.id); else D.call('open', n.url, e && (e.ctrlKey || e.metaKey) ? { background: true } : { current: true }); },
  onDelete: ks => del(ks),
  onRename: k => edit(node(k)),
  onUndo: () => undo(),
  onMenu: (k, x, y) => rowMenu(k, x, y),
});
const roots = () => [TREE.bar, TREE.other];
function node(id, list = roots()) { for (const n of list) { if (n.id === id) return n; if (n.children) { const r = node(id, n.children); if (r) return r; } } return null; }
function parentOf(id, list = roots(), p = null) { for (const n of list) { if (n.id === id) return p; if (n.children) { const r = parentOf(id, n.children, n); if (r) return r; } } return null; }
function pathOf(id) { const out = []; let p = parentOf(id); while (p) { out.unshift(TR(p.title)); p = parentOf(p.id); } return out.join(' › '); }
const folders = (list = roots(), d = 0, out = []) => { for (const n of list) if (n.type === 'folder') { out.push({ n, d }); folders(n.children, d + 1, out); } return out; };
const count = n => n.type === 'folder' ? n.children.reduce((a, c) => a + count(c), 0) : 1;

async function load() { TREE = await call('bookmarks'); if (!node(folderId)) folderId = 'bar'; draw(); }
function drawTree() {
  const row = ({ n, d }) => {
    const hasSub = n.children.some(c => c.type === 'folder');
    let hidden = false; let p = parentOf(n.id); while (p) { if (collapsed.has(p.id)) hidden = true; p = parentOf(p.id); }
    if (hidden) return '';
    return `<button data-f="${esc(n.id)}" class="${!q && n.id === folderId ? 'on' : ''}" style="padding-left:${12 + d * 16}px">${hasSub ? `<span data-tog="${esc(n.id)}" style="display:inline-flex;width:14px;margin-left:-16px;color:var(--dim)">${collapsed.has(n.id) ? '▸' : '▾'}</span>` : ''}${ic(n.id === 'bar' ? 'star' : 'folder')}<span class="${n.id === 'bar' || n.id === 'other' ? '' : 'notr'}">${esc(TR(n.title))}</span><span class="count">${count(n) || ''}</span></button>`;
  };
  $('#nav').innerHTML = folders().map(row).join('') + `<hr><button data-act="import">${ic('import')}<span>${esc(TR('Importer des favoris'))}</span></button><button data-act="export">${ic('export')}<span>${esc(TR('Exporter les favoris'))}</span></button>
    <div class="navfoot">${esc(TR('Glissez un favori sur un dossier pour l\'y ranger.'))}</div>`;
}
$('#nav').onclick = e => {
  const t = e.target.closest('[data-tog]'); if (t) { e.stopPropagation(); const id = t.dataset.tog; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); return drawTree(); }
  const f = e.target.closest('[data-f]'); if (f) return openFolder(f.dataset.f);
  const a = e.target.closest('[data-act]'); if (a) return a.dataset.act === 'import' ? importBm() : exportBm();
};
function openFolder(id) { folderId = id; q = ''; search.value = ''; nav.clear(); nav.focus = -1; draw(); }
search.oninput = () => { clearTimeout(search.t); search.t = setTimeout(() => { q = search.value.trim().toLowerCase(); nav.clear(); draw(); }, 150); };

function items() {
  if (!q) return node(folderId)?.children || [];
  const out = []; const w = l => l.forEach(n => { if ((n.title + ' ' + (n.url || '')).toLowerCase().includes(q)) out.push(n); if (n.children) w(n.children); }); w(roots());
  return out;
}
function draw() {
  drawTree();
  const f = node(folderId), list = items();
  const path = q ? '' : pathOf(folderId);
  $('#wrap').innerHTML = `<div class="phead"><h2 class="${folderId === 'bar' || folderId === 'other' || q ? '' : 'notr'}">${esc(q ? TR('Résultats de la recherche') : TR(f.title))}</h2>
      ${q ? '' : `<button class="btn" id="addB">${ic('plus')}${esc(TR('Ajouter un favori'))}</button><button class="btn" id="addF">${ic('folder')}${esc(TR('Nouveau dossier'))}</button><button class="icon-btn" id="fMore" title="${esc(TR('Plus'))}">${ic('more')}</button>`}
      ${path ? `<p class="notr">${esc(path)}</p>` : ''}</div>
    <div class="kbdhelp"><span><kbd>Entrée</kbd> ${esc(TR('ouvrir'))}</span><span><kbd>Ctrl</kbd>+<kbd>Entrée</kbd> ${esc(TR('nouvel onglet'))}</span><span><kbd>F2</kbd> ${esc(TR('modifier'))}</span><span><kbd>Suppr</kbd> ${esc(TR('supprimer'))}</span><span><kbd>Ctrl</kbd>+<kbd>X</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd> ${esc(TR('déplacer'))}</span><span><kbd>Alt</kbd>+<kbd>↑↓</kbd> ${esc(TR('monter / descendre'))}</span><span><kbd>Retour arrière</kbd> ${esc(TR('dossier parent'))}</span><span><kbd>Ctrl</kbd>+<kbd>Z</kbd> ${esc(TR('annuler'))}</span></div>
    <div class="selbar" id="selbar"><b id="selN"></b><button class="btn sm" id="selOpen">${ic('open')}${esc(TR('Tout ouvrir'))}</button><button class="btn sm" id="selDel">${ic('trash')}${esc(TR('Supprimer'))}</button><button class="btn sm" id="selX">${esc(TR('Annuler'))}</button></div>
    <div class="plist" id="lst">${list.length ? list.map(n => `<div class="lrow" data-k="${esc(n.id)}">
      <span style="color:var(--dim);cursor:grab;display:flex" draggable="${q ? 'false' : 'true'}" title="${esc(TR('Glisser pour déplacer'))}">${ic('drag')}</span>
      ${n.type === 'folder' ? `<span class="favx" style="background:var(--panel3);color:var(--accent)">${ic('folder')}</span>` : favHtml(n.url, n.fav)}
      <div class="tt"><b class="notr" title="${esc(n.title)}">${esc(n.title || n.url)}</b><span class="notr">${esc(n.type === 'folder' ? TRF('{0} élément(s)', count(n)) : q ? pathOf(n.id) + ' · ' + hostOf(n.url) : n.url)}</span></div>
      <div class="act"><button class="icon-btn" data-ed title="${esc(TR('Modifier'))}">${ic('edit')}</button><button class="icon-btn" data-more title="${esc(TR('Plus'))}">${ic('more')}</button></div></div>`).join('')
      : `<div class="empty">${ic('star')}${esc(TR(q ? 'Aucun résultat' : 'Ce dossier est vide'))}</div>`}</div>`;
  const on = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
  on('#addB', () => edit(null, 'url'));
  on('#addF', () => edit(null, 'folder'));
  on('#fMore', e => { const r = e.currentTarget.getBoundingClientRect(); pmenu(r.left - 200, r.bottom + 4, [
    { label: 'Trier par nom', icon: 'list', fn: sortByName },
    { label: 'Tout ouvrir', icon: 'open', fn: () => openAll(node(folderId)) },
    '-',
    { label: 'Importer des favoris', icon: 'import', fn: importBm },
    { label: 'Exporter les favoris', icon: 'export', fn: exportBm },
  ]); });
  on('#selDel', () => del(nav.selected()));
  on('#selX', () => nav.clear());
  on('#selOpen', () => nav.selected().map(node).filter(Boolean).forEach(n => (n.type === 'folder' ? openAll(n) : D.call('open', n.url, { background: true }))));
  const lst = $('#lst');
  lst.onclick = e => {
    const r = e.target.closest('[data-k]'); if (!r) return;
    const n = node(r.dataset.k);
    if (e.target.closest('[data-ed]')) return edit(n);
    const m = e.target.closest('[data-more]'); if (m) { const b = m.getBoundingClientRect(); return rowMenu(n.id, b.left - 200, b.bottom); }
    if (e.target.closest('.tt b') && !e.ctrlKey && !e.shiftKey) nav.onOpen(n.id, e);
  };
  lst.onauxclick = e => { const r = e.target.closest('[data-k]'); if (r && e.button === 1) { const n = node(r.dataset.k); if (n.url) D.call('open', n.url, { background: true }); } };
  nav.paint();
}
D.on('bm', t => { TREE = t; if (!node(folderId)) folderId = 'bar'; draw(); });

function rowMenu(id, x, y) {
  const n = node(id); if (!n) return;
  const sel = nav.selected(); const many = sel.length > 1 ? sel : [id];
  pmenu(x, y, [
    n.type === 'url' && { label: 'Ouvrir', icon: 'open', key: 'Entrée', fn: () => D.call('open', n.url, { current: true }) },
    n.type === 'url' && { label: 'Ouvrir dans un nouvel onglet', icon: 'plus', key: 'Ctrl+Entrée', fn: () => D.call('open', n.url, { background: true }) },
    n.type === 'url' && { label: 'Ouvrir dans un onglet privé', icon: 'eyeoff', fn: () => D.call('open', n.url, { incognito: true }) },
    n.type === 'folder' && { label: 'Ouvrir le dossier', icon: 'folder', key: 'Entrée', fn: () => openFolder(n.id) },
    n.type === 'folder' && { label: 'Tout ouvrir', icon: 'open', fn: () => openAll(n) },
    '-',
    { label: 'Modifier…', icon: 'edit', key: 'F2', fn: () => edit(n) },
    n.type === 'url' && { label: 'Copier le lien', icon: 'copy', key: 'Ctrl+C', fn: () => { navigator.clipboard.writeText(n.url); toast('Lien copié'); } },
    { label: 'Couper', icon: 'copy', key: 'Ctrl+X', fn: () => cut(many) },
    clip && { label: 'Coller ici', icon: 'import', key: 'Ctrl+V', fn: () => paste() },
    q && { label: 'Afficher dans son dossier', icon: 'folder', fn: () => { openFolder(parentOf(n.id).id); setTimeout(() => nav.setFocus(nav.idx(n.id)), 50); } },
    '-',
    { label: many.length > 1 ? TRF('Supprimer les {0} éléments', many.length) : 'Supprimer', icon: 'trash', key: 'Suppr', danger: true, fn: () => del(many) },
  ]);
}
async function edit(n, type) {
  const isNew = !n; type = n ? n.type : type;
  const fsel = id => folders().map(({ n: f, d }) => `<option value="${esc(f.id)}" ${f.id === id ? 'selected' : ''}>${'   '.repeat(d)}${esc(TR(f.title))}</option>`).join('');
  const pid = n ? parentOf(n.id)?.id : folderId;
  const r = await dialog({
    title: isNew ? (type === 'folder' ? 'Nouveau dossier' : 'Ajouter un favori') : (type === 'folder' ? 'Modifier le dossier' : 'Modifier le favori'), ok: isNew ? 'Ajouter' : 'Enregistrer',
    html: `<label>${esc(TR('Nom'))}</label><input type="text" id="eT" value="${esc(n ? n.title : '')}" spellcheck="false">` + (type === 'url' ? `<label>${esc(TR('Adresse'))}</label><input type="url" id="eU" value="${esc(n ? n.url : 'https://')}" spellcheck="false">` : '') +
      `<label>${esc(TR('Dossier'))}</label><select id="eF">${fsel(pid)}</select>`,
    read: d => {
      const title = $('#eT', d).value.trim(), url = type === 'url' ? $('#eU', d).value.trim() : '';
      if (type === 'url' && !/^(https?|file|ftp):\/\/\S+/i.test(url) && !/^[\w-]+(\.[\w-]+)+/.test(url)) { $('#eU', d).focus(); toast('Adresse invalide'); return false; }
      return { title: title || url || TR('Nouveau dossier'), url: url && !/^[a-z]+:\/\//i.test(url) ? 'https://' + url : url, parent: $('#eF', d).value };
    },
  });
  if (!r) return;
  if (isNew) { await call('bmAdd', { parentId: r.parent, type, title: r.title, url: r.url }); }
  else {
    await call('bmUpdate', n.id, type === 'url' ? { title: r.title, url: r.url } : { title: r.title });
    if (r.parent !== pid) await call('bmMove', [n.id], r.parent, -1);
  }
}
async function del(ids) {
  if (!ids.length) return;
  const folderCount = ids.map(node).filter(n => n && n.type === 'folder' && n.children.length).length;
  if (folderCount && !(await confirmBox(TR('Supprimer les dossiers sélectionnés et tout leur contenu ?'), 'Supprimer'))) return;
  undoList = await call('bmRemove', ids);
  nav.clear();
  toast(TRF('{0} élément(s) supprimé(s)', undoList.length), { label: 'Annuler', fn: undo });
}
async function undo() { if (!undoList) return; await call('bmRestore', undoList); undoList = null; toast('Suppression annulée'); }
function cut(ids) { clip = ids; toast(TRF('{0} élément(s) prêt(s) à déplacer : ouvrez un dossier puis Ctrl+V', ids.length)); }
async function paste() { if (!clip || q) return; await call('bmMove', clip, folderId, -1); clip = null; }
async function openAll(f) { const urls = []; const w = l => l.forEach(n => (n.type === 'folder' ? w(n.children) : urls.push(n.url))); w(f.children || []); if (urls.length > 20 && !(await confirmBox(TRF('Ouvrir {0} onglets ?', urls.length), 'Ouvrir', false))) return; urls.forEach(u => D.call('open', u, { background: true })); }
async function sortByName() { const f = node(folderId); const sorted = [...f.children].sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || a.title.localeCompare(b.title, LOC())); await call('bmMove', sorted.map(n => n.id), f.id, 0); }
async function importBm() { const n = await call('bmImport'); if (n) toast(TRF('{0} favori(s) importé(s) dans « Autres favoris »', n)); }
async function exportBm() { const f = await call('bmExport'); if (f) toast('Favoris exportés'); }

// raccourcis propres au gestionnaire de favoris
document.addEventListener('keydown', async e => {
  if ($('.dlg.on') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (c && k === 'x') { e.preventDefault(); const s = nav.selected().length ? nav.selected() : [nav.current()].filter(Boolean); if (s.length) cut(s); }
  else if (c && k === 'v') { e.preventDefault(); paste(); }
  else if (c && k === 'c') { const n = node(nav.current()); if (n && n.url) { e.preventDefault(); navigator.clipboard.writeText((nav.selected().length ? nav.selected() : [n.id]).map(node).filter(x => x && x.url).map(x => x.url).join('\n')); toast('Lien copié'); } }
  else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !q) {
    e.preventDefault(); const n = node(nav.current()); if (!n) return;
    const f = node(folderId); const i = f.children.indexOf(n), j = i + (e.key === 'ArrowUp' ? -1 : 2);
    if (i < 0 || j < 0 || j > f.children.length) return;
    await call('bmMove', [n.id], f.id, j);
    setTimeout(() => nav.setFocus(nav.idx(n.id)), 60);
  }
  else if (e.key === 'Backspace' && !q) { const p = parentOf(folderId); if (p) { e.preventDefault(); openFolder(p.id); } }
});
// glisser-déposer : réordonner dans la liste ou ranger dans un dossier de gauche
let drag = null;
$('#wrap').addEventListener('dragstart', e => { const r = e.target.closest('[data-k]'); if (!r) return; drag = nav.sel.has(r.dataset.k) ? nav.selected() : [r.dataset.k]; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setDragImage(r, 30, 18); } catch {} e.dataTransfer.setData('text/plain', drag.join(',')); });
$('#wrap').addEventListener('dragover', e => { const r = e.target.closest('[data-k]'); if (!drag || !r) return; e.preventDefault(); $$('.lrow').forEach(x => (x.style.boxShadow = '')); const b = r.getBoundingClientRect(); r.style.boxShadow = e.clientY > b.top + b.height / 2 ? 'inset 0 -2px 0 var(--accent)' : 'inset 0 2px 0 var(--accent)'; });
$('#wrap').addEventListener('drop', async e => {
  const r = e.target.closest('[data-k]'); $$('.lrow').forEach(x => (x.style.boxShadow = '')); if (!drag || !r) return; e.preventDefault();
  const f = node(folderId); const b = r.getBoundingClientRect(); let idx = f.children.findIndex(n => n.id === r.dataset.k) + (e.clientY > b.top + b.height / 2 ? 1 : 0);
  const target = node(r.dataset.k);
  if (target.type === 'folder' && !drag.includes(target.id) && e.clientY > b.top + b.height * 0.25 && e.clientY < b.bottom - b.height * 0.25) await call('bmMove', drag, target.id, -1);
  else await call('bmMove', drag, f.id, idx);
  drag = null;
});
$('#nav').addEventListener('dragover', e => { const f = e.target.closest('[data-f]'); if (drag && f) { e.preventDefault(); $$('#nav [data-f]').forEach(x => (x.style.outline = '')); f.style.outline = '2px solid var(--accent)'; } });
$('#nav').addEventListener('dragleave', () => $$('#nav [data-f]').forEach(x => (x.style.outline = '')));
$('#nav').addEventListener('drop', async e => { const f = e.target.closest('[data-f]'); $$('#nav [data-f]').forEach(x => (x.style.outline = '')); if (!drag || !f) return; e.preventDefault(); await call('bmMove', drag, f.dataset.f, -1); drag = null; });
load();
