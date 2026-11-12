/* Outils communs des pages internes de DrYAE */
const D = window.dryae;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TR = s => (window.T ? window.T(s) : s);
const TRF = (s, ...a) => TR(s).replace(/\{(\d+)\}/g, (_m, n) => a[+n] ?? '');
const LOC = () => (window.I18N && I18N.locale) || 'fr-FR';
const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3m-4 4l3 3m-5-1l2 2"/>', puzzle: '<path d="M10 3a2 2 0 014 0v2h4a1 1 0 011 1v4h-2a2 2 0 000 4h2v4a1 1 0 01-1 1h-4v-2a2 2 0 00-4 0v2H6a1 1 0 01-1-1v-4h2a2 2 0 000-4H5V6a1 1 0 011-1h4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  link: '<path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.3 3.9M6.5 7.5C3.8 9.3 2 12 2 12s4 7 10 7a9.6 9.6 0 004.4-1"/><path d="M9.9 10a3 3 0 004.2 4.2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>', plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', fwd: '<path d="M9 6l6 6-6 6"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>', weak: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>', pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  import: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>', export: '<path d="M12 15V3m0 0L8 7m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
  dl: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>', translate: '<path d="M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.6 5 7M11 5c-.8 3.6-3.2 6.8-7 8.5"/><path d="M13 20l4-9 4 9M14.5 17h5"/>',
  scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M8 10.5c0-1.4 1.8-2.5 4-2.5s4 1.1 4 2.5-1.8 2.5-4 2.5l-2 2v-2.2c-1.2-.4-2-1.3-2-2.3z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>', pip: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9h16v10a1 1 0 01-1 1H5a1 1 0 01-1-1zM4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/>', code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  kbd: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 15h8"/>', reload: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  palette: '<path d="M12 3a9 9 0 100 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 005-5c0-4.4-4-7.8-9-7.8z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>',
  power: '<path d="M12 3v9M6.4 6.4a8 8 0 1011.2 0"/>', lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18"/>', sys: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>', dryae: '<circle cx="12" cy="12" r="9"/><path d="M9 8h3.5a4 4 0 010 8H9z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>', moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>', tab: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h7V5"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>', drag: '<circle cx="9" cy="6" r="1.4" fill="currentColor"/><circle cx="15" cy="6" r="1.4" fill="currentColor"/><circle cx="9" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="18" r="1.4" fill="currentColor"/><circle cx="15" cy="18" r="1.4" fill="currentColor"/>',
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.globe}</svg>`;
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const fmtBytes = b => { if (!(b > 0)) return '0 o'; const u = ['o', 'Ko', 'Mo', 'Go']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return (i ? b.toFixed(1) : b) + ' ' + u[i]; };
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
function dayLabel(t) {
  const d = new Date(t), now = new Date();
  const k = dayKey(t), long = d.toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (k === dayKey(now)) return TR("Aujourd'hui") + ' — ' + long;
  if (k === dayKey(now - 864e5)) return TR('Hier') + ' — ' + long;
  return long.charAt(0).toUpperCase() + long.slice(1);
}
const timeOf = t => new Date(t).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' });
// icône d'un site : favicon enregistré, sinon une pastille avec l'initiale
const COLORS = ['#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'];
function favHtml(url, fav) {
  const h = hostOf(url) || '?'; const c = COLORS[[...h].reduce((a, x) => a + x.charCodeAt(0), 0) % COLORS.length];
  const letter = `<span class="favx" style="background:${c}">${esc(h[0].toUpperCase())}</span>`;
  return fav && /^(https?|data):/.test(fav) ? `<img class="fav" src="${esc(fav)}" data-l="${esc(h[0].toUpperCase())}" data-c="${c}" alt="">` : letter;
}
document.addEventListener('error', e => { const i = e.target; if (i.tagName === 'IMG' && i.classList.contains('fav')) i.replaceWith(Object.assign(document.createElement('span'), { className: 'favx', textContent: i.dataset.l || '?', style: `background:${i.dataset.c || '#8b5cf6'}` })); }, true);

async function call(name, ...a) {
  try { return await D.call(name, ...a); }
  catch (e) { const m = String(e.message || e).replace(/^.*Error: /, '').replace(/^Error invoking remote method 'dp': /, ''); toast(m); throw e; }
}
function toast(msg, action) {
  let el = $('.ptoast'); if (!el) { el = document.createElement('div'); el.className = 'ptoast'; document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(TR(msg))}</span>` + (action ? `<button class="btn sm">${esc(TR(action.label))}</button>` : '');
  if (action) el.querySelector('button').onclick = () => { el.classList.remove('on'); action.fn(); };
  el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), action ? 7000 : 2800);
}
// fenêtre de confirmation ou formulaire (remplace les fenêtres du système)
function dialog({ title, html = '', ok = 'OK', cancel = 'Annuler', danger = false, onOpen, read, note = '' }) {
  return new Promise(res => {
    let d = $('#pdlg'); if (!d) { d = document.createElement('div'); d.id = 'pdlg'; d.className = 'dlg'; document.body.appendChild(d); }
    d.innerHTML = `<div class="box" role="dialog"><h3>${esc(TR(title))}</h3><div class="bd">${html}</div><div class="foot"><span class="l">${note}</span>${cancel ? `<button class="btn" data-x>${esc(TR(cancel))}</button>` : ''}<button class="btn primary ${danger ? 'danger-bg' : ''}" data-ok style="${danger ? 'background:var(--err);border-color:var(--err)' : ''}">${esc(TR(ok))}</button></div></div>`;
    d.classList.add('on');
    const done = v => { d.classList.remove('on'); d.onkeydown = null; res(v); };
    d.querySelector('[data-ok]').onclick = () => { const v = read ? read(d) : true; if (v === false) return; done(v); };
    const x = d.querySelector('[data-x]'); if (x) x.onclick = () => done(null);
    d.onmousedown = e => { if (e.target === d) done(null); };
    d.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); d.querySelector('[data-ok]').click(); } };
    onOpen?.(d);
    setTimeout(() => (d.querySelector('input,select,textarea') || d.querySelector('[data-ok]')).focus(), 30);
  });
}
const confirmBox = (msg, ok = 'Confirmer', danger = true) => dialog({ title: msg, ok, danger }).then(Boolean);
// menu contextuel : { label, icon, key, fn, danger, disabled } ; '-' = séparateur
function pmenu(x, y, items) {
  let m = $('#pmenu'); if (!m) { m = document.createElement('div'); m.id = 'pmenu'; m.className = 'pmenu'; document.body.appendChild(m); }
  const list = items.filter(Boolean);
  m.innerHTML = list.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>${ic(it.icon || 'link')}<span>${esc(TR(it.label))}</span>${it.key ? `<kbd>${esc(TR(it.key))}</kbd>` : ''}</button>`).join('');
  m.classList.add('on');
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px'; m.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
  m.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; m.classList.remove('on'); list[+b.dataset.i].fn(); };
}
document.addEventListener('mousedown', e => { if (!e.target.closest('#pmenu')) $('#pmenu')?.classList.remove('on'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#pmenu')?.classList.remove('on'); }, true);
document.addEventListener('scroll', () => $('#pmenu')?.classList.remove('on'), true);

// thème (clair / sombre, couleur d'accent)
function applyTheme(t = {}) {
  let mode = t.mode || 'dark'; if (mode === 'system') mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.mode = mode;
  if (t.accent) { const r = document.documentElement.style; r.setProperty('--accent', t.accent); r.setProperty('--accent-soft', t.accent + '22'); r.setProperty('--accent-line', t.accent + '55'); }
}
D.call('theme').then(applyTheme).catch(() => {});
D.on('theme', applyTheme);
D.call('a11y').then(e => window.A11Y?.apply(e)).catch(() => {});
D.on('a11y', e => window.A11Y?.apply(e));

// liste au clavier, comme dans le gestionnaire de téléchargements :
// ↑ ↓ Début Fin Page↑ Page↓ (Maj pour étendre), Espace, Ctrl+A, Entrée, Ctrl+Entrée, Suppr, F2, Ctrl+Z, Échap, Ctrl+F ou /
class ListNav {
  constructor(o) { Object.assign(this, o); this.sel = new Set(); this.focus = -1; this.anchor = -1; this.bind(); }
  rows() { return $$('[data-k]', this.root); }
  keys() { return this.rows().map(r => r.dataset.k); }
  idx(k) { return this.keys().indexOf(k); }
  paint() {
    const ks = this.keys();
    this.rows().forEach((r, i) => { const on = this.sel.has(r.dataset.k); r.classList.toggle('sel', on); r.classList.toggle('focus', i === this.focus); const c = r.querySelector('.ck'); if (c) c.checked = on; });
    this.onSel?.([...this.sel].filter(k => ks.includes(k)));
  }
  setFocus(i, extend, toggle) {
    const ks = this.keys(); if (!ks.length) return;
    i = Math.max(0, Math.min(ks.length - 1, i));
    if (extend && this.anchor >= 0) { this.sel = new Set(ks.slice(Math.min(this.anchor, i), Math.max(this.anchor, i) + 1)); }
    else if (toggle) { this.anchor = i; }
    else { this.anchor = i; }
    this.focus = i; this.paint();
    this.rows()[i]?.scrollIntoView({ block: 'nearest' });
  }
  clear() { this.sel.clear(); this.paint(); }
  selected() { const ks = this.keys(); return [...this.sel].filter(k => ks.includes(k)); }
  current() { return this.keys()[this.focus]; }
  bind() {
    this.root.addEventListener('mousedown', e => {
      const r = e.target.closest('[data-k]'); if (!r || e.button !== 0 || e.target.closest('button, a, input:not(.ck)')) return;
      const i = this.idx(r.dataset.k), k = r.dataset.k;
      if (e.shiftKey && this.anchor >= 0) { const ks = this.keys(); this.sel = new Set(ks.slice(Math.min(this.anchor, i), Math.max(this.anchor, i) + 1)); this.focus = i; }
      else if (e.ctrlKey || e.metaKey || e.target.classList.contains('ck')) { this.sel.has(k) ? this.sel.delete(k) : this.sel.add(k); this.focus = i; this.anchor = i; }
      else { this.focus = i; this.anchor = i; this.sel = new Set([k]); }
      if (e.target.classList.contains('ck')) e.preventDefault();
      this.paint();
    });
    // sélection à la souris : clic maintenu puis glisser (rectangle de sélection) ; Ctrl : ajoute à la sélection
    this.root.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('button, a, input, select, textarea, [draggable="true"], .dlg, .pmenu')) return;
      if (!e.target.closest('[data-k]') && !e.target.closest('.plist')) return;
      const keep = e.ctrlKey || e.metaKey ? new Set(this.sel) : new Set();
      const sx = e.clientX, sy = e.clientY + this.root.scrollTop;
      let band = null, raf = 0, last = e;
      if (!e.target.closest('[data-k]')) { this.sel = new Set(keep); this.paint(); }
      const upd = () => {
        const y = last.clientY + this.root.scrollTop, top = Math.min(sy, y), bot = Math.max(sy, y), l = Math.min(sx, last.clientX), r = Math.max(sx, last.clientX);
        const rb = this.root.getBoundingClientRect();
        Object.assign(band.style, { left: l + 'px', top: (top - this.root.scrollTop) + 'px', width: (r - l) + 'px', height: (bot - top) + 'px' });
        const s = new Set(keep); let f = -1;
        this.rows().forEach((row, i) => { const b = row.getBoundingClientRect(); const bt = b.top + this.root.scrollTop, bb = b.bottom + this.root.scrollTop; if (bb > top && bt < bot) { s.add(row.dataset.k); f = i; } });
        this.sel = s; if (f >= 0) this.focus = f; this.paint();
        // défilement automatique près des bords
        if (last.clientY < rb.top + 30) this.root.scrollTop -= 14; else if (last.clientY > rb.bottom - 30) this.root.scrollTop += 14;
        raf = requestAnimationFrame(upd);
      };
      const move = m => {
        last = m;
        if (!band) { if (Math.abs(m.clientY - sy + this.root.scrollTop) < 6 && Math.abs(m.clientX - sx) < 6) return; band = document.createElement('div'); band.className = 'selband'; document.body.appendChild(band); document.body.classList.add('banding'); getSelection()?.removeAllRanges(); upd(); }
      };
      const up = () => { removeEventListener('mousemove', move, true); removeEventListener('mouseup', up, true); cancelAnimationFrame(raf); if (band) { band.remove(); document.body.classList.remove('banding'); this.anchor = this.focus; } };
      addEventListener('mousemove', move, true); addEventListener('mouseup', up, true);
    });
    this.root.addEventListener('click', e => { if (e.target.classList.contains('ck')) e.preventDefault(); });
    this.root.addEventListener('dblclick', e => { const r = e.target.closest('[data-k]'); if (r && !e.target.closest('button, a, input')) this.onOpen?.(r.dataset.k, e); });
    document.addEventListener('keydown', e => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.classList.contains('ck');
      if ($('.dlg.on')) return;
      const c = e.ctrlKey || e.metaKey;
      if ((c && e.key.toLowerCase() === 'f') || (e.key === '/' && !typing)) { e.preventDefault(); this.search?.focus(); this.search?.select(); return; }
      if (typing) { if (e.key === 'ArrowDown' && document.activeElement === this.search) { e.preventDefault(); this.search.blur(); this.setFocus(0); } return; }
      const n = this.keys().length; if (!n && e.key !== 'Escape') return;
      const page = Math.max(1, Math.floor(this.root.clientHeight / 36) || 10);
      const mv = d => { e.preventDefault(); this.setFocus(this.focus < 0 ? 0 : this.focus + d, e.shiftKey); if (!e.shiftKey && !c) this.sel = new Set(this.selectMode ? [this.current()] : [...this.sel]); this.paint(); };
      switch (e.key) {
        case 'ArrowDown': return mv(1);
        case 'ArrowUp': return mv(-1);
        case 'PageDown': return mv(page);
        case 'PageUp': return mv(-page);
        case 'Home': e.preventDefault(); return this.setFocus(0, e.shiftKey);
        case 'End': e.preventDefault(); return this.setFocus(n - 1, e.shiftKey);
        case ' ': { e.preventDefault(); const k = this.current(); if (k) { this.sel.has(k) ? this.sel.delete(k) : this.sel.add(k); this.paint(); } return; }
        case 'Enter': { e.preventDefault(); const k = this.current(); if (k) this.onOpen?.(k, e); return; }
        case 'Delete': { e.preventDefault(); const ks = this.selected().length ? this.selected() : [this.current()].filter(Boolean); if (ks.length) this.onDelete?.(ks); return; }
        case 'F2': { e.preventDefault(); const k = this.current(); if (k) this.onRename?.(k); return; }
        case 'Escape': if (this.sel.size) { e.preventDefault(); this.clear(); } return;
      }
      if (c && e.key.toLowerCase() === 'a') { e.preventDefault(); this.sel = new Set(this.keys()); this.paint(); }
      if (c && e.key.toLowerCase() === 'z') { e.preventDefault(); this.onUndo?.(); }
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { const r = this.rows()[this.focus]; if (r) { e.preventDefault(); const b = r.getBoundingClientRect(); this.onMenu?.(r.dataset.k, b.left + 40, b.bottom); } }
    });
    this.root.addEventListener('contextmenu', e => { const r = e.target.closest('[data-k]'); if (!r) return; e.preventDefault(); const i = this.idx(r.dataset.k); if (!this.sel.has(r.dataset.k)) { this.sel = new Set(this.selectMode ? [r.dataset.k] : []); } this.focus = i; this.paint(); this.onMenu?.(r.dataset.k, e.clientX, e.clientY); });
  }
}
// interrupteur
const sw = (id, on, attrs = '') => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${attrs}><i></i></label>`;
// en-tête et navigation communs
function shell(title, nav, search) {
  document.title = TR(title) + ' — DrYAE';
  $('#top').innerHTML = `<div class="brand"><img src="/_assets/logo.png" alt=""><b>DrYAE</b><span>${esc(TR(title))}</span></div>${search ? `<label class="psearch">${ic('search')}<input id="q" type="search" placeholder="${esc(TR(search))}" spellcheck="false"><kbd>Ctrl F</kbd></label>` : ''}<span class="sp"></span>`;
}
