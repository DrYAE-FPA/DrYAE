/* DrYAE — interface principale */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const D = window.dryae;
const call = (ch, ...a) => D.call(ch, ...a);

let items = new Map(), filter = 'all', S = {}, selected = new Set(), current = null, lastClickId = null, clipUrl = '', dismissed = new Set();

const EXT = {
  video: 'mp4 mkv avi mov webm flv wmv m4v 3gp ts m3u8 mpg mpeg', audio: 'mp3 wav flac aac ogg m4a opus wma', doc: 'pdf doc docx xls xlsx ppt pptx txt odt rtf epub csv',
  img: 'jpg jpeg png gif webp bmp svg heic tiff ico', arc: 'zip rar 7z tar gz bz2 xz iso tgz', app: 'exe msi apk dmg deb rpm appimage bat msix', sub: 'srt vtt ass ssa',
};
const extOf = n => { const m = String(n || '').match(/\.([a-z0-9]{1,6})(?:$|\?)/i); return m ? m[1].toLowerCase() : ''; };
const catOf = d => { if (d.type === 'torrent') return 'torrent'; if (d.type === 'ytdl') return d.mode === 'audio' ? 'audio' : 'video'; const e = extOf(d.name || d.url); for (const k in EXT) if (EXT[k].split(' ').includes(e)) return k; return d.type === 'hls' ? 'video' : 'other'; };
const fmt = b => { if (b == null || b < 0) return '?'; const u = ['o', 'Ko', 'Mo', 'Go', 'To']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return (i ? b.toFixed(b < 10 ? 2 : 1) : Math.round(b)) + ' ' + u[i]; };
const fmtT = s => { if (s < 0 || !isFinite(s)) return '—'; s = Math.round(s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : m ? `${m} min ${x} s` : `${x} s`; };
const ST = { running: 'En cours', done: 'Terminé', paused: 'En pause', error: 'Échec', queued: 'En attente', scheduled: 'Planifié', seeding: 'Partage', merging: 'Assemblage' };
// à défaut de titre : nom lisible tiré du lien (jamais la longue adresse)
const prettyUrl = u => { try { const x = new URL(u); const last = decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || ''); return (last && !/^(master|index|playlist|manifest|video)\.(m3u8|mpd)$/i.test(last) ? last : x.hostname) ; } catch { return u; } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, st = '') => `<svg style="${st}"><use href="#i-${n}"/></svg>`;
const btn = (act, icon, title) => `<button class="icon-btn" data-act="${act}" title="${title}">${ic(icon)}</button>`;
const progressOf = d => d.status === 'done' ? 1 : (d.type === 'hls' || d.type === 'ytdl') ? (d.progress || 0) : d.size > 0 ? Math.min(1, d.downloaded / d.size) : 0;

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
async function safe(fn) { try { return await fn(); } catch (e) { toast(e.message || String(e)); } }

// ---------------- thème ----------------
function themeIcon() { const dark = document.documentElement.dataset.mode !== 'light'; $('#themeIc').setAttribute('href', dark ? '#i-sun' : '#i-moon'); $('#themeBtn').title = dark ? 'Passer au thème clair' : 'Passer au thème sombre'; }
$('#themeBtn').onclick = async () => {
  const dark = document.documentElement.dataset.mode !== 'light';
  S = await call('setSettings', { theme: { mode: dark ? 'light' : (S.theme.mode === 'amoled' ? 'amoled' : 'dark') } });
  applyTheme();
};
function applyTheme() {
  const t = S.theme || {};
  let mode = t.mode || 'dark';
  if (mode === 'system') mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.mode = mode;
  const a = t.accent || '#8b5cf6';
  const r = document.documentElement.style;
  r.setProperty('--accent', a); r.setProperty('--accent-soft', a + '22'); r.setProperty('--accent-line', a + '55');
  themeIcon();
}

// ---------------- liste ----------------
function match(d) {
  const q = $('#q').value.trim().toLowerCase();
  if (q && !((d.name || '') + ' ' + d.url).toLowerCase().includes(q)) return false;
  switch (filter) {
    case 'all': return true;
    case 'active': return ['running', 'queued', 'merging', 'seeding'].includes(d.status);
    case 'done': case 'paused': case 'error': case 'scheduled': return d.status === filter;
    case 'torrent': return d.type === 'torrent';
    case 'hls': return d.type === 'hls';
    case 'ytdl': return d.type === 'ytdl';
    default: return catOf(d) === filter;
  }
}

function metaHtml(d) {
  const p = progressOf(d);
  let m = `<span class="st ${d.status}">${ST[d.status] || d.status}`;
  if (d.status === 'running' && d.activeConnections) m += ` · ${d.activeConnections} conn.`;
  if (d.type === 'torrent' && ['running', 'seeding'].includes(d.status)) m += ` · ${d.numPeers || 0} pairs`;
  m += '</span>';
  if (d.status === 'done') {
    m += `<span>${fmt(d.size)}</span>`;
    if (d.type === 'torrent' && d.uploaded) m += `<span>envoyé ${fmt(d.uploaded)}</span>`;
    m += `<span>${new Date(d.finished || d.added).toLocaleString((window.I18N && I18N.locale || 'fr-FR'))}</span>`;
  } else if (d.status === 'seeding') {
    m += `<span>${fmt(d.size)}</span><span>↑ ${fmt(d.uploadSpeed)}/s</span><span>ratio ${(d.ratioNow || 0).toFixed(2)}</span>`;
  } else {
    if (d.type === 'hls') m += `<span>${fmt(d.downloaded)}${d.estSize > 0 ? ' / ~' + fmt(d.estSize) : ''} · ${(p * 100).toFixed(1)} %</span>${d.segInfo ? `<span>${esc(d.segInfo)}</span>` : ''}`;
    else if (d.type === 'ytdl') m += `<span>${esc(d.formatLabel || '')}</span>${d.curTotal > 0 ? `<span>${esc(d.phase || '')} ${(p * 100).toFixed(1)} % de ${fmt(d.curTotal)}</span>` : d.status === 'running' ? '<span>analyse de la vidéo…</span>' : ''}`;
    else if (d.type === 'torrent' && !d.meta) m += `<span>recherche des métadonnées…</span>`;
    else m += `<span>${fmt(d.downloaded)} / ${fmt(d.size)}${d.size > 0 ? ' · ' + (p * 100).toFixed(1) + ' %' : ''}</span>`;
    if (d.status === 'running') {
      m += `<span>${fmt(d.speed)}/s</span><span>reste ${fmtT(d.eta)}</span>`;
      if (d.type === 'torrent' && d.uploadSpeed > 1024) m += `<span>↑ ${fmt(d.uploadSpeed)}/s</span>`;
    }
    if (d.speedLimit) m += `<span title="Limite de vitesse">⏱ ${d.speedLimit} Ko/s</span>`;
    if (d.status === 'error') m += `<span style="color:var(--err)">${esc(d.error)}</span>`;
  }
  return m;
}

function rowHtml(d) {
  const p = progressOf(d);
  const cat = catOf(d);
  const e = d.type === 'torrent' ? 'BT' : d.type === 'hls' ? 'HLS' : d.type === 'ytdl' ? (d.mode === 'audio' ? (d.audioFormat || 'mp3').toUpperCase() : 'MP4') : (extOf(d.name) || '?').slice(0, 4).toUpperCase();
  const indet = (d.status === 'running' && d.type === 'ytdl' && !d.curTotal) || (d.status === 'running' && d.type === 'http' && d.size <= 0) || d.status === 'merging' || (d.type === 'torrent' && d.status === 'running' && !d.meta);
  const segs = d.status === 'running' && d.type === 'http' && d.segments && d.segments.length > 1 && d.size > 0
    ? `<div class="segs">${d.segments.slice(0, 32).map(s => `<span><i style="width:${Math.min(100, s.done / Math.max(1, s.end - s.start + 1) * 100)}%"></i></span>`).join('')}</div>` : '';
  let acts = '';
  if (['running', 'queued', 'scheduled', 'merging'].includes(d.status)) acts += btn('pause', 'pause', 'Pause');
  if (['paused', 'error'].includes(d.status)) acts += btn('resume', 'play', 'Reprendre');
  if (d.status === 'seeding') acts += btn('pause', 'pause', 'Arrêter le partage');
  if (d.status === 'done') acts += btn('open', 'open', 'Ouvrir');
  if (d.status === 'error') acts += btn('restart', 'redo', 'Recommencer');
  acts += btn('folder', 'folder', 'Afficher dans le dossier') + btn('remove', 'x', 'Retirer');
  return `<input type="checkbox" class="rowchk" data-chk ${selected.has(d.id) ? 'checked' : ''} title="Sélectionner">
    <div class="ftype c-${cat}">${esc(e)}</div>
    <div class="info"><div class="name" title="${esc(d.file || d.url)}">${esc(d.name || d.displayName || d.title || prettyUrl(d.url))}</div>
    <div class="meta">${metaHtml(d)}</div>
    <div class="bar ${d.status} ${indet ? 'indet' : ''}"><i style="width:${p * 100}%"></i></div>${segs}</div>
    <div class="actions">${acts}</div>`;
}

function sorted() { return [...items.values()].sort((a, b) => b.added - a.added); }

