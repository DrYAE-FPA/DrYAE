/* DrYAE 1.6.5 — fenêtres de la barre d'outils :
   menu des extensions (épingler / détacher), traducteur, traducteur de scans, lumières tamisées, bloqueur.
   Ce fichier est chargé après browser.js et utilise ses fonctions ($, B, CFG, cur, esc, ic, menu, toast, pageCmd…). */
const PARTITION = 'persist:dryae-web';
const POP = { kind: null, anchor: null };
const popEl = $('#pop');
const TLANG_CODES = ['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'he', 'hi', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'ln', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'uz', 'vi', 'cy', 'wo', 'xh', 'yi', 'yo', 'zu'];
const uiLang = () => (window.I18N && I18N.lang) || CFG.lang || 'fr';
const langName = c => { try { return new Intl.DisplayNames([uiLang()], { type: 'language' }).of(c) || c; } catch { return c || ''; } };
const langOptions = (sel, extra) => (extra || '') + TLANG_CODES.map(c => [c, langName(c)]).sort((a, b) => a[1].localeCompare(b[1], uiLang())).map(([c, n]) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
const tg = (key, on, title) => `<span class="tg ${on ? 'on' : ''}" data-tg="${key}" role="switch" aria-checked="${!!on}" title="${esc(T(title || ''))}"></span>`;
const curHost = () => (/^https?:/.test(cur?.url || '') ? hostOf(cur.url) : '');
async function setB(patch) { CFG = { ...CFG, ...(await B.call('br:setSettings', patch)) }; }
async function setSite(kind, val) { const h = curHost(); if (!h) return; CFG = { ...CFG, ...(await B.call('br:site', kind, h, val)) }; }

// ---------- ouverture / fermeture ----------
function popOpen(kind, anchor) {
  if (POP.kind === kind && popEl.classList.contains('on')) return popClose();
  $('#menu').classList.remove('on');
  POP.kind = kind; POP.anchor = anchor || $('#bExt');
  popEl.dataset.kind = kind;
  popEl.classList.add('on');
  popRender();
}
function popPlace() {
  const r = POP.anchor?.isConnected ? POP.anchor.getBoundingClientRect() : $('#bExt').getBoundingClientRect();
  const w = popEl.offsetWidth;
  popEl.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  popEl.style.top = (r.bottom + 6) + 'px';
}
function popClose() { POP.kind = null; popEl.classList.remove('on'); popEl.innerHTML = ''; }
function popRender() {
  const f = { ext: drawExtPop, translate: drawTrPop, scan: drawScanPop, lights: drawLightsPop, adblock: drawAdPop }[POP.kind];
  if (!f) return popClose();
  f(); if (window.I18N?.translateDom) try { I18N.translateDom(popEl); } catch {}
  popPlace();
}
document.addEventListener('mousedown', e => { if (POP.kind && !e.target.closest('#pop') && !e.target.closest('#menu') && !(POP.anchor && POP.anchor.contains(e.target))) popClose(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && POP.kind) popClose(); });
addEventListener('resize', () => { if (POP.kind) popPlace(); });
popEl.addEventListener('click', e => { const t = e.target.closest('[data-tg]'); if (t) { t.classList.toggle('on'); onToggle(t.dataset.tg, t.classList.contains('on')); } });
const TOGGLES = {};
function onToggle(k, on) { const f = TOGGLES[k]; if (f) f(on); }

// ---------- extensions Chrome : état des boutons (icône, badge) ----------
const ACTIONS = new Set();
let EXTS = [];
const BA = window.browserAction;
async function loadExts() { try { EXTS = await B.call('br:extList'); } catch { EXTS = []; } drawExtPins(); if (POP.kind === 'ext') popRender(); }
if (BA) {
  BA.addEventListener('update', state => { ACTIONS.clear(); (state.actions || []).forEach(a => ACTIONS.add(a.id)); drawExtPins(); });
  BA.addObserver(PARTITION);
  BA.getState(PARTITION).catch(() => {});
}
function extPinned(x) { return !(CFG.extUnpinned || []).includes(x.id); }
function drawExtPins() {
  const box = $('#tbItems'); if (!box) return;
  const want = EXTS.filter(x => x.enabled && extPinned(x) && ACTIONS.has(x.id)).map(x => x.id);
  [...box.querySelectorAll('.tb.ext')].forEach(b => { if (!want.includes(b.id)) b.remove(); });
  for (const id of want) {
    if (box.querySelector(`[id="${id}"]`)) continue;
    const b = document.createElement('button', { is: 'browser-action' });
    b.className = 'tb ext';
    b.dataset.key = 'ext:' + id;
    b.setAttribute('partition', PARTITION);
    b.setAttribute('alignment', 'bottom');
    b.id = id;
    // avant d'ouvrir la fenêtre de l'extension : l'onglet affiché est bien l'onglet actif pour l'extension
    b.addEventListener('mousedown', () => { if (cur?.wcId) { b.setAttribute('tab', cur.wcId); B.call('br:selectTab', cur.wcId); } }, true);
    box.appendChild(b);
  }
  drawExtTab();
  if (typeof sortToolbar === 'function') sortToolbar();
}
function drawExtTab() { const id = cur?.wcId; if (id) $$('#tbItems .ext').forEach(b => { if (b.getAttribute('tab') !== String(id)) b.setAttribute('tab', id); }); }
function activateExt(id, anchor) {
  if (!BA || !cur?.wcId) return toast('Ouvre une page web d\'abord');
  B.call('br:selectTab', cur.wcId);
  const r = (anchor || $('#bExt')).getBoundingClientRect();
  BA.activate(PARTITION, { eventType: 'click', extensionId: id, tabId: cur.wcId, alignment: 'bottom', anchorRect: { x: r.left, y: r.top, width: r.width, height: r.height } }).catch(() => {});
}
B.on('ext-changed', () => { loadExts(); if (BA) BA.getState(PARTITION).catch(() => {}); });
loadExts();

// ---------- menu des extensions ----------
const MOD_ACTION = {
  adblock: a => popOpen('adblock', a), translate: a => popOpen('translate', a), scan: a => popOpen('scan', a), lights: a => popOpen('lights', a),
  capture: () => { popClose(); togglePanel('media', true); }, pip: () => { popClose(); if (cur?.wcId) B.call('br:pip', cur.wcId); },
};
function drawExtPop() {
  const M = CFG.mods || {};
  const ord = k => { const i = tbOrder().indexOf(k); return i < 0 ? 1000 : i; };
  const mods = MODS.filter(([id]) => M[id]?.installed !== false).map((m, i) => [m, i]).sort((a, b) => (ord('mod:' + a[0][0]) - ord('mod:' + b[0][0])) || a[1] - b[1]).map(x => x[0]);
  const row = (o) => `<div class="prow clk" draggable="true" data-key="${o.kind === 'mod' ? 'mod:' : 'ext:'}${esc(o.id)}" data-${o.kind}="${esc(o.id)}"><span class="grip" title="${esc(T('Glisser pour déplacer'))}">${ic('drag')}</span>${o.img}<span class="grow"><span class="nm ${o.kind === 'cx' ? 'notr' : ''}">${esc(o.name)}</span><small>${esc(o.sub)}</small></span>${o.extra || ''}<button class="pin ${o.pinned ? 'on' : ''}" data-pin title="${esc(T(o.pinned ? 'Retirer de la barre d\'outils' : 'Épingler dans la barre d\'outils'))}">${ic(o.pinned ? 'pushpin-f' : 'pushpin')}</button>${o.more ? `<button class="pin" data-more title="${esc(T('Plus d\'options'))}">${ic('more')}</button>` : ''}</div>`;
  const chrome = EXTS.map((x, i) => [x, i]).sort((a, b) => (ord('ext:' + a[0].id) - ord('ext:' + b[0].id)) || a[1] - b[1]).map(x => x[0]);
  popEl.innerHTML = `<div class="ph">${ic('ext')}<b>${esc(T('Extensions'))}</b><button class="icon-btn" data-go="manage" title="${esc(T('Gérer les extensions'))}">${ic('gear')}</button></div>
    <div class="psec">${esc(T('Intégrées à DrYAE'))}</div>
    ${mods.map(([id, name, icon]) => row({ kind: 'mod', id, name: T(name), sub: T(modOn(id) ? 'Activée' : 'Désactivée'), img: `<span class="xi">${ic(icon)}</span>`, pinned: M[id]?.pinned !== false, extra: tg('mod:' + id, modOn(id), 'Activer ou désactiver') })).join('')}
    <div class="psec">${esc(T('Extensions Chrome'))}</div>
    ${chrome.length ? chrome.map(x => row({ kind: 'cx', id: x.id, name: x.name, sub: x.enabled ? (x.popup ? T('Cliquez pour ouvrir') : T('Version {0}').replace('{0}', x.version)) : T('Désactivée'), img: x.icon ? `<img src="${esc(x.icon)}" alt="">` : `<span class="xi">${esc((x.name || '?')[0])}</span>`, pinned: x.enabled && extPinned(x), more: true })).join('')
      : `<div class="prow"><span class="grow"><small style="white-space:normal">${esc(T('Aucune extension Chrome. Ajoutez-en depuis le Chrome Web Store.'))}</small></span></div>`}
    <div class="pfoot"><button class="btn sm" data-go="manage">${ic('ext')}${esc(T('Gérer les extensions'))}</button><button class="btn sm" data-go="store">${ic('store')}${esc(T('Chrome Web Store'))}</button></div>`;
  for (const [id] of mods) TOGGLES['mod:' + id] = async on => { await setModule(id, { enabled: on }); popRender(); };
}
popEl.addEventListener('click', async e => {
  if (POP.kind !== 'ext') return;
  const go = e.target.closest('[data-go]');
  if (go) { popClose(); return go.dataset.go === 'store' ? select(newTab('https://chromewebstore.google.com/category/extensions')) : openPage('extensions'); }
  const r = e.target.closest('[data-mod],[data-cx]'); if (!r || e.target.closest('[data-tg]')) return;
  const mod = r.dataset.mod, cx = r.dataset.cx;
  if (e.target.closest('[data-pin]')) {
    if (mod) { await setModule(mod, { pinned: !(CFG.mods?.[mod]?.pinned !== false) }); }
    else { const x = EXTS.find(x => x.id === cx); if (!x?.enabled) return toast('Activez d\'abord cette extension'); CFG.extUnpinned = await B.call('br:extPin', cx, !extPinned(x)); drawExtPins(); }
    return popRender();
  }
  if (e.target.closest('[data-more]')) {
    const x = EXTS.find(x => x.id === cx); if (!x) return;
    const b = e.target.closest('[data-more]').getBoundingClientRect();
    return menu(b.right - 240, b.bottom + 2, [
      { title: x.name },
      x.options && x.enabled && { label: 'Options', icon: 'gear', fn: () => { popClose(); B.call('br:extOptions', x.id); } },
      x.enabled && { label: extPinned(x) ? 'Retirer de la barre d\'outils' : 'Épingler dans la barre d\'outils', icon: 'pushpin', fn: async () => { CFG.extUnpinned = await B.call('br:extPin', x.id, !extPinned(x)); drawExtPins(); popRender(); } },
      { label: x.enabled ? 'Désactiver' : 'Activer', icon: 'power', fn: async () => { await B.call('br:extEnable', x.id, !x.enabled); await loadExts(); } },
      { label: 'Retirer de DrYAE', icon: 'trash', fn: async () => { EXTS = await B.call('br:extRemove', x.id); drawExtPins(); popRender(); toast('Extension retirée'); } },
      '-',
      { label: 'Gérer les extensions', icon: 'ext', fn: () => { popClose(); openPage('extensions'); } },
    ].filter(Boolean));
  }
  if (mod) { if (!modOn(mod)) return toast('Cette extension est désactivée'); return MOD_ACTION[mod]?.($('#bExt')); }
  const x = EXTS.find(x => x.id === cx); if (!x) return;
  if (!x.enabled) return toast('Cette extension est désactivée');
  popClose(); activateExt(x.id, $(`#tbItems [id="${x.id}"]`) || $('#bExt'));
});
$('#bExt').onclick = e => popOpen('ext', e.currentTarget);
// glisser-déposer dans le menu des extensions : change aussi l'ordre dans la barre d'outils
(() => {
  let drag = null;
  const clear = () => popEl.querySelectorAll('.drop-t,.drop-b').forEach(x => x.classList.remove('drop-t', 'drop-b'));
  popEl.addEventListener('dragstart', e => { if (POP.kind !== 'ext') return; const r = e.target.closest('.prow[data-key]'); if (!r) return; drag = r; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/x-dryae-ext', r.dataset.key); } catch {} });
  popEl.addEventListener('dragover', e => { if (!drag) return; const r = e.target.closest('.prow[data-key]'); e.preventDefault(); clear(); if (!r || r === drag || r.parentNode !== drag.parentNode || !!r.dataset.mod !== !!drag.dataset.mod) return; const b = r.getBoundingClientRect(); r.classList.add(e.clientY < b.top + b.height / 2 ? 'drop-t' : 'drop-b'); });
  popEl.addEventListener('drop', e => {
    if (!drag) return; e.preventDefault();
    const r = e.target.closest('.prow[data-key]');
    if (r && r !== drag && !!r.dataset.mod === !!drag.dataset.mod) { const b = r.getBoundingClientRect(); r.parentNode.insertBefore(drag, e.clientY < b.top + b.height / 2 ? r : r.nextSibling); }
    clear();
    // nouvel ordre : extensions intégrées puis Chrome, dans l'ordre du menu
    const keys = [...popEl.querySelectorAll('.prow[data-key]')].map(x => x.dataset.key);
    const bar = [...$('#tbItems').children].map(x => x.dataset.key);
    saveOrder([...keys, ...bar.filter(k => !keys.includes(k))]);
  });
  popEl.addEventListener('dragend', () => { drag?.classList.remove('dragging'); drag = null; clear(); });
})();

// ---------- traducteur ----------
let trInput = '', trTimer = 0, trSeq = 0;
function drawTrPop() {
  const t = CFG.translate || {}, h = curHost(), off = (t.offSites || []).includes(h), auto = (t.autoSites || []).includes(h);
  const target = t.target || uiLang();
  const done = cur?.tr && ['done', 'working'].includes(cur.tr.state);
  popEl.innerHTML = `<div class="ph">${ic('translate')}<b>${esc(T('Traducteur'))}</b>${h ? tg('trOn', !off, 'Activé sur ce site') : ''}<button class="icon-btn" data-set title="${esc(T('Paramètres du traducteur'))}">${ic('gear')}</button></div>
    <textarea id="trIn" placeholder="${esc(T('Saisissez ou collez un texte à traduire'))}" spellcheck="false">${esc(trInput)}</textarea>
    <div class="pout dim" id="trOut">${esc(T('La traduction s\'affiche ici pendant que vous écrivez.'))}</div>
    <div class="pmeta"><span id="trDet"></span><button class="icon-btn" id="trCopy" title="${esc(T('Copier'))}">${ic('copy')}</button><button class="icon-btn" id="trSpeak" title="${esc(T('Écouter'))}">${ic('sound')}</button></div>
    <div class="prow"><span class="grow">${esc(T('Traduire vers'))}</span><select id="trTo">${langOptions(target)}</select></div>
    <div class="prow"><span class="grow">${esc(T('Deuxième langue'))}<small>${esc(T('Utilisée si le texte est déjà dans la langue choisie'))}</small></span><select id="trSecond">${langOptions(t.second || '', `<option value="">${esc(T('Automatique (anglais ou français)'))}</option>`)}</select></div>
    ${h ? `<div class="prow"><span class="grow">${esc(T('Traduire automatiquement ce site'))}<small class="notr">${esc(h)}</small></span>${tg('trAuto', auto)}</div>` : ''}
    <div class="pfoot"><button class="btn sm primary" id="trPage" ${h && !off ? '' : 'disabled'}>${ic('translate')}${esc(T(done ? 'Afficher l\'original' : 'Traduire la page'))}</button><button class="btn sm" id="trSel" ${h && !off ? '' : 'disabled'}>${esc(T('Traduire la sélection'))}</button></div>`;
  const inp = $('#trIn'), out = $('#trOut');
  const run = async () => {
    const txt = inp.value; trInput = txt; const my = ++trSeq;
    if (!txt.trim()) { out.classList.add('dim'); out.textContent = T('La traduction s\'affiche ici pendant que vous écrivez.'); $('#trDet').textContent = ''; return; }
    out.classList.add('dim'); out.textContent = T('Traduction…');
    try {
      const r = await B.call('br:tr', txt, '');
      if (my !== trSeq || POP.kind !== 'translate') return;
      out.classList.remove('dim'); out.textContent = r.text; out.dataset.lang = r.to;
      $('#trDet').textContent = (r.from ? langName(r.from) : '?') + ' → ' + langName(r.to);
    } catch (e) { if (my === trSeq) { out.classList.add('dim'); out.textContent = T('Traduction impossible : {0}').replace('{0}', T(String(e.message || e).replace(/^.*Error: /, ''))); } }
  };
  inp.oninput = () => { clearTimeout(trTimer); trTimer = setTimeout(run, Math.max(250, +t.delay || 0)); };
  // texte sélectionné dans la page : il est repris tout seul dans la fenêtre et traduit
  if (cur?.wv && h) cur.wv.executeJavaScript('String(getSelection()).trim().slice(0, 5000)').then(sel => { if (sel && POP.kind === 'translate' && $('#trIn') === inp) { inp.value = sel; trInput = sel; run(); inp.select(); } }).catch(() => {});
  if (trInput) run();
  setTimeout(() => inp.focus(), 30);
  $('#trTo').onchange = async e => { await setB({ translate: { target: e.target.value } }); run(); };
  $('#trSecond').onchange = async e => { await setB({ translate: { second: e.target.value } }); run(); };
  $('#trCopy').onclick = () => { navigator.clipboard?.writeText(out.classList.contains('dim') ? '' : out.textContent); toast('Copié'); };
  $('#trSpeak').onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(out.textContent); u.lang = out.dataset.lang || ''; speechSynthesis.speak(u); } catch {} };
  $('#trPage').onclick = () => { popClose(); pageCmd('translate-page'); };
  $('#trSel').onclick = () => { popClose(); pageCmd('translate-selection'); };
  popEl.querySelector('[data-set]').onclick = () => { popClose(); openPage('settings', 'translate'); };
  TOGGLES.trOn = async on => { await setSite('trOff', !on); pageCmd('translate-enable', { on }); drawTrPop(); popPlace(); };
  TOGGLES.trAuto = async on => { await setSite('trAuto', on); if (on && !(cur?.tr && cur.tr.state === 'done')) pageCmd('translate-on'); };
}

// ---------- traducteur de scans ----------
let OCRL = null;
async function drawScanPop() {
  const s = CFG.scan || {}, h = curHost(), auto = (s.autoSites || []).includes(h);
  if (!OCRL) { try { OCRL = await B.call('br:ocrLangs'); } catch { OCRL = { langs: { eng: 'Anglais' }, have: [] }; } }
  const ocrOpts = Object.entries(OCRL.langs).map(([k, n]) => `<option value="${k}" ${k === (s.source || 'eng') ? 'selected' : ''}>${esc(T(n))}${OCRL.have.includes(k) ? '' : ' ↓'}</option>`).join('');
  popEl.innerHTML = `<div class="ph">${ic('scan')}<b>${esc(T('Traducteur de scans'))}</b><button class="icon-btn" data-set title="${esc(T('Paramètres du traducteur de scans'))}">${ic('gear')}</button></div>
    ${h ? `<div class="prow"><span class="grow">${esc(T('Traduire automatiquement les images de ce site'))}<small class="notr">${esc(h)}</small></span>${tg('scanAuto', auto)}</div>` : ''}
    <div class="tools" style="grid-template-columns:1fr 1fr;margin:6px 0">
      <button id="scPage" ${h ? '' : 'disabled'}>${ic('scan')}<span>${esc(T('Traduire les images de la page'))}</span></button>
      <button id="scZone" ${h ? '' : 'disabled'}>${ic('crop')}<span>${esc(T('Capture d\'une zone'))} <kbd>Ctrl+Maj+S</kbd></span></button>
    </div>
    <div class="prow"><span class="grow">${esc(T('Langue des images'))}<small>${esc(T('↓ : téléchargée à la première utilisation'))}</small></span><select id="scSrc">${ocrOpts}</select></div>
    <div class="prow"><span class="grow">${esc(T('Traduire vers'))}</span><select id="scTo">${langOptions(s.target || '', `<option value="">${esc(T('Comme le traducteur'))}</option>`)}</select></div>
    <div class="prow"><span class="grow">${esc(T('Icônes d\'action sur les images'))}<small>${esc(T('Original / traduction, comparer, relire'))}</small></span>${tg('scIcons', s.icons !== false)}</div>
    <div class="prow"><span class="grow">${esc(T('Lire aussi l\'anglais'))}<small>${esc(T('Pour les pages qui mélangent deux langues'))}</small></span>${tg('scEng', !!s.withEng)}</div>
    <div class="pfoot"><small style="color:var(--dim);white-space:normal">${esc(T('Astuce : clic droit sur une image → « Traduire le texte de l\'image ».'))}</small></div>`;
  $('#scPage').onclick = () => { popClose(); pageCmd('scan'); };
  $('#scZone').onclick = () => { popClose(); pageCmd('scan-region'); };
  $('#scSrc').onchange = e => setB({ scan: { source: e.target.value } });
  $('#scTo').onchange = e => setB({ scan: { target: e.target.value } });
  popEl.querySelector('[data-set]').onclick = () => { popClose(); openPage('settings', 'scan'); };
  TOGGLES.scanAuto = async on => { await setSite('scanAuto', on); if (on) pageCmd('scan-auto', { on: true }); };
  TOGGLES.scIcons = on => setB({ scan: { icons: on } }).then(() => pageCmd('scan-icons', { on }));
  TOGGLES.scEng = on => setB({ scan: { withEng: on } });
  if (window.I18N?.translateDom) try { I18N.translateDom(popEl); } catch {}
  popPlace();
}

// ---------- lumières tamisées ----------
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2], FILTERS = ['', 'grayscale(1)', 'sepia(.8)', 'contrast(1.35)', 'saturate(1.8)', 'brightness(1.3)'];
function drawLightsPop() {
  const L = CFG.lights || {}, h = curHost(), t = cur || {};
  const nightHere = L.nightAll ? !(L.nightExcept || []).includes(h) : !!t.night;
  const v = t.video || {};
  popEl.innerHTML = `<div class="ph">${ic('bulb')}<b>${esc(T('Lumières tamisées'))}</b><button class="icon-btn" data-set title="${esc(T('Paramètres'))}">${ic('gear')}</button></div>
    <div class="big"><button class="pw ${t.lit ? 'on' : ''}" id="liPow" title="Ctrl+Maj+L">${ic('power')}</button><span class="grow" style="flex:1"><b>${esc(T(t.lit ? 'Lumières éteintes' : 'Lumières allumées'))}</b><small style="display:block;color:var(--dim);font-size:11px">${esc(T('Ctrl+Maj+L · Échap pour rallumer · Alt+↑ / Alt+↓ : opacité'))}</small></span></div>
    <div class="prow"><span>${esc(T('Opacité'))}</span><input type="range" id="liOp" min="30" max="97" value="${+L.opacity || 85}"><b id="liOpV" style="min-width:38px;text-align:right">${+L.opacity || 85} %</b><input type="color" id="liCol" value="${/^#[0-9a-f]{6}$/i.test(L.color || '') ? L.color : '#000000'}" title="${esc(T('Couleur'))}"></div>
    <div class="prow"><span class="grow">${esc(T('Protection des yeux'))}<small>${esc(T('Filtre orangé sur toutes les pages (Alt+F10)'))}</small></span>${tg('liEye', !!L.eye)}</div>
    ${L.eye ? `<div class="prow"><span>${esc(T('Intensité'))}</span><input type="range" id="liEyeL" min="5" max="60" value="${+L.eyeLevel || 30}"></div>` : ''}
    ${h ? `<div class="prow"><span class="grow">${esc(T('Mode nuit sur ce site'))}<small class="notr">${esc(h)}</small></span>${tg('liNight', nightHere)}</div>` : ''}
    <div class="prow"><span class="grow">${esc(T('Lueur autour de la vidéo'))}</span>${tg('liGlow', !!L.glow)}</div>
    <div class="psec">${esc(T('Vidéo de la page'))}</div>
    <div class="tools">
      <button data-v="speed">${ic('play')}<span>${esc(T('Vitesse'))} ${v.rate && v.rate !== 1 ? '×' + v.rate : ''}</span></button>
      <button data-v="loop" class="${v.loop ? 'on' : ''}">${ic('reload')}<span>${esc(T('Boucle'))}</span></button>
      <button data-v="zoom">${ic('search')}<span>${esc(T('Zoom'))} ${v.zoom && v.zoom !== 1 ? '×' + v.zoom : ''}</span></button>
      <button data-v="filter" class="${v.filter ? 'on' : ''}">${ic('filter')}<span>${esc(T('Filtre'))}</span></button>
      <button data-v="shot">${ic('crop')}<span>${esc(T('Capture'))}</span></button>
      <button data-v="full" class="${v.full ? 'on' : ''}">${ic('expand')}<span>${esc(T('Plein onglet'))}</span></button>
      <button data-v="pip">${ic('pip')}<span>${esc(T('Détacher'))}</span></button>
      <button data-v="reset">${ic('x')}<span>${esc(T('Réinitialiser'))}</span></button>
    </div>
    <div class="prow"><span class="grow">${esc(T('Volume avec la molette sur la vidéo'))}</span>${tg('liWheel', !!L.wheelVolume)}</div>
    <div class="prow"><span class="grow">${esc(T('Empêcher la lecture automatique'))}</span>${tg('liStop', !!L.stopAutoplay)}</div>
    <div class="prow"><span class="grow">${esc(T('Éteindre en lançant une vidéo'))}</span>${tg('liAuto', !!L.auto)}</div>`;
  $('#liPow').onclick = () => { pageCmd('lights'); setTimeout(() => POP.kind === 'lights' && drawLightsPop(), 250); };
  const sendLook = () => pageCmd('lights-set', { opacity: +$('#liOp').value, color: $('#liCol').value });
  $('#liOp').oninput = () => { $('#liOpV').textContent = $('#liOp').value + ' %'; sendLook(); };
  $('#liOp').onchange = () => setB({ lights: { opacity: +$('#liOp').value } });
  $('#liCol').oninput = sendLook;
  $('#liCol').onchange = () => setB({ lights: { color: $('#liCol').value } });
  if ($('#liEyeL')) { $('#liEyeL').oninput = () => pageCmd('eye', { on: true, level: +$('#liEyeL').value }); $('#liEyeL').onchange = () => setB({ lights: { eyeLevel: +$('#liEyeL').value } }); }
  popEl.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => { const k = b.dataset.v; if (k === 'pip') { popClose(); return cur?.wcId && B.call('br:pip', cur.wcId); } pageCmd('video', { act: k }); setTimeout(() => POP.kind === 'lights' && drawLightsPop(), 200); }; });
  popEl.querySelector('[data-set]').onclick = () => { popClose(); openPage('settings', 'lights'); };
  TOGGLES.liEye = async on => { await setB({ lights: { eye: on } }); tabs.forEach(x => { if (x.wv && x.wcId && /^https?:/.test(x.url)) try { x.wv.send('dryae-cmd', { cmd: 'eye', on, level: +(CFG.lights?.eyeLevel) || 30 }); } catch {} }); drawLightsPop(); popPlace(); };
  TOGGLES.liNight = async on => { if ((CFG.lights || {}).nightAll) await setSite('nightExcept', !on); pageCmd('night', { on }); };
  TOGGLES.liGlow = async on => { await setB({ lights: { glow: on } }); pageCmd('lights-set', { glow: on }); };
  TOGGLES.liWheel = async on => { await setB({ lights: { wheelVolume: on } }); pageCmd('lights-set', { wheelVolume: on }); };
  TOGGLES.liStop = async on => { await setB({ lights: { stopAutoplay: on } }); pageCmd('lights-set', { stopAutoplay: on }); };
  TOGGLES.liAuto = async on => { await setB({ lights: { auto: on } }); pageCmd('lights-set', { auto: on }); };
}

