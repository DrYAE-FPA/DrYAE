/* dryae://history — historique de navigation */
let ALL = [], view = 'date', q = '', shown = 400, undoList = null, closed = [];
const params = () => location.hash.replace('#', '');
shell('Historique', null, "Rechercher dans l'historique");
$('#nav').innerHTML = `
  <button data-v="date" class="on">${ic('clock')}<span>Historique</span></button>
  <button data-v="closed">${ic('tab')}<span>Onglets fermés récemment</span><span class="count" id="nClosed"></span></button>
  <hr>
  <button data-v="clear">${ic('trash')}<span>Effacer les données de navigation</span></button>
  <div class="navfoot" id="kbHelp"></div>`;
const search = $('#q');
const nav = new ListNav({
  root: $('#wrap'), search,
  onSel: ks => { const b = $('#selbar'); if (!b) return; b.classList.toggle('on', ks.length > 1); $('#selN').textContent = TRF('{0} sélectionné(s)', ks.length); },
  onOpen: (k, e) => { const h = byKey(k); if (h) open(h.url, e && (e.ctrlKey || e.metaKey)); },
  onDelete: ks => del(ks),
  onUndo: () => undo(),
  onMenu: (k, x, y) => rowMenu(k, x, y),
});
$('#kbHelp').innerHTML = `<div class="kbdhelp" style="flex-direction:column;gap:4px;margin:0"><span><kbd>↑</kbd> <kbd>↓</kbd> ${esc(TR('se déplacer'))}</span><span><kbd>Maj</kbd>+<kbd>↑↓</kbd> / <kbd>Ctrl</kbd>+${esc(TR('clic'))} ${esc(TR('sélectionner'))}</span><span><kbd>Ctrl</kbd>+<kbd>A</kbd> ${esc(TR('tout sélectionner'))}</span><span><kbd>Entrée</kbd> ${esc(TR('ouvrir'))} · <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> ${esc(TR('nouvel onglet'))}</span><span><kbd>Suppr</kbd> ${esc(TR('supprimer'))} · <kbd>Ctrl</kbd>+<kbd>Z</kbd> ${esc(TR('annuler'))}</span><span><kbd>Ctrl</kbd>+<kbd>F</kbd> ${esc(TR('rechercher'))}</span></div>`;
const keyOf = h => h.t + '|' + h.url;
const byKey = k => ALL.find(h => keyOf(h) === k);
function open(url, newTab) { D.call('open', url, newTab ? { background: true } : { current: true }); }