function render() {
  const list = $('#list');
  const arr = sorted().filter(match);
  if (!arr.length) {
    list.innerHTML = `<div class="empty"><img src="../../assets/logo.png" alt=""><b>${items.size ? 'Aucun élément ici' : 'Aucun téléchargement'}</b>
      <div>${items.size ? 'Change de filtre ou de recherche.' : 'Ajoute un lien, un torrent, ou ouvre le navigateur pour trouver des vidéos.'}</div>
      ${items.size ? '' : `<div class="row"><button class="btn primary" data-go="add">${ic('plus')}Ajouter un lien</button><button class="btn" data-go="torrent">${ic('magnet')}Ajouter un torrent</button><button class="btn" data-go="browser">${ic('globe')}Ouvrir le navigateur</button></div>`}</div>`;
  } else {
    list.querySelector('.empty')?.remove();
    const keep = new Set(arr.map(d => d.id));
    list.querySelectorAll('.item').forEach(el => { if (!keep.has(el.dataset.id)) el.remove(); });
    let prev = null;
    for (const d of arr) {
      let el = list.querySelector(`.item[data-id="${d.id}"]`);
      if (!el) { el = document.createElement('div'); el.className = 'item'; el.dataset.id = d.id; }
      const html = rowHtml(d) + (selected.has(d.id) ? '' : '');
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle('sel', selected.has(d.id));
      const ck = el.querySelector('[data-chk]'); if (ck) ck.checked = selected.has(d.id);
      el.classList.toggle('cur', current === d.id);
      const want = prev ? prev.nextSibling : list.firstChild;
      if (want !== el) list.insertBefore(el, want);
      prev = el;
    }
  }
  counts();
  bulkBar();
}

function counts() {
  const all = [...items.values()];
  const c = { all: all.length, active: 0, done: 0, paused: 0, error: 0, scheduled: 0, torrent: 0, hls: 0, ytdl: 0, video: 0, audio: 0, doc: 0, img: 0, arc: 0, app: 0, other: 0 };
  let sp = 0, up = 0;
  for (const d of all) {
    if (['running', 'queued', 'merging', 'seeding'].includes(d.status)) c.active++;
    if (d.status in c && !['all', 'active'].includes(d.status)) c[d.status]++;
    if (d.type === 'torrent') c.torrent++;
    if (d.type === 'hls') c.hls++;
    if (d.type === 'ytdl') c.ytdl++;
    const k = catOf(d); if (k in c && k !== 'torrent') c[k]++;
    if (d.status === 'running') sp += d.speed || 0;
    if (d.status === 'running' || d.status === 'seeding') up += d.uploadSpeed || 0;
  }
  $$('[data-c]').forEach(el => (el.textContent = c[el.dataset.c] || ''));
  $('#total').textContent = '↓ ' + fmt(sp) + '/s';
  $('#totalUp').textContent = up > 0 ? '↑ ' + fmt(up) + '/s' : '';
}

let selMode = false;
function bulkBar() {
  for (const id of selected) if (!items.has(id)) selected.delete(id);
  const vis = sorted().filter(match);
  $('#bulk').classList.toggle('on', selMode || selected.size > 1);
  document.body.classList.toggle('selmode', selMode || selected.size > 1);
  $('#bulkN').textContent = selected.size ? `${selected.size} sélectionné(s)` : 'Tout sélectionner';
  $('#bulkAll').checked = vis.length > 0 && vis.every(d => selected.has(d.id));
  $('#bulkAll').indeterminate = selected.size > 0 && !$('#bulkAll').checked;
}
$('#bulkAll').onchange = e => { const vis = sorted().filter(match); if (e.target.checked) vis.forEach(d => selected.add(d.id)); else selected.clear(); render(); };
$('#selBtn').onclick = () => { selMode = !selMode; if (!selMode) selected.clear(); $('#selBtn').classList.toggle('on', selMode); render(); };

// clic sur la liste
$('#list').addEventListener('click', async e => {
  const go = e.target.closest('[data-go]');
  if (go) return go.dataset.go === 'add' ? showAdd() : go.dataset.go === 'torrent' ? showTorrent() : call('openBrowser');
  const row = e.target.closest('.item'); if (!row) return;
  const id = row.dataset.id, d = items.get(id);
  const b = e.target.closest('[data-act]');
  if (b) return itemAction(b.dataset.act, d);
  if (e.target.matches('[data-chk]')) { e.target.checked ? selected.add(id) : selected.delete(id); lastClickId = id; return render(); }
  if (selMode || (selected.size > 1 && !e.shiftKey && !e.ctrlKey && document.body.classList.contains('selmode') && e.target.closest('.ftype'))) { selected.has(id) ? selected.delete(id) : selected.add(id); lastClickId = id; return render(); }
  if (e.ctrlKey) { selected.has(id) ? selected.delete(id) : selected.add(id); }
  else if (e.shiftKey && lastClickId) {
    const arr = sorted().filter(match).map(x => x.id);
    const a = arr.indexOf(lastClickId), z = arr.indexOf(id);
    arr.slice(Math.min(a, z), Math.max(a, z) + 1).forEach(x => selected.add(x));
  } else { selected = new Set([id]); openDrawer(id); }
  lastClickId = id;
  render();
});
$('#list').addEventListener('dblclick', e => {
  const row = e.target.closest('.item'); if (!row || e.target.closest('[data-act]')) return;
  const d = items.get(row.dataset.id);
  if (d.status === 'done') call('open', d.id); else if (['paused', 'error'].includes(d.status)) call('resume', d.id);
});
$('#list').addEventListener('contextmenu', e => {
  const row = e.target.closest('.item'); if (!row) return;
  e.preventDefault();
  const d = items.get(row.dataset.id);
  if (!selected.has(d.id)) { selected = new Set([d.id]); render(); }
  showMenu(e.clientX, e.clientY, itemMenu(d));
});

async function itemAction(act, d) {
  switch (act) {
    case 'pause': return call('pause', d.id);
    case 'resume': return call('resume', d.id);
    case 'restart': return confirmAsk('Recommencer le téléchargement depuis le début ?') && call('restart', d.id);
    case 'open': return safe(() => call('open', d.id));
    case 'openWith': return call('openWith', d.id);
    case 'play': return d.type === 'torrent' ? safe(() => call('torrent:stream', d.id)) : call('play', d.id);
    case 'folder': return call('showInFolder', d.id);
    case 'copy': await call('copy', d.url); return toast('Lien copié');
    case 'copyPath': await call('copy', d.file || d.dir); return toast('Chemin copié');
    case 'copyName': await call('copy', d.name); return toast('Nom copié');
    case 'copyPage': await call('copy', d.pageUrl); return toast('Adresse de la page copiée');
    case 'remove': return removeItems([d.id]);
    case 'refresh': return refreshLink(d);
    case 'rename': return renameItem(d);
    case 'move': return safe(() => call('move', d.id));
    case 'limit': return speedItem(d);
    case 'schedule': return call('setScheduled', [d.id], d.status !== 'scheduled');
    case 'md5': case 'sha1': case 'sha256': return hashItem(d, act);
    case 'extract': return extractItem(d);
    case 'details': return openDrawer(d.id);
    case 'browser': return call('openBrowser', d.pageUrl || d.url);
  }
}

function itemMenu(d) {
  const M = [['details', 'list', 'Informations'], '-'];
  const isArc = /\.(zip|7z|rar|tar|gz|tgz|bz2|xz|iso)$/i.test(d.name || '');
  const isMedia = /\.(mp4|webm|mkv|mp3|m4a|ogg|wav|flac|mov)$/i.test(d.name || '') || d.type === 'torrent';
  if (d.status === 'done') { M.push(['open', 'open', 'Ouvrir'], ['openWith', 'open', 'Ouvrir avec…']); if (isMedia) M.push(['play', 'play', 'Lire dans DrYAE']); }
  if (d.type === 'torrent' && ['running', 'paused', 'queued'].includes(d.status)) M.push(['play', 'stream', 'Lire pendant le téléchargement']);
  if (['paused', 'error'].includes(d.status)) M.push(['resume', 'play', 'Reprendre']);
  if (['running', 'queued', 'seeding', 'scheduled'].includes(d.status)) M.push(['pause', 'pause', d.status === 'seeding' ? 'Arrêter le partage' : 'Pause']);
  if (d.type === 'torrent' && d.status === 'done') M.push(['resume', 'share', 'Partager à nouveau (seed)']);
  M.push(['folder', 'folder', 'Afficher dans le dossier'], '-');
  M.push(['copy', 'link', 'Copier le lien'], ['copyName', 'copy', 'Copier le nom du fichier'], ['copyPath', 'copy', 'Copier le chemin']);
  if (d.pageUrl) M.push(['copyPage', 'copy', "Copier l'adresse de la page"], ['browser', 'globe', 'Ouvrir la page dans le navigateur']);
  M.push('-');
  if (d.type !== 'torrent' && d.status !== 'done') M.push(['refresh', 'redo', 'Rafraîchir le lien']);
  M.push(['rename', 'doc', 'Renommer'], ['limit', 'gauge', 'Limite de vitesse…']);
  if (d.status === 'done') M.push(['move', 'folder', 'Déplacer…']);
  if (!['done', 'seeding'].includes(d.status)) M.push(['schedule', 'clock', d.status === 'scheduled' ? 'Retirer du planificateur' : 'Ajouter au planificateur']);
  if (d.status === 'done' && d.type !== 'torrent') M.push('-', ['md5', 'ok', 'Somme MD5'], ['sha256', 'ok', 'Somme SHA-256']);
  if (d.status === 'done' && isArc) M.push(['extract', 'arc', "Extraire l'archive"]);
  M.push('-', ['restart', 'redo', 'Recommencer'], ['remove', 'x', 'Retirer…']);
  return M.map(m => (m === '-' ? m : { label: m[2], icon: m[1], fn: () => itemAction(m[0], d) }));
}

function showMenu(x, y, entries) {
  const m = $('#menu');
  m.innerHTML = entries.map((e, i) => (e === '-' ? '<hr>' : `<button data-i="${i}">${ic(e.icon || 'list')}${esc(e.label)}</button>`)).join('');
  m.classList.add('on');
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  m.onclick = ev => { const b = ev.target.closest('[data-i]'); if (!b) return; m.classList.remove('on'); entries[+b.dataset.i].fn(); };
}
document.addEventListener('mousedown', e => { if (!e.target.closest('#menu')) $('#menu').classList.remove('on'); });

