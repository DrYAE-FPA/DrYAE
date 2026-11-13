/* DrYAE — navigateur, 1.7.0 : longues sessions de travail.
   Espaces de travail, collections, citer une page, surlignages (liste), conteneurs, onglets inactifs,
   palette de commandes (Ctrl+K), calculs et conversions dans la barre d'adresse, mode présentation,
   rappels de pause. Les données sont gardées sur ce PC par le processus principal (src/main/work.js). */
'use strict';
(() => {
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const LANG = () => (CFG.lang || document.documentElement.lang || 'fr').split('-')[0];
const TF = (s, ...a) => T(s).replace(/\{(\d+)\}/g, (_m, n) => a[+n] ?? '');
const webTabs = () => tabs.filter(t => !t.incognito && /^(https?|file|dryae):/.test(t.url || ''));

// ---------------------------------------------------------------- petite fenêtre (modale) réutilisable
function modal(html, width = 560) {
  const o = document.createElement('div'); o.className = 'overlay on';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="width:min(${width}px,100%);max-height:86vh;overflow:auto">${html}</div>`;
  document.body.appendChild(o);
  const close = () => { o.remove(); };
  o.addEventListener('mousedown', e => { if (e.target === o) close(); });
  o.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  try { window.I18N?.translateDom?.(o); } catch {}
  return { o, box: o.firstElementChild, close };
}

// ---------------------------------------------------------------- conteneurs
let CTN = [];
const loadCtn = () => B.call('br:containers').then(l => { CTN = l || []; }).catch(() => {});
loadCtn(); B.on('cfg', loadCtn);
const ctnColor = id => (CTN.find(c => c.id === id) || {}).color;
function ctnMenu(t) {
  return CTN.map(c => ({ label: c.name, icon: 'box', fn: () => { const n = newTab(t?.url || '', { container: c.id }); if (t) moveTab(n, t, true); } }));
}

// ---------------------------------------------------------------- espaces de travail
async function saveSpace(name, id) {
  const list = webTabs();
  if (!list.length) return toast('Aucun onglet à enregistrer');
  const G = window.TABSX?.GROUPS?.() || {};
  const groups = Object.fromEntries(Object.entries(G).filter(([g]) => list.some(t => t.group === g)));
  await B.call('br:spaceSave', { id, name: name || TF('Espace du {0}', new Date().toLocaleDateString(LANG())), tabs: list.map(t => ({ url: t.url, title: t.title, group: t.group, container: t.container })), groups });
  toast(id ? 'Espace mis à jour' : 'Espace enregistré');
}
function openSpace(sp, replace, only) {
  const old = tabs.filter(t => !t.incognito);
  const G = window.TABSX?.GROUPS?.() || {};
  for (const [g, x] of Object.entries(sp.groups || {})) if (!G[g]) G[g] = x;
  const list = only != null ? [sp.tabs[only]] : sp.tabs;
  const made = list.map(t => { const n = newTab(t.url, { background: true, lazy: true, title: t.title, container: t.container }); if (t.group && G[t.group]) n.group = t.group; return n; });
  if (made[0]) select(made[0]);
  if (replace) old.forEach(t => closeTab(t));
  window.TABSX?.drawGroups?.();
  if (sp.kind === 'inactive') { if (only != null) B.call('br:spaceDel', sp.id, only).then(redraw); else B.call('br:spaceDel', sp.id).then(redraw); }
}
async function drawSpaces(body) {
  const L = await B.call('br:spaces').catch(() => []);
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  body.innerHTML = `<h4>${esc(T('Espaces de travail'))}</h4><p class="hint">${esc(T('Enregistrez les onglets ouverts sous un nom, puis rouvrez-les plus tard, tels quels.'))}</p>
    <div class="row" style="gap:6px;margin:6px 0 10px"><input type="text" id="wsName" style="flex:1;min-width:0" placeholder="${esc(T('Nom (ex. Révisions maths)'))}" maxlength="60"><button class="btn sm primary" data-w="ws-save">${esc(T('Enregistrer'))}</button></div>
    ${L.map(sp => `<details class="wsx" ${sp.kind === 'inactive' ? '' : ''}><summary><span class="notr">${esc(sp.kind === 'inactive' ? T('Onglets inactifs') : sp.name)}</span> <small style="color:var(--muted)">· ${TF('{0} onglet(s)', sp.tabs.length)}</small></summary>
      ${sp.kind === 'inactive' ? `<p class="hint">${esc(T('Onglets rangés par DrYAE parce qu\'ils n\'étaient plus ouverts depuis plusieurs jours.'))}</p>` : ''}
      <div class="row" style="gap:4px;flex-wrap:wrap;margin:4px 0 6px">
        <button class="btn sm primary" data-w="ws-open" data-id="${sp.id}">${esc(T(sp.kind === 'inactive' ? 'Tout rouvrir' : 'Ouvrir'))}</button>
        ${sp.kind === 'inactive' ? '' : `<button class="btn sm" data-w="ws-replace" data-id="${sp.id}" title="${esc(T('Ferme les onglets ouverts et ouvre ceux de l\'espace'))}">${esc(T('Remplacer les onglets'))}</button>
        <button class="btn sm" data-w="ws-update" data-id="${sp.id}" title="${esc(T('Remplace le contenu de l\'espace par les onglets ouverts'))}">${esc(T('Mettre à jour'))}</button>
        <button class="btn sm" data-w="ws-rename" data-id="${sp.id}">${esc(T('Renommer'))}</button>`}
        <button class="icon-btn" data-w="ws-del" data-id="${sp.id}" title="${esc(T('Supprimer'))}">${ic('trash')}</button></div>
      ${sp.tabs.map((t, i) => `<div class="slr"><button class="sl" data-w="ws-one" data-id="${sp.id}" data-i="${i}" title="${esc(t.url)}"><span class="fav" style="${t.container ? `color:${ctnColor(t.container) || ''}` : ''}">•</span><span class="notr">${esc(t.title || host(t.url))}</span></button><button class="icon-btn" data-w="ws-rm" data-id="${sp.id}" data-i="${i}" title="${esc(T('Retirer'))}">${ic('x')}</button></div>`).join('')}
    </details>`).join('') || `<p class="hint">${esc(T('Aucun espace enregistré.'))}</p>`}`;
  const inp = body.querySelector('#wsName'); inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') body.querySelector('[data-w="ws-save"]').click(); };
  body.onclick = async e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const sp = L.find(x => x.id === b.dataset.id);
    switch (b.dataset.w) {
      case 'ws-save': await saveSpace(inp.value.trim()); return redraw();
      case 'ws-open': return openSpace(sp, false);
      case 'ws-one': return openSpace(sp, false, +b.dataset.i);
      case 'ws-replace': { const r = await askBox({ title: sp.name, text: TF('Fermer les {0} onglet(s) ouverts et ouvrir les {1} onglet(s) de cet espace ?', tabs.filter(t => !t.incognito).length, sp.tabs.length), ok: 'Remplacer' }); if (r) openSpace(sp, true); return; }
      case 'ws-update': { const r = await askBox({ title: sp.name, text: TF('Remplacer le contenu de cet espace par les {0} onglet(s) ouverts ?', webTabs().length), ok: 'Mettre à jour' }); if (r) { await saveSpace(sp.name, sp.id); redraw(); } return; }
      case 'ws-rename': { const s = b.closest('details').querySelector('summary span'); const i = document.createElement('input'); i.value = sp.name; i.maxLength = 60; s.replaceWith(i); i.focus(); i.select(); const done = async () => { if (i.value.trim()) await B.call('br:spaceSave', { id: sp.id, name: i.value.trim() }); redraw(); }; i.onblur = done; i.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') i.blur(); if (ev.key === 'Escape') { i.value = ''; i.blur(); } }; return; }
      case 'ws-del': { const r = await askBox({ title: sp.kind === 'inactive' ? T('Onglets inactifs') : sp.name, text: T('Supprimer cet espace ? Les onglets ouverts ne sont pas touchés.'), ok: 'Supprimer', danger: true }); if (r) { await B.call('br:spaceDel', sp.id); redraw(); } return; }
      case 'ws-rm': await B.call('br:spaceDel', sp.id, +b.dataset.i); return redraw();
    }
  };
}
const redraw = () => window.TABSX?.drawSide?.();

// ---------------------------------------------------------------- onglets inactifs
let inactiveAsked = 0;
function inactiveTick() {
  const X = CFG.inactive || {}; if (X.on === false || Date.now() - inactiveAsked < 20 * 3600e3) return;
  const days = Math.max(1, +X.days || 7), lim = Date.now() - days * 864e5;
  const list = tabs.filter(t => t !== cur && !t.incognito && !t.split && /^https?:/.test(t.url || '') && (t.seen || Date.now()) < lim && !(t.wv?.isCurrentlyAudible?.()));
  if (list.length < 1) return;
  inactiveAsked = Date.now();
  toast(TF('{0} onglet(s) non ouvert(s) depuis {1} jours', list.length, days), { label: T('Ranger'), fn: async () => {
    await B.call('br:spaceAdd', 'inactive', list.map(t => ({ url: t.url, title: t.title, container: t.container })));
    list.forEach(t => { if (tabs.includes(t) && tabs.length > 1) closeTab(t); });
    toast(T('Onglets rangés dans « Onglets inactifs » (panneau latéral, Espaces de travail)'), { label: T('Voir'), fn: () => window.TABSX?.toggleSide('ws') });
  } });
}
setTimeout(inactiveTick, 3 * 60e3); setInterval(inactiveTick, 30 * 60e3);

// ---------------------------------------------------------------- collections
let colSel = localStorage.getItem('dryae-col') || '';
const TYPE_IC = { page: 'link', text: 'quote', image: 'crop', note: 'file' };
async function drawCols(body) {
  const L = await B.call('br:cols').catch(() => []);
  let c = L.find(x => x.id === colSel) || L[0]; colSel = c?.id || '';
  try { localStorage.setItem('dryae-col', colSel); } catch {}
  const web = /^https?:/.test(cur?.url || '');
  body.innerHTML = `<h4>${esc(T('Collections'))}</h4><p class="hint">${esc(T('Rassemblez des pages, des passages, des images et des notes, puis exportez-les en Word ou en PDF.'))}</p>
    <div class="row" style="gap:6px;margin:6px 0"><select id="colSel" style="flex:1;min-width:0">${L.map(x => `<option value="${x.id}" ${x === c ? 'selected' : ''} class="notr">${esc(x.name)} (${x.items.length})</option>`).join('')}</select><button class="btn sm" data-w="col-new">${ic('plus')}${esc(T('Nouvelle'))}</button></div>
    ${c ? `<input type="text" id="colName" value="${esc(c.name)}" maxlength="60" style="width:100%;margin:2px 0 6px" title="${esc(T('Nom de la collection'))}">
    <div class="row" style="gap:4px;flex-wrap:wrap;margin-bottom:8px">
      ${web ? `<button class="btn sm primary" data-w="col-page">${ic('plus')}${esc(T('Ajouter cette page'))}</button>` : ''}
      <button class="btn sm" data-w="col-docx" ${c.items.length ? '' : 'disabled'}>${ic('file')}${esc(T('Exporter en Word'))}</button>
      <button class="btn sm" data-w="col-pdf" ${c.items.length ? '' : 'disabled'}>${ic('print')}${esc(T('Exporter en PDF'))}</button>
      <button class="icon-btn" data-w="col-del" title="${esc(T('Supprimer la collection'))}">${ic('trash')}</button></div>
    <textarea id="colNote" rows="2" style="width:100%;font:inherit;min-height:54px" placeholder="${esc(T('Ajouter une note à la collection…'))}"></textarea><button class="btn sm" data-w="col-note" style="margin:4px 0 10px">${esc(T('Ajouter la note'))}</button>
    ${c.items.map((it, i) => `<div class="slr colit" style="align-items:flex-start;padding:4px 0;border-top:1px solid var(--line)">
      ${it.type === 'image' ? `<img src="${esc(it.src)}" alt="" style="width:46px;height:46px;object-fit:cover;border-radius:6px;flex:none;margin:2px 6px 0 0">` : `<span style="flex:none;margin:4px 6px 0 0;color:var(--muted)">${ic(TYPE_IC[it.type] || 'link')}</span>`}
      <div style="flex:1;min-width:0">${it.title ? `<button class="sl" style="padding:0" ${it.url ? `data-u="${esc(it.url)}"` : ''} title="${esc(it.url || '')}"><span class="notr" style="font-weight:600">${esc(it.title)}</span></button>` : ''}
        ${it.text ? `<div class="notr" style="font-size:12px;color:var(--muted);white-space:pre-wrap;max-height:5.6em;overflow:hidden;${it.type === 'text' ? 'border-left:3px solid var(--accent-line);padding-left:6px' : ''}">${esc(it.text.slice(0, 400))}</div>` : ''}</div>
      <div style="display:flex;flex:none;align-items:flex-start"><button class="icon-btn" data-w="col-up" data-i="${it.id}" title="${esc(T('Monter'))}" ${i ? '' : 'disabled'} style="transform:rotate(90deg)">${ic('back')}</button><button class="icon-btn" data-w="col-down" data-i="${it.id}" title="${esc(T('Descendre'))}" ${i < c.items.length - 1 ? '' : 'disabled'} style="transform:rotate(90deg)">${ic('fwd')}</button><button class="icon-btn" data-w="col-rm" data-i="${it.id}" title="${esc(T('Retirer'))}">${ic('x')}</button></div></div>`).join('') || `<p class="hint">${esc(T('Collection vide. Clic droit sur une page, un texte sélectionné ou une image : « Ajouter à une collection ».'))}</p>`}`
    : `<p class="hint">${esc(T('Aucune collection. Clic droit sur une page, un texte sélectionné ou une image : « Ajouter à une collection ».'))}</p>`}`;
  const sel = body.querySelector('#colSel'); if (sel) sel.onchange = () => { colSel = sel.value; redraw(); };
  const nm = body.querySelector('#colName'); if (nm) { nm.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') nm.blur(); }; nm.onchange = async () => { await B.call('br:colRename', c.id, nm.value); redraw(); }; }
  const nt = body.querySelector('#colNote'); if (nt) nt.onkeydown = e => e.stopPropagation();
  body.onclick = async e => {
    const b = e.target.closest('[data-w]'); if (!b || b.disabled) return;
    switch (b.dataset.w) {
      case 'col-new': { const l = await B.call('br:colNew', ''); colSel = l[0]?.id || ''; redraw(); setTimeout(() => { const i = $('#colName'); i?.focus(); i?.select(); }, 50); return; }
      case 'col-page': await B.call('br:colAdd', c.id, { type: 'page', url: cur.url, title: cur.title }); return redraw();
      case 'col-note': { const v = nt.value.trim(); if (!v) return nt.focus(); await B.call('br:colAdd', c.id, { type: 'note', text: v }); return redraw(); }
      case 'col-docx': case 'col-pdf': { toast('Export en cours…'); try { const f = await B.call('br:colExport', c.id, b.dataset.w === 'col-pdf' ? 'pdf' : 'docx'); if (f) toast(TF('Enregistré : {0}', f.split(/[\\/]/).pop()), { label: T('Ouvrir'), fn: () => B.call('br:openPath', f) }); } catch (er) { toast(T('Export impossible') + ' : ' + (er.message || er)); } return; }
      case 'col-del': { const r = await askBox({ title: c.name, text: TF('Supprimer cette collection ({0} élément(s)) ?', c.items.length), ok: 'Supprimer', danger: true }); if (r) { await B.call('br:colDel', c.id); colSel = ''; redraw(); } return; }
      case 'col-rm': await B.call('br:colDel', c.id, b.dataset.i); return redraw();
      case 'col-up': case 'col-down': await B.call('br:colMove', c.id, b.dataset.i, b.dataset.w === 'col-up' ? -1 : 1); return redraw();
    }
  };
}
B.on('cols-changed', () => { if (window.TABSX?.sideTab?.() === 'col') redraw(); });

// ---------------------------------------------------------------- surlignages (panneau Notes)
async function drawMarks(body, url) {
  const M = await B.call('br:marks').catch(() => ({}));
  const here = (M[url] || {}).list || [];
  const C = { yellow: '#fde68a', green: '#bbf7d0', blue: '#bfdbfe', pink: '#fbcfe8' };
  const box = document.createElement('div');
  box.innerHTML = `<h4 style="margin-top:12px">${esc(T('Surlignages de cette page'))}</h4>`
    + (here.map(m => `<div class="slr" style="align-items:flex-start;gap:6px;padding:3px 0"><i style="flex:none;width:10px;height:10px;border-radius:3px;margin-top:5px;background:${C[m.color] || C.yellow}"></i><div class="notr" style="flex:1;min-width:0;font-size:12.5px">${esc(m.text.slice(0, 200))}${m.note ? `<div style="color:var(--muted);font-size:12px;margin-top:2px">✎ ${esc(m.note.slice(0, 300))}</div>` : ''}</div><button class="icon-btn" data-w="mk-del" data-u2="${esc(url)}" data-id="${esc(m.id)}" title="${esc(T('Retirer le surlignage'))}">${ic('x')}</button></div>`).join('')
      || `<p class="hint">${esc(T('Sélectionnez un passage puis clic droit : « Surligner ».'))}</p>`)
    + (Object.keys(M).filter(u => u !== url).length ? `<h4 style="margin-top:12px">${esc(T('Pages surlignées'))}</h4>` + Object.entries(M).filter(([u]) => u !== url).sort((a, b) => (b[1].t || 0) - (a[1].t || 0)).slice(0, 60).map(([u, p]) => `<button class="sl" data-u="${esc(u)}" title="${esc(u)}"><span class="fav">•</span><span class="notr">${esc(p.title || u)}</span><small style="color:var(--muted)"> · ${p.list.length}</small></button>`).join('') : '');
  body.appendChild(box);
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-w="mk-del"]'); if (!b) return;
    await B.call('br:markDel', b.dataset.u2, b.dataset.id);
    if (cur?.wv && (cur.url || '').split('#')[0] === b.dataset.u2) cur.wv.reload();
    redraw();
  });
}
B.on('marks-changed', () => { if (window.TABSX?.sideTab?.() === 'notes') redraw(); });

// ---------------------------------------------------------------- citer une page (APA, MLA, ISO 690)
const META_JS = `(() => {
  const m = n => { const e = document.querySelector('meta[name="' + n + '" i],meta[property="' + n + '" i]'); return e && e.content ? e.content.trim() : ''; };
  const all = n => [...document.querySelectorAll('meta[name="' + n + '" i]')].map(e => (e.content || '').trim()).filter(Boolean);
  let ld = {};
  try { for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { let j = JSON.parse(s.textContent); j = [].concat(j && j['@graph'] ? j['@graph'] : j); const a = j.find(x => x && /Article|BlogPosting|Report|WebPage|Book|Thesis/i.test([].concat(x['@type']).join(' '))); if (a) { ld = a; break; } } } catch (e) {}
  const ldA = [].concat(ld.author || []).map(a => typeof a === 'string' ? a : a && a.name).filter(Boolean);
  const au = all('citation_author').length ? all('citation_author') : all('dc.creator').length ? all('dc.creator') : ldA.length ? ldA : [m('author') || m('article:author') || m('parsely-author') || m('sailthru.author')].filter(x => x && !/^https?:/.test(x));
  const pub = ld.publisher && (typeof ld.publisher === 'string' ? ld.publisher : ld.publisher.name);
  return { title: m('citation_title') || m('og:title') || ld.headline || ld.name || document.title, authors: au.slice(0, 25), site: m('og:site_name') || m('citation_journal_title') || pub || m('application-name') || '',
    date: m('citation_publication_date') || m('citation_date') || m('article:published_time') || ld.datePublished || m('dc.date') || m('date') || m('pubdate') || '', url: location.href.split('#')[0] };
})()`;
function splitName(n) {
  n = String(n || '').trim().replace(/\s+/g, ' '); if (!n) return null;
  if (n.includes(',')) { const [l, f] = n.split(',').map(x => x.trim()); return { last: l, first: f || '' }; }
  const p = n.split(' '); if (p.length === 1) return { last: n, first: '', org: true };
  if (/^(inc|ltd|sa|sas|gmbh|association|université|university|ministère|ministry)$/i.test(p[p.length - 1]) || p.length > 4) return { last: n, first: '', org: true };
  const ix = p.findIndex((w, i) => i > 0 && /^(de|du|des|van|von|da|di|le|la|del|dos)$/i.test(w));
  const k = ix > 0 ? ix : p.length - 1;
  return { last: p.slice(k).join(' '), first: p.slice(0, k).join(' ') };
}
const initials = f => f.split(/[\s-]+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(f.includes('-') ? '-' : ' ');
function citeFormats(d) {
  const L = LANG(), A = (d.authors || []).map(splitName).filter(Boolean);
  const dt = d.date ? new Date(d.date) : null, ok = dt && !isNaN(dt);
  const fmtD = x => x.toLocaleDateString(L, { day: 'numeric', month: 'long', year: 'numeric' });
  const today = fmtD(new Date());
  const q = s => (L === 'fr' ? `« ${s} »` : L === 'ru' ? `«${s}»` : `“${s}”`);
  const etal = T('et al.');
  const site = d.site && !(A.length === 1 && A[0].org && fold(A[0].last) === fold(d.site)) ? d.site : '';
  const urlShort = d.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  // APA 7
  const apaA = A.map(a => a.org ? a.last : `${a.last}, ${initials(a.first)}`);
  const apaNames = apaA.length > 1 ? apaA.slice(0, -1).join(', ') + ', & ' + apaA[apaA.length - 1] : apaA[0] || '';
  const apaDate = ok ? `(${dt.getFullYear()}, ${dt.toLocaleDateString(L, { day: 'numeric', month: 'long' })})` : `(${T('s.d.')})`;
  const I = x => ({ i: x });
  const apa = apaNames ? [`${apaNames} ${apaDate}. `, I(d.title), `. ${site ? site + '. ' : ''}${d.url}`] : [I(d.title), `. ${apaDate}. ${site ? site + '. ' : ''}${d.url}`];
  // MLA 9
  const first = a => (a.org ? a.last : `${a.last}, ${a.first}`);
  const mlaA = !A.length ? '' : A.length === 1 ? first(A[0]) : A.length === 2 ? TF('{0}, et {1}', first(A[0]), [A[1].first, A[1].last].filter(Boolean).join(' ')) : `${first(A[0])}, ${etal}`;
  const mla = [mlaA ? mlaA.replace(/\.$/, '') + '. ' : '', q(d.title.replace(/[.!?]$/, '') + '.') + ' ', ...(site ? [I(site), ', '] : []), ok ? fmtD(dt) + ', ' : '', urlShort + '. ', TF('Consulté le {0}.', today)];
  // ISO 690
  const isoA = A.map(a => (a.org ? a.last.toUpperCase() : `${a.last.toUpperCase()}${a.first ? ', ' + a.first : ''}`));
  const isoNames = isoA.length > 3 ? isoA[0] + ', ' + etal : isoA.join(', ');
  const iso = [isoNames ? isoNames + '. ' : '', I(d.title), ' ' + T('[en ligne]') + '. ', site ? site + (ok ? ', ' : '. ') : '', ok ? fmtD(dt) + '. ' : '', TF('[consulté le {0}].', today) + ' ', TF('Disponible à l\'adresse : {0}', d.url)];
  const join = parts => ({ html: parts.map(p => (typeof p === 'string' ? esc(p) : `<i>${esc(p.i)}</i>`)).join(''), text: parts.map(p => (typeof p === 'string' ? p : p.i)).join('') });
  return { apa: join(apa), mla: join(mla), iso: join(iso) };
}
async function copyRich(html, text) {
  try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); }
  catch { await navigator.clipboard.writeText(text); }
  toast('Référence copiée');
}
async function cite(tab = cur) {
  if (!tab?.wv || !/^https?:/.test(tab.url || '')) return toast('Ouvre une page web d\'abord');
  let d; try { d = await tab.wv.executeJavaScript(META_JS); } catch { d = { title: tab.title, authors: [], site: '', date: '', url: tab.url }; }
  d.title = String(d.title || tab.title || '').trim();
  if (d.site) { const m = /\s+[|–—-]\s+([^|–—-]{2,60})$/.exec(d.title); if (m && fold(m[1]).trim() === fold(d.site).trim()) d.title = d.title.slice(0, m.index).trim(); }
  if (!d.site) try { d.site = new URL(d.url).hostname.replace(/^www\./, ''); } catch {}
  if (d.date) { const x = new Date(d.date); d.date = isNaN(x) ? '' : x.toISOString().slice(0, 10); }
  const M = modal(`<h3 style="display:flex;align-items:center;gap:8px">${ic('quote')}${esc(T('Citer cette page'))}</h3>
    <p class="hint" style="margin:4px 0 10px">${esc(T('Vérifiez les informations trouvées sur la page : vous pouvez les corriger, les références se mettent à jour.'))}</p>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center">
      <label>${esc(T('Auteur(s)'))}</label><input type="text" id="ciA" placeholder="${esc(T('Prénom Nom ; Prénom Nom'))}">
      <label>${esc(T('Titre'))}</label><input type="text" id="ciT">
      <label>${esc(T('Site'))}</label><input type="text" id="ciS">
      <label>${esc(T('Date de publication'))}</label><input id="ciD" type="date" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 10px;color:var(--text);color-scheme:dark light">
    </div>
    <div id="ciOut" style="margin-top:12px"></div>
    <div class="modal-foot"><button class="btn" data-x>${esc(T('Fermer'))}</button></div>`, 620);
  const $m = s => M.box.querySelector(s);
  $m('#ciA').value = (d.authors || []).join(' ; '); $m('#ciT').value = d.title; $m('#ciS').value = d.site; $m('#ciD').value = d.date || '';
  const draw = () => {
    const F = citeFormats({ authors: $m('#ciA').value.split(';').map(x => x.trim()).filter(Boolean), title: $m('#ciT').value.trim(), site: $m('#ciS').value.trim(), date: $m('#ciD').value, url: d.url });
    $m('#ciOut').innerHTML = [['apa', 'APA (7e édition)'], ['mla', 'MLA (9e édition)'], ['iso', 'ISO 690']].map(([k, l]) => `<div style="margin:0 0 10px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b>${esc(T(l))}</b><span style="flex:1"></span><button class="btn sm" data-copy="${k}">${ic('copy')}${esc(T('Copier'))}</button></div><div class="notr" style="background:var(--panel2);border-radius:8px;padding:8px 10px;line-height:1.5;word-break:break-word;user-select:text">${F[k].html}</div></div>`).join('');
    M.box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyRich(F[b.dataset.copy].html, F[b.dataset.copy].text));
  };
  M.box.querySelectorAll('input').forEach(i => { i.oninput = draw; i.onkeydown = e => { if (e.key !== 'Escape') e.stopPropagation(); }; });
  $m('[data-x]').onclick = M.close;
  draw();
}

