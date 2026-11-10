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
  addEventListener('mouseup', e => { if (e.button === 3 || e.button === 4) { e.preventDefault(); toHost('dryae-nav', e.button === 3 ? -1 : 1); } }, true);
} catch {}

// ---------- 2. pages internes ----------
if (CFG.internal) {
  if (TOP && location.protocol === 'dryae:') {
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
      uiRoot.innerHTML = `<style>${UI_CSS}</style>`;
    }
    if (!uiHost.isConnected) (document.documentElement || document).appendChild(uiHost);
    return uiRoot;
  };
  const el = (html, parent) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const n = d.firstElementChild; (parent || ui()).appendChild(n); return n; };
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
      root.innerHTML = `<style>
        .b{pointer-events:auto;display:flex;align-items:center;gap:0;font:600 13px "Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-radius:10px;box-shadow:0 6px 24px #0007;overflow:hidden;opacity:.94;transition:opacity .2s,transform .2s;user-select:none}
        .b:hover{opacity:1;transform:translateY(-1px)}
        .go{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer}
        .x{padding:8px 9px;cursor:pointer;border-left:1px solid #ffffff33;opacity:.8}.x:hover{opacity:1;background:#0002}
        svg{width:16px;height:16px}
      </style><div class="b"><div class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>${esc(pt('Télécharger cette vidéo'))}</div><div class="x" title="${esc(pt('Masquer'))}">✕</div></div>`;
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
      dd.querySelector('.lst').innerHTML = items.map((it, i) => `<div class="i" data-i="${i}"><div class="k">${it.icon}</div><div class="t"><b>${esc(it.title)}</b><span>${esc(it.sub || '')}</span></div></div>`).join('');
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
    function fillLogin(pw, c) { const u = userFieldFor(pw); if (u && c.username) setVal(u, c.username); setVal(pw, c.password); ipcRenderer.invoke('pw:used', c.username).catch(() => {}); }
    async function scanPw() {
      const pws = [...document.querySelectorAll('input[type=password]')].filter(visible);
      if (!pws.length) return;
      const list = await getCreds();
      if (!list.length) return;
      for (const pw of pws) {
        if (filled.has(pw)) continue;
        filled.add(pw);
        if (list.length === 1 && !pw.value && !isNewPw(pw)) fillLogin(pw, list[0]);
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
          list.forEach(c => items.push({ icon: '🔑', title: c.username || pt('(sans identifiant)'), sub: '•'.repeat(Math.min(12, c.password.length)) + '  ' + pt('— mot de passe enregistré'), run: () => fillLogin(pw, c) }));
        }
        if (items.length && document.activeElement === target) return showDrop(target, items);
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
  let bubble = null, trBtn = null;
  const closeTr = () => { bubble?.remove(); bubble = null; trBtn?.remove(); trBtn = null; };
  const selText = () => { const s = getSelection(); return s && !s.isCollapsed ? String(s).trim() : ''; };
  const inField = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };
  const selRect = () => { try { const r = getSelection().getRangeAt(0).getBoundingClientRect(); return r.width || r.height ? r : null; } catch { return null; } };
  async function translateSelection(text, rect) {
    text = text || selText(); rect = rect || selRect() || { left: innerWidth / 2 - 160, bottom: 80, top: 60 };
    if (!text) return;
    closeTr();
    bubble = el(`<div class="card" style="width:min(380px,92vw);padding:12px 14px 10px;--a:#8b5cf6"><div class="hd" style="display:flex;align-items:center;gap:6px;color:#8f97aa;font-size:11px;margin-bottom:6px">${ICO.tr}<span class="from" style="flex:1">${esc(pt('Traduction…'))}</span><button class="btn x" style="padding:3px;background:none">${ICO.x}</button></div><div class="out" style="white-space:pre-wrap;max-height:42vh;overflow:auto;font-size:14px"></div><div class="ft" style="display:flex;gap:6px;margin-top:10px"><button class="btn cp">${ICO.copy}${esc(pt('Copier'))}</button><button class="btn sp">${ICO.spk}${esc(pt('Écouter'))}</button></div></div>`);
    const place = () => { const w = bubble.offsetWidth, h = bubble.offsetHeight; bubble.style.left = Math.max(8, Math.min(innerWidth - w - 8, rect.left)) + 'px'; bubble.style.top = (rect.bottom + 8 + h < innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - h - 8)) + 'px'; };
    place();
    bubble.querySelector('.x').onclick = closeTr;
    let out = '', to = 'fr';
    bubble.querySelector('.cp').onclick = () => { try { navigator.clipboard.writeText(out); } catch {} };
    bubble.querySelector('.sp').onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(out); u.lang = to; speechSynthesis.speak(u); } catch {} };
    try {
      const r = await ipcRenderer.invoke('tr:text', [text.slice(0, 5000)]);
      out = r.texts[0] || ''; to = r.to;
      if (!bubble) return;
      bubble.querySelector('.out').textContent = out;
      bubble.querySelector('.from').textContent = ptf('Traduit de {0}', langName(r.from)) + ' → ' + langName(r.to);
    } catch (e) { if (bubble) bubble.querySelector('.out').textContent = ptf('Traduction impossible : {0}', String(e.message || e).replace(/^.*Error: /, '')); }
    place();
  }
  const langName = c => { try { return new Intl.DisplayNames([CFG.lang || 'fr'], { type: 'language' }).of(c || 'und') || c; } catch { return c || '?'; } };
  if (CFG.translate) {
    document.addEventListener('mouseup', e => {
      if (e.button !== 0 || e.composedPath().includes(uiHost)) return;
      setTimeout(() => {
        const t = selText();
        if (!t || inField() || t.length > 5000) { if (trBtn && !t) { trBtn.remove(); trBtn = null; } return; }
        const mode = CFG.translate.selection;
        if (mode === 'off') return;
        const r = selRect(); if (!r) return;
        if (mode === 'auto') return translateSelection(t, r);
        trBtn?.remove();
        trBtn = el(`<button class="card" title="${esc(pt('Traduire'))}" style="all:unset;position:fixed;pointer-events:auto;cursor:pointer;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#8b5cf6;color:#fff;box-shadow:0 6px 18px #0006">${ICO.tr}</button>`);
        trBtn.style.left = Math.min(innerWidth - 40, e.clientX + 8) + 'px'; trBtn.style.top = Math.min(innerHeight - 40, e.clientY + 10) + 'px';
        trBtn.onmousedown = ev => { ev.preventDefault(); ev.stopPropagation(); };
        trBtn.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); translateSelection(t, r); };
      }, 10);
    }, true);
    document.addEventListener('mousedown', e => { if (!e.composedPath().includes(uiHost)) { if (bubble) closeTr(); else if (trBtn) { trBtn.remove(); trBtn = null; } } }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape' && (bubble || trBtn)) closeTr(); }, true);
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
    if (trBusy) return;
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

  // ---------- 5c. lumières tamisées et mode nuit ----------
  let lights = null, autoLit = false;
  const L = CFG.lights || {};
  function lightsTarget() {
    const v = pickVideo(200); if (v) return v;
    let best = null, area = 0;
    for (const f of document.querySelectorAll('iframe')) { const r = f.getBoundingClientRect(); const a = r.width * r.height; if (r.width >= 300 && r.height >= 160 && /youtube|vimeo|dailymotion|player|embed|video|stream|twitch/i.test(f.src || '') && a > area) { area = a; best = f; } }
    return best;
  }
  function lightsOn(auto) {
    if (lights) return;
    const t = lightsTarget();
    const op = Math.max(0.3, Math.min(0.97, (+L.opacity || 85) / 100));
    const R = ui();
    const col = /^#[0-9a-f]{6}$/i.test(L.color || '') ? L.color : '#000000';
    const panes = [0, 1, 2, 3].map(() => el(`<div style="position:fixed;pointer-events:auto;background:${col};opacity:0;transition:opacity .35s;cursor:pointer"></div>`));
    const tip = el(`<div class="card" style="left:50%;top:14px;transform:translateX(-50%);padding:6px 12px;font-size:12px;opacity:.85">${esc(pt('Cliquez à côté pour rallumer'))}</div>`);
    setTimeout(() => tip.remove(), 2200);
    let raf = 0;
    const lay = () => {
      const r = t && t.isConnected ? t.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2 };
      const W = innerWidth, H = innerHeight, l = Math.max(0, r.left), rt = Math.min(W, r.right), tp = Math.max(0, r.top), bt = Math.min(H, r.bottom);
      const set = (p, x, y, w, h) => Object.assign(p.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
      set(panes[0], 0, 0, W, tp); set(panes[1], 0, bt, W, H - bt); set(panes[2], 0, tp, l, bt - tp); set(panes[3], rt, tp, W - rt, bt - tp);
      if (document.fullscreenElement) panes.forEach(p => { p.style.display = 'none'; }); else panes.forEach(p => { p.style.display = ''; });
      raf = requestAnimationFrame(lay);
    };
    lay();
    requestAnimationFrame(() => panes.forEach(p => { p.style.opacity = op; }));
    panes.forEach(p => { p.onclick = e => { e.preventDefault(); e.stopPropagation(); lightsOff(); }; });
    lights = { off: () => { cancelAnimationFrame(raf); panes.forEach(p => { p.style.opacity = 0; setTimeout(() => p.remove(), 350); }); tip.remove(); } };
    autoLit = !!auto;
    toHost('dryae-lights', true);
  }
  function lightsOff() { if (!lights) return; lights.off(); lights = null; autoLit = false; toHost('dryae-lights', false); }
  if (CFG.lights) {
    addEventListener('keydown', e => { if (e.key === 'Escape' && lights) lightsOff(); }, true);
    if (L.auto) {
      document.addEventListener('play', e => { const v = e.target; if (v.tagName === 'VIDEO' && !lights) { const r = v.getBoundingClientRect(); if (r.width >= 320 && r.height >= 180) setTimeout(() => lightsOn(true), 300); } }, true);
      document.addEventListener('pause', e => { if (e.target.tagName === 'VIDEO' && autoLit) lightsOff(); }, true);
      document.addEventListener('ended', e => { if (e.target.tagName === 'VIDEO' && autoLit) lightsOff(); }, true);
    }
  }
  let nightKey = null;
  const NIGHT = 'html{filter:invert(.9) hue-rotate(180deg)!important;background:#fff!important}img,video,picture,canvas,iframe,embed,object,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
  const night = on => { try { if (on && !nightKey) nightKey = webFrame.insertCSS(NIGHT); else if (!on && nightKey) { webFrame.removeInsertedCSS(nightKey); nightKey = null; } } catch {} toHost('dryae-night', !!nightKey); };
  if (CFG.lights && L.night) night(true);

  // ---------- 5d. traducteur de scans ----------
  let scan = null;
  function scanStart(onlySrc) {
    if (!scan) {
      const layer = el('<div style="position:fixed;inset:0;pointer-events:none"></div>');
      const bar = el(`<div class="card" style="right:16px;bottom:16px;padding:8px 10px;display:flex;align-items:center;gap:8px;font-size:12px"><span style="color:#c4b5fd;display:flex">${ICO.tr}</span><b>${esc(pt('Traducteur de scans'))}</b><span class="st" style="color:#8f97aa"></span><button class="btn tg">${esc(pt('Afficher l\'original'))}</button><button class="btn st2">${esc(pt('Arrêter'))}</button></div>`);
      scan = { layer, bar, items: new Map(), queue: [], busy: false, shown: true, n: 0, io: null };
      bar.querySelector('.tg').onclick = () => { scan.shown = !scan.shown; layer.style.display = scan.shown ? '' : 'none'; bar.querySelector('.tg').textContent = pt(scan.shown ? 'Afficher l\'original' : 'Traduire'); };
      bar.querySelector('.st2').onclick = scanStop;
      const loop = () => { if (!scan) return; for (const [img, it] of scan.items) placeScan(img, it); scan.raf = requestAnimationFrame(loop); };
      loop();
      scan.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { scanQueue(e.target); scan.io.unobserve(e.target); } }), { rootMargin: '200px' });
    }
    const imgs = [...document.querySelectorAll('img')].filter(i => (onlySrc ? (i.currentSrc || i.src) === onlySrc : i.naturalWidth >= 250 && i.naturalHeight >= 250));
    if (!imgs.length && !onlySrc) { status(pt('Aucun texte trouvé dans cette image')); return; }
    for (const i of imgs) { if (onlySrc) scanQueue(i); else scan.io.observe(i); }
  }
  const status = s => { if (scan) scan.bar.querySelector('.st').textContent = s; };
  function scanQueue(img) { if (!scan || scan.items.has(img)) return; scan.items.set(img, { blocks: null, box: null }); scan.queue.push(img); scanNext(); }
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
      // la partie visible sert de secours si l'image ne peut pas être lue directement
      const vis = { x: Math.max(0, r.left) * dpr, y: Math.max(0, r.top) * dpr, w: (Math.min(innerWidth, r.right) - Math.max(0, r.left)) * dpr, h: (Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) * dpr };
      const res = await ipcRenderer.invoke('scan:image', { src: /^https?:/.test(src) ? src : '', data, page: location.href, rect: r.top >= 0 && r.bottom <= innerHeight ? vis : (vis.h > 60 ? vis : null), natural: { w: img.naturalWidth, h: img.naturalHeight } });
      const it = scan?.items.get(img);
      if (it) {
        // coordonnées : image entière, ou partie visible au moment de la lecture
        it.blocks = res.blocks; it.w = res.w; it.captured = res.captured ? { left: Math.max(0, r.left) - r.left, top: Math.max(0, r.top) - r.top, w: vis.w / dpr } : null;
        it.box = drawScan(it);
        scan.n += res.blocks.length;
      }
      status(ptf('{0} bulle(s) traduite(s)', scan?.n || 0));
    } catch (e) { status(ptf('Traduction impossible : {0}', String(e.message || e).replace(/^.*Error: /, '').slice(0, 80))); }
    if (scan) { scan.busy = false; scanNext(); }
  }
  function drawScan(it) {
    const box = el('<div style="position:fixed;pointer-events:none"></div>', scan.layer);
    for (const b of it.blocks) {
      const d = document.createElement('div');
      d.title = b.text;
      d.textContent = b.tr || b.text;
      d.style.cssText = 'position:absolute;pointer-events:auto;display:flex;align-items:center;justify-content:center;text-align:center;background:#fff;color:#111;border-radius:10px;padding:2px 4px;font:700 12px/1.15 "Segoe UI","Comic Sans MS",sans-serif;overflow:hidden;box-shadow:0 0 0 2px #fff;cursor:default;word-break:break-word';
      d.onclick = () => { d.textContent = d.textContent === b.text ? (b.tr || b.text) : b.text; };
      d._b = b;
      box.appendChild(d);
    }
    return box;
  }
  function placeScan(img, it) {
    if (!it.box) return;
    if (!img.isConnected) { it.box.remove(); scan.items.delete(img); return; }
    const r = img.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) { it.box.style.display = 'none'; return; }
    it.box.style.display = '';
    const base = it.captured ? { left: r.left + it.captured.left, top: r.top + it.captured.top, w: it.captured.w } : { left: r.left, top: r.top, w: r.width };
    const k = base.w / (it.w || 1);
    Object.assign(it.box.style, { left: base.left + 'px', top: base.top + 'px' });
    for (const d of it.box.children) {
      const b = d._b; const pad = 6;
      const w = (b.x1 - b.x0) * k + pad * 2, h = (b.y1 - b.y0) * k + pad * 2;
      if (d._w !== w) {
        Object.assign(d.style, { left: (b.x0 * k - pad) + 'px', top: (b.y0 * k - pad) + 'px', width: w + 'px', minHeight: h + 'px' });
        // taille du texte ajustée à la bulle
        let fs = Math.max(9, Math.min(22, (b.y1 - b.y0) * k / Math.max(1, Math.round(b.text.length / 18)) * 0.9));
        d.style.fontSize = fs + 'px';
        for (let n = 0; n < 8 && d.scrollHeight > h + 4 && fs > 8; n++) { fs -= 1; d.style.fontSize = fs + 'px'; }
        d._w = w;
      }
    }
  }
  function scanStop() { if (!scan) return; cancelAnimationFrame(scan.raf); scan.io?.disconnect(); scan.layer.remove(); scan.bar.remove(); scan = null; }

  // ---------- commandes envoyées par le navigateur ----------
  ipcRenderer.on('dryae-cmd', (_e, c = {}) => {
    switch (c.cmd) {
      case 'translate-page': return trOrig ? restorePage() : translatePage();
      case 'translate-on': return translatePage();
      case 'translate-off': return restorePage();
      case 'translate-selection': return selText() ? translateSelection() : translatePage();
      case 'lights': return lights ? lightsOff() : lightsOn(false);
      case 'night': return night(!nightKey) || ipcRenderer.invoke('lights:night', !!nightKey).catch(() => {});
      case 'picker': return picker(c.x, c.y);
      case 'scan': return scan ? scanStop() : scanStart();
      case 'scan-one': return scanStart(c.src);
      case 'hides': CFG.hides = c.list || []; return applyHides(CFG.hides);
      case 'state': return toHost('dryae-state', { translated: !!trOrig, lights: !!lights, night: !!nightKey, scan: !!scan });
    }
  });
}
