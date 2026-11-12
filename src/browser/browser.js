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

// petite fenêtre de question (même rôle que dans le Gestionnaire) : { title, text, check, checked, buttons:[{v,label,primary,danger}] }
function askBox(o) {
  return new Promise(res => {
    const m = $('#askDlg');
    $('#askH').textContent = o.title || ''; $('#askP').textContent = o.text || '';
    $('#askCk').style.display = o.check ? '' : 'none'; $('#askCt').textContent = o.check || ''; $('#askC').checked = !!o.checked;
    const btns = o.buttons || [{ v: 'ok', label: o.ok || 'OK', primary: true, danger: o.danger }];
    $('#askF').innerHTML = `<button class="btn" data-v="">${esc(o.cancel || 'Annuler')}</button>` + btns.map(b => `<button class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}" data-v="${b.v}">${esc(b.label)}</button>`).join('');
    const done = v => { m.classList.remove('on'); m.onkeydown = null; $('#askF').onclick = null; res(v ? { value: v, checked: $('#askC').checked } : null); };
    $('#askF').onclick = e => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); };
    m.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); done(''); } };
    m.classList.add('on');
    setTimeout(() => $('#askF .primary')?.focus(), 30);
  });
}
// doublon détecté par le Gestionnaire : même fenêtre que dans le Gestionnaire
async function askDup(d) {
  const gone = d.status === 'done' && !d.file;
  const st = gone ? "le fichier n'existe plus sur l'ordinateur" : d.status === 'done' ? 'déjà téléchargé' : 'déjà dans la liste';
  const buttons = gone ? [{ v: 'overwrite', label: 'Télécharger à nouveau', primary: true }]
    : [...(d.file ? [{ v: 'open', label: 'Ouvrir le fichier' }] : []), { v: 'overwrite', label: 'Remplacer' }, { v: 'rename', label: 'Télécharger quand même', primary: true }];
  const r = await askBox({ title: 'Déjà téléchargé', text: `« ${d.name} » — ${T(st)}. ${T('Que veux-tu faire ?')}`, check: gone ? '' : 'Toujours faire ce choix', buttons });
  if (!r) return null;
  if (r.value === 'open') { B.call('br:openDl', d.id); return null; }
  if (r.checked && !gone) B.call('br:setDupDefault', r.value);
  return r.value;
}
// ajout rapide avec gestion des doublons : jamais « Ajouté » si rien n'a été ajouté
async function addDl(o) {
  let r = await B.call('br:quickAdd', o);
  if (r && r.duplicate) {
    const a = await askDup(r.duplicate);
    if (!a) return null;
    r = await B.call('br:quickAdd', { ...o, dupAction: a });
  }
  return r;
}

let CFG = {}, STORE = { bookmarks: [], history: [] }, tabs = [], cur = null, seq = 0, panel = null;
const QUICK = [
  { t: 'Google', u: 'https://www.google.com' }, { t: 'YouTube', u: 'https://www.youtube.com' }, { t: 'Wikipédia', u: 'https://fr.wikipedia.org' },
  { t: 'Archive.org', u: 'https://archive.org' }, { t: 'GitHub', u: 'https://github.com' }, { t: 'SourceForge', u: 'https://sourceforge.net' },
];

const ONLINE = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|twitch\.tv|soundcloud\.com|bilibili\.com|reddit\.com|rumble\.com|odysee\.com|bandcamp\.com|mixcloud\.com|streamable\.com|vk\.com|ok\.ru|archive\.org|ted\.com|arte\.tv|france\.tv)$/i;
const isOnline = u => { try { const x = new URL(u); return ONLINE.test(x.hostname) && x.pathname.length > 1; } catch { return false; } };
function isUrlLike(s) { return /^(https?:\/\/|file:\/\/|about:|dryae:\/\/|chrome-extension:\/\/|view-source:)/i.test(s) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s) || /^localhost(:\d+)?/.test(s); }
async function toUrl(s) {
  s = s.trim();
  if (!s) return '';
  if (/^magnet:/i.test(s)) return s;
  if (isUrlLike(s)) return /^[a-z-]+:\/\//i.test(s) || /^(about|view-source):/i.test(s) ? s : 'https://' + s;
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
  
  wv.addEventListener('did-navigate', e => { tab.url = e.url; tab.tr = null; tab.lit = false; tab.scanLang = null; updTab(tab); if (!tab.incognito) B.call('br:history', { url: e.url, title: tab.title }); });
  wv.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) { tab.url = e.url; updTab(tab); } });
  wv.addEventListener('page-title-updated', e => { tab.title = e.title; updTab(tab); if (!tab.incognito) B.call('br:history', { url: tab.url, title: e.title }); });
  // icône : récupérée par DrYAE (le site interdit souvent qu'on l'affiche depuis le navigateur), sinon /favicon.ico
  const getFav = async cands => {
    if (!/^https?:/.test(tab.url || '')) return;
    const u = tab.url, f = await B.call('br:fav', cands || [], u, !!tab.incognito).catch(() => '');
    if (!f || tab.url !== u) return;
    tab.fav = f; updTab(tab);
    if (!tab.incognito) B.call('br:history', { url: tab.url, title: tab.title, fav: f, favOnly: true });
  };
  wv.addEventListener('page-favicon-updated', e => { tab._favAsked = true; getFav(e.favicons); });
  wv.addEventListener('did-stop-loading', () => { if (!tab._favAsked || !tab.fav) { tab._favAsked = true; getFav([]); } });
  wv.addEventListener('did-start-navigation', e => { if (e.isMainFrame && !e.isInPlace && hostOf(e.url) !== hostOf(tab.url)) { tab._favAsked = false; tab.fav = ''; } });
  wv.addEventListener('did-fail-load', e => {
    if (!e.isMainFrame || e.errorCode === -3) return;
    const msg = { '-105': "Adresse introuvable. Vérifie l'orthographe ou ta connexion.", '-106': 'Pas de connexion internet.', '-102': 'Connexion refusée.', '-118': 'Le site met trop de temps à répondre.', '-200': 'Certificat du site invalide.', '-20': 'Bloqué par le bloqueur de publicités.' }[e.errorCode] || e.errorDescription;
    wv.executeJavaScript(`document.documentElement.innerHTML = ${JSON.stringify(`<body style="font:15px Segoe UI,sans-serif;background:#0d0f14;color:#e7e9ef;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="max-width:520px;text-align:center"><h2>${esc(T("Impossible d'ouvrir la page"))}</h2><p style="color:#8a91a3">${esc(T(msg))}</p><p style="color:#5b6274;font-size:12px;word-break:break-all">${esc(e.validatedURL)}</p><button onclick="location.href=${esc(JSON.stringify(e.validatedURL))}" style="font:600 14px Segoe UI,sans-serif;padding:9px 22px;border-radius:8px;border:0;background:#7c3aed;color:#fff;cursor:pointer">${esc(T('Réessayer'))}</button>${/chromewebstore\.google\.com/.test(e.validatedURL) ? `<p style="color:#8a91a3;font-size:13px;margin-top:18px">${esc(T("Vous pouvez aussi installer une extension avec son lien : menu ⋮ → Extensions → Installer avec un lien."))}</p>` : ''}</div></body>`)}`).catch(() => {});
  });
  wv.addEventListener('ipc-message', e => {
    const a = e.args[0];
    if (e.channel === 'dryae-pagedown') return closeFloating();
    if (e.channel === 'dryae-cookie') { tab.cookieRefused = a; return; }
    if (e.channel === 'dryae-reader') { tab.reader = !!a; if (tab === cur) updToolbar(); return; }
    if (e.channel === 'dryae-scanmodel') return offerScanModel(a);
    if (e.channel === 'dryae-video') openQuick(tab, a || {});
    else if (e.channel === 'dryae-nav') navStep(a);
    else if (e.channel === 'dryae-tr') { tab.tr = a; if (tab === cur) drawTrBar(); }
    else if (e.channel === 'dryae-lights') { tab.lit = !!a; if (tab === cur) drawMods(); }
    else if (e.channel === 'dryae-night') { tab.night = !!a; }
    else if (e.channel === 'dryae-vstate') { tab.video = a || {}; }
    else if (e.channel === 'dryae-scanlang') { tab.scanLang = a; if (tab === cur && typeof POP !== 'undefined' && POP.kind === 'scan') popRender(); }
    else if (e.channel === 'dryae-shot') { B.call('br:shot', tab.wcId, a).then(f => f && toast('Capture enregistrée dans Images', { label: 'Ouvrir', fn: () => B.call('br:showItem', f) })); }
  });
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
  hideBmEdit();
  if (tab.url && document.activeElement === $('#url')) $('#url').blur();
  if (tab.wcId) B.call('br:selectTab', tab.wcId);
  if (tab.lazy) { tab.lazy = false; navigate(tab, tab.url); }
  tabs.forEach(t => t.el.classList.toggle('on', t === tab));
  showView(tab);
  updToolbar(); drawTrBar(); drawMods();
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
  if (tab.url) { closedTabs.push({ url: tab.url, title: tab.title, fav: tab.fav, incognito: tab.incognito }); if (closedTabs.length > 25) closedTabs.shift(); B.call('br:closed', closedTabs.filter(c => !c.incognito)); }
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
  const intern = /^dryae:/.test(t.url || '');
  $('#lock').classList.toggle('no', !/^https:/.test(t.url) && !intern); $('#lock').classList.toggle('int', intern);
  $('#lockIc').setAttribute('href', intern ? '#i-dryae' : '#i-lock');
  const wv = t.wv;
  let canBack = false, canFwd = false;
  try { canBack = !!(wv && t.wcId && wv.canGoBack()); canFwd = !!(wv && t.wcId && wv.canGoForward()); } catch {}
  $('#bBack').disabled = !canBack && !t.url; $('#bFwd').disabled = !canFwd;
  $('#reloadIc').setAttribute('href', t.loading ? '#i-stop' : '#i-reload');
  $('#loadbar').style.width = t.loading ? '70%' : '0';
  const bm = !!t.url && STORE.bookmarks.some(b => b.url === t.url);
  $('#starIc').setAttribute('href', bm ? '#i-star-f' : '#i-star');
  $('#bStar').classList.toggle('on', bm);
  // médias
  const vids = t.media.filter(m => m.kind !== 'subtitle' && !t.hidden?.has(m.url));
  const online = isOnline(t.url);
  const nDl = vids.length + (online ? 1 : 0);
  $('#dlN').textContent = nDl > 99 ? '99+' : nDl; $('#dlN').classList.toggle('on', nDl > 0);
  $('#bDrYAE').classList.toggle('has', nDl > 0);
  // bloqueur
  const wl = typeof adModeOf === 'function' ? adModeOf(hostOf(t.url)) === 'none' : CFG.whitelist?.some(w => hostOf(t.url) === w || hostOf(t.url).endsWith('.' + w));
  if (typeof drawExtTab === 'function') drawExtTab();
  const adOn = modOn('adblock');
  $('#bShield').style.display = CFG.mods?.adblock?.installed !== false && CFG.mods?.adblock?.pinned !== false ? '' : 'none';
  $('#bShield').classList.toggle('on', adOn && !wl);
  $('#shieldN').textContent = t.blocked > 99 ? '99+' : t.blocked; $('#shieldN').classList.toggle('on', adOn && !wl && t.blocked > 0);
  const cap = modOn('capture');
  $('#bDrYAE').style.display = cap && CFG.mods?.capture?.pinned !== false ? '' : 'none';
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
// boutons latéraux de la souris (précédent / suivant) : la même pression peut arriver deux fois (page + fenêtre)
let navAt = 0;
function navStep(d) { const n = Date.now(); if (n - navAt < 350) return; navAt = n; if (d < 0) $('#bBack').click(); else $('#bFwd').click(); }
B.on('app-cmd', c => { if (c === 'browser-backward') navStep(-1); else if (c === 'browser-forward') navStep(1); else if (c === 'browser-refresh') cur.wv?.reload(); else if (c === 'browser-home') navigate(cur, CFG.home || ''); });
// Ctrl + molette dans la page : zoom de l'onglet
B.on('wheel-zoom', ({ wcId, dir }) => { const t = tabByWc(wcId); if (t && t === cur) zoom(dir); });
// double-clic dans l'espace vide de la barre d'onglets : nouvel onglet ; clic du milieu sur « + » : idem
$('#tabs').addEventListener('dblclick', e => { if (e.target === e.currentTarget) { const t = newTab(''); select(t); $('#url')?.focus(); } });
$('#tabs').addEventListener('auxclick', e => { if (e.button === 1 && e.target === e.currentTarget) { e.preventDefault(); const t = newTab(''); select(t); } });
// Ctrl + molette sur la barre d'onglets : passer d'un onglet à l'autre ; molette seule : défilement horizontal
$('#tabs').addEventListener('wheel', e => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth) { el.scrollLeft += e.deltaY || e.deltaX; e.preventDefault(); } }, { passive: false });
$('#bReload').onclick = () => { if (!cur.wv) return; cur.loading ? cur.wv.stop() : cur.wv.reload(); };
$('#bHome').onclick = () => showStart(cur);
$('#newTab').onclick = () => newTab();
$('#bDrYAE').onclick = () => togglePanel('media');
$('#bStar').onclick = () => starClick();