// ---------------------------------------------------------------- mode présentation
let presOn = false, presTab = null;
async function present(on = !presOn) {
  presOn = !!on;
  document.body.classList.toggle('present', presOn);
  await B.call('br:present', presOn).catch(() => {});
  const send = (t, v) => { if (t?.wv && t.wcId && /^https?:/.test(t.url || '')) t.wv.send('dryae-cmd', { cmd: 'present', on: v }); };
  send(presTab, false); presTab = presOn ? cur : null; send(presTab, presOn);
  if (!presOn) toast('Mode présentation terminé');
}
setInterval(() => { if (presOn && cur !== presTab) { const o = presTab; presTab = cur; if (o?.wv && o.wcId) o.wv.send('dryae-cmd', { cmd: 'present', on: false }); if (cur?.wv && cur.wcId && /^https?:/.test(cur.url || '')) cur.wv.send('dryae-cmd', { cmd: 'present', on: true }); } }, 500);
document.addEventListener('keydown', e => { if (presOn && e.key === 'Escape') present(false); }, true);
// pendant le mode présentation, les petits messages de DrYAE ne s'affichent pas
const _toast = toast;
toast = function (t, a) { if (presOn && t !== 'Mode présentation terminé') return; return _toast(t, a); }; // eslint-disable-line no-func-assign

