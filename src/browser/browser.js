/* DrYAE — navigateur intégré */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const B = window.br;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = b => { if (b == null || b < 0) return ''; const u = ['o', 'Ko', 'Mo', 'Go']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return (i ? b.toFixed(1) : b) + ' ' + u[i]; };
const ic = n => `<svg><use href="#i-${n}"/></svg>`;
const hostOf = u => { try { return new URL(u).hostname; } catch { return ''; } };
function toast(t, action) {
  const el = $('#toast'); el.innerHTML = esc(t) + (action ? ` <button class="btn sm" style="margin-left:8px;pointer-events:auto">${esc(action.label)}</button>` : '');
  el.style.pointerEvents = action ? 'auto' : 'none';
  if (action) el.querySelector('button').onclick = () => { action.fn(); el.classList.remove('on'); };
  el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), action ? 6000 : 2600);
}

let CFG = {}, STORE = { bookmarks: [], history: [] }, tabs = [], cur = null, seq = 0, panel = null;
const QUICK = [
  { t: 'Google', u: 'https://www.google.com' }, { t: 'YouTube', u: 'https://www.youtube.com' }, { t: 'Wikipédia', u: 'https://fr.wikipedia.org' },
  { t: 'Archive.org', u: 'https://archive.org' }, { t: 'GitHub', u: 'https://github.com' }, { t: 'SourceForge', u: 'https://sourceforge.net' },
];

const ONLINE = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|twitch\.tv|soundcloud\.com|bilibili\.com|reddit\.com|rumble\.com|odysee\.com|bandcamp\.com|mixcloud\.com|streamable\.com|vk\.com|ok\.ru|archive\.org|ted\.com|arte\.tv|france\.tv)$/i;
const isOnline = u => { try { const x = new URL(u); return ONLINE.test(x.hostname) && x.pathname.length > 1; } catch { return false; } };
function isUrlLike(s) { return /^(https?:\/\/|file:\/\/|about:)/i.test(s) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s) || /^localhost(:\d+)?/.test(s); }
async function toUrl(s) {
  s = s.trim();
  if (!s) return '';
  if (/^magnet:/i.test(s)) return s;
  if (isUrlLike(s)) return /^[a-z]+:\/\//i.test(s) || s.startsWith('about:') ? s : 'https://' + s;
  return B.call('br:search', s);
}

// ---------- onglets ----------
function newTab(url = '', opts = {}) {
  const id = ++seq;
  const tab = { id, url: '', title: 'Nouvel onglet', fav: '', incognito: !!opts.incognito, loading: false, media: [], blocked: 0, wv: null, wcId: null, zoom: 0 };
  const el = document.createElement('div');
  el.className = 'tab' + (tab.incognito ? ' priv' : '');
  el.innerHTML = `<span class="fav">${tab.incognito ? '🕶' : '•'}</span><span class="t"></span><button class="x" title="Fermer (Ctrl+W)">${ic('x')}</button>`;
  el.onmousedown = e => { if (e.button === 1) { e.preventDefault(); closeTab(tab); } };
  el.onclick = e => { if (e.target.closest('.x')) closeTab(tab); else select(tab); };
  $('#tabs').insertBefore(el, $('#newTab'));
  // glisser-déposer pour réordonner les onglets
  el.draggable = true;
  el.addEventListener('dragstart', e => { dragTab = tab; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', tab.url || ''); } catch {} });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); $$('.tab').forEach(t => t.classList.remove('drop-l', 'drop-r')); dragTab = null; });
  el.addEventListener('dragover', e => {
    if (!dragTab || dragTab === tab) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
    el.classList.toggle('drop-r', after); el.classList.toggle('drop-l', !after);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-l', 'drop-r'));
  el.addEventListener('drop', e => {
    if (!dragTab || dragTab === tab) return;
    e.preventDefault();
    const r = el.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
    moveTab(dragTab, tab, after);
  });
  tab.el = el;
  tabs.push(tab);
  if (url && opts.lazy) { tab.url = url; tab.lazy = true; tab.title = opts.title || hostOf(url); updTab(tab); }
  else if (url) navigate(tab, url); else updTab(tab);
  if (!opts.background) select(tab);
  return tab;
}
function ensureWebview(tab) {
  if (tab.wv) return tab.wv;
  const wv = document.createElement('webview');
  wv.setAttribute('partition', tab.incognito ? CFG.partitions.incognito : CFG.partitions.normal);
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes, nodeIntegrationInSubFrames=yes');
  $('#views').appendChild(wv);
  tab.wv = wv;
  const grabId = () => { if (!tab.wcId) { try { tab.wcId = wv.getWebContentsId(); flushPending(tab); if (tab === cur) B.call('br:selectTab', tab.wcId); } catch {} } };
  wv.addEventListener('did-attach', grabId);
  wv.addEventListener('did-start-loading', grabId);
  wv.addEventListener('dom-ready', () => {
    grabId();
    if (tab.zoom) wv.setZoomLevel(tab.zoom);
  }, { once: false });
  wv.addEventListener('did-start-loading', () => { tab.loading = true; updTab(tab); });
  wv.addEventListener('did-stop-loading', () => { tab.loading = false; updTab(tab); });
  
  wv.addEventListener('did-navigate', e => { tab.url = e.url; updTab(tab); if (!tab.incognito) B.call('br:history', { url: e.url, title: tab.title }); });
  wv.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) { tab.url = e.url; updTab(tab); } });
  wv.addEventListener('page-title-updated', e => { tab.title = e.title; updTab(tab); if (!tab.incognito) B.call('br:history', { url: tab.url, title: e.title }); });
  wv.addEventListener('page-favicon-updated', e => { tab.fav = e.favicons[0] || ''; updTab(tab); });
  wv.addEventListener('did-fail-load', e => {
    if (!e.isMainFrame || e.errorCode === -3) return;
    const msg = { '-105': "Adresse introuvable. Vérifie l'orthographe ou ta connexion.", '-106': 'Pas de connexion internet.', '-102': 'Connexion refusée.', '-118': 'Le site met trop de temps à répondre.', '-200': 'Certificat du site invalide.', '-20': 'Bloqué par le bloqueur de publicités.' }[e.errorCode] || e.errorDescription;
    wv.executeJavaScript(`document.documentElement.innerHTML = ${JSON.stringify(`<body style="font:15px Segoe UI,sans-serif;background:#0d0f14;color:#e7e9ef;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="max-width:520px;text-align:center"><h2>Impossible d'ouvrir la page</h2><p style="color:#8a91a3">${esc(msg)}</p><p style="color:#5b6274;font-size:12px">${esc(e.validatedURL)}</p></div></body>`)}`).catch(() => {});
  });
  wv.addEventListener('ipc-message', e => { if (e.channel === 'dryae-video') openQuick(tab, e.args[0] || {}); });
  wv.addEventListener('found-in-page', e => { $('#findN').textContent = e.result.matches ? `${e.result.activeMatchOrdinal}/${e.result.matches}` : '0'; });
  wv.addEventListener('enter-html-full-screen', () => document.body.classList.add('fs'));
  return wv;
}
async function navigate(tab, input) {
  const url = await toUrl(input);
  if (!url) return showStart(tab);
  if (/^magnet:/i.test(url)) return B.call('br:download', { url, page: tab.url, incognito: tab.incognito });
  const wv = ensureWebview(tab);
  tab.url = url; tab.title = hostOf(url) || url;
  wv.src = url;
  updTab(tab);
  if (tab === cur) showView(tab);
}
function showStart(tab) { tab.url = ''; tab.title = 'Nouvel onglet'; if (tab.wv) { tab.wv.remove(); tab.wv = null; tab.wcId = null; } updTab(tab); if (tab === cur) showView(tab); }
function select(tab) {
  cur = tab;
  if (tab.wcId) B.call('br:selectTab', tab.wcId);
  if (tab.lazy) { tab.lazy = false; navigate(tab, tab.url); }
  tabs.forEach(t => t.el.classList.toggle('on', t === tab));
  showView(tab);
  updToolbar();
  if (panel === 'media') drawMedia();
}
function showView(tab) {
  $$('webview').forEach(w => w.classList.toggle('on', w === tab.wv && !!tab.url));
  const start = !tab.url;
  $('#start').classList.toggle('on', start);
  $('#privNote').style.display = tab.incognito ? '' : 'none';
  if (start) { drawTiles(); setTimeout(() => $('#url').focus(), 30); }
}
let dragTab = null;
function moveTab(t, ref, after) {
  tabs.splice(tabs.indexOf(t), 1);
  const i = tabs.indexOf(ref) + (after ? 1 : 0);
  tabs.splice(i, 0, t);
  $('#tabs').insertBefore(t.el, after ? ref.el.nextSibling : ref.el);
  $$('.tab').forEach(x => x.classList.remove('drop-l', 'drop-r'));
  saveSession();
}
function closeTab(tab) {
  const i = tabs.indexOf(tab);
  saveSession();
  tab.wv?.remove(); tab.el.remove();
  tabs.splice(i, 1);
  if (!tabs.length) return window.close();
  if (cur === tab) select(tabs[Math.min(i, tabs.length - 1)]);
}
let sessT = null;
function saveSession() { clearTimeout(sessT); sessT = setTimeout(() => { const list = tabs.filter(t => !t.incognito && t.url); B.call('br:session', { tabs: list.map(t => ({ url: t.url, title: t.title })), active: Math.max(0, list.indexOf(cur)) }); }, 800); }
function updTab(tab) {
  saveSession();
  tab.el.querySelector('.t').textContent = tab.title || tab.url || 'Nouvel onglet';
  tab.el.title = tab.title + (tab.url ? '\n' + tab.url : '');
  const f = tab.el.querySelector('.fav, img');
  if (tab.fav && !tab.loading) {
    if (f.tagName !== 'IMG') { const img = document.createElement('img'); img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'fav', textContent: '•' })); }; f.replaceWith(img); }
    tab.el.querySelector('img').src = tab.fav;
  } else if (f.tagName === 'IMG') f.replaceWith(Object.assign(document.createElement('span'), { className: 'fav', textContent: tab.incognito ? '🕶' : '•' }));
  tab.el.classList.toggle('loading', tab.loading);
  if (tab === cur) updToolbar();
}
function updToolbar() {
  const t = cur; if (!t) return;
  if (document.activeElement !== $('#url')) $('#url').value = t.url || '';
  $('#lock').classList.toggle('no', !/^https:/.test(t.url));
  const wv = t.wv;
  let canBack = false, canFwd = false;
  try { canBack = !!(wv && t.wcId && wv.canGoBack()); canFwd = !!(wv && t.wcId && wv.canGoForward()); } catch {}
  $('#bBack').disabled = !canBack && !t.url; $('#bFwd').disabled = !canFwd;
  $('#reloadIc').setAttribute('href', t.loading ? '#i-stop' : '#i-reload');
  $('#loadbar').style.width = t.loading ? '70%' : '0';
  const bm = STORE.bookmarks.some(b => b.url === t.url);
  $('#starIc').setAttribute('href', bm ? '#i-star-f' : '#i-star');
  $('#bStar').classList.toggle('on', bm);
  // médias
  const vids = t.media.filter(m => m.kind !== 'subtitle');
  const online = isOnline(t.url);
  const nDl = vids.length + (online ? 1 : 0);
  $('#dlN').textContent = nDl > 99 ? '99+' : nDl; $('#dlN').classList.toggle('on', nDl > 0);
  $('#bDrYAE').classList.toggle('has', nDl > 0);
  // bloqueur
  const wl = CFG.whitelist?.some(w => hostOf(t.url) === w || hostOf(t.url).endsWith('.' + w));
  $('#bShield').classList.toggle('on', CFG.adblock && !wl);
  $('#shieldN').textContent = t.blocked > 99 ? '99+' : t.blocked; $('#shieldN').classList.toggle('on', CFG.adblock && !wl && t.blocked > 0);
  $('#zoom').textContent = t.zoom ? Math.round(Math.pow(1.2, t.zoom) * 100) + ' %' : '';
}