// ---------------- boîtes de dialogue ----------------
const openM = id => $(id).classList.add('on');
const closeM = () => $$('.overlay').forEach(o => o.classList.remove('on'));
$$('[data-close]').forEach(b => (b.onclick = closeM));
$$('.overlay').forEach(o => o.addEventListener('mousedown', e => { if (e.target === o && o.id !== 'sModal') closeM(); }));
const bindRange = (r, v) => { const u = () => ($(v).textContent = $(r).value); $(r).oninput = u; u(); };

function prompt2(title, fields, okLabel = 'OK') {
  return new Promise(res => {
    $('#pTitle').textContent = title;
    $('#pBody').innerHTML = fields.map(f => f.html ? f.html : `<label>${esc(f.label)}</label><input type="${f.type || 'text'}" id="pf_${f.id}" value="${esc(f.value ?? '')}" placeholder="${esc(f.ph || '')}">`).join('');
    $('#pOk').textContent = okLabel;
    openM('#pModal');
    setTimeout(() => $('#pBody input')?.select(), 30);
    const done = v => { closeM(); $('#pOk').onclick = null; res(v); };
    $('#pOk').onclick = () => { const o = {}; fields.forEach(f => f.id && (o[f.id] = $('#pf_' + f.id)?.value)); done(o); };
    $$('#pModal [data-close]').forEach(b => (b.onclick = () => done(null)));
    $('#pBody').onkeydown = e => { if (e.key === 'Enter') $('#pOk').click(); };
  });
}
function confirmAsk(text) { return window.confirm(text); }

async function removeItems(ids) {
  const anyDone = ids.some(id => ['done', 'seeding'].includes(items.get(id)?.status));
  let del = false;
  if (anyDone || ids.length > 1) {
    const r = await prompt2(ids.length > 1 ? `Retirer ${ids.length} éléments` : 'Retirer de la liste', [{ html: `<p>${ids.length > 1 ? 'Les éléments seront retirés de la liste.' : esc(items.get(ids[0]).name)}</p><label class="check"><input type="checkbox" id="pDel"> Supprimer aussi les fichiers du disque</label>` }], 'Retirer');
    if (!r) return;
    del = $('#pDel').checked;
  }
  await call('remove', ids, del);
  ids.forEach(id => { items.delete(id); selected.delete(id); });
  if (ids.includes(current)) closeDrawer();
  render();
}
async function refreshLink(d) {
  const r = await prompt2('Rafraîchir le lien', [{ html: `<p class="hint">Si le lien a expiré, colle un nouveau lien vers le même fichier : le téléchargement reprend là où il s'était arrêté.</p>` }, { id: 'url', label: 'Nouveau lien', value: '' }], 'Reprendre');
  if (r?.url) safe(() => call('refresh', d.id, r.url.trim()));
}
async function renameItem(d) {
  const r = await prompt2('Renommer', [{ id: 'name', label: 'Nouveau nom', value: d.name || '' }]);
  if (r?.name) safe(() => call('rename', d.id, r.name));
}
async function speedItem(d) {
  const r = await prompt2('Limite de vitesse', [{ id: 'kb', label: 'Ko/s pour ce téléchargement (0 = illimitée)', type: 'number', value: d.speedLimit || 0 },
    ...(d.type === 'http' ? [{ id: 'conn', label: 'Connexions (1–32)', type: 'number', value: d.connections || S.connections }] : [])]);
  if (!r) return;
  await call('itemSpeed', d.id, +r.kb || 0);
  if (r.conn) await call('itemConnections', d.id, +r.conn);
}
async function hashItem(d, algo) {
  toast('Calcul en cours…');
  const h = await safe(() => call('checksum', d.id, algo));
  if (!h) return;
  const clip = (await call('clipboard')).trim().toLowerCase();
  const cmp = /^[a-f0-9]{32,128}$/.test(clip) ? (clip === h ? '<p style="color:var(--ok)">✔ Identique à la somme du presse-papiers</p>' : '<p style="color:var(--err)">✘ Différente de la somme du presse-papiers</p>') : '';
  const r = await prompt2(`Somme ${algo.toUpperCase()}`, [{ html: `<p class="mono">${h}</p>${cmp}` }], 'Copier');
  if (r) { await call('copy', h); toast('Somme copiée'); }
}
async function extractItem(d, pass) {
  toast('Extraction…');
  try { await call('extract', d.id, pass); toast('Archive extraite'); }
  catch (e) {
    if (/mot de passe/i.test(e.message)) { const r = await prompt2('Archive protégée', [{ id: 'p', label: 'Mot de passe', type: 'password' }]); if (r?.p) extractItem(d, r.p); }
    else toast(e.message);
  }
}