// ---------------------------------------------------------------- rappels de pause
B.on('break', kind => {
  if (presOn) return;
  _toast(T(kind === 'stand' ? 'Pause : levez-vous et bougez quelques minutes.' : 'Repos des yeux : regardez au loin pendant 20 secondes.'), { label: T('Ne plus rappeler'), fn: async () => { CFG = { ...CFG, ...(await B.call('br:setSettings', { breaks: { ...(CFG.breaks || {}), on: false } })) }; toast('Rappels de pause désactivés (Paramètres → Navigateur)'); } });
});

// ---------------------------------------------------------------- vitesse des vidéos
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const speedMenu = () => SPEEDS.map(r => ({ label: '× ' + r.toLocaleString(LANG()), icon: 'speed', check: (cur?.video?.rate || 1) === r, fn: () => cur?.wcId && B.call('br:speed', cur.wcId, r) }));

// ---------------------------------------------------------------- palette de commandes (Ctrl+K)
function commands() {
  const out = [];
  const walk = (list, path) => {
    for (const e of (typeof list === 'function' ? list() : list) || []) {
      if (!e || e === '-' || e.title || e.zoom || e.disabled) continue;
      if (e.sub) { walk(e.sub, (path ? path + ' › ' : '') + T(e.label)); continue; }
      if (e.fn) out.push({ label: T(e.label), path, icon: e.icon || 'list', key: e.key || '', fn: e.fn });
    }
  };
  try { walk(mainMenu(), ''); } catch {}
  const web = /^https?:/.test(cur?.url || '');
  const extra = [
    { label: T('Espaces de travail'), icon: 'spaces', fn: () => window.TABSX?.toggleSide('ws') },
    { label: T('Enregistrer les onglets dans un espace de travail'), icon: 'spaces', fn: () => { window.TABSX?.toggleSide('ws'); setTimeout(() => $('#wsName')?.focus(), 120); } },
    { label: T('Collections'), icon: 'col', fn: () => window.TABSX?.toggleSide('col') },
    web && { label: T('Ajouter cette page à une collection'), icon: 'col', fn: async () => { const l = await B.call('br:cols'); await B.call('br:colAdd', (l.find(x => x.id === colSel) || l[0] || {}).id || null, { type: 'page', url: cur.url, title: cur.title }); } },
    web && { label: T('Citer cette page'), icon: 'quote', fn: () => cite() },
    { label: T('Mode présentation'), icon: 'present', fn: () => present(true) },
    { label: T('Surlignages et notes de la page'), icon: 'file', fn: () => window.TABSX?.toggleSide('notes') },
    ...CTN.map(c => ({ label: TF('Nouvel onglet dans « {0} »', c.name), path: T('Conteneurs'), icon: 'box', fn: () => newTab('', { container: c.id }) })),
    tabs.length > 1 && cur?.url && { label: T('Afficher côte à côte avec l\'onglet précédent'), icon: 'swap', fn: () => { const i = tabs.indexOf(cur); const o = tabs[i > 0 ? i - 1 : 1]; if (o?.url) window.TABSX?.splitWith(cur, o); } },
    { label: T('Vider le cache et les cookies'), icon: 'trash', fn: () => openPage('history', 'clear') },
    { label: T('Raccourcis clavier'), icon: 'kbd', fn: showShortcuts },
    ...(web ? SPEEDS.map(r => ({ label: TF('Vitesse des vidéos × {0}', r.toLocaleString(LANG())), icon: 'speed', fn: () => B.call('br:speed', cur.wcId, r) })) : []),
  ].filter(Boolean);
  const open = tabs.filter(t => t !== cur && t.url).map(t => ({ label: t.title || t.url, path: T('Onglets ouverts'), icon: 'link', fn: () => select(t) }));
  const seen = new Set();
  return [...extra, ...out, ...open].filter(c => { c.path = c.path || ''; const k = c.path + '|' + c.label; if (seen.has(k)) return false; seen.add(k); return true; });
}
function palette() {
  if (document.getElementById('palDlg')) return;
  const all = commands();
  const M = modal(`<div style="display:flex;align-items:center;gap:8px">${ic('cmd')}<input type="text" id="palQ" style="flex:1" placeholder="${esc(T('Tapez une action : mode lecture, côte à côte, vider le cache…'))}" autocomplete="off"></div><div id="palL" style="margin-top:8px;max-height:56vh;overflow:auto"></div><p class="hint" style="margin:8px 0 0">${esc(T('↑ ↓ choisir · Entrée lancer · Échap fermer'))}</p>`, 620);
  M.o.id = 'palDlg'; M.box.style.alignSelf = 'flex-start'; M.box.style.marginTop = '10vh';
  const q = M.box.querySelector('#palQ'), L = M.box.querySelector('#palL');
  let list = [], idx = 0;
  const draw = () => {
    const words = fold(q.value).split(/\s+/).filter(Boolean);
    list = all.filter(c => words.every(w => fold(c.path + ' ' + c.label).includes(w)));
    if (words.length) list.sort((a, b) => (fold(b.label).startsWith(words[0]) ? 1 : 0) - (fold(a.label).startsWith(words[0]) ? 1 : 0));
    list = list.slice(0, 60);
    if (q.value.trim()) list.push({ label: TF('Rechercher « {0} » sur le web', q.value.trim()), icon: 'search', fn: () => goTyped(q.value.trim()) });
    idx = Math.min(idx, list.length - 1); if (idx < 0) idx = 0;
    L.innerHTML = list.map((c, i) => `<button class="sl notr" data-i="${i}" style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:8px;${i === idx ? 'background:var(--accent-soft)' : ''}">${ic(c.icon)}<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.path ? `<small style="color:var(--muted)">${esc(c.path)} › </small>` : ''}${esc(c.label)}</span>${c.key ? `<kbd style="font-size:11px;color:var(--muted)">${esc(T(c.key))}</kbd>` : ''}</button>`).join('') || `<p class="hint">${esc(T('Aucune action trouvée.'))}</p>`;
    L.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const run = i => { const c = list[i]; if (!c) return; M.close(); setTimeout(() => c.fn(), 30); };
  q.oninput = () => { idx = 0; draw(); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(list.length - 1, idx + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
    else if (e.key === 'Escape') return;
    e.stopPropagation();
  };
  L.onclick = e => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); };
  draw(); setTimeout(() => q.focus(), 20);
}