// ---------- page d'accueil ----------
function drawTiles() {
  const list = [...STORE.bookmarks.slice(0, 12).map(b => ({ t: b.title || hostOf(b.url), u: b.url })), ...QUICK.filter(q => !STORE.bookmarks.some(b => hostOf(b.url) === hostOf(q.u)))].slice(0, 18);
  $('#tiles').innerHTML = list.map(x => `<div class="tile" data-u="${esc(x.u)}"><div class="ic">${esc((x.t || '?')[0].toUpperCase())}</div><span>${esc(x.t)}</span></div>`).join('');
}
$('#tiles').onclick = e => { const t = e.target.closest('[data-u]'); if (t) navigate(cur, t.dataset.u); };


// ---------- barre d'outils ----------
function goTyped(text) { text = String(text || '').trim(); if (!text) return; if (!cur.incognito) B.call('br:typed', text); navigate(cur, text); hideSug(); }
bindSuggest($('#url'), t => { goTyped(t); $('#url').blur(); });
bindSuggest($('#startQ'), t => { goTyped(t); $('#startQ').value = ''; });
let urlJustFocused = false;
$('#url').addEventListener('focus', () => { $('#url').select(); urlJustFocused = true; });
$('#url').addEventListener('mouseup', e => { if (urlJustFocused) { e.preventDefault(); urlJustFocused = false; } });
$('#bBack').onclick = () => { if (cur.wv && cur.wv.canGoBack()) cur.wv.goBack(); else showStart(cur); };
$('#bFwd').onclick = () => cur.wv?.goForward();
$('#bReload').onclick = () => { if (!cur.wv) return; cur.loading ? cur.wv.stop() : cur.wv.reload(); };
$('#bHome').onclick = () => showStart(cur);
$('#newTab').onclick = () => newTab();
$('#bDrYAE').onclick = () => togglePanel('media');
$('#bStar').onclick = async () => {
  if (!cur.url) return;
  const has = STORE.bookmarks.some(b => b.url === cur.url);
  STORE.bookmarks = await B.call('br:bookmark', { url: cur.url, title: cur.title, remove: has });
  toast(has ? 'Retiré des favoris' : 'Ajouté aux favoris'); updToolbar();
  if (panel === 'bookmarks') drawBookmarks();
};

