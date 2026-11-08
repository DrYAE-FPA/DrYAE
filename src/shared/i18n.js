// DrYAE — traduction de l'interface (processus principal et fenêtres).
// Les textes du code sont en français ; ce module les remplace par la langue choisie.
// Les clés peuvent contenir {0}, {1}… (parties variables), traduites à leur tour.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.I18N_FACTORY = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LANGS = {
    en: { name: 'English', locale: 'en-US' },
    es: { name: 'Español', locale: 'es-ES' },
    fr: { name: 'Français', locale: 'fr-FR' },
    ar: { name: 'العربية', locale: 'ar', rtl: true },
    pt: { name: 'Português', locale: 'pt-PT' },
    ru: { name: 'Русский', locale: 'ru-RU' },
  };
  const UNITS = {
    en: { o: 'B', Ko: 'KB', Mo: 'MB', Go: 'GB', To: 'TB' },
    es: { o: 'B', Ko: 'KB', Mo: 'MB', Go: 'GB', To: 'TB' },
    pt: { o: 'B', Ko: 'KB', Mo: 'MB', Go: 'GB', To: 'TB' },
    ru: { o: 'Б', Ko: 'КБ', Mo: 'МБ', Go: 'ГБ', To: 'ТБ', ps: '/с' },
    ar: { o: 'بايت', Ko: 'ك.ب', Mo: 'م.ب', Go: 'ج.ب', To: 'ت.ب', ps: '/ث' },
  };
  // noms des touches dans les raccourcis clavier (« Ctrl + Maj + Suppr »)
  const KEYS = {
    en: { Maj: 'Shift', Suppr: 'Del', 'Échap': 'Esc', 'Entrée': 'Enter', Espace: 'Space', 'Début': 'Home', Fin: 'End', ou: 'or', clic: 'click' },
    es: { Maj: 'Mayús', Suppr: 'Supr', 'Échap': 'Esc', 'Entrée': 'Intro', Espace: 'Espacio', 'Début': 'Inicio', Fin: 'Fin', ou: 'o', clic: 'clic' },
    pt: { Maj: 'Shift', Suppr: 'Del', 'Échap': 'Esc', 'Entrée': 'Enter', Espace: 'Espaço', 'Début': 'Home', Fin: 'End', ou: 'ou', clic: 'clique' },
    ru: { Maj: 'Shift', Suppr: 'Del', 'Échap': 'Esc', 'Entrée': 'Enter', Espace: 'Пробел', 'Début': 'Home', Fin: 'End', ou: 'или', clic: 'щелчок' },
    ar: { Maj: 'Shift', Suppr: 'Del', 'Échap': 'Esc', 'Entrée': 'Enter', Espace: 'Space', 'Début': 'Home', Fin: 'End', ou: 'أو', clic: 'نقرة' },
  };
  // code de langue Windows (installateur) -> langue DrYAE
  const LCID = { 1033: 'en', 2057: 'en', 3082: 'es', 1034: 'es', 2058: 'es', 1036: 'fr', 3084: 'fr', 2060: 'fr', 1025: 'ar', 2049: 'ar', 3073: 'ar', 2070: 'pt', 1046: 'pt', 1049: 'ru' };
  function normalize(l) { l = String(l || '').toLowerCase().slice(0, 2); return LANGS[l] ? l : 'en'; }
  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

  function create(lang, dicts) {
    lang = normalize(lang);
    const dict = (dicts && dicts[lang]) || {};
    const pats = [];
    for (const k of Object.keys(dict)) {
      if (!/\{\d+\}/.test(k)) continue;
      const order = [];
      const re = new RegExp('^' + esc(k).replace(/\\?\{(\d+)\\?\}/g, (_m, n) => { order.push(+n); return '([\\s\\S]+?)'; }) + '$');
      pats.push({ re, order, val: dict[k], lit: k.replace(/\{\d+\}/g, '').length, pre: /^\{\d+\}/.test(k) ? 0 : 1 });
    }
    pats.sort((a, b) => b.pre - a.pre || b.lit - a.lit); // un texte fixe au début est l'ancrage le plus sûr
    const U = UNITS[lang], KW = KEYS[lang];
    const cache = new Map();
    const units = s => (U ? s.replace(/(\d)(\s?)(Ko|Mo|Go|To|o)(\/s)?(?![A-Za-zÀ-ÿ])/g, (_m, d, sp, u, ps) => d + sp + U[u] + (ps ? (U.ps || ps) : '')) : s);
    function core(s) {
      if (dict[s] !== undefined) return dict[s];
      if (/\s\s|\n/.test(s)) { const c = s.replace(/\s+/g, ' '); if (dict[c] !== undefined) return dict[c]; s = c; }
      for (const p of pats) {
        const m = s.match(p.re);
        if (m) return p.val.replace(/\{(\d+)\}/g, (_x, n) => { const i = p.order.indexOf(+n); return i >= 0 ? T(m[i + 1]) : ''; });
      }
      if (KW && s.length < 90 && /^(?:Ctrl|Alt|Maj|Suppr|Échap|Entrée|Espace|Début|Fin|F\d|[↑↓←→])/.test(s) && /^[\w\sÀ-ÿ+\-−/,.…↑↓←→:]+$/.test(s))
        return s.replace(/(Maj|Suppr|Échap|Entrée|Espace|Début|Fin|ou|clic)(?![\wÀ-ÿ])/g, w => KW[w] || w);
      return units(s);
    }
    function T(s) {
      if (lang === 'fr' || s == null) return s;
      s = String(s);
      const c = cache.get(s);
      if (c !== undefined) return c;
      const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const out = m[2] ? m[1] + core(m[2]) + m[3] : s;
      if (cache.size > 20000) cache.clear();
      cache.set(s, out);
      return out;
    }
    return { lang, T, locale: LANGS[lang].locale, rtl: !!LANGS[lang].rtl, LANGS };
  }

  // traduction automatique d'une page (fenêtres de DrYAE)
  function installDom(i18n) {
    if (typeof document === 'undefined' || i18n.lang === 'fr') return;
    const T = i18n.T;
    document.documentElement.lang = i18n.lang;
    if (i18n.rtl) document.documentElement.dir = 'rtl';
    const SKIP = 'script,style,textarea,[data-notr],.notr,.name,.mono,.tab .t,#dName,#qsTitle,#aYtTitle,#tKv dd,.frow .n,.hrow .t b,.kv dd a,code';
    const done = new WeakMap();
    const ATTRS = ['placeholder', 'title', 'aria-label'];
    const txt = n => {
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) return;
      const v = n.nodeValue;
      if (!v || !/[A-Za-zÀ-ÿ]/.test(v) || done.get(n) === v) return;
      const t = T(v);
      done.set(n, t);
      if (t !== v) n.nodeValue = t;
    };
    const el = e => {
      if (e.closest && e.closest('[data-notr]')) return;
      for (const a of ATTRS) { const v = e.getAttribute && e.getAttribute(a); if (v && /[A-Za-zÀ-ÿ]/.test(v)) { const t = T(v); if (t !== v) e.setAttribute(a, t); } }
    };
    const walk = node => {
      if (node.nodeType === 3) return txt(node);
      if (node.nodeType !== 1) return;
      el(node);
      const w = document.createTreeWalker(node, 5);
      let n;
      while ((n = w.nextNode())) { if (n.nodeType === 3) txt(n); else el(n); }
    };
    const start = () => {
      walk(document.body || document.documentElement);
      if (document.title) document.title = T(document.title);
      new MutationObserver(ms => {
        for (const m of ms) {
          if (m.type === 'characterData') txt(m.target);
          else if (m.type === 'attributes') el(m.target);
          else m.addedNodes.forEach(walk);
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      const tEl = document.querySelector('title');
      if (tEl) new MutationObserver(() => { const t = T(document.title); if (t !== document.title) document.title = t; }).observe(tEl, { childList: true, characterData: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    const c = window.confirm.bind(window);
    window.confirm = m => c(T(m));
  }

  return { LANGS, LCID, normalize, create, installDom };
});

// dans une fenêtre : démarrage automatique avec la langue fournie par le preload
if (typeof window !== 'undefined' && window.I18N_FACTORY && window.DRYAE_LANG) {
  window.I18N = window.I18N_FACTORY.create(window.DRYAE_LANG, window.DRYAE_LOCALES || {});
  window.T = window.I18N.T;
  window.I18N_FACTORY.installDom(window.I18N);
} else if (typeof window !== 'undefined') { window.T = s => s; window.I18N = { lang: 'fr', locale: 'fr-FR', T: s => s }; }
