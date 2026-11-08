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

function toast(t, act) {
  const el = $('#toast'); el.textContent = T(t);
  if (act) { const b = document.createElement('button'); b.className = 'tact'; b.textContent = T(act.label); b.onclick = () => { el.classList.remove('on'); act.fn(); }; el.appendChild(b); }
  el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), act ? 6000 : 2600);
}
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
  const a = t.accent === 'system' ? (window.SYS_ACCENT || '#8b5cf6') : (t.accent || '#8b5cf6');
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

// ---------------- affichages façon dossier Windows ----------------
const LS = { get: (k, d) => { try { const v = localStorage.getItem('dryae.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('dryae.' + k, JSON.stringify(v)); } catch {} } };
let VIEW = LS.get('view', 'content');          // details | list | content | icons-s | icons-m | icons-l
let SORT = LS.get('sort', { k: 'date', dir: -1 });
let PANE = LS.get('pane', false);              // volet des détails (à droite)
let COLS = LS.get('cols', [320, 150, 120, 100, 170]);
const VIEWS = [['icons-l', 'Grandes icônes', 'Ctrl+Maj+2'], ['icons-m', 'Icônes moyennes', 'Ctrl+Maj+3'], ['icons-s', 'Petites icônes', 'Ctrl+Maj+4'], ['list', 'Liste', 'Ctrl+Maj+5'], ['details', 'Détails', 'Ctrl+Maj+6'], ['content', 'Contenu', 'Ctrl+Maj+8']];
const SORTS = [['name', 'Nom'], ['date', 'Date'], ['type', 'Type'], ['size', 'Taille'], ['status', 'État']];
const typeLabel = d => d.type === 'torrent' ? 'Torrent' : d.type === 'hls' ? T('Flux vidéo') : d.type === 'ytdl' ? (d.mode === 'audio' ? 'Audio ' + (d.audioFormat || 'mp3').toUpperCase() : T('Vidéo') + ' MP4') : ((extOf(d.name) || '').toUpperCase() ? T('Fichier') + ' ' + extOf(d.name).toUpperCase() : T('Fichier'));
const nameOf = d => d.name || d.displayName || d.title || prettyUrl(d.url);
const extLabel = d => d.type === 'torrent' ? 'BT' : d.type === 'hls' ? 'HLS' : d.type === 'ytdl' ? (d.mode === 'audio' ? (d.audioFormat || 'mp3').toUpperCase() : 'MP4') : (extOf(d.name) || '?').slice(0, 4).toUpperCase();
const dateOf = d => new Date(d.finished || d.added).toLocaleString((window.I18N && I18N.locale) || 'fr-FR', { dateStyle: 'short', timeStyle: 'short' });
function setView(v) { if (!VIEWS.some(x => x[0] === v)) return; VIEW = v; LS.set('view', v); $('#list').querySelectorAll('.item').forEach(el => (el._h = '')); render(); }
function setSort(k) { SORT = SORT.k === k ? { k, dir: -SORT.dir } : { k, dir: k === 'date' || k === 'size' ? -1 : 1 }; LS.set('sort', SORT); render(); }
function togglePane(on = !PANE) { PANE = on; LS.set('pane', on); if (on) { const id = kCursor || [...selected][0]; if (id) openDrawer(id); } else closeDrawer(); $('#cbPane')?.classList.toggle('on', on); }
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('th')) { const f = document.createElement('div'); f.className = 'ftype c-img'; f.textContent = t.dataset.ext || ''; t.replaceWith(f); } }, true);
function thumb(d, big) {
  const cat = catOf(d);
  if (big && d.status === 'done' && cat === 'img' && d.file) return `<img class="th" loading="lazy" src="${esc(encodeURI('file:///' + d.file.replace(/\\/g, '/').replace(/^\/+/, '')))}" alt="" data-ext="${esc(extLabel(d))}">`;
  return `<div class="ftype c-${cat}">${esc(extLabel(d))}</div>`;
}
function stateText(d) {
  const p = progressOf(d);
  if (d.status === 'running') return `${(p * 100).toFixed(0)} % · ${fmt(d.speed)}/s`;
  return ST[d.status] || d.status;
}
function rowHtmlView(d) {
  if (VIEW === 'content') return rowHtml(d);
  const p = progressOf(d), run = d.status !== 'done';
  const bar = run ? `<div class="bar ${d.status}"><i style="width:${p * 100}%"></i></div>` : '';
  const ck = `<input type="checkbox" class="rowchk" data-chk ${selected.has(d.id) ? 'checked' : ''}>`;
  if (VIEW === 'details') return `${ck}<div class="c nm">${thumb(d)}<span class="name" title="${esc(d.file || d.url)}">${esc(nameOf(d))}</span></div><div class="c">${dateOf(d)}</div><div class="c">${esc(typeLabel(d))}</div><div class="c r">${d.size > 0 ? fmt(d.size) : ''}</div><div class="c st ${d.status}">${esc(stateText(d))}${bar}</div>`;
  if (VIEW === 'list') return `${ck}${thumb(d)}<span class="name" title="${esc(d.file || d.url)}">${esc(nameOf(d))}</span>${run ? `<span class="st ${d.status}">${esc(stateText(d))}</span>` : ''}`;
  return `${ck}<div class="tic">${thumb(d, true)}</div><span class="name" title="${esc(d.file || d.url)}">${esc(nameOf(d))}</span>${bar}`;
}
function detailsHead() {
  const arrow = k => (SORT.k === k ? (SORT.dir > 0 ? ' ▲' : ' ▼') : '');
  return `<span></span>${[['name', 'Nom'], ['date', 'Date'], ['type', 'Type'], ['size', 'Taille'], ['status', 'État']].map(([k, l], i) => `<button class="hc ${k === 'size' ? 'r' : ''}" data-sort="${k}">${esc(T(l))}${arrow(k)}<i class="rz" data-rz="${i}"></i></button>`).join('')}`;
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

function sorted() {
  const k = SORT.k, s = SORT.dir;
  const STO = { running: 0, merging: 1, queued: 2, seeding: 3, scheduled: 4, paused: 5, error: 6, done: 7 };
  const val = d => k === 'name' ? nameOf(d).toLowerCase() : k === 'type' ? typeLabel(d) : k === 'size' ? (d.size || 0) : k === 'status' ? (STO[d.status] ?? 9) : (d.finished || d.added);
  return [...items.values()].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : b.added - a.added) * (x === y ? 1 : s); });
}

