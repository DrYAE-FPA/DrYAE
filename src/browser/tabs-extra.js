/* DrYAE — navigateur, 1.6.9 : menu des onglets, groupes, vue côte à côte, recherche dans les onglets,
   aperçu au survol, économiseurs de mémoire et d'énergie, contrôle des médias, panneau latéral (favoris,
   historique, pages hors ligne, notes, traducteur), page « Nouvel onglet » personnalisable, onglets verticaux. */
'use strict';
const XS = () => CFG.tabsx || {};
const setX = async patch => { CFG = { ...CFG, ...(await B.call('br:setSettings', { tabsx: { ...XS(), ...patch } })) }; };

// ---------------------------------------------------------------- menu des onglets (clic droit)
$('#tabs').addEventListener('contextmenu', e => {
  const el = e.target.closest('.tab'); if (!el) return;
  e.preventDefault();
  const t = tabs.find(x => x.el === el); if (!t) return;
  const i = tabs.indexOf(t);
  const gs = Object.entries(GROUPS);
  menu(e.clientX, e.clientY, [
    { label: 'Nouvel onglet à droite', icon: 'plus', fn: () => { const n = newTab('', { background: false }); moveTab(n, t, true); drawGroups(); } },
    { label: 'Actualiser', icon: 'reload', fn: () => t.wv?.reload(), disabled: !t.wv },
    { label: 'Dupliquer', icon: 'copy', fn: () => { const n = newTab(t.url, { background: true }); moveTab(n, t, true); if (t.group) { n.group = t.group; drawGroups(); } }, disabled: !t.url },
    { label: t.wv?.isAudioMuted?.() ? 'Réactiver le son' : 'Couper le son', icon: 'sound', fn: () => { t.wv?.setAudioMuted(!t.wv.isAudioMuted()); updTab(t); }, disabled: !t.wv },
    '-',
    t.split ? { label: 'Séparer la vue côte à côte', icon: 'swap', fn: () => unsplit(t) }
      : { label: 'Afficher côte à côte avec l\'onglet actuel', icon: 'swap', fn: () => splitWith(cur, t), disabled: t === cur || !t.url || !cur?.url },
    { label: 'Ajouter à un groupe', icon: 'folder', sub: () => [
      { label: 'Nouveau groupe…', icon: 'plus', fn: () => newGroup(t) },
      ...(gs.length ? ['-', ...gs.map(([g, x]) => ({ label: x.name || T('Sans nom'), icon: 'folder', check: t.group === g, fn: () => addToGroup(t, g) }))] : []),
    ] },
    t.group ? { label: 'Retirer du groupe', icon: 'x', fn: () => { t.group = null; drawGroups(); saveGroups(); } } : null,
    { label: 'Regrouper les onglets par site', icon: 'list', fn: groupBySite },
    window.WORK && !t.incognito ? { label: 'Rouvrir dans un conteneur', icon: 'box', sub: () => WORK.ctnMenu(t) } : null,
    t.url ? { label: 'Déplacer vers une nouvelle fenêtre', icon: 'newwin', fn: () => { B.call('br:newWindow', t.url, t.incognito); if (tabs.length > 1) closeTab(t); } } : null,
    t.url ? { label: 'Déplacer vers une autre fenêtre', icon: 'newwin', sub: async () => { const ws = await B.call('br:windows').catch(() => []); return ws.length ? ws.map(w => ({ label: w.title, icon: 'newwin', fn: async () => { if (await B.call('br:moveTo', w.id, t.url, t.incognito)) closeTab(t); } })) : [{ label: 'Aucune autre fenêtre ouverte', icon: 'newwin', disabled: true }]; } } : null,
    '-',
    { label: 'Fermer', icon: 'x', key: 'Ctrl+W', fn: () => closeTab(t) },
    { label: 'Fermer les autres onglets', icon: 'x', fn: () => tabs.filter(x => x !== t).forEach(closeTab), disabled: tabs.length < 2 },
    { label: 'Fermer les onglets à droite', icon: 'x', fn: () => tabs.slice(i + 1).forEach(closeTab), disabled: i === tabs.length - 1 },
  ]);
});

// ---------------------------------------------------------------- groupes d'onglets
const GCOLORS = { gris: '#8a91a3', bleu: '#3b82f6', rouge: '#ef4444', jaune: '#eab308', vert: '#22c55e', rose: '#ec4899', violet: '#8b5cf6', cyan: '#06b6d4', orange: '#f97316' };
let GROUPS = {};
try { GROUPS = JSON.parse(localStorage.getItem('dryae-groups') || '{}'); } catch {}
const saveGroups = () => { try { localStorage.setItem('dryae-groups', JSON.stringify(GROUPS)); } catch {} saveSession(); };
function newGroup(t, name) {
  const g = 'g' + Date.now().toString(36);
  const used = new Set(Object.values(GROUPS).map(x => x.color));
  GROUPS[g] = { name: name || '', color: Object.keys(GCOLORS).find(c => !used.has(c)) || 'bleu', collapsed: false };
  addToGroup(t, g);
  if (!name) setTimeout(() => renameGroup(g), 50);
  return g;
}
function addToGroup(t, g) {
  t.group = g;
  // les onglets d'un groupe restent côte à côte
  const last = tabs.filter(x => x.group === g && x !== t).pop();
  if (last) moveTab(t, last, true);
  drawGroups(); saveGroups();
}
function renameGroup(g) {
  const chip = document.querySelector(`.tgrp[data-g="${g}"]`); if (!chip) return;
  const inp = document.createElement('input'); inp.value = GROUPS[g].name || ''; inp.className = 'tgin'; inp.placeholder = T('Nom du groupe');
  chip.replaceChildren(inp); inp.focus(); inp.select();
  const done = () => { GROUPS[g].name = inp.value.trim().slice(0, 40); drawGroups(); saveGroups(); };
  inp.onblur = done; inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = GROUPS[g].name || ''; inp.blur(); } e.stopPropagation(); };
}
function drawGroups() {
  $$('#tabs .tgrp').forEach(x => x.remove());
  for (const g of Object.keys(GROUPS)) if (!tabs.some(t => t.group === g)) delete GROUPS[g];
  for (const t of tabs) {
    const G = t.group && GROUPS[t.group];
    t.el.classList.toggle('ingrp', !!G);
    t.el.style.setProperty('--gc', G ? GCOLORS[G.color] || G.color : 'transparent');
    t.el.classList.toggle('gcol', !!(G && G.collapsed && t !== cur));
  }
  for (const [g, G] of Object.entries(GROUPS)) {
    const first = tabs.find(t => t.group === g); if (!first) continue;
    const chip = document.createElement('button');
    chip.className = 'tgrp' + (G.collapsed ? ' col' : ''); chip.dataset.g = g;
    chip.style.setProperty('--gc', GCOLORS[G.color] || G.color);
    chip.title = T(G.collapsed ? 'Afficher les onglets du groupe' : 'Replier le groupe') + ' · ' + T('clic droit : options');
    chip.textContent = G.name || (G.collapsed ? tabs.filter(t => t.group === g).length : '');
    chip.onclick = () => { G.collapsed = !G.collapsed; drawGroups(); saveGroups(); };
    chip.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); menu(e.clientX, e.clientY, [
      { label: 'Renommer le groupe', icon: 'star', fn: () => renameGroup(g) },
      { title: 'Couleur' }, ...Object.keys(GCOLORS).map(c => ({ label: T(c.charAt(0).toUpperCase() + c.slice(1)), icon: 'check', check: G.color === c, fn: () => { G.color = c; drawGroups(); saveGroups(); } })),
      '-', { label: 'Nouvel onglet dans le groupe', icon: 'plus', fn: () => { const n = newTab(); addToGroup(n, g); select(n); } },
      { label: 'Dissocier le groupe', icon: 'list', fn: () => { tabs.forEach(t => { if (t.group === g) t.group = null; }); delete GROUPS[g]; drawGroups(); saveGroups(); } },
      { label: 'Fermer le groupe', icon: 'x', fn: () => tabs.filter(t => t.group === g).forEach(closeTab) },
    ]); };
    $('#tabs').insertBefore(chip, first.el);
  }
}
// rangement en un clic : un groupe par site (2 onglets ou plus), sans intelligence artificielle
function groupBySite() {
  const by = new Map();
  for (const t of tabs) { const h = hostOf(t.url).replace(/^www\./, ''); if (!h) continue; if (!by.has(h)) by.set(h, []); by.get(h).push(t); }
  let n = 0;
  for (const [h, list] of by) {
    if (list.length < 2) continue;
    const g = list[0].group && list.every(t => t.group === list[0].group) ? list[0].group : null;
    const gid = g || newGroup(list[0], h);
    for (const t of list.slice(1)) addToGroup(t, gid);
    n++;
  }
  toast(n ? T('{0} groupe(s) créé(s)').replace('{0}', n) : T('Rien à regrouper : il faut au moins 2 onglets du même site'));
}

