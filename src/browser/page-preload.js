// Script chargé dans chaque page du navigateur DrYAE (toutes les frames).
// 1) Boutons latéraux de la souris (précédent / suivant).
// 2) Affiche un bouton « Télécharger cette vidéo » sur les lecteurs vidéo.
const { ipcRenderer, webFrame } = require('electron');
let PT = {}; try { PT = ipcRenderer.sendSync('i18n:page') || {}; } catch {}
const pt = s => PT[s] || s;

// ---------- 1. souris : boutons latéraux précédent / suivant ----------
// (rien n'est modifié dans la page : les vérifications anti-robot voient un Chromium normal)
try {
  addEventListener('mouseup', e => { if (e.button === 3 || e.button === 4) { e.preventDefault(); try { ipcRenderer.sendToHost('dryae-nav', e.button === 3 ? -1 : 1); } catch {} } }, true);
} catch {}

// ---------- 2. bouton sur les vidéos (page principale uniquement) ----------
if (window.top === window) {
  let host = null, btn = null, target = null, hiddenFor = '';
  const make = () => {
    host = document.createElement('dryae-video-button');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      .b{pointer-events:auto;display:flex;align-items:center;gap:0;font:600 13px "Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-radius:10px;box-shadow:0 6px 24px #0007;overflow:hidden;opacity:.94;transition:opacity .2s,transform .2s;user-select:none}
      .b:hover{opacity:1;transform:translateY(-1px)}
      .go{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer}
      .x{padding:8px 9px;cursor:pointer;border-left:1px solid #ffffff33;opacity:.8}.x:hover{opacity:1;background:#0002}
      svg{width:16px;height:16px}
    </style><div class="b"><div class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>${pt('Télécharger cette vidéo')}</div><div class="x" title="${pt('Masquer')}">✕</div></div>`;
    btn = root.querySelector('.b');
    root.querySelector('.go').addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const v = target;
      ipcRenderer.sendToHost('dryae-video', { page: location.href, src: v && /^https?:/.test(v.currentSrc || '') ? v.currentSrc : '', title: document.title, duration: v && isFinite(v.duration) ? v.duration : 0 });
    }, true);
    root.querySelector('.x').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); hiddenFor = location.href; host.style.display = 'none'; }, true);
    (document.documentElement || document).appendChild(host);
  };
  const pick = () => {
    let best = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const visW = Math.min(r.right, innerWidth) - Math.max(r.left, 0), visH = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (r.width < 240 || r.height < 135 || visW < 200 || visH < 100) continue;
      if (getComputedStyle(v).visibility === 'hidden') continue;
      const a = visW * visH;
      if (a > area) { area = a; best = v; }
    }
    return best;
  };
  const place = () => {
    if (!document.documentElement) return;
    if (hiddenFor && hiddenFor !== location.href) hiddenFor = '';
    target = document.fullscreenElement ? null : pick();
    if (!target || hiddenFor) { if (host) host.style.display = 'none'; return; }
    if (!host || !host.isConnected) make();
    const r = target.getBoundingClientRect();
    host.style.display = 'block';
    const w = btn.offsetWidth || 220;
    host.style.transform = `translate(${Math.max(4, Math.min(innerWidth - w - 8, r.right - w - 12))}px, ${Math.max(4, r.top + 12)}px)`;
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  addEventListener('scroll', schedule, true);
  addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', schedule);
  setInterval(place, 1200);
}

// ---------- 3. mots de passe et saisie automatique ----------
(() => {
  const isPw = el => el && el.tagName === 'INPUT' && el.type === 'password';
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const TEXTY = /^(text|email|tel|search|url|)$/i;
  const setVal = (el, v) => {
    const proto = Object.getPrototypeOf(el);
    const d = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  function userFieldFor(pw) {
    const scope = pw.form || document;
    const ins = [...scope.querySelectorAll('input')].filter(i => !isPw(i) && TEXTY.test(i.type) && visible(i));
    const ac = ins.find(i => /username|email/i.test(i.autocomplete || ''));
    if (ac) return ac;
    const before = ins.filter(i => i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before[before.length - 1] || ins[0] || null;
  }

  // petite liste déroulante (shadow DOM fermé, invisible pour la page)
  let dd = null, ddRoot = null, ddFor = null;
  function showDrop(anchor, items) {
    if (!dd) {
      dd = document.createElement('dryae-autofill');
      dd.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0';
      ddRoot = dd.attachShadow({ mode: 'closed' });
      (document.documentElement || document).appendChild(dd);
    }
    if (!dd.isConnected) (document.documentElement || document).appendChild(dd);
    const r = anchor.getBoundingClientRect();
    ddFor = anchor;
    ddRoot.innerHTML = `<style>.m{font:13px "Segoe UI",system-ui,sans-serif;background:#191d26;color:#e7e9ef;border:1px solid #2e3445;border-radius:10px;box-shadow:0 12px 32px #0008;padding:4px;min-width:${Math.max(220, r.width)}px;max-width:420px}
      .i{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:7px;cursor:pointer}.i:hover{background:#8b5cf633}
      .k{width:22px;height:22px;border-radius:6px;background:#8b5cf6;display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;flex:none}
      .t{min-width:0}.t b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.t span{color:#8a91a3;font-size:11px}
      .f{color:#5b6274;font-size:10px;padding:4px 10px 2px}</style>
      <div class="m">${items.map((it, i) => `<div class="i" data-i="${i}"><div class="k">${it.icon}</div><div class="t"><b>${esc(it.title)}</b><span>${esc(it.sub || '')}</span></div></div>`).join('')}<div class="f">DrYAE</div></div>`;
    dd.style.transform = `translate(${Math.max(4, Math.min(r.left, innerWidth - 430))}px, ${Math.min(r.bottom + 4, innerHeight - 60)}px)`;
    dd.style.display = 'block';
    ddRoot.querySelector('.m').onmousedown = e => {
      const el = e.composedPath().find(x => x.dataset && x.dataset.i !== undefined);
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      hideDrop(); items[+el.dataset.i].run();
    };
  }
  function hideDrop() { if (dd) dd.style.display = 'none'; ddFor = null; }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.addEventListener('focusout', () => setTimeout(() => { if (ddFor && document.activeElement !== ddFor) hideDrop(); }, 150), true);
  addEventListener('scroll', hideDrop, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideDrop(); }, true);

  // --- mots de passe enregistrés ---
  let creds = null;
  const getCreds = () => (creds = creds || ipcRenderer.invoke('pw:get').catch(() => []));
  const filled = new WeakSet();
  function fillLogin(pw, c) { const u = userFieldFor(pw); if (u && c.username) setVal(u, c.username); setVal(pw, c.password); }
  async function scanPw() {
    const pws = [...document.querySelectorAll('input[type=password]')].filter(visible);
    if (!pws.length) return;
    const list = await getCreds();
    if (!list.length) return;
    for (const pw of pws) {
      if (filled.has(pw)) continue;
      filled.add(pw);
      if (list.length === 1 && !pw.value && !/new-password/.test(pw.autocomplete || '')) fillLogin(pw, list[0]);
    }
  }
  document.addEventListener('focusin', async e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    // identifiants
    const pw = isPw(el) ? el : (el.form || document).querySelector('input[type=password]');
    if (pw && (isPw(el) || userFieldFor(pw) === el)) {
      const list = await getCreds();
      if (list.length && document.activeElement === el) {
        return showDrop(el, list.map(c => ({ icon: '🔑', title: c.username || pt('(sans identifiant)'), sub: '•'.repeat(Math.min(12, c.password.length)) + '  ' + pt('— mot de passe enregistré'), run: () => fillLogin(pw, c) })));
      }
      return;
    }
    // profil de saisie automatique
    const kind = fieldKind(el);
    if (!kind || el.value) return;
    const prof = await profile();
    if (!prof || !prof[kind] || document.activeElement !== el) return;
    const who = [prof.givenName, prof.familyName].filter(Boolean).join(' ') || prof.fullName || prof.email || pt('mon profil');
    showDrop(el, [{ icon: '👤', title: pt('Remplir avec mon profil'), sub: [who, prof.email].filter(Boolean).join(' · '), run: () => fillProfile(el.form || document, prof) }]);
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

  // --- saisie automatique (profil) ---
  let prof = null;
  const profile = () => (prof = prof || ipcRenderer.invoke('af:get').catch(() => null));
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
  function fieldKind(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || isPw(el)) return null;
    if (el instanceof HTMLInputElement && !TEXTY.test(el.type)) return null;
    const ac = (el.autocomplete || '').toLowerCase().split(/\s+/).pop();
    for (const [k, , acs] of MAP) if (acs.includes(ac)) return k;
    if (el.type === 'email') return 'email';
    if (el.type === 'tel') return 'tel';
    const lab = el.labels && el.labels[0] ? el.labels[0].textContent : '';
    const parts = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), lab].filter(Boolean).map(x => String(x).trim());
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

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(scanPw, 400); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kick); else kick();
  new MutationObserver(kick).observe(document, { childList: true, subtree: true });
})();