$('#nav').onclick = e => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  if (b.dataset.v === 'clear') return clearDialog();
  setView(b.dataset.v === 'closed' ? 'closed' : view === 'closed' ? 'date' : view);
};
function setView(v) { view = v; $$('#nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (v === 'closed' ? 'closed' : 'date'))); nav.clear(); draw(); }
search.oninput = () => { clearTimeout(search.t); search.t = setTimeout(() => { q = search.value.trim(); shown = 400; load(); }, 200); };

async function load() { ALL = await call('history', q); closed = await call('closedTabs'); $('#nClosed').textContent = closed.length || ''; draw(); }
function draw() {
  const w = $('#wrap');
  if (view === 'closed') return drawClosed();
  const list = ALL.slice(0, shown);
  const groups = new Map();
  if (view === 'site') {
    const hosts = new Map();
    for (const h of ALL) { const k = hostOf(h.url); if (!hosts.has(k)) hosts.set(k, []); hosts.get(k).push(h); }
    for (const [k, l] of [...hosts].slice(0, 200)) groups.set(k, l.slice(0, 50));
  } else for (const h of list) { const k = dayKey(h.t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }
  w.innerHTML = `<div class="phead"><h2>${esc(TR(q ? 'Résultats de la recherche' : 'Historique'))}</h2>
      <div class="chips" id="mode"><button data-m="date" class="${view === 'date' ? 'on' : ''}">${esc(TR('Par date'))}</button><button data-m="site" class="${view === 'site' ? 'on' : ''}">${esc(TR('Par site'))}</button></div></div>
    <div class="selbar" id="selbar"><b id="selN"></b><button class="btn sm" id="selDel">${ic('trash')}${esc(TR('Supprimer'))}</button><button class="btn sm" id="selX">${esc(TR('Annuler'))}</button></div>
    ${ALL.length ? [...groups].map(([g, l]) => `<div class="plist"><div class="grp">${view === 'site' ? favHtml('https://' + g, l[0].fav) + `<span class="notr">${esc(g)}</span><span class="tag">${(ALL.filter(h => hostOf(h.url) === g).length)}</span><span class="sp"></span><button class="btn sm" data-delhost="${esc(g)}">${ic('trash')}${esc(TR('Tout supprimer pour ce site'))}</button>` : esc(dayLabel(l[0].t))}</div>
      ${l.map(h => `<div class="lrow" data-k="${esc(keyOf(h))}" tabindex="-1"><input type="checkbox" class="ck"><span class="tm">${esc(timeOf(h.t))}</span>${favHtml(h.url, h.fav)}<div class="tt"><b class="notr" title="${esc(h.title || h.url)}">${esc(h.title || h.url)}</b><span class="notr">${esc(view === 'site' ? new Date(h.t).toLocaleDateString(LOC()) : hostOf(h.url))}</span>${h.snippet ? `<small class="notr snip" title="${esc(TR('Trouvé dans le texte de la page'))}" style="flex-basis:100%;min-width:0;color:var(--muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ic('search')} ${esc(h.snippet)}</small>` : ''}</div><div class="act"><button class="icon-btn" data-more title="${esc(TR('Plus'))}">${ic('more')}</button></div></div>`).join('')}</div>`).join('')
      + (view === 'date' && ALL.length > shown ? `<div style="text-align:center"><button class="btn" id="more">${esc(TR('Afficher plus'))}</button></div>` : '')
      : `<div class="plist"><div class="empty">${ic('clock')}${esc(TR(q ? 'Aucun résultat' : "L'historique est vide"))}</div></div>`}`;
  $('#mode').onclick = e => { const b = e.target.closest('[data-m]'); if (b) setView(b.dataset.m); };
  $('#selDel').onclick = () => del(nav.selected());
  $('#selX').onclick = () => nav.clear();
  const m = $('#more'); if (m) m.onclick = () => { shown += 600; draw(); };
  w.onclick = e => {
    const mb = e.target.closest('[data-more]'); if (mb) { const r = mb.getBoundingClientRect(); return rowMenu(mb.closest('[data-k]').dataset.k, r.left - 180, r.bottom); }
    const dh = e.target.closest('[data-delhost]'); if (dh) return delHost(dh.dataset.delhost);
    const row = e.target.closest('[data-k]');
    if (row && !e.target.closest('button,input') && !e.ctrlKey && !e.shiftKey && !e.metaKey && e.detail === 1 && e.target.closest('.tt b')) open(byKey(row.dataset.k).url, false);
  };
  w.onauxclick = e => { const row = e.target.closest('[data-k]'); if (row && e.button === 1) { e.preventDefault(); open(byKey(row.dataset.k).url, true); } };
  nav.paint();
}
function drawClosed() {
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Onglets fermés récemment'))}</h2><p>${esc(TR('Cliquez sur un onglet pour le rouvrir.'))}</p></div>
    <div class="plist">${closed.length ? closed.map((c, i) => `<div class="lrow" data-k="c${i}">${favHtml(c.url, c.fav)}<div class="tt"><b class="notr">${esc(c.title || c.url)}</b><span class="notr">${esc(hostOf(c.url))}</span></div><div class="act" style="opacity:1"><button class="btn sm" data-re="${i}">${ic('reload')}${esc(TR('Rouvrir'))}</button></div></div>`).join('') : `<div class="empty">${ic('tab')}${esc(TR('Aucun onglet fermé'))}</div>`}</div>`;
  $('#wrap').onclick = e => { const b = e.target.closest('[data-re]') || e.target.closest('[data-k]'); if (!b) return; const i = b.dataset.re ?? b.dataset.k.slice(1); D.call('reopenClosed', +i).then(load); };
}
function rowMenu(k, x, y) {
  const h = byKey(k); if (!h) return;
  const sel = nav.selected();
  pmenu(x, y, [
    { label: 'Ouvrir', icon: 'open', key: 'Entrée', fn: () => open(h.url, false) },
    { label: 'Ouvrir dans un nouvel onglet', icon: 'plus', key: 'Ctrl+Entrée', fn: () => open(h.url, true) },
    { label: 'Ouvrir dans un onglet privé', icon: 'eyeoff', fn: () => D.call('open', h.url, { incognito: true }) },
    '-',
    { label: 'Copier le lien', icon: 'copy', fn: () => { navigator.clipboard.writeText(h.url); toast('Lien copié'); } },
    { label: 'Plus de ce site', icon: 'search', fn: () => { search.value = hostOf(h.url); q = search.value; load(); } },
    '-',
    { label: sel.length > 1 ? TRF('Supprimer les {0} éléments', sel.length) : "Supprimer de l'historique", icon: 'trash', key: 'Suppr', danger: true, fn: () => del(sel.length > 1 ? sel : [k]) },
  ]);
}
async function del(ks) {
  if (!ks.length) return;
  undoList = await call('historyDelete', ks);
  nav.clear();
  await load();
  toast(TRF('{0} élément(s) supprimé(s) de l\'historique', undoList.length), { label: 'Annuler', fn: undo });
}
async function delHost(host) {
  const ks = ALL.filter(h => hostOf(h.url) === host).map(keyOf);
  if (!(await confirmBox(TRF('Supprimer les {0} pages de « {1} » de l\'historique ?', ks.length, host), 'Supprimer'))) return;
  del(ks);
}
async function undo() { if (!undoList) return; await call('historyRestore', undoList); undoList = null; load(); toast('Suppression annulée'); }

// ---------- effacer les données de navigation ----------
const RANGES = [['15 dernières minutes', 15 * 60e3], ['Dernière heure', 3600e3], ['Dernières 24 heures', 864e5], ['7 derniers jours', 7 * 864e5], ['4 dernières semaines', 28 * 864e5], ['Depuis le début', 0]];
async function clearDialog() {
  let rng = 2, adv = false;
  const html = () => `<div class="chips" id="rng">${RANGES.map(([l], i) => `<button data-r="${i}" class="${i === rng ? 'on' : ''}">${esc(TR(l))}</button>`).join('')}</div>
    <div id="cdBody" style="margin-top:12px"></div>`;
  const body = async d => {
    const from = RANGES[rng][1] ? Date.now() - RANGES[rng][1] : 0;
    const i = await call('clearInfo', from);
    const box = (id, l, s, on) => `<label class="cbx"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><div><b>${esc(TR(l))}</b><span>${s}</span></div></label>`;
    $('#cdBody', d).innerHTML = box('cHist', 'Historique de navigation', esc(TRF('{0} page(s) pour cette période', i.hist)), true) +
      box('cCook', 'Cookies et autres données des sites', esc(TRF('{0} site(s). Vous serez déconnecté de la plupart des sites.', i.sites)) + ' · ' + esc(TR('toutes périodes')), false) +
      box('cCache', 'Images et fichiers en cache', esc(TRF('{0} au total', fmtBytes(i.cache))) + ' · ' + esc(TR('toutes périodes')), true) +
      box('cDl', 'Liste des téléchargements terminés', esc(TRF('{0} élément(s) — les fichiers restent sur le disque', i.finished + i.nd)), false) +
      `<button class="btn sm" id="cdAdv" style="margin:8px 0">${esc(TR(adv ? 'Moins' : 'Plus'))} ${adv ? '▴' : '▾'}</button>` +
      (adv ? box('cAuto', 'Adresses et cartes de saisie automatique', esc(TR('Données enregistrées pour remplir les formulaires')), false) +
        box('cPw', 'Mots de passe enregistrés', esc(TRF('{0} mot(s) de passe', i.passwords)), false) +
        box('cPerm', 'Réglages des sites et éléments masqués', esc(TR('Éléments masqués avec le bloqueur, autorisations')), false) : '');
    $('#cdAdv', d).onclick = () => { adv = !adv; body(d); };
  };
  const r = await dialog({
    title: 'Effacer les données de navigation', ok: 'Effacer les données', html: html(),
    onOpen: d => { body(d); $('#rng', d).onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; rng = +b.dataset.r; $$('#rng button', d).forEach(x => x.classList.toggle('on', x === b)); body(d); }; },
    read: d => ({ history: $('#cHist', d)?.checked, cookies: $('#cCook', d)?.checked, cache: $('#cCache', d)?.checked, downloads: $('#cDl', d)?.checked, autofill: $('#cAuto', d)?.checked, passwords: $('#cPw', d)?.checked, perms: $('#cPerm', d)?.checked }),
  });
  if (location.hash === '#clear') history.replaceState(null, '', location.pathname);
  if (!r) return;
  if (r.passwords && !(await confirmBox('Supprimer définitivement tous les mots de passe enregistrés ?', 'Supprimer'))) r.passwords = false;
  const from = RANGES[rng][1] ? Date.now() - RANGES[rng][1] : 0;
  await call('clearData', from, r);
  toast('Données effacées');
  load();
}

D.on('history', () => { clearTimeout(load.t); load.t = setTimeout(load, 300); });
D.on('closed', () => load());
addEventListener('hashchange', () => { if (params() === 'clear') clearDialog(); });
load().then(() => { if (params() === 'clear') clearDialog(); });