// ---------------------------------------------------------------- calculs et conversions (barre d'adresse)
// Expression : nombres, + − × ÷ ^ ( ) et %. Rien n'est envoyé, sauf la demande des taux de change (un site public),
// faite seulement quand on tape une conversion de monnaie.
function evalExpr(src) {
  const s = src.replace(/×|x(?=\s*[\d(])/g, '*').replace(/÷|:/g, '/').replace(/−/g, '-').replace(/\*\*/g, '^');
  let i = 0;
  const sp = () => { while (s[i] === ' ') i++; };
  const num = () => { sp(); const m = /^(\d+(?:[.,]\d+)?|[.,]\d+)/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0].replace(',', '.')); };
  const atom = () => { sp(); if (s[i] === '(') { i++; const v = add(); sp(); if (s[i] !== ')') throw 0; i++; return v; } if (s[i] === '-') { i++; return -pow(); } if (s[i] === '+') { i++; return pow(); } let v = num(); sp(); if (s[i] === '%') { i++; v /= 100; } return v; };
  const pow = () => { let v = atom(); sp(); if (s[i] === '^') { i++; v = Math.pow(v, pow()); } return v; };
  const mul = () => { let v = pow(); for (;;) { sp(); if (s[i] === '*') { i++; v *= pow(); } else if (s[i] === '/') { i++; v /= pow(); } else return v; } };
  const add = () => { let v = mul(); for (;;) { sp(); if (s[i] === '+') { i++; v += mul(); } else if (s[i] === '-') { i++; v -= mul(); } else return v; } };
  const v = add(); sp(); if (i < s.length) throw 0; return v;
}
const U = {};
const unit = (dim, f, ...names) => names.forEach(n => (U[fold(n)] = { dim, f }));
unit('len', 1e-3, 'mm', 'millimètre', 'millimètres', 'millimeter', 'millimeters'); unit('len', 0.01, 'cm', 'centimètre', 'centimètres', 'centimeter', 'centimeters'); unit('len', 1, 'm', 'mètre', 'mètres', 'meter', 'meters', 'metre', 'metres', 'metro', 'metros');
unit('len', 1000, 'km', 'kilomètre', 'kilomètres', 'kilometer', 'kilometers', 'kilómetro', 'kilómetros', 'км'); unit('len', 0.0254, 'in', 'pouce', 'pouces', 'inch', 'inches', '"', 'pulgada', 'pulgadas');
unit('len', 0.3048, 'ft', 'pied', 'pieds', 'foot', 'feet', 'pie', 'pies'); unit('len', 0.9144, 'yd', 'yard', 'yards'); unit('len', 1609.344, 'mi', 'mile', 'miles', 'milla', 'millas', 'миля', 'мили'); unit('len', 1852, 'mille marin', 'milles marins', 'nautical mile', 'nautical miles', 'nmi');
unit('mass', 1e-6, 'mg', 'milligramme', 'milligrammes'); unit('mass', 1e-3, 'g', 'gramme', 'grammes', 'gram', 'grams', 'gramo', 'gramos', 'г'); unit('mass', 1, 'kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes', 'kilogram', 'kilograms', 'кг');
unit('mass', 1000, 't', 'tonne', 'tonnes', 'ton', 'tons', 'тонна', 'тонны'); unit('mass', 0.45359237, 'lb', 'lbs', 'livre', 'livres', 'pound', 'pounds', 'libra', 'libras'); unit('mass', 0.028349523, 'oz', 'once', 'onces', 'ounce', 'ounces', 'onza', 'onzas');
unit('vol', 1e-3, 'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'); unit('vol', 0.01, 'cl', 'centilitre', 'centilitres'); unit('vol', 0.1, 'dl', 'décilitre', 'décilitres'); unit('vol', 1, 'l', 'litre', 'litres', 'liter', 'liters', 'litro', 'litros', 'л');
unit('vol', 3.785411784, 'gal', 'gallon', 'gallons', 'galón', 'galones'); unit('vol', 0.2365882365, 'cup', 'cups', 'tasse', 'tasses', 'taza', 'tazas'); unit('vol', 1000, 'm3', 'm³', 'mètre cube', 'mètres cubes');
unit('area', 1, 'm2', 'm²', 'mètre carré', 'mètres carrés', 'square meter', 'square meters'); unit('area', 1e6, 'km2', 'km²', 'kilomètre carré', 'kilomètres carrés'); unit('area', 1e4, 'ha', 'hectare', 'hectares', 'hectárea', 'hectáreas', 'га'); unit('area', 4046.8564224, 'acre', 'acres');
unit('speed', 1 / 3.6, 'km/h', 'kmh', 'kph', 'км/ч'); unit('speed', 1, 'm/s'); unit('speed', 0.44704, 'mph'); unit('speed', 0.514444, 'noeud', 'noeuds', 'nœud', 'nœuds', 'knot', 'knots', 'kn');
unit('time', 1, 's', 'sec', 'seconde', 'secondes', 'second', 'seconds', 'segundo', 'segundos'); unit('time', 60, 'min', 'minute', 'minutes', 'minuto', 'minutos', 'мин'); unit('time', 3600, 'h', 'heure', 'heures', 'hour', 'hours', 'hora', 'horas', 'ч', 'час', 'часа', 'часов');
unit('time', 86400, 'j', 'jour', 'jours', 'day', 'days', 'día', 'días', 'dia', 'dias', 'день', 'дня', 'дней'); unit('time', 604800, 'semaine', 'semaines', 'week', 'weeks', 'semana', 'semanas'); unit('time', 31557600, 'an', 'ans', 'année', 'années', 'year', 'years', 'año', 'años', 'ano', 'anos');
unit('data', 1, 'o', 'octet', 'octets', 'b', 'byte', 'bytes'); unit('data', 1024, 'ko', 'kb', 'kio', 'kib'); unit('data', 1024 ** 2, 'mo', 'mb', 'mio', 'mib'); unit('data', 1024 ** 3, 'go', 'gb', 'gio', 'gib'); unit('data', 1024 ** 4, 'to', 'tb', 'tio', 'tib');
['c', '°c', 'celsius', 'degré celsius', 'degrés celsius', 'degres celsius', 'grados celsius'].forEach(n => (U[fold(n)] = { dim: 'temp', t: 'c' }));
['f', '°f', 'fahrenheit', 'degrés fahrenheit', 'grados fahrenheit'].forEach(n => (U[fold(n)] = { dim: 'temp', t: 'f' }));
['k', 'kelvin', 'kelvins'].forEach(n => (U[fold(n)] = { dim: 'temp', t: 'k' }));
const CUR = { '€': 'EUR', euro: 'EUR', euros: 'EUR', '$': 'USD', dollar: 'USD', dollars: 'USD', 'dollar americain': 'USD', 'dollars americains': 'USD', dolar: 'USD', dolares: 'USD', доллар: 'USD', доллара: 'USD', долларов: 'USD', fcfa: 'XOF', cfa: 'XOF', 'franc cfa': 'XOF', 'francs cfa': 'XOF', '£': 'GBP', 'livre sterling': 'GBP', 'livres sterling': 'GBP', sterling: 'GBP', '¥': 'JPY', yen: 'JPY', yens: 'JPY', yuan: 'CNY', yuans: 'CNY', rouble: 'RUB', roubles: 'RUB', рубль: 'RUB', рубля: 'RUB', рублей: 'RUB', руб: 'RUB', dirham: 'MAD', dirhams: 'MAD', naira: 'NGN', 'franc suisse': 'CHF', 'francs suisses': 'CHF', real: 'BRL', reais: 'BRL', roupie: 'INR', roupies: 'INR', 'dollar canadien': 'CAD', 'dollars canadiens': 'CAD', евро: 'EUR', 'يورو': 'EUR', 'دولار': 'USD' };
const curOf = w => { const f = fold(w).trim(); if (CUR[f]) return CUR[f]; return /^[a-z]{3}$/.test(f) ? f.toUpperCase() : ''; };
const unitOf = w => U[fold(w).trim().replace(/\s+/g, ' ')] || null;
const nf = (v, max = 6) => new Intl.NumberFormat(LANG(), { maximumFractionDigits: Math.abs(v) >= 1000 ? 2 : max }).format(v);
async function calc(q) {
  let s = String(q || '').trim().replace(/^=\s*/, ''); if (!s || s.length > 120 || /^[a-z][\w+.-]*:\/\//i.test(s)) return null;
  s = s.replace(/(\d)\s+(?=\d{3}\b)/g, '$1'); // 2 400 → 2400
  // pourcentage : « 15 % de 2400 », « 15% of 2400 »
  let m = /^([\d.,]+)\s*%\s*(?:de|d'|of|del|de la|от|من)\s*(.+)$/i.exec(s);
  if (m) { try { const v = parseFloat(m[1].replace(',', '.')) / 100 * evalExpr(m[2]); if (isFinite(v)) return { text: TF('{0} % de {1} = {2}', m[1], m[2], nf(v)), copy: String(+v.toFixed(10)) }; } catch {} }
  // conversion : « 5 km en miles », « 30 euros en FCFA », « 100 °F en °C »
  m = /^(-?[\d.,]+)\s*(.+?)\s+(?:en|in|to|a|à|para|em|в|إلى|->|=)\s+(.+)$/i.exec(s);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.')); if (!isFinite(n)) return null;
    const a = unitOf(m[2]), b = unitOf(m[3]);
    if (a && b && a.dim === b.dim) {
      let v;
      if (a.dim === 'temp') { const c = a.t === 'c' ? n : a.t === 'f' ? (n - 32) * 5 / 9 : n - 273.15; v = b.t === 'c' ? c : b.t === 'f' ? c * 9 / 5 + 32 : c + 273.15; }
      else v = n * a.f / b.f;
      return { text: `${nf(n)} ${m[2].trim()} = ${nf(v)} ${m[3].trim()}`, copy: String(+v.toFixed(10)) };
    }
    const ca = curOf(m[2]), cb = curOf(m[3]);
    if (ca && cb && ca !== cb) {
      const R = await B.call('br:rates').catch(() => null); const r = R?.rates || {};
      if (!r[ca] || !r[cb]) return null;
      const v = n / r[ca] * r[cb], dec = ['XOF', 'XAF', 'JPY', 'KRW'].includes(cb) ? 0 : 2;
      const when = R.t ? new Date(R.t).toLocaleDateString(LANG()) : '';
      return { text: `${nf(n)} ${ca} = ${new Intl.NumberFormat(LANG(), { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(v)} ${cb}${when ? ' · ' + TF('taux du {0}', when) : ''}`, copy: v.toFixed(dec) };
    }
    return null;
  }
  // calcul simple : il faut au moins un opérateur et seulement des chiffres
  if (!/^[\d\s.,+\-*/×÷^()%−:x]+$/i.test(s) || !/\d\s*[-+*/×÷^%:x−]\s*[\d(]|\d\s*%\s*$|\)\s*[-+*/×÷^]/i.test(s) || /^\d{1,2}:\d{2}$/.test(s)) return null;
  try { const v = evalExpr(s); if (!isFinite(v)) return null; return { text: `${s} = ${nf(v, 10)}`, copy: String(+v.toFixed(10)) }; } catch { return null; }
}

// ---------------------------------------------------------------- panneau latéral : branchement
async function drawSide(kind, body) { if (kind === 'ws') return drawSpaces(body); if (kind === 'col') return drawCols(body); }

window.WORK = { drawSide, drawMarks, ctnMenu, ctnColor, palette, cite, present, calc, speedMenu, evalExpr, citeFormats, isPresent: () => presOn };
})();