// ---------------- panneau de détails ----------------
let dTab = 'info', dTimer = null;
function closeDrawer() { current = null; $('#drawer').classList.remove('on'); clearInterval(dTimer); render(); }
$('#dClose').onclick = closeDrawer;
async function openDrawer(id) {
  current = id; dTab = items.get(id)?.type === 'torrent' ? 'files' : 'info';
  $('#drawer').classList.add('on');
  await drawDrawer();
  clearInterval(dTimer); dTimer = setInterval(drawDrawer, 1000);
}
async function drawDrawer() {
  if (!current) return;
  const d = await call('details', current).catch(() => null);
  if (!d) return closeDrawer();
  const cat = catOf(d);
  $('#dIcon').className = 'ftype c-' + cat;
  $('#dIcon').textContent = d.type === 'torrent' ? 'BT' : d.type === 'hls' ? 'HLS' : d.type === 'ytdl' ? (d.mode === 'audio' ? (d.audioFormat || 'mp3').toUpperCase() : 'MP4') : (extOf(d.name) || '?').slice(0, 4).toUpperCase();
  $('#dName').textContent = d.name || d.displayName || d.title || prettyUrl(d.url);
  $('#dMeta').innerHTML = metaHtml(d);
  const body = $('#dBody');
  const sc = body.scrollTop;
  const p = progressOf(d);
  let h = `<div class="bar ${d.status}" style="height:6px"><i style="width:${p * 100}%"></i></div>`;
  const acts = [];
  if (['paused', 'error'].includes(d.status)) acts.push(['resume', 'play', 'Reprendre']);
  if (['running', 'queued', 'scheduled', 'seeding'].includes(d.status)) acts.push(['pause', 'pause', d.status === 'seeding' ? 'Arrêter le partage' : 'Pause']);
  if (d.status === 'done') acts.push(['open', 'open', 'Ouvrir']);
  if (d.type === 'torrent' && d.status !== 'done') acts.push(['play', 'stream', 'Lire en streaming']);
  if (d.status === 'done' && /\.(mp4|webm|mkv|mp3|m4a|ogg|wav)$/i.test(d.name || '')) acts.push(['play', 'play', 'Lire']);
  acts.push(['folder', 'folder', 'Dossier']);
  h += `<div class="tools">${acts.map(a => `<button class="btn sm" data-dact="${a[0]}">${ic(a[1])}${a[2]}</button>`).join('')}<button class="btn sm" data-dact="menu">${ic('list')}Plus…</button></div>`;
  if (d.type === 'torrent') {
    h += `<div class="tabs">${[['files', 'Fichiers'], ['info', 'Infos'], ['peers', 'Pairs'], ['trackers', 'Trackers']].map(t => `<button data-dtab="${t[0]}" class="${dTab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>`;
  }
  const T = d.torrent;
  if (dTab === 'info' || !T) {
    const kv = [];
    kv.push(['Nom', `<b>${esc(d.name || d.displayName || d.title || prettyUrl(d.url))}</b>`]);
    if (d.type !== 'torrent') kv.push(['Lien', `<a data-dact="copy">${esc(d.url)}</a>`]);
    if (d.type === 'ytdl' && d.thumbnail) kv.unshift(['Aperçu', `<img src="${esc(d.thumbnail)}" style="width:100%;max-width:240px;border-radius:8px" alt="">`]);
    if (d.pageUrl) kv.push(['Page', `<a data-dact="browser">${esc(d.pageUrl)}</a>`]);
    kv.push(['Dossier', esc(d.dir || '—')]);
    if (d.file) kv.push(['Fichier', esc(d.file)]);
    kv.push(['Taille', d.type === 'hls' && d.status !== 'done' ? (d.estSize > 0 ? '~' + fmt(d.estSize) : 'inconnue') : fmt(d.size)]);
    kv.push(['Téléchargé', fmt(d.downloaded) + (p ? ` (${(p * 100).toFixed(1)} %)` : '')]);
    if (d.type === 'http') { kv.push(['Reprise', d.resumable ? '<span style="color:var(--ok)">possible</span>' : d.size > 0 || d.status !== 'queued' ? '<span style="color:var(--warn)">non prise en charge par le serveur</span>' : '—']); kv.push(['Connexions', `${d.activeConnections || 0} actives / ${d.connections} max`]); if (d.mime) kv.push(['Type', esc(d.mime)]); }
    if (d.type === 'hls') { kv.push(['Qualité', esc(d.variantInfo || 'auto')]); if (d.segInfo) kv.push(['Segments', esc(d.segInfo)]); }
    if (d.type === 'ytdl') { kv.push(['Format', esc(d.formatLabel || '')]); if (d.phase && d.status !== 'done') kv.push(['Étape', esc(d.phase)]); }
    if (T) { kv.push(['Hash', `<span class="mono">${esc(T.infoHash || '')}</span>`]); kv.push(['Envoyé', `${fmt(d.uploaded)} · ratio ${(d.ratioNow || 0).toFixed(2)}${d.ratio ? ' / ' + d.ratio : ''}`]); kv.push(['Pièces', T.pieces ? `${T.pieces} × ${fmt(T.pieceLength)}` : '—']); }
    kv.push(['Vitesse', d.status === 'running' ? fmt(d.speed) + '/s' : '—'], ['Temps restant', fmtT(d.eta)], ['Limite', d.speedLimit ? d.speedLimit + ' Ko/s' : 'aucune']);
    kv.push(['Ajouté', new Date(d.added).toLocaleString((window.I18N && I18N.locale || 'fr-FR'))]);
    if (d.finished) {
      kv.push(['Terminé', new Date(d.finished).toLocaleString((window.I18N && I18N.locale || 'fr-FR'))]);
      const secs = Math.max(1, (d.activeMs ? d.activeMs : d.finished - d.added) / 1000);
      kv.push(["Temps d'activité", fmtT(secs)]);
      if (d.size > 0) kv.push(['Vitesse moyenne', fmt(d.size / secs) + '/s']);
    }
    if (d.duration) kv.push(['Durée', fmtT(d.duration)]);
    if (d.status === 'done' && d.type !== 'torrent' && !d.md5) kv.push(['Sommes de contrôle', `<button class="btn sm" data-dact="md5">MD5</button> <button class="btn sm" data-dact="sha256">SHA-256</button>`]);
    if (d.md5) kv.push(['MD5', `<span class="mono">${d.md5}</span>`]);
    if (d.error) kv.push(['Erreur', `<span style="color:var(--err)">${esc(d.error)}</span>`]);
    h += `<dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    if (d.segs && d.size > 0) {
      h += `<div class="sect">Connexions</div><div class="segmap">${d.segs.map(s => `<i class="${s.active ? 'act' : ''}" style="left:${s.start / d.size * 100}%;width:${s.done / d.size * 100}%"></i>`).join('')}</div>`;
    }
    if (d.errorCode === 'webpage') h += `<div class="tools"><button class="btn sm primary" data-dact="browser">${ic('globe')}Ouvrir la page dans le navigateur</button></div>`;
    if (d.errorCode === 'auth') h += `<div class="tools"><button class="btn sm primary" data-dact="auth">Saisir un identifiant</button></div>`;
  }
  if (T && dTab === 'files') {
    h += `<div class="row" style="margin:6px 0;justify-content:space-between"><span class="hint">${T.files.length} fichier(s)</span><label class="check" style="margin:0"><input type="checkbox" id="dSeq" ${d.sequential ? 'checked' : ''}> Séquentiel</label></div>`;
    h += `<div class="flist">${T.files.map(f => `<div class="frow"><input type="checkbox" data-fsel="${f.i}" ${f.selected ? 'checked' : ''}><span class="n" title="${esc(f.path)}">${esc(f.path.split(/[\\/]/).slice(1).join('/') || f.path)}</span><span class="s">${fmt(f.length)}</span><div class="p"><i style="width:${f.progress * 100}%"></i></div></div>`).join('') || '<p class="hint">En attente des métadonnées…</p>'}</div>`;
    h += `<div class="row" style="margin-top:10px"><label class="check" style="margin:0"><input type="checkbox" id="dSeed" ${d.seedAfter ? 'checked' : ''}> Partager une fois terminé</label><span style="flex:1"></span><span class="hint">Ratio</span><input type="number" id="dRatio" value="${d.ratio}" min="0" step="0.1" style="width:70px"></div>`;
    h += `<div class="tools"><button class="btn sm" data-dact="magnet">${ic('magnet')}Copier le magnet</button><button class="btn sm" data-dact="hash">${ic('copy')}Copier le hash</button></div>`;
  }
  if (T && dTab === 'peers') {
    h += T.peers.length ? `<table class="peers"><tr><th>Adresse</th><th>↓</th><th>↑</th></tr>${T.peers.map(p => `<tr><td>${esc(p.addr)}</td><td>${fmt(p.down)}/s</td><td>${fmt(p.up)}/s</td></tr>`).join('')}</table>` : '<p class="hint">Aucun pair connecté pour le moment.</p>';
  }
  if (T && dTab === 'trackers') {
    h += `<div class="list-edit">${T.trackers.map(t => `<div><span class="mono">${esc(t)}</span></div>`).join('') || '<p class="hint">Aucun tracker (DHT uniquement).</p>'}</div>`;
    h += `<label>Ajouter des trackers (un par ligne)</label><textarea id="dTr" style="min-height:60px"></textarea><div class="tools"><button class="btn sm" data-dact="addTr">Ajouter</button></div>`;
  }
  // ne pas écraser un champ en cours d'édition
  const focused = document.activeElement && body.contains(document.activeElement) && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (!focused && body._h !== h) { body.innerHTML = h; body._h = h; body.scrollTop = sc; }
  body._d = d;
}
$('#dBody').addEventListener('click', async e => {
  const d = $('#dBody')._d; if (!d) return;
  const tab = e.target.closest('[data-dtab]');
  if (tab) { dTab = tab.dataset.dtab; $('#dBody')._h = ''; return drawDrawer(); }
  const a = e.target.closest('[data-dact]'); if (!a) return;
  const act = a.dataset.dact;
  if (act === 'menu') { const r = a.getBoundingClientRect(); return showMenu(r.left, r.bottom + 4, itemMenu(d)); }
  if (act === 'md5' || act === 'sha256') return itemAction(act, d);
  if (act === 'magnet') { await call('copy', d.torrent.magnet); return toast('Lien magnet copié'); }
  if (act === 'hash') { await call('copy', d.torrent.infoHash); return toast('Hash copié'); }
  if (act === 'addTr') { const l = $('#dTr').value.split(/\s+/).filter(Boolean); await call('torrent:trackers', d.id, l); $('#dTr').value = ''; return toast(`${l.length} tracker(s) ajouté(s)`); }
  if (act === 'auth') {
    let host = ''; try { host = new URL(d.url).hostname; } catch {}
    const r = await prompt2('Identification pour ' + host, [{ id: 'u', label: 'Identifiant' }, { id: 'p', label: 'Mot de passe', type: 'password' }], 'Enregistrer et reprendre');
    if (r?.u) { await call('passwords:add', host, r.u, r.p); call('resume', d.id); }
    return;
  }
  itemAction(act, d);
});
$('#dBody').addEventListener('change', async e => {
  const d = $('#dBody')._d; if (!d) return;
  if (e.target.matches('[data-fsel]')) {
    const sel = $$('#dBody [data-fsel]').filter(x => x.checked).map(x => +x.dataset.fsel);
    if (!sel.length) { e.target.checked = true; return toast('Garde au moins un fichier'); }
    await call('torrent:select', d.id, sel);
  }
  if (e.target.id === 'dSeq') call('torrent:sequential', d.id, e.target.checked);
  if (e.target.id === 'dSeed') call('torrent:seed', d.id, e.target.checked);
  if (e.target.id === 'dRatio') call('torrent:ratio', d.id, +e.target.value);
});

// ---------------- ajout de liens ----------------
let addCtx = {};
async function showAdd(pre = {}) {
  addCtx = pre;
  let txt = pre.urls ? pre.urls.join('\n') : pre.url || '';
  if (!txt) { const c = (await call('clipboard')).trim(); if (/^https?:\/\/\S+$/i.test(c)) txt = c; }
  $('#aUrls').value = txt;
  $('#aName').value = pre.name || '';
  $('#aDir').value = '';
  $('#aSpeed').value = 0;
  $('#aConn').value = S.connections; bindRange('#aConn', '#aConnV');
  $('#aRef').value = pre.page || pre.headers?.Referer || '';
  $('#aUA').value = pre.headers?.['User-Agent'] || '';
  $('#aCookie').value = pre.headers?.Cookie || '';
  $('#aBatch').checked = false;
  $('#aSchedule').checked = !!(S.scheduler?.enabled && S.scheduler?.addNew);
  $('#aHls').style.display = 'none'; $('#aVariants').innerHTML = ''; $('#aInfo').textContent = '';
  ytReset();
  openM('#addModal');
  setTimeout(() => $('#aUrls').focus(), 30);
  inspectAdd();
}
let inspT = null;
$('#aUrls').addEventListener('input', () => { clearTimeout(inspT); inspT = setTimeout(inspectAdd, 600); });
// ---- vidéos en ligne (yt-dlp) ----
let ytInfo = null, ytFor = '';
const ONLINE = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|dailymotion\.com|dai\.ly|facebook\.com|fb\.watch|instagram\.com|tiktok\.com|twitter\.com|x\.com|twitch\.tv|soundcloud\.com|bilibili\.com|reddit\.com|v\.redd\.it|rumble\.com|odysee\.com|bandcamp\.com|mixcloud\.com|streamable\.com|vk\.com|ok\.ru|archive\.org|ted\.com|arte\.tv|france\.tv)$/i;
const isOnline = u => { try { return ONLINE.test(new URL(u).hostname); } catch { return false; } };
function ytReset() { ytInfo = null; ytFor = ''; $('#aYt').style.display = 'none'; $('#aConnBox').style.display = ''; }
$('#aYtSeg').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; $('#aYtMode').value = b.dataset.v; ytModeUi(); };
function ytModeUi() {
  const m = $('#aYtMode').value;
  $$('#aYtSeg [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === m));
  $('#aYtQBox').style.display = m === 'video' ? '' : 'none';
  $('#aYtBBox').style.display = m === 'mp3' ? '' : 'none';
}
$('#aYtMode').onchange = ytModeUi;
async function inspectYt(u) {
  ytFor = u; ytInfo = null;
  $('#aYt').style.display = ''; $('#aConnBox').style.display = 'none'; $('#aHls').style.display = 'none';
  $('#aYtTitle').textContent = 'Analyse de la vidéo…'; $('#aYtMeta').textContent = ''; $('#aYtThumb').style.display = 'none'; $('#aYtList').style.display = 'none';
  const Y = S.ytdl || {};
  $('#aYtMode').value = Y.mode === 'audio' ? (Y.audioFormat || 'mp3') : 'video';
  $('#aYtB').value = Y.audioBitrate || '320';
  $('#aYtQ').innerHTML = '<option value="best">Meilleure</option>';
  ytModeUi();
  try {
    const r = await call('ytdl:inspect', u, headersFromForm());
    if (ytFor !== u) return;
    ytInfo = r;
    if (r.playlist) {
      $('#aYtTitle').textContent = r.title;
      $('#aYtMeta').textContent = `Playlist · ${r.count} vidéo(s)`;
      $('#aYtList').style.display = '';
      $('#aYtList').innerHTML = `<label class="check" style="margin:2px 4px 6px"><input type="checkbox" id="ytAll" checked> Tout cocher</label>` + r.entries.map((e, i) => `<div class="frow"><input type="checkbox" data-yt="${i}" checked><span class="n" title="${esc(e.url)}">${esc(e.title)}</span><span class="s">${e.duration ? fmtT(e.duration) : ''}</span></div>`).join('');
      $('#ytAll').onchange = ev => $$('#aYtList [data-yt]').forEach(x => (x.checked = ev.target.checked));
      $('#aYtQ').innerHTML = ['best', '2160', '1440', '1080', '720', '480', '360'].map(h => `<option value="${h}">${h === 'best' ? 'Meilleure' : h + 'p'}</option>`).join('');
      $('#aYtQ').value = Y.quality || '1080';
    } else {
      $('#aYtTitle').textContent = r.title;
      $('#aYtMeta').textContent = [r.uploader, r.duration ? fmtT(r.duration) : '', r.extractor].filter(Boolean).join(' · ');
      if (r.thumbnail) { $('#aYtThumb').src = r.thumbnail; $('#aYtThumb').style.display = ''; }
      const hs = r.heights.length ? r.heights : [];
      $('#aYtQ').innerHTML = `<option value="best">Meilleure${hs[0] ? ' (' + hs[0].h + 'p)' : ''}</option>` + hs.map(h => `<option value="${h.h}">${h.h}p${h.fps > 30 ? ' ' + Math.round(h.fps) + ' i/s' : ''}${h.size ? ' · ~' + fmt(h.size) : ''}</option>`).join('');
      const want = Y.quality || '1080';
      if (want !== 'best' && hs.length) { const pick = hs.find(h => h.h <= +want) || hs[hs.length - 1]; $('#aYtQ').value = String(pick.h); }
      if (!r.hasVideo) { $('#aYtMode').value = 'mp3'; ytModeUi(); }
      const est = k => (r.duration ? ' · ~' + fmt(r.duration * k * 125) : '');
      $$('#aYtB option').forEach(o => (o.textContent = `${o.value} kb/s${est(+o.value)}`));
      const om = $('#aYtMode option[value="m4a"]'); if (om) om.textContent = 'Audio M4A (sans réencodage)' + (r.audioSize ? ' · ~' + fmt(r.audioSize) : '');
      const ob = $('#aYtMode option[value="mp3"]'); if (ob) ob.textContent = 'Audio MP3';
      if (!$('#aName').value) $('#aName').placeholder = r.title;
      $('#aInfo').innerHTML = r.audioSize ? `Audio seul : ~${fmt(r.audioSize)}` : '';
    }
  } catch (e) {
    if (ytFor !== u) return;
    $('#aYtTitle').textContent = 'Impossible d\'analyser cette vidéo';
    $('#aYtMeta').textContent = e.message + (isOnline(u) ? '' : ' — le lien sera téléchargé comme un fichier normal.');
    if (!isOnline(u)) { ytReset(); addCtx.kind = undefined; inspectAdd(); }
  }
}
async function inspectAdd() {
  const urls = $('#aUrls').value.split(/\s+/).filter(Boolean);
  $('#aHls').style.display = 'none'; $('#aInfo').textContent = '';
  if (urls.length === 1 && /^https?:\/\//i.test(urls[0]) && !$('#aBatch').checked && (addCtx.kind === 'ytdl' || isOnline(urls[0]))) { if (ytFor !== urls[0]) inspectYt(urls[0]); return; }
  ytReset();
  if (urls.length !== 1 || $('#aBatch').checked) {
    if (urls.length > 1) {
      const list = urls.filter(u => /^https?:\/\//i.test(u)).slice(0, 200);
      $('#aInfo').textContent = `${urls.length} liens · calcul de la taille…`;
      const key = urls.join('\n');
      const res = await call('sizes', list, headersFromForm()).catch(() => []);
      if ($('#aUrls').value.split(/\s+/).filter(Boolean).join('\n') !== key) return;
      const known = res.filter(r => r.size > 0), tot = known.reduce((a, r) => a + r.size, 0);
      $('#aInfo').innerHTML = `${urls.length} liens · <b>${fmt(tot)}</b> au total${known.length < list.length ? ` (${list.length - known.length} de taille inconnue)` : ''}`;
    }
    return;
  }
  const u = urls[0];
  if (/^magnet:/i.test(u)) { $('#aInfo').textContent = 'Lien magnet : il sera ajouté comme torrent.'; return; }
  if (!/^https?:\/\//i.test(u)) return;
  const headers = headersFromForm();
  if (/\.m3u8(\?|$)/i.test(u) || addCtx.kind === 'hls') {
    $('#aInfo').textContent = 'Lecture de la playlist…';
    try {
      const r = await call('hls:inspect', u, headers);
      $('#aInfo').textContent = r.master ? 'Flux vidéo HLS — choisis la qualité :' : `Flux vidéo HLS · ${r.segments} segments · ${fmtT(r.duration)}`;
      if (r.variants.length) {
        $('#aHls').style.display = '';
        $('#aVariants').innerHTML = r.variants.map((v, i) => `<label><input type="radio" name="var" value="${esc(v.url)}" ${i === 0 ? 'checked' : ''}> ${esc(v.label)}</label>`).join('');
      }
    } catch (e) { $('#aInfo').textContent = e.message; }
    return;
  }
  try {
    const r = await call('probe', u, headers);
    if ($('#aUrls').value.trim() !== u) return;
    if (r.status >= 400) { $('#aInfo').textContent = `Le serveur répond ${r.status}`; return; }
    $('#aInfo').innerHTML = `${esc(r.name)} · ${fmt(r.size)} · ${r.resumable ? '<span style="color:var(--ok)">reprise possible</span>' : '<span style="color:var(--warn)">reprise non prise en charge</span>'}${r.type === 'text/html' ? ' · <span style="color:var(--warn)">page web</span>' : ''}`;
    if (!$('#aName').value) $('#aName').placeholder = r.name;
  } catch (e) { $('#aInfo').textContent = e.message; }
}
function headersFromForm() {
  const h = { ...(addCtx.headers || {}) };
  if ($('#aRef').value.trim()) h.Referer = $('#aRef').value.trim(); else delete h.Referer;
  if ($('#aUA').value.trim()) h['User-Agent'] = $('#aUA').value.trim(); else delete h['User-Agent'];
  if ($('#aCookie').value.trim()) h.Cookie = $('#aCookie').value.trim(); else delete h.Cookie;
  return h;
}
$('#aBatch').onchange = inspectAdd;
$('#aPick').onclick = async () => { const p = await call('pickDir'); if (p) $('#aDir').value = p; };
async function submitAdd(startNow) {
  const urls = $('#aUrls').value.split(/\s+/).filter(Boolean);
  if (ytFor && urls.length === 1 && urls[0] === ytFor) {
    const m = $('#aYtMode').value;
    let entries = null;
    if (ytInfo?.playlist) { entries = $$('#aYtList [data-yt]').filter(x => x.checked).map(x => ytInfo.entries[+x.dataset.yt]); if (!entries.length) return toast('Coche au moins une vidéo'); }
    const r = await safe(() => call('add', { kind: 'ytdl', urls, entries, dir: $('#aDir').value.trim(), startNow, schedule: $('#aSchedule').checked,
      name: $('#aName').value.trim() || null, title: $('#aName').value.trim() || (ytInfo && !ytInfo.playlist ? ytInfo.title : null), thumbnail: ytInfo?.thumbnail || '', headers: headersFromForm(), page: $('#aRef').value.trim() || addCtx.page || '', pageTitle: addCtx.pageTitle || '',
      speedLimit: +$('#aSpeed').value || 0, ytdl: { mode: m === 'video' ? 'video' : 'audio', audioFormat: m === 'm4a' ? 'm4a' : 'mp3', audioBitrate: $('#aYtB').value, quality: $('#aYtQ').value || 'best' } }));
    if (!r) return;
    r.forEach(d => items.set(d.id, d)); closeM(); render();
    return toast(r.length > 1 ? `${r.length} vidéos ajoutées` : 'Vidéo ajoutée');
  }
  const v = $('#aVariants input:checked');
  const r = await safe(() => call('add', {
    urls, batch: $('#aBatch').checked, dir: $('#aDir').value.trim(), connections: +$('#aConn').value, startNow, schedule: $('#aSchedule').checked,
    name: $('#aName').value.trim() || addCtx.name || null, headers: headersFromForm(), page: $('#aRef').value.trim() || addCtx.page || '',
    speedLimit: +$('#aSpeed').value || 0, kind: addCtx.kind === 'ytdl' ? undefined : addCtx.kind, quality: v ? v.value : null, allowPage: !!addCtx.allowPage,
  }));
  if (!r) return;
  if (!r.length && !urls.some(u => /^magnet:/i.test(u))) return toast('Aucun lien valide (http://, https:// ou magnet:)');
  r.forEach(d => items.set(d.id, d));
  closeM(); render();
  if (r.length) toast(r.length > 1 ? `${r.length} téléchargements ajoutés` : 'Téléchargement ajouté');
}
$('#aOk').onclick = () => submitAdd(true);
$('#aLater').onclick = () => submitAdd(false);

// ---------------- torrents ----------------
let tInfo = null;
function showTorrent(pre = {}) {
  tInfo = null;
  $('#tSrc').value = pre.src || '';
  $('#tSrcBox').style.display = ''; $('#tInfoBox').style.display = 'none'; $('#tStatus').textContent = '';
  $('#tSeq').checked = !!S.torrent?.sequential; $('#tSeed').checked = !!S.torrent?.seed; $('#tDir').value = ''; $('#tSchedule').checked = false;
  showTorrent.ctx = pre;
  openM('#tModal');
  if (pre.src && (S.torrent?.fetchMetadata !== false || !/^magnet:/i.test(pre.src))) fetchTorrent();
}
$('#tPick').onclick = async () => { const p = await call('pickFile', [{ name: 'Torrent', extensions: ['torrent'] }]); if (p) { $('#tSrc').value = p; fetchTorrent(); } };
$('#tFetch').onclick = fetchTorrent;
$('#tQuick').onclick = async () => {
  const src = $('#tSrc').value.trim(); if (!src) return;
  if (!/^magnet:/i.test(src)) return fetchTorrent();
  const d = await safe(() => call('torrent:addQuick', src));
  if (d) { items.set(d.id, d); closeM(); render(); toast('Torrent ajouté'); }
};
async function fetchTorrent() {
  const src = $('#tSrc').value.trim();
  if (!src) return;
  $('#tStatus').textContent = /^magnet:/i.test(src) ? 'Recherche des pairs et lecture des informations… (jusqu\'à 90 s)' : 'Lecture du fichier…';
  $('#tFetch').disabled = true;
  try {
    tInfo = await call('torrent:inspect', src, showTorrent.ctx || {});
    $('#tSrcBox').style.display = 'none'; $('#tInfoBox').style.display = '';
    $('#tKv').innerHTML = `<dt>Nom</dt><dd>${esc(tInfo.name)}</dd><dt>Taille</dt><dd>${fmt(tInfo.size)}</dd><dt>Fichiers</dt><dd>${tInfo.files.length}</dd><dt>Hash</dt><dd class="mono">${tInfo.infoHash}</dd>`;
    $('#tFiles').innerHTML = tInfo.files.map(f => `<div class="frow"><input type="checkbox" data-ti="${f.i}" checked><span class="n" title="${esc(f.path)}">${esc(f.path)}</span><span class="s">${fmt(f.length)}</span></div>`).join('');
    updTSel();
  } catch (e) { $('#tStatus').textContent = e.message; }
  $('#tFetch').disabled = false;
}
function updTSel() {
  const sel = $$('#tFiles [data-ti]').filter(x => x.checked).map(x => +x.dataset.ti);
  const sz = sel.reduce((a, i) => a + tInfo.files[i].length, 0);
  $('#tSel').textContent = `${sel.length}/${tInfo.files.length} fichier(s) · ${fmt(sz)}`;
  return sel;
}
$('#tFiles').onchange = updTSel;
$('#tAll').onclick = () => { $$('#tFiles [data-ti]').forEach(x => (x.checked = true)); updTSel(); };
$('#tNone').onclick = () => { $$('#tFiles [data-ti]').forEach(x => (x.checked = false)); updTSel(); };
$('#tVideos').onclick = () => { $$('#tFiles [data-ti]').forEach(x => (x.checked = /\.(mp4|mkv|avi|mov|webm|m4v|wmv|flv|ts)$/i.test(tInfo.files[+x.dataset.ti].path))); updTSel(); };
$('#tBack').onclick = () => { $('#tSrcBox').style.display = ''; $('#tInfoBox').style.display = 'none'; };
$('#tDirPick').onclick = async () => { const p = await call('pickDir'); if (p) $('#tDir').value = p; };
$('#tOk').onclick = async () => {
  const sel = updTSel();
  if (!sel.length) return toast('Sélectionne au moins un fichier');
  const d = await safe(() => call('torrent:add', { ...tInfo, selected: sel.length === tInfo.files.length ? null : sel, dir: $('#tDir').value.trim(), sequential: $('#tSeq').checked, seedAfter: $('#tSeed').checked, schedule: $('#tSchedule').checked }));
  if (d) { items.set(d.id, d); closeM(); render(); toast('Torrent ajouté'); }
};

// ---------------- menus du haut ----------------
$('#addBtn').onclick = () => showAdd();
$('#addMenuBtn').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  showMenu(r.left - 100, r.bottom + 4, [
    { label: 'Lien(s) de téléchargement', icon: 'link', fn: () => showAdd() },
    { label: 'Torrent / lien magnet', icon: 'magnet', fn: () => showTorrent() },
    { label: 'Lot de liens (motif [1-100])', icon: 'list', fn: () => { showAdd(); setTimeout(() => ($('#aBatch').checked = true), 50); } },
    { label: 'Vidéo d\'un site (YouTube, Vimeo, TikTok…)', icon: 'yt', fn: () => showAdd({ kind: 'ytdl' }) },
    { label: 'Flux vidéo (.m3u8)', icon: 'stream', fn: () => showAdd({ kind: 'hls' }) },
    '-',
    { label: 'Importer une liste de liens…', icon: 'doc', fn: async () => { const l = await safe(() => call('importList')); if (l?.length) showAdd({ urls: l.filter(x => !x.startsWith('magnet:')) }); } },
    { label: 'Exporter les liens non terminés…', icon: 'share', fn: async () => { const p = await safe(() => call('exportList')); if (p) toast('Liste exportée'); } },
  ]);
};
$('#toolsBtn').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  showMenu(r.left - 200, r.bottom + 4, [
    { label: 'Planificateur…', icon: 'clock', fn: () => showSettings('sch') },
    { label: 'Fusionner une vidéo et un audio…', icon: 'video', fn: mergeTool },
    { label: 'Convertir (TS → MP4, vidéo → MP3)…', icon: 'redo', fn: convertTool },
    { label: "Vérifier la somme d'un fichier…", icon: 'ok', fn: hashTool },
    { label: 'Extraire une archive…', icon: 'arc', fn: extractTool },
    { label: 'Créer un fichier .torrent…', icon: 'magnet', fn: async () => { const p = await safe(() => call('torrent:create')); if (p) toast('Torrent créé : ' + p); } },
    '-',
    { label: 'Navigateur privé', icon: 'globe', fn: () => call('openBrowser', '', true) },
  ]);
};
async function mergeTool() {
  const v = await call('pickFile', [{ name: 'Vidéo', extensions: ['mp4', 'webm', 'mkv', 'mov', 'm4v', 'ts'] }]); if (!v) return;
  const a = await call('pickFile', [{ name: 'Audio', extensions: ['m4a', 'mp3', 'aac', 'webm', 'ogg', 'opus', 'mp4'] }]); if (!a) return;
  const o = await call('saveFile', v.replace(/(\.\w+)$/, ' (fusion).mp4'), [{ name: 'MP4', extensions: ['mp4'] }, { name: 'MKV', extensions: ['mkv'] }]); if (!o) return;
  toast('Fusion en cours…');
  if (await safe(() => call('merge', v, a, o))) toast('Fichier fusionné');
}
async function convertTool() {
  const i = await call('pickFile'); if (!i) return;
  const o = await call('saveFile', i.replace(/(\.\w+)$/, '.mp4'), [{ name: 'MP4', extensions: ['mp4'] }, { name: 'MP3', extensions: ['mp3'] }, { name: 'M4A/AAC', extensions: ['m4a'] }, { name: 'MKV', extensions: ['mkv'] }]); if (!o) return;
  toast('Conversion en cours…');
  if (await safe(() => call('convert', i, o))) toast('Conversion terminée');
}
async function hashTool() {
  const f = await call('pickFile'); if (!f) return;
  const r = await prompt2('Somme de contrôle', [{ html: `<p class="mono">${esc(f)}</p><label>Algorithme</label><select id="pAlgo"><option value="md5">MD5</option><option value="sha1">SHA-1</option><option value="sha256">SHA-256</option><option value="sha512">SHA-512</option></select>` }, { id: 'cmp', label: 'Somme attendue (facultatif)' }], 'Calculer');
  if (!r) return;
  const algo = $('#pAlgo')?.value || 'md5';
  toast('Calcul en cours…');
  const h = await safe(() => call('checksum', f, algo)); if (!h) return;
  const cmp = r.cmp?.trim().toLowerCase();
  const res = await prompt2(algo.toUpperCase(), [{ html: `<p class="mono">${h}</p>${cmp ? (cmp === h ? '<p style="color:var(--ok)">✔ Identique</p>' : '<p style="color:var(--err)">✘ Différente</p>') : ''}` }], 'Copier');
  if (res) call('copy', h);
}
async function extractTool() {
  const f = await call('pickFile', [{ name: 'Archives', extensions: ['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso'] }]); if (!f) return;
  toast('Extraction…');
  try { await call('extract', f); toast('Archive extraite'); }
  catch (e) { if (/mot de passe/i.test(e.message)) { const r = await prompt2('Archive protégée', [{ id: 'p', label: 'Mot de passe', type: 'password' }]); if (r?.p) safe(() => call('extract', f, r.p)); } else toast(e.message); }
}

$('#resumeAll').onclick = () => call('resumeAll');
$('#pauseAll').onclick = () => call('pauseAll');
$('#clearDone').onclick = () => call('clearFinished');
$('#openDir').onclick = () => call('openDir');
$('#openBrowser').onclick = () => call('openBrowser');
$('#limitChip').onclick = async () => {
  if (!S.speedLimit) return showSettings('net');
  S = await call('setSettings', { speedLimitOn: !S.speedLimitOn }); updLimit();
};
function updLimit() { $('#limitChip').classList.toggle('on', !!(S.speedLimitOn && S.speedLimit)); $('#limitTxt').textContent = S.speedLimitOn && S.speedLimit ? `${S.speedLimit >= 1024 ? (S.speedLimit / 1024).toFixed(1) + ' Mo/s' : S.speedLimit + ' Ko/s'}` : 'MAX'; }

$('#bulk').addEventListener('click', async e => {
  const b = e.target.closest('[data-bulk]'); if (!b) return;
  const ids = [...selected];
  switch (b.dataset.bulk) {
    case 'resume': ids.forEach(id => call('resume', id)); break;
    case 'pause': ids.forEach(id => call('pause', id)); break;
    case 'schedule': call('setScheduled', ids, true); break;
    case 'copy': call('copy', ids.map(id => items.get(id).url).join('\n')); toast('Liens copiés'); break;
    case 'remove': removeItems(ids); break;
    case 'none': selected.clear(); selMode = false; $('#selBtn').classList.remove('on'); render(); break;
  }
});

$('#nav').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  $$('#nav [data-f]').forEach(x => x.classList.toggle('on', x === b));
  filter = b.dataset.f; render();
});
$('#q').addEventListener('input', render);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeM(); $('#menu').classList.remove('on'); }
  if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); showAdd(); }
  if (e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); showTorrent(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); call('openBrowser'); }
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#q').focus(); }
  if (e.ctrlKey && e.key.toLowerCase() === 'a' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); selected = new Set(sorted().filter(match).map(d => d.id)); render(); }
  if (e.key === 'Delete' && selected.size && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !$('.overlay.on')) removeItems([...selected]);
});

// glisser-déposer : liens, .torrent, listes
const drop = $('#drop');
let dragN = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); dragN++; drop.classList.add('on'); });
document.addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; drop.classList.remove('on'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault(); dragN = 0; drop.classList.remove('on');
  const files = [...e.dataTransfer.files];
  const tor = files.find(f => /\.torrent$/i.test(f.name));
  if (tor) return showTorrent({ src: D.pathFor(tor) });
  const txt = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (txt) { const l = txt.split(/\s+/).filter(x => /^(https?:\/\/|magnet:)/i.test(x)); if (l.length === 1 && l[0].startsWith('magnet:')) return showTorrent({ src: l[0] }); if (l.length) return showAdd({ urls: l }); }
});

// presse-papiers
$('#clipAdd').onclick = () => { $('#clip').classList.remove('on'); clipUrl.startsWith('magnet:') ? showTorrent({ src: clipUrl }) : showAdd({ url: clipUrl }); };
$('#clipX').onclick = () => { dismissed.add(clipUrl); $('#clip').classList.remove('on'); };
D.on('clip', t => { if (dismissed.has(t) || [...items.values()].some(d => d.url === t)) return; clipUrl = t; $('#clipUrl').textContent = t; $('#clip').classList.add('on'); });

// arrêt programmé
let shutT = null;
D.on('shutdown-countdown', s => {
  $('#shutBanner').classList.add('on');
  clearInterval(shutT);
  shutT = setInterval(() => { $('#shutTxt').textContent = `Arrêt de l'ordinateur dans ${s--} s (tous les téléchargements sont terminés)`; if (s < 0) clearInterval(shutT); }, 1000);
});
$('#shutCancel').onclick = () => { call('cancelShutdown'); clearInterval(shutT); $('#shutBanner').classList.remove('on'); toast('Arrêt annulé'); };