// ---------------------------------------------------------------- vue côte à côte
let splitRatio = +localStorage.getItem('dryae-split') || 50;
function splitWith(a, b) {
  if (!a || !b || a === b) return;
  unsplit(a); unsplit(b);
  a.split = b; b.split = a; a.splitSide = 'l'; b.splitSide = 'r';
  if (!b.wv && b.url) { ensureWebview(b); navigate(b, b.url); }
  b.lazy = false;
  // les deux onglets se suivent dans la barre
  moveTab(b, a, true);
  layoutSplit(); updTab(a); updTab(b); drawGroups();
}
function unsplit(t) {
  const o = t?.split; if (!o) return;
  t.split = null; o.split = null; t.splitSide = o.splitSide = null;
  [t, o].forEach(x => { if (x.wv) { x.wv.style.left = ''; x.wv.style.width = ''; } x.el.classList.remove('split'); });
  $('#splitBar')?.remove();
  showView(cur);
}
function layoutSplit() {
  const t = cur; if (!t || !t.split) { $('#splitBar')?.remove(); return; }
  const L = t.splitSide === 'l' ? t : t.split, R = L.split;
  for (const [x, left, w] of [[L, 0, splitRatio], [R, splitRatio, 100 - splitRatio]]) {
    if (!x.wv) continue;
    x.wv.classList.add('on'); x.wv.style.left = left + '%'; x.wv.style.width = w + '%';
    x.el.classList.add('split');
  }
  $('#start').classList.remove('on');
  let bar = $('#splitBar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'splitBar'; bar.className = 'splitbar'; bar.title = T('Glisser pour régler la largeur · double-clic : moitié-moitié');
    bar.setAttribute('role', 'separator'); bar.tabIndex = 0;
    bar.onmousedown = e => {
      e.preventDefault(); const r = $('#views').getBoundingClientRect();
      const cover = document.createElement('div'); cover.style.cssText = 'position:fixed;inset:0;z-index:50;cursor:col-resize'; document.body.appendChild(cover);
      const mv = ev => { splitRatio = Math.max(20, Math.min(80, (ev.clientX - r.left) / r.width * 100)); layoutSplit(); };
      const up = () => { cover.remove(); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); localStorage.setItem('dryae-split', splitRatio); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    };
    bar.ondblclick = () => { splitRatio = 50; layoutSplit(); localStorage.setItem('dryae-split', 50); };
    bar.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { splitRatio = Math.max(20, Math.min(80, splitRatio + (e.key === 'ArrowRight' ? 5 : -5))); layoutSplit(); e.preventDefault(); } };
    // menu de la vue côte à côte : bouton au milieu de la barre (ou clic droit sur la barre)
    const mb = document.createElement('button'); mb.className = 'splitmenu'; mb.id = 'splitMenu'; mb.innerHTML = ic('more'); mb.title = T('Organiser la vue côte à côte');
    mb.setAttribute('aria-haspopup', 'menu');
    mb.onmousedown = e => e.stopPropagation();
    mb.onclick = e => { e.stopPropagation(); const r = mb.getBoundingClientRect(); splitMenu(r.right + 4, r.top); };
    bar.appendChild(mb);
    bar.oncontextmenu = e => { e.preventDefault(); splitMenu(e.clientX, e.clientY); };
    $('#views').appendChild(bar);
  }
  bar.style.left = `calc(${splitRatio}% - 3px)`;
  // côté actif bien visible
  for (const x of [L, R]) x.wv?.classList.toggle('sideon', x === t);
}
function setRatio(v) { splitRatio = v; layoutSplit(); localStorage.setItem('dryae-split', v); }
// défilement lié : les deux pages défilent ensemble (à la même proportion)
let linkScroll = localStorage.getItem('dryae-split-link') === '1', linkT = 0, linkLast = null;
function linkTick() {
  clearTimeout(linkT);
  if (!linkScroll || !cur?.split || !cur.wv || !cur.split.wv) { linkLast = null; return; }
  const a = cur, b = cur.split;
  a.wv.executeJavaScript('(() => { const h = document.documentElement.scrollHeight - innerHeight; return h > 0 ? scrollY / h : 0; })()', false).then(r => {
    if (linkLast === null || Math.abs(r - linkLast) > 0.002) { linkLast = r; b.wv.executeJavaScript(`(() => { const h = document.documentElement.scrollHeight - innerHeight; if (h > 0) scrollTo(scrollX, ${+r || 0} * h); })()`, false).catch(() => {}); }
  }).catch(() => {}).finally(() => { linkT = setTimeout(linkTick, 150); });
}
function splitMenu(x, y) {
  const t = cur; if (!t || !t.split) return;
  const L = t.splitSide === 'l' ? t : t.split, R = L.split;
  menu(x, y, [
    { title: 'Vue côte à côte' },
    { label: T('Inverser les côtés'), icon: 'swap', fn: () => { L.splitSide = 'r'; R.splitSide = 'l'; layoutSplit(); } },
    { label: T('Séparer les onglets'), icon: 'swap', fn: () => unsplit(t) },
    '-',
    { label: T('Moitié-moitié'), check: Math.abs(splitRatio - 50) < 1, fn: () => setRatio(50) },
    { label: T('Gauche plus large (2/3)'), check: Math.abs(splitRatio - 66.7) < 1, fn: () => setRatio(66.7) },
    { label: T('Droite plus large (2/3)'), check: Math.abs(splitRatio - 33.3) < 1, fn: () => setRatio(33.3) },
    '-',
    { label: T('Faire défiler les deux côtés ensemble'), check: linkScroll, icon: 'link', fn: () => { linkScroll = !linkScroll; localStorage.setItem('dryae-split-link', linkScroll ? '1' : '0'); linkLast = null; linkTick(); } },
    '-',
    { label: T('Fermer la vue de gauche'), icon: 'x', fn: () => closeTab(L) },
    { label: T('Fermer la vue de droite'), icon: 'x', fn: () => closeTab(R) },
  ]);
}
// l'affichage normal, puis la vue côte à côte si l'onglet en fait partie
const _showView = showView;
showView = function (tab) {
  $$('webview').forEach(w => { if (!tab.split || (w !== tab.wv && w !== tab.split.wv)) { w.style.left = ''; w.style.width = ''; w.classList.remove('sideon'); } });
  _showView(tab);
  if (tab.split) { layoutSplit(); if (linkScroll) { linkLast = null; linkTick(); } } else $('#splitBar')?.remove();
};
// clic dans l'une des deux pages : elle devient l'onglet actif (barre d'adresse, boutons…)
document.addEventListener('focusin', e => {
  if (e.target.tagName !== 'WEBVIEW' || !cur?.split) return;
  const t = tabs.find(x => x.wv === e.target);
  if (t && t !== cur && t === cur.split) select(t);
});
const _closeTab = closeTab;
closeTab = function (tab) { if (tab.split) unsplit(tab); _closeTab(tab); drawGroups(); };

