// DrYAE — accessibilité : applique les réglages (contraste élevé, lecture facilitée, animations, mode simple)
// à la fenêtre courante. Utilisé par le gestionnaire, le navigateur et les pages internes.
(function () {
  const A = {
    apply(e) {
      if (!e) return;
      const c = document.documentElement.classList;
      c.toggle('a-hc', !!e.hc); c.toggle('a-easy', !!e.easy); c.toggle('a-rm', !!e.rm); c.toggle('a-motion', e.motion === 'off'); c.toggle('a-simple', !!e.simple);
      A.state = e;
    },
    // annonce pour les lecteurs d'écran (zone « status » invisible)
    say(text) {
      let z = document.getElementById('srLive');
      if (!z) { z = document.createElement('div'); z.id = 'srLive'; z.className = 'sr-only'; z.setAttribute('role', 'status'); z.setAttribute('aria-live', 'polite'); document.body.appendChild(z); }
      z.textContent = ''; setTimeout(() => { z.textContent = text; }, 30);
    },
    // donne un nom aux boutons qui n'ont qu'une icône (lu par les lecteurs d'écran) : leur info-bulle
    label(root = document) {
      root.querySelectorAll('button:not([aria-label]),[role=button]:not([aria-label])').forEach(b => {
        if (!b.textContent.trim() && b.title) b.setAttribute('aria-label', b.title);
      });
      root.querySelectorAll('.overlay .modal').forEach(m => { if (!m.getAttribute('role')) { m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); } });
    },
    // flèches haut / bas dans les menus et listes de boutons
    arrows(box, sel = 'button:not([disabled])') {
      box.addEventListener('keydown', ev => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(ev.key)) return;
        const items = [...box.querySelectorAll(sel)].filter(x => x.offsetParent !== null);
        if (!items.length) return;
        let i = items.indexOf(document.activeElement);
        i = ev.key === 'Home' ? 0 : ev.key === 'End' ? items.length - 1 : ev.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[i].focus(); ev.preventDefault();
      });
    },
  };
  window.A11Y = A;
  // noms des boutons : au chargement puis à chaque changement de la page
  const go = () => { A.label(); new MutationObserver(() => { clearTimeout(A._t); A._t = setTimeout(() => A.label(), 200); }).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) go(); else addEventListener('DOMContentLoaded', go);
})();