$('#bShield').onclick = e => {
  const h = hostOf(cur.url);
  const wl = CFG.whitelist.some(w => h === w || h.endsWith('.' + w));
  const r = e.currentTarget.getBoundingClientRect();
  menu(r.right - 260, r.bottom + 4, [
    { label: `${cur.blocked} élément(s) bloqué(s) sur cette page`, icon: 'shield', fn: () => {} },
    '-',
    h && { label: wl ? `Réactiver le bloqueur sur ${h}` : `Désactiver le bloqueur sur ${h}`, icon: 'shield', fn: async () => { CFG.whitelist = await B.call('br:whitelist', { host: h, add: !wl }); cur.wv?.reload(); updToolbar(); } },
    { label: CFG.adblock ? 'Désactiver le bloqueur partout' : 'Activer le bloqueur', icon: 'shield', fn: async () => { CFG = { ...CFG, ...(await B.call('br:setSettings', { adblock: !CFG.adblock })) }; cur.wv?.reload(); updToolbar(); } },
  ].filter(Boolean));
};
$('#bMenu').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  menu(r.right - 280, r.bottom + 4, [
    { label: 'Gestionnaire de téléchargements  (Ctrl+J)', icon: 'dl', fn: () => B.call('br:openMain') },
    { label: 'Donner mon avis', icon: 'star', fn: () => B.call('br:feedback') },
    '-',
    { label: 'Nouvel onglet  (Ctrl+T)', icon: 'plus', fn: () => newTab() },
    { label: 'Nouvel onglet privé  (Ctrl+Maj+N)', icon: 'mask', fn: () => newTab('', { incognito: true }) },
    '-',
    { label: 'Favoris', icon: 'star', fn: () => togglePanel('bookmarks', true) },
    { label: 'Mots de passe', icon: 'key', fn: () => togglePanel('passwords', true) },
    { label: 'Saisie automatique', icon: 'user', fn: () => togglePanel('autofill', true) },
    { label: 'Extensions', icon: 'puzzle', fn: () => togglePanel('extensions', true) },
    { label: 'Historique  (Ctrl+H)', icon: 'clock', fn: () => togglePanel('history', true) },
    { label: 'Extraire les liens de la page', icon: 'link', fn: () => grabLinks() },
    { label: 'Rechercher dans la page  (Ctrl+F)', icon: 'search', fn: () => openFind() },
    '-',
    { label: CFG.ua === 'mobile' ? 'Passer en mode ordinateur' : 'Passer en mode mobile', icon: 'phone', fn: async () => { CFG = { ...CFG, ...(await B.call('br:setSettings', { ua: CFG.ua === 'mobile' ? 'desktop' : 'mobile' })) }; cur.wv?.reload(); } },
    { label: 'Zoom +  (Ctrl +)', icon: 'plus', fn: () => zoom(1) },
    { label: 'Zoom −  (Ctrl −)', icon: 'x', fn: () => zoom(-1) },
    { label: 'Enregistrer la page avec DrYAE', icon: 'dl', fn: () => cur.url && B.call('br:download', { url: cur.url, page: cur.url, allowPage: true, incognito: cur.incognito }) },
    { label: 'Ouvrir cette page dans Chrome', icon: 'link', fn: () => cur.url && B.call('br:openExternal', cur.url) },
    { label: 'Copier l\'adresse', icon: 'copy', fn: () => navigator.clipboard.writeText(cur.url) },
    '-',
    { label: 'Effacer l\'historique', icon: 'trash', fn: async () => { await B.call('br:clearHistory'); STORE.history = []; toast('Historique effacé'); } },
    { label: 'Effacer les cookies', icon: 'trash', fn: async () => { await B.call('br:clearCookies'); toast('Cookies effacés'); } },
    { label: 'Vider le cache', icon: 'trash', fn: async () => { await B.call('br:clearCache'); toast('Cache vidé'); } },
  ]);
};
function zoom(d) { if (!cur.wv) return; cur.zoom = d === 0 ? 0 : Math.max(-5, Math.min(6, cur.zoom + d)); cur.wv.setZoomLevel(cur.zoom); updToolbar(); }

function menu(x, y, entries) {
  const m = $('#menu');
  m.innerHTML = entries.map((e, i) => (e === '-' ? '<hr>' : `<button data-i="${i}">${ic(e.icon || 'list')}${esc(e.label)}</button>`)).join('');
  m.classList.add('on');
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  m.onclick = ev => { const b = ev.target.closest('[data-i]'); if (!b) return; m.classList.remove('on'); entries[+b.dataset.i].fn(); };
}
document.addEventListener('mousedown', e => { if (!e.target.closest('#menu')) $('#menu').classList.remove('on'); });

// ---------- panneaux ----------
function closePanel() {
  if (!panel) return;
  panel = null;
  const el = $('#panel');
  el.classList.add('slide');
  setTimeout(() => { if (!panel) el.classList.remove('on', 'slide'); }, 230);
}
function togglePanel(name, force) {
  if (panel === name && !force) return closePanel();
  const el = $('#panel');
  const wasOpen = !!panel;
  panel = name; el.classList.add('on');
  if (!wasOpen) { el.classList.add('slide'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('slide'))); }
  ({ media: drawMedia, bookmarks: drawBookmarks, history: drawHistory, links: () => {}, passwords: drawPasswords, autofill: drawAutofill, extensions: drawExtensions })[name]?.();
}
$('#pClose').onclick = closePanel;