function render() {
  const list = $('#list');
  const arr = sorted().filter(match);
  list.className = 'list v-' + VIEW;
  list.style.setProperty('--cols', COLS.map((w, i) => (i === 0 ? `minmax(${w}px,1fr)` : w + 'px')).join(' '));
  let head = list.querySelector('.dhead');
  if (VIEW === 'details' && arr.length) { if (!head) { head = document.createElement('div'); head.className = 'dhead'; list.prepend(head); } const h = detailsHead(); if (head._h !== h) { head.innerHTML = h; head._h = h; } }
  else if (head) { head.remove(); head = null; }
  status();
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
      const html = rowHtmlView(d);
      el.draggable = d.status === 'done';
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.classList.toggle('sel', selected.has(d.id));
      const ck = el.querySelector('[data-chk]'); if (ck) ck.checked = selected.has(d.id);
      el.classList.toggle('cur', current === d.id);
      el.classList.toggle('kfocus', kCursor === d.id);
      const want = prev ? prev.nextSibling : (head ? head.nextSibling : list.firstChild);
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
  } else { selected = new Set([id]); if (PANE) openDrawer(id); }
  lastClickId = id; kCursor = id;
  render();
});
$('#list').addEventListener('dblclick', e => {
  const row = e.target.closest('.item'); if (!row || e.target.closest('[data-act]')) return;
  const d = items.get(row.dataset.id);
  if (d.status === 'done') safe(() => call('open', d.id)); else openDrawer(d.id);
});
$('#list').addEventListener('contextmenu', e => {
  const row = e.target.closest('.item');
  if (!row) { e.preventDefault(); return showMenu(e.clientX, e.clientY, bgMenu()); }
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
    case 'remove': return removeItems(selected.has(d.id) && selected.size > 1 ? [...selected] : [d.id]);
    case 'removeDel': return removeItems(selected.has(d.id) && selected.size > 1 ? [...selected] : [d.id], true);
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
  M.push('-', ['restart', 'redo', 'Recommencer'], ['remove', 'x', 'Retirer de la liste   Suppr'], ['removeDel', 'trash', 'Supprimer définitivement   Maj+Suppr']);
  return M.map(m => (m === '-' ? m : { label: m[2], icon: m[1], fn: () => itemAction(m[0], d) }));
}

function showMenu(x, y, entries) {
  const m = $('#menu');
  m.innerHTML = entries.map((e, i) => (e === '-' ? '<hr>' : `<button data-i="${i}">${ic(e.icon || 'list')}${((m) => m ? esc(m[1]) + `<span class="mk">${esc(m[2])}</span>` : esc(e.label))(String(e.label).match(/^([\s\S]*?\S)\s{3,}(\S[\s\S]*)$/))}</button>`)).join('');
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

// Suppr : retire de la liste sans question (comme la Corbeille de Windows), annulable avec Ctrl+Z.
// Maj+Suppr : supprime aussi les fichiers du disque, après confirmation.
async function removeItems(ids, withFiles) {
  let del = false;
  if (withFiles) {
    const r = await askBox({ title: 'Supprimer définitivement', text: ids.length > 1 ? T('Supprimer définitivement ces {0} éléments et leurs fichiers ?').replace('{0}', ids.length) : T('Supprimer définitivement « {0} » et son fichier ?').replace('{0}', nameOf(items.get(ids[0]) || {})), ok: 'Supprimer', danger: true });
    if (!r) return;
    del = true;
  }
  await call('remove', ids, del);
  if (!del) toast(T('{0} élément(s) retiré(s) de la liste').replace('{0}', ids.length), { label: 'Annuler', fn: undoRemove });
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
async function submitAdd(startNow, dupAction) {
  const urls = $('#aUrls').value.split(/\s+/).filter(Boolean);
  if (ytFor && urls.length === 1 && urls[0] === ytFor) {
    const m = $('#aYtMode').value;
    let entries = null;
    if (ytInfo?.playlist) { entries = $$('#aYtList [data-yt]').filter(x => x.checked).map(x => ytInfo.entries[+x.dataset.yt]); if (!entries.length) return toast('Coche au moins une vidéo'); }
    const r = await safe(() => call('add', { kind: 'ytdl', urls, entries, dir: $('#aDir').value.trim(), startNow, schedule: $('#aSchedule').checked,
      name: $('#aName').value.trim() || null, title: $('#aName').value.trim() || (ytInfo && !ytInfo.playlist ? ytInfo.title : null), thumbnail: ytInfo?.thumbnail || '', headers: headersFromForm(), page: $('#aRef').value.trim() || addCtx.page || '', pageTitle: addCtx.pageTitle || '',
      speedLimit: +$('#aSpeed').value || 0, dupAction, ytdl: { mode: m === 'video' ? 'video' : 'audio', audioFormat: m === 'm4a' ? 'm4a' : 'mp3', audioBitrate: $('#aYtB').value, quality: $('#aYtQ').value || 'best' } }));
    if (!r) return;
    const dy = r.find(x => x && x.duplicate);
    if (dy) { const a = await askDuplicate(dy.duplicate); if (a) return submitAdd(startNow, a); return; }
    r.filter(Boolean).forEach(d => items.set(d.id, d)); closeM(); render();
    return toast(r.length > 1 ? `${r.length} vidéos ajoutées` : 'Vidéo ajoutée');
  }
  const v = $('#aVariants input:checked');
  const r = await safe(() => call('add', {
    urls, batch: $('#aBatch').checked, dir: $('#aDir').value.trim(), connections: +$('#aConn').value, startNow, schedule: $('#aSchedule').checked,
    name: $('#aName').value.trim() || addCtx.name || null, headers: headersFromForm(), page: $('#aRef').value.trim() || addCtx.page || '',
    speedLimit: +$('#aSpeed').value || 0, kind: addCtx.kind === 'ytdl' ? undefined : addCtx.kind, quality: v ? v.value : null, allowPage: !!addCtx.allowPage, dupAction,
  }));
  if (!r) return;
  const dx = r.find(x => x && x.duplicate);
  if (dx) { const a = await askDuplicate(dx.duplicate); if (a) return submitAdd(startNow, a); return; }
  if (!r.length && !urls.some(u => /^magnet:/i.test(u))) return toast('Aucun lien valide (http://, https:// ou magnet:)');
  r.filter(Boolean).forEach(d => items.set(d.id, d));
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
// corbeille : vider les terminés, avec confirmation (désactivable : « Ne plus prévenir »)
$('#clearDone').onclick = async () => {
  const n = [...items.values()].filter(d => d.status === 'done').length;
  if (!n) return toast('Aucun élément ici');
  if (S.confirmClear !== false) {
    const r = await askBox({ title: 'Retirer les terminés de la liste', text: T('{0} élément(s) terminé(s) seront retirés de la liste. Les fichiers restent sur le disque.').replace('{0}', n), ok: 'Retirer', danger: true, check: 'Ne plus prévenir' });
    if (!r) return;
    if (r.checked) { S = await call('setSettings', { confirmClear: false }); }
  }
  call('clearFinished');
};
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

// ---------------- raccourcis clavier du gestionnaire ----------------
let kCursor = null; // élément « actif » au clavier (flèches)
const SHORTCUTS = [
  ['Ctrl + A', 'Tout sélectionner'], ['Ctrl + clic', 'Ajouter / retirer de la sélection'], ['Maj + clic', 'Sélectionner une plage'], ['Glisser dans le vide', 'Sélection au rectangle'],
  ['↑ ↓ ← →', 'Se déplacer'], ['Maj + flèches', 'Étendre la sélection'], ['Début / Fin', 'Premier / dernier élément'],
  ['Entrée  /  double-clic', 'Ouvrir'], ['F2', 'Renommer'], ['Suppr', 'Retirer de la liste'], ['Maj + Suppr', 'Supprimer définitivement (fichier compris)'], ['Ctrl + Z', 'Annuler le retrait'],
  ['Ctrl + C', 'Copier le fichier (à coller dans un dossier)'], ['Ctrl + Maj + C', 'Copier le chemin'], ['Ctrl + V', 'Coller un lien et le télécharger'],
  ['Alt + Entrée', 'Propriétés (informations)'], ['Alt + Maj + P', 'Volet des détails'], ['F5', 'Actualiser'], ['Ctrl + F  /  F3', 'Rechercher'],
  ['Ctrl + molette', "Changer l'affichage (icônes, liste, détails)"], ['Ctrl + Maj + 2 … 8', 'Grandes icônes … Contenu'], ['Espace', 'Pause / reprendre'],
  ['Ctrl + N', 'Nouveau lien'], ['Ctrl + T', 'Nouveau torrent'], ['Ctrl + O', 'Ouvrir un fichier .torrent'], ['Ctrl + B', 'Ouvrir le navigateur'], ['Ctrl + ,', 'Paramètres'],
  ['Échap', 'Fermer / tout désélectionner'], ['F1', 'Afficher ces raccourcis'],
];
function showShortcuts() {
  prompt2('Raccourcis clavier', [{ html: `<div class="kbd-list">${SHORTCUTS.map(([k, l]) => `<div><kbd>${esc(T(k))}</kbd><span>${esc(T(l))}</span></div>`).join('')}</div>` }], 'OK');
}
$('#kbdBtn') && ($('#kbdBtn').onclick = showShortcuts);
function moveCursor(step, extend, abs) {
  const arr = sorted().filter(match).map(d => d.id);
  if (!arr.length) return;
  let i = arr.indexOf(kCursor ?? lastClickId);
  i = abs === 'start' ? 0 : abs === 'end' ? arr.length - 1 : (i < 0 ? 0 : Math.max(0, Math.min(arr.length - 1, i + step)));
  const id = arr[i];
  if (extend) {
    const anchor = lastClickId && arr.includes(lastClickId) ? lastClickId : arr[Math.max(0, i - step)];
    const a = arr.indexOf(anchor);
    selected = new Set(arr.slice(Math.min(a, i), Math.max(a, i) + 1));
  } else { selected = new Set([id]); lastClickId = id; }
  kCursor = id;
  render();
  $(`.item[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}
const targets = () => (selected.size ? [...selected] : kCursor ? [kCursor] : []).map(id => items.get(id)).filter(Boolean);
document.addEventListener('keydown', async e => {
  const k = e.key, K = k.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
  const modal = $('.overlay.on');
  if (k === 'Escape') {
    if (modal || $('#menu.on')) { closeM(); $('#menu').classList.remove('on'); return; }
    if (typing) { document.activeElement.blur(); return; }
    if (current) return closeDrawer();
    if (selected.size) { selected.clear(); kCursor = null; render(); }
    return;
  }
  if (k === 'F1' || (ctrl && (k === '/' || k === ':'))) { e.preventDefault(); return showShortcuts(); }
  if (ctrl && !e.shiftKey && K === 'n') { e.preventDefault(); return showAdd(); }
  if (ctrl && !e.shiftKey && K === 't') { e.preventDefault(); return showTorrent(); }
  if (ctrl && !e.shiftKey && K === 'o') { e.preventDefault(); showTorrent(); return setTimeout(() => $('#tPick').click(), 80); }
  if (ctrl && K === 'b') { e.preventDefault(); return call('openBrowser'); }
  if (ctrl && K === 'f') { e.preventDefault(); return $('#q').focus(); }
  if (ctrl && k === ',') { e.preventDefault(); return $('#setBtn').click(); }
  if (ctrl && e.shiftKey && /^Digit[2-8]$/.test(e.code)) { const m = { 2: 'icons-l', 3: 'icons-m', 4: 'icons-s', 5: 'list', 6: 'details', 8: 'content' }[e.code.slice(5)]; if (m) { e.preventDefault(); return setView(m); } }
  if (e.altKey && e.shiftKey && K === 'p') { e.preventDefault(); return togglePane(); }
  if (k === 'F5') { e.preventDefault(); return refreshView(); }
  if (k === 'F3') { e.preventDefault(); return $('#q').focus(); }
  if (typing || modal) return;
  if (ctrl && K === 'a') { e.preventDefault(); selected = new Set(sorted().filter(match).map(d => d.id)); return render(); }
  if (ctrl && K === 'v') { e.preventDefault(); return pasteLink(); }
  if (ctrl && K === 'z') { e.preventDefault(); return undoRemove(); }
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(k)) {
    e.preventDefault();
    const grid = VIEW.startsWith('icons') || VIEW === 'list';
    let cols = 1;
    if (grid) { const els = [...$('#list').querySelectorAll('.item')]; const top0 = els[0]?.offsetTop; cols = Math.max(1, els.filter(x => x.offsetTop === top0).length); }
    const step = k === 'ArrowDown' ? cols : k === 'ArrowUp' ? -cols : k === 'ArrowRight' ? (grid ? 1 : 0) : (grid ? -1 : 0);
    if (step) return moveCursor(step, e.shiftKey);
    return;
  }
  if (k === 'Home' || k === 'End') { e.preventDefault(); return moveCursor(0, e.shiftKey, k === 'Home' ? 'start' : 'end'); }
  const T0 = targets(); if (!T0.length) return;
  const one = T0.length === 1 ? T0[0] : (kCursor && items.get(kCursor)) || T0[0];
  if (k === 'Delete') { e.preventDefault(); return removeItems(T0.map(d => d.id), e.shiftKey); }
  if (k === 'Enter' && e.altKey) { e.preventDefault(); return openDrawer(one.id); }
  if (k === 'Enter') { e.preventDefault(); return one.status === 'done' ? safe(() => call('open', one.id)) : ['paused', 'error'].includes(one.status) ? call('resume', one.id) : openDrawer(one.id); }
  if (k === ' ') { e.preventDefault(); const anyRun = T0.some(d => ['running', 'queued', 'seeding'].includes(d.status)); T0.forEach(d => (anyRun ? ['running', 'queued', 'seeding', 'scheduled'].includes(d.status) && call('pause', d.id) : ['paused', 'error'].includes(d.status) && call('resume', d.id))); return; }
  if (k === 'F2') { e.preventDefault(); return itemAction('rename', one); }
  if (ctrl && K === 'i') { e.preventDefault(); return openDrawer(one.id); }
  if (ctrl && K === 'e') { e.preventDefault(); return itemAction('folder', one); }
  if (ctrl && e.shiftKey && K === 'c') { e.preventDefault(); return copyPaths(T0); }
  if (ctrl && K === 'c' && !window.getSelection().toString()) { e.preventDefault(); return copyFiles(T0); }
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
  v('#sDir', S.dir); c('#sCat', S.categorize); c('#sClip', S.clipboard); c('#sNotify', S.notify); c('#sSound', S.sound); c('#sTray', S.tray); c('#sConfirmClear', S.confirmClear !== false); c('#sAutoUpd', S.autoUpdateCheck !== false); c('#sBoot', S.startWithWindows); c('#sShut', S.shutdownWhenDone); c('#sWeb', S.autoOpenWebpage);
  v('#sConn', S.connections); bindRange('#sConn', '#sConnV'); v('#sPar', S.parallel); bindRange('#sPar', '#sParV'); v('#sRetry', S.maxRetries); v('#sDup', S.duplicate); v('#sHlsC', S.hls.connections); v('#sHlsQ', S.hls.quality); c('#sHlsConv', S.hls.convert); v('#sPerSite', S.perSite);
  const Y = S.ytdl || {}; v('#sYtMode', Y.mode === 'audio' ? (Y.audioFormat || 'mp3') : 'video'); v('#sYtQ', Y.quality || '1080'); v('#sYtB', Y.audioBitrate || '320');
  call('ytdl:version').then(x => ($('#sYtVer').textContent = 'Version de yt-dlp : ' + x)).catch(() => {});
  call('extInfo').then(x => ($('#eInfo').textContent = x.port ? `DrYAE écoute l'extension sur le port ${x.port}. Identifiant de l'extension : ${x.id}` : 'Le service de l\'extension n\'a pas pu démarrer.')).catch(() => {});
  c('#sLimOn', S.speedLimitOn); v('#sLim', S.speedLimit); c('#sDataOn', S.dataLimit.enabled); v('#sDataMb', S.dataLimit.mb); c('#sProxyOn', S.proxy.enabled); v('#sProxy', S.proxy.url); v('#sUA', S.userAgent);
  const st = await call('stats'); v('#sDataUsed', fmt(st.dataToday));
  const TO = S.torrent;
  c('#tEn', TO.enabled); c('#tMeta', TO.fetchMetadata); c('#tSeqD', TO.sequential); c('#tSeedD', TO.seed); v('#tRatio', TO.ratio); v('#tUp', TO.uploadLimit); v('#tDown', TO.downloadLimit); v('#tConns', TO.maxConns); v('#tPort', TO.port); c('#tDht', TO.dht); c('#tLsd', TO.lsd); c('#tDefTr', TO.useDefaultTrackers); v('#tTrackers', TO.trackers); v('#tTrUrl', TO.trackersUrl);
  const C = S.scheduler;
  c('#cOn', C.enabled); v('#cStart', C.start); v('#cStop', C.stop); c('#cAdd', C.addNew); c('#cShut', C.shutdown);
  $('#cDays').innerHTML = DAYS.map((d, i) => `<label><input type="checkbox" data-day="${i}" ${C.days.includes(i) ? 'checked' : ''}>${d}</label>`).join('');
  v('#lMode', S.theme.mode); $('#lColor').value = S.theme.accent === 'system' ? (window.SYS_ACCENT || '#8b5cf6') : S.theme.accent; $('#lColor').dataset.sys = S.theme.accent === 'system' ? '1' : '';
  $('#lSw').innerHTML = (window.SYS_ACCENT ? `<button data-acc="system" title="${esc(T('Couleur de Windows'))}" style="background:${window.SYS_ACCENT};outline:2px dashed var(--muted);outline-offset:1px" class="${S.theme.accent === 'system' ? 'on' : ''}"></button>` : '') + ACCENTS.map(a => `<button data-acc="${a}" style="background:${a}" class="${a === S.theme.accent ? 'on' : ''}"></button>`).join('');
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
  $('#pwList').innerHTML = S.passwords.map(p => `<div><span>${esc(p.host)} — ${esc(p.user)}</span><button class="icon-btn" data-rmpw="${esc(p.host)}">${ic('x')}</button></div>`).join('') || '<p class="hint">Aucun mot de passe enregistré.</p>';
}
$('#sModal').addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.rmsite) { sTmp.siteLimits.splice(+t.dataset.rmsite, 1); drawLists(); }
  if (t.dataset.rmpw) { await call('passwords:remove', t.dataset.rmpw); S = await call('getSettings'); drawLists(); }
  if (t.dataset.acc) { const sys = t.dataset.acc === 'system'; $('#lColor').value = sys ? window.SYS_ACCENT : t.dataset.acc; $('#lColor').dataset.sys = sys ? '1' : ''; $$('#lSw button').forEach(b => b.classList.toggle('on', b === t)); }
});
$('#sSiteAdd').onclick = () => { const h = $('#sSiteHost').value.trim().replace(/^https?:\/\//, '').split('/')[0]; const m = +$('#sSiteMax').value; if (h && m > 0) { sTmp.siteLimits.push({ host: h, max: m }); $('#sSiteHost').value = $('#sSiteMax').value = ''; drawLists(); } };
$('#pwAdd').onclick = async () => { const h = $('#pwHost').value.trim().replace(/^https?:\/\//, '').split('/')[0]; if (!h || !$('#pwUser').value) return; await call('passwords:add', h, $('#pwUser').value, $('#pwPass').value); $('#pwHost').value = $('#pwUser').value = $('#pwPass').value = ''; S = await call('getSettings'); drawLists(); toast('Mot de passe enregistré'); };
$('#sYtUpd').onclick = async () => { $('#sYtVer').textContent = 'Mise à jour en cours…'; try { const r = await call('ytdl:update'); $('#sYtVer').textContent = r + ' — version : ' + (await call('ytdl:version')); } catch (e) { $('#sYtVer').textContent = 'Échec : ' + e.message; } };
$('#eFolder').onclick = () => call('openExtFolder');
$('#eChrome').onclick = async () => { await call('copy', 'chrome://extensions'); toast('Adresse copiée : colle-la dans la barre d\'adresse de Chrome'); };
$('#sDirPick').onclick = async () => { const p = await call('pickDir', $('#sDir').value); if (p) $('#sDir').value = p; };
$('#sMagnet').onclick = async () => { const ok = await call('registerMagnet'); $('#sMagnetSt').textContent = ok ? 'DrYAE ouvre maintenant les liens magnet ✔' : 'Windows a refusé — choisis DrYAE dans Paramètres > Applications par défaut'; };
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
    dir: v('#sDir').trim() || S.dir, categorize: c('#sCat'), clipboard: c('#sClip'), notify: c('#sNotify'), sound: c('#sSound'), tray: c('#sTray'), confirmClear: c('#sConfirmClear'), autoUpdateCheck: c('#sAutoUpd'), startWithWindows: c('#sBoot'), shutdownWhenDone: c('#sShut'), autoOpenWebpage: c('#sWeb'),
    connections: n('#sConn'), parallel: n('#sPar'), maxRetries: n('#sRetry'), duplicate: v('#sDup'), perSite: n('#sPerSite'), siteLimits: sTmp.siteLimits,
    hls: { connections: Math.max(1, n('#sHlsC')), quality: v('#sHlsQ'), convert: c('#sHlsConv') },
    ytdl: { mode: v('#sYtMode') === 'video' ? 'video' : 'audio', audioFormat: v('#sYtMode') === 'm4a' ? 'm4a' : 'mp3', quality: v('#sYtQ'), audioBitrate: v('#sYtB') },
    speedLimitOn: c('#sLimOn'), speedLimit: n('#sLim'), dataLimit: { enabled: c('#sDataOn'), mb: n('#sDataMb') }, proxy: { enabled: c('#sProxyOn'), url: v('#sProxy').trim() }, userAgent: v('#sUA').trim(),
    torrent: { enabled: c('#tEn'), fetchMetadata: c('#tMeta'), sequential: c('#tSeqD'), seed: c('#tSeedD'), ratio: +v('#tRatio') || 0, uploadLimit: n('#tUp'), downloadLimit: n('#tDown'), maxConns: n('#tConns') || 55, port: n('#tPort'), dht: c('#tDht'), lsd: c('#tLsd'), useDefaultTrackers: c('#tDefTr'), trackers: v('#tTrackers'), trackersUrl: v('#tTrUrl').trim() },
    scheduler: { enabled: c('#cOn'), start: v('#cStart') || '02:00', stop: v('#cStop'), days: $$('#cDays [data-day]').filter(x => x.checked).map(x => +x.dataset.day), addNew: c('#cAdd'), shutdown: c('#cShut') },
    theme: { mode: v('#lMode'), accent: $('#lColor').dataset.sys ? 'system' : $('#lColor').value },
  };
  S = await safe(() => call('setSettings', patch)) || S;
  applyTheme(); updLimit(); closeM(); toast('Paramètres enregistrés');
};
$('#setBtn').onclick = () => showSettings();
D.on('open-settings', sec => showSettings(sec || undefined));

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

// ---------------- boîtes de dialogue ----------------
// petite boîte de confirmation générique : { title, text, ok, danger, check, buttons:[{v,label,primary}] } -> valeur choisie
function askBox(o) {
  return new Promise(res => {
    const m = $('#askModal');
    $('#askTitle').textContent = T(o.title || '');
    $('#askText').textContent = T(o.text || '');
    $('#askChkBox').style.display = o.check ? '' : 'none';
    $('#askChkTxt').textContent = T(o.check || '');
    $('#askChk').checked = false;
    const btns = o.buttons || [{ v: 'ok', label: o.ok || 'OK', primary: true, danger: o.danger }];
    $('#askBtns').innerHTML = '<button class="btn" data-v="">' + esc(T('Annuler')) + '</button>' + btns.map(b => `<button class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}" data-v="${b.v}">${esc(T(b.label))}</button>`).join('');
    const done = v => { m.classList.remove('on'); $('#askBtns').onclick = null; m.onkeydown = null; res(v ? { value: v, checked: $('#askChk').checked } : null); };
    $('#askBtns').onclick = e => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); };
    m.querySelector('[data-askx]').onclick = () => done('');
    m.classList.add('on');
    setTimeout(() => $('#askBtns .primary')?.focus(), 30);
  });
}
// doublon : remplacer, numéroter ou annuler
async function askDuplicate(d) {
  const st = d.status === 'done' ? T('déjà téléchargé') : T('déjà dans la liste');
  const r = await askBox({ title: 'Ce fichier existe déjà', text: `« ${d.name} » — ${st}. ` + T('Que veux-tu faire ?'), check: 'Toujours faire ce choix',
    buttons: [{ v: 'overwrite', label: 'Remplacer' }, { v: 'rename', label: 'Garder les deux (numéroter)', primary: true }] });
  if (!r) return null;
  if (r.checked) S = await call('setSettings', { duplicate: r.value });
  return r.value;
}