$('#bShield').onclick = e => popOpen('adblock', e.currentTarget);
// ---------- menu ⋮ (raccourcis à droite, sous-menus, zoom) ----------
const modOn = id => !!(CFG.mods && CFG.mods[id] && CFG.mods[id].on);
const MODS = [['adblock', 'Bloqueur de publicités', 'shield'], ['capture', 'Téléchargements par DrYAE', 'dl'], ['translate', 'Traducteur', 'translate'], ['scan', 'Traducteur de scans', 'scan'], ['lights', 'Lumières tamisées', 'bulb'], ['pip', "Image dans l'image", 'pip']];
function openPage(name, hash) { B.call('br:openPage', name, hash || ''); }
function pageCmd(cmd, extra = {}, tab = cur) { if (tab?.wv && tab.wcId && /^https?:/.test(tab.url)) tab.wv.send('dryae-cmd', { cmd, ...extra }); else toast('Ouvre une page web d\'abord'); }
function openDownloads() { if (modOn('capture')) B.call('br:openMain'); else togglePanel('nd', true); }
function mainMenu() {
  const zoomPct = cur && cur.zoom ? Math.round(Math.pow(1.2, cur.zoom) * 100) : 100;
  const web = /^https?:/.test(cur?.url || '');
  return [
    { label: 'Nouvel onglet', icon: 'plus', key: 'Ctrl+T', fn: () => newTab() },
    { label: 'Nouvel onglet privé', icon: 'mask', key: 'Ctrl+Maj+N', fn: () => newTab('', { incognito: true }) },
    '-',
    { label: 'Mots de passe et saisie automatique', icon: 'key', sub: () => [
      { label: 'Gestionnaire de mots de passe', icon: 'key', fn: () => openPage('passwords') },
      { label: 'Modes de paiement', icon: 'card', fn: () => openPage('passwords', 'cards') },
      { label: 'Adresses et coordonnées', icon: 'pin', fn: () => openPage('passwords', 'addresses') },
    ] },
    { label: 'Historique', icon: 'clock', sub: () => [
      { label: "Ouvrir l'historique", icon: 'clock', key: 'Ctrl+H', fn: () => openPage('history') },
      { label: "Rouvrir l'onglet fermé", icon: 'reload', key: 'Ctrl+Maj+T', fn: reopenClosed, disabled: !closedTabs.length },
      closedTabs.length ? '-' : null,
      closedTabs.length ? { title: 'Onglets fermés récemment' } : null,
      ...closedTabs.slice(-10).reverse().map(c => ({ label: c.title || c.url, img: c.fav, icon: 'link', fn: () => { closedTabs.splice(closedTabs.indexOf(c), 1); newTab(c.url, { incognito: c.incognito }); } })),
    ] },
    { label: 'Téléchargements', icon: 'dl', key: 'Ctrl+J', hl: true, fn: openDownloads },
    { label: 'Favoris', icon: 'star', sub: bmMenu },
    { label: 'Extensions', icon: 'puzzle', adv: true, sub: () => [
      { label: 'Gérer les extensions', icon: 'puzzle', key: 'Ctrl+Maj+A', fn: () => openPage('extensions') },
      { label: 'Boutique Chrome Web Store', icon: 'store', fn: () => newTab('https://chromewebstore.google.com/') },
      '-', { title: 'Extensions intégrées' },
      ...MODS.filter(([id]) => CFG.mods?.[id]?.installed !== false).map(([id, l, icon]) => ({ label: l, icon, check: modOn(id), fn: () => setModule(id, { enabled: !modOn(id) }) })),
    ] },
    { label: 'Effacer les données de navigation…', icon: 'trash', key: 'Ctrl+Maj+Suppr', fn: () => openPage('history', 'clear') },
    '-',
    { zoom: true, pct: zoomPct },
    '-',
    { label: 'Imprimer…', icon: 'print', key: 'Ctrl+P', fn: () => cur?.wcId && B.call('br:print', cur.wcId), disabled: !cur?.wcId },
    modOn('translate') && { label: cur?.tr && cur.tr.state !== 'restored' ? "Afficher l'original" : 'Traduire la page', icon: 'translate', key: 'Ctrl+Maj+E', fn: () => pageCmd('translate-page'), disabled: !web },
    { label: 'Rechercher dans la page…', icon: 'search', key: 'Ctrl+F', fn: () => openFind() },
    { label: cur?.reader ? 'Quitter le mode lecture' : 'Mode lecture', icon: 'file', key: 'F9', fn: () => readerMode(), disabled: !web },
    { label: 'Lire la page à voix haute', icon: 'sound', key: 'F8', fn: () => readAloud(), disabled: !web },
    { label: 'Enregistrer sous…', icon: 'save', key: 'Ctrl+S', fn: savePage, disabled: !cur?.wcId },
    { label: 'Outils supplémentaires', icon: 'tools', adv: true, sub: () => [
      modOn('capture') && { label: 'Extraire les liens de la page', icon: 'link', fn: () => grabLinks() },
      modOn('capture') && { label: 'Enregistrer la page avec DrYAE', icon: 'dl', fn: () => cur.url && B.call('br:download', { url: cur.url, page: cur.url, allowPage: true, incognito: cur.incognito }) },
      modOn('capture') && { label: 'Fichiers détectés sur cette page', icon: 'video', key: 'Ctrl+Maj+Y', fn: () => togglePanel('media', true) },
      !modOn('capture') && { label: 'Téléchargements du navigateur', icon: 'dl', fn: () => togglePanel('nd', true) },
      modOn('adblock') && { label: 'Masquer un élément de la page…', icon: 'eye', fn: () => pageCmd('picker'), disabled: !web },
      modOn('lights') && { label: 'Mode nuit sur ce site', icon: 'moon', check: !!cur?.night, fn: () => pageCmd('night'), disabled: !web },
      { label: CFG.ua === 'mobile' ? 'Passer en mode ordinateur' : 'Passer en mode mobile', icon: 'phone', fn: async () => { CFG = { ...CFG, ...(await B.call('br:setSettings', { ua: CFG.ua === 'mobile' ? 'desktop' : 'mobile' })) }; cur.wv?.reload(); } },
      { label: cur?.muted ? 'Réactiver le son de l\'onglet' : 'Couper le son de l\'onglet', icon: 'sound', key: 'Ctrl+M', fn: toggleMute, disabled: !cur?.wcId },
      { label: 'Ouvrir cette page dans Chrome', icon: 'link', fn: () => cur.url && B.call('br:openExternal', cur.url), disabled: !web },
      { label: "Copier l'adresse", icon: 'copy', fn: () => navigator.clipboard.writeText(cur.url) },
      { label: 'Code source de la page', icon: 'code', key: 'Ctrl+U', fn: viewSource, disabled: !web },
      { label: 'Outils de développement', icon: 'code', key: 'F12', fn: () => cur?.wcId && B.call('br:devtools', cur.wcId) },
    ] },
    '-',
    { label: 'Aide', icon: 'help', sub: () => [
      { label: 'Raccourcis clavier', icon: 'kbd', key: 'F1', fn: showShortcuts },
      { label: "Mode d'emploi", icon: 'help', fn: () => newTab('https://github.com/DrYAE-FPA/DrYAE/blob/main/docs/GUIDE.md') },
      { label: 'Donner mon avis', icon: 'star', fn: () => B.call('br:feedback') },
      { label: 'Signaler un problème…', icon: 'help', fn: reportProblem },
      { label: 'À propos de DrYAE', icon: 'dryae', fn: () => openPage('settings', 'about') },
    ] },
    { label: 'Profils', icon: 'user', adv: true, sub: profileMenu },
    { label: 'Paramètres', icon: 'gear', fn: () => openPage('settings') },
    { label: 'Quitter', icon: 'x', key: 'Ctrl+Maj+Q', fn: () => B.call('br:quit') },
  ];
}
// mode lecture et lecture à voix haute
async function readerMode(tab = cur) {
  if (!tab?.wcId || !/^https?:/.test(tab.url || '')) return toast('Ouvre une page web d\'abord');
  if (tab.reader) return pageCmd('reader', {}, tab);
  const article = await B.call('br:article', tab.wcId);
  if (!article) return toast('Pas d\'article à afficher sur cette page');
  pageCmd('reader', { article }, tab);
}
async function readAloud(tab = cur) {
  if (!tab?.wcId || !/^https?:/.test(tab.url || '')) return toast('Ouvre une page web d\'abord');
  const sel = await tab.wv.executeJavaScript('String(getSelection())').catch(() => '');
  if (sel && sel.trim()) return pageCmd('speak', { text: sel }, tab);
  const a = await B.call('br:article', tab.wcId);
  pageCmd('speak', { text: a?.text || await tab.wv.executeJavaScript('document.body.innerText').catch(() => ''), lang: a?.lang }, tab);
}
// profils : chacun a ses favoris, mots de passe, cookies, historique et téléchargements (fenêtre DrYAE séparée)
async function profileMenu() {
  const r = await B.call('br:profiles').catch(() => ({ list: [], current: '' }));
  return [{ title: 'Profils' }, ...r.list.map(p => ({ label: T(p.name), icon: 'user', check: p.id === r.current, fn: () => { if (p.id !== r.current) { B.call('br:profileOpen', p.id); toast(T('Ouverture du profil « {0} »…').replace('{0}', T(p.name))); } } })), '-',
    { label: 'Nouveau profil…', icon: 'plus', fn: async () => { const n = await askName(); if (n) { const id = await B.call('br:profileAdd', n); B.call('br:profileOpen', id); toast(T('Profil « {0} » créé').replace('{0}', n)); } } },
    ...(r.list.length > 1 ? [{ label: 'Supprimer un profil…', icon: 'trash', sub: () => r.list.filter(p => p.id && p.id !== r.current).map(p => ({ label: p.name, icon: 'trash', fn: async () => { const ok = await askBox({ title: 'Supprimer un profil', text: T('Supprimer le profil « {0} » et toutes ses données (favoris, mots de passe, historique, téléchargements de la liste) ? Les fichiers téléchargés restent sur l\'ordinateur.').replace('{0}', p.name), ok: 'Supprimer', danger: true }); if (ok) { await B.call('br:profileDelete', p.id); toast('Profil supprimé'); } } })) }] : [])];
}
function askName() {
  return new Promise(res => {
    askBox({ title: 'Nouveau profil', text: T('Nom du profil (par exemple « Travail »), puis OK :'), ok: 'Créer' }).then(r => res(r ? ($('#askNm')?.value || '').trim() : null));
    setTimeout(() => { const p = $('#askP'); if (!p.querySelector('#askNm')) { const i = document.createElement('input'); i.id = 'askNm'; i.type = 'text'; i.style.cssText = 'width:100%;margin-top:8px'; p.appendChild(i); } $('#askNm').focus(); }, 40);
  });
}
async function reportProblem() {
  const r = await askBox({ title: 'Signaler un problème', text: T("DrYAE va créer un petit rapport sur ton Bureau (versions, Windows, dernières erreurs — sans mots de passe, sans historique, sans adresses complètes) et ouvrir la page des signalements sur GitHub. Décris ce qui s'est passé et joins le fichier. Rien n'est envoyé sans toi."), ok: 'Créer le rapport' });
  if (r) { await B.call('br:report'); toast('Rapport créé sur le Bureau'); }
}
async function setModule(id, patch) { CFG = { ...CFG, ...(await B.call('br:setModule', id, patch)) }; drawMods(); updToolbar(); if (['adblock', 'capture', 'pip', 'translate', 'lights', 'scan'].includes(id) && patch.enabled !== undefined) toast(patch.enabled ? 'Extension activée (actualisez la page)' : 'Extension désactivée'); }
$('#bMenu').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); menu(r.right - 300, r.bottom + 4, mainMenu(), true); };
function zoom(d) { if (!cur.wv) return; cur.zoom = d === 0 ? 0 : Math.max(-5, Math.min(6, cur.zoom + d)); cur.wv.setZoomLevel(cur.zoom); updToolbar(); const z = $('#menu .mzoom b'); if (z) z.textContent = (cur.zoom ? Math.round(Math.pow(1.2, cur.zoom) * 100) : 100) + ' %'; }