function drawMedia() {
  $('#pTitle').textContent = 'Téléchargements de cette page';
  const m = cur.media;
  const kindLbl = { video: 'vidéo', audio: 'audio', hls: 'flux HLS', dash: 'flux DASH', subtitle: 'sous-titres', file: 'fichier' };
  const top = isOnline(cur.url) ? `<div class="mitem" style="border-color:var(--accent-line)"><div class="nm"><span class="k">vidéo en ligne</span>${esc(cur.title || 'Vidéo de cette page')}</div><div class="u">Choisis MP4 (avec la qualité) ou MP3, avec la taille de chaque fichier.</div><div class="row"><button class="btn sm primary" id="mPage">${ic('dl')}Vidéo de cette page</button></div></div>` : '';
  setTimeout(() => { const b = $('#mPage'); if (b) b.onclick = () => openQuick(cur, { page: cur.url, title: cur.title }); }, 0);
  $('#pBody').innerHTML = top + (m.length ? m.map((x, i) => `<div class="mitem"><div class="nm"><span class="k ${x.kind}">${kindLbl[x.kind] || x.kind}</span>${esc(x.name || 'média')}</div>
    <div class="u">${fmt(x.size)}${x.mime ? ' · ' + esc(x.mime) : ''}</div><div class="u">${esc(x.url)}</div>
    <div class="row">${x.kind === 'dash' ? '<span class="hint">Flux DASH : non pris en charge pour le moment</span>' : `<button class="btn sm primary" data-dl="${i}">${ic('dl')}Télécharger</button>`}<button class="btn sm" data-cp="${i}">${ic('copy')}Copier le lien</button></div></div>`).join('')
    : `<p class="hint">Lance la lecture d'une vidéo ou d'un audio sur la page : DrYAE le détectera ici.</p><p class="hint">Astuce : clic droit sur un lien → « Télécharger le lien avec DrYAE ».</p>`);
}
function dlMedia(x) {
  const nameBase = (cur.title || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120);
  let name = x.name;
  if (x.kind === 'hls') name = nameBase || 'video';
  else if (!/\.\w{2,5}$/.test(name || '') && nameBase) name = nameBase + '.' + (x.ext || (x.kind === 'audio' ? 'mp3' : 'mp4'));
  B.call('br:download', { url: x.url, name, page: cur.url, kind: x.kind === 'hls' ? 'hls' : undefined, incognito: cur.incognito });
}
$('#pBody').addEventListener('click', e => {
  const d = e.target.closest('[data-dl]');
  if (d) { const m = cur.media[+d.dataset.dl]; if (['video', 'audio', 'hls'].includes(m.kind)) return openQuick(cur, { page: cur.url, title: cur.title, src: m.url }); return openQuickFile({ url: m.url, name: m.name, page: cur.url, size: m.size, kind: m.kind, incognito: cur.incognito }); }
  const c = e.target.closest('[data-cp]'); if (c) { navigator.clipboard.writeText(cur.media[+c.dataset.cp].url); return toast('Lien copié'); }
  const o = e.target.closest('[data-open]'); if (o) return navigate(cur, o.dataset.open);
  const r = e.target.closest('[data-rmb]'); if (r) { e.stopPropagation(); B.call('br:bookmark', { url: r.dataset.rmb, remove: true }).then(b => { STORE.bookmarks = b; drawBookmarks(); updToolbar(); }); }
});
function drawBookmarks() {
  $('#pTitle').textContent = 'Favoris';
  $('#pBody').innerHTML = STORE.bookmarks.length ? STORE.bookmarks.map(b => `<div class="hrow" data-open="${esc(b.url)}"><div class="t"><b>${esc(b.title || b.url)}</b><span>${esc(b.url)}</span></div><button class="icon-btn" data-rmb="${esc(b.url)}">${ic('x')}</button></div>`).join('') : '<p class="hint">Aucun favori. Clique sur l\'étoile dans la barre d\'adresse.</p>';
}
async function drawHistory(q = '') {
  STORE = await B.call('br:store');
  $('#pTitle').textContent = 'Historique';
  const f = q.toLowerCase();
  const list = STORE.history.filter(h => !f || (h.title + ' ' + h.url).toLowerCase().includes(f)).slice(0, 300);
  let lastDay = '';
  $('#pBody').innerHTML = `<input type="text" id="hQ" placeholder="Rechercher dans l'historique" value="${esc(q)}" style="margin-bottom:8px">` + (list.map(h => {
    const day = new Date(h.t).toLocaleDateString((window.I18N && I18N.locale || 'fr-FR'), { weekday: 'long', day: 'numeric', month: 'long' });
    const sep = day !== lastDay ? `<div class="sect" style="margin:12px 4px 4px">${day}</div>` : ''; lastDay = day;
    return sep + `<div class="hrow" data-open="${esc(h.url)}"><div class="t"><b>${esc(h.title || h.url)}</b><span>${new Date(h.t).toLocaleTimeString((window.I18N && I18N.locale || 'fr-FR'), { hour: '2-digit', minute: '2-digit' })} · ${esc(hostOf(h.url))}</span></div></div>`;
  }).join('') || '<p class="hint">Historique vide.</p>');
  const inp = $('#hQ'); inp.oninput = () => { clearTimeout(inp.t); inp.t = setTimeout(() => { drawHistory(inp.value); setTimeout(() => { const i = $('#hQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 0); }, 250); };
}

// extraction des liens
async function grabLinks(tab = cur) {
  if (!tab.wv || !tab.url) return toast('Ouvre une page d\'abord');
  const links = await tab.wv.executeJavaScript(`(() => {
    const out = new Map();
    const add = (u, t, k) => { try { const x = new URL(u, location.href).href; if (/^(https?:|magnet:)/.test(x) && !out.has(x)) out.set(x, { url: x, text: (t || '').trim().slice(0, 120), kind: k }); } catch {} };
    document.querySelectorAll('a[href]').forEach(a => add(a.getAttribute('href'), a.textContent || a.title, 'lien'));
    document.querySelectorAll('img[src]').forEach(i => add(i.currentSrc || i.src, i.alt, 'image'));
    document.querySelectorAll('video[src],audio[src],source[src],video source,audio source').forEach(v => add(v.currentSrc || v.src || v.getAttribute('src'), '', 'média'));
    return [...out.values()];
  })()`).catch(() => []);
  panel = 'links'; $('#panel').classList.add('on');
  $('#pTitle').textContent = `Liens de la page (${links.length})`;
  const exts = [...new Set(links.map(l => (l.url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase()).filter(Boolean))].sort();
  $('#pBody').innerHTML = `<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px"><input type="text" id="gQ" placeholder="Filtrer (texte ou extension)"></div>
    <div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:8px">${exts.slice(0, 24).map(e => `<button class="btn sm" data-ext="${e}">.${e}</button>`).join('')}<button class="btn sm" data-ext="">tout</button></div>
    <div class="row" style="margin-bottom:8px;flex-wrap:wrap;gap:6px"><label class="check" style="margin:0"><input type="checkbox" id="gAll"> Tout cocher</label><span style="flex:1"></span><button class="btn sm" id="gSz">Afficher les tailles</button><button class="btn sm primary" id="gDl">${ic('dl')}Télécharger la sélection</button></div>
    <div id="gList"></div>`;
  const draw = () => {
    const q = $('#gQ').value.toLowerCase();
    $('#gList').innerHTML = links.map((l, i) => ({ l, i })).filter(({ l }) => !q || (l.url + ' ' + l.text).toLowerCase().includes(q)).slice(0, 800).map(({ l, i }) =>
      `<label class="hrow" style="cursor:pointer"><input type="checkbox" data-g="${i}"><div class="t"><b>${esc(l.text || l.url.split('/').pop() || l.url)}</b><span>${esc(l.kind)}${l.size > 0 ? ' · <b style="display:inline;color:var(--text)">' + fmt(l.size) + '</b>' : l.size === -1 ? ' · taille inconnue' : ''} · ${esc(l.url)}</span></div></label>`).join('');
    updSel();
  };
  draw();
  $('#gQ').oninput = draw;
  $('#pBody').querySelectorAll('[data-ext]').forEach(b => (b.onclick = () => { $('#gQ').value = b.dataset.ext ? '.' + b.dataset.ext : ''; draw(); }));
  function updSel() { const sel = $$('#gList [data-g]').filter(x => x.checked).map(x => links[+x.dataset.g]); const tot = sel.reduce((a, l) => a + (l.size > 0 ? l.size : 0), 0); $('#gDl').innerHTML = ic('dl') + (sel.length ? `Télécharger (${sel.length}${tot ? ' · ' + fmt(tot) : ''})` : 'Télécharger la sélection'); }
  $('#gList').onchange = updSel;
  $('#gAll').onchange = e => { $$('#gList [data-g]').forEach(x => (x.checked = e.target.checked)); updSel(); };
  $('#gSz').onclick = async () => {
    const q = $('#gQ').value.toLowerCase();
    const vis = links.filter(l => !q || (l.url + ' ' + l.text).toLowerCase().includes(q)).filter(l => /^https?:/.test(l.url) && l.size === undefined).slice(0, 300);
    if (!vis.length) return;
    $('#gSz').disabled = true; $('#gSz').textContent = 'Calcul…';
    const checked = new Set($$('#gList [data-g]').filter(x => x.checked).map(x => +x.dataset.g));
    const res = await B.call('br:sizes', { urls: vis.map(l => l.url), page: tab.url, incognito: tab.incognito });
    res.forEach((r, k) => { vis[k].size = r && r.size > 0 && !/text\/html/.test(r.type) ? r.size : -1; });
    draw(); $$('#gList [data-g]').forEach(x => { if (checked.has(+x.dataset.g)) x.checked = true; }); updSel();
    $('#gSz').disabled = false; $('#gSz').textContent = 'Afficher les tailles';
  };
  $('#gDl').onclick = () => {
    const urls = $$('#gList [data-g]').filter(x => x.checked).map(x => links[+x.dataset.g].url);
    if (!urls.length) return toast('Coche au moins un lien');
    B.call('br:downloadMany', { urls, page: tab.url, incognito: tab.incognito });
  };
}

// recherche dans la page
function openFind() { $('#findbar').classList.add('on'); $('#findQ').focus(); $('#findQ').select(); }
function find(fwd = true) { const q = $('#findQ').value; if (q && cur.wv) cur.wv.findInPage(q, { forward: fwd, findNext: true }); }
$('#findQ').oninput = () => { const q = $('#findQ').value; if (cur.wv) q ? cur.wv.findInPage(q) : cur.wv.stopFindInPage('clearSelection'); };
$('#findQ').onkeydown = e => { if (e.key === 'Enter') find(!e.shiftKey); if (e.key === 'Escape') closeFind(); };
$('#findNext').onclick = () => find(true); $('#findPrev').onclick = () => find(false);
function closeFind() { $('#findbar').classList.remove('on'); cur.wv?.stopFindInPage('clearSelection'); }
$('#findX').onclick = closeFind;

// raccourcis
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.ctrlKey && e.shiftKey && k === 'n') { e.preventDefault(); newTab('', { incognito: true }); }
  else if (e.ctrlKey && k === 't') { e.preventDefault(); newTab(); }
  else if (e.ctrlKey && k === 'w') { e.preventDefault(); closeTab(cur); }
  else if (e.ctrlKey && k === 'l') { e.preventDefault(); $('#url').focus(); }
  else if (e.ctrlKey && k === 'f') { e.preventDefault(); openFind(); }
  else if (e.ctrlKey && k === 'j') { e.preventDefault(); B.call('br:openMain'); }
  else if (e.ctrlKey && k === 'h') { e.preventDefault(); togglePanel('history', true); }
  else if (e.ctrlKey && k === 'd') { e.preventDefault(); $('#bStar').click(); }
  else if (e.ctrlKey && e.shiftKey && (k === 'pageup' || k === 'pagedown')) { e.preventDefault(); const i = tabs.indexOf(cur), j = i + (k === 'pageup' ? -1 : 1); if (j >= 0 && j < tabs.length) moveTab(cur, tabs[j], k === 'pagedown'); }
  else if (e.ctrlKey && k === 'tab') { e.preventDefault(); const i = tabs.indexOf(cur); select(tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length]); }
  else if (e.ctrlKey && (k === '+' || k === '=')) { e.preventDefault(); zoom(1); }
  else if (e.ctrlKey && k === '-') { e.preventDefault(); zoom(-1); }
  else if (e.ctrlKey && k === '0') { e.preventDefault(); zoom(0); }
  else if (k === 'f5' || (e.ctrlKey && k === 'r')) { e.preventDefault(); cur.wv?.reload(); }
  else if (e.altKey && k === 'arrowleft') $('#bBack').click();
  else if (e.altKey && k === 'arrowright') $('#bFwd').click();
  else if (k === 'escape') { $('#menu').classList.remove('on'); closeFind(); closeQuick(); }
});

// ---------- événements du processus principal ----------
const tabByWc = id => tabs.find(t => t.wcId === id);
B.on('open-url', async ({ url, incognito, background, from }) => {
  await ready;
  const src = from ? tabByWc(from) : null;
  if (!url && tabs.length) return newTab('', { incognito });
  newTab(url, { incognito: incognito ?? src?.incognito, background });
});
function applyTheme(t) {
  let mode = t.mode || 'dark'; if (mode === 'system') mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.mode = mode;
  if (t.accent) { const r = document.documentElement.style; r.setProperty('--accent', t.accent); r.setProperty('--accent-soft', t.accent + '22'); r.setProperty('--accent-line', t.accent + '55'); }
}
// vérification anti-robot bloquée : proposer Chrome
setInterval(() => {
  if (!cur || !cur.url || !cur.wv) return;
  const stuck = /vérification|just a moment|un instant|verify you are human|attention required|êtes humain/i.test(cur.title || '');
  if (stuck) { cur._stuck = (cur._stuck || 0) + 1; if (cur._stuck === 12) toast('La vérification anti-robot ne passe pas ici ?', { label: 'Ouvrir dans Chrome', fn: () => B.call('br:openExternal', cur.url) }); }
  else cur._stuck = 0;
}, 1000);

// ---------- suggestions de la barre d'adresse ----------
const sugBox = document.createElement('div');
sugBox.className = 'menu'; sugBox.id = 'sug'; sugBox.style.minWidth = '0';
document.body.appendChild(sugBox);
let sugItems = [], sugIdx = -1, sugFor = null;
function hideSug() { sugBox.classList.remove('on'); sugItems = []; sugIdx = -1; }
function drawSug() {
  if (!sugItems.length || !sugFor) return hideSug();
  const r = sugFor.getBoundingClientRect();
  const host = sugFor.closest('.addr, .sbox') || sugFor;
  const hr = host.getBoundingClientRect();
  sugBox.style.left = hr.left + 'px'; sugBox.style.top = (hr.bottom + 4) + 'px'; sugBox.style.width = hr.width + 'px';
  const icn = { search: 'search', history: 'clock', bookmark: 'star', url: 'link' };
  sugBox.innerHTML = sugItems.map((x, i) => `<button data-s="${i}" style="${i === sugIdx ? 'background:var(--accent-soft)' : ''}">${ic(icn[x.kind] || 'search')}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.text)}${x.url && x.url !== x.text ? ` <span style="color:var(--muted);font-size:11px">— ${esc(x.url)}</span>` : ''}</span></button>`).join('');
  sugBox.classList.add('on');
}
function bindSuggest(inp, go) {
  let t = null;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    const q = inp.value;
    t = setTimeout(async () => {
      sugFor = inp;
      const list = q.trim() ? await B.call('br:suggest', q) : [];
      if (inp.value !== q) return;
      sugItems = [{ kind: isUrlLike(q.trim()) ? 'url' : 'search', text: q.trim(), url: '' }, ...list.filter(x => x.text !== q.trim())].filter(x => x.text);
      sugIdx = -1; drawSug();
    }, 120);
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && sugItems.length) { e.preventDefault(); sugIdx = (sugIdx + 1) % sugItems.length; drawSug(); }
    else if (e.key === 'ArrowUp' && sugItems.length) { e.preventDefault(); sugIdx = (sugIdx - 1 + sugItems.length) % sugItems.length; drawSug(); }
    else if (e.key === 'Enter') { e.preventDefault(); const x = sugItems[sugIdx]; go(x ? (x.url || x.text) : inp.value); hideSug(); }
    else if (e.key === 'Escape') { hideSug(); if (inp.id === 'url') { inp.value = cur.url; inp.blur(); } }
  });
  inp.addEventListener('blur', () => setTimeout(hideSug, 150));
}
sugBox.addEventListener('mousedown', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  e.preventDefault();
  const x = sugItems[+b.dataset.s];
  if (x) { const inp = sugFor; if (inp === $('#url')) { goTyped(x.url || x.text); inp.blur(); } else { goTyped(x.url || x.text); inp.value = ''; } }
});