// son de fin
D.on('sound', () => {
  if (!S.sound) return;
  try { const c = new AudioContext(); [660, 880].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, c.currentTime + i * 0.15); g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + i * 0.15 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.15 + 0.25); o.connect(g).connect(c.destination); o.start(c.currentTime + i * 0.15); o.stop(c.currentTime + i * 0.15 + 0.3); }); } catch {}
});

// ---------------- paramètres ----------------
const ACCENTS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899'];
const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
let sTmp = {};
function setSec(s) { $$('#sNav button').forEach(b => b.classList.toggle('on', b.dataset.s === s)); $$('.settings section').forEach(x => x.classList.toggle('on', x.dataset.s === s)); }
$('#sNav').onclick = e => { const b = e.target.closest('[data-s]'); if (b) setSec(b.dataset.s); };
async function showSettings(sec = 'gen') {
  S = await call('getSettings');
  sTmp = JSON.parse(JSON.stringify(S));
  const v = (id, x) => ($(id).value = x ?? ''), c = (id, x) => ($(id).checked = !!x);
  v('#sDir', S.dir); c('#sCat', S.categorize); c('#sClip', S.clipboard); c('#sNotify', S.notify); c('#sSound', S.sound); c('#sTray', S.tray); c('#sBoot', S.startWithWindows); c('#sBootMin', S.startMinimized); c('#sShut', S.shutdownWhenDone); c('#sWeb', S.autoOpenWebpage);
  v('#sConn', S.connections); bindRange('#sConn', '#sConnV'); v('#sPar', S.parallel); bindRange('#sPar', '#sParV'); v('#sRetry', S.maxRetries); v('#sDup', S.duplicate); v('#sHlsC', S.hls.connections); v('#sHlsQ', S.hls.quality); c('#sHlsConv', S.hls.convert); v('#sPerSite', S.perSite); c('#sRestore', S.restoreSession);
  const Y = S.ytdl || {}; v('#sYtMode', Y.mode === 'audio' ? (Y.audioFormat || 'mp3') : 'video'); v('#sYtQ', Y.quality || '1080'); v('#sYtB', Y.audioBitrate || '320');
  call('ytdl:version').then(x => ($('#sYtVer').textContent = 'Version de yt-dlp : ' + x)).catch(() => {});
  call('extInfo').then(x => ($('#eInfo').textContent = x.port ? `DrYAE écoute l'extension sur le port ${x.port}. Identifiant de l'extension : ${x.id}` : 'Le service de l\'extension n\'a pas pu démarrer.')).catch(() => {});
  c('#sLimOn', S.speedLimitOn); v('#sLim', S.speedLimit); c('#sDataOn', S.dataLimit.enabled); v('#sDataMb', S.dataLimit.mb); c('#sProxyOn', S.proxy.enabled); v('#sProxy', S.proxy.url); v('#sUA', S.userAgent);
  const st = await call('stats'); v('#sDataUsed', fmt(st.dataToday));
  const T = S.torrent;
  c('#tEn', T.enabled); c('#tMeta', T.fetchMetadata); c('#tSeqD', T.sequential); c('#tSeedD', T.seed); v('#tRatio', T.ratio); v('#tUp', T.uploadLimit); v('#tDown', T.downloadLimit); v('#tConns', T.maxConns); v('#tPort', T.port); c('#tDht', T.dht); c('#tLsd', T.lsd); c('#tDefTr', T.useDefaultTrackers); v('#tTrackers', T.trackers); v('#tTrUrl', T.trackersUrl);
  const B = S.browser;
  v('#wSearch', B.search); v('#wUA', B.ua); c('#wAd', B.adblock); c('#wPop', B.blockPopups); c('#wSub', B.captureSubtitles); c('#wCookies', B.cookies); c('#wClear', B.clearOnExit); v('#wExtra', B.sniffExtra); v('#wDoh', B.doh);
  v('#wLists', B.filterLists.join('\n')); v('#wHosts', B.hostsSources.join('\n')); v('#wCustom', B.customFilters);
  const C = S.scheduler;
  c('#cOn', C.enabled); v('#cStart', C.start); v('#cStop', C.stop); c('#cAdd', C.addNew); c('#cShut', C.shutdown);
  $('#cDays').innerHTML = DAYS.map((d, i) => `<label><input type="checkbox" data-day="${i}" ${C.days.includes(i) ? 'checked' : ''}>${d}</label>`).join('');
  v('#lMode', S.theme.mode); $('#lColor').value = S.theme.accent;
  $('#lSw').innerHTML = ACCENTS.map(a => `<button data-acc="${a}" style="background:${a}" class="${a === S.theme.accent ? 'on' : ''}"></button>`).join('');
  $('#abVer').textContent = await call('version');
  const langs = await call('languages');
  $('#sLang').innerHTML = langs.map(l => `<option value="${l.code}" ${l.code === S.lang ? 'selected' : ''}>${l.name}</option>`).join('');
  drawUpd(await call('upd:info'));
  $('#abStats').innerHTML = `<dt>Éléments</dt><dd>${st.total}</dd><dt>Terminés</dt><dd>${st.done}</dd><dt>Volume terminé</dt><dd>${fmt(st.bytes)}</dd><dt>ffmpeg</dt><dd>${(await call('hasFfmpeg')) ? 'intégré ✔' : 'absent'}</dd>`;
  $('#sMagnetSt').textContent = (await call('isMagnetDefault')) ? 'DrYAE ouvre déjà les liens magnet ✔' : '';
  drawLists();
  setSec(sec);
  openM('#sModal');
}
function drawLists() {
  $('#sSiteList').innerHTML = sTmp.siteLimits.map((s, i) => `<div><span>${esc(s.host)} — ${s.max} simultané(s)</span><button class="icon-btn" data-rmsite="${i}">${ic('x')}</button></div>`).join('');
  $('#wWhite').innerHTML = sTmp.browser.whitelist.map((h, i) => `<div><span>${esc(h)}</span><button class="icon-btn" data-rmwhite="${i}">${ic('x')}</button></div>`).join('') || '<p class="hint">Aucun site. Ajoute-en depuis le navigateur (bouclier).</p>';
  $('#pwList').innerHTML = S.passwords.map(p => `<div><span>${esc(p.host)} — ${esc(p.user)}</span><button class="icon-btn" data-rmpw="${esc(p.host)}">${ic('x')}</button></div>`).join('') || '<p class="hint">Aucun mot de passe enregistré.</p>';
}
$('#sModal').addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.rmsite) { sTmp.siteLimits.splice(+t.dataset.rmsite, 1); drawLists(); }
  if (t.dataset.rmwhite) { sTmp.browser.whitelist.splice(+t.dataset.rmwhite, 1); drawLists(); }
  if (t.dataset.rmpw) { await call('passwords:remove', t.dataset.rmpw); S = await call('getSettings'); drawLists(); }
  if (t.dataset.acc) { $('#lColor').value = t.dataset.acc; $$('#lSw button').forEach(b => b.classList.toggle('on', b === t)); }
});
$('#sSiteAdd').onclick = () => { const h = $('#sSiteHost').value.trim().replace(/^https?:\/\//, '').split('/')[0]; const m = +$('#sSiteMax').value; if (h && m > 0) { sTmp.siteLimits.push({ host: h, max: m }); $('#sSiteHost').value = $('#sSiteMax').value = ''; drawLists(); } };
$('#pwAdd').onclick = async () => { const h = $('#pwHost').value.trim().replace(/^https?:\/\//, '').split('/')[0]; if (!h || !$('#pwUser').value) return; await call('passwords:add', h, $('#pwUser').value, $('#pwPass').value); $('#pwHost').value = $('#pwUser').value = $('#pwPass').value = ''; S = await call('getSettings'); drawLists(); toast('Mot de passe enregistré'); };
$('#sYtUpd').onclick = async () => { $('#sYtVer').textContent = 'Mise à jour en cours…'; try { const r = await call('ytdl:update'); $('#sYtVer').textContent = r + ' — version : ' + (await call('ytdl:version')); } catch (e) { $('#sYtVer').textContent = 'Échec : ' + e.message; } };
$('#eFolder').onclick = () => call('openExtFolder');
$('#eChrome').onclick = async () => { await call('copy', 'chrome://extensions'); toast('Adresse copiée : colle-la dans la barre d\'adresse de Chrome'); };
$('#sDirPick').onclick = async () => { const p = await call('pickDir', $('#sDir').value); if (p) $('#sDir').value = p; };
$('#sMagnet').onclick = async () => { const ok = await call('registerMagnet'); $('#sMagnetSt').textContent = ok ? 'DrYAE ouvre maintenant les liens magnet ✔' : 'Windows a refusé — choisis DrYAE dans Paramètres > Applications par défaut'; };
$('#wUpdate').onclick = async () => { $('#wUpdSt').textContent = 'Mise à jour…'; const ok = await call('br:updateAdblockProxy').catch(() => null); $('#wUpdSt').textContent = ok ? 'Filtres à jour ✔' : 'Impossible de mettre à jour (connexion ?)'; };
$('#abReset').onclick = async () => { if (!confirmAsk('Réinitialiser tous les paramètres ?')) return; await call('resetSettings'); closeM(); S = await call('getSettings'); applyTheme(); updLimit(); toast('Paramètres réinitialisés'); };
// ---- mises à jour, avis, langue ----
function updText(u) {
  if (!u.configured) return '';
  switch (u.status) {
    case 'checking': return T('Recherche en cours…');
    case 'latest': return T('DrYAE est à jour');
    case 'available': return T('Nouvelle version disponible : {0}').replace('{0}', u.version || '');
    case 'downloading': return T('Téléchargement de la mise à jour : {0} %').replace('{0}', Math.round(u.progress || 0));
    case 'ready': return T('Mise à jour prête : redémarrer pour l\'installer');
    case 'error': return T('Impossible de vérifier les mises à jour') + (u.error ? ' (' + u.error + ')' : '');
    default: return '';
  }
}
function drawUpd(u) {
  if (!u) return;
  $('#abNoRepo').style.display = u.configured ? 'none' : '';
  $('#abCheck').disabled = !u.configured; $('#abFeedback').disabled = !u.configured; $('#abRepo').disabled = !u.configured; $('#feedbackBtn').style.display = u.configured ? '' : 'none';
  $('#abDonate').style.display = u.donateUrl ? '' : 'none';
  $('#abUpd').textContent = updText(u);
  const can = ['available', 'ready'].includes(u.status);
  $('#abInstall').style.display = can ? '' : 'none';
  $('#abInstall').textContent = u.status === 'ready' ? T('Redémarrer et installer') : T('Mettre à jour maintenant');
  if (can && !updDismissed) { $('#updTxt').textContent = u.status === 'ready' ? T('La mise à jour {0} est prête.').replace('{0}', u.version || '') : T('DrYAE {0} est disponible.').replace('{0}', u.version || ''); $('#updGo').textContent = u.status === 'ready' ? T('Redémarrer et installer') : T('Mettre à jour'); $('#updBanner').classList.add('on'); }
  else if (!can) $('#updBanner').classList.remove('on');
}
let updDismissed = false;
D.on('update-state', drawUpd);
$('#abCheck').onclick = async () => drawUpd(await call('upd:check'));
$('#abInstall').onclick = () => call('upd:install');
$('#updGo').onclick = () => call('upd:install');
$('#updX').onclick = () => { updDismissed = true; $('#updBanner').classList.remove('on'); };
$('#abFeedback').onclick = () => call('openFeedback');
$('#feedbackBtn').onclick = () => call('openFeedback');
$('#abRepo').onclick = () => call('openRepo');
$('#abDonate').onclick = () => call('openDonate');
$('#abNotices').onclick = () => call('openNotices');
$('#sOk').onclick = async () => {
  const newLang = $('#sLang').value;
  if (newLang && newLang !== S.lang) { await call('setLang', newLang); return; }
  const v = id => $(id).value, c = id => $(id).checked, n = id => +$(id).value || 0;
  const lines = id => v(id).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const patch = {
    dir: v('#sDir').trim() || S.dir, categorize: c('#sCat'), clipboard: c('#sClip'), notify: c('#sNotify'), sound: c('#sSound'), tray: c('#sTray'), startWithWindows: c('#sBoot'), startMinimized: c('#sBootMin'), shutdownWhenDone: c('#sShut'), autoOpenWebpage: c('#sWeb'),
    connections: n('#sConn'), parallel: n('#sPar'), maxRetries: n('#sRetry'), duplicate: v('#sDup'), perSite: n('#sPerSite'), siteLimits: sTmp.siteLimits,
    hls: { connections: Math.max(1, n('#sHlsC')), quality: v('#sHlsQ'), convert: c('#sHlsConv') },
    ytdl: { mode: v('#sYtMode') === 'video' ? 'video' : 'audio', audioFormat: v('#sYtMode') === 'm4a' ? 'm4a' : 'mp3', quality: v('#sYtQ'), audioBitrate: v('#sYtB') },
    restoreSession: c('#sRestore'),
    speedLimitOn: c('#sLimOn'), speedLimit: n('#sLim'), dataLimit: { enabled: c('#sDataOn'), mb: n('#sDataMb') }, proxy: { enabled: c('#sProxyOn'), url: v('#sProxy').trim() }, userAgent: v('#sUA').trim(),
    torrent: { enabled: c('#tEn'), fetchMetadata: c('#tMeta'), sequential: c('#tSeqD'), seed: c('#tSeedD'), ratio: +v('#tRatio') || 0, uploadLimit: n('#tUp'), downloadLimit: n('#tDown'), maxConns: n('#tConns') || 55, port: n('#tPort'), dht: c('#tDht'), lsd: c('#tLsd'), useDefaultTrackers: c('#tDefTr'), trackers: v('#tTrackers'), trackersUrl: v('#tTrUrl').trim() },
    browser: { search: v('#wSearch'), ua: v('#wUA'), adblock: c('#wAd'), blockPopups: c('#wPop'), captureSubtitles: c('#wSub'), cookies: c('#wCookies'), clearOnExit: c('#wClear'), sniffExtra: v('#wExtra'), doh: v('#wDoh'),
      filterLists: lines('#wLists'), hostsSources: lines('#wHosts'), customFilters: v('#wCustom'), whitelist: sTmp.browser.whitelist },
    scheduler: { enabled: c('#cOn'), start: v('#cStart') || '02:00', stop: v('#cStop'), days: $$('#cDays [data-day]').filter(x => x.checked).map(x => +x.dataset.day), addNew: c('#cAdd'), shutdown: c('#cShut') },
    theme: { mode: v('#lMode'), accent: $('#lColor').value },
  };
  S = await safe(() => call('setSettings', patch)) || S;
  applyTheme(); updLimit(); closeM(); toast('Paramètres enregistrés');
};
$('#setBtn').onclick = () => showSettings();

// ---------------- événements du moteur ----------------
D.on('changed', d => { items.set(d.id, { ...items.get(d.id), ...d }); render(); });
D.on('progress', arr => { arr.forEach(d => items.set(d.id, { ...items.get(d.id), ...d })); render(); });
D.on('reload', arr => { items = new Map(arr.map(d => [d.id, d])); render(); });
D.on('toast', t => toast(t));
D.on('prompt-add', o => { closeM(); showAdd(o || {}); });
D.on('prompt-torrent', o => { closeM(); showTorrent(o || {}); });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

(async () => {
  S = await call('getSettings');
  applyTheme(); updLimit();
  (await call('list')).forEach(d => items.set(d.id, d));
  $('#ver').textContent = 'DrYAE ' + (await call('version'));
  call('upd:info').then(drawUpd).catch(() => {});
  render();
})();