// ---------------------------------------------------------------- recherche dans les onglets (Ctrl+Maj+A)
function tabSearch() {
  const box = $('#tsDlg');
  let sel = 0;
  box.classList.add('on');
  const inp = $('#tsQ'); inp.value = '';
  setTimeout(() => inp.focus(), 20);
  function items() {
    const q = inp.value.trim().toLowerCase();
    const open = tabs.filter(t => !q || (t.title + ' ' + t.url).toLowerCase().includes(q)).map(t => ({ t, title: t.title || t.url || T('Nouvel onglet'), url: t.url, fav: t.fav }));
    const closed = closedTabs.slice().reverse().filter(c => !q || (c.title + ' ' + c.url).toLowerCase().includes(q)).slice(0, 8).map(c => ({ c, title: c.title || c.url, url: c.url, fav: c.fav }));
    return { open, closed };
  }
  function draw() {
    const { open, closed } = items(); sel = Math.min(sel, open.length + closed.length - 1);
    let k = 0;
    const row = x => `<button class="tsr ${k === sel ? 'on' : ''}" data-k="${k++}">${x.fav ? `<img src="${esc(x.fav)}" alt="">` : `<span class="fav">•</span>`}<span class="tt"><b class="notr">${esc(x.title)}</b><small class="notr">${esc(x.url ? hostOf(x.url) : '')}</small></span>${x.t ? `<span class="x" data-close="${x.t.id}" title="${esc(T('Fermer'))}">${ic('x')}</span>` : ''}</button>`;
    $('#tsList').innerHTML = (open.length ? `<div class="tsh">${esc(T('Onglets ouverts'))} (${open.length})</div>` + open.map(row).join('') : '') + (closed.length ? `<div class="tsh">${esc(T('Fermés récemment'))}</div>` + closed.map(row).join('') : '') || `<p class="hint" style="padding:12px">${esc(T('Aucun onglet trouvé'))}</p>`;
    $('#tsList')._items = [...open, ...closed];
  }
  const go = k => { const x = $('#tsList')._items[k]; if (!x) return; close(); if (x.t) select(x.t); else newTab(x.url); };
  const close = () => { box.classList.remove('on'); inp.oninput = inp.onkeydown = null; };
  inp.oninput = () => { sel = 0; draw(); };
  inp.onkeydown = e => {
    const n = ($('#tsList')._items || []).length;
    if (e.key === 'ArrowDown') { sel = (sel + 1) % n; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + n) % n; draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { go(sel); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.stopPropagation(); }
  };
  $('#tsList').onclick = e => {
    const c = e.target.closest('[data-close]'); if (c) { e.stopPropagation(); const t = tabs.find(x => x.id === +c.dataset.close); if (t) closeTab(t); return draw(); }
    const b = e.target.closest('[data-k]'); if (b) go(+b.dataset.k);
  };
  box.onmousedown = e => { if (e.target === box) close(); };
  draw();
}

// ---------------------------------------------------------------- aperçu au survol (image, adresse, mémoire)
let hovT = 0, hovTab = null, MET = {};
$('#tabs').addEventListener('mouseover', e => {
  const el = e.target.closest('.tab'); const t = el && tabs.find(x => x.el === el);
  if (t === hovTab) return;
  hovTab = t; clearTimeout(hovT); $('#tabPrev').classList.remove('on');
  if (!t || XS().preview === false) return;
  hovT = setTimeout(async () => {
    if (hovTab !== t) return;
    const r = el.getBoundingClientRect(); const P = $('#tabPrev');
    MET = await B.call('br:metrics').catch(() => ({}));
    const m = t.wcId && MET[t.wcId];
    const img = t !== cur && t.thumb ? `<img src="${t.thumb}" alt="">` : '';
    P.innerHTML = `<b class="notr">${esc(t.title || T('Nouvel onglet'))}</b><small class="notr">${esc(t.url ? hostOf(t.url) : '')}</small>${img}<small>${t.sleeping ? esc(T('Onglet en veille (mémoire libérée)')) : m ? esc(T('Mémoire : {0} Mo').replace('{0}', Math.round(m.mem / 1024))) : ''}</small>`;
    P.style.left = Math.max(6, Math.min(innerWidth - 270, r.left)) + 'px'; P.style.top = (r.bottom + 4) + 'px';
    P.classList.add('on');
  }, 550);
});
$('#tabs').addEventListener('mouseleave', () => { hovTab = null; clearTimeout(hovT); $('#tabPrev').classList.remove('on'); });
// image de l'onglet gardée au moment où on le quitte
const _select = select;
select = function (tab) {
  const prev = cur;
  if (prev && prev !== tab && prev.wcId && prev.url && !prev.sleeping) B.call('br:thumb', prev.wcId).then(d => { if (d) prev.thumb = d; }).catch(() => {});
  if (tab.sleeping) wake(tab);
  tab.lastSeen = Date.now();
  if (prev && prev.split && prev.split !== tab) { /* on quitte une vue côte à côte */ prev.wv?.classList.remove('sideon'); }
  _select(tab);
  drawGroups();
};

// ---------------------------------------------------------------- économiseur de mémoire (onglets en veille)
const SLEEP_MIN = { light: 60, balanced: 20, max: 5 };
function sleepTab(t) {
  if (!t.wv || t === cur || t.split === cur) return;
  t.url = t.wv.getURL?.() || t.url;
  t.wv.remove(); t.wv = null; t.wcId = null; t.lazy = true; t.sleeping = true;
  t.el.classList.add('sleep'); updTab(t);
}
function wake(t) { t.sleeping = false; t.el.classList.remove('sleep'); }
async function saverTick() {
  const lv = XS().memSaver || 'balanced';
  let min = SLEEP_MIN[lv]; if (!min) return;
  if (ENERGY.on) min = Math.max(3, min / 2);
  const keep = (XS().keepActive || []).map(h => h.replace(/^www\./, ''));
  const now = Date.now();
  for (const t of tabs) {
    if (!t.wv || t === cur || t.incognito || t.split === cur || t.sleeping) continue;
    if (!t.lastSeen) { t.lastSeen = now; continue; }
    if (now - t.lastSeen < min * 60000) continue;
    const h = hostOf(t.url).replace(/^www\./, '');
    if (keep.some(k => h === k || h.endsWith('.' + k))) continue;
    // jamais en veille : son ou vidéo en cours, page qui télécharge, formulaire en cours de saisie
    let busy = false;
    try { busy = t.wv.isCurrentlyAudible() || await t.wv.executeJavaScript(`(() => { const f = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea')].some(x => x.value && x.value !== x.defaultValue); return f || !!document.pictureInPictureElement; })()`); } catch {}
    if (!busy) sleepTab(t);
  }
}
setInterval(saverTick, 60000);