// ---------- choix rapide du format  ----------
const fmtT = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
let qsCtx = null;
function closeQuick() { $('#qs').classList.remove('on'); qsCtx = null; }
$('#qsX').onclick = closeQuick;
$('#qs').addEventListener('mousedown', e => { if (e.target.id === 'qs') closeQuick(); });

// ---- options avancées (dans le panneau, sans quitter la page) ----
let qsDefaults = null;
async function qsAdvInit(name) {
  qsDefaults = qsDefaults || await B.call('br:defaults');
  $('#qaName').value = name || '';
  $('#qaDir').value = ''; $('#qaDir').placeholder = 'automatique (' + (qsDefaults.categorize ? 'classé par catégorie' : qsDefaults.dir) + ')';
  $('#qaPaused').checked = false; $('#qaSched').checked = false; $('#qaSpeed').value = 0;
  $('#qsAdv').style.display = 'none'; $('#qsMore').textContent = "Plus d'options…";
}
$('#qsMore').onclick = () => { const on = $('#qsAdv').style.display === 'none'; $('#qsAdv').style.display = on ? '' : 'none'; $('#qsMore').textContent = on ? "Moins d'options" : "Plus d'options…"; };
$('#qaPick').onclick = async () => { const d = await B.call('br:pickDir', $('#qaDir').value); if (d) $('#qaDir').value = d; };
function qsOpts() {
  return { name: $('#qaName').value.trim() || null, dir: $('#qaDir').value.trim(), startNow: !$('#qaPaused').checked, schedule: $('#qaSched').checked, speedLimit: +$('#qaSpeed').value || 0 };
}
async function qsAdd(o, label) {
  const tab = qsCtx?.tab || cur;
  const op = qsOpts();
  const r = await B.call('br:quickAdd', { ...o, ...op, name: op.name || null, title: o.title || op.name || (tab && tab.title) || null, incognito: tab?.incognito });
  closeQuick();
  toast(`Ajouté à DrYAE${label ? ' : ' + label : ''}`, { label: 'Voir', fn: () => B.call('br:openMain') });
  return r;
}
function qsShow(title, meta, thumb) {
  $('#qsTitle').textContent = title || 'Téléchargement';
  $('#qsMeta').textContent = meta || '';
  if (thumb) { $('#qsThumb').src = thumb; $('#qsThumb').style.display = ''; } else $('#qsThumb').style.display = 'none';
  $('#qs').classList.add('on');
}
const KLAB = { video: 'vidéo', audio: 'audio', hls: 'flux', file: 'fichier', dash: 'flux DASH' };

