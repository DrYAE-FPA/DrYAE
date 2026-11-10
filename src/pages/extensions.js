/* dryae://extensions — extensions intégrées et extensions Chrome */
let MODS = [], EXT = [], q = '', view = 'list', dev = false, details = '';
shell('Extensions', null, 'Rechercher dans les extensions');
try { dev = localStorage.getItem('dev') === '1'; } catch {}
const search = $('#q');
function drawNav() {
  $('#nav').innerHTML = `<button data-v="list" class="${view === 'list' ? 'on' : ''}">${ic('puzzle')}<span>${esc(TR('Mes extensions'))}</span><span class="count">${MODS.filter(m => m.installed !== false).length + EXT.length}</span></button>
    <button data-v="keys" class="${view === 'keys' ? 'on' : ''}">${ic('kbd')}<span>${esc(TR('Raccourcis clavier'))}</span></button>
    <hr><button data-v="store">${ic('store')}<span>${esc(TR('Boutique Chrome Web Store'))}</span></button>
    <div class="navfoot">${esc(TR('Les extensions intégrées font partie de DrYAE : elles se désactivent, se masquent ou se retirent ici. Les autres viennent de la boutique Chrome Web Store ou d\'un dossier.'))}</div>`;
}
$('#nav').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; if (b.dataset.v === 'store') return D.call('open', 'https://chromewebstore.google.com/', {}); view = b.dataset.v; drawNav(); draw(); };
search.oninput = () => { q = search.value.trim().toLowerCase(); draw(); };
async function load() { MODS = await call('modules'); EXT = await call('extList'); drawNav(); draw(); }
D.on('cfg', async () => { MODS = await call('modules'); draw(); });
const match = (...s) => !q || s.join(' ').toLowerCase().includes(q);
function draw() { if (view === 'keys') return drawKeys(); drawList(); }
function drawList() {
  const inst = MODS.filter(m => m.installed !== false && match(TR(m.name), TR(m.desc)));
  const gone = MODS.filter(m => m.installed === false && match(TR(m.name), TR(m.desc)));
  const ext = EXT.filter(x => match(x.name, x.description, x.id));
  const card = (inner, cls = '') => `<div class="pcard ${cls}" style="margin:0;display:flex;flex-direction:column">${inner}</div>`;
  const modCard = m => card(`<div class="prow" style="border:0;align-items:flex-start"><span class="favx" style="width:40px;height:40px;border-radius:11px;background:var(--accent-soft);color:var(--accent)">${ic(m.icon)}</span>
      <div class="tx"><b>${esc(TR(m.name))} <span class="tag" style="margin-left:4px">DrYAE</span></b><span>${esc(TR(m.desc))}</span>${m.key ? `<span style="margin-top:6px"><kbd class="mono" style="font-size:11px;border:1px solid var(--line2);border-radius:4px;padding:0 5px">${esc(TR(m.key))}</kbd></span>` : ''}</div></div>
    <div class="prow" style="margin-top:auto;gap:6px"><button class="btn sm" data-opt="${m.id}">${ic('gear')}${esc(TR('Options'))}</button><button class="btn sm" data-pin="${m.id}" title="${esc(TR('Afficher ou masquer le bouton dans la barre d\'outils du navigateur'))}">${ic(m.pinned !== false ? 'eye' : 'eyeoff')}${esc(TR(m.pinned !== false ? 'Dans la barre d\'outils' : 'Masquée de la barre'))}</button><button class="btn sm" data-rm="${m.id}">${esc(TR('Retirer'))}</button><span style="flex:1"></span>${sw('m_' + m.id, m.enabled !== false)}</div>`);
  const extCard = x => card(`<div class="prow" style="border:0;align-items:flex-start">${x.icon ? `<img src="${esc(x.icon)}" style="width:40px;height:40px;border-radius:10px;flex:none" alt="">` : `<span class="favx" style="width:40px;height:40px;border-radius:11px">${esc((x.name || '?')[0])}</span>`}
      <div class="tx"><b class="notr">${esc(x.name)} <span class="hint">${esc(x.version)}</span></b><span class="notr">${esc(x.description)}</span>${dev ? `<span class="mono" style="font-size:11px">ID : ${esc(x.id)}</span>` : ''}</div></div>
    ${details === x.id ? `<div class="prow" style="flex-direction:column;align-items:stretch;gap:6px;font-size:12px"><div><b>${esc(TR('Autorisations'))}</b><div class="hint notr">${x.permissions.length ? x.permissions.map(esc).join(', ') : esc(TR('Aucune'))}</div></div>${dev ? `<div><b>${esc(TR('Dossier'))}</b><div class="hint mono notr" style="word-break:break-all">${esc(x.path)}</div></div>` : ''}<div style="display:flex;gap:6px;flex-wrap:wrap">${x.options ? `<button class="btn sm" data-xopt="${esc(x.options)}">${ic('gear')}${esc(TR('Options de l\'extension'))}</button>` : ''}${!x.local ? `<button class="btn sm" data-xhome="${esc(x.homepage)}">${ic('store')}${esc(TR('Voir dans la boutique'))}</button>` : ''}</div></div>` : ''}
    <div class="prow" style="margin-top:auto;gap:6px"><button class="btn sm" data-det="${esc(x.id)}">${esc(TR(details === x.id ? 'Masquer les détails' : 'Détails'))}</button><button class="btn sm" data-xrm="${esc(x.id)}">${esc(TR('Supprimer'))}</button><span style="flex:1"></span>${sw('x_' + x.id, x.enabled)}</div>`);
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Extensions'))}</h2><label class="hint" style="display:flex;align-items:center;gap:8px">${esc(TR('Mode développeur'))} ${sw('dev', dev)}</label>
      <div style="flex-basis:100%;display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${dev ? `<button class="btn" id="unpacked">${ic('folder')}${esc(TR('Charger une extension non empaquetée'))}</button><button class="btn" id="upd">${ic('reload')}${esc(TR('Mettre à jour'))}</button>` : ''}
      <div style="display:flex;gap:6px;flex:1;min-width:280px"><input type="text" id="lnk" style="flex:1" placeholder="${esc(TR('Lien de la boutique ou identifiant de l\'extension'))}" spellcheck="false"><button class="btn" id="lnkGo">${esc(TR('Installer avec un lien'))}</button></div></div></div>
    <div class="psec">${esc(TR('Extensions intégrées à DrYAE'))}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">${inst.map(modCard).join('') || `<p class="hint">${esc(TR('Aucune.'))}</p>`}</div>
    ${gone.length ? `<div class="psec">${esc(TR('Extensions intégrées retirées'))}</div><div class="plist">${gone.map(m => `<div class="prow"><span style="color:var(--muted)">${ic(m.icon)}</span><div class="tx"><b>${esc(TR(m.name))}</b><span>${esc(TR(m.desc))}</span></div><button class="btn sm primary" data-add="${m.id}">${ic('plus')}${esc(TR('Ajouter'))}</button></div>`).join('')}</div>` : ''}
    <div class="psec">${esc(TR('Extensions Chrome installées'))}</div>
    ${ext.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">${ext.map(extCard).join('')}</div>` : `<div class="plist"><div class="empty">${ic('store')}${esc(TR('Aucune extension. Ouvrez la boutique Chrome Web Store, choisissez une extension puis cliquez sur « Ajouter à Chrome ».'))}<div style="margin-top:12px"><button class="btn primary" id="store">${ic('store')}${esc(TR('Ouvrir la boutique'))}</button></div></div></div>`}
    <p class="hint" style="margin-top:14px">${esc(TR('La plupart des extensions courantes fonctionnent ; certaines fonctions avancées de Chrome peuvent manquer. Après un changement, actualisez les pages ouvertes.'))}</p>`;
  const on = (s, fn) => { const x = $(s); if (x) x.onclick = fn; };
  $('#dev').onchange = e => { dev = e.target.checked; try { localStorage.setItem('dev', dev ? '1' : '0'); } catch {} draw(); };
  on('#unpacked', async () => { try { const r = await call('extLoadDir'); if (r) { EXT = r; toast('Extension ajoutée'); draw(); } } catch {} });
  on('#upd', async () => { toast('Mise à jour des extensions…'); try { EXT = await call('extUpdate'); toast('Extensions à jour'); draw(); } catch {} });
  on('#store', () => D.call('open', 'https://chromewebstore.google.com/', {}));
  on('#lnkGo', async () => { const v = $('#lnk').value.trim(); if (!v) return $('#lnk').focus(); toast('Installation de l\'extension…'); try { const r = await call('extInstall', v); toast(TRF('Extension ajoutée : {0}', r.name)); load(); } catch {} });
  $('#lnk').onkeydown = e => { if (e.key === 'Enter') $('#lnkGo').click(); };
  $('#wrap').onchange = async e => {
    const id = e.target.id;
    if (id.startsWith('m_')) { await call('setModule', id.slice(2), { enabled: e.target.checked }); toast(e.target.checked ? 'Extension activée : actualisez les pages ouvertes' : 'Extension désactivée'); }
    if (id.startsWith('x_')) { try { await call('extEnable', id.slice(2), e.target.checked); EXT = await call('extList'); draw(); } catch { e.target.checked = !e.target.checked; } }
  };
  $('#wrap').onclick = async e => {
    const g = a => e.target.closest('[data-' + a + ']')?.dataset[a];
    let v;
    if ((v = g('opt'))) D.call('openPage', 'settings', v);
    if ((v = g('pin'))) { const m = MODS.find(x => x.id === v); await call('setModule', v, { pinned: m.pinned === false }); MODS = await call('modules'); draw(); }
    if ((v = g('rm'))) { const m = MODS.find(x => x.id === v); if (await confirmBox(TRF('Retirer « {0} » ? Vous pourrez la rajouter à tout moment depuis cette page.', TR(m.name)), 'Retirer')) { await call('setModule', v, { installed: false }); MODS = await call('modules'); draw(); } }
    if ((v = g('add'))) { await call('setModule', v, { installed: true, enabled: true }); MODS = await call('modules'); draw(); toast('Extension ajoutée'); }
    if ((v = g('det'))) { details = details === v ? '' : v; draw(); }
    if ((v = g('xopt'))) D.call('openExtOptions', v);
    if ((v = g('xhome'))) D.call('open', v, {});
    if ((v = g('xrm'))) { const x = EXT.find(y => y.id === v); if (await confirmBox(TRF('Supprimer l\'extension « {0} » ?', x.name), 'Supprimer')) { EXT = await call('extRemove', v); draw(); } }
  };
}
function drawKeys() {
  const rows = [
    ['Ctrl+Maj+E', 'Traducteur', 'Traduire la sélection ou la page'], ['Ctrl+Maj+S', 'Traducteur de scans', 'Traduire les images de la page'],
    ['Ctrl+Maj+L', 'Lumières tamisées', 'Assombrir la page autour de la vidéo'], ['Ctrl+Maj+U', "Image dans l'image", 'Détacher la vidéo dans une petite fenêtre'],
    ['Ctrl+Maj+Y', 'Téléchargements par DrYAE', 'Fichiers détectés sur cette page'], ['Ctrl+Maj+A', 'DrYAE', 'Ouvrir cette page'],
  ];
  $('#wrap').innerHTML = `<div class="phead"><h2>${esc(TR('Raccourcis clavier'))}</h2><p>${esc(TR('Raccourcis des extensions intégrées. Les extensions Chrome gardent les leurs.'))}</p></div>
    <div class="pcard">${rows.map(([k, n, d]) => `<div class="prow"><div class="tx"><b>${esc(TR(n))}</b><span>${esc(TR(d))}</span></div><kbd class="mono" style="border:1px solid var(--line2);border-radius:6px;padding:3px 8px">${esc(TR(k))}</kbd></div>`).join('')}</div>`;
}
load();