// ---------------------------------------------------------------- économiseur d'énergie
const ENERGY = { on: false };
async function energyTick() {
  const mode = XS().energy || 'battery';
  let on = mode === 'always';
  if (mode === 'battery') { const p = await B.call('br:power').catch(() => ({})); on = !!p.battery; }
  if (on === ENERGY.on) return;
  ENERGY.on = on;
  // pages en arrière-plan : 30 images par seconde au plus ; animations de DrYAE réduites
  B.call('br:frameRate', tabs.filter(t => t.wcId).map(t => t.wcId), on ? 30 : 60);
  document.documentElement.classList.toggle('a-rm', on || !!CFG.a11y?.rm);
  $('#bLeaf').style.display = on ? '' : 'none';
}
setInterval(energyTick, 30000); setTimeout(energyTick, 3000);

// ---------------------------------------------------------------- contrôle des médias
async function mediaTick() {
  const playing = tabs.filter(t => { try { return t.wv && t.wv.isCurrentlyAudible(); } catch { return false; } });
  $('#bMedia').style.display = playing.length ? '' : 'none';
  tabs.forEach(t => t.el.classList.toggle('audible', playing.includes(t)));
}
setInterval(mediaTick, 1500);
const mjs = act => `(() => { const m = [...document.querySelectorAll('video,audio')].sort((a, b) => (b.paused ? 0 : 1) - (a.paused ? 0 : 1) || b.duration - a.duration)[0]; if (!m) return null; ${act}; return { paused: m.paused, muted: m.muted, title: document.title, t: m.currentTime, d: m.duration }; })()`;
async function mediaPop(anchor) {
  const list = tabs.filter(t => t.wv && (t.el.classList.contains('audible') || t.mediaPaused));
  const rows = await Promise.all(list.map(async t => ({ t, s: await t.wv.executeJavaScript(mjs('')).catch(() => null) })));
  const fmtT = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  menu(anchor.getBoundingClientRect().left - 180, anchor.getBoundingClientRect().bottom + 4, [
    { title: 'Lecture en cours' },
    ...rows.flatMap(({ t, s }) => [
      { label: (t.title || hostOf(t.url)) + (s && isFinite(s.d) ? ` · ${fmtT(s.t)} / ${fmtT(s.d)}` : ''), img: t.fav, icon: 'music', fn: () => select(t) },
      { label: s && s.paused ? 'Lecture' : 'Pause', icon: s && s.paused ? 'play' : 'pause', fn: () => { t.mediaPaused = !(s && s.paused); t.wv.executeJavaScript(mjs('m.paused ? m.play() : m.pause()')); } },
      { label: 'Reculer de 10 s', icon: 'back', fn: () => t.wv.executeJavaScript(mjs('m.currentTime = Math.max(0, m.currentTime - 10)')) },
      { label: 'Avancer de 10 s', icon: 'fwd', fn: () => t.wv.executeJavaScript(mjs('m.currentTime = Math.min(m.duration || 1e9, m.currentTime + 10)')) },
      { label: t.wv.isAudioMuted() ? 'Réactiver le son' : 'Couper le son', icon: 'sound', fn: () => { t.wv.setAudioMuted(!t.wv.isAudioMuted()); } },
      '-',
    ]),
  ].slice(0, -1));
}