// ---- panneau vidéo : identique sur tous les sites ----
// 1) yt-dlp sur la page (YouTube et ~1800 sites) ; 2) sinon yt-dlp sur la vidéo trouvée dans la page ; 3) fichiers détectés
async function openQuick(tab, info = {}) {
  const page = info.page || tab.url;
  const detected = (tab.media || []).filter(m => m.kind !== 'subtitle' && m.kind !== 'dash');
  const src = info.src && /^https?:/.test(info.src) ? info.src : '';
  qsCtx = { url: page, page, tab };
  $('#qsTitleH').textContent = 'Choisir un format';
  qsShow(info.title || tab.title || 'Vidéo', 'Analyse de la vidéo…', '');
  await qsAdvInit((info.title || tab.title || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120));
  $('#qsBody').innerHTML = '<div class="spin"></div>';
  $('#qsBody').onclick = null;
  const ctx = qsCtx;
  let v = null, target = page, err = '';
  const r1 = await B.call('br:ytInspect', page);
  if (qsCtx !== ctx) return;
  if (r1.ok && !r1.v.playlist && (r1.v.hasVideo || r1.v.duration || r1.v.heights.length)) v = r1.v;
  else if (r1.ok && r1.v.playlist) { closeQuick(); return B.call('br:download', { url: page, kind: 'ytdl', page, incognito: tab.incognito }); }
  else err = r1.ok ? '' : r1.error;
  if (!v) {
    const cand = src || (detected.find(m => m.kind === 'hls') || detected.find(m => m.kind === 'video') || detected.find(m => m.kind === 'audio') || {}).url;
    if (cand) {
      $('#qsMeta').textContent = 'Analyse du fichier vidéo de la page…';
      const r2 = await B.call('br:ytInspect', cand, page);
      if (qsCtx !== ctx) return;
      if (r2.ok && !r2.v.playlist) { v = r2.v; target = cand; v.title = info.title || tab.title || v.title; }
    }
  }
  const files = detected.slice(0, 8);
  let html = '';
  if (v) {
    $('#qsTitle').textContent = v.title || info.title || tab.title;
    $('#qsMeta').textContent = [v.uploader, (v.duration || info.duration) ? fmtT(v.duration || info.duration) : ''].filter(Boolean).join(' · ');
    if (v.thumbnail) { $('#qsThumb').src = v.thumbnail; $('#qsThumb').style.display = ''; }
    if (!$('#qaName').value) $('#qaName').value = (v.title || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120);
    const fz = b => (b > 0 ? fmt(b) : '');
    const dur = v.duration || info.duration || 0;
    const mp3 = k => (dur ? fmt(dur * k * 125) : '');
    const hs = v.heights.length ? v.heights : [{ h: 0, size: 0 }];
    const lab = h => (h >= 2160 ? '4K' : h >= 1440 ? '2K' : h >= 720 ? 'HD' : '');
    if (v.hasVideo !== false) html += `<div class="qsec">Vidéo · MP4</div><div class="qgrid">${hs.slice(0, 8).map((h, i) => `<button class="qopt ${i === 0 ? 'best' : ''}" data-m="video" data-q="${h.h || 'best'}"><b>${h.h ? h.h + 'p' : 'Meilleure qualité'} ${lab(h.h) ? `<span>${lab(h.h)}</span>` : ''}</b><span>${fz(h.size)}</span></button>`).join('')}</div>`;
    html += `<div class="qsec">Audio</div><div class="qgrid">
      <button class="qopt best" data-m="audio" data-f="mp3" data-b="320"><b>MP3 haute qualité</b><span>320 kb/s ${mp3(320)}</span></button>
      <button class="qopt" data-m="audio" data-f="mp3" data-b="192"><b>MP3</b><span>192 kb/s ${mp3(192)}</span></button>
      <button class="qopt" data-m="audio" data-f="mp3" data-b="128"><b>MP3 classique</b><span>128 kb/s ${mp3(128)}</span></button>
      <button class="qopt" data-m="audio" data-f="m4a"><b>M4A</b><span>sans réencodage ${fz(v.audioSize)}</span></button></div>`;
  } else {
    $('#qsMeta').textContent = files.length ? '' : (err || 'Aucune vidéo trouvée sur cette page');
  }
  if (files.length) {
    html += `<div class="qsec">Fichiers détectés sur la page</div><div class="qgrid">${files.map((m, i) => `<button class="qopt" data-file="${i}"><b>${esc(KLAB[m.kind] || m.kind)} ${esc((m.ext || '').toUpperCase())}</b><span>${m.size > 0 ? fmt(m.size) : esc((m.name || '').slice(0, 24))}</span></button>`).join('')}</div>`;
  }
  if (!v && !files.length) html += `<p class="hint">Lance la lecture de la vidéo, puis réessaie : DrYAE détecte les fichiers pendant la lecture.${err ? '<br>' + esc(err) : ''}</p>`;
  $('#qsBody').innerHTML = html;
  $('#qsBody').onclick = async e => {
    const f = e.target.closest('[data-file]');
    if (f) { const m = files[+f.dataset.file]; return qsAdd({ kind: m.kind === 'hls' ? 'hls' : 'http', url: m.url, page, name: $('#qaName').value.trim() ? $('#qaName').value.trim() + (m.kind === 'hls' ? '' : '.' + (m.ext || 'mp4')) : m.name }, (KLAB[m.kind] || 'fichier')); }
    const b = e.target.closest('.qopt'); if (!b || !v) return;
    const o = { kind: 'ytdl', url: target, page, title: v.title, thumbnail: v.thumbnail, duration: v.duration || info.duration || 0, mode: b.dataset.m, quality: b.dataset.q || 'best', audioFormat: b.dataset.f || 'mp3', audioBitrate: b.dataset.b || '320' };
    qsAdd(o, o.mode === 'audio' ? (o.audioFormat.toUpperCase() + (o.audioFormat === 'mp3' ? ' ' + o.audioBitrate + ' kb/s' : '')) : (o.quality === 'best' ? 'MP4' : o.quality + 'p'));
  };
}
async function openQuickYt(tab, page, info) { return openQuick(tab, { ...info, page }); }

