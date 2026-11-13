// Script chargé dans chaque page du navigateur DrYAE (toutes les frames).
// 1) Boutons latéraux de la souris (précédent / suivant).
// 2) Pages internes dryae:// : pont vers DrYAE (uniquement pour elles).
// 3) Bouton « Télécharger cette vidéo » et bouton « Image dans l'image » sur les lecteurs vidéo.
// 4) Mots de passe, adresses et cartes (saisie automatique).
// 5) Extensions intégrées : éléments masqués, traducteur, traducteur de scans, lumières tamisées.
// Rien n'est ajouté à une page tant qu'on n'en a pas besoin : les vérifications anti-robot voient un Chromium normal.
const { ipcRenderer, webFrame, contextBridge } = require('electron');
let CFG = {}; try { CFG = ipcRenderer.sendSync('page:init') || {}; } catch {}
const PT = CFG.pt || {};
const pt = s => PT[s] || s;
const ptf = (s, ...a) => pt(s).replace(/\{(\d+)\}/g, (_m, n) => a[+n] ?? '');
const TOP = window.top === window;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toHost = (ch, v) => { try { ipcRenderer.sendToHost(ch, v); } catch {} };

// ---------- 1. souris : boutons latéraux précédent / suivant ----------
try {
  // clic dans la page : le navigateur ferme ses fenêtres (extensions, menus)
  addEventListener('mousedown', () => toHost('dryae-pagedown'), true);
  addEventListener('mouseup', e => { if (e.button === 3 || e.button === 4) { e.preventDefault(); toHost('dryae-nav', e.button === 3 ? -1 : 1); } }, true);
} catch {}

// ---------- 2. pages internes ----------
if (CFG.internal) {
  if (TOP && location.protocol === 'dryae:' && location.hostname !== 'pdf') {
    const listeners = new Map();
    ipcRenderer.on('dp-ev', (_e, name, data) => (listeners.get(name) || []).forEach(fn => { try { fn(data); } catch {} }));
    contextBridge.exposeInMainWorld('DRYAE_LANG', CFG.lang || 'fr');
    contextBridge.exposeInMainWorld('dryae', {
      call: (name, ...args) => ipcRenderer.invoke('dp', name, ...args),
      on: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    });
  }
} else {
  pageFeatures();
}