// menu générique : { label, icon, key, fn, sub, disabled } ; '-' = séparateur ; { zoom:true } = ligne de zoom
function menu(x, y, entries, wide, back) {
  const m = $('#menu');
  // mode simple : les entrées avancées sont cachées
  const raw = typeof entries === 'function' ? entries() : entries;
  if (raw && typeof raw.then === 'function') { raw.then(l => menu(x, y, l, wide, back)); return; } // sous-menu préparé à la demande
  const list = raw.map(e => (e && e.adv && CFG.a11y?.simple ? null : e));
  const opener = m.classList.contains('on') ? menu.opener : document.activeElement;
  menu.opener = opener;
  m.setAttribute('role', 'menu');
  m.classList.toggle('wide', !!wide);
  m.innerHTML = (back ? `<button class="mback" data-back>${ic('back')}<span>${esc(back.title)}</span></button><hr>` : '') + list.map((e, i) => {
    if (!e) return '';
    if (e === '-') return '<hr>';
    if (e.title) return `<div class="mtitle">${esc(T(e.title))}</div>`;
    if (e.zoom) return `<div class="mzoom"><span>${esc(T('Zoom'))}</span><button data-z="-1" title="Ctrl −">−</button><b>${e.pct} %</b><button data-z="1" title="Ctrl +">+</button><button data-z="fs" title="F11">${ic('expand')}</button></div>`;
    const lead = e.check !== undefined ? `<span class="mck">${e.check ? ic('check') : ''}</span>${ic(e.icon || 'list')}` : e.img ? `<img class="mfav" src="${esc(e.img)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'mfavx'}))" alt="">` : ic(e.icon || 'list');
    return `<button data-i="${i}" role="menuitem" ${e.hl ? 'class="mhl"' : ''} ${e.disabled ? 'disabled' : ''}>${lead}<span class="ml">${esc(e.label)}</span>${e.key ? `<kbd>${esc(T(e.key))}</kbd>` : ''}${e.sub ? `<span class="mar">${ic('fwd')}</span>` : ''}</button>`;
  }).join('');
  m.classList.add('on');
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
  m.onclick = ev => {
    if (ev.target.closest('[data-back]')) return menu(x, y, back.entries, wide);
    const z = ev.target.closest('[data-z]');
    if (z) { if (z.dataset.z === 'fs') { m.classList.remove('on'); return B.call('br:fullscreen'); } return zoom(+z.dataset.z); }
    const b = ev.target.closest('[data-i]'); if (!b || b.disabled) return;
    const e = list[+b.dataset.i];
    if (e.sub) return menu(x, y, e.sub, wide, { title: e.label, entries });
    m.classList.remove('on'); e.fn();
  };
  // clavier : ↑ ↓ pour se déplacer, → ouvre un sous-menu, ← revient, Échap ferme et rend la main au bouton d'origine
  m.onkeydown = ev => {
    const b = ev.target.closest('[data-i]');
    if (ev.key === 'Escape') { m.classList.remove('on'); menu.opener?.focus?.(); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight' && b && list[+b.dataset.i]?.sub) { b.click(); ev.preventDefault(); }
    else if (ev.key === 'ArrowLeft' && back) { m.querySelector('[data-back]')?.click(); ev.preventDefault(); }
  };
  if (!m._arrows) { m._arrows = true; window.A11Y?.arrows(m, 'button:not([disabled])'); }
  if (opener && (opener.id === 'bMenu' || back || menu.byKey)) setTimeout(() => m.querySelector('[data-i]:not([disabled])')?.focus(), 0);
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
  if (name !== 'media') $('#pFoot').style.display = 'none';
  if (!wasOpen) { el.classList.add('slide'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('slide'))); }
  ({ media: drawMedia, links: () => {}, nd: drawNd })[name]?.();
}
$('#pClose').onclick = closePanel;

// ---- panneau « Fichier(s) détecté(s) » : tailles, morceaux, résolution, durée, tri, sélection, Tout effacer ----
let dSort = 0, dSel = null, dFilter = 'all';
const DSORTS = ['Plus récents', 'Taille', 'Nom', 'Type'];
const kindIco = k => (k === 'audio' ? 'music' : k === 'subtitle' || k === 'file' ? 'file' : 'film');
function mediaVisible(t = cur) {
  let l = (t.media || []).filter(x => !t.hidden?.has(x.url));
  if (dFilter !== 'all') l = l.filter(x => (dFilter === 'video' ? ['video', 'hls', 'dash'].includes(x.kind) : x.kind === dFilter));
  const sz = x => (x.kind !== 'hls' && x.size > 0 ? x.size : x.est > 0 ? x.est : 0);
  if (dSort === 1) l = [...l].sort((a, b) => sz(b) - sz(a));
  if (dSort === 2) l = [...l].sort((a, b) => dName(a).localeCompare(dName(b)));
  if (dSort === 3) l = [...l].sort((a, b) => a.kind.localeCompare(b.kind));
  return l;
}
function dName(x) {
  const base = (cur.title || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120);
  if (x.kind === 'hls') return (base || 'video') + '.mp4';
  return x.name && /\.\w{2,5}$/.test(x.name) && !/^(master|index|playlist|video|seg[-_]?\d*)\./i.test(x.name) ? x.name : (base || x.name || 'fichier') + '.' + (x.ext || (x.kind === 'audio' ? 'mp3' : 'mp4'));
}
function hlsProbe(x, t) {
  if (x.kind !== 'hls' || x._probing || x.est !== undefined) return;
  x._probing = true;
  B.call('br:hlsInfo', { url: x.url, page: t.url, incognito: t.incognito }).then(r => {
    x._probing = false;
    if (r.ok) Object.assign(x, { est: r.size, pieces: r.pieces, duration: r.duration, width: r.width, height: r.height, encrypted: r.encrypted });
    else x.est = -1;
    if (t === cur && panel === 'media') drawMedia();
  });
}
function drawMedia() {
  $('#pTitle').textContent = 'Fichier(s) détecté(s)';
  const t = cur;
  const m = mediaVisible(t);
  const total = (t.media || []).length;
  m.forEach(x => hlsProbe(x, t));
  const top = isOnline(t.url) ? `<div class="mitem" style="border-color:var(--accent-line)"><div class="nm"><span class="k">vidéo en ligne</span>${esc(t.title || 'Vidéo de cette page')}</div><div class="u">Choisis MP4 (avec la qualité) ou MP3, avec la taille de chaque fichier.</div><div class="row"><button class="btn sm primary" id="mPage">${ic('dl')}Vidéo de cette page</button></div></div>` : '';
  const head = `<div class="dtop"><span class="hint" style="flex:1;margin:0">Sélectionner n'importe quel fichier pour télécharger</span><button class="btn sm" id="dReset" title="Réafficher les fichiers effacés">Réinitialiser</button><button class="icon-btn" id="dFilt" title="Filtrer">${ic('filter')}</button></div>
    <label class="check dopt"><input type="checkbox" id="dConv"> Convertir les flux .ts en .mp4 (vidéo) à la fin</label>
    <div class="dtop" style="margin-top:6px"><label class="check dopt"><input type="checkbox" id="dSelMode" ${dSel ? 'checked' : ''}> Sélectionner les fichiers à télécharger</label><label class="check dopt" style="${dSel ? '' : 'opacity:.4;pointer-events:none'}"><input type="checkbox" id="dAll" ${dSel && m.length && m.every(x => dSel.has(x.url)) ? 'checked' : ''}> Tout sélectionner</label></div>`;
  const row = (x, i) => {
    const size = x.kind !== 'hls' && x.size > 0 ? fmt(x.size) : x.est > 0 ? '~' + fmt(x.est) : x.est === undefined && x.kind === 'hls' ? '…' : '';
    const host = (() => { try { const u = new URL(x.url); return u.host + u.pathname.replace(/[^/]+$/, '').slice(0, 30) + '…'; } catch { return ''; } })();
    const meta = [x.width && x.height ? `Résolution : <b>${x.width}x${x.height}</b>` : '', x.duration ? `Durée : <b>${fmtT(x.duration)}</b>` : '', x.mime && x.kind !== 'hls' ? esc(x.mime) : '', x.encrypted ? 'chiffré (AES)' : ''].filter(Boolean).join('<br>');
    return `<div class="dfile ${dSel && dSel.has(x.url) ? 'sel' : ''}" data-d="${i}">${dSel ? `<input type="checkbox" class="ck" ${dSel.has(x.url) ? 'checked' : ''}>` : ''}
      <div class="ico">${ic(kindIco(x.kind))}<b>${size}</b>${x.pieces ? `<span>${x.pieces} ${x.pieces > 1 ? 'morceaux' : 'morceau'}</span>` : `<span>${esc((x.ext || x.kind || '').toUpperCase())}</span>`}</div>
      <div class="mid"><div class="h">${esc(host)}</div><div class="n">${esc(dName(x))}</div><div class="m">${meta || esc({ video: 'vidéo', audio: 'audio', hls: 'flux vidéo', dash: 'flux DASH', subtitle: 'sous-titres', file: 'fichier' }[x.kind] || x.kind)}</div></div>
      <button class="more" data-more="${i}" title="Plus">${ic('more')}</button></div>`;
  };
  $('#pBody').innerHTML = top + head + (m.length ? m.map(row).join('')
    : `<p class="hint">${total ? 'Aucun élément ici' : "Lance la lecture d'une vidéo ou d'un audio sur la page : DrYAE le détectera ici."}</p><p class="hint">Astuce : clic droit sur un lien → « Télécharger le lien avec DrYAE ».</p>`);
  const f = $('#pFoot'); f.style.display = 'flex';
  f.innerHTML = `<button class="btn sm" id="dClear">${ic('trash')}Tout effacer</button><button class="btn sm" id="dSortB">${ic('sort')}Trier : ${esc(T(DSORTS[dSort]))}</button><span class="sp"></span>${dSel && dSel.size ? `<button class="btn sm primary" id="dGoSel">${ic('dl')}Télécharger (${dSel.size})</button>` : ''}<button class="btn sm" id="dClose">Fermer</button>`;
  const pb = $('#mPage'); if (pb) pb.onclick = () => openQuick(t, { page: t.url, title: t.title });
  B.call('br:hlsConvert').then(v => { const c = $('#dConv'); if (c) c.checked = v; });
  $('#dConv').onchange = e => B.call('br:hlsConvert', e.target.checked);
  $('#dSelMode').onchange = e => { dSel = e.target.checked ? new Set() : null; drawMedia(); };
  $('#dAll').onchange = e => { if (!dSel) return; m.forEach(x => (e.target.checked ? dSel.add(x.url) : dSel.delete(x.url))); drawMedia(); };
  $('#dReset').onclick = () => { t.hidden = new Set(); dFilter = 'all'; drawMedia(); updToolbar(); };
  $('#dFilt').onclick = ev => { const r = ev.currentTarget.getBoundingClientRect(); menu(r.left - 160, r.bottom + 4, [['all', 'Tous'], ['video', 'Vidéos'], ['audio', 'Audio'], ['file', 'Fichiers'], ['subtitle', 'Sous-titres']].map(([k, l]) => ({ label: (dFilter === k ? '✔ ' : '') + T(l), icon: 'filter', fn: () => { dFilter = k; drawMedia(); } }))); };
  $('#dClear').onclick = () => { t.hidden = new Set((t.media || []).map(x => x.url)); dSel = dSel ? new Set() : null; drawMedia(); updToolbar(); };
  $('#dSortB').onclick = () => { dSort = (dSort + 1) % DSORTS.length; drawMedia(); };
  $('#dClose').onclick = closePanel;
  const gs = $('#dGoSel'); if (gs) gs.onclick = async () => { const sel = m.filter(x => dSel.has(x.url)); dSel = new Set(); drawMedia(); let n = 0; for (const x of sel) if (await dlMedia(x, true, true)) n++; if (n) toast(T('{0} téléchargement(s) lancé(s)').replace('{0}', n)); };
  $('#pBody').onclick = ev => {
    const mo = ev.target.closest('[data-more]');
    const el = ev.target.closest('[data-d]'); if (!el) return;
    const x = m[+el.dataset.d];
    if (mo) {
      const r = mo.getBoundingClientRect();
      return menu(r.left - 220, r.bottom + 2, [
        x.kind !== 'dash' && { label: 'Télécharger', icon: 'dl', fn: () => openMediaItem(x, t) },
        { label: 'Lire dans un nouvel onglet', icon: 'video', fn: () => newTab(x.url) },
        { label: 'Copier le lien', icon: 'copy', fn: () => { navigator.clipboard.writeText(x.url); toast('Lien copié'); } },
        { label: 'Retirer de la liste', icon: 'x', fn: () => { (t.hidden ||= new Set()).add(x.url); drawMedia(); updToolbar(); } },
      ].filter(Boolean));
    }
    if (dSel) { dSel.has(x.url) ? dSel.delete(x.url) : dSel.add(x.url); return drawMedia(); }
    if (x.kind === 'dash') return toast('Flux DASH : non pris en charge pour le moment');
    openMediaItem(x, t);
  };
}
// clic sur un fichier détecté : vidéo / audio / flux -> « Choisir un format » (MP4 avec qualité ou MP3, tailles) ; sinon fichier simple
function openMediaItem(x, t = cur) {
  if (['video', 'audio', 'hls'].includes(x.kind)) return openQuick(t, { page: t.url, title: t.title, src: x.url, duration: x.duration });
  return openQuickFile({ url: x.url, name: dName(x), page: t.url, size: x.size, kind: x.kind, incognito: t.incognito });
}
function dlMedia(x, direct, quiet) {
  const name = x.kind === 'hls' ? dName(x).replace(/\.mp4$/, '') : dName(x);
  if (direct) return addDl({ url: x.url, page: cur.url, kind: x.kind === 'hls' ? 'hls' : undefined, name, title: cur.title, incognito: cur.incognito }).then(r => { if (r && !quiet) toast('Ajouté à DrYAE'); return r; });
  B.call('br:download', { url: x.url, name, page: cur.url, kind: x.kind === 'hls' ? 'hls' : undefined, incognito: cur.incognito });
}
$('#pBody').addEventListener('click', e => {
  const d = e.target.closest('[data-dl]');
  if (d) { const m = cur.media[+d.dataset.dl]; if (['video', 'audio', 'hls'].includes(m.kind)) return openQuick(cur, { page: cur.url, title: cur.title, src: m.url }); return openQuickFile({ url: m.url, name: m.name, page: cur.url, size: m.size, kind: m.kind, incognito: cur.incognito }); }
  const c = e.target.closest('[data-cp]'); if (c) { navigator.clipboard.writeText(cur.media[+c.dataset.cp].url); return toast('Lien copié'); }
  const o = e.target.closest('[data-open]'); if (o) return navigate(cur, o.dataset.open);
});
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
    downloadMany(urls, tab);
  };
}