// ---- fichier simple (lien, téléchargement intercepté) : on reste dans le navigateur ----
async function openQuickFile(o) {
  const tab = cur;
  qsCtx = { url: o.url, page: o.page, tab };
  $('#qsTitleH').textContent = 'Télécharger un fichier';
  const name = o.name || decodeURIComponent((o.url.split(/[?#]/)[0].split('/').pop() || 'fichier'));
  qsShow(name, o.size > 0 ? fmt(o.size) : 'Calcul de la taille…', '');
  await qsAdvInit(name);
  $('#qsAdv').style.display = '';
  $('#qsMore').textContent = "Moins d'options";
  $('#qsBody').innerHTML = `<div class="hint mono" style="word-break:break-all;margin-top:6px">${esc(o.url)}</div>
    <div class="row" style="margin-top:14px;gap:8px"><button class="btn primary" id="qfGo">${ic('dl')}Télécharger</button>${/\.(mp4|webm|mkv|mov|m4v|mp3|m4a|ogg|wav|flac)(\?|$)/i.test(o.url) ? `<button class="btn" id="qfMp3">Convertir en MP3</button>` : ''}<button class="btn" id="qfLater">Ajouter en pause</button></div>`;
  if (!(o.size > 0)) B.call('br:sizes', { urls: [o.url], page: o.page, incognito: o.incognito }).then(r => { if (qsCtx && qsCtx.url === o.url) $('#qsMeta').textContent = r[0] && r[0].size > 0 ? fmt(r[0].size) + (r[0].type ? ' · ' + r[0].type : '') : 'Taille inconnue'; }).catch(() => {});
  const go = paused => { if (paused) $('#qaPaused').checked = true; qsAdd({ kind: o.kind === 'hls' ? 'hls' : 'http', url: o.url, page: o.page, headers: o.headers, allowPage: o.allowPage }, $('#qaName').value.trim() || name); };
  $('#qfGo').onclick = () => go(false);
  $('#qfLater').onclick = () => go(true);
  const mp3 = $('#qfMp3');
  if (mp3) mp3.onclick = () => qsAdd({ kind: 'ytdl', url: o.url, page: o.page, headers: o.headers, mode: 'audio', audioFormat: 'mp3', audioBitrate: '320', title: ($('#qaName').value.trim() || name).replace(/\.\w+$/, '') }, 'MP3');
}
B.on('quick-file', o => { if (!o.incognito && cur?.incognito) o.incognito = true; openQuickFile(o); });
B.on('quick-video', ({ page, wcId }) => { const t = (wcId && tabByWc(wcId)) || cur; openQuick(t, { page: page || t.url, title: t.title }); });

const pending = new Map();
function flushPending(tab) { const l = pending.get(tab.wcId); if (!l) return; pending.delete(tab.wcId); l.forEach(onMedia); }
function onMedia(m) {
  const t = tabByWc(m.wcId);
  if (!t) { if (!pending.has(m.wcId)) pending.set(m.wcId, []); pending.get(m.wcId).push(m); return; }
  if (t.media.some(x => x.url === m.url)) return;
  // un flux HLS « maître » masque ses sous-playlists
  if (m.kind === 'hls' && t.media.some(x => x.kind === 'hls' && m.url.split('?')[0].replace(/[^/]+$/, '') === x.url.split('?')[0].replace(/[^/]+$/, ''))) return;
  t.media.unshift(m);
  if (t === cur) { updToolbar(); if (panel === 'media') drawMedia(); }
}
B.on('media', onMedia);
B.on('restore-session', async sess => {
  await ready;
  const made = sess.tabs.map(t => newTab(t.url, { background: true, lazy: true, title: t.title }));
  if (made.length) select(made[Math.min(sess.active || 0, made.length - 1)]);
});
B.on('theme', t => applyTheme(t));
B.on('media-reset', ({ wcId }) => {
  pending.delete(wcId);
  const t = tabByWc(wcId); if (!t) return;
  t.media = []; t.blocked = 0;
  if (t === cur) { updToolbar(); if (panel === 'media') drawMedia(); }
});
B.on('adblock:count', ({ wcId, n }) => { const t = tabByWc(wcId); if (t) { t.blocked = n; if (t === cur) updToolbar(); } });
B.on('popup-blocked', ({ wcId, url }) => { const t = tabByWc(wcId); toast('Fenêtre pop-up bloquée', { label: 'Ouvrir', fn: () => newTab(url, { incognito: t?.incognito }) }); });
B.on('grab-links', ({ wcId }) => { const t = tabByWc(wcId); if (t) { select(t); grabLinks(t); } });
B.on('login', ({ id, host, realm }) => {
  $('#loginHost').textContent = `${host}${realm ? ' — ' + realm : ''}`;
  $('#lgU').value = ''; $('#lgP').value = '';
  $('#loginModal').classList.add('on'); $('#lgU').focus();
  const reply = ok => { $('#loginModal').classList.remove('on'); B.call('br:loginReply', ok ? { id, user: $('#lgU').value, pass: $('#lgP').value, save: $('#lgS').checked, host } : { id }); };
  $('#lgOk').onclick = () => reply(true); $('#lgCancel').onclick = () => reply(false);
  $('#lgP').onkeydown = e => { if (e.key === 'Enter') reply(true); };
});
setInterval(() => cur && updToolbar(), 1000);

const ready = (async () => {
  CFG = await B.call('br:settings');
  STORE = await B.call('br:store');
  applyTheme(CFG.theme || {});
})();


// ---------- mots de passe ----------
let pwOffer = null;
B.on('pw-offer', o => {
  const t = tabByWc(o.wcId);
  pwOffer = o;
  let host = o.origin; try { host = new URL(o.origin).host; } catch {}
  $('#pwBar span').innerHTML = `${o.update ? 'Mettre à jour' : 'Enregistrer'} le mot de passe${o.username ? ' de <b>' + esc(o.username) + '</b>' : ''} pour <b>${esc(host)}</b> ?`;
  $('#pwSave').textContent = o.update ? 'Mettre à jour' : 'Enregistrer';
  $('#pwBar').classList.add('on');
  if (t && t !== cur) select(t);
});
const pwReply = action => { if (pwOffer) B.call('br:pwSave', { wcId: pwOffer.wcId, action }); pwOffer = null; $('#pwBar').classList.remove('on'); if (action === 'save') toast('Mot de passe enregistré'); };
$('#pwSave').onclick = () => pwReply('save');
$('#pwNever').onclick = () => pwReply('never');
$('#pwLater').onclick = () => pwReply('dismiss');

async function drawPasswords(q = '') {
  const d = await B.call('br:pwList');
  $('#pTitle').textContent = 'Mots de passe';
  const f = q.toLowerCase();
  const list = d.logins.filter(l => !f || (l.origin + ' ' + l.username).toLowerCase().includes(f));
  $('#pBody').innerHTML = `
    <label class="check" style="margin:0 0 6px"><input type="checkbox" id="pwOfferOn" ${d.settings.offer !== false ? 'checked' : ''}> Proposer d'enregistrer les mots de passe</label>
    <label class="check" style="margin:0 0 10px"><input type="checkbox" id="pwFillOn" ${d.settings.autofill !== false ? 'checked' : ''}> Connexion automatique (remplir les identifiants)</label>
    <input type="text" id="pwQ" placeholder="Rechercher un site ou un identifiant" value="${esc(q)}" style="margin-bottom:8px">
    ${list.length ? list.map((l, i) => `<div class="hrow" style="cursor:default"><div class="t"><b>${esc(l.origin.replace(/^https?:\/\//, ''))}</b><span>${esc(l.username || '(sans identifiant)')} · <span class="pwv" data-v="${i}">••••••••</span></span></div>
      <button class="icon-btn" title="Afficher" data-show="${i}">${ic('eye')}</button><button class="icon-btn" title="Copier" data-copy="${i}">${ic('copy')}</button><button class="icon-btn" title="Supprimer" data-del="${i}">${ic('trash')}</button></div>`).join('')
      : '<p class="hint">Aucun mot de passe. Connecte-toi à un site : DrYAE proposera de l\'enregistrer.</p>'}
    <div class="sect" style="margin-top:16px">Ajouter</div>
    <input type="text" id="pwNS" placeholder="site (exemple.com)" style="margin-bottom:6px"><input type="text" id="pwNU" placeholder="identifiant" style="margin-bottom:6px"><input type="password" id="pwNP" placeholder="mot de passe" style="margin-bottom:6px">
    <button class="btn sm" id="pwAdd">Enregistrer</button>
    ${d.never.length ? `<div class="sect" style="margin-top:16px">Jamais enregistrés</div>${d.never.map((o, i) => `<div class="hrow" style="cursor:default"><div class="t"><b>${esc(o.replace(/^https?:\/\//, ''))}</b></div><button class="icon-btn" data-unnever="${i}">${ic('x')}</button></div>`).join('')}` : ''}
    <p class="hint" style="margin-top:12px">Les mots de passe sont chiffrés par Windows sur ce PC.</p>`;
  const B2 = $('#pBody');
  $('#pwOfferOn').onchange = e => B.call('br:pwSettings', { offer: e.target.checked });
  $('#pwFillOn').onchange = e => B.call('br:pwSettings', { autofill: e.target.checked });
  const qi = $('#pwQ'); qi.oninput = () => { clearTimeout(qi.t); qi.t = setTimeout(() => { drawPasswords(qi.value).then(() => { const x = $('#pwQ'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }); }, 250); };
  B2.onclick = async e => {
    const g = a => e.target.closest('[data-' + a + ']');
    let b;
    if ((b = g('show'))) { const l = list[+b.dataset.show]; const el = B2.querySelector(`.pwv[data-v="${b.dataset.show}"]`); el.textContent = el.textContent.startsWith('•') ? await B.call('br:pwReveal', l) : '••••••••'; }
    if ((b = g('copy'))) { navigator.clipboard.writeText(await B.call('br:pwReveal', list[+b.dataset.copy])); toast('Mot de passe copié'); }
    if ((b = g('del'))) { if (confirm('Supprimer ce mot de passe ?')) { await B.call('br:pwDelete', list[+b.dataset.del]); drawPasswords(q); } }
    if ((b = g('unnever'))) { await B.call('br:pwUnnever', d.never[+b.dataset.unnever]); drawPasswords(q); }
    if (e.target.id === 'pwAdd') {
      try { await B.call('br:pwAdd', { origin: $('#pwNS').value.trim(), username: $('#pwNU').value, password: $('#pwNP').value }); toast('Mot de passe enregistré'); drawPasswords(q); } catch (er) { toast(String(er.message || er).replace(/^.*Error: /, '')); }
    }
  };
}

// ---------- saisie automatique ----------
const AF = [['givenName', 'Prénom'], ['familyName', 'Nom'], ['email', 'E-mail'], ['tel', 'Téléphone'], ['address', 'Adresse'], ['postalCode', 'Code postal'], ['city', 'Ville'], ['country', 'Pays'], ['company', 'Société']];
async function drawAutofill() {
  const d = await B.call('br:afGet');
  const p = d.profile || {};
  $('#pTitle').textContent = 'Saisie automatique';
  $('#pBody').innerHTML = `<label class="check" style="margin:0 0 10px"><input type="checkbox" id="afOn" ${d.enabled ? 'checked' : ''}> Proposer de remplir les formulaires avec ces informations</label>
    ${AF.map(([k, l]) => `<label>${l}</label><input type="text" data-af="${k}" value="${esc(p[k] || '')}">`).join('')}
    <div class="row" style="margin-top:12px"><button class="btn sm primary" id="afSave">Enregistrer</button><button class="btn sm" id="afClear">Effacer</button></div>
    <p class="hint" style="margin-top:10px">Quand tu cliques dans un champ « nom », « e-mail », « adresse »… d'un formulaire, DrYAE propose « Remplir avec mon profil ».</p>`;
  const save = async () => { const prof = {}; $$('#pBody [data-af]').forEach(i => { if (i.value.trim()) prof[i.dataset.af] = i.value.trim(); }); await B.call('br:afSet', { enabled: $('#afOn').checked, profile: prof }); toast('Saisie automatique enregistrée'); };
  $('#afSave').onclick = save;
  $('#afOn').onchange = save;
  $('#afClear').onclick = async () => { await B.call('br:afSet', { enabled: false, profile: {} }); drawAutofill(); };
}

// ---------- extensions ----------
async function drawExtensions() {
  const list = await B.call('br:extList');
  $('#pTitle').textContent = 'Extensions';
  $('#pBody').innerHTML = `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px"><button class="btn sm primary" id="exStore">${ic('puzzle')}Chrome Web Store</button><button class="btn sm" id="exDir">Charger un dossier…</button></div>
    ${list.length ? list.map((x, i) => `<div class="hrow" style="cursor:default">${x.icon ? `<img src="${esc(x.icon)}" style="width:24px;height:24px;border-radius:5px" alt="">` : `<span class="fav" style="width:24px;height:24px">${esc((x.name || '?')[0])}</span>`}<div class="t"><b>${esc(x.name)}</b><span>${esc(x.version)} · ${esc((x.description || '').slice(0, 80))}</span></div><button class="icon-btn" title="Supprimer" data-rmx="${i}">${ic('trash')}</button></div>`).join('')
      : '<p class="hint">Aucune extension. Ouvre le Chrome Web Store, choisis une extension puis clique sur « Ajouter à Chrome ».</p>'}
    <p class="hint" style="margin-top:12px">Les icônes des extensions apparaissent à droite de la barre d'adresse. La plupart des extensions courantes fonctionnent (bloqueurs, mode sombre, traducteurs, gestionnaires de mots de passe…) ; certaines fonctions avancées de Chrome peuvent manquer.</p>`;
  $('#exStore').onclick = () => newTab('https://chromewebstore.google.com/');
  $('#exDir').onclick = async () => { try { const r = await B.call('br:extLoadDir'); if (r) { toast('Extension ajoutée'); drawExtensions(); } } catch (e) { toast(String(e.message || e).replace(/^.*Error: /, '')); } };
  $('#pBody').onclick = async e => { const b = e.target.closest('[data-rmx]'); if (!b) return; const x = list[+b.dataset.rmx]; if (!confirm(`Supprimer l'extension « ${x.name} » ?`)) return; await B.call('br:extRemove', x.id); drawExtensions(); };
}
// demandes des extensions (chrome.tabs.create / update / remove)
B.on('ext-create-tab', async ({ reqId, url, active }) => {
  await ready;
  const t = newTab(url || '', { background: active === false });
  if (!url) ensureWebview(t);
  for (let i = 0; i < 100 && !t.wcId; i++) { await new Promise(r => setTimeout(r, 100)); try { if (t.wv) t.wcId = t.wv.getWebContentsId(); } catch {} }
  B.call('br:extTabCreated', { reqId, wcId: t.wcId || null });
});
B.on('ext-select-tab', ({ wcId }) => { const t = tabByWc(wcId); if (t) select(t); });
B.on('ext-remove-tab', ({ wcId }) => { const t = tabByWc(wcId); if (t) closeTab(t); });