// ---------- bloqueur de publicités ----------
function adModeOf(h) {
  const M = CFG.adModes || {}; if (!h) return 'optimal';
  const k = Object.keys(M).filter(d => M[d] && (h === d || h.endsWith('.' + d))).sort((a, b) => b.length - a.length)[0];
  if (k) return M[k];
  if ((CFG.whitelist || []).some(w => h === w || h.endsWith('.' + w))) return 'none';
  return CFG.adDefaultMode || 'optimal';
}
async function drawAdPop() {
  const h = curHost(), on = modOn('adblock'), mode = adModeOf(h), active = on && h && mode !== 'none';
  let st = { page: cur?.blocked || 0, total: 0 }; try { st = await B.call('br:stats', cur?.wcId || 0); } catch {}
  const desc = { none: 'Aucun filtrage sur ce site.', basic: 'Bloque les publicités et traqueurs (requêtes) sans toucher à la mise en page.', optimal: 'Bloque aussi les emplacements vides et les éléments gênants de la page.' };
  popEl.innerHTML = `<div class="ph">${ic('shield')}<b>${esc(T('Bloqueur de publicités'))}</b><button class="icon-btn" data-set title="${esc(T('Paramètres du bloqueur'))}">${ic('gear')}</button></div>
    <div class="big"><button class="pw ${active ? 'on' : ''}" id="adPow" ${h && on ? '' : 'disabled'} title="${esc(T('Activer ou désactiver sur ce site'))}">${ic('power')}</button><span style="flex:1;min-width:0"><b class="notr" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h || T('Aucune page web'))}</b><small style="color:var(--dim);font-size:11px">${esc(T(!on ? 'Bloqueur désactivé partout' : active ? 'Protection active sur ce site' : 'Protection désactivée sur ce site'))}</small></span></div>
    ${h && on ? `<div class="psec">${esc(T('Mode de filtrage pour ce site'))}</div><div class="seg">${['none', 'basic', 'optimal'].map(m => `<button data-mode="${m}" class="${m === mode ? 'on' : ''}">${esc(T({ none: 'Aucun', basic: 'Basique', optimal: 'Optimal' }[m]))}</button>`).join('')}</div><div style="color:var(--dim);font-size:11px;margin:6px 2px 0">${esc(T(desc[mode]))}</div>` : ''}
    <div class="nums"><div><b>${st.page}</b><small>${esc(T('sur cette page'))}</small></div><div><b>${st.total}</b><small>${esc(T('depuis le démarrage'))}</small></div></div>
    <div class="tools" style="grid-template-columns:1fr 1fr;margin-top:10px">
      <button id="adPick" ${h && active ? '' : 'disabled'}>${ic('eye')}<span>${esc(T('Masquer un élément'))}</span></button>
      <button id="adReload" ${h ? '' : 'disabled'}>${ic('reload')}<span>${esc(T('Actualiser la page'))}</span></button>
    </div>
    <div class="prow" style="margin-top:6px"><span class="grow">${esc(T('Bloqueur activé partout'))}</span>${tg('adAll', on)}</div>
    <div style="color:var(--dim);font-size:11px;margin:4px 2px 0">${esc(T('Listes par défaut : filtres uBlock, EasyList, EasyPrivacy et la liste de serveurs de Peter Lowe.'))}</div>`;
  const reload = () => { cur?.wv?.reload(); };
  if ($('#adPow')) $('#adPow').onclick = async () => { await setSite('adMode', active ? 'none' : (CFG.adDefaultMode || 'optimal')); reload(); updToolbar(); drawAdPop(); };
  popEl.querySelectorAll('[data-mode]').forEach(b => { b.onclick = async () => { await setSite('adMode', b.dataset.mode); reload(); updToolbar(); drawAdPop(); }; });
  $('#adPick').onclick = () => { popClose(); pageCmd('picker'); };
  $('#adReload').onclick = () => { reload(); popClose(); };
  popEl.querySelector('[data-set]').onclick = () => { popClose(); openPage('settings', 'adblock'); };
  TOGGLES.adAll = async v => { await setModule('adblock', { enabled: v }); reload(); drawAdPop(); };
  if (window.I18N?.translateDom) try { I18N.translateDom(popEl); } catch {}
  popPlace();
}
