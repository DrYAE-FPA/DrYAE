/* dryae://passwords — mots de passe, vérification, cartes de paiement, adresses */
let DATA = null, view = 'list', site = null, q = '', undoN = 0, CARDS = [], ADDR = [];
shell('Mots de passe et saisie automatique', null, 'Rechercher des mots de passe');
const search = $('#q');
const VIEWS = [['list', 'key', 'Mots de passe'], ['check', 'shield', 'Vérification'], ['cards', 'card', 'Modes de paiement'], ['addresses', 'pin', 'Adresses et coordonnées'], ['settings', 'gear', 'Paramètres']];
function drawNav() {
  const issues = DATA?.check ? new Set([...DATA.check.compromised.map(c => c.key), ...DATA.check.weak, ...DATA.check.reused.flat()]).size : 0;
  $('#nav').innerHTML = VIEWS.map(([v, i, l]) => `<button data-v="${v}" class="${view === v || (v === 'list' && view === 'site') ? 'on' : ''}">${ic(i)}<span>${esc(TR(l))}</span>${v === 'list' ? `<span class="count">${DATA ? DATA.logins.length : ''}</span>` : v === 'check' && issues ? `<span class="count bad">${issues}</span>` : ''}</button>`).join('') +
    `<div class="navfoot">${ic('lock')} ${esc(TR('Les mots de passe et les numéros de carte sont chiffrés par Windows sur ce PC. Ils ne sont envoyés nulle part.'))}</div>`;
}
$('#nav').onclick = e => { const b = e.target.closest('[data-v]'); if (b) go(b.dataset.v); };
function go(v, s) { view = v; site = s || null; history.replaceState(null, '', '#' + (v === 'list' ? '' : v)); nav.clear(); nav.focus = -1; drawNav(); draw(); $('#main').scrollTop = 0; }
search.oninput = () => { q = search.value.trim().toLowerCase(); if (view !== 'list') go('list'); else draw(); };
const keyOf = l => l.origin + '\u0000' + l.username;
const nav = new ListNav({
  root: $('#wrap'), search, selectMode: true,
  onOpen: k => { if (view === 'list') go('site', k); },
  onDelete: ks => { if (view === 'list') delSites(ks); },
  onMenu: (k, x, y) => { if (view === 'list') pmenu(x, y, [{ label: 'Afficher', icon: 'eye', fn: () => go('site', k) }, { label: 'Supprimer tous les comptes de ce site', icon: 'trash', danger: true, fn: () => delSites([k]) }]); },
  onUndo: async () => { if (undoN) { await call('pwUndo'); undoN = 0; toast('Suppression annulée'); } },
});
async function load() { DATA = await call('pwList'); drawNav(); draw(); }
D.on('vault', () => { clearTimeout(load.t); load.t = setTimeout(load, 150); });
function sites() {
  const m = new Map();
  for (const l of DATA.logins) { if (q && !(l.host + ' ' + l.username).toLowerCase().includes(q)) continue; if (!m.has(l.site)) m.set(l.site, []); m.get(l.site).push(l); }
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}
function draw() {
  if (!DATA) return;
  ({ list: drawList, site: drawSite, check: drawCheck, cards: drawCards, addresses: drawAddr, settings: drawSettings })[view]?.();
  nav.paint();
}
function drawList() {
  const S = sites();
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Mots de passe'))}</h2><button class="btn primary" id="add">${ic('plus')}${esc(TR('Ajouter'))}</button>
      <p>${esc(TR('Créez, enregistrez et gérez vos mots de passe pour vous connecter facilement aux sites.'))}</p></div>
    <div class="plist">${S.length ? S.map(([s, l]) => `<div class="lrow" data-k="${esc(s)}" style="padding:11px 16px">${favHtml('https://' + s, '')}<div class="tt"><b class="notr">${esc(s)}</b>${l.length > 1 ? `<span>${esc(TRF('{0} comptes', l.length))}</span>` : `<span class="notr">${esc(l[0].username)}</span>`}</div><span style="color:var(--dim)">${ic('fwd')}</span></div>`).join('')
      : `<div class="empty">${ic('key')}${esc(TR(q ? 'Aucun résultat' : 'Aucun mot de passe enregistré. Connectez-vous à un site : DrYAE proposera de l\'enregistrer.'))}</div>`}</div>
    ${DATA.never.length && !q ? `<p class="hint">${esc(TRF('{0} site(s) refusé(s) : voir Paramètres.', DATA.never.length))}</p>` : ''}`;
  $('#add').onclick = () => editLogin();
  $('#wrap').onclick = e => { const r = e.target.closest('[data-k]'); if (r && !e.ctrlKey && !e.shiftKey) go('site', r.dataset.k); };
}
async function delSites(ss) {
  const list = DATA.logins.filter(l => ss.includes(l.site));
  if (!(await confirmBox(TRF('Supprimer {0} mot(s) de passe ?', list.length), 'Supprimer'))) return;
  undoN = await call('pwDelete', list.map(l => ({ origin: l.origin, username: l.username })));
  toast(TRF('{0} mot(s) de passe supprimé(s)', undoN), { label: 'Annuler', fn: async () => { await call('pwUndo'); undoN = 0; } });
}
// ---- détail d'un site ----
function drawSite() {
  const list = DATA.logins.filter(l => l.site === site);
  if (!list.length) return go('list');
  $('#wrap').innerHTML = `<div class="phead"><button class="icon-btn" id="back" title="${esc(TR('Retour'))}">${ic('back')}</button>${favHtml('https://' + site, '')}<h2 class="notr">${esc(site)}</h2><button class="btn" id="add">${ic('plus')}${esc(TR('Ajouter un compte'))}</button></div>
    ${list.map((l, i) => `<div class="pcard" data-i="${i}">
      <div class="prow"><div class="tx"><span>${esc(TR('Identifiant'))}</span><b class="notr">${esc(l.username || TR('(sans identifiant)'))}</b></div><button class="icon-btn" data-a="cu" title="${esc(TR('Copier l\'identifiant'))}">${ic('copy')}</button></div>
      <div class="prow"><div class="tx"><span>${esc(TR('Mot de passe'))}</span><b class="mono pw notr">••••••••••</b></div><button class="icon-btn" data-a="show" title="${esc(TR('Afficher'))}">${ic('eye')}</button><button class="icon-btn" data-a="cp" title="${esc(TR('Copier le mot de passe'))}">${ic('copy')}</button></div>
      <div class="prow"><div class="tx"><span>${esc(TR('Site'))}</span><b class="notr"><a class="lnk" data-a="open">${esc(l.origin)}</a></b></div></div>
      ${l.note ? `<div class="prow"><div class="tx"><span>${esc(TR('Note'))}</span><b class="note notr" style="white-space:pre-wrap">…</b></div></div>` : ''}
      <div class="prow"><span class="hint" style="flex:1">${esc(TRF('Enregistré le {0}', new Date(l.t).toLocaleDateString(LOC())))}${l.used ? ' · ' + esc(TRF('utilisé le {0}', new Date(l.used).toLocaleDateString(LOC()))) : ''}</span><button class="btn sm" data-a="edit">${ic('edit')}${esc(TR('Modifier'))}</button><button class="btn sm danger" data-a="del">${ic('trash')}${esc(TR('Supprimer'))}</button></div>
    </div>`).join('')}`;
  list.forEach(async (l, i) => { if (l.note) { const n = await call('pwNote', l.origin, l.username); const el = $(`[data-i="${i}"] .note`); if (el) el.textContent = n; } });
  $('#back').onclick = () => go('list');
  $('#add').onclick = () => editLogin({ origin: list[0].origin, username: '', isNew: true });
  $('#wrap').onclick = async e => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    const l = list[+a.closest('[data-i]').dataset.i];
    const card = a.closest('[data-i]');
    try {
      if (a.dataset.a === 'cu') { navigator.clipboard.writeText(l.username); toast('Identifiant copié'); }
      if (a.dataset.a === 'show') { const pw = card.querySelector('.pw'); if (pw.dataset.on) { pw.textContent = '••••••••••'; delete pw.dataset.on; a.innerHTML = ic('eye'); } else { pw.textContent = await call('pwReveal', l.origin, l.username); pw.dataset.on = 1; a.innerHTML = ic('eyeoff'); } }
      if (a.dataset.a === 'cp') { navigator.clipboard.writeText(await call('pwReveal', l.origin, l.username)); toast('Mot de passe copié'); }
      if (a.dataset.a === 'open') D.call('open', l.origin, { background: true });
      if (a.dataset.a === 'edit') editLogin(l);
      if (a.dataset.a === 'del') { if (!(await confirmBox(TR('Supprimer ce mot de passe ?'), 'Supprimer'))) return; undoN = await call('pwDelete', [{ origin: l.origin, username: l.username }]); toast('Mot de passe supprimé', { label: 'Annuler', fn: async () => { await call('pwUndo'); undoN = 0; } }); }
    } catch {}
  };
}
async function editLogin(l) {
  const isNew = !l || l.isNew;
  let pw = '', note = '';
  if (!isNew) { try { pw = await call('pwReveal', l.origin, l.username); note = l.note ? await call('pwNote', l.origin, l.username) : ''; } catch { return; } }
  const r = await dialog({
    title: isNew ? 'Ajouter un mot de passe' : 'Modifier le mot de passe', ok: 'Enregistrer',
    html: `<label>${esc(TR('Site'))}</label><input type="text" id="eS" value="${esc(l?.origin || '')}" placeholder="exemple.com" spellcheck="false" ${isNew && !l?.origin ? '' : ''}>
      <label>${esc(TR('Identifiant'))}</label><input type="text" id="eU" value="${esc(l?.username || '')}" spellcheck="false" autocomplete="off">
      <label>${esc(TR('Mot de passe'))}</label><div style="display:flex;gap:6px"><input type="password" id="eP" value="${esc(pw)}" style="flex:1" autocomplete="new-password"><button class="btn" id="eEye" type="button">${ic('eye')}</button><button class="btn" id="eGen" type="button" title="${esc(TR('Générer un mot de passe fort'))}">${ic('reload')}</button></div>
      <div class="hint" id="eStr" style="margin-top:6px"></div>
      <label>${esc(TR('Note (facultatif)'))}</label><textarea id="eN" style="min-height:60px;font:inherit">${esc(note)}</textarea>`,
    onOpen: d => {
      const P = $('#eP', d), st = () => { const v = P.value; const s = v.length >= 14 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) ? ['Fort', 'ok'] : v.length >= 10 && /\d/.test(v) && /[a-zA-Z]/.test(v) ? ['Moyen', 'warn'] : ['Faible', 'bad']; $('#eStr', d).innerHTML = v ? `<span class="tag ${s[1]}">${esc(TR(s[0]))}</span>` : ''; };
      P.oninput = st; st();
      $('#eEye', d).onclick = () => { P.type = P.type === 'password' ? 'text' : 'password'; };
      $('#eGen', d).onclick = async () => { P.value = await call('pwGenerate', 18); P.type = 'text'; st(); };
    },
    read: d => { const o = { origin: $('#eS', d).value.trim(), username: $('#eU', d).value, password: $('#eP', d).value, note: $('#eN', d).value }; if (!o.origin || !o.password) { toast('Le site et le mot de passe sont obligatoires'); return false; } return o; },
  });
  if (!r) return;
  try { await call('pwSave', r, isNew ? null : { origin: l.origin, username: l.username }); toast('Mot de passe enregistré'); } catch {}
}
// ---- vérification ----
let checking = false, open3 = '';
function drawCheck() {
  const c = DATA.check;
  const byKey = k => DATA.logins.find(l => keyOf(l) === k);
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? TR("À l'instant") : m < 60 ? TRF('il y a {0} min', m) : m < 1440 ? TRF('il y a {0} h', Math.round(m / 60)) : new Date(t).toLocaleDateString(LOC()); };
  const sec = (id, icon, cls, n, title, sub, keys) => `<div class="prow click" data-open="${id}" style="${n ? '' : 'opacity:.75'}"><span class="tag ${n ? cls : 'ok'}" style="padding:6px">${ic(n ? icon : 'check')}</span><div class="tx"><b>${esc(TRF(title, n))}</b><span>${esc(TR(n ? sub : 'Aucun problème'))}</span></div><span class="chev">${ic(open3 === id ? 'back' : 'fwd')}</span></div>
    ${open3 === id && n ? keys.map(k => { const l = byKey(k); return l ? `<div class="prow" style="padding-left:56px">${favHtml(l.origin, '')}<div class="tx"><b class="notr">${esc(l.host)}</b><span class="notr">${esc(l.username)}</span></div><button class="btn sm" data-site="${esc(l.site)}">${esc(TR('Afficher'))}</button><button class="btn sm" data-chg="${esc(l.origin)}">${esc(TR('Changer le mot de passe'))}</button></div>` : ''; }).join('') : ''}`;
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Vérification des mots de passe'))}</h2><p>${esc(TR('DrYAE repère les mots de passe trop faibles, utilisés sur plusieurs sites, ou apparus dans des fuites de données connues.'))}</p></div>
    <div class="pcard">
      <div class="prow" style="background:linear-gradient(135deg,var(--accent-soft),transparent);min-height:84px"><span style="color:var(--accent)"><svg viewBox="0 0 24 24" style="width:42px;height:42px" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l8 3v6c0 5.5-3.6 9.3-8 11-4.4-1.7-8-5.5-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg></span>
        <div class="tx"><b style="font-size:15px">${c ? esc(TRF('{0} mot(s) de passe vérifié(s)', c.n)) : esc(TR('Pas encore vérifié'))}</b><span>${c ? esc(ago(c.t)) : esc(TR('Lancez une vérification pour voir les mots de passe à changer.'))}</span></div>
        <button class="btn ${c ? '' : 'primary'}" id="run" ${checking ? 'disabled' : ''}>${ic('reload')}${esc(TR(checking ? 'Vérification…' : 'Vérifier maintenant'))}</button></div>
      ${c ? sec('pwned', 'alert', 'bad', c.compromised.length, '{0} mot(s) de passe compromis', 'Apparus dans une fuite de données : changez-les dès maintenant', c.compromised.map(x => x.key)) +
        sec('reused', 'repeat', 'warn', c.reused.flat().length, '{0} mot(s) de passe réutilisé(s)', 'Utilisez un mot de passe différent pour chaque site', c.reused.flat()) +
        sec('weak', 'weak', 'warn', c.weak.length, '{0} mot(s) de passe faible(s)', 'Choisissez des mots de passe plus longs et plus variés', c.weak) : ''}
    </div>
    ${c && c.error ? `<p class="hint">${esc(TR(c.error))}</p>` : ''}
    <p class="hint">${esc(TR('Pour les fuites, seuls les 5 premiers caractères d\'une empreinte de chaque mot de passe sont envoyés au service public « Pwned Passwords » : vos mots de passe ne quittent jamais ce PC.'))}</p>`;
  $('#run').onclick = async () => { checking = true; draw(); try { DATA.check = await call('pwCheck'); } catch {} checking = false; drawNav(); draw(); };
  $('#wrap').onclick = e => {
    const o = e.target.closest('[data-open]'); if (o) { open3 = open3 === o.dataset.open ? '' : o.dataset.open; return draw(); }
    const s = e.target.closest('[data-site]'); if (s) return go('site', s.dataset.site);
    const c2 = e.target.closest('[data-chg]'); if (c2) D.call('open', c2.dataset.chg, { background: false });
  };
}
// ---- cartes de paiement ----
async function drawCards() {
  CARDS = await call('cardList');
  const P = DATA.settings;
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Modes de paiement'))}</h2><button class="btn primary" id="add">${ic('plus')}${esc(TR('Ajouter une carte'))}</button></div>
    <div class="pcard">
      <div class="prow"><div class="tx"><b>${esc(TR('Enregistrer et remplir les cartes de paiement'))}</b><span>${esc(TR('DrYAE propose vos cartes quand un site demande un numéro de carte.'))}</span></div>${sw('sPay', P.payments !== false)}</div>
      <div class="prow"><div class="tx"><b>${esc(TR('Confirmer mon identité avant de remplir une carte'))}</b><span>${esc(TR('Windows Hello (empreinte, visage ou code PIN) est demandé avant chaque utilisation.'))}</span></div>${sw('sPayH', P.paymentsHello !== false)}</div>
    </div>
    <div class="psec">${esc(TR('Cartes enregistrées'))}</div>
    <div class="plist">${CARDS.length ? CARDS.map((c, i) => `<div class="lrow" style="padding:12px 16px" data-c="${i}"><span class="favx" style="width:42px;height:28px;border-radius:5px;background:linear-gradient(135deg,#1e3a8a,#6d28d9);font-size:9px">${esc(c.brand.slice(0, 4).toUpperCase())}</span><div class="tt" style="flex-direction:column;align-items:flex-start;gap:1px"><b class="notr">${esc(c.nick || c.brand)} •••• ${esc(c.last4)}</b><span class="notr" style="max-width:none">${esc([c.holder, c.exp && TRF('expire {0}', c.exp)].filter(Boolean).join(' · '))}</span></div><button class="icon-btn" data-cm="${i}">${ic('more')}</button></div>`).join('')
      : `<div class="empty">${ic('card')}${esc(TR('Aucune carte enregistrée.'))}</div>`}</div>
    <p class="hint">${esc(TR('Le code de sécurité (CVC) n\'est jamais enregistré : le site vous le demandera à chaque paiement.'))}</p>`;
  $('#sPay').onchange = e => call('pwSettings', { payments: e.target.checked });
  $('#sPayH').onchange = e => call('pwSettings', { paymentsHello: e.target.checked });
  $('#add').onclick = () => editCard();
  $('#wrap').onclick = e => {
    const m = e.target.closest('[data-cm]'); if (!m) return; const c = CARDS[+m.dataset.cm]; const r = m.getBoundingClientRect();
    pmenu(r.left - 200, r.bottom, [
      { label: 'Afficher le numéro', icon: 'eye', fn: async () => { try { const n = await call('cardReveal', c.id); await dialog({ title: c.brand + ' •••• ' + c.last4, html: `<p class="mono notr" style="font-size:18px;letter-spacing:2px">${esc(n.replace(/(\d{4})(?=\d)/g, '$1 '))}</p>`, ok: 'Fermer', cancel: '' }); } catch {} } },
      { label: 'Modifier…', icon: 'edit', fn: () => editCard(c) },
      { label: 'Supprimer', icon: 'trash', danger: true, fn: async () => { if (await confirmBox(TR('Supprimer cette carte ?'), 'Supprimer')) { await call('cardDelete', c.id); drawCards(); } } },
    ]);
  };
}
async function editCard(c) {
  const r = await dialog({
    title: c ? 'Modifier la carte' : 'Ajouter une carte', ok: 'Enregistrer',
    html: `<label>${esc(TR('Numéro de carte'))}</label><input type="text" id="cN" inputmode="numeric" autocomplete="off" placeholder="${c ? '•••• •••• •••• ' + esc(c.last4) + ' — ' + esc(TR('laisser vide pour garder')) : '1234 5678 9012 3456'}">
      <div style="display:flex;gap:10px"><div style="flex:1"><label>${esc(TR('Date d\'expiration'))}</label><input type="text" id="cE" placeholder="MM/AA" value="${esc(c?.exp || '')}" maxlength="7"></div><div style="flex:2"><label>${esc(TR('Nom du titulaire'))}</label><input type="text" id="cH" value="${esc(c?.holder || '')}"></div></div>
      <label>${esc(TR('Surnom de la carte (facultatif)'))}</label><input type="text" id="cK" value="${esc(c?.nick || '')}" placeholder="${esc(TR('Carte prépayée, carte du travail…'))}">`,
    note: esc(TR('Sans le code CVC.')),
    onOpen: d => { $('#cN', d).oninput = e => { const v = e.target.value.replace(/\D/g, '').slice(0, 19); e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1 '); }; $('#cE', d).oninput = e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; }; },
    read: d => ({ id: c?.id, number: $('#cN', d).value, exp: $('#cE', d).value, holder: $('#cH', d).value, nick: $('#cK', d).value }),
  });
  if (!r) return;
  try { await call('cardSave', r); toast('Carte enregistrée'); drawCards(); } catch {}
}
// ---- adresses ----
const AF = [['givenName', 'Prénom'], ['familyName', 'Nom'], ['company', 'Société'], ['address', 'Adresse'], ['postalCode', 'Code postal'], ['city', 'Ville'], ['country', 'Pays'], ['tel', 'Téléphone'], ['email', 'E-mail']];
async function drawAddr() {
  ADDR = await call('addrList');
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Adresses et coordonnées'))}</h2><button class="btn primary" id="add">${ic('plus')}${esc(TR('Ajouter une adresse'))}</button></div>
    <div class="pcard"><div class="prow"><div class="tx"><b>${esc(TR('Enregistrer et remplir les adresses'))}</b><span>${esc(TR('Quand vous cliquez dans un champ « nom », « e-mail », « adresse »… DrYAE propose vos coordonnées.'))}</span></div>${sw('sAd', DATA.settings.addresses !== false)}</div></div>
    <div class="plist">${ADDR.length ? ADDR.map((a, i) => `<div class="lrow" style="padding:12px 16px">${ic('pin')}<div class="tt" style="flex-direction:column;align-items:flex-start;gap:1px"><b class="notr">${esc([a.givenName, a.familyName].filter(Boolean).join(' ') || a.company || a.email || TR('Adresse'))}</b><span class="notr" style="max-width:none">${esc([a.address, a.postalCode, a.city, a.country].filter(Boolean).join(', ') || a.email || '')}</span></div><button class="icon-btn" data-e="${i}" title="${esc(TR('Modifier'))}">${ic('edit')}</button><button class="icon-btn" data-d="${i}" title="${esc(TR('Supprimer'))}">${ic('trash')}</button></div>`).join('')
      : `<div class="empty">${ic('pin')}${esc(TR('Aucune adresse enregistrée.'))}</div>`}</div>`;
  $('#sAd').onchange = e => call('pwSettings', { addresses: e.target.checked });
  $('#add').onclick = () => editAddr();
  $('#wrap').onclick = async e => { const ed = e.target.closest('[data-e]'), dl = e.target.closest('[data-d]'); if (ed) editAddr(ADDR[+ed.dataset.e]); if (dl && await confirmBox(TR('Supprimer cette adresse ?'), 'Supprimer')) { await call('addrDelete', ADDR[+dl.dataset.d].id); drawAddr(); } };
}
async function editAddr(a) {
  const r = await dialog({
    title: a ? "Modifier l'adresse" : 'Ajouter une adresse', ok: 'Enregistrer',
    html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">${AF.map(([k, l]) => `<div style="${k === 'address' || k === 'email' ? 'grid-column:1/3' : ''}"><label>${esc(TR(l))}</label><input type="${k === 'email' ? 'email' : k === 'tel' ? 'tel' : 'text'}" data-f="${k}" value="${esc(a?.[k] || '')}"></div>`).join('')}</div>`,
    read: d => { const o = { id: a?.id }; $$('[data-f]', d).forEach(i => { o[i.dataset.f] = i.value.trim(); }); return o; },
  });
  if (!r) return;
  await call('addrSave', r); toast('Adresse enregistrée'); drawAddr();
}
// ---- paramètres ----
function drawSettings() {
  const P = DATA.settings;
  const row = (id, t, s, on) => `<div class="prow"><div class="tx"><b>${esc(TR(t))}</b><span>${esc(TR(s))}</span></div>${sw(id, on)}</div>`;
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Paramètres'))}</h2></div>
    <div class="pcard">
      ${row('sOffer', 'Proposer d\'enregistrer les mots de passe', 'Après une connexion, DrYAE propose de garder l\'identifiant et le mot de passe.', P.offer !== false)}
      ${row('sFill', 'Connexion automatique', 'Les identifiants enregistrés sont remplis tout seuls quand il n\'y en a qu\'un pour le site.', P.autofill !== false)}
      ${row('sSug', 'Proposer des mots de passe forts', 'Sur les pages d\'inscription, DrYAE suggère un mot de passe solide et unique.', P.suggest !== false)}
      <div class="prow"><div class="tx"><b>${esc(TR('Utiliser Windows Hello pour afficher les mots de passe'))}</b><span>${esc(TR('Empreinte, visage ou code PIN demandé avant d\'afficher, de copier ou d\'exporter un mot de passe.'))}</span></div><button class="btn sm" id="hTest">${esc(TR('Tester'))}</button>${sw('sHello', !!P.hello)}</div>
      <div class="prow"><div class="tx"><b>${esc(TR('Chiffrement sur cet appareil'))}</b><span>${esc(TR('Vos mots de passe sont chiffrés par Windows avant d\'être enregistrés sur ce PC.'))}</span></div><span class="tag ok">${ic('lock')}${esc(TR('Activé'))}</span></div>
    </div>
    <div class="pcard">
      <div class="prow click" id="imp"><div class="tx"><b>${esc(TR('Importer des mots de passe'))}</b><span>${esc(TR('Fichier .csv exporté par un navigateur ou un gestionnaire de mots de passe (colonnes url, username, password).'))}</span></div><span class="chev">${ic('fwd')}</span></div>
      <div class="prow"><div class="tx"><b>${esc(TR('Exporter les mots de passe'))}</b><span>${esc(TR('Quand vous n\'avez plus besoin du fichier, supprimez-le : il contient vos mots de passe en clair.'))}</span></div><button class="btn sm" id="exp">${ic('dl')}${esc(TR('Télécharger le fichier'))}</button></div>
      <div class="prow"><div class="tx"><b>${esc(TR('Ajouter un raccourci sur le Bureau'))}</b><span>${esc(TR('Pour ouvrir directement cette page.'))}</span></div><button class="btn sm" id="lnk">${esc(TR('Créer le raccourci'))}</button></div>
      <div class="prow"><div class="tx"><b>${esc(TR('Supprimer toutes les données'))}</b><span>${esc(TR('Tous les mots de passe enregistrés et la liste des sites refusés seront définitivement supprimés.'))}</span></div><button class="btn sm danger" id="wipe">${esc(TR('Supprimer les données'))}</button></div>
    </div>
    <div class="psec">${esc(TR('Sites refusés'))}</div>
    <div class="plist"><div class="prow" style="border-top:0"><span class="hint" style="flex:1">${esc(TR('Vous avez choisi de ne jamais enregistrer les mots de passe de ces sites.'))}</span><button class="btn sm" id="addNever">${ic('plus')}${esc(TR('Ajouter'))}</button></div>
      ${DATA.never.length ? DATA.never.map((o, i) => `<div class="lrow" style="padding:9px 16px">${favHtml(o, '')}<div class="tt"><b class="notr">${esc(o.replace(/^https?:\/\//, ''))}</b></div><button class="icon-btn" data-un="${i}" title="${esc(TR('Retirer'))}">${ic('x')}</button></div>`).join('') : `<div class="empty" style="padding:18px">${esc(TR('Aucun site refusé.'))}</div>`}</div>`;
  const set = (id, k) => { $(id).onchange = e => call('pwSettings', { [k]: e.target.checked }); };
  set('#sOffer', 'offer'); set('#sFill', 'autofill'); set('#sSug', 'suggest'); set('#sHello', 'hello');
  $('#hTest').onclick = async () => { const r = await call('helloTest'); toast(r.unavailable ? 'Windows Hello n\'est pas configuré sur ce PC' : r.ok ? 'Identité confirmée' : 'Identité non confirmée'); };
  $('#imp').onclick = async () => { try { const r = await call('pwImport'); if (r) toast(TRF('{0} ajouté(s), {1} mis à jour, {2} ignoré(s)', r.added, r.updated, r.skipped)); } catch {} };
  $('#exp').onclick = async () => { if (!(await confirmBox(TR("Le fichier exporté contiendra vos mots de passe en clair : toute personne qui l'ouvre pourra les lire. Continuer ?"), 'Exporter', false))) return; try { const r = await call('pwExport'); if (r) toast(TRF('{0} mot(s) de passe exporté(s)', r.n)); } catch {} };
  $('#lnk').onclick = async () => { const ok = await call('pwShortcut'); toast(ok ? 'Raccourci créé sur le Bureau' : 'Impossible de créer le raccourci'); };
  $('#wipe').onclick = async () => { if (!(await confirmBox(TR('Supprimer définitivement tous les mots de passe enregistrés ?'), 'Supprimer'))) return; try { await call('pwDeleteAll'); toast('Données supprimées'); } catch {} };
  $('#addNever').onclick = async () => { const r = await dialog({ title: 'Ne jamais enregistrer pour ce site', ok: 'Ajouter', html: `<label>${esc(TR('Site'))}</label><input type="text" id="nS" placeholder="exemple.com">`, read: d => $('#nS', d).value.trim() || false }); if (r) call('pwNever', r); };
  $('#wrap').onclick = e => { const b = e.target.closest('[data-un]'); if (b) call('pwUnnever', DATA.never[+b.dataset.un]); };
}
const h0 = location.hash.replace('#', '');
if (VIEWS.some(v => v[0] === h0)) view = h0;
addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (VIEWS.some(v => v[0] === h) && h !== view) go(h); });
load();