// ---------------- comportement « dossier Windows » ----------------
// clic dans le vide : désélectionne ; rectangle de sélection à la souris
(() => {
  const list = $('#list');
  let lasso = null, sx = 0, sy = 0, base = null, moved = false;
  list.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.dhead,.empty button,.rowchk,[data-act],.actions')) return;
    const onItem = e.target.closest('.item');
    if (onItem && (VIEW === 'content' || VIEW.startsWith('icons') || e.target.closest('.name,.ftype,.th,.tic'))) return;
    const r = list.getBoundingClientRect();
    sx = e.clientX - r.left + list.scrollLeft; sy = e.clientY - r.top + list.scrollTop; moved = false;
    base = e.ctrlKey ? new Set(selected) : new Set();
    lasso = document.createElement('div'); lasso.className = 'lasso'; list.appendChild(lasso);
    e.preventDefault();
  });
  addEventListener('mousemove', e => {
    if (!lasso) return;
    const r = list.getBoundingClientRect();
    const x = e.clientX - r.left + list.scrollLeft, y = e.clientY - r.top + list.scrollTop;
    if (Math.abs(x - sx) + Math.abs(y - sy) > 4) moved = true;
    const L = Math.min(x, sx), Tp = Math.min(y, sy), W = Math.abs(x - sx), H = Math.abs(y - sy);
    Object.assign(lasso.style, { left: L + 'px', top: Tp + 'px', width: W + 'px', height: H + 'px' });
    const box = { l: r.left + L - list.scrollLeft, t: r.top + Tp - list.scrollTop, r: r.left + L - list.scrollLeft + W, b: r.top + Tp - list.scrollTop + H };
    const sel = new Set(base);
    list.querySelectorAll('.item').forEach(el => { const b = el.getBoundingClientRect(); if (b.right > box.l && b.left < box.r && b.bottom > box.t && b.top < box.b) sel.add(el.dataset.id); });
    selected = sel; render();
    if (e.clientY > r.bottom - 20) list.scrollTop += 12; else if (e.clientY < r.top + 20) list.scrollTop -= 12;
  });
  addEventListener('mouseup', () => {
    if (!lasso) return;
    lasso.remove(); lasso = null;
    if (!moved && !base.size) { selected.clear(); kCursor = null; render(); }
  });
  // en-têtes de colonnes : clic = trier, glisser le bord = largeur
  list.addEventListener('click', e => { const h = e.target.closest('[data-sort]'); if (h && !e.target.closest('[data-rz]')) setSort(h.dataset.sort); });
  list.addEventListener('mousedown', e => {
    const rz = e.target.closest('[data-rz]'); if (!rz) return;
    e.preventDefault(); e.stopPropagation();
    const i = +rz.dataset.rz, x0 = e.clientX, w0 = COLS[i];
    const mv = ev => { COLS[i] = Math.max(60, w0 + ev.clientX - x0); list.style.setProperty('--cols', COLS.map((w, j) => (j === 0 ? `minmax(${w}px,1fr)` : w + 'px')).join(' ')); };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); LS.set('cols', COLS); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  }, true);
  // Ctrl + molette : taille des icônes (comme dans l'Explorateur)
  const ORDER = ['details', 'list', 'icons-s', 'icons-m', 'icons-l'];
  list.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const i = Math.max(0, ORDER.indexOf(VIEW === 'content' ? 'details' : VIEW));
    setView(ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (e.deltaY < 0 ? 1 : -1)))]);
  }, { passive: false });
  // glisser un fichier terminé vers le Bureau ou un dossier
  list.addEventListener('dragstart', e => {
    const row = e.target.closest('.item'); if (!row) return;
    e.preventDefault();
    const ids = selected.has(row.dataset.id) ? [...selected] : [row.dataset.id];
    window.dryae.drag(ids.filter(id => items.get(id)?.status === 'done'));
  });
})();
// menu du clic droit dans le vide
function bgMenu() {
  return [
    ...VIEWS.map(([v, l]) => ({ label: (VIEW === v ? '● ' : '    ') + T('Affichage') + ' : ' + T(l), icon: 'list', fn: () => setView(v) })),
    '-',
    ...SORTS.map(([k, l]) => ({ label: (SORT.k === k ? (SORT.dir > 0 ? '▲ ' : '▼ ') : '    ') + T('Trier par') + ' : ' + T(l), icon: 'sort', fn: () => setSort(k) })),
    '-',
    { label: 'Actualiser', icon: 'redo', fn: refreshView },
    { label: 'Coller un lien', icon: 'link', fn: pasteLink },
    { label: 'Tout sélectionner', icon: 'check', fn: () => { selected = new Set(sorted().filter(match).map(d => d.id)); render(); } },
    { label: PANE ? 'Masquer le volet des détails' : 'Afficher le volet des détails', icon: 'info', fn: () => togglePane() },
    '-',
    { label: 'Nouveau lien', icon: 'plus', fn: () => showAdd() },
    { label: 'Nouveau torrent', icon: 'magnet', fn: () => showTorrent() },
  ];
}
async function refreshView() { const L = await call('list'); items.clear(); L.forEach(d => items.set(d.id, d)); $('#list').querySelectorAll('.item').forEach(el => (el._h = '')); render(); }
async function pasteLink() { const t = (await navigator.clipboard.readText().catch(() => '')).trim(); if (/^magnet:/i.test(t)) return showTorrent({ src: t }); if (/^https?:\/\//i.test(t)) return showAdd({ url: t }); toast('Aucun lien valide (http://, https:// ou magnet:)'); }
// barre de commandes (en haut de la liste) et barre d'état (en bas)
function cmdState() {
  const sel = [...selected].map(id => items.get(id)).filter(Boolean);
  const one = sel.length === 1 ? sel[0] : null;
  const dis = (id, v) => { const b = $(id); if (b) b.disabled = !v; };
  dis('#cbOpen', one && one.status === 'done');
  dis('#cbCopy', sel.length); dis('#cbPath', sel.some(d => d.file)); dis('#cbRename', one); dis('#cbDel', sel.length); dis('#cbInfo', one);
  dis('#cbPause', sel.some(d => ['running', 'queued', 'seeding', 'scheduled', 'merging'].includes(d.status)));
  dis('#cbResume', sel.some(d => ['paused', 'error'].includes(d.status)));
  $('#cbPane')?.classList.toggle('on', PANE);
  const vl = VIEWS.find(x => x[0] === VIEW); if ($('#cbViewL')) $('#cbViewL').textContent = T(vl ? vl[1] : 'Affichage');
}
function status() {
  const vis = sorted().filter(match);
  const sel = [...selected].map(id => items.get(id)).filter(Boolean);
  const sz = sel.reduce((a, d) => a + (d.size > 0 ? d.size : 0), 0);
  const run = vis.filter(d => d.status === 'running').length;
  $('#sbar').innerHTML = `<span>${esc(T('{0} élément(s)').replace('{0}', vis.length))}</span>` +
    (sel.length ? `<span>${esc(T('{0} élément(s) sélectionné(s)').replace('{0}', sel.length))}${sz ? ' · ' + fmt(sz) : ''}</span>` : '') +
    (run ? `<span>${esc(T('{0} en cours').replace('{0}', run))}</span>` : '') +
    `<span class="sp"></span><button class="sbv ${VIEW === 'details' ? 'on' : ''}" data-v="details" title="${esc(T('Détails'))}">${ic('list')}</button><button class="sbv ${VIEW.startsWith('icons') ? 'on' : ''}" data-v="icons-l" title="${esc(T('Grandes icônes'))}">${ic('grid')}</button>`;
  cmdState();
}
$('#sbar').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
const selItems = () => [...selected].map(id => items.get(id)).filter(Boolean);
async function copyFiles(list = selItems()) {
  const done = list.filter(d => d.status === 'done');
  if (done.length) { const n = await call('copyFiles', done.map(d => d.id)); if (n) return toast(T('{0} fichier(s) copié(s) : colle-les dans un dossier avec Ctrl+V').replace('{0}', n)); }
  if (list.length) { await call('copy', list.map(d => d.url).join('\n')); toast(list.length > 1 ? 'Liens copiés' : 'Lien copié'); }
}
async function copyPaths(list = selItems()) { const p = list.map(d => d.file || d.dir).filter(Boolean); if (!p.length) return; await call('copy', p.map(x => `"${x}"`).join('\n')); toast('Chemin copié'); }
async function undoRemove() { const n = await call('undoRemove'); if (n) { await refreshView(); toast(T('{0} élément(s) remis dans la liste').replace('{0}', n)); } }
$('#cbNew').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, [{ label: 'Lien de téléchargement', icon: 'link', fn: () => showAdd() }, { label: 'Torrent / lien magnet', icon: 'magnet', fn: () => showTorrent() }, { label: 'Fichier .torrent…', icon: 'doc', fn: () => { showTorrent(); setTimeout(() => $('#tPick').click(), 80); } }, { label: 'Importer une liste de liens…', icon: 'list', fn: () => $('#toolsBtn').click() }]); };
$('#cbOpen').onclick = () => { const d = selItems()[0]; if (d) safe(() => call('open', d.id)); };
$('#cbCopy').onclick = () => copyFiles();
$('#cbPath').onclick = () => copyPaths();
$('#cbRename').onclick = () => { const d = selItems()[0]; if (d) renameItem(d); };
$('#cbDel').onclick = () => { const s = selItems(); if (s.length) removeItems(s.map(d => d.id)); };
$('#cbInfo').onclick = () => { const d = selItems()[0]; if (d) openDrawer(d.id); };
$('#cbPause').onclick = () => selItems().forEach(d => ['running', 'queued', 'seeding', 'scheduled', 'merging'].includes(d.status) && call('pause', d.id));
$('#cbResume').onclick = () => selItems().forEach(d => ['paused', 'error'].includes(d.status) && call('resume', d.id));
$('#cbSort').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, SORTS.map(([k, l]) => ({ label: (SORT.k === k ? (SORT.dir > 0 ? '▲ ' : '▼ ') : '    ') + T(l), icon: 'sort', fn: () => setSort(k) }))); };
$('#cbView').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); showMenu(r.left, r.bottom + 4, [...VIEWS.map(([v, l, k]) => ({ label: (VIEW === v ? '● ' : '    ') + T(l) + '   ' + T(k), icon: 'list', fn: () => setView(v) })), '-', { label: (PANE ? '☑ ' : '☐ ') + T('Volet des détails') + '   Alt+Maj+P', icon: 'info', fn: () => togglePane() }, { label: (selMode ? '☑ ' : '☐ ') + T("Cases à cocher des éléments"), icon: 'check', fn: () => $('#selBtn').click() }]); };
$('#cbMore').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); showMenu(r.right - 240, r.bottom + 4, [{ label: 'Tout sélectionner', icon: 'check', fn: () => { selected = new Set(sorted().filter(match).map(d => d.id)); render(); } }, { label: 'Inverser la sélection', icon: 'check', fn: () => { selected = new Set(sorted().filter(match).map(d => d.id).filter(id => !selected.has(id))); render(); } }, { label: 'Aucun', icon: 'x', fn: () => { selected.clear(); render(); } }, '-', { label: 'Annuler (Ctrl+Z)', icon: 'redo', fn: undoRemove }, { label: 'Actualiser (F5)', icon: 'redo', fn: refreshView }, '-', { label: 'Raccourcis clavier (F1)', icon: 'kbd', fn: showShortcuts }]); };
$('#cbPane').onclick = () => togglePane();
// couleur d'accent de Windows
call('accentColor').then(c => { window.SYS_ACCENT = c; if (S && S.theme && S.theme.accent === 'system') applyTheme(); }).catch(() => {});

$('#lColor').addEventListener('input', e => { e.target.dataset.sys = ''; });