// plusieurs liens : les doublons sont signalés en une seule question
async function downloadMany(urls, tab) {
  const r = await B.call('br:downloadMany', { urls, page: tab.url, incognito: tab.incognito });
  let n = r.added;
  if (r.dups.length) {
    const a = await askBox({ title: 'Déjà téléchargé', text: T('{0} fichier(s) sont déjà dans la liste ou déjà téléchargés. Que veux-tu faire ?').replace('{0}', r.dups.length) + '\n' + r.dups.slice(0, 5).map(d => '• ' + d.name).join('\n') + (r.dups.length > 5 ? '\n…' : ''),
      cancel: 'Les ignorer', buttons: [{ v: 'overwrite', label: 'Remplacer' }, { v: 'rename', label: 'Télécharger quand même', primary: true }] });
    if (a) n += (await B.call('br:downloadMany', { urls: r.dups.map(d => d.url), page: tab.url, incognito: tab.incognito, dupAction: a.value })).added;
  }
  if (n) toast(T('{0} téléchargement(s) ajouté(s)').replace('{0}', n), { label: 'Voir', fn: () => B.call('br:openMain') });
}

// recherche dans la page
function openFind() { $('#findbar').classList.add('on'); $('#findQ').focus(); $('#findQ').select(); }
function find(fwd = true) { const q = $('#findQ').value; if (q && cur.wv) cur.wv.findInPage(q, { forward: fwd, findNext: true }); }
$('#findQ').oninput = () => { const q = $('#findQ').value; if (cur.wv) q ? cur.wv.findInPage(q) : cur.wv.stopFindInPage('clearSelection'); };
$('#findQ').onkeydown = e => { if (e.key === 'Enter') find(!e.shiftKey); if (e.key === 'Escape') closeFind(); };
$('#findNext').onclick = () => find(true); $('#findPrev').onclick = () => find(false);
function closeFind() { $('#findbar').classList.remove('on'); cur.wv?.stopFindInPage('clearSelection'); }
$('#findX').onclick = closeFind;