// ---------------------------------------------------------------- panneau latéral
const SIDE_TABS = [['bm', 'star', 'Favoris'], ['hist', 'clock', 'Historique'], ['ws', 'spaces', 'Espaces de travail'], ['col', 'col', 'Collections'], ['off', 'save', 'Hors ligne'], ['notes', 'file', 'Notes'], ['tr', 'translate', 'Traducteur']];
let sideTab = localStorage.getItem('dryae-side') || 'bm';
function toggleSide(tabName) {
  const S = $('#side');
  if (S.classList.contains('on') && (!tabName || tabName === sideTab)) { S.classList.remove('on'); return; }
  if (tabName) sideTab = tabName;
  S.classList.add('on'); drawSide();
}
async function drawSide() {
  const S = $('#side'); if (!S.classList.contains('on')) return;
  localStorage.setItem('dryae-side', sideTab);
  $('#sideNav').innerHTML = SIDE_TABS.map(([k, i, l]) => `<button data-st="${k}" class="${k === sideTab ? 'on' : ''}" title="${esc(T(l))}" aria-label="${esc(T(l))}">${ic(i)}</button>`).join('') + `<span style="flex:1"></span><button data-st="x" title="${esc(T('Fermer le panneau'))}" aria-label="${esc(T('Fermer le panneau'))}">${ic('x')}</button>`;
  const body = $('#sideBody');
  const link = (u, t, f, extra = '') => `<button class="sl" data-u="${esc(u)}" title="${esc(u)}">${f ? `<img src="${esc(f)}" alt="">` : `<span class="fav">•</span>`}<span class="notr">${esc(t || u)}</span>${extra}</button>`;
  if (sideTab === 'bm') {
    const walk = (l, d) => l.map(n => n.type === 'folder' ? `<details ${d < 1 ? 'open' : ''} style="padding-left:${d * 10}px"><summary class="notr">${esc(['bar', 'other'].includes(n.id) ? T(n.title) : n.title)}</summary>${walk(n.children, d + 1)}</details>` : `<div style="padding-left:${d * 10}px">${link(n.url, n.title, n.fav)}</div>`).join('');
    body.innerHTML = `<h4>${esc(T('Favoris'))}</h4>` + walk([BM.bar, BM.other], 0);
  } else if (sideTab === 'hist') {
    const h = (await B.call('br:historyRecent', 60).catch(() => [])) || [];
    body.innerHTML = `<h4>${esc(T('Historique récent'))}</h4>` + h.map(x => link(x.url, x.title, x.fav)).join('') + `<button class="btn sm" data-page="history" style="margin-top:8px">${esc(T('Tout l\'historique'))}</button>`;
  } else if (sideTab === 'off') {
    const l = await B.call('br:offlineList').catch(() => []);
    body.innerHTML = `<h4>${esc(T('Pages hors ligne'))}</h4><p class="hint">${esc(T('Pages gardées sur ce PC, lisibles sans internet.'))}</p>` + (cur?.url && /^https?:/.test(cur.url) ? `<button class="btn sm primary" data-act="saveoff" style="margin:6px 0">${ic('save')}${esc(T('Garder cette page'))}</button>` : '') + (l.map(x => `<div class="slr">${link('off:' + x.id, x.title, x.fav)}<button class="icon-btn" data-deloff="${x.id}" title="${esc(T('Supprimer'))}">${ic('trash')}</button></div>`).join('') || `<p class="hint">${esc(T('Aucune page gardée.'))}</p>`);
  } else if (sideTab === 'notes') {
    const N = await B.call('br:notes').catch(() => ({}));
    const k = (cur?.url || '').split('#')[0];
    body.innerHTML = `<h4>${esc(T('Notes'))}</h4>` + (/^https?:/.test(k) ? `<label class="hint">${esc(T('Note pour cette page'))}</label><textarea id="noteTx" rows="8" style="width:100%;margin:4px 0" placeholder="${esc(T('Écrivez ici… (enregistré automatiquement)'))}">${esc(N[k]?.text || '')}</textarea>` : `<p class="hint">${esc(T('Ouvrez une page web pour y attacher une note.'))}</p>`)
      + `<h4 style="margin-top:12px">${esc(T('Toutes les notes'))}</h4>` + (Object.entries(N).sort((a, b) => b[1].t - a[1].t).map(([u, n]) => link(u, n.title, '', `<small class="notr" style="display:block;color:var(--dim)">${esc(n.text.slice(0, 80))}</small>`)).join('') || `<p class="hint">${esc(T('Aucune note.'))}</p>`);
    if (window.WORK) await WORK.drawMarks(body, k);
    const tx = $('#noteTx'); if (tx) { let tm = 0; tx.oninput = () => { clearTimeout(tm); tm = setTimeout(() => B.call('br:noteSet', k, tx.value), 500); }; }
  } else if ((sideTab === 'ws' || sideTab === 'col') && window.WORK) {
    await WORK.drawSide(sideTab, body);
  } else if (sideTab === 'tr') {
    body.innerHTML = `<h4>${esc(T('Traducteur'))}</h4><textarea id="sTrIn" rows="6" style="width:100%" placeholder="${esc(T('Texte à traduire'))}"></textarea><div class="row" style="margin:6px 0;gap:6px"><button class="btn sm primary" id="sTrGo">${esc(T('Traduire'))}</button><button class="btn sm" id="sTrSel">${esc(T('Texte sélectionné dans la page'))}</button></div><div id="sTrOut" class="notr" style="white-space:pre-wrap;background:var(--panel2);border-radius:8px;padding:8px;min-height:60px"></div>`;
    $('#sTrGo').onclick = async () => { const t = $('#sTrIn').value.trim(); if (!t) return; $('#sTrOut').textContent = '…'; try { const r = await B.call('br:trText', t); $('#sTrOut').textContent = r.text || r; } catch (e) { $('#sTrOut').textContent = String(e.message || e); } };
    $('#sTrSel').onclick = async () => { const s = await cur?.wv?.executeJavaScript('String(getSelection())').catch(() => ''); if (s) { $('#sTrIn').value = s; $('#sTrGo').click(); } };
  }
  if (window.I18N?.translateDom) try { I18N.translateDom(S); } catch {}
}
$('#side').addEventListener('click', async e => {
  const st = e.target.closest('[data-st]'); if (st) { if (st.dataset.st === 'x') return toggleSide(); sideTab = st.dataset.st; return drawSide(); }
  if (e.target.closest('[data-w]')) return; // espaces, collections et surlignages : gérés par work.js
  const d = e.target.closest('[data-deloff]'); if (d) { await B.call('br:offlineDel', d.dataset.deloff); return drawSide(); }
  const a = e.target.closest('[data-act]'); if (a && a.dataset.act === 'saveoff') return saveOffline();
  const p = e.target.closest('[data-page]'); if (p) return openPage(p.dataset.page);
  const u = e.target.closest('[data-u]'); if (!u) return;
  const url = u.dataset.u;
  if (url.startsWith('off:')) { const f = await B.call('br:offlineOpen', url.slice(4)); if (f) newTab(f); return; }
  if (e.ctrlKey) newTab(url, { background: true }); else navigate(cur, url);
});
async function saveOffline(tab = cur) {
  if (!tab?.wcId || !/^https?:/.test(tab.url || '')) return toast('Ouvre une page web d\'abord');
  const it = await B.call('br:saveOffline', tab.wcId).catch(() => null);
  if (it) toast(T('Page gardée pour la lecture hors ligne'), { label: 'Voir', fn: () => toggleSide('off') }); else toast('Impossible de garder cette page');
  drawSide();
}
async function fullShot(tab = cur) {
  if (!tab?.wcId) return;
  toast(T('Capture de la page entière…'));
  const f = await B.call('br:fullshot', tab.wcId).catch(() => '');
  if (f) toast(T('Capture enregistrée dans Images\\DrYAE (et copiée)'), { label: 'Ouvrir', fn: () => B.call('br:showItem', f) }); else toast('Capture impossible sur cette page');
}
// ---------------------------------------------------------------- page « Nouvel onglet » (1.7.2 : refaite)
// Grand logo et nom au centre, barre de recherche claire, une ligne de raccourcis ronds choisis par l'utilisateur
// (avec les icônes des sites), carte des nouveautés, widgets (minuteur, tâches) et panneau « Personnaliser » à droite.
// Plus de favoris ni d'historique affichés tout seuls : les « sites les plus visités » sont désactivés par défaut.
const NT_DEFAULT = [
  { t: 'Google', u: 'https://www.google.com' }, { t: 'YouTube', u: 'https://www.youtube.com' }, { t: 'Wikipédia', u: 'https://fr.wikipedia.org' },
  { t: 'GitHub', u: 'https://github.com' }, { t: 'Archive.org', u: 'https://archive.org' }, { t: 'Gmail', u: 'https://mail.google.com' },
];
const NT_NAMES = { 'youtube.com': 'YouTube', 'github.com': 'GitHub', 'wikipedia.org': 'Wikipédia', 'archive.org': 'Archive.org', 'mail.google.com': 'Gmail', 'gemini.google.com': 'Gemini', 'google.com': 'Google', 'sourceforge.net': 'SourceForge', 'facebook.com': 'Facebook', 'x.com': 'X', 'twitter.com': 'X', 'instagram.com': 'Instagram', 'tiktok.com': 'TikTok', 'whatsapp.com': 'WhatsApp', 'web.whatsapp.com': 'WhatsApp', 'claude.ai': 'Claude', 'chatgpt.com': 'ChatGPT', 'outlook.live.com': 'Outlook', 'netflix.com': 'Netflix', 'amazon.fr': 'Amazon', 'amazon.com': 'Amazon', 'reddit.com': 'Reddit', 'twitch.tv': 'Twitch', 'linkedin.com': 'LinkedIn', 'libgen.is': 'Library Genesis' };
// nom court d'un site : « youtube.com » → YouTube, « exemple.fr » → Exemple
function siteName(u) {
  const h = hostOf(u).replace(/^www\./, ''); if (!h) return u;
  for (const [k, v] of Object.entries(NT_NAMES)) if (h === k || h.endsWith('.' + k) && !NT_NAMES[h]) { if (h === k || !/^(mail|gemini|web)\./.test(h)) return v; }
  const parts = h.split('.'); const core = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] || parts[0];
  return core ? core[0].toUpperCase() + core.slice(1) : h;
}
const NTP = () => XS().ntp || {};
const setN = async patch => { await setX({ ntp: { ...NTP(), ...patch } }); };
const NEWS = { v: '1.7.2', items: ['Traducteur de scans plus rapide et 100 % sur votre PC', 'Tutoiement, honorifiques et notes « NB » traduits', 'Revenir à une version précédente (Paramètres → À propos)'], url: 'https://github.com/DrYAE-FPA/DrYAE/releases/tag/v1.7.2' };
const NT_BGS = { uni: '', aurore: 'linear-gradient(135deg,#3b1d70 0%,#0f2a4a 100%)', nuit: 'radial-gradient(ellipse at 50% 0%,#2a3358 0%,#0b0e18 70%)', braise: 'linear-gradient(160deg,#4a1420 0%,#160a0b 80%)', lagon: 'linear-gradient(160deg,#0e3b40 0%,#071315 80%)' };
let ntFav = {}, ntThemeImg = { k: '', u: '' };
// 1.7.2 : une seule fois : les favoris actuels deviennent les raccourcis (ou une liste de départ pour un nouvel utilisateur)
async function ntMigrate() {
  const N = NTP(); if (N.v172) return;
  let tiles = N.tiles && N.tiles.length ? N.tiles : (STORE.bookmarks || []).filter(b => /^https?:/.test(b.url || '')).slice(0, 12).map(b => ({ t: siteName(b.url), u: b.url }));
  if (!tiles.length) tiles = NT_DEFAULT.slice();
  await setN({ tiles, v172: true });
}
function ntTiles(priv) {
  const N = NTP(), rows = Math.max(1, Math.min(3, +N.rows || 1)), max = rows * 8;
  let list = (N.tiles && N.tiles.length ? N.tiles : NT_DEFAULT).slice(0, max);
  // sites les plus visités (désactivé par défaut, jamais en navigation privée)
  if (N.topSites && !priv && list.length < max) {
    const seen = new Set(list.map(x => hostOf(x.u))), count = new Map();
    for (const h of STORE.history || []) { const k = hostOf(h.url); if (!k || seen.has(k) || !/^https?:/.test(h.url)) continue; const c = count.get(k) || { n: 0, u: new URL(h.url).origin }; c.n++; count.set(k, c); }
    [...count.values()].sort((a, b) => b.n - a.n).slice(0, max - list.length).forEach(c => list.push({ t: siteName(c.u), u: c.u, auto: true }));
  }
  return list;
}
async function ntIcons(list) {
  for (const x of list) {
    const h = hostOf(x.u); if (!h || h in ntFav) continue; ntFav[h] = '';
    B.call('br:fav', [], x.u, false).then(f => { if (!f) return; ntFav[h] = f; const el = $(`#tiles [data-h="${CSS.escape(h)}"] .ic`); if (el) el.innerHTML = `<img src="${esc(f)}" alt="">`; }).catch(() => {});
  }
}
async function ntBackground(N) {
  const st = $('#start'), th = CFG.theme || {}, ntp = th.ntp || {};
  st.style.removeProperty('--ntbg'); st.style.backgroundImage = ''; st.style.removeProperty('--nttext');
  if (ntp.text) st.style.setProperty('--nttext', ntp.text);
  if (N.bgOn === false) { if (ntp.color) st.style.setProperty('--ntbg', ntp.color); return; }
  if (N.bg && (!N.bgPreset || N.bgPreset === 'mine')) { st.style.backgroundImage = `linear-gradient(#0005,#0005),url("${N.bg}")`; return; }
  if (N.bgPreset && NT_BGS[N.bgPreset]) { st.style.backgroundImage = NT_BGS[N.bgPreset]; return; }
  // pas de choix : l'image du thème choisi, sinon la couleur du thème
  if (ntp.image) {
    if (ntThemeImg.k !== ntp.image) ntThemeImg = { k: ntp.image, u: await B.call('br:themeImage').catch(() => '') };
    if (ntThemeImg.u) { st.style.backgroundImage = `url("${ntThemeImg.u}")`; return; }
  }
  if (ntp.color) st.style.setProperty('--ntbg', ntp.color);
}
drawTiles = async function () {
  await ntMigrate().catch(() => {});
  const N = NTP(), st = $('#start'), priv = !!cur?.incognito;
  st.classList.toggle('nologo', N.logo === false);
  ntBackground(N);
  const eng = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', qwant: 'Qwant', yahoo: 'Yahoo', brave: 'Brave', ecosia: 'Ecosia', startpage: 'Startpage' }[CFG.search || 'google'] || 'Google';
  $('#ntEng').textContent = eng + ' ▾';
  // raccourcis
  if (N.shortcuts === false) $('#tiles').innerHTML = '';
  else {
    const list = ntTiles(priv);
    $('#tiles').innerHTML = list.map((x, i) => { const h = hostOf(x.u), f = ntFav[h]; return `<div class="tile" data-u="${esc(x.u)}" data-h="${esc(h)}" ${x.auto ? '' : `draggable="true" data-ti="${i}"`} title="${esc(x.u)}"><div class="ic">${f ? `<img src="${esc(f)}" alt="">` : esc((x.t || '?')[0].toUpperCase())}</div><span class="notr">${esc(x.t)}</span>${priv ? '' : `<button class="tmore" title="${esc(T('Modifier ou retirer'))}" aria-label="${esc(T('Modifier ou retirer'))}">⋮</button>`}</div>`; }).join('')
      + (priv ? '' : `<div class="tile add" id="ntAdd"><div class="ic">+</div><span>${esc(T('Ajouter'))}</span></div>`);
    ntIcons(list);
  }
  // carte des nouveautés (après une mise à jour), jamais en privé
  const news = $('#ntNews');
  if (!priv && N.news !== false && N.newsSeen !== NEWS.v) {
    news.style.display = '';
    news.innerHTML = `<div class="nic">${ic('stars')}</div><div class="nt"><b>${esc(T('Nouveautés de DrYAE {0}').replace('{0}', NEWS.v))}</b><span>${NEWS.items.map(x => esc(T(x))).join(' · ')}</span></div><button id="ntNewsGo" title="${esc(T('Voir tout'))}">${esc(T('Voir tout'))} ›</button><button id="ntNewsX" title="${esc(T('Fermer'))}">✕</button>`;
    $('#ntNewsGo').onclick = () => { newTab(NEWS.url); setN({ newsSeen: NEWS.v }); };
    $('#ntNewsX').onclick = async () => { await setN({ newsSeen: NEWS.v }); news.style.display = 'none'; };
  } else news.style.display = 'none';
  ntWidgets(N, priv);
  if (!$('#ntpEdit')) { const b = document.createElement('button'); b.id = 'ntpEdit'; b.className = 'btn sm ntpedit'; b.innerHTML = '✎ <span>' + esc(T('Personnaliser')) + '</span>'; b.onclick = () => ntPanel(true); st.appendChild(b); }
  $('#ntpEdit').style.display = priv ? 'none' : '';
  if ($('#ntPanel').classList.contains('on')) ntPanel(true);
};
// ---- widgets : minuteur (concentration / pause) et tâches
const ntTimer = { left: 25 * 60, mode: 'focus', run: false, id: 0, len: { focus: 25, pause: 5 } };
function ntWidgets(N, priv) {
  const box = $('#ntWid'), W = N.widgets || {};
  if (priv || !W.on || (W.timer === false && W.tasks === false)) { box.style.display = 'none'; return; }
  box.style.display = '';
  const mm = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const todo = N.todo || [];
  box.innerHTML = (W.timer !== false ? `<div class="w tm"><h4 style="text-align:left">${esc(T('Minuteur'))}</h4><div class="row"><button class="btn sm" data-tm="-">−</button><div class="t" id="ntT">${mm(ntTimer.left)}</div><button class="btn sm" data-tm="+">+</button></div><div class="row"><button class="btn sm primary" data-tm="go">${esc(T(ntTimer.run ? 'Pause' : 'Démarrer'))}</button><button class="btn sm" data-tm="reset">${esc(T('Remettre à zéro'))}</button></div><div class="seg"><button class="${ntTimer.mode === 'focus' ? 'on' : ''}" data-tm="focus">${esc(T('Concentration'))}</button><button class="${ntTimer.mode === 'pause' ? 'on' : ''}" data-tm="pause">${esc(T('Pause'))}</button></div></div>` : '')
    + (W.tasks !== false ? `<div class="w todo"><h4>${esc(T('Mes tâches'))}</h4>${todo.map((x, i) => `<label class="${x.d ? 'done' : ''}"><input type="checkbox" data-td="${i}" ${x.d ? 'checked' : ''}><span class="notr" style="flex:1">${esc(x.t)}</span><button class="btn sm" data-tdx="${i}" title="${esc(T('Retirer'))}">✕</button></label>`).join('')}<input type="text" id="ntTodoIn" placeholder="${esc(T('Ajouter une tâche…'))}"></div>` : '');
  const tin = $('#ntTodoIn'); if (tin) tin.onkeydown = async e => { e.stopPropagation(); if (e.key === 'Enter' && tin.value.trim()) { await setN({ todo: [...todo, { t: tin.value.trim().slice(0, 200) }].slice(-30) }); drawTiles(); setTimeout(() => $('#ntTodoIn')?.focus(), 30); } };
}
function ntTick() {
  if (!ntTimer.run) return;
  ntTimer.left = Math.max(0, ntTimer.left - 1);
  const el = $('#ntT'); if (el) el.textContent = String(Math.floor(ntTimer.left / 60)).padStart(2, '0') + ':' + String(ntTimer.left % 60).padStart(2, '0');
  if (!ntTimer.left) { ntTimer.run = false; clearInterval(ntTimer.id); toast(T(ntTimer.mode === 'focus' ? 'Fin de la concentration : place à la pause !' : 'Fin de la pause !')); try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play(); } catch {} if ($('#start').classList.contains('on')) drawTiles(); }
}
$('#ntWid').addEventListener('click', async e => {
  const a = e.target.closest('[data-tm]')?.dataset.tm;
  if (a) {
    if (a === 'go') { ntTimer.run = !ntTimer.run; clearInterval(ntTimer.id); if (ntTimer.run) ntTimer.id = setInterval(ntTick, 1000); }
    if (a === 'reset') { ntTimer.run = false; clearInterval(ntTimer.id); ntTimer.left = ntTimer.len[ntTimer.mode] * 60; }
    if (a === 'focus' || a === 'pause') { ntTimer.mode = a; ntTimer.run = false; clearInterval(ntTimer.id); ntTimer.left = ntTimer.len[a] * 60; }
    if (a === '+' || a === '-') { const m = Math.max(1, Math.min(120, ntTimer.len[ntTimer.mode] + (a === '+' ? 5 : -5))); ntTimer.len[ntTimer.mode] = m; if (!ntTimer.run) ntTimer.left = m * 60; }
    return drawTiles();
  }
  const x = e.target.closest('[data-tdx]')?.dataset.tdx; if (x != null) { e.preventDefault(); const todo = (NTP().todo || []).slice(); todo.splice(+x, 1); await setN({ todo }); drawTiles(); }
});
$('#ntWid').addEventListener('change', async e => { const i = e.target.dataset.td; if (i == null) return; const todo = (NTP().todo || []).map((x, k) => k === +i ? { ...x, d: e.target.checked } : x); await setN({ todo }); drawTiles(); });
// ---- moteur de recherche (petit menu dans la barre)
$('#ntEng').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  const L = [['google', 'Google'], ['duckduckgo', 'DuckDuckGo'], ['bing', 'Bing'], ['qwant', 'Qwant'], ['ecosia', 'Ecosia'], ['brave', 'Brave'], ['startpage', 'Startpage'], ['yahoo', 'Yahoo']];
  menu(r.left, r.bottom + 6, L.map(([k, l]) => ({ label: l, icon: 'search', check: (CFG.search || 'google') === k, fn: async () => { CFG = { ...CFG, ...(await B.call('br:setSettings', { search: k })) }; drawTiles(); } })));
};
// ---- « + Ajouter » un raccourci
async function ntAddTile(edit) {
  const N = NTP(), list = (N.tiles && N.tiles.length ? N.tiles : NT_DEFAULT).slice();
  const old = edit != null ? list[edit] : null;
  const r = await askBox({ title: old ? 'Modifier le raccourci' : 'Ajouter un raccourci', fields: [{ id: 'n', label: 'Nom', value: old?.t || '' }, { id: 'u', label: 'Adresse', value: old?.u || 'https://' }] }).catch(() => null);
  if (!r) return;
  let u = String(r.u || '').trim(); if (!u) return; if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
  if (!/^https?:\/\//.test(u)) return toast('Adresse non valable');
  const item = { t: String(r.n || '').trim() || siteName(u), u };
  if (old) list[edit] = item; else list.push(item);
  await setN({ tiles: list.slice(0, 24) }); drawTiles();
}
$('#tiles').addEventListener('click', e => { if (e.target.closest('#ntAdd')) { e.stopPropagation(); ntAddTile(); } }, true);
// raccourcis : clic droit pour modifier ou retirer, glisser pour déplacer
// raccourcis : bouton ⋮ (au survol) ou clic droit pour modifier ou retirer, glisser pour déplacer
function ntTileMenu(t, x, y) {
  const N = NTP(); const list = N.tiles && N.tiles.length ? N.tiles : NT_DEFAULT.slice();
  const i = t.dataset.ti != null ? +t.dataset.ti : -1;
  menu(x, y, [
    i >= 0 ? { label: 'Modifier', icon: 'gear', fn: () => ntAddTile(i) } : { label: 'Ajouter aux raccourcis', icon: 'pin', fn: async () => { await setN({ tiles: [...list, { t: siteName(t.dataset.u), u: t.dataset.u }].slice(0, 24) }); drawTiles(); } },
    i >= 0 ? { label: 'Retirer', icon: 'x', fn: async () => { await setN({ tiles: list.filter((_, k) => k !== i) }); drawTiles(); toast('Raccourci retiré'); } } : null,
    { label: 'Ouvrir dans un nouvel onglet', icon: 'plus', fn: () => newTab(t.dataset.u, { background: true }) },
  ].filter(Boolean));
}
$('#tiles').addEventListener('click', e => { const m = e.target.closest('.tmore'); if (!m) return; e.stopPropagation(); e.preventDefault(); const r = m.getBoundingClientRect(); ntTileMenu(m.closest('[data-u]'), r.left, r.bottom + 4); }, true);
$('#tiles').addEventListener('contextmenu', e => { const t = e.target.closest('[data-u]'); if (!t) return; e.preventDefault(); ntTileMenu(t, e.clientX, e.clientY); });
let tileDrag = null;
$('#tiles').addEventListener('dragstart', e => { const t = e.target.closest('[data-ti]'); if (t) tileDrag = t.dataset.ti; });
$('#tiles').addEventListener('dragover', e => { if (tileDrag) e.preventDefault(); });
$('#tiles').addEventListener('drop', async e => {
  const t = e.target.closest('[data-ti]'); if (!tileDrag || !t) return; e.preventDefault();
  const N = NTP(); const list = (N.tiles && N.tiles.length ? N.tiles : NT_DEFAULT).slice();
  const a = +tileDrag, b = +t.dataset.ti; if (!(a >= 0) || !(b >= 0) || a === b) { tileDrag = null; return; }
  const [m] = list.splice(a, 1); list.splice(b, 0, m); tileDrag = null;
  await setN({ tiles: list }); drawTiles();
});
// ---- panneau « Personnaliser » (à droite)
let ntTH = null;
async function ntPanel(open) {
  const p = $('#ntPanel'); if (!open) { p.classList.remove('on'); return; }
  const N = NTP(), W = N.widgets || {};
  ntTH = await B.call('br:themes').catch(() => ntTH) || { list: [], current: 'default', mode: 'dark' };
  const mode = (CFG.rawTheme || {}).mode || 'dark';
  const sw = (id, on) => `<input type="checkbox" class="ntsw" data-k="${id}" ${on ? 'checked' : ''}>`;
  const bgs = [['uni', 'Uni', ''], ['aurore', 'Aurore', NT_BGS.aurore], ['nuit', 'Nuit', NT_BGS.nuit], ['braise', 'Braise', NT_BGS.braise], ['lagon', 'Lagon', NT_BGS.lagon]];
  const curBg = N.bgPreset || (N.bg ? 'mine' : 'uni');
  p.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><h3>${esc(T('Personnaliser la page d\'accueil'))}</h3><button class="btn sm" id="ntpX" title="${esc(T('Fermer'))}">✕</button></div>
    <h5>${esc(T('Apparence'))}</h5>
    <div class="seg">${[['light', 'Clair'], ['dark', 'Sombre'], ['system', 'Appareil']].map(([k, l]) => `<button data-mode="${k}" class="${mode === k ? 'on' : ''}">${esc(T(l))}</button>`).join('')}</div>
    <div class="sw" style="margin-top:12px">${ntTH.list.filter(t => t.kind !== 'chrome').map(t => `<button data-th="${esc(t.id)}" class="${ntTH.current === t.id ? 'on' : ''}" title="${esc(T(t.name))}" style="background:linear-gradient(135deg,${esc(t.preview[0])} 50%,${esc(t.preview[1])} 50%)"></button>`).join('')}</div>
    <button class="more" id="ntMoreTh"><span>${esc(T('Afficher davantage de thèmes'))}</span><span>›</span></button>
    <div class="tg"><b>${esc(T('Fonds d\'écran'))}</b>${sw('bgOn', N.bgOn !== false)}</div>
    <div class="bgs" style="margin-top:8px;${N.bgOn === false ? 'opacity:.45;pointer-events:none' : ''}"><button class="addimg" id="ntBgAdd">+ ${esc(T('Ajouter une image'))}</button>${N.bg ? `<button data-bg="mine" class="${curBg === 'mine' ? 'on' : ''}" style="background-image:url('${esc(N.bg)}')">${esc(T('Mon image'))}</button>` : ''}${bgs.map(([k, l, g]) => `<button data-bg="${k}" class="${curBg === k ? 'on' : ''}" style="background:${g || 'var(--bg)'};${k === 'uni' ? 'border-color:var(--line2)' : ''}">${esc(T(l))}</button>`).join('')}</div>
    <div class="tg"><b>${esc(T('Raccourcis'))}</b>${sw('shortcuts', N.shortcuts !== false)}</div>
    <div class="sub"><label style="display:flex;justify-content:space-between;align-items:center">${esc(T('Nombre de lignes'))} <select id="ntRows">${[1, 2, 3].map(n => `<option ${(+N.rows || 1) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label style="display:flex;justify-content:space-between;align-items:center">${esc(T('Sites les plus visités'))} ${sw('topSites', !!N.topSites)}</label></div>
    <div class="tg"><b>${esc(T('Widgets'))}</b>${sw('widgets.on', !!W.on)}</div>
    <div class="sub" style="${W.on ? '' : 'opacity:.45;pointer-events:none'}"><label style="display:flex;justify-content:space-between">${esc(T('Minuteur'))} ${sw('widgets.timer', W.timer !== false)}</label><label style="display:flex;justify-content:space-between">${esc(T('Mes tâches'))} ${sw('widgets.tasks', W.tasks !== false)}</label></div>
    <div class="tg"><b>${esc(T('Carte des nouveautés'))}</b>${sw('news', N.news !== false)}</div>
    <div class="tg"><b>${esc(T('Logo et nom DrYAE'))}</b>${sw('logo', N.logo !== false)}</div>
    <p class="hint" style="margin-top:16px">${esc(T('En navigation privée : jamais de sites visités, seulement vos raccourcis.'))}</p>
    <span class="foot" id="ntMoreSet">⚙ ${esc(T('Gérer plus de paramètres'))}</span>`;
  p.classList.add('on');
}
$('#ntPanel').addEventListener('click', async e => {
  const g = a => e.target.closest('[data-' + a + ']')?.dataset[a];
  let v;
  if (e.target.closest('#ntpX')) return ntPanel(false);
  if (e.target.closest('#ntMoreTh')) return openPage('extensions', 'themes');
  if (e.target.closest('#ntMoreSet')) return openPage('settings');
  if (e.target.closest('#ntBgAdd')) { const d = await B.call('br:pickImage'); if (d) { await setN({ bg: d, bgPreset: 'mine', bgOn: true }); drawTiles(); } return; }
  if ((v = g('mode'))) { CFG = { ...CFG, ...(await B.call('br:setRoot', { theme: { ...(CFG.rawTheme || {}), mode: v } }).catch(() => ({}))) }; return drawTiles(); }
  if ((v = g('th'))) { await B.call('br:themeSet', v); return setTimeout(drawTiles, 150); }
  if ((v = g('bg'))) { await setN({ bgPreset: v }); return drawTiles(); }
});
$('#ntPanel').addEventListener('change', async e => {
  if (e.target.id === 'ntRows') { await setN({ rows: +e.target.value || 1 }); return drawTiles(); }
  const k = e.target.dataset.k; if (!k) return;
  if (k.startsWith('widgets.')) { await setN({ widgets: { ...(NTP().widgets || {}), [k.slice(8)]: e.target.checked } }); }
  else await setN({ [k]: e.target.checked });
  drawTiles();
});

// ---------------------------------------------------------------- onglets verticaux (option)
function applyVertical() { document.body.classList.toggle('vtabs', !!XS().vertical); }

// ---------------------------------------------------------------- boutons, raccourcis, menus
$('#bMedia').onclick = e => mediaPop(e.currentTarget);
$('#bSide').onclick = () => toggleSide();
$('#bQr').onclick = () => showQrPop();
async function showQrPop() {
  if (!cur?.url || !/^https?:/.test(cur.url)) return;
  const d = await B.call('br:qr', cur.url);
  const m = $('#qrDlg'); $('#qrImg').src = d; $('#qrUrl').textContent = cur.url; m.classList.add('on');
  m.onmousedown = e => { if (e.target === m || e.target.closest('[data-qx]')) m.classList.remove('on'); };
}
B.on('cfg', () => { applyVertical(); });
setTimeout(() => { applyVertical(); drawGroups(); }, 300);
// premier lancement : importer les favoris et l'historique d'un autre navigateur (avec l'accord de l'utilisateur)
setTimeout(async () => {
  const list = await B.call('br:importOffer').catch(() => []);
  if (!list.length) return;
  const r = await askBox({ title: 'Bienvenue dans DrYAE', text: T('Voulez-vous récupérer vos favoris et votre historique depuis « {0} » ? Rien n\'est supprimé de l\'autre navigateur.').replace('{0}', list[0].name), check: 'Avec l\'historique', checked: true, buttons: [{ v: 'yes', label: 'Importer', primary: true }], cancel: 'Non merci' });
  B.call('br:importAsked');
  if (!r) return;
  try { const d = await B.call('br:importFrom', list[0].key, { history: r.checked }); toast(T('Importé : {0} favori(s), {1} page(s) d\'historique').replace('{0}', d.bookmarks).replace('{1}', d.history)); } catch (e) { toast(T('Import impossible') + ' : ' + (e.message || e)); }
}, 4000);
window.TABSX = { drawSide, sideTab: () => ($('#side').classList.contains('on') ? sideTab : ''), splitMenu, tabSearch, toggleSide, saveOffline, fullShot, showQrPop, splitWith, unsplit, groupBySite, drawGroups, sleepTab, saverTick, GROUPS: () => GROUPS };