function pageFeatures() {
  // conteneur commun (shadow DOM fermé : invisible pour la page)
  let uiHost = null, uiRoot = null;
  // Pages protégées par « Trusted Types » : le HTML de DrYAE passe par une règle à lui,
  // ou, si la page l'interdit, est construit dans un document à part puis copié.
  let ttPolicy = null;
  try { if (window.trustedTypes) ttPolicy = trustedTypes.createPolicy('dryae-ui', { createHTML: x => x }); } catch {}
  const scratch = document.implementation.createHTMLDocument('');
  const setHTML = (node, html) => {
    try { node.innerHTML = ttPolicy ? ttPolicy.createHTML(html) : html; return; } catch {}
    const box = scratch.createElement('div'); box.innerHTML = html;
    node.textContent = '';
    for (const c of [...box.childNodes]) node.appendChild(document.importNode(c, true));
  };
  const UI_CSS = `:host{all:initial}
    *{box-sizing:border-box;font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}
    .card{position:fixed;pointer-events:auto;background:#151922;color:#e9ebf1;border:1px solid #2c3242;border-radius:12px;box-shadow:0 14px 40px #0009;font-size:13.5px;line-height:1.45}
    .btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;background:#232938;color:#e9ebf1;font-size:12.5px;font-weight:600}
    .btn:hover{background:#2e3546}.btn.pri{background:var(--a,#8b5cf6);color:#fff}
    svg{width:16px;height:16px;flex:none}`;
  const ui = () => {
    if (!uiHost) {
      uiHost = document.createElement('dryae-ui');
      uiHost.style.cssText = 'all:initial;position:fixed;inset:0 auto auto 0;width:0;height:0;z-index:2147483647;pointer-events:none';
      uiRoot = uiHost.attachShadow({ mode: 'closed' });
      setHTML(uiRoot, `<style>${UI_CSS}</style>`);
    }
    // jamais dans « document » lui-même : avant que la page existe, l'élément deviendrait la page entière (page blanche)
    if (!uiHost.isConnected) { if (document.documentElement) document.documentElement.appendChild(uiHost); else document.addEventListener('readystatechange', () => { if (!uiHost.isConnected && document.documentElement) document.documentElement.appendChild(uiHost); }, { once: true }); }
    return uiRoot;
  };
  const el = (html, parent) => { const d = document.createElement('div'); setHTML(d, html.trim()); const n = d.firstElementChild; (parent || ui()).appendChild(n); return n; };
  const ICO = {
    tr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.6 5 7M11 5c-.8 3.6-3.2 6.8-7 8.5"/><path d="M13 20l4-9 4 9M14.5 17h5"/></svg>',
    pip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
    spk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  // ---------- éléments masqués à la main (bloqueur de publicités) ----------
  let hideKey = null;
  const applyHides = list => {
    try { if (hideKey) webFrame.removeInsertedCSS(hideKey); } catch {}
    hideKey = list && list.length ? webFrame.insertCSS(list.map(s => s + '{display:none!important}').join('\n')) : null;
  };
  if (TOP && (CFG.hides || []).length) applyHides(CFG.hides);

  // ---------- 3a. bouton « Télécharger cette vidéo » (page principale uniquement) ----------
  const pickVideo = (min = 240) => {
    let best = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const visW = Math.min(r.right, innerWidth) - Math.max(r.left, 0), visH = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (r.width < min || r.height < min * 0.56 || visW < 160 || visH < 90) continue;
      if (getComputedStyle(v).visibility === 'hidden') continue;
      const a = visW * visH;
      if (a > area) { area = a; best = v; }
    }
    return best;
  };
  if (TOP && CFG.capture) {
    let hostEl = null, btn = null, target = null, hiddenFor = '';
    const make = () => {
      hostEl = document.createElement('dryae-video-button');
      hostEl.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none';
      const root = hostEl.attachShadow({ mode: 'closed' });
      setHTML(root, `<style>
        .b{pointer-events:auto;display:flex;align-items:center;gap:0;font:600 13px "Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-radius:10px;box-shadow:0 6px 24px #0007;overflow:hidden;opacity:.94;transition:opacity .2s,transform .2s;user-select:none}
        .b:hover{opacity:1;transform:translateY(-1px)}
        .go{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer}
        .x{padding:8px 9px;cursor:pointer;border-left:1px solid #ffffff33;opacity:.8}.x:hover{opacity:1;background:#0002}
        svg{width:16px;height:16px}
      </style><div class="b"><div class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>${esc(pt('Télécharger cette vidéo'))}</div><div class="x" title="${esc(pt('Masquer'))}">✕</div></div>`);
      btn = root.querySelector('.b');
      root.querySelector('.go').addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const v = target;
        toHost('dryae-video', { page: location.href, src: v && /^https?:/.test(v.currentSrc || '') ? v.currentSrc : '', title: document.title, duration: v && isFinite(v.duration) ? v.duration : 0 });
      }, true);
      root.querySelector('.x').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); hiddenFor = location.href; hostEl.style.display = 'none'; }, true);
      (document.documentElement || document).appendChild(hostEl);
    };
    const place = () => {
      if (!document.documentElement) return;
      if (hiddenFor && hiddenFor !== location.href) hiddenFor = '';
      target = document.fullscreenElement ? null : pickVideo();
      if (!target || hiddenFor) { if (hostEl) hostEl.style.display = 'none'; return; }
      if (!hostEl || !hostEl.isConnected) make();
      const r = target.getBoundingClientRect();
      hostEl.style.display = 'block';
      const w = btn.offsetWidth || 220;
      hostEl.style.transform = `translate(${Math.max(4, Math.min(innerWidth - w - 8, r.right - w - 12))}px, ${Math.max(4, r.top + 12)}px)`;
    };
    let raf = 0;
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };
    addEventListener('scroll', schedule, true);
    addEventListener('resize', schedule);
    document.addEventListener('fullscreenchange', schedule);
    setInterval(place, 1200);
  }

  // ---------- 3b. bouton « Image dans l'image » (au survol d'une vidéo) ----------
  if (CFG.pip && document.pictureInPictureEnabled !== false) {
    let pipEl = null, pipFor = null, hideT = 0, side = CFG.pip.side || 'left', off = false;
    const make = () => {
      pipEl = el(`<div class="card" style="display:none;padding:0;border-radius:99px;background:#151922e6;--a:#8b5cf6"><style>.p{all:unset;cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 11px 6px 9px;color:#fff;font:600 12px "Segoe UI",sans-serif}.p:hover{color:#c4b5fd}.m{all:unset;cursor:pointer;padding:6px 8px 6px 2px;color:#aab;font-size:13px}.m:hover{color:#fff}.menu{position:absolute;top:34px;left:0;min-width:240px;padding:4px;display:none}.menu button{all:unset;display:block;width:100%;box-sizing:border-box;padding:7px 10px;border-radius:7px;cursor:pointer;font-size:12.5px}.menu button:hover{background:#262c3b}</style>
        <div style="display:flex;align-items:center"><button class="p">${ICO.pip}<span>${esc(pt("Image dans l'image"))}</span></button><button class="m" title="…">⋮</button></div>
        <div class="card menu"><button data-a="hide">${esc(pt('Masquer le bouton sur ce site'))}</button><button data-a="side">${esc(pt(side === 'left' ? 'Placer le bouton à droite' : 'Placer le bouton à gauche'))}</button></div></div>`);
      const menu = pipEl.querySelector('.menu');
      pipEl.querySelector('.p').addEventListener('click', async e => {
        e.preventDefault(); e.stopPropagation();
        const v = pipFor; if (!v) return;
        try { if (document.pictureInPictureElement === v) await document.exitPictureInPicture(); else { if (v.disablePictureInPicture) v.disablePictureInPicture = false; await v.requestPictureInPicture(); } } catch {}
      }, true);
      pipEl.querySelector('.m').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; }, true);
      menu.addEventListener('click', e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        e.preventDefault(); e.stopPropagation(); menu.style.display = 'none';
        if (b.dataset.a === 'hide') { off = true; pipEl.style.display = 'none'; ipcRenderer.invoke('pip:pref', { hideHere: true }).catch(() => {}); }
        else { side = side === 'left' ? 'right' : 'left'; b.textContent = pt(side === 'left' ? 'Placer le bouton à droite' : 'Placer le bouton à gauche'); ipcRenderer.invoke('pip:pref', { side }).catch(() => {}); show(pipFor); }
      }, true);
      pipEl.addEventListener('mouseenter', () => clearTimeout(hideT));
      pipEl.addEventListener('mouseleave', () => { hideT = setTimeout(() => { if (pipEl) { pipEl.style.display = 'none'; menu.style.display = 'none'; } }, 1200); });
    };
    const show = v => {
      if (off || !v || document.fullscreenElement) return;
      const r = v.getBoundingClientRect();
      if (r.width < 200 || r.height < 112) return;
      if (!pipEl || !uiHost?.isConnected) make();
      pipFor = v; clearTimeout(hideT);
      pipEl.style.display = 'block';
      const w = pipEl.offsetWidth || 160;
      const top = Math.max(4, r.top + (CFG.capture && TOP ? 56 : 12));
      pipEl.style.left = (side === 'left' ? Math.max(4, r.left + 12) : Math.min(innerWidth - w - 8, r.right - w - 12)) + 'px';
      pipEl.style.top = top + 'px';
      hideT = setTimeout(() => { if (pipEl) pipEl.style.display = 'none'; }, 3000);
    };
    // la souris passe sur une vidéo (même recouverte par les commandes du lecteur)
    let lastMove = 0;
    addEventListener('mousemove', e => {
      const n = Date.now(); if (n - lastMove < 150) return; lastMove = n;
      for (const v of document.querySelectorAll('video')) {
        const r = v.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && r.width >= 200) return show(v);
      }
    }, { passive: true, capture: true });
  }

  // ---------- 4. mots de passe, adresses et cartes ----------
  (() => {
    const isPw = el => el && el.tagName === 'INPUT' && el.type === 'password';
    const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const TEXTY = /^(text|email|tel|search|url|number|)$/i;
    const setVal = (el, v) => {
      if (el.tagName === 'SELECT') {
        const o = [...el.options].find(o => o.value === v || o.text.trim() === v || (v.length <= 2 && (+o.value === +v || +o.text === +v)));
        if (o) el.value = o.value;
      } else {
        const proto = Object.getPrototypeOf(el);
        const d = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        d.set.call(el, v);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    function userFieldFor(pw) {
      const scope = pw.form || document;
      const ins = [...scope.querySelectorAll('input')].filter(i => !isPw(i) && /^(text|email|tel|)$/i.test(i.type) && visible(i));
      const ac = ins.find(i => /username|email/i.test(i.autocomplete || ''));
      if (ac) return ac;
      const before = ins.filter(i => i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
      return before[before.length - 1] || ins[0] || null;
    }
    // champ de création de mot de passe (inscription, changement)
    const isNewPw = pw => {
      if (/new-password/.test(pw.autocomplete || '')) return true;
      if (/current-password/.test(pw.autocomplete || '')) return false;
      const scope = pw.form || document;
      const n = [...scope.querySelectorAll('input[type=password]')].filter(visible).length;
      const hint = [pw.name, pw.id, pw.placeholder, pw.getAttribute('aria-label')].join(' ');
      return n >= 2 || /new|nouveau|confirm|register|inscri|signup|create|cr[ée]er/i.test(hint);
    };

    // petite liste déroulante
    let dd = null, ddFor = null;
    function showDrop(anchor, items) {
      ui();
      if (!dd) dd = el(`<div class="card" style="padding:4px;min-width:220px;max-width:420px;display:none"><style>.i{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;cursor:pointer}.i:hover{background:#8b5cf62e}.k{width:24px;height:24px;border-radius:7px;background:#8b5cf6;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12px;flex:none}.t{min-width:0}.t b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.t span{color:#8a91a3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}.f{color:#5b6274;font-size:10px;padding:4px 10px 2px;letter-spacing:.5px}</style><div class="lst"></div><div class="f">DrYAE</div></div>`);
      const r = anchor.getBoundingClientRect();
      ddFor = anchor;
      dd.style.minWidth = Math.max(220, Math.min(r.width, 420)) + 'px';
      setHTML(dd.querySelector('.lst'), items.map((it, i) => `<div class="i" data-i="${i}"><div class="k">${it.icon}</div><div class="t"><b>${esc(it.title)}</b><span>${esc(it.sub || '')}</span></div></div>`).join(''));
      dd.style.display = 'block';
      dd.style.left = Math.max(4, Math.min(r.left, innerWidth - dd.offsetWidth - 8)) + 'px';
      dd.style.top = (r.bottom + 4 + dd.offsetHeight > innerHeight ? Math.max(4, r.top - dd.offsetHeight - 4) : r.bottom + 4) + 'px';
      dd.onmousedown = e => {
        const it = e.composedPath().find(x => x.dataset && x.dataset.i !== undefined);
        if (!it) return;
        e.preventDefault(); e.stopPropagation();
        hideDrop(); items[+it.dataset.i].run();
      };
    }
    function hideDrop() { if (dd) dd.style.display = 'none'; ddFor = null; }
    document.addEventListener('focusout', () => setTimeout(() => { if (ddFor && document.activeElement !== ddFor) hideDrop(); }, 150), true);
    addEventListener('scroll', hideDrop, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideDrop(); }, true);

    // --- mots de passe enregistrés ---
    let creds = null;
    const getCreds = () => (creds = creds || ipcRenderer.invoke('pw:get').catch(() => []));
    const filled = new WeakSet();
    // champ d'identifiant seul (pas de mot de passe sur la page)
    const isUserOnly = t => {
      if (!(t instanceof HTMLInputElement) || !/^(text|email|tel|)$/i.test(t.type)) return false;
      if ((t.form || document).querySelector('input[type=password]')) return false;
      const ac = (t.autocomplete || '').toLowerCase();
      if (/username|webauthn/.test(ac) || (t.type === 'email' && !/off|new/.test(ac))) return true;
      return /identifier|login|user(name)?|e-?mail|identifiant|account|compte/i.test([t.name, t.id, t.getAttribute('aria-label')].join(' ')) && !/search|recherche|newsletter/i.test([t.name, t.id, t.placeholder].join(' '));
    };
    // l'identifiant saisi est gardé pour la page suivante (mot de passe)
    const keepUser = t => { if (t && isUserOnly(t) && t.value.trim()) ipcRenderer.invoke('pw:user', t.value.trim()).catch(() => {}); };
    document.addEventListener('keydown', e => { if (e.key === 'Enter') keepUser(e.target); }, true);
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button, [role=button], input[type=submit]')) { const scope = e.target.closest('form') || document; [...scope.querySelectorAll('input')].filter(i => visible(i) && isUserOnly(i)).forEach(keepUser); } }, true);
    function fillLogin(pw, c) { const u = userFieldFor(pw); if (u && c.username) setVal(u, c.username); setVal(pw, c.password); ipcRenderer.invoke('pw:used', c.username).catch(() => {}); }
    async function scanPw() {
      const pws = [...document.querySelectorAll('input[type=password]')].filter(visible);
      if (!pws.length) return;
      const list = await getCreds();
      if (!list.length) return;
      for (const pw of pws) {
        if (filled.has(pw)) continue;
        filled.add(pw);
        const last = list.find(c => c.last);
        if ((list.length === 1 || (last && !userFieldFor(pw))) && !pw.value && !isNewPw(pw)) fillLogin(pw, last || list[0]);
      }
    }
    document.addEventListener('focusin', async e => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      // carte de paiement
      const ck = cardKind(target);
      if (ck) {
        const cards = await ipcRenderer.invoke('card:list').catch(() => []);
        if (cards.length && document.activeElement === target) {
          return showDrop(target, cards.map(c => ({ icon: '💳', title: `${c.brand} •••• ${c.last4}`, sub: [c.nick || c.holder, c.exp].filter(Boolean).join(' · '), run: () => fillCard(target.form || document, c.id) })));
        }
        return;
      }
      // identifiants
      const pw = isPw(target) ? target : (target.form || document).querySelector('input[type=password]');
      if (pw && (isPw(target) || userFieldFor(pw) === target)) {
        const items = [];
        if (isPw(target) && isNewPw(target)) {
          items.push({ icon: '✨', title: pt('Suggérer un mot de passe fort'), sub: pt('Utiliser ce mot de passe'), run: async () => {
            const g = await ipcRenderer.invoke('pw:gen').catch(() => ''); if (!g) return;
            const scope = target.form || document;
            for (const p of [...scope.querySelectorAll('input[type=password]')].filter(visible)) if (!/current-password/.test(p.autocomplete || '')) setVal(p, g);
          } });
        } else {
          const list = await getCreds();
          list.sort((a, b) => (b.last ? 1 : 0) - (a.last ? 1 : 0)).forEach(c => items.push({ icon: '🔑', title: c.username || pt('(sans identifiant)'), sub: '•'.repeat(Math.min(12, c.password.length)) + '  ' + pt('— mot de passe enregistré'), run: () => fillLogin(pw, c) }));
        }
        if (items.length && document.activeElement === target) return showDrop(target, items);
        return;
      }
      // connexion en deux étapes (adresse d'abord, mot de passe ensuite) : choix parmi les comptes enregistrés
      if (isUserOnly(target)) {
        const list = await getCreds();
        const users = [...new Map(list.filter(c => c.username).map(c => [c.username, c])).values()];
        if (users.length && document.activeElement === target) return showDrop(target, users.map(c => ({ icon: (c.username[0] || '?').toUpperCase(), title: c.username, sub: pt('Compte enregistré'), run: () => { setVal(target, c.username); ipcRenderer.invoke('pw:user', c.username).catch(() => {}); } })));
        return;
      }
      // adresses
      const kind = fieldKind(target);
      if (!kind || target.value) return;
      const list = await ipcRenderer.invoke('af:get').catch(() => []);
      const ok = list.filter(a => a[kind] || (kind === 'fullName' && (a.givenName || a.familyName)));
      if (!ok.length || document.activeElement !== target) return;
      showDrop(target, ok.map(a => {
        const who = [a.givenName, a.familyName].filter(Boolean).join(' ') || a.fullName || a.email || pt('mon profil');
        return { icon: '👤', title: who, sub: [a.address, a.city, a.email].filter(Boolean).join(' · '), run: () => fillProfile(target.form || document, a) };
      }));
    }, true);

    // --- proposition d'enregistrement après connexion ---
    let lastOffer = '';
    function offerFrom(pw) {
      if (!pw || !pw.value) return;
      const u = userFieldFor(pw);
      const pws = [...(pw.form || document).querySelectorAll('input[type=password]')].filter(x => x.value);
      const password = pws.length > 1 ? pws[pws.length - 1].value : pw.value; // création de compte : dernier champ
      const username = u ? u.value : '';
      const key = username + '\u0000' + password;
      if (key === lastOffer) return;
      lastOffer = key;
      ipcRenderer.invoke('pw:offer', { username, password }).catch(() => {});
    }
    document.addEventListener('submit', e => { const pw = e.target.querySelector && e.target.querySelector('input[type=password]'); if (pw) offerFrom(pw); }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && isPw(e.target)) offerFrom(e.target); }, true);
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button, input[type=submit], input[type=button], [role=button], a');
      if (!b) return;
      const scope = b.form || b.closest('form') || document;
      const pw = [...scope.querySelectorAll('input[type=password]')].find(x => x.value);
      if (pw) offerFrom(pw);
    }, true);

    // --- adresses ---
    const MAP = [
      ['email', /e-?mail|courriel|mail/i, ['email']],
      ['tel', /t[ée]l|phone|mobile|portable|gsm/i, ['tel', 'tel-national']],
      ['givenName', /pr[ée]nom|first.?name|given|fname/i, ['given-name']],
      ['familyName', /^nom$|last.?name|family|surname|lname|nom.?de.?famille/i, ['family-name']],
      ['fullName', /full.?name|^name$|nom.?complet|your.?name|^nom.?et.?pr/i, ['name']],
      ['postalCode', /code.?postal|zip|postal|cp$/i, ['postal-code']],
      ['city', /ville|city|town|localit|commune/i, ['address-level2']],
      ['country', /pays|country/i, ['country', 'country-name']],
      ['address', /adresse|address|rue|street|ligne.?1|line.?1/i, ['street-address', 'address-line1']],
      ['company', /soci[ée]t[ée]|entreprise|company|organi[sz]ation/i, ['organization']],
    ];
    const labelOf = el => [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.labels && el.labels[0] ? el.labels[0].textContent : ''].filter(Boolean).map(x => String(x).trim());
    function fieldKind(el) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || isPw(el)) return null;
      if (el instanceof HTMLInputElement && !/^(text|email|tel|search|url|)$/i.test(el.type)) return null;
      const ac = (el.autocomplete || '').toLowerCase().split(/\s+/).pop();
      for (const [k, , acs] of MAP) if (acs.includes(ac)) return k;
      if (el.type === 'email') return 'email';
      if (el.type === 'tel') return 'tel';
      const parts = labelOf(el);
      if (!parts.length || parts.some(x => /search|recherche|captcha|code.?promo|coupon|otp/i.test(x))) return null;
      for (const [k, re] of MAP) if (parts.some(x => re.test(x))) return k;
      return null;
    }
    function fillProfile(scope, p) {
      for (const el of scope.querySelectorAll('input, textarea')) {
        if (!visible(el) || el.value) continue;
        const k = fieldKind(el);
        let v = k && p[k];
        if (k === 'fullName' && !v) v = [p.givenName, p.familyName].filter(Boolean).join(' ');
        if (v) setVal(el, v);
      }
    }
    // --- cartes de paiement ---
    function cardKind(el) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return null;
      const ac = (el.autocomplete || '').toLowerCase().split(/\s+/).pop();
      if (/^cc-(number|name|exp|exp-month|exp-year)$/.test(ac)) return ac;
      if (ac === 'cc-csc') return null;
      const parts = labelOf(el).join(' ');
      if (/cvc|cvv|cryptogramme|security.?code|csc/i.test(parts)) return null;
      if (/card.?num|cardnumber|num[ée]ro.?(de.?)?carte|cc-?num|ccnum|credit.?card|n°.?de.?carte/i.test(parts)) return 'cc-number';
      if (/card.?holder|titulaire|name.?on.?card|nom.?sur.?la.?carte|cc-?name/i.test(parts)) return 'cc-name';
      if (/exp.*(month|mois)|(month|mois).*exp|cc-?month/i.test(parts)) return 'cc-exp-month';
      if (/exp.*(year|ann[ée]e)|(year|ann[ée]e).*exp|cc-?year/i.test(parts)) return 'cc-exp-year';
      if (/expir|exp.?date|mm.?\/?.?yy|validit/i.test(parts)) return 'cc-exp';
      return null;
    }
    async function fillCard(scope, id) {
      const c = await ipcRenderer.invoke('card:fill', id).catch(() => null);
      if (!c) return;
      const [mm, yy] = String(c.exp || '').split('/');
      for (const f of scope.querySelectorAll('input, select')) {
        if (!visible(f)) continue;
        const k = cardKind(f);
        if (k === 'cc-number') setVal(f, c.number);
        else if (k === 'cc-name' && c.holder) setVal(f, c.holder);
        else if (k === 'cc-exp' && mm) setVal(f, mm + '/' + (f.maxLength === 7 || /aaaa|yyyy/i.test(f.placeholder || '') ? (yy.length === 2 ? '20' + yy : yy) : yy.slice(-2)));
        else if (k === 'cc-exp-month' && mm) setVal(f, f.tagName === 'SELECT' ? String(+mm) : mm);
        else if (k === 'cc-exp-year' && yy) setVal(f, f.tagName === 'SELECT' || f.maxLength === 4 ? (yy.length === 2 ? '20' + yy : yy) : yy.slice(-2));
      }
    }

    let t = 0;
    const kick = () => { clearTimeout(t); t = setTimeout(scanPw, 400); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick); else kick();
    new MutationObserver(kick).observe(document, { childList: true, subtree: true });
  })();

  if (!TOP) return;

  // ---------- 5a. masquer un élément à la main (sélecteur) ----------
  function cssPath(e0) {
    const parts = []; let e = e0;
    const good = c => /^[A-Za-z_][\w-]{1,40}$/.test(c) && !/\d{4,}|^(css|sc|jsx|svelte)-|__/.test(c);
    while (e && e.nodeType === 1 && e !== document.documentElement && e !== document.body) {
      if (e.id && /^[A-Za-z][\w-]{1,40}$/.test(e.id) && !/\d{3,}/.test(e.id) && document.querySelectorAll('#' + CSS.escape(e.id)).length === 1) { parts.unshift('#' + CSS.escape(e.id)); break; }
      let s = e.localName;
      const cls = [...e.classList].filter(good).slice(0, 3);
      if (cls.length) s += '.' + cls.map(c => CSS.escape(c)).join('.');
      const p = e.parentElement;
      if (p && [...p.children].filter(c => c !== e && c.matches(s)).length) s += `:nth-of-type(${[...p.children].filter(c => c.localName === e.localName).indexOf(e) + 1})`;
      parts.unshift(s);
      try { if (document.querySelectorAll(parts.join(' > ')).length === 1) break; } catch {}
      e = p;
    }
    return parts.join(' > ');
  }
  let picking = null;
  function picker(x, y) {
    if (picking) return;
    const R = ui();
    const box = el('<div style="position:fixed;pointer-events:none;border:2px solid #f43f5e;background:#f43f5e2e;border-radius:4px;transition:all .06s;display:none"></div>');
    const bar = el(`<div class="card" style="left:50%;bottom:18px;transform:translateX(-50%);padding:10px 12px;display:flex;align-items:center;gap:10px;max-width:min(760px,92vw)"><span class="msg" style="flex:1;font-size:12.5px">${esc(pt('Cliquez sur un élément à masquer. Molette ou ↑ ↓ : agrandir / réduire. Échap : annuler.'))}</span><code class="sel" style="display:none;font:11px Consolas,monospace;color:#c4b5fd;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></code><button class="btn pri ok" style="display:none">${esc(pt('Masquer cet élément'))}</button><button class="btn no">${esc(pt('Annuler'))}</button></div>`);
    let cur = null, locked = false; const stack = [];
    const draw = () => { if (!cur) { box.style.display = 'none'; return; } const r = cur.getBoundingClientRect(); Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); if (locked) { const s = bar.querySelector('.sel'); s.style.display = ''; s.textContent = cssPath(cur); } };
    const at = (cx, cy) => { const e = document.elementFromPoint(cx, cy); return e && e !== uiHost && e !== document.documentElement && e !== document.body ? e : null; };
    const move = e => { if (locked) return; cur = at(e.clientX, e.clientY); stack.length = 0; draw(); };
    const click = e => { if (e.composedPath().includes(uiHost)) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if (!cur) return; locked = true; bar.querySelector('.ok').style.display = ''; draw(); };
    const wheel = e => { if (!cur) return; e.preventDefault(); grow(e.deltaY < 0); };
    const grow = up => { if (up) { if (cur.parentElement && cur.parentElement !== document.body && cur.parentElement !== document.documentElement) { stack.push(cur); cur = cur.parentElement; } } else if (stack.length) cur = stack.pop(); draw(); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); stop(); } else if (e.key === 'ArrowUp') { e.preventDefault(); grow(true); } else if (e.key === 'ArrowDown') { e.preventDefault(); grow(false); } else if (e.key === 'Enter' && locked) { e.preventDefault(); bar.querySelector('.ok').click(); } };
    const block = e => { if (!e.composedPath().includes(uiHost)) { e.preventDefault(); e.stopPropagation(); } };
    const stop = () => { removeEventListener('mousemove', move, true); removeEventListener('click', click, true); removeEventListener('wheel', wheel, { capture: true }); removeEventListener('keydown', key, true); removeEventListener('mousedown', block, true); removeEventListener('mouseup', block, true); box.remove(); bar.remove(); picking = null; };
    addEventListener('mousemove', move, true); addEventListener('click', click, true); addEventListener('wheel', wheel, { capture: true, passive: false }); addEventListener('keydown', key, true); addEventListener('mousedown', block, true); addEventListener('mouseup', block, true);
    bar.querySelector('.no').onclick = stop;
    bar.querySelector('.ok').onclick = async () => {
      const sel = cssPath(cur); stop();
      if (!sel) return;
      CFG.hides = [...new Set([...(CFG.hides || []), sel])];
      applyHides(CFG.hides);
      ipcRenderer.invoke('pk:add', sel).catch(() => {});
    };
    picking = { stop };
    if (x != null) { cur = at(x, y); draw(); }
  }

  // ---------- 5b. traducteur (sélection et page entière) ----------
  // Sélection : un petit bouton apparaît à côté du texte choisi ; un clic affiche la traduction tout de suite.
  // Le bouton n'apparaît pas si le texte est déjà dans votre langue (option) ni sur les sites où le traducteur est éteint.
  let bubble = null, trBtn = null, trBtnTimer = 0;
  const TRC = CFG.translate || null;
  const closeTr = () => { bubble?.remove(); bubble = null; trBtn?.remove(); trBtn = null; clearTimeout(trBtnTimer); };
  const selText = () => { const s = getSelection(); return s && !s.isCollapsed ? String(s).trim() : ''; };
  const inField = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };
  const selRect = () => { try { const r = getSelection().getRangeAt(0).getBoundingClientRect(); return r.width || r.height ? r : null; } catch { return null; } };
  const langName = c => { try { return new Intl.DisplayNames([CFG.lang || 'fr'], { type: 'language' }).of(c || 'und') || c; } catch { return c || '?'; } };
  // détection locale et rapide de l'écriture du texte (sans rien envoyer) : sert à ne pas proposer de traduire un texte déjà dans votre langue
  const SCRIPT = { ar: /[؀-ۿ]/, ru: /[Ѐ-ӿ]/, uk: /[Ѐ-ӿ]/, ja: /[぀-ヿ]/, ko: /[가-힯]/, zh: /[一-鿿]/, he: /[֐-׿]/, el: /[Ͱ-Ͽ]/, th: /[฀-๿]/, hi: /[ऀ-ॿ]/ };
  const STOP = {
    fr: /\b(le|la|les|des|est|et|une|pour|que|qui|dans|pas|vous|avec|sur|ce|il|nous)\b/gi,
    en: /\b(the|and|is|are|of|to|in|that|it|for|you|with|on|this|was|have|be)\b/gi,
    es: /\b(el|los|las|es|y|que|de|en|un|una|por|con|para|del|se|no|lo)\b/gi,
    pt: /\b(o|os|as|é|e|que|de|em|um|uma|para|com|não|do|da|se|por)\b/gi,
    de: /\b(der|die|das|und|ist|nicht|ein|eine|zu|mit|den|ich|sie|es|auf)\b/gi,
    it: /\b(il|lo|gli|è|e|che|di|un|una|per|con|non|del|della|sono)\b/gi,
  };
  function looksLike(text, lang) {
    lang = String(lang || '').split('-')[0];
    const letters = (text.match(/\p{L}/gu) || []).length; if (letters < 4) return false;
    if (SCRIPT[lang]) return (text.match(new RegExp(SCRIPT[lang].source, 'g')) || []).length / letters > 0.5;
    if (Object.values(SCRIPT).some(r => (text.match(new RegExp(r.source, 'g')) || []).length / letters > 0.3)) return false;
    const words = (text.match(/\p{L}+/gu) || []).length; if (words < 4) return false;
    const score = l => (text.match(STOP[l]) || []).length;
    if (!STOP[lang]) return false;
    const mine = score(lang), best = Math.max(...Object.keys(STOP).filter(l => l !== lang).map(score));
    return mine >= 2 && mine > best;
  }
  async function translateSelection(text, rect) {
    text = text || selText(); rect = rect || selRect() || { left: innerWidth / 2 - 180, bottom: 80, top: 60 };
    if (!text) return;
    closeTr();
    bubble = el(`<div class="card" style="width:min(400px,92vw);padding:12px 14px 10px;--a:#8b5cf6"><div class="hd" style="display:flex;align-items:center;gap:6px;color:#8f97aa;font-size:11px;margin-bottom:6px">${ICO.tr}<span class="from" style="flex:1">${esc(pt('Traduction…'))}</span><button class="btn x" style="padding:3px;background:none" title="${esc(pt('Fermer'))}">${ICO.x}</button></div><div class="out" style="white-space:pre-wrap;max-height:42vh;overflow:auto;font-size:14.5px;line-height:1.5"></div><div class="src" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid #2c3242;color:#8f97aa;font-size:12px;white-space:pre-wrap;max-height:18vh;overflow:auto"></div><div class="ft" style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn cp">${ICO.copy}${esc(pt('Copier'))}</button><button class="btn sp">${ICO.spk}${esc(pt('Écouter'))}</button><button class="btn so">${esc(pt('Texte d\'origine'))}</button></div></div>`);
    bubble.style.zIndex = 5;
    const place = () => { if (!bubble) return; const w = bubble.offsetWidth, h = bubble.offsetHeight; bubble.style.left = Math.max(8, Math.min(innerWidth - w - 8, rect.left)) + 'px'; bubble.style.top = (rect.bottom + 8 + h < innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - h - 8)) + 'px'; };
    place();
    bubble.querySelector('.x').onclick = closeTr;
    let out = '', to = 'fr';
    bubble.querySelector('.cp').onclick = () => { try { navigator.clipboard.writeText(out); } catch {} };
    bubble.querySelector('.sp').onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(out); u.lang = to; speechSynthesis.speak(u); } catch {} };
    bubble.querySelector('.so').onclick = () => { const s = bubble.querySelector('.src'); s.textContent = text; s.style.display = s.style.display === 'none' ? '' : 'none'; place(); };
    bubble.addEventListener('mousedown', e => e.stopPropagation());
    try {
      // langue détectée automatiquement ; texte déjà dans votre langue → traduit dans la 2e langue (ex. français → anglais)
      const r = await ipcRenderer.invoke('tr:text', [text.slice(0, 5000)], { auto2: true });
      out = r.texts[0] || ''; to = r.to;
      if (!bubble) return;
      bubble.querySelector('.out').textContent = out;
      bubble.querySelector('.from').textContent = ptf('Traduit de {0}', langName(r.from)) + ' → ' + langName(r.to);
    } catch (e) { if (bubble) bubble.querySelector('.out').textContent = ptf('Traduction impossible : {0}', String(e.message || e).replace(/^.*Error: /, '')); }
    place();
  }
  function showTrButton(t, r, x, y) {
    trBtn?.remove();
    trBtn = el(`<button class="card" title="${esc(pt('Traduire'))}" style="all:unset;position:fixed;pointer-events:auto;cursor:pointer;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#8b5cf6;color:#fff;box-shadow:0 6px 18px #0006;opacity:0;transform:scale(.7);transition:opacity .12s,transform .12s">${ICO.tr}</button>`);
    trBtn.style.left = Math.min(innerWidth - 40, x + 8) + 'px'; trBtn.style.top = Math.min(innerHeight - 40, y + 10) + 'px';
    requestAnimationFrame(() => { if (trBtn) { trBtn.style.opacity = 1; trBtn.style.transform = 'none'; } });
    // le bouton réagit dès qu'on appuie dessus (la page ne peut pas effacer la sélection avant)
    trBtn.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); translateSelection(t, r); }, true);
    trBtn.onmousedown = ev => { ev.preventDefault(); ev.stopPropagation(); };
  }
  let trEnabled = !!(TRC && !TRC.off);
  if (TRC) {
    document.addEventListener('mouseup', e => {
      if (!trEnabled || e.button !== 0 || e.composedPath().includes(uiHost)) return;
      clearTimeout(trBtnTimer);
      trBtnTimer = setTimeout(() => {
        const t = selText();
        if (!t || inField() || t.length > 5000) { if (trBtn && !t) { trBtn.remove(); trBtn = null; } return; }
        const mode = TRC.selection;
        if (mode === 'off') return;
        if (TRC.hideSame && looksLike(t, TRC.target)) return;
        const r = selRect(); if (!r) return;
        if (mode === 'auto') return translateSelection(t, r);
        showTrButton(t, r, e.clientX, e.clientY);
      }, 30 + (TRC.delay || 0));
    }, true);
    document.addEventListener('mousedown', e => { if (!e.composedPath().includes(uiHost)) { if (bubble) closeTr(); else if (trBtn) { trBtn.remove(); trBtn = null; } } }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape' && (bubble || trBtn)) closeTr(); }, true);
    addEventListener('scroll', () => { if (trBtn) { trBtn.remove(); trBtn = null; } }, { passive: true, capture: true });
  }
  // traduction de la page : seuls les textes changent, les originaux sont gardés pour « Afficher l'original »
  const SKIP_TR = 'script,style,noscript,code,pre,textarea,input,select,svg,math,kbd,samp,var,[translate=no],.notranslate,[contenteditable=""],[contenteditable=true],dryae-ui,dryae-video-button';
  let trOrig = null, trObs = null, trBusy = false;
  function textNodes(root) {
    const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (!/[\p{L}]{2}/u.test(n.nodeValue) || !n.parentElement || n.parentElement.closest(SKIP_TR) || (trOrig && trOrig.has(n)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = w.nextNode())) out.push(n);
    return out;
  }
  async function translateNodes(nodes) {
    let i = 0;
    while (i < nodes.length) {
      const batch = []; let size = 0;
      while (i < nodes.length && batch.length < 80 && size < 3500) { const n = nodes[i++]; const v = n.nodeValue.trim(); if (!v || v.length > 3000) continue; batch.push(n); size += v.length; }
      if (!batch.length) continue;
      const r = await ipcRenderer.invoke('tr:text', batch.map(n => n.nodeValue.trim().replace(/\s+/g, ' ')));
      batch.forEach((n, k) => { if (!trOrig) return; const v = n.nodeValue; const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0]; trOrig.set(n, v); if (r.texts[k]) n.nodeValue = lead + r.texts[k] + trail; });
      toHost('dryae-tr', { state: 'working', from: r.from, to: r.to, done: i, total: nodes.length });
      trFrom = r.from; trTo = r.to;
    }
  }
  let trFrom = '', trTo = '';
  async function translatePage() {
    if (trBusy || !TOP) return;
    trBusy = true; trOrig = trOrig || new Map();
    toHost('dryae-tr', { state: 'working', done: 0 });
    try {
      // d'abord ce qui est visible, puis le reste
      const all = textNodes(document.body);
      const vis = [], rest = [];
      for (const n of all) { const r = n.parentElement.getBoundingClientRect(); (r.bottom > 0 && r.top < innerHeight * 1.5 ? vis : rest).push(n); }
      await translateNodes([...vis, ...rest]);
      document.documentElement.lang = trTo || document.documentElement.lang;
      toHost('dryae-tr', { state: 'done', from: trFrom, to: trTo });
      trObs = trObs || new MutationObserver(ms => { if (!trOrig) return; clearTimeout(trObs.t); trObs.t = setTimeout(() => { const add = []; ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 3 && n.parentElement && !n.parentElement.closest(SKIP_TR) && !trOrig.has(n)) add.push(n); else if (n.nodeType === 1) add.push(...textNodes(n)); })); if (add.length) translateNodes(add).catch(() => {}); }, 600); });
      trObs.observe(document.body, { childList: true, subtree: true });
    } catch (e) { toHost('dryae-tr', { state: 'error', msg: String(e.message || e).replace(/^.*Error: /, '') }); }
    trBusy = false;
  }
  function restorePage() {
    if (trObs) { trObs.disconnect(); }
    if (trOrig) for (const [n, v] of trOrig) { try { n.nodeValue = v; } catch {} }
    trOrig = null;
    toHost('dryae-tr', { state: 'restored' });
  }
  // site traduit automatiquement (choisi dans la fenêtre du traducteur)
  if (TRC && TRC.pageAuto && !TRC.off && TOP) {
    const go = () => setTimeout(() => { if (!looksLike((document.body?.innerText || '').slice(0, 3000), TRC.target)) translatePage(); }, 800);
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  }

  // ---------- bandeaux de cookies : DrYAE clique sur « Refuser » quand c'est possible ----------
  // (boutons connus des outils de consentement les plus courants, sinon un bouton « Tout refuser » dans un bandeau qui parle de cookies)
  if (CFG.cookieRefuse && !CFG.internal) {
    const KNOWN = ['#onetrust-reject-all-handler', '#didomi-notice-disagree-button', '.didomi-continue-without-agreeing', '#CybotCookiebotDialogBodyButtonDecline', '#axeptio_btn_dismiss', '.cky-btn-reject', '.cmplz-deny', '.osano-cm-denyAll', '.iubenda-cs-reject-btn', '[data-testid="uc-deny-all-button"]', '#truste-consent-required', '.sp_choice_type_13', 'button[data-cookiebanner="reject_button"]', '.fc-cta-do-not-consent', '#tarteaucitronAllDenied2', '.cc-deny', '#cookie-reject', '#reject-all', '[aria-label="Tout refuser"]', '[aria-label="Reject all"]'];
    const WORDS = /^(tout refuser|refuser tout|refuser|je refuse|continuer sans accepter|refuser les cookies|reject all|reject|decline all|decline|deny all|only necessary|only essential|necessary only|use necessary cookies only|rechazar todo|rechazar|rejeitar tudo|rejeitar|recusar|отклонить все|отклонить|رفض الكل|رفض|alle ablehnen|nur notwendige|rifiuta tutto|rifiuta)$/i;
    let done = false, tries = 0;
    const look = () => {
      if (done || ++tries > 40) return;
      let b = null;
      for (const s of KNOWN) { const x = document.querySelector(s); if (x && x.offsetParent !== null) { b = x; break; } }
      if (!b) for (const x of document.querySelectorAll('button,[role=button],a[role=button],input[type=button]')) {
        const t = (x.innerText || x.value || x.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        if (t.length > 40 || !WORDS.test(t) || x.offsetParent === null) continue;
        let p = x, ok = false; for (let i = 0; i < 8 && p; i++, p = p.parentElement) if (/cookie|consent|gdpr|rgpd|privacy|confidentialit/i.test((p.id || '') + ' ' + (p.className || '') + ' ' + (i > 2 ? (p.innerText || '').slice(0, 600) : ''))) { ok = true; break; }
        if (ok) { b = x; break; }
      }
      if (b) { done = true; try { b.click(); } catch {} toHost('dryae-cookie', location.hostname); }
    };
    const start = () => { look(); const mo = new MutationObserver(() => { clearTimeout(mo.t); mo.t = setTimeout(look, 250); }); mo.observe(document.documentElement, { childList: true, subtree: true }); setTimeout(() => mo.disconnect(), 15000); };
    if (TOP) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start(); }
  }

  // ---------- mode lecture : seulement le texte de l'article (préparé par Readability, Mozilla, Apache-2.0) ----------
  let reader = null;
  const RD = { size: 19, theme: 'light', width: 720, font: 'sans', ...(CFG.reader || {}) };
  const RTH = { light: ['#ffffff', '#1d1d1f', '#0b57d0'], sepia: ['#f4ecd8', '#3b2f1e', '#8a4b08'], dark: ['#15171c', '#e3e5ea', '#8ab4f8'] };
  // le contenu vient de la page : on garde le texte et les images, sans scripts ni attributs d'événements
  function cleanNode(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + (html || ''), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta,noscript').forEach(n => n.remove());
    doc.querySelectorAll('*').forEach(n => { for (const a of [...n.attributes]) { const k = a.name.toLowerCase(); if (k.startsWith('on') || k === 'style' || k === 'class' || k === 'id' || ((k === 'href' || k === 'src') && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name); } if (n.tagName === 'A') { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener'); } if (n.tagName === 'IMG') n.setAttribute('loading', 'lazy'); });
    return doc.body;
  }
  function readerOpen(a) {
    if (!a || !a.html) return hint(pt('Pas d\'article à afficher sur cette page'));
    const [bg, fg, ln] = RTH[RD.theme] || RTH.light;
    const box = el(`<div class="card rd" role="dialog" aria-modal="true" aria-label="${esc(pt('Mode lecture'))}" tabindex="-1" style="inset:0;border-radius:0;border:0;overflow:auto;background:${bg};color:${fg};z-index:2147483647">
      <style>.rd .bar{position:sticky;top:0;display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px;background:${bg}ee;border-bottom:1px solid #8884;backdrop-filter:blur(6px)}.rd .bar button{all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;background:#8882;font:600 13px "Segoe UI",sans-serif;color:${fg}}.rd .bar button:focus-visible{outline:2px solid ${ln}}.rd article{margin:0 auto;padding:28px 22px 80px;max-width:${RD.width}px;font:${RD.size}px/1.7 ${RD.font === 'serif' ? 'Georgia,"Times New Roman",serif' : RD.font === 'easy' ? 'Verdana,Tahoma,sans-serif' : '"Segoe UI",Arial,sans-serif'};${RD.font === 'easy' ? 'letter-spacing:.04em;word-spacing:.14em;' : ''}}.rd article h1{font-size:1.7em;line-height:1.25;margin:.2em 0 .3em}.rd .by{opacity:.7;font-size:.85em;margin-bottom:1.4em}.rd article img,.rd article video,.rd article figure{max-width:100%;height:auto}.rd article a{color:${ln}}.rd article pre{white-space:pre-wrap;background:#8881;padding:10px;border-radius:8px}.rd article table{border-collapse:collapse;max-width:100%}.rd article td,.rd article th{border:1px solid #8885;padding:4px 6px}</style>
      <div class="bar">
        <button data-r="minus" aria-label="${esc(pt('Texte plus petit'))}">A−</button><button data-r="plus" aria-label="${esc(pt('Texte plus grand'))}">A+</button>
        <button data-r="theme">${esc(pt('Couleurs'))}</button><button data-r="font">${esc(pt('Police'))}</button><button data-r="width">${esc(pt('Largeur'))}</button>
        <button data-r="speak">🔊 ${esc(pt('Lire à voix haute'))}</button><button data-r="close" aria-label="${esc(pt('Fermer le mode lecture (Échap)'))}">✕ ${esc(pt('Fermer'))}</button>
      </div>
      <article lang="${esc(a.lang || '')}" dir="${esc(a.dir || 'auto')}"><h1></h1><div class="by"></div><div class="ct"></div></article></div>`);
    box.querySelector('h1').textContent = a.title || document.title;
    box.querySelector('.by').textContent = [a.byline, a.site].filter(Boolean).join(' · ');
    box.querySelector('.ct').append(...cleanNode(a.html).childNodes);
    const save = () => ipcRenderer.invoke('reader:pref', RD).catch(() => {});
    box.querySelector('.bar').onclick = e => {
      const k = e.target.closest('[data-r]')?.dataset.r; if (!k) return;
      if (k === 'close') return readerClose();
      if (k === 'speak') return speaking ? speakStop() : speak(box.querySelector('article').innerText, a.lang);
      if (k === 'plus') RD.size = Math.min(34, RD.size + 2); if (k === 'minus') RD.size = Math.max(13, RD.size - 2);
      if (k === 'theme') RD.theme = { light: 'sepia', sepia: 'dark', dark: 'light' }[RD.theme] || 'light';
      if (k === 'font') RD.font = { sans: 'serif', serif: 'easy', easy: 'sans' }[RD.font] || 'sans';
      if (k === 'width') RD.width = RD.width >= 900 ? 560 : RD.width + 170;
      save(); readerClose(true); readerOpen(a);
    };
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); readerClose(); } }, true);
    reader = { box, a, overflow: document.documentElement.style.overflow };
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => box.focus(), 30);
    toHost('dryae-reader', true);
  }
  function readerClose(keep) { if (!reader) return; reader.box.remove(); document.documentElement.style.overflow = reader.overflow || ''; reader = null; if (!keep) { speakStop(); toHost('dryae-reader', false); } }

  // ---------- lecture à voix haute (voix installées dans Windows) ----------
  let speaking = null;
  function speakStop() { try { speechSynthesis.cancel(); } catch {} speaking?.card?.remove(); speaking = null; }
  function speak(text, lang) {
    speakStop();
    text = String(text || '').replace(/\s+/g, ' ').trim(); if (!text) return hint(pt('Rien à lire sur cette page'));
    // phrases d'au plus 220 caractères (les longues phrases coupent certaines voix)
    const parts = (text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [text]).flatMap(s => s.length <= 220 ? [s] : s.match(/.{1,220}(\s|$)/g));
    const L = (lang || document.documentElement.lang || navigator.language || 'fr').toLowerCase();
    const voice = () => { const v = speechSynthesis.getVoices(); return v.find(x => x.lang.toLowerCase() === L) || v.find(x => x.lang.toLowerCase().startsWith(L.split('-')[0])) || null; };
    const card = el(`<div class="card" role="region" aria-label="${esc(pt('Lecture à voix haute'))}" style="left:50%;bottom:18px;transform:translateX(-50%);padding:8px 10px;display:flex;gap:6px;align-items:center;font-size:12.5px;z-index:2147483647"><b>🔊 ${esc(pt('Lecture à voix haute'))}</b><span class="pg" style="color:#8f97aa;min-width:54px"></span><button class="btn" data-s="slow" aria-label="${esc(pt('Plus lent'))}">−</button><span class="rt">1×</span><button class="btn" data-s="fast" aria-label="${esc(pt('Plus rapide'))}">+</button><button class="btn" data-s="pause">${esc(pt('Pause'))}</button><button class="btn" data-s="stop">${esc(pt('Arrêter'))}</button></div>`);
    speaking = { card, i: 0, rate: +(CFG.reader?.rate) || 1, paused: false };
    const S = speaking;
    const next = () => {
      if (speaking !== S) return;
      if (S.i >= parts.length) return speakStop();
      card.querySelector('.pg').textContent = Math.round(S.i / parts.length * 100) + ' %';
      const u = new SpeechSynthesisUtterance(parts[S.i]); u.lang = L; const v = voice(); if (v) u.voice = v; u.rate = S.rate;
      u.onend = () => { S.i++; next(); }; u.onerror = () => { S.i++; next(); };
      speechSynthesis.speak(u);
    };
    card.onclick = e => {
      const k = e.target.closest('[data-s]')?.dataset.s; if (!k) return;
      if (k === 'stop') return speakStop();
      if (k === 'pause') { S.paused = !S.paused; S.paused ? speechSynthesis.pause() : speechSynthesis.resume(); e.target.textContent = pt(S.paused ? 'Reprendre' : 'Pause'); return; }
      S.rate = Math.max(0.5, Math.min(2.5, S.rate + (k === 'fast' ? 0.25 : -0.25))); card.querySelector('.rt').textContent = S.rate + '×';
      ipcRenderer.invoke('reader:pref', { ...RD, rate: S.rate }).catch(() => {});
      speechSynthesis.cancel(); next();
    };
    if (!speechSynthesis.getVoices().length) speechSynthesis.onvoiceschanged = () => { speechSynthesis.onvoiceschanged = null; };
    next();
  }

  // ---------- accessibilité dans les pages web : lecture facilitée, animations réduites ----------
  let a11yKeys = [];
  function a11yPage(e = {}) {
    if (!TOP && !e.frames) { /* aussi dans les cadres : même réglage */ }
    for (const k of a11yKeys) try { webFrame.removeInsertedCSS(k); } catch {}
    a11yKeys = [];
    try {
      if (e.easy) a11yKeys.push(webFrame.insertCSS('body,body *:not(code):not(pre):not(kbd):not([class*=icon]):not(i){font-family:Verdana,Tahoma,"Segoe UI",sans-serif!important;letter-spacing:.04em!important;word-spacing:.14em!important}p,li,dd,td{line-height:1.6!important}'));
      if (e.rm) a11yKeys.push(webFrame.insertCSS('*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}'));
    } catch {}
  }
  if (CFG.a11y && !CFG.internal) a11yPage(CFG.a11y);
  // économiseur de données sans le module des lumières : pas de vidéo lancée toute seule non plus
  if (CFG.dataSaver && !CFG.lights && !CFG.internal) document.addEventListener('play', e => { const v = e.target; if (v.tagName === 'VIDEO' && !(navigator.userActivation && navigator.userActivation.hasBeenActive)) { try { v.pause(); } catch {} } }, true);

  // ---------- 5c. lumières tamisées, protection des yeux, mode nuit, outils vidéo ----------
  let lights = null, autoLit = false;
  const L = CFG.lights || {};
  const LC = { opacity: +L.opacity || 85, color: /^#[0-9a-f]{6}$/i.test(L.color || '') ? L.color : '#000000' };
  function lightsTarget() {
    const v = pickVideo(200); if (v) return v;
    let best = null, area = 0;
    for (const f of document.querySelectorAll('iframe')) { const r = f.getBoundingClientRect(); const a = r.width * r.height; if (r.width >= 300 && r.height >= 160 && /youtube|vimeo|dailymotion|player|embed|video|stream|twitch/i.test(f.src || '') && a > area) { area = a; best = f; } }
    return best;
  }
  const opNow = () => Math.max(0.3, Math.min(0.97, LC.opacity / 100));
  // 1.7.0 : voile posé sur la page (lumières tamisées, protection des yeux) : le traducteur de scans le retire de la photo
  // de la page, pour lire l'image normale — l'écran, lui, reste tamisé
  var veilInfo = () => ({ lights: lights ? { op: opNow(), color: LC.color } : null, eye: eyeEl ? eyeA : 0 });
  function lightsOn(auto, quiet) {
    if (lights) return;
    const t = lightsTarget();
    const fade = L.fade !== false ? 'opacity .45s ease' : 'none';
    const panes = [0, 1, 2, 3].map(() => el(`<div style="position:fixed;pointer-events:${L.clickOff === false ? 'none' : 'auto'};background:${LC.color};opacity:0;transition:${fade};cursor:pointer"></div>`));
    const glow = el('<div style="position:fixed;pointer-events:none;border-radius:6px;opacity:0;transition:opacity .6s,box-shadow 1s"></div>');
    const tip = el(`<div class="card" style="left:50%;top:14px;transform:translateX(-50%);padding:6px 12px;font-size:12px;opacity:.85">${esc(pt(L.clickOff === false ? 'Échap pour rallumer' : 'Cliquez à côté pour rallumer'))}</div>`);
    setTimeout(() => tip.remove(), 2200);
    let raf = 0;
    let t2 = 0;
    const lay = () => {
      // la vidéo arrive après coup (nouvelle page) : on la retrouve
      if ((!t || !t.isConnected) && ++t2 % 30 === 0) t = lightsTarget();
      const r = t && t.isConnected ? t.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2 };
      const W = innerWidth, H = innerHeight, l = Math.max(0, r.left), rt = Math.min(W, r.right), tp = Math.max(0, r.top), bt = Math.min(H, r.bottom);
      const set = (p, x, y, w, h) => Object.assign(p.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
      set(panes[0], 0, 0, W, tp); set(panes[1], 0, bt, W, H - bt); set(panes[2], 0, tp, l, bt - tp); set(panes[3], rt, tp, W - rt, bt - tp);
      set(glow, l, tp, rt - l, bt - tp);
      const fs = !!document.fullscreenElement; panes.forEach(p => { p.style.display = fs ? 'none' : ''; }); glow.style.display = fs ? 'none' : '';
      raf = requestAnimationFrame(lay);
    };
    lay();
    requestAnimationFrame(() => panes.forEach(p => { p.style.opacity = opNow(); }));
    panes.forEach(p => { p.onclick = e => { e.preventDefault(); e.stopPropagation(); lightsOff(true); }; });
    // lueur : couleur moyenne de l'image (si la vidéo le permet), sinon violet doux
    let gt = 0; const cv = document.createElement('canvas'); cv.width = cv.height = 4;
    const tint = () => {
      if (!lights) return;
      if (!L.glow || !t || t.tagName !== 'VIDEO') { glow.style.opacity = 0; } else {
        let c = '139,92,246';
        try { const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(t, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } c = `${r / 16 | 0},${g / 16 | 0},${b / 16 | 0}`; } catch {}
        glow.style.boxShadow = `0 0 90px 30px rgba(${c},.55)`; glow.style.opacity = 1;
      }
      gt = setTimeout(tint, 700);
    };
    lights = { panes, glow, off: () => { cancelAnimationFrame(raf); clearTimeout(gt); panes.concat(glow).forEach(p => { p.style.opacity = 0; setTimeout(() => p.remove(), L.fade !== false ? 450 : 0); }); tip.remove(); }, tint };
    tint();
    autoLit = !!auto;
    toHost('dryae-lights', true);
    // allumé à la main : reste éteint sur toutes les pages et tous les onglets jusqu'à ce qu'on rallume
    if (!auto && !quiet) ipcRenderer.invoke('lights:global', true).catch(() => {});
  }
  function lightsOff(user) { if (!lights) return; lights.off(); lights = null; autoLit = false; toHost('dryae-lights', false); if (user !== false) ipcRenderer.invoke('lights:global', false).catch(() => {}); }
  function lightsLook(o) {
    if (o.opacity) LC.opacity = Math.max(30, Math.min(97, +o.opacity));
    if (o.color && /^#[0-9a-f]{6}$/i.test(o.color)) LC.color = o.color;
    for (const k of ['glow', 'wheelVolume', 'stopAutoplay', 'auto']) if (k in o) L[k] = !!o[k];
    if (lights) { lights.panes.forEach(p => { p.style.opacity = opNow(); p.style.background = LC.color; }); lights.tint(); }
  }
  // bulle d'information (opacité, volume…)
  let hintEl = null, hintT = 0;
  const hint = txt => { if (!hintEl || !hintEl.isConnected) hintEl = el('<div class="card" style="left:50%;top:50%;transform:translate(-50%,-50%);padding:8px 16px;font-size:16px;font-weight:700"></div>'); hintEl.textContent = txt; clearTimeout(hintT); hintT = setTimeout(() => { hintEl?.remove(); hintEl = null; }, 900); };
  // protection des yeux : filtre orangé au-dessus de la page (ne bloque pas les clics)
  // (feuille de style ajoutée par le navigateur : ne touche pas à la page, fonctionne dès le début du chargement)
  let eyeEl = null, eyeA = 0;
  function eye(on, level) {
    if (!TOP) return;
    if (eyeEl) { try { webFrame.removeInsertedCSS(eyeEl); } catch {} eyeEl = null; }
    eyeA = 0;
    if (on) { const a = Math.max(5, Math.min(60, +level || 30)) / 100; eyeA = a; try { eyeEl = webFrame.insertCSS(`html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483646;background:rgba(255,150,40,${a});mix-blend-mode:multiply}`); } catch {} }
  }
  if (CFG.lights && L.eye) eye(true, L.eyeLevel);
  // outils vidéo
  const VS = { rate: 1, loop: false, zoom: 1, filter: '', full: false };
  const SPEEDS = [1, 1.25, 1.5, 2, 2.5, 3, 0.5, 0.75], ZOOMS = [1, 1.25, 1.5, 2], FILTERS = ['', 'grayscale(1)', 'sepia(.8)', 'contrast(1.35)', 'saturate(1.8)', 'brightness(1.3)'];
  let fullSave = null;
  function videoAct(act) {
    const v = pickVideo(120); if (!v) return hint(pt('Aucune vidéo sur cette page'));
    const next = (arr, x) => arr[(arr.indexOf(x) + 1) % arr.length];
    if (act === 'speed') { setRate(next(SPEEDS, VS.rate), true); return; }
    else if (act === 'loop') { VS.loop = !VS.loop; v.loop = VS.loop; hint(pt(VS.loop ? 'Boucle activée' : 'Boucle désactivée')); }
    else if (act === 'zoom') { VS.zoom = next(ZOOMS, VS.zoom); v.style.transform = VS.zoom === 1 ? '' : `scale(${VS.zoom})`; hint('× ' + VS.zoom); }
    else if (act === 'filter') { VS.filter = next(FILTERS, VS.filter); v.style.filter = VS.filter; hint(VS.filter ? VS.filter.replace(/\(.*/, '') : pt('Sans filtre')); }
    else if (act === 'full') {
      VS.full = !VS.full;
      if (VS.full) { fullSave = v.getAttribute('style') || ''; v.style.cssText += ';position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;z-index:2147483646!important;background:#000!important;object-fit:contain!important'; }
      else { v.setAttribute('style', fullSave || ''); fullSave = null; }
    }
    else if (act === 'shot') { const r = v.getBoundingClientRect(); let z = 1; try { z = webFrame.getZoomFactor() || 1; } catch {} const x = Math.max(0, r.left), y = Math.max(0, r.top); toHost('dryae-shot', { x: x * z, y: y * z, w: (Math.min(innerWidth, r.right) - x) * z, h: (Math.min(innerHeight, r.bottom) - y) * z }); }
    else if (act === 'reset') { VS.rate = 1; VS.loop = false; VS.zoom = 1; VS.filter = ''; v.playbackRate = 1; v.loop = false; v.style.transform = ''; v.style.filter = ''; if (VS.full) videoAct('full'); }
    toHost('dryae-vstate', { ...VS });
  }
  if (CFG.lights) {
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && lights) return lightsOff();
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      // Alt+↑ / Alt+↓ : opacité ; Alt+F8 : opacité par défaut ; Alt+F9 : garder l'opacité actuelle ; Alt+F10 : protection des yeux
      if (lights && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); lightsLook({ opacity: LC.opacity + (e.key === 'ArrowUp' ? 5 : -5) }); hint(LC.opacity + ' %'); }
      else if (e.key === 'F8') { e.preventDefault(); lightsLook({ opacity: 85 }); hint('85 %'); }
      else if (e.key === 'F9') { e.preventDefault(); ipcRenderer.invoke('lights:pref', { opacity: LC.opacity }).catch(() => {}); hint(ptf('Opacité gardée : {0} %', LC.opacity)); }
      else if (e.key === 'F10') { e.preventDefault(); const on = !eyeEl; eye(on, L.eyeLevel); ipcRenderer.invoke('lights:pref', { eye: on }).catch(() => {}); hint(pt(on ? 'Protection des yeux activée' : 'Protection des yeux désactivée')); }
    }, true);
    document.addEventListener('play', e => { const v = e.target; if (L.auto && v.tagName === 'VIDEO' && !lights) { const r = v.getBoundingClientRect(); if (r.width >= 320 && r.height >= 180) setTimeout(() => lightsOn(true), 300); } }, true);
    // une pause (clic sur la vidéo) ne rallume pas : seule la fin de la vidéo rallume (mode automatique)
    document.addEventListener('ended', e => { if (e.target.tagName === 'VIDEO' && autoLit) lightsOff(false); }, true);
    // « Lumières éteintes » toujours actif : la nouvelle page s'assombrit aussi
    if (L.global && TOP) { const go = () => setTimeout(() => lightsOn(false, true), 400); if (document.readyState !== 'loading') go(); else document.addEventListener('DOMContentLoaded', go, { once: true }); }
    // pas de lecture automatique tant qu'on n'a pas touché à la page
    document.addEventListener('play', e => { const v = e.target; if ((L.stopAutoplay || CFG.dataSaver) && v.tagName === 'VIDEO' && !(navigator.userActivation && navigator.userActivation.hasBeenActive)) { try { v.pause(); } catch {} } }, true);
    // molette sur une vidéo : volume
    addEventListener('wheel', e => {
      if (!L.wheelVolume || e.ctrlKey) return;
      const v = e.target && e.target.closest ? (e.target.closest('video') || (pickVideo(200) && pickVideo(200).contains?.(e.target) ? pickVideo(200) : null)) : null;
      const vv = v || (() => { const p = pickVideo(200); if (!p) return null; const r = p.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? p : null; })();
      if (!vv) return;
      e.preventDefault();
      vv.volume = Math.max(0, Math.min(1, Math.round((vv.volume + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100)); if (vv.volume > 0) vv.muted = false;
      hint('🔊 ' + Math.round(vv.volume * 100) + ' %');
    }, { passive: false, capture: true });
  }
  let nightKey = null;
  const NIGHT = 'html{filter:invert(.9) hue-rotate(180deg)!important;background:#fff!important}img,video,picture,canvas,iframe,embed,object,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
  const night = on => { try { if (on && !nightKey) nightKey = webFrame.insertCSS(NIGHT); else if (!on && nightKey) { webFrame.removeInsertedCSS(nightKey); nightKey = null; } } catch {} toHost('dryae-night', !!nightKey); };
  if (CFG.lights && L.night) night(true);

  // ---------- 5d. traducteur de scans ----------
  // Lecture du texte des images puis traduction affichée dans des bulles propres, au-dessus de chaque bulle d'origine.
  // Icônes d'action au survol d'une image traduite : original / traduction, comparer (glisser), relire, retirer.
  let scan = null;
  const SC = CFG.scan || {};
  let scIcons = SC.icons !== false;
  function scanInit() {
    if (scan) return;
    const layer = el('<div style="position:fixed;inset:0;pointer-events:none;z-index:0"></div>');
    const bar = el(`<div class="card" style="right:16px;bottom:16px;padding:8px 10px;display:flex;align-items:center;gap:8px;font-size:12px"><span style="color:#c4b5fd;display:flex">${ICO.tr}</span><b>${esc(pt('Traducteur de scans'))}</b><span class="st" style="color:#8f97aa"></span><button class="btn tg">${esc(pt('Afficher l\'original'))}</button><button class="btn st2">${esc(pt('Arrêter'))}</button></div>`);
    scan = { layer, bar, items: new Map(), queue: [], busy: false, shown: true, n: 0, io: null, tools: null, hover: null };
    bar.querySelector('.tg').onclick = () => { scan.shown = !scan.shown; layer.style.display = scan.shown ? '' : 'none'; bar.querySelector('.tg').textContent = pt(scan.shown ? 'Afficher l\'original' : 'Afficher la traduction'); };
    bar.querySelector('.st2').onclick = scanStop;
    const loop = () => { if (!scan) return; for (const [img, it] of scan.items) placeScan(img, it); placeTools(); scan.raf = requestAnimationFrame(loop); };
    loop();
    scan.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { scanQueue(e.target); scan.io.unobserve(e.target); } }), { rootMargin: '1600px 0px' });
    // survol : quelle image traduite est sous la souris
    scan.move = e => { if (!scan || !scIcons) return; let hit = null; for (const [img, it] of scan.items) { if (!it.box) continue; const r = img.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { hit = img; break; } } if (hit !== scan.hover) { scan.hover = hit; drawTools(); } };
    addEventListener('mousemove', scan.move, { passive: true, capture: true });
  }
  function scanStart(onlySrc) {
    scanInit(); loadFont();
    const min = SC.minSize || 250;
    const imgs = [...document.querySelectorAll('img')].filter(i => (onlySrc ? (i.currentSrc || i.src) === onlySrc : i.naturalWidth >= min && i.naturalHeight >= min * 0.6));
    if (!imgs.length && !onlySrc) { status(pt('Aucune image à traduire sur cette page')); return; }
    for (const i of imgs) { if (onlySrc) scanQueue(i, true); else scan.io.observe(i); }
    // images ajoutées plus tard (défilement infini des webtoons)
    if (!onlySrc && !scan.mo) { scan.mo = new MutationObserver(() => { clearTimeout(scan.mt); scan.mt = setTimeout(() => { if (!scan) return; document.querySelectorAll('img').forEach(i => { if (!scan.items.has(i) && i.naturalWidth >= min && i.naturalHeight >= min * 0.6) scan.io.observe(i); }); }, 700); }); scan.mo.observe(document.body, { childList: true, subtree: true }); }
  }
  const status = s => { if (scan) scan.bar.querySelector('.st').textContent = s; };
  function scanQueue(img, first, fresh) { if (!scan) return; if (scan.items.has(img)) { const it = scan.items.get(img); if (!first || it.blocks) return; } scan.items.set(img, { blocks: null, box: null, fresh: !!fresh }); first ? scan.queue.unshift(img) : scan.queue.push(img); scanNext(); }
  const retry = new WeakMap();
  async function imgBytes(img) {
    try {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const b = await new Promise(r => c.toBlob(r, 'image/png'));
      return b ? new Uint8Array(await b.arrayBuffer()) : null;
    } catch { return null; }
  }
  async function scanNext() {
    if (!scan || scan.busy || !scan.queue.length) return;
    scan.busy = true;
    const img = scan.queue.shift();
    status(pt('Lecture des images…'));
    try {
      if (!img.complete) await new Promise(r => { img.addEventListener('load', r, { once: true }); setTimeout(r, 8000); });
      const r = img.getBoundingClientRect(); let dpr = 1; try { dpr = webFrame.getZoomFactor() || 1; } catch {}
      const src = img.currentSrc || img.src;
      let data = null;
      if (/^(blob|data):/.test(src)) { try { data = new Uint8Array(await (await fetch(src)).arrayBuffer()); } catch {} }
      // image déjà affichée mais dont l'adresse n'est plus lisible (adresse « blob: » retirée par le site, ) :
      // on la recopie depuis la page elle-même (possible quand elle vient du même site ou autorise le partage)
      if (!data && !/^https?:/.test(src)) data = await imgBytes(img);
      const vis = { x: Math.max(0, r.left) * dpr, y: Math.max(0, r.top) * dpr, w: (Math.min(innerWidth, r.right) - Math.max(0, r.left)) * dpr, h: (Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) * dpr };
      const res = await ipcRenderer.invoke('scan:image', { src: /^https?:/.test(src) ? src : '', data, page: location.href, veil: typeof veilInfo === 'function' ? veilInfo() : null, fresh: !!scan?.items.get(img)?.fresh, rect: r.top >= 0 && r.bottom <= innerHeight ? vis : (vis.h > 60 ? vis : null), natural: { w: img.naturalWidth, h: img.naturalHeight } });
      const it = scan?.items.get(img);
      if (it) {
        it.blocks = res.blocks; it.w = res.w; it.key = res.key; it.captured = res.captured ? { left: Math.max(0, r.left) - r.left, top: Math.max(0, r.top) - r.top, w: vis.w / dpr } : null;
        it.box?.remove(); it.box = drawScan(it); it.cmp = 100;
        scan.n += res.blocks.length;
        if (res.from) toHost('dryae-scanlang', { from: res.from, to: res.to });
        if ((res.needModel || res.unreadable) && !scan.askedModel) { scan.askedModel = true; toHost('dryae-scanmodel', res.needModel || '?'); }
      }
      status(ptf('{0} bulle(s) traduite(s)', scan?.n || 0));
    } catch (e) {
      // image pas encore lisible (hors de l'écran, protégée) : on réessaie quand elle sera bien visible (3 fois au plus)
      const n = (retry.get(img) || 0) + 1;
      if (scan && /inaccessible/i.test(String(e.message || e)) && n <= 3) { retry.set(img, n); scan.items.delete(img); setTimeout(() => scan && scan.io.observe(img), 1500); }
      else status(ptf('Traduction impossible : {0}', String(e.message || e).replace(/^.*Error: /, '').slice(0, 80)));
    }
    if (scan) { scan.busy = false; scanNext(); }
  }
  // police et mise en forme des bulles : texte noir sur fond blanc, coins arrondis, centré, sans bordure visible
  // 1.6.9 : police « bande dessinée » par défaut (fournie avec DrYAE), sinon standard ou avec empattements
  const FONT = SC.font === 'sans' ? '"Segoe UI","Arial",sans-serif' : SC.font === 'serif' ? 'Georgia,serif' : '"DrYAE Comic","Comic Neue","Comic Sans MS","Segoe UI",sans-serif';
  let fontLoaded = false;
  async function loadFont() {
    if (fontLoaded || SC.font === 'sans' || SC.font === 'serif') return; fontLoaded = true;
    try { const b = await ipcRenderer.invoke('scan:font'); if (b) { const f = new FontFace('DrYAE Comic', b, { weight: '100 900' }); await f.load(); document.fonts.add(f); } } catch {}
  }
  // couleur du texte lisible sur le fond de la bulle
  const inkOn = bg => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(bg || ''); if (!m) return '#111'; return (+m[1] * 0.3 + +m[2] * 0.59 + +m[3] * 0.11) > 140 ? '#111' : '#fff'; };
  function drawScan(it) {
    const box = el('<div style="position:fixed;pointer-events:none;overflow:hidden"></div>', scan.layer);
    it.blocks.forEach((b, i) => {
      const d = document.createElement('div');
      d.title = b.text + '\n' + pt('Clic : original / traduction · clic droit : corriger');
      d.textContent = b.tr || b.text;
      // 1.6.9 : le texte d'origine est effacé avec la couleur de la bulle, seulement là où il est écrit (plus d'ovale géant) ;
      // les mots ne sont jamais coupés (le texte rétrécit), majuscules si la bulle d'origine était en majuscules
      const bg = b.bg || '#fff';
      // gomme : un rectangle de la couleur de la bulle sur le texte d'origine seulement
      const er = document.createElement('div');
      er.style.cssText = `position:absolute;pointer-events:none;background:${bg};border-radius:6px;box-shadow:0 0 2px 2px ${bg}`;
      box.appendChild(er); d._e = er;
      d.style.cssText = `position:absolute;pointer-events:auto;display:flex;align-items:center;justify-content:center;text-align:center;background:${b.bubble ? 'transparent' : bg};color:${inkOn(bg)};border-radius:8px;padding:1px 2px;font:700 12px/1.12 ${FONT};overflow:hidden;cursor:default;word-break:normal;overflow-wrap:normal;hyphens:manual;letter-spacing:0;${b.caps ? 'text-transform:uppercase;' : ''}`;
      d.onclick = () => { d.textContent = d.textContent === b.text ? (b.tr || b.text) : b.text; d._w = 0; };
      d.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); editBubble(it, i, d); };
      d._b = b;
      box.appendChild(d);
    });
    return box;
  }
  // correction d'une bulle : texte lu, traduction, retraduire, ajouter au lexique
  function editBubble(it, i, d) {
    scan.editor?.remove();
    const b = it.blocks[i], r = d.getBoundingClientRect();
    const ed = el(`<div class="card" style="left:${Math.max(8, Math.min(innerWidth - 340, r.left))}px;top:${Math.max(8, Math.min(innerHeight - 300, r.bottom + 6))}px;width:320px;padding:10px;font-size:12.5px;display:grid;gap:6px">
      <b>${esc(pt('Corriger la bulle'))}</b>
      <label style="color:#8f97aa">${esc(pt('Texte lu'))}</label><textarea class="o" rows="2" style="all:unset;background:#0d0f14;border:1px solid #2a3040;border-radius:6px;padding:5px;color:#e7e9ef;white-space:pre-wrap"></textarea>
      <label style="color:#8f97aa">${esc(pt('Traduction'))}</label><textarea class="t" rows="3" style="all:unset;background:#0d0f14;border:1px solid #2a3040;border-radius:6px;padding:5px;color:#e7e9ef;white-space:pre-wrap"></textarea>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn rt">${esc(pt('Retraduire'))}</button><button class="btn gl">${esc(pt('Ajouter au lexique'))}</button><button class="btn kp" title="${esc(pt('Enregistre l\'image dans un dossier de votre PC (rien n\'est envoyé)'))}">${esc(pt('Garder cette image pour l\'améliorer'))}</button><span style="flex:1"></span><button class="btn no">${esc(pt('Annuler'))}</button><button class="btn pri ok">${esc(pt('Enregistrer'))}</button></div>
      <div class="glx" style="display:none;gap:6px;grid-template-columns:1fr 1fr auto"><input class="gs" placeholder="${esc(pt('Mot d\'origine'))}" style="all:unset;background:#0d0f14;border:1px solid #2a3040;border-radius:6px;padding:4px;color:#e7e9ef"><input class="gt" placeholder="${esc(pt('Toujours traduire par'))}" style="all:unset;background:#0d0f14;border:1px solid #2a3040;border-radius:6px;padding:4px;color:#e7e9ef"><button class="btn gok">OK</button></div></div>`);
    scan.editor = ed;
    ed.querySelector('.o').value = b.text; ed.querySelector('.t').value = b.tr || '';
    ed.addEventListener('mousedown', e => e.stopPropagation(), true);
    const close = () => { ed.remove(); if (scan) scan.editor = null; };
    ed.querySelector('.no').onclick = close;
    ed.querySelector('.rt').onclick = async () => { ed.querySelector('.t').value = await ipcRenderer.invoke('scan:retranslate', ed.querySelector('.o').value, null).catch(() => ed.querySelector('.t').value); };
    ed.querySelector('.gl').onclick = () => { const g = ed.querySelector('.glx'); g.style.display = 'grid'; const sel = String(getSelection() || '').trim(); ed.querySelector('.gs').value = sel; ed.querySelector('.gs').focus(); };
    ed.querySelector('.kp').onclick = async () => {
      const r = await ipcRenderer.invoke('scan:keep', it.key || '', it.blocks.map(x => ({ text: x.text, tr: x.tr }))).catch(() => null);
      hint(r && r.ok ? pt('Image gardée dans {0}').replace('{0}', r.dir) : pt('Image non disponible : relisez la page puis réessayez'));
    };
    ed.querySelector('.gok').onclick = async () => {
      const s = ed.querySelector('.gs').value.trim(), t = ed.querySelector('.gt').value.trim(); if (!s || !t) return;
      const list = await ipcRenderer.invoke('scan:glossary').catch(() => []);
      await ipcRenderer.invoke('scan:glossary', [...list.filter(x => x.s !== s), { s, t }]).catch(() => {});
      ed.querySelector('.glx').style.display = 'none'; hint(pt('Ajouté au lexique'));
    };
    ed.querySelector('.ok').onclick = () => {
      b.text = ed.querySelector('.o').value; b.tr = ed.querySelector('.t').value;
      d.textContent = b.tr || b.text; d._w = 0;
      if (it.key) ipcRenderer.invoke('scan:edit', it.key, i, { text: b.text, tr: b.tr }).catch(() => {});
      close();
    };
  }
  function placeScan(img, it) {
    if (!it.box) return;
    if (!img.isConnected) { it.box.remove(); scan.items.delete(img); return; }
    const r = img.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) { it.box.style.display = 'none'; return; }
    it.box.style.display = it.hidden ? 'none' : '';
    const base = it.captured ? { left: r.left + it.captured.left, top: r.top + it.captured.top, w: it.captured.w } : { left: r.left, top: r.top, w: r.width };
    const k = base.w / (it.w || 1);
    // comparer : seule la partie gauche (jusqu'au curseur) montre la traduction
    Object.assign(it.box.style, { left: base.left + 'px', top: base.top + 'px', width: (r.right - base.left) + 'px', height: (r.bottom - base.top) + 'px', clipPath: it.cmp < 100 ? `inset(0 ${100 - it.cmp}% 0 0)` : '' });
    for (const d of it.box.children) {
      const b = d._b; if (!b) continue; const pad = 4;
      if (d._e) Object.assign(d._e.style, { left: (b.x0 * k - 3) + 'px', top: (b.y0 * k - 3) + 'px', width: ((b.x1 - b.x0) * k + 6) + 'px', height: ((b.y1 - b.y0) * k + 6) + 'px' });
      // zone de dessin : le texte d'origine, agrandie à l'intérieur de la bulle quand elle a été repérée
      let X0 = b.x0, Y0 = b.y0, X1 = b.x1, Y1 = b.y1;
      // la zone d'écriture s'agrandit dans la bulle repérée (sans en sortir), un peu en retrait de son bord
      if (b.bubble) {
        const bb = b.bubble, ix = (bb.x1 - bb.x0) * 0.16, iy = (bb.y1 - bb.y0) * 0.16;
        X0 = Math.min(X0, Math.max(bb.x0, bb.x0 + ix)); Y0 = Math.min(Y0, bb.y0 + iy); X1 = Math.max(X1, bb.x1 - ix); Y1 = Math.max(Y1, bb.y1 - iy);
      }
      const w = (X1 - X0) * k + pad * 2, h = (Y1 - Y0) * k + pad * 2;
      if (d._w !== w || d._t !== d.textContent) {
        // bulle verticale étroite (japonais, coréen) : un peu plus large pour un texte traduit horizontal
        const ww = b.vertical && !b.bubble ? Math.max(w, h * 0.55) : w, dx = (ww - w) / 2;
        Object.assign(d.style, { left: (X0 * k - pad - dx) + 'px', top: (Y0 * k - pad) + 'px', width: ww + 'px', height: h + 'px' });
        // taille du texte : la plus grande qui tient dans la bulle sans couper un mot,
        // et jamais plus grande que le texte d'origine (un peu plus pour rester lisible)
        const orig = b.lh ? b.lh * k * (b.vertical ? 0.75 : 1.08) : h * 0.5;
        let lo = 5, hi = Math.max(lo + 0.5, Math.min(24, Math.max(8, orig))), fs = 0;
        d.style.overflowWrap = 'normal';
        const fits = () => d.scrollHeight <= h + 1 && d.scrollWidth <= ww + 1;
        for (let n = 0; n < 8; n++) { const mid = (lo + hi) / 2; d.style.fontSize = mid + 'px'; if (fits()) { fs = mid; lo = mid; } else hi = mid; }
        // même au plus petit, un mot trop long pour la bulle : seulement alors il peut être coupé
        if (!fs) { fs = 5; d.style.fontSize = fs + 'px'; if (!fits()) d.style.overflowWrap = 'anywhere'; }
        d.style.fontSize = fs + 'px';
        d._w = w; d._t = d.textContent;
      }
    }
  }
  // icônes d'action sur l'image survolée
  function drawTools() {
    if (!scan) return;
    const img = scan.hover, it = img && scan.items.get(img);
    if (!it || !it.box || !scIcons) { scan.tools?.remove(); scan.tools = null; return; }
    if (!scan.tools) {
      const b = (a, t, svg) => `<button class="btn" data-a="${a}" title="${esc(pt(t))}" style="padding:5px">${svg}</button>`;
      scan.tools = el(`<div class="card" style="padding:4px;display:flex;gap:3px;border-radius:10px">${b('flip', 'Original / traduction', ICO.tr)}${b('cmp', 'Comparer', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20"/></svg>')}${b('redo', 'Relire cette image', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/></svg>')}${b('copy', 'Copier le texte traduit', ICO.copy)}${b('del', 'Retirer la traduction', ICO.x)}</div>`);
      scan.tools.addEventListener('mousedown', e => e.stopPropagation(), true);
      scan.tools.onclick = e => {
        const a = e.target.closest('[data-a]')?.dataset.a; const img = scan.hover, it = img && scan.items.get(img); if (!a || !it) return;
        if (a === 'flip') it.hidden = !it.hidden;
        else if (a === 'cmp') compare(img, it);
        else if (a === 'redo') { it.box?.remove(); scan.n -= (it.blocks || []).length; scan.items.delete(img); scanQueue(img, true, true); }
        else if (a === 'copy') { try { navigator.clipboard.writeText((it.blocks || []).map(b => b.tr || b.text).join('\n\n')); } catch {} }
        else if (a === 'del') { it.box?.remove(); it.box = null; scan.hover = null; drawTools(); }
      };
    }
    placeTools();
  }
  function placeTools() { if (!scan?.tools || !scan.hover) return; const r = scan.hover.getBoundingClientRect(); scan.tools.style.left = Math.max(4, Math.min(innerWidth - 190, r.right - 186)) + 'px'; scan.tools.style.top = Math.max(4, Math.min(innerHeight - 40, r.top + 6)) + 'px'; }
  function compare(img, it) {
    // glisser la souris sur l'image : à gauche la traduction, à droite l'original ; clic pour terminer
    const r0 = img.getBoundingClientRect();
    const line = el(`<div style="position:fixed;top:${Math.max(0, r0.top)}px;height:${Math.min(innerHeight, r0.bottom) - Math.max(0, r0.top)}px;width:3px;background:#8b5cf6;box-shadow:0 0 8px #000a;pointer-events:none"></div>`);
    const cover = el('<div style="position:fixed;inset:0;pointer-events:auto;cursor:ew-resize"></div>');
    const mv = e => { const r = img.getBoundingClientRect(); it.cmp = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)); line.style.left = e.clientX + 'px'; };
    cover.addEventListener('mousemove', mv);
    cover.addEventListener('click', () => { cover.remove(); line.remove(); it.cmp = 100; });
    mv({ clientX: (r0.left + r0.right) / 2 });
  }
  function scanStop() { if (!scan) return; cancelAnimationFrame(scan.raf); scan.io?.disconnect(); scan.mo?.disconnect(); removeEventListener('mousemove', scan.move, true); scan.layer.remove(); scan.bar.remove(); scan.tools?.remove(); scan.editor?.remove(); scan = null; }
  // capture d'une zone de l'écran : on dessine un rectangle, puis « Traduire la zone »
  let region = null;
  function scanRegion() {
    if (!TOP || region) return;
    const cover = el('<div style="position:fixed;inset:0;pointer-events:auto;cursor:crosshair;background:rgba(0,0,0,.35)"></div>');
    const sel = el('<div style="position:fixed;pointer-events:none;border:2px solid #8b5cf6;background:rgba(139,92,246,.08);box-shadow:0 0 0 9999px rgba(0,0,0,.25);display:none"></div>');
    const help = el(`<div class="card" style="left:50%;top:16px;transform:translateX(-50%);padding:8px 12px;font-size:12.5px">${esc(pt('Dessinez un rectangle autour du texte à traduire. Échap : annuler.'))}</div>`);
    let sx = 0, sy = 0, box = null, bar = null;
    const end = () => { cover.remove(); sel.remove(); help.remove(); bar?.remove(); region = null; removeEventListener('keydown', key, true); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); end(); } else if (e.key === 'Enter' && box) { e.preventDefault(); go(); } };
    addEventListener('keydown', key, true);
    region = { end };
    cover.onmousedown = e => { e.preventDefault(); bar?.remove(); bar = null; sx = e.clientX; sy = e.clientY; box = null; sel.style.display = ''; Object.assign(sel.style, { left: sx + 'px', top: sy + 'px', width: 0, height: 0 }); cover.onmousemove = m => { const x = Math.min(sx, m.clientX), y = Math.min(sy, m.clientY), w = Math.abs(m.clientX - sx), h = Math.abs(m.clientY - sy); box = { x, y, w, h }; Object.assign(sel.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); }; };
    cover.onmouseup = () => {
      cover.onmousemove = null;
      if (!box || box.w < 20 || box.h < 14) { box = null; sel.style.display = 'none'; return; }
      bar = el(`<div class="card" style="padding:6px;display:flex;gap:6px;--a:#8b5cf6"><button class="btn" data-a="x">${esc(pt('Annuler'))}</button><button class="btn pri" data-a="go">${ICO.tr}${esc(pt('Traduire la zone'))}</button></div>`);
      bar.style.left = Math.max(8, Math.min(innerWidth - 230, box.x + box.w - 220)) + 'px'; bar.style.top = Math.min(innerHeight - 46, box.y + box.h + 8) + 'px';
      bar.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'x') end(); else if (a === 'go') go(); };
    };
    async function go() {
      const b = box; end(); if (!b) return;
      let z = 1; try { z = webFrame.getZoomFactor() || 1; } catch {}
      const wait = el(`<div class="card" style="left:${b.x}px;top:${b.y}px;padding:6px 10px;font-size:12px">${esc(pt('Lecture des images…'))}</div>`);
      // la zone est lue à l'écran juste après la disparition du cadre
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        const res = await ipcRenderer.invoke('scan:image', { region: true, rect: { x: b.x * z, y: b.y * z, w: b.w * z, h: b.h * z }, page: location.href, veil: typeof veilInfo === 'function' ? veilInfo() : null });
        wait.remove();
        if (!res.blocks.length) { hint(pt('Aucun texte trouvé dans cette image')); return; }
        scanInit();
        // une « image » virtuelle fixée à la page : la zone suit le défilement
        const anchor = document.createElement('div');
        anchor.style.cssText = `position:absolute;left:${b.x + scrollX}px;top:${b.y + scrollY}px;width:${b.w}px;height:${b.h}px;pointer-events:none`;
        anchor.setAttribute('data-dryae-zone', '');
        document.body.appendChild(anchor);
        const it = { blocks: res.blocks, w: res.w, captured: null, cmp: 100 };
        it.box = drawScan(it); scan.items.set(anchor, it); scan.n += res.blocks.length;
        if (res.from) toHost('dryae-scanlang', { from: res.from, to: res.to });
        status(ptf('{0} bulle(s) traduite(s)', scan.n));
      } catch (e) { wait.remove(); hint(ptf('Traduction impossible : {0}', String(e.message || e).replace(/^.*Error: /, '').slice(0, 80))); }
    }
  }
  // 1.6.9 : le traducteur de scans ne démarre que quand on clique dessus (jamais tout seul)

  // ---------- 1.7.0 : surlignages et notes dans la page ----------
  // Les surlignages sont gardés sur ce PC (par adresse de page) et retrouvés à la prochaine visite :
  // DrYAE recherche le même passage dans le texte de la page (avec quelques lettres avant et après).
  let hlCss = null;
  const hlStyle = () => { if (hlCss) return; try { hlCss = webFrame.insertCSS('mark.dryae-hl{color:inherit!important;border-radius:2px;padding:0 1px;cursor:pointer;-webkit-box-decoration-break:clone;box-decoration-break:clone}mark.dryae-hl[data-c=yellow]{background:#fde68a!important}mark.dryae-hl[data-c=green]{background:#bbf7d0!important}mark.dryae-hl[data-c=blue]{background:#bfdbfe!important}mark.dryae-hl[data-c=pink]{background:#fbcfe8!important}mark.dryae-hl.has-note{border-bottom:2px dotted #b45309!important}'); } catch {} };
  const txtNodes = root => { const out = []; if (!root) return out; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && !n.parentElement.closest('script,style,noscript,textarea,select,dryae-ui') ? 1 : 2 }); let n; while ((n = w.nextNode())) out.push(n); return out; };
  const flat = () => { let s = ''; const pos = []; for (const n of txtNodes(document.body)) { pos.push([n, s.length]); s += n.data; } return { s, pos }; };
  const flatPos = (F, node, off) => { if (node.nodeType !== 3) { const r = document.createRange(); r.setStart(node, off); const n = F.pos.find(([t]) => r.comparePoint(t, 0) >= 0); return n ? n[1] : F.s.length; } const e = F.pos.find(([t]) => t === node); return e ? e[1] + off : -1; };
  const nodeAt = (F, i, end) => { let lo = 0, hi = F.pos.length - 1, k = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (F.pos[m][1] <= i - (end ? 1 : 0)) { k = m; lo = m + 1; } else hi = m - 1; } const [n, b] = F.pos[k] || []; return n ? [n, Math.min(n.data.length, i - b)] : null; };
  function wrapRange(range, m) {
    hlStyle();
    const c = range.commonAncestorContainer; const nodes = txtNodes(c.nodeType === 3 ? c.parentNode : c).filter(n => range.intersectsNode(n));
    const out = [];
    for (const n of nodes) {
      const s = n === range.startContainer ? range.startOffset : 0, e = n === range.endContainer ? range.endOffset : n.data.length;
      if (e <= s || !n.data.slice(s, e).trim()) continue;
      let t = n; if (s > 0) t = t.splitText(s); if (e - s < t.data.length) t.splitText(e - s);
      const mk = document.createElement('mark'); mk.className = 'dryae-hl' + (m.note ? ' has-note' : ''); mk.dataset.id = m.id; mk.dataset.c = m.color || 'yellow'; if (m.note) mk.title = m.note;
      t.parentNode.insertBefore(mk, t); mk.appendChild(t); out.push(mk);
    }
    return out;
  }
  const HL = new Map((CFG.marks || []).map(m => [m.id, m]));
  const marksOf = id => [...document.querySelectorAll('mark.dryae-hl')].filter(x => x.dataset.id === id);
  function hlFind(m) {
    if (marksOf(m.id).length) return true;
    const F = flat(); const t = m.text; if (!t) return false;
    let best = -1, score = -1;
    for (let i = F.s.indexOf(t); i >= 0 && i < F.s.length; i = F.s.indexOf(t, i + 1)) {
      const sc = (m.pre && F.s.slice(Math.max(0, i - m.pre.length), i) === m.pre ? 2 : 0) + (m.post && F.s.slice(i + t.length, i + t.length + m.post.length) === m.post ? 1 : 0);
      if (sc > score) { score = sc; best = i; } if (sc === 3) break;
    }
    if (best < 0) return false;
    const a = nodeAt(F, best), b = nodeAt(F, best + t.length, true); if (!a || !b) return false;
    const r = document.createRange(); try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); } catch { return false; }
    return wrapRange(r, m).length > 0;
  }
  function hlApplyAll() { for (const m of HL.values()) try { hlFind(m); } catch {} }
  if (TOP && HL.size) { const go = () => { hlApplyAll(); setTimeout(hlApplyAll, 1500); setTimeout(hlApplyAll, 5000); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go(); }
  function hlUnwrap(id) { for (const mk of marksOf(id)) { const p = mk.parentNode; while (mk.firstChild) p.insertBefore(mk.firstChild, mk); mk.remove(); p.normalize(); } }
  function hlCreate(color, withNote) {
    const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const r = sel.getRangeAt(0); const text = r.toString(); if (!text.trim()) return;
    const F = flat(); const a = flatPos(F, r.startContainer, r.startOffset), b = a + text.length;
    const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, pre: a >= 0 ? F.s.slice(Math.max(0, a - 30), a) : '', post: a >= 0 ? F.s.slice(b, b + 30) : '', color, note: '' };
    const mks = wrapRange(r, m); sel.removeAllRanges(); if (!mks.length) return;
    HL.set(m.id, m); ipcRenderer.invoke('hl:save', m).catch(() => {});
    if (withNote) hlPop(mks[0], m, true);
  }
  let hlCard = null;
  const hlClose = () => { hlCard?.remove(); hlCard = null; };
  function hlPop(mk, m, focus) {
    hlClose();
    const r = mk.getBoundingClientRect();
    hlCard = el(`<div class="card" style="left:${Math.min(innerWidth - 300, Math.max(8, r.left))}px;top:${Math.min(innerHeight - 210, r.bottom + 6)}px;width:290px;padding:10px">
      <div style="display:flex;gap:6px;margin-bottom:8px">${['yellow', 'green', 'blue', 'pink'].map(c => `<button class="btn" data-c="${c}" title="${c}" style="width:22px;height:22px;padding:0;border-radius:50%;background:${{ yellow: '#fde68a', green: '#bbf7d0', blue: '#bfdbfe', pink: '#fbcfe8' }[c]};${m.color === c ? 'outline:2px solid #fff' : ''}"></button>`).join('')}<span style="flex:1"></span><button class="btn x" title="${esc(pt('Fermer'))}">${ICO.x}</button></div>
      <textarea rows="4" style="width:100%;resize:vertical;background:#0f131b;color:#e9ebf1;border:1px solid #2c3242;border-radius:8px;padding:6px;font:13px 'Segoe UI',sans-serif" placeholder="${esc(pt('Votre note sur ce passage…'))}"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px;justify-content:space-between"><button class="btn del">${esc(pt('Retirer le surlignage'))}</button><button class="btn pri ok">${esc(pt('Enregistrer'))}</button></div></div>`);
    const ta = hlCard.querySelector('textarea'); ta.value = m.note || '';
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') hlClose(); if (e.key === 'Enter' && e.ctrlKey) hlCard.querySelector('.ok').click(); });
    hlCard.querySelector('.x').onclick = hlClose;
    hlCard.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { m.color = b.dataset.c; marksOf(m.id).forEach(x => x.dataset.c = m.color); ipcRenderer.invoke('hl:save', m).catch(() => {}); hlPop(mk, m); });
    hlCard.querySelector('.ok').onclick = () => { m.note = ta.value.trim(); marksOf(m.id).forEach(x => { x.classList.toggle('has-note', !!m.note); x.title = m.note; }); ipcRenderer.invoke('hl:save', m).catch(() => {}); hlClose(); };
    hlCard.querySelector('.del').onclick = () => { hlUnwrap(m.id); HL.delete(m.id); ipcRenderer.invoke('hl:del', m.id).catch(() => {}); hlClose(); };
    if (focus) setTimeout(() => ta.focus(), 30);
  }
  if (TOP) document.addEventListener('click', e => {
    const mk = e.target.closest?.('mark.dryae-hl'); if (!mk) { if (hlCard && !e.composedPath().includes(uiHost)) hlClose(); return; }
    if (mk.closest('a[href]') && !e.altKey) return; // dans un lien : Alt + clic pour la note
    const m = HL.get(mk.dataset.id); if (!m || String(getSelection())) return;
    e.preventDefault(); hlPop(mk, m);
  }, true);

  // ---------- 1.7.0 : vitesse des vidéos (mémorisée par site) ----------
  let vRate = +CFG.speed || 1;
  const setRate = (r, saveIt) => {
    vRate = Math.max(0.25, Math.min(4, +r || 1)); VS.rate = vRate;
    document.querySelectorAll('video,audio').forEach(v => { try { v.playbackRate = vRate; } catch {} });
    if (TOP) { hint('× ' + String(vRate).replace('.', (0.5).toLocaleString(CFG.lang || 'fr').charAt(1))); if (saveIt) ipcRenderer.invoke('speed:pref', vRate).catch(() => {}); }
    toHost('dryae-vstate', { ...VS });
  };
  const keepRate = e => { const v = e.target; if (vRate !== 1 && (v.tagName === 'VIDEO' || v.tagName === 'AUDIO') && v.playbackRate !== vRate) try { v.playbackRate = vRate; } catch {} };
  ['play', 'loadedmetadata'].forEach(ev => document.addEventListener(ev, keepRate, true));
  if (vRate !== 1) { const all = () => document.querySelectorAll('video,audio').forEach(v => keepRate({ target: v })); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all, { once: true }); else all(); }

  // ---------- 1.7.0 : mode présentation (gros curseur, surligneur temporaire avec Alt) ----------
  let present = null;
  function presentMode(on) {
    if (!TOP) return;
    if (!on) { if (present) { try { webFrame.removeInsertedCSS(present.css); } catch {} present.cv.remove(); present.tip?.remove(); removeEventListener('mousemove', present.mv, true); removeEventListener('keydown', present.kd, true); present = null; } return; }
    if (present) return;
    const cur = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><path d="M4 2l14 11-6.5.8L15 21l-3 1.3-3.4-7.3L4 19z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>');
    const css = webFrame.insertCSS(`html,html *{cursor:url("${cur}") 6 3,auto!important}`);
    const cv = el('<canvas style="position:fixed;inset:0;pointer-events:none"></canvas>');
    const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit();
    const pts = []; let raf = 0;
    const draw = () => { const g = cv.getContext('2d'), now = Date.now(); while (pts.length && now - pts[0].t > 2500) pts.shift(); g.clearRect(0, 0, cv.width, cv.height); g.lineCap = g.lineJoin = 'round'; g.lineWidth = 18; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (b.t - a.t > 120) continue; g.strokeStyle = `rgba(250,204,21,${0.55 * (1 - (now - b.t) / 2500)})`; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } raf = pts.length ? requestAnimationFrame(draw) : 0; };
    const mv = e => { if (!e.altKey) return; pts.push({ x: e.clientX, y: e.clientY, t: Date.now() }); if (!raf) raf = requestAnimationFrame(draw); };
    const kd = e => { if (e.key === 'Escape') { e.preventDefault(); toHost('dryae-present', false); } if (e.key === 'Alt') e.preventDefault(); };
    addEventListener('mousemove', mv, true); addEventListener('keydown', kd, true); addEventListener('resize', fit);
    const tip = el(`<div class="card" style="left:50%;bottom:20px;transform:translateX(-50%);padding:8px 14px;font-size:13px">${esc(pt('Mode présentation : maintenez Alt et bougez la souris pour montrer un passage. Échap pour quitter.'))}</div>`);
    setTimeout(() => { tip.style.transition = 'opacity .6s'; tip.style.opacity = 0; setTimeout(() => tip.remove(), 700); }, 4500);
    present = { css, cv, mv, kd, tip };
  }

  // ---------- commandes envoyées par le navigateur ----------
  ipcRenderer.on('dryae-cmd', (_e, c = {}) => {
    switch (c.cmd) {
      case 'translate-page': return trOrig ? restorePage() : translatePage();
      case 'translate-on': return translatePage();
      case 'translate-off': return restorePage();
      case 'translate-selection': return selText() ? translateSelection() : translatePage();
      case 'translate-text': return c.text && translateSelection(c.text, { left: (c.x || innerWidth / 2) - 20, top: (c.y || 60) - 10, bottom: (c.y || 60) + 10 });
      case 'translate-enable': trEnabled = !!c.on; if (!c.on) closeTr(); return;
      case 'lights': return lights ? lightsOff(true) : lightsOn(false);
      case 'hint': return TOP && hint(c.text);
      case 'a11y': return a11yPage(c);
      case 'reader': return TOP && (reader ? readerClose() : readerOpen(c.article));
      case 'speak': return TOP && speak(c.text, c.lang);
      case 'speak-stop': return speakStop();
      case 'lights-sync': return TOP && (c.on ? lightsOn(false, true) : lightsOff(false));
      case 'lights-set': return lightsLook(c);
      case 'eye': return eye(!!c.on, c.level);
      case 'video': return videoAct(c.act);
      case 'night': return night(c.on === undefined ? !nightKey : !!c.on) || ipcRenderer.invoke('lights:night', !!nightKey).catch(() => {});
      case 'picker': return picker(c.x, c.y);
      case 'hl': return TOP && hlCreate(c.color || 'yellow', !!c.note);
      case 'speed': return setRate(c.rate, !!c.save);
      case 'present': return presentMode(!!c.on);
      case 'scan': return scan ? scanStop() : scanStart();
      case 'scan-auto': return scan || scanStart();
      case 'scan-one': return scanStart(c.src);
      case 'scan-region': return scanRegion();
      case 'scan-icons': scIcons = !!c.on; return drawTools();
      case 'hides': CFG.hides = c.list || []; return applyHides(CFG.hides);
      case 'state': return toHost('dryae-state', { translated: !!trOrig, lights: !!lights, night: !!nightKey, scan: !!scan });
    }
  });
}