// ---------- raccourcis clavier du navigateur (raccourcis standards des navigateurs) ----------
const BR_SHORTCUTS = [
  ['Ctrl + T', 'Nouvel onglet'], ['Ctrl + Maj + P  /  Ctrl + Maj + N', 'Nouvel onglet privé'], ['Ctrl + W  /  Ctrl + F4', "Fermer l'onglet"], ['Ctrl + Maj + T', "Rouvrir l'onglet fermé"],
  ['Ctrl + Tab  /  Ctrl + Maj + Tab', 'Onglet suivant / précédent'], ['Ctrl + 1 … 8  /  Ctrl + 9', "Aller à l'onglet n° / au dernier"], ['Ctrl + Maj + Page ↑/↓', "Déplacer l'onglet"],
  ['Ctrl + L  /  Alt + D  /  F6', "Aller à la barre d'adresse"], ['Ctrl + K  /  Ctrl + E', 'Rechercher sur le web'], ['Ctrl + F  /  F3', 'Rechercher dans la page'], ['Ctrl + G  /  Ctrl + Maj + G', 'Résultat suivant / précédent'],
  ['F5  /  Ctrl + R', 'Actualiser'], ['Ctrl + F5  /  Ctrl + Maj + R', 'Actualiser sans le cache'], ['Alt + ←  /  Alt + →', 'Précédent / suivant'], ['Alt + Début', "Page d'accueil"],
  ['Ctrl + D', 'Ajouter cet onglet aux favoris'], ['Ctrl + Maj + D', 'Ajouter tous les onglets aux favoris'], ['Ctrl + Maj + B', 'Afficher / masquer la barre de favoris'], ['Ctrl + Maj + O', 'Gestionnaire de favoris'],
  ['Ctrl + H', 'Historique'], ['Ctrl + J', 'Téléchargements'], ['Ctrl + Maj + Y', 'Fichiers détectés sur cette page'],
  ['Ctrl + Maj + A', 'Extensions'], ['Ctrl + Maj + E', 'Traduire la sélection ou la page'], ['Ctrl + Maj + S', 'Traduire les images de la page (scans)'], ['Ctrl + Maj + L', 'Lumières tamisées'], ['Ctrl + Maj + U', "Image dans l'image"], ['Ctrl + P', 'Imprimer'], ['Ctrl + S', 'Enregistrer sous'], ['Ctrl + U', 'Code source de la page'], ['Ctrl + M', "Couper / réactiver le son de l'onglet"],
  ['Ctrl + +  /  Ctrl + −  /  Ctrl + 0', 'Zoom avant / arrière / normal'], ['F11', 'Plein écran'], ['F12  /  Ctrl + Maj + I', 'Outils de développement'],
  ['Ctrl + Maj + Suppr', 'Effacer les données de navigation'], ['Ctrl + Maj + Q', 'Quitter DrYAE'], ['F1', 'Afficher ces raccourcis'],
  ['Boutons latéraux de la souris', 'Page précédente / suivante'], ['Clic du milieu ou Ctrl + clic sur un lien', 'Ouvrir dans un nouvel onglet en arrière-plan'],
  ['Clic du milieu sur un onglet', "Fermer l'onglet"], ["Double-clic dans la barre d'onglets", 'Nouvel onglet'], ['Ctrl + molette', 'Zoom avant / arrière'],
];
function showShortcuts() {
  $('#kbModal .kbd-list').innerHTML = BR_SHORTCUTS.map(([k, l]) => `<div><kbd>${esc(T(k))}</kbd><span>${esc(T(l))}</span></div>`).join('');
  $('#kbModal').classList.add('on');
}
$('#kbModal').addEventListener('click', e => { if (e.target.id === 'kbModal' || e.target.closest('[data-close]')) $('#kbModal').classList.remove('on'); });
const closedTabs = [];
function reopenClosed() { const u = closedTabs.pop(); if (u) { newTab(u.url, { incognito: u.incognito }); B.call('br:closed', closedTabs.filter(c => !c.incognito)); } }
async function toggleMute() { if (!cur?.wcId) return; cur.muted = await B.call('br:mute', cur.wcId); toast(cur.muted ? 'Son de l\'onglet coupé' : 'Son de l\'onglet réactivé'); updTab(cur); }
async function savePage() { if (cur?.wcId && await B.call('br:savePage', cur.wcId)) toast('Page enregistrée'); }
function viewSource() { if (/^https?:/.test(cur?.url || '')) newTab('view-source:' + cur.url); }
function cycleFocus(dir) {
  const a = document.activeElement, zones = ['url', 'tools', 'page'];
  const now = a?.id === 'url' ? 0 : a?.closest?.('.toolbar') ? 1 : 2;
  const next = zones[(now + dir + 3) % 3];
  if (next === 'url') { $('#url').focus(); $('#url').select(); }
  else if (next === 'tools') $('.toolbar button:not([disabled])')?.focus();
  else cur?.wv?.focus();
}
// barre d'outils : ← → pour passer d'un bouton à l'autre
document.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !e.target.closest?.('.toolbar') || e.target.tagName === 'INPUT') return;
  const bs = [...document.querySelectorAll('.toolbar button:not([disabled])')].filter(b => b.offsetParent !== null);
  const i = bs.indexOf(e.target); if (i < 0) return;
  bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length].focus(); e.preventDefault();
}, true);
function onKey(k, ctrl, shift, alt) {
  k = String(k).toLowerCase();
  const go = f => { f(); return true; };
  if (ctrl && shift) {
    if (k === 'n' || k === 'p') return go(() => newTab('', { incognito: true }));
    if (k === 't') return go(reopenClosed);
    if (k === 'o') return go(() => openPage('bookmarks'));
    if (k === 'a') return go(() => openPage('extensions'));
    if (k === 'y') return go(() => (modOn('capture') ? togglePanel('media', true) : togglePanel('nd', true)));
    if (k === 'b') return go(toggleBar);
    if (k === 'd') return go(bookmarkAll);
    if (k === 'e') return go(() => modOn('translate') && pageCmd('translate-selection'));
    if (k === 's') return go(() => modOn('scan') && pageCmd('scan-region'));
    if (k === 'l') return go(() => modOn('lights') && pageCmd('lights'));
    if (k === 'u') return go(() => modOn('pip') && cur?.wcId && B.call('br:pip', cur.wcId));
    if (k === 'i') return go(() => cur?.wcId && B.call('br:devtools', cur.wcId));
    if (k === 'q') return go(() => B.call('br:quit'));
    if (k === 'r') return go(() => cur.wv?.reloadIgnoringCache());
    if (k === 'g') return go(() => find(false));
    if (k === 'delete') return go(() => openPage('history', 'clear'));
    if (k === 'tab') return go(() => { const i = tabs.indexOf(cur); select(tabs[(i - 1 + tabs.length) % tabs.length]); });
    if (k === 'pageup' || k === 'pagedown') return go(() => { const i = tabs.indexOf(cur), j = i + (k === 'pageup' ? -1 : 1); if (j >= 0 && j < tabs.length) moveTab(cur, tabs[j], k === 'pagedown'); });
    return false;
  }
  if (ctrl) {
    if (k === 't') return go(() => newTab());
    if (k === 'w' || k === 'f4') return go(() => closeTab(cur));
    if (k === 'l') return go(() => $('#url').focus());
    if (k === 'k' || k === 'e') return go(() => { $('#url').focus(); $('#url').value = ''; });
    if (k === 'f') return go(openFind);
    if (k === 'g') return go(() => find(true));
    if (k === 'j') return go(openDownloads);
    if (k === 'h') return go(() => openPage('history'));
    if (k === 'd') return go(starClick);
    if (k === 'p') return go(() => cur?.wcId && B.call('br:print', cur.wcId));
    if (k === 's') return go(savePage);
    if (k === 'u') return go(viewSource);
    if (k === 'm') return go(toggleMute);
    if (k === 'r') return go(() => cur.wv?.reload());
    if (k === 'f5') return go(() => cur.wv?.reloadIgnoringCache());
    if (k === 'tab') return go(() => { const i = tabs.indexOf(cur); select(tabs[(i + 1) % tabs.length]); });
    if (k === 'pageup' || k === 'pagedown') return go(() => { const i = tabs.indexOf(cur); select(tabs[(i + (k === 'pageup' ? -1 : 1) + tabs.length) % tabs.length]); });
    if (k === '+' || k === '=') return go(() => zoom(1));
    if (k === '-') return go(() => zoom(-1));
    if (k === '0') return go(() => zoom(0));
    if (/^[1-8]$/.test(k)) return go(() => { const t = tabs[+k - 1]; if (t) select(t); });
    if (k === '9') return go(() => select(tabs[tabs.length - 1]));
    return false;
  }
  if (alt) {
    if (k === 'arrowleft') return go(() => $('#bBack').click());
    if (k === 'arrowright') return go(() => $('#bFwd').click());
    if (k === 'home') return go(() => showStart(cur));
    if (k === 'd') return go(() => $('#url').focus());
    if (k === 'f' || k === 'e') return go(() => { menu.byKey = true; $('#bMenu').focus(); $('#bMenu').click(); menu.byKey = false; });
    return false;
  }
  if (k === 'f5') return go(() => cur.wv?.reload());
  if (k === 'f1') return go(showShortcuts);
  if (k === 'f3') return go(() => ($('#findbar').classList.contains('on') ? find(!shift) : openFind()));
  // F6 : barre d'adresse → boutons de la barre d'outils → page (comme Chrome) ; Maj+F6 dans l'autre sens
  if (k === 'f6') return go(() => cycleFocus(shift ? -1 : 1));
  if (k === 'f11') return go(() => B.call('br:fullscreen'));
  if (k === 'f9' && !alt) return go(() => readerMode());
  if (k === 'f8' && !alt) return go(() => readAloud());
  if (k === 'f12') return go(() => cur?.wcId && B.call('br:devtools', cur.wcId));
  return false;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#menu').classList.remove('on'); closeFind(); closeQuick(); hideBmEdit(); $$('.overlay.on').forEach(o => o.classList.remove('on')); return; }
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  // dans un champ, on laisse Ctrl+A/C/V/X/Z au champ
  if (typing && (e.ctrlKey || e.metaKey) && !e.shiftKey && ['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase())) return;
  if (onKey(e.key, e.ctrlKey || e.metaKey, e.shiftKey, e.altKey)) e.preventDefault();
});
B.on('shortcut', s => { const t = tabByWc(s.wcId); if (t && t !== cur) select(t); onKey(s.key, s.ctrl, s.shift, s.alt); });

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
  closeQuick();
  const r = await addDl({ ...o, ...op, name: op.name || null, title: o.title || op.name || (tab && tab.title) || null, incognito: tab?.incognito });
  if (r) toast(`${T('Ajouté à DrYAE')}${label ? ' : ' + label : ''}`, { label: 'Voir', fn: () => B.call('br:openMain') });
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
    html += `<div class="qsec">Fichiers détectés sur la page</div><div class="qgrid">${files.map((m, i) => `<button class="qopt" data-file="${i}"><b>${esc(KLAB[m.kind] || m.kind)} ${esc((m.ext || '').toUpperCase())}${m.height ? ' · ' + m.height + 'p' : ''}</b><span data-fsz="${i}">${m.kind !== 'hls' && m.size > 0 ? fmt(m.size) : m.est > 0 ? '~' + fmt(m.est) : m.kind === 'hls' ? '…' : esc((m.name || '').slice(0, 24))}</span></button>`).join('')}</div>`;
  }
  if (!v && !files.length) html += `<p class="hint">Lance la lecture de la vidéo, puis réessaie : DrYAE détecte les fichiers pendant la lecture.${err ? '<br>' + esc(err) : ''}</p>`;
  $('#qsBody').innerHTML = html;
  // tailles des flux (m3u8) : estimées sans télécharger (~), puis reportées sur le choix « Meilleure qualité » si yt-dlp n'en donne pas
  files.forEach((m, i) => {
    if (m.kind !== 'hls' || m.est > 0) return;
    B.call('br:hlsInfo', { url: m.url, page, incognito: tab.incognito }).then(r => {
      if (!r.ok || qsCtx !== ctx) return;
      Object.assign(m, { est: r.size, pieces: r.pieces, duration: r.duration, width: r.width, height: r.height });
      const sp = $(`[data-fsz="${i}"]`); if (sp) sp.textContent = r.size > 0 ? '~' + fmt(r.size) : '';
    });
  });
  if (v && target !== page && /\.m3u8(\?|$)/i.test(target) && !(v.heights || []).some(h => h.size > 0)) {
    B.call('br:hlsInfo', { url: target, page, incognito: tab.incognito }).then(r => {
      if (!r.ok || qsCtx !== ctx || !(r.size > 0)) return;
      const best = $('#qsBody .qopt[data-m="video"] span:last-child'); if (best && !best.textContent.trim()) best.textContent = '~' + fmt(r.size);
      if (r.duration && !$('#qsMeta').textContent) $('#qsMeta').textContent = fmtT(r.duration);
      $$('#qsBody .qopt[data-m="audio"][data-b]').forEach(b => { const k = +b.dataset.b; const s = b.querySelector('span'); if (s && r.duration && !/\d/.test(s.textContent.replace(/\d+ kb\/s/, ''))) s.textContent = `${k} kb/s ~${fmt(r.duration * k * 125)}`; });
    });
  }
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
// ---- torrent / magnet cliqué sur une page : choix des fichiers ici même, on reste sur la page ----
// torrent déjà présent : proposer ses trackers
async function torDup(d) {
  closeQuick();
  const extra = d.newTrackers ? ' ' + T('Il apporte {0} tracker(s) nouveau(x) : les ajouter au téléchargement existant peut le rendre plus rapide.').replace('{0}', d.newTrackers) : '';
  const r = await askBox({ title: 'Torrent déjà dans la liste', text: `« ${d.name} » ${T('est déjà dans la liste.')}${extra}`, buttons: d.newTrackers ? [{ v: 'merge', label: 'Ajouter ses trackers', primary: true }] : [{ v: 'show', label: 'Voir le téléchargement', primary: true }] });
  if (r?.value === 'merge') { await B.call('br:torTrackers', d.id, d.trackers); toast(T('{0} tracker(s) ajouté(s)').replace('{0}', d.newTrackers)); }
  if (r?.value === 'show') B.call('br:openMain');
}
B.on('torrent-probe', p => {
  if (!qsCtx || qsCtx.hash !== p.hash) return;
  $('#qsMeta').textContent = T('Recherche de pairs… {0} s sur {1}').replace('{0}', p.s).replace('{1}', p.max) + ' · ' + T('{0} pair(s)').replace('{0}', p.peers) + (p.stuck ? ' — ' + T('Toujours aucun pair : le pare-feu de Windows bloque peut-être DrYAE.') : '');
});
async function openQuickTorrent(o) {
  const tab = cur;
  qsCtx = { url: o.src, page: o.page, tab };
  $('#qsTitleH').textContent = 'Torrent';
  qsShow(/^magnet:/i.test(o.src) ? (decodeURIComponent((/[?&]dn=([^&]+)/.exec(o.src) || [])[1] || '').replace(/\+/g, ' ') || 'Lien magnet') : decodeURIComponent(o.src.split(/[?#]/)[0].split('/').pop()), 'Recherche de pairs et lecture des informations… (jusqu\'à 90 s)', '');
  await qsAdvInit('');
  $('#qsBody').innerHTML = '<div class="spin"></div>';
  $('#qsBody').onclick = null;
  const ctx = qsCtx;
  ctx.hash = ((/xt=urn:btih:([a-z0-9]+)/i.exec(o.src) || [])[1] || '').toLowerCase();
  $('#qsBody').innerHTML = `<div class="spin"></div><div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm" id="qtCancel">${esc(T('Annuler'))}</button></div>`;
  $('#qtCancel').onclick = () => { if (ctx.hash) B.call('br:torCancel', ctx.hash); closeQuick(); };
  const r = await B.call('br:torInspect', o.src, { cookie: o.cookie, page: o.page });
  if (qsCtx !== ctx) return;
  ctx.hash = '';
  const quickBtn = () => {
    const q = $('#qtQuick'); if (q) q.onclick = async () => { const d = await B.call('br:torQuick', o.src); if (d && d.duplicate) return torDup(d.duplicate); closeQuick(); toast('Torrent ajouté', { label: 'Voir', fn: () => B.call('br:openMain') }); };
    const f = $('#qtFw'); if (f) f.onclick = () => B.call('br:firewall');
  };
  if (!r.ok) {
    $('#qsMeta').textContent = T(r.error);
    $('#qsBody').innerHTML = /Annulé/.test(r.error) ? '' : `<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn primary" id="qtQuick">${ic('dl')}Ajouter sans lire les infos</button>${/pair|moteur|pare-feu|aria2/i.test(r.error) ? `<button class="btn" id="qtFw">${esc(T('Autoriser DrYAE dans le pare-feu'))}</button>` : ''}</div>`;
    quickBtn();
    return;
  }
  if (r.info.duplicate) return torDup(r.info.duplicate);
  const info = r.info;
  const sel = new Set(info.files.map(f => f.i));
  $('#qsTitle').textContent = info.name;
  const meta = () => { const s = info.files.filter(f => sel.has(f.i)).reduce((a, f) => a + f.length, 0); $('#qsMeta').textContent = `${sel.size}/${info.files.length} fichier(s) · ${fmt(s)}`; };
  const isVid = p => /\.(mp4|mkv|webm|avi|mov|m4v|ts)$/i.test(p);
  $('#qsBody').innerHTML = `<div class="row" style="gap:6px;margin:8px 0"><button class="btn sm" data-t="all">Tout</button><button class="btn sm" data-t="none">Aucun</button><button class="btn sm" data-t="vid">Vidéos seulement</button></div>
    <div class="tfl">${info.files.map(f => `<label class="tfr"><input type="checkbox" data-i="${f.i}" checked><span class="n">${esc(f.path.split(/[\\/]/).slice(1).join('/') || f.path)}</span><span class="s">${fmt(f.length)}</span></label>`).join('')}</div>
    <label class="check"><input type="checkbox" id="qtSeq"> Téléchargement séquentiel (lecture pendant le téléchargement)</label>
    <label class="check"><input type="checkbox" id="qtSeed"> Partager (seed) une fois terminé</label>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary" id="qtGo">${ic('dl')}Télécharger</button></div>`;
  const sync = () => { $$('#qsBody .tfr input').forEach(c => { c.checked = sel.has(+c.dataset.i); }); meta(); };
  meta();
  $('#qsBody').onclick = e => {
    const t = e.target.closest('[data-t]');
    if (t) { sel.clear(); info.files.forEach(f => { if (t.dataset.t === 'all' || (t.dataset.t === 'vid' && isVid(f.path))) sel.add(f.i); }); sync(); }
    const c = e.target.closest('.tfr input'); if (c) { c.checked ? sel.add(+c.dataset.i) : sel.delete(+c.dataset.i); meta(); }
  };
  $('#qtGo').onclick = async () => {
    if (!sel.size) return toast('Sélectionne au moins un fichier');
    const op = qsOpts();
    await B.call('br:torAdd', { ...info, selected: [...sel], dir: op.dir, sequential: $('#qtSeq').checked, seedAfter: $('#qtSeed').checked, startNow: op.startNow, schedule: op.schedule });
    closeQuick();
    toast('Torrent ajouté', { label: 'Voir', fn: () => B.call('br:openMain') });
  };
}
B.on('quick-torrent', o => openQuickTorrent(o));
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
B.on('show-shortcuts', () => showShortcuts());
$('#lockB').onclick = e => popOpen('site', e.currentTarget);
// un site demande la caméra, le micro, la position… : on pose la question
const PERM_Q = { camera: 'utiliser votre caméra', microphone: 'utiliser votre micro', geolocation: 'connaître votre position', notifications: 'vous envoyer des notifications', clipboard: 'lire votre presse-papiers', midi: 'utiliser vos appareils MIDI', idle: 'savoir si vous utilisez l\'ordinateur' };
B.on('perm-ask', async p => {
  const t = tabByWc(p.wcId); if (t && t !== cur) select(t);
  const r = await askBox({ title: 'Autorisation demandée', text: `« ${p.host} » ` + T('veut') + ' ' + p.kinds.map(k => T(PERM_Q[k] || k)).join(', ') + '.', check: 'Se souvenir pour ce site', checked: true, cancel: 'Bloquer', buttons: [{ v: 'allow', label: 'Autoriser', primary: true }] });
  B.call('br:permReply', p.id, !!r, $('#askC').checked);
});
B.on('a11y', e => { CFG.a11y = e; window.A11Y?.apply(e); drawMods(); });
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



// ---------- favoris : barre, menu, bulle de modification ----------
let BM = { bar: { id: 'bar', children: [] }, other: { id: 'other', children: [] } };
const favImg = (u, f) => f || '';
function bmItems(nodes) {
  return nodes.map(n => n.type === 'folder'
    ? { label: n.title, icon: 'folder', sub: () => [...bmItems(n.children), ...(n.children.length ? ['-', { label: 'Tout ouvrir', icon: 'link', fn: () => openAll(n) }] : [{ title: 'Dossier vide' }])] }
    : { label: n.title || n.url, img: n.fav, icon: 'link', fn: () => navigate(cur, n.url) });
}
function openAll(folder) { const urls = []; const w = l => l.forEach(n => (n.type === 'folder' ? w(n.children) : urls.push(n.url))); w(folder.children); urls.slice(0, 30).forEach((u, i) => newTab(u, { background: i > 0 })); }
function bmMenu() {
  return [
    { label: 'Ajouter cet onglet aux favoris…', icon: 'star', key: 'Ctrl+D', fn: starClick, disabled: !/^https?:/.test(cur?.url || '') },
    { label: 'Ajouter tous les onglets aux favoris…', icon: 'stars', key: 'Ctrl+Maj+D', fn: bookmarkAll },
    '-',
    { label: 'Afficher la barre de favoris', icon: 'bar', key: 'Ctrl+Maj+B', check: !!CFG.showBookmarksBar, fn: toggleBar },
    { label: 'Gestionnaire de favoris', icon: 'list', key: 'Ctrl+Maj+O', fn: () => openPage('bookmarks') },
    { label: 'Importer des favoris (fichier HTML)…', icon: 'import', fn: async () => { try { const n = await B.call('br:bmImport'); if (n) toast(T('{0} favori(s) importé(s)').replace('{0}', n)); } catch (e) { toast(String(e.message || e).replace(/^.*Error: /, '')); } } },
    '-', { title: 'Barre de favoris' },
    ...(BM.bar.children.length ? bmItems(BM.bar.children) : [{ title: 'Aucun favori' }]),
    ...(BM.other.children.length ? ['-', { label: 'Autres favoris', icon: 'folder', sub: () => bmItems(BM.other.children) }] : []),
  ];
}
async function toggleBar() { CFG = { ...CFG, ...(await B.call('br:setSettings', { showBookmarksBar: !CFG.showBookmarksBar })) }; drawBmBar(); }
async function bookmarkAll() {
  const list = tabs.filter(t => /^https?:/.test(t.url) && !t.incognito).map(t => ({ url: t.url, title: t.title }));
  if (!list.length) return toast('Aucun onglet à ajouter');
  const d = new Date().toLocaleDateString((window.I18N && I18N.locale) || 'fr-FR');
  await B.call('br:bmAddAll', list, T('Onglets du {0}').replace('{0}', d));
  toast(T('{0} onglet(s) ajouté(s) aux favoris').replace('{0}', list.length));
}
// écriture lue sans son modèle (coréen, russe…) : proposer de le télécharger une fois
const MODEL_NAMES = { korean: 'Coréen', eslav: 'Russe, ukrainien, biélorusse', cyrillic: 'Autres langues cyrilliques (bulgare, serbe…)', arabic: 'Arabe, persan, ourdou', th: 'Thaï', devanagari: 'Hindi, marathi, népalais' };
async function offerScanModel(id) {
  if (id === '?') return toast(T("Le texte de cette image n'a pas pu être lu. Si c'est du coréen, du russe, de l'arabe ou du thaï, télécharge son modèle de lecture."), { label: 'Choisir', fn: () => popOpen('scan', $('#tbItems [data-mod="scan"]') || $('#bExt')) });
  if (!MODEL_NAMES[id]) return;
  const list = await B.call('scan:models').catch(() => []); const m = list.find(x => x.id === id); if (!m || m.installed) return;
  toast(T('Pour mieux lire « {0} », DrYAE peut télécharger son modèle de lecture ({1}).').replace('{0}', T(MODEL_NAMES[id])).replace('{1}', fmt(m.size)), { label: 'Télécharger', fn: () => getScanModel(id) });
}
async function getScanModel(id) {
  toast(T('Téléchargement du modèle de lecture…'));
  try { await B.call('scan:modelGet', id); toast(T('Modèle installé : relis l\'image (icône « Relire »)')); } catch (e) { toast(T('Téléchargement impossible') + ' : ' + (e.message || e)); }
  if (typeof POP !== 'undefined' && POP.kind === 'scan') popRender();
}
B.on('scan-model', v => { if (v.p != null && typeof POP !== 'undefined' && POP.kind === 'scan') { const el = document.querySelector(`#pop [data-mdl="${v.id}"] .mp`); if (el) el.textContent = Math.round(v.p * 100) + ' %'; } });
// ferme les fenêtres flottantes (fenêtres d'extensions, menus) : clic dans la page
function closeFloating() {
  if (typeof POP !== 'undefined' && POP.kind) popClose();
  $('#menu').classList.remove('on');
  B.call('br:closeExtPopups');
}
function drawBmBar() {
  if (bmDrag) { drawBmBar.later = true; return; } // pas de redessin pendant un glisser (il annulerait le déplacement)
  const bar = $('#bmbar');
  bar.classList.toggle('on', !!CFG.showBookmarksBar);
  if (!CFG.showBookmarksBar) return;
  const item = n => `<button class="bi" draggable="true" data-bm="${esc(n.id)}" title="${esc(n.title + (n.url ? '\n' + n.url : ''))}">${n.type === 'folder' ? ic('folder') : n.fav ? `<img src="${esc(n.fav)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('i')))">` : ic('globe')}<span>${esc(n.title || n.url)}</span></button>`;
  bar.innerHTML = (BM.bar.children.length ? BM.bar.children.map(item).join('') : `<span class="empty">${esc(T('Pour un accès rapide, placez vos favoris ici, dans la barre de favoris.'))}</span>`) +
    `<span class="sp"></span>${BM.other.children.length ? `<button class="bi" data-bm="other">${ic('folder')}<span>${esc(T('Autres favoris'))}</span></button>` : ''}`;
}
const bmNode = id => { let r = null; const w = l => l.forEach(n => { if (n.id === id) r = n; if (n.children) w(n.children); }); w([BM.bar, BM.other]); return r; };
$('#bmbar').addEventListener('click', e => {
  const b = e.target.closest('[data-bm]'); if (!b) return;
  const n = bmNode(b.dataset.bm); if (!n) return;
  if (n.type === 'folder' || n.id === 'other') { const r = b.getBoundingClientRect(); return menu(r.left, r.bottom + 2, () => [...bmItems(n.children), ...(n.children.length ? ['-', { label: 'Tout ouvrir', icon: 'link', fn: () => openAll(n) }] : [{ title: 'Dossier vide' }])]); }
  if (e.ctrlKey || e.metaKey) newTab(n.url, { background: true }); else navigate(cur, n.url);
});
$('#bmbar').addEventListener('auxclick', e => { const b = e.target.closest('[data-bm]'); if (e.button !== 1 || !b) return; const n = bmNode(b.dataset.bm); if (n && n.url) { e.preventDefault(); newTab(n.url, { background: true }); } });
$('#bmbar').addEventListener('contextmenu', e => {
  e.preventDefault();
  const b = e.target.closest('[data-bm]'); const n = b && bmNode(b.dataset.bm);
  const items = n && n.url ? [
    { label: 'Ouvrir dans un nouvel onglet', icon: 'plus', fn: () => newTab(n.url, { background: true }) },
    { label: 'Ouvrir dans un onglet privé', icon: 'mask', fn: () => newTab(n.url, { incognito: true }) },
    '-',
    { label: 'Modifier…', icon: 'star', fn: () => showBmEdit(n, b) },
    { label: 'Copier le lien', icon: 'copy', fn: () => navigator.clipboard.writeText(n.url) },
    { label: 'Supprimer', icon: 'trash', fn: () => B.call('br:bmRemove', [n.id]) },
  ] : n && n.type === 'folder' && n.id !== 'other' ? [
    { label: 'Tout ouvrir', icon: 'link', fn: () => openAll(n) },
    { label: 'Renommer…', icon: 'star', fn: () => showBmEdit(n, b) },
    { label: 'Supprimer le dossier', icon: 'trash', fn: () => { if (confirm(T('Supprimer le dossier « {0} » et son contenu ?').replace('{0}', n.title))) B.call('br:bmRemove', [n.id]); } },
  ] : [];
  // déplacer sans la souris (accessibilité)
  const bi = n && n.id !== 'other' ? BM.bar.children.findIndex(x => x.id === n.id) : -1;
  if (bi >= 0) items.push('-', { label: 'Déplacer vers la gauche', icon: 'back', disabled: bi === 0, fn: () => B.call('br:bmMove', [n.id], 'bar', bi - 1) }, { label: 'Déplacer vers la droite', icon: 'fwd', disabled: bi === BM.bar.children.length - 1, fn: () => B.call('br:bmMove', [n.id], 'bar', bi + 2) });
  menu(e.clientX, e.clientY, [...items, ...(items.length ? ['-'] : []),
    { label: 'Ajouter cet onglet aux favoris…', icon: 'star', fn: starClick, disabled: !/^https?:/.test(cur?.url || '') },
    { label: 'Nouveau dossier', icon: 'folder', fn: async () => { const f = await B.call('br:bmAdd', { parentId: 'bar', type: 'folder', title: T('Nouveau dossier') }); setTimeout(() => showBmEdit(f, $(`#bmbar [data-bm="${f.id}"]`)), 120); } },
    { label: 'Gestionnaire de favoris', icon: 'list', fn: () => openPage('bookmarks') },
    { label: 'Masquer la barre de favoris', icon: 'bar', fn: toggleBar }]);
});
// glisser-déposer : réordonner, ou déposer un lien ou un onglet pour l'ajouter
var bmDrag = null;
$('#bmbar').addEventListener('dragstart', e => { const b = e.target.closest('[data-bm]'); if (!b || b.dataset.bm === 'other') return; bmDrag = b.dataset.bm; e.dataTransfer.effectAllowed = 'move'; });
$('#bmbar').addEventListener('dragover', e => { e.preventDefault(); const b = e.target.closest('.bi'); $$('#bmbar .bi').forEach(x => x.classList.remove('drop-l', 'drop-r')); if (b && b.dataset.bm !== 'other') { const r = b.getBoundingClientRect(); b.classList.add(e.clientX > r.left + r.width / 2 ? 'drop-r' : 'drop-l'); } });
$('#bmbar').addEventListener('dragend', () => { bmDrag = null; $$('#bmbar .bi').forEach(x => x.classList.remove('drop-l', 'drop-r')); if (drawBmBar.later) { drawBmBar.later = false; drawBmBar(); } });
$('#bmbar').addEventListener('dragleave', () => $$('#bmbar .bi').forEach(x => x.classList.remove('drop-l', 'drop-r')));
$('#bmbar').addEventListener('drop', async e => {
  e.preventDefault();
  const b = e.target.closest('.bi'); $$('#bmbar .bi').forEach(x => x.classList.remove('drop-l', 'drop-r'));
  let idx = BM.bar.children.length;
  if (b && b.dataset.bm !== 'other') { const r = b.getBoundingClientRect(); idx = BM.bar.children.findIndex(n => n.id === b.dataset.bm) + (e.clientX > r.left + r.width / 2 ? 1 : 0); }
  if (b && bmNode(b.dataset.bm)?.type === 'folder' && !bmDrag && e.clientX) {}
  if (bmDrag) { const id = bmDrag; bmDrag = null; await B.call('br:bmMove', [id], 'bar', idx); return; }
  const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').split('\n')[0].trim();
  if (/^https?:\/\//.test(url)) { const t = tabs.find(x => x.url === url); await B.call('br:bmAdd', { parentId: 'bar', index: idx, url, title: t?.title || url, fav: t?.fav || '' }); }
});
let bmEditing = null;
function folderOptions(sel) {
  const out = []; const w = (l, d) => l.forEach(n => { if (n.type === 'folder') { out.push(`<option value="${esc(n.id)}" ${n.id === sel ? 'selected' : ''}>${'  '.repeat(d)}${esc(T(n.title))}</option>`); w(n.children, d + 1); } });
  w([BM.bar, BM.other], 0); return out.join('') + `<option value="__other">${esc(T('Choisir un autre dossier…'))}</option>`;
}
const parentOf = id => { let p = null; const w = (l, par) => l.forEach(n => { if (n.id === id) p = par; if (n.children) w(n.children, n); }); w([BM.bar, BM.other], null); return p; };
function showBmEdit(n, anchor, isNew) {
  bmEditing = n;
  $('#bmeH').textContent = T(isNew ? 'Favori ajouté' : n.type === 'folder' ? 'Modifier le dossier' : 'Modifier le favori');
  $('#bmeName').value = n.title || '';
  const p = parentOf(n.id);
  $('#bmeFolder').innerHTML = folderOptions(p?.id || 'bar');
  $('#bmeFolder').parentElement && ($('#bmeFolder').style.display = n.type === 'folder' ? 'none' : '');
  $('#bmeFolder').previousElementSibling.style.display = n.type === 'folder' ? 'none' : '';
  const m = $('#bmEdit'); m.classList.add('on');
  const r = (anchor || $('#bStar')).getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(innerWidth - 330, r.right - 320)) + 'px'; m.style.top = (r.bottom + 6) + 'px';
  setTimeout(() => { $('#bmeName').focus(); $('#bmeName').select(); }, 30);
}
function hideBmEdit() { $('#bmEdit').classList.remove('on'); bmEditing = null; }
async function starClick() {
  if (!/^https?:/.test(cur?.url || '')) return;
  const ex = (() => { let r = null; const w = l => l.forEach(n => { if (!r && n.url === cur.url) r = n; if (n.children) w(n.children); }); w([BM.bar, BM.other]); return r; })();
  if (ex) return showBmEdit(ex);
  const n = await B.call('br:bmAdd', { parentId: 'bar', url: cur.url, title: cur.title, fav: cur.fav || '' });
  showBmEdit(n, null, true);
}
$('#bmeOk').onclick = async () => {
  const n = bmEditing; if (!n) return hideBmEdit();
  await B.call('br:bmUpdate', n.id, { title: $('#bmeName').value.trim() || n.title });
  const p = parentOf(n.id); const f = $('#bmeFolder').value;
  if (n.type !== 'folder' && p && f && f !== p.id) await B.call('br:bmMove', [n.id], f, -1);
  hideBmEdit();
};
$('#bmeName').onkeydown = e => { if (e.key === 'Enter') $('#bmeOk').click(); };
// « Choisir un autre dossier… » : fenêtre complète (nom, adresse, arborescence, nouveau dossier)
$('#bmeFolder').onchange = e => { if (e.target.value === '__other') { const n = bmEditing; const p = parentOf(n?.id); e.target.value = p?.id || 'bar'; if (n) { hideBmEdit(); openBmDialog(n); } } };
let bmDlg = null;
function openBmDialog(n) {
  bmDlg = { n, sel: parentOf(n.id)?.id || 'bar', open: new Set(['bar', 'other']) };
  $('#bmdH').textContent = T(n.type === 'folder' ? 'Modifier le dossier' : 'Modifier le favori');
  $('#bmdName').value = n.title || ''; $('#bmdUrl').value = n.url || '';
  $('#bmdUrl').style.display = $('#bmdUrlL').style.display = n.type === 'folder' ? 'none' : '';
  // les dossiers qui mènent au dossier actuel sont ouverts
  let p = parentOf(n.id); while (p) { bmDlg.open.add(p.id); p = parentOf(p.id); }
  drawBmTree();
  $('#bmDlg').classList.add('on');
  setTimeout(() => { $('#bmdName').focus(); $('#bmdName').select(); }, 30);
}
function drawBmTree(editId) {
  const out = [];
  const w = (l, d) => l.forEach(f => {
    if (f.type !== 'folder' || (bmDlg.n.type === 'folder' && f.id === bmDlg.n.id)) return;
    const kids = f.children.filter(c => c.type === 'folder' && c.id !== bmDlg.n.id);
    const open = bmDlg.open.has(f.id);
    out.push(`<div class="tn ${f.id === bmDlg.sel ? 'on' : ''}" data-f="${esc(f.id)}" style="padding-left:${8 + d * 18}px"><span class="tw" data-tw>${kids.length ? ic(open ? 'fwd' : 'fwd') : ''}</span>${ic('folder')}${f.id === editId ? `<input type="text" id="bmdFolderName" value="${esc(f.title)}" spellcheck="false">` : `<span class="${['bar', 'other'].includes(f.id) ? '' : 'notr'}">${esc(['bar', 'other'].includes(f.id) ? T(f.title) : f.title)}</span>`}</div>`);
    if (open) w(f.children, d + 1);
  });
  w([BM.bar, BM.other], 0);
  $('#bmdTree').innerHTML = out.join('');
  $$('#bmdTree [data-f]').forEach(r => { const tw = r.querySelector('[data-tw] svg'); if (tw) tw.style.transform = bmDlg.open.has(r.dataset.f) ? 'rotate(90deg)' : ''; });
  const inp = $('#bmdFolderName');
  if (inp) {
    inp.focus(); inp.select();
    const done = async () => { if (!inp.isConnected) return; const v = inp.value.trim(); if (v) await B.call('br:bmUpdate', editId, { title: v }); drawBmTree(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); done(); } else if (e.key === 'Escape') { e.preventDefault(); drawBmTree(); } };
    inp.onblur = done;
  }
}
$('#bmdTree').onclick = e => {
  const r = e.target.closest('[data-f]'); if (!r || e.target.closest('input')) return;
  const id = r.dataset.f;
  if (e.target.closest('[data-tw]')) { bmDlg.open.has(id) ? bmDlg.open.delete(id) : bmDlg.open.add(id); }
  else { bmDlg.sel = id; bmDlg.open.add(id); }
  drawBmTree();
};
$('#bmdTree').ondblclick = e => { const r = e.target.closest('[data-f]'); if (r && !['bar', 'other'].includes(r.dataset.f)) drawBmTree(r.dataset.f); };
$('#bmdNew').onclick = async () => {
  const f = await B.call('br:bmAdd', { parentId: bmDlg.sel, type: 'folder', title: T('Nouveau dossier') });
  BM = await B.call('br:bmTree');
  bmDlg.open.add(bmDlg.sel); bmDlg.sel = f.id; drawBmTree(f.id);
};
const closeBmDialog = () => { $('#bmDlg').classList.remove('on'); bmDlg = null; };
$('#bmdCancel').onclick = closeBmDialog;
$('#bmDlg').onmousedown = e => { if (e.target === e.currentTarget) closeBmDialog(); };
$('#bmdSave').onclick = async () => {
  const d = bmDlg; if (!d) return;
  const patch = { title: $('#bmdName').value.trim() || d.n.title };
  if (d.n.type !== 'folder') { let u = $('#bmdUrl').value.trim(); if (u && !/^[a-z][\w+.-]*:/i.test(u)) u = 'https://' + u; if (u) patch.url = u; }
  await B.call('br:bmUpdate', d.n.id, patch);
  const p = parentOf(d.n.id);
  if (d.sel && (!p || d.sel !== p.id)) await B.call('br:bmMove', [d.n.id], d.sel, -1);
  closeBmDialog(); toast('Favori enregistré');
};
$('#bmDlg').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeBmDialog(); } else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.id !== 'bmdFolderName') $('#bmdSave').click(); });
$('#bmeDel').onclick = async () => { const n = bmEditing; hideBmEdit(); if (n) { await B.call('br:bmRemove', [n.id]); toast('Retiré des favoris'); } };
$('#bmeMgr').onclick = () => { hideBmEdit(); openPage('bookmarks'); };
document.addEventListener('mousedown', e => { if (bmEditing && !e.target.closest('#bmEdit') && !e.target.closest('#bStar')) $('#bmeOk').click(); });
B.on('bm', ({ tree, flat }) => { BM = tree; STORE.bookmarks = flat; drawBmBar(); updToolbar(); if ($('#start').classList.contains('on')) drawTiles(); });

// ---------- extensions intégrées : boutons de la barre d'outils ----------
function drawMods() {
  const box = $('#tbItems'); if (!box) return;
  const M = CFG.mods || {};
  const t = cur || {};
  const want = [['translate', 'translate', 'Traduire (Ctrl+Maj+E)', t.tr && ['done', 'working'].includes(t.tr.state)], ['scan', 'scan', 'Traducteur de scans', false], ['lights', 'bulb', 'Lumières tamisées (Ctrl+Maj+L)', t.lit], ['pip', 'pip', "Image dans l'image (Ctrl+Maj+U)", false]];
  for (const [id, icon, title, act] of want) {
    let b = box.querySelector(`[data-mod="${id}"]`);
    const show = M[id]?.on && M[id]?.pinned !== false;
    if (!show) { b?.remove(); continue; }
    if (!b) { b = document.createElement('button'); b.className = 'tb mod'; b.dataset.mod = id; b.dataset.key = 'mod:' + id; b.innerHTML = `<svg><use href="#i-${icon}"/></svg>`; b.title = T(title); box.appendChild(b); }
    b.classList.toggle('act', !!act);
  }
  sortToolbar();
}
// ordre des boutons d'extensions (réglage browser.tbOrder) ; les nouveaux vont à la fin
function tbOrder() { return CFG.tbOrder || []; }
function sortToolbar() {
  const box = $('#tbItems'); if (!box) return;
  const order = tbOrder(), kids = [...box.children];
  const rank = el => { const k = order.indexOf(el.dataset.key); return k < 0 ? 1000 + kids.indexOf(el) : k; };
  const sorted = kids.slice().sort((a, b) => rank(a) - rank(b));
  if (sorted.some((el, i) => el !== kids[i])) sorted.forEach(el => box.appendChild(el));
  kids.forEach(el => { if (el.getAttribute('draggable') !== 'true') el.setAttribute('draggable', 'true'); });
}
async function saveOrder(keys) {
  const all = [...new Set([...keys, ...tbOrder()])];
  CFG.tbOrder = all; CFG = { ...CFG, ...(await B.call('br:setSettings', { tbOrder: all })) };
  sortToolbar(); if (typeof POP !== 'undefined' && POP.kind === 'ext') popRender();
}
// glisser-déposer dans la barre d'outils
(() => {
  const box = $('#tbItems'); let drag = null;
  const clear = () => box.querySelectorAll('.drop-l,.drop-r').forEach(x => x.classList.remove('drop-l', 'drop-r'));
  box.addEventListener('dragstart', e => { const b = e.target.closest('#tbItems > .tb'); if (!b) return; drag = b; b.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/x-dryae-tb', b.dataset.key || ''); } catch {} });
  box.addEventListener('dragover', e => { if (!drag) return; const b = e.target.closest('#tbItems > .tb'); e.preventDefault(); clear(); if (!b || b === drag) return; const r = b.getBoundingClientRect(); b.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-l' : 'drop-r'); });
  box.addEventListener('dragleave', e => { if (!box.contains(e.relatedTarget)) clear(); });
  box.addEventListener('drop', e => {
    if (!drag) return; e.preventDefault();
    const b = e.target.closest('#tbItems > .tb');
    if (b && b !== drag) { const r = b.getBoundingClientRect(); b.parentNode.insertBefore(drag, e.clientX < r.left + r.width / 2 ? b : b.nextSibling); }
    clear(); saveOrder([...box.children].map(x => x.dataset.key).filter(Boolean));
  });
  box.addEventListener('dragend', () => { drag?.classList.remove('dragging'); drag = null; clear(); });
})();
$('#tbItems').addEventListener('click', e => {
  const b = e.target.closest('[data-mod]'); if (!b) return;
  const id = b.dataset.mod;
  if (id === 'pip') return cur?.wcId && B.call('br:pip', cur.wcId);
  popOpen(id, b);
});
$('#tbItems').addEventListener('contextmenu', e => {
  const b = e.target.closest('[data-mod]'); if (!b) return; e.preventDefault();
  const id = b.dataset.mod;
  menu(e.clientX - 200, e.clientY + 8, [
    id === 'lights' && { label: 'Mode nuit sur ce site', icon: 'moon', check: !!cur?.night, fn: () => pageCmd('night') },
    { label: 'Paramètres', icon: 'gear', fn: () => openPage('settings', id) },
    { label: 'Retirer de la barre d\'outils', icon: 'x', fn: () => setModule(id, { pinned: false }) },
    { label: 'Gérer les extensions', icon: 'puzzle', fn: () => openPage('extensions') },
  ].filter(Boolean));
});
// barre de traduction de la page
function drawTrBar() {
  const t = cur, tr = t && t.tr, bar = $('#trBar');
  const show = tr && ['working', 'done', 'error'].includes(tr.state);
  bar.classList.toggle('on', !!show);
  if (!show) return;
  const ln = c => { try { return new Intl.DisplayNames([(window.I18N && I18N.lang) || 'fr'], { type: 'language' }).of(c) || c; } catch { return c || ''; } };
  $('#trTxt').textContent = tr.state === 'working' ? T('Traduction de la page…') + (tr.total ? ` ${Math.min(100, Math.round(100 * (tr.done || 0) / tr.total))} %` : '')
    : tr.state === 'error' ? T('Traduction impossible : {0}').replace('{0}', tr.msg || '') : T('Page traduite : {0} → {1}').replace('{0}', ln(tr.from)).replace('{1}', ln(tr.to));
  $('#trOrig').style.display = tr.state === 'error' ? 'none' : '';
}
$('#trOrig').onclick = () => pageCmd('translate-off');
$('#trX').onclick = () => { if (cur) { cur.tr = null; drawTrBar(); drawMods(); } };
B.on('page-cmd', ({ wcId, cmd, ...x }) => { const t = tabByWc(wcId); if (t) pageCmd(cmd, x, t); });
B.on('toast', m => toast(m));

// ---------- téléchargements faits par le navigateur (sans DrYAE) ----------
let ND = [];
function drawNdBtn() {
  const act = ND.filter(d => d.state === 'progressing');
  $('#bNd').classList.toggle('on', !modOn('capture') && (ND.length > 0 || panel === 'nd'));
  $('#bNd').classList.toggle('busy', act.length > 0);
  $('#ndN').textContent = act.length; $('#ndN').classList.toggle('on', act.length > 0);
}
function drawNd() {
  $('#pTitle').textContent = T('Téléchargements du navigateur');
  const st = d => d.state === 'completed' ? fmt(d.total || d.received) : d.state === 'cancelled' ? T('Annulé') : d.state === 'interrupted' ? T('Échec') : d.paused ? T('En pause') + ' · ' + fmt(d.received) + (d.total > 0 ? ' / ' + fmt(d.total) : '') : fmt(d.received) + (d.total > 0 ? ' / ' + fmt(d.total) : '');
  $('#pBody').innerHTML = ND.length ? ND.map((d, i) => `<div class="nditem"><div class="n">${esc(d.name || d.url)}</div><div class="s">${esc(st(d))}</div>${d.state === 'progressing' && d.total > 0 ? `<div class="bar"><i style="width:${Math.round(100 * d.received / d.total)}%"></i></div>` : ''}
    <div class="row">${d.state === 'completed' ? `<button class="btn sm" data-nd="open" data-i="${i}">${esc(T('Ouvrir'))}</button><button class="btn sm" data-nd="show" data-i="${i}">${esc(T('Afficher dans le dossier'))}</button>` : ''}
    ${d.state === 'progressing' ? `<button class="btn sm" data-nd="${d.paused ? 'resume' : 'pause'}" data-i="${i}">${ic(d.paused ? 'play' : 'pause')}${esc(T(d.paused ? 'Reprendre' : 'Pause'))}</button><button class="btn sm" data-nd="cancel" data-i="${i}">${esc(T('Annuler'))}</button>` : `<button class="btn sm" data-nd="remove" data-i="${i}">${esc(T('Retirer de la liste'))}</button>`}</div></div>`).join('')
    : `<p class="hint">${esc(T('Aucun téléchargement. Les fichiers sont enregistrés par le navigateur, sans passer par DrYAE (extension « Téléchargements par DrYAE » désactivée).'))}</p>`;
  const f = $('#pFoot'); f.style.display = 'flex';
  f.innerHTML = `<button class="btn sm" id="ndDir">${ic('folder')}${esc(T('Ouvrir le dossier'))}</button><button class="btn sm" id="ndClr">${ic('trash')}${esc(T('Effacer la liste'))}</button><span class="sp"></span><button class="btn sm" id="ndMgr">${esc(T('Gestionnaire DrYAE'))}</button>`;
  $('#ndDir').onclick = () => B.call('br:ndFolder'); $('#ndClr').onclick = () => B.call('br:ndClear'); $('#ndMgr').onclick = () => B.call('br:openMain');
  $('#pBody').onclick = e => { const b = e.target.closest('[data-nd]'); if (b) B.call('br:ndAct', ND[+b.dataset.i].id, b.dataset.nd); };
}
$('#bNd').onclick = () => togglePanel('nd');
B.on('nd', list => { ND = list; drawNdBtn(); if (panel === 'nd') drawNd(); });
B.on('nd-start', () => { togglePanel('nd', true); });

// ---------- icône de mise à jour : visible dès l'ouverture, jusqu'à l'installation ----------
let UPD = null;
function drawUpd(u) {
  if (u && u.ok !== undefined) u = u.v;
  UPD = u || UPD;
  const on = !!(UPD && ['available', 'downloading', 'ready'].includes(UPD.status));
  $('#bUpd').classList.toggle('on', on);
  if (on) $('#bUpd').title = UPD.status === 'ready' ? T('La mise à jour {0} est prête.').replace('{0}', UPD.version || '') : UPD.status === 'downloading' ? T('Téléchargement de la mise à jour… {0} %').replace('{0}', Math.round(UPD.progress || 0)) : T('DrYAE {0} est disponible.').replace('{0}', UPD.version || '');
}
$('#bUpd').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  const u = UPD || {};
  menu(r.right - 300, r.bottom + 4, [
    { title: u.status === 'ready' ? T('La mise à jour {0} est prête.').replace('{0}', u.version || '') : T('DrYAE {0} est disponible.').replace('{0}', u.version || '') },
    u.status === 'downloading' ? { label: T('Téléchargement de la mise à jour… {0} %').replace('{0}', Math.round(u.progress || 0)), icon: 'upd', fn: () => {}, disabled: true }
      : { label: u.status === 'ready' ? 'Redémarrer et installer' : 'Mettre à jour', icon: 'upd', hl: true, fn: () => B.call('upd:install') },
    { label: 'Nouveautés de cette version', icon: 'help', fn: () => newTab((u.releasesUrl || 'https://github.com/DrYAE-FPA/DrYAE/releases') + '/latest') },
  ]);
};
B.on('update-state', drawUpd);

// ---------- pages internes et réglages ----------
B.on('open-page', async ({ url }) => {
  await ready;
  const base = url.replace(/#.*$/, '');
  const t = tabs.find(x => (x.url || '').replace(/#.*$/, '') === base);
  if (t) { select(t); if (url !== t.url) navigate(t, url); }
  else newTab(url);
});
B.on('nav-tab', ({ wcId, url }) => { const t = tabByWc(wcId); if (t) navigate(t, url); });
B.on('cfg', c => { CFG = { ...CFG, ...c }; applyTheme(CFG.theme || {}); drawBmBar(); drawMods(); drawNdBtn(); updToolbar(); });
B.on('ext-changed', () => {});
ready.then(async () => {
  BM = await B.call('br:bmTree');
  window.A11Y?.apply(CFG.a11y); drawBmBar(); drawMods(); drawNdBtn();
  B.call('upd:info').then(drawUpd).catch(() => {});
  ND = await B.call('br:nd'); drawNdBtn();
});
