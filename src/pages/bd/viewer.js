// DrYAE — lecteur de BD et de mangas (page sans accès à DrYAE : les images viennent de dryae://bd/_img)
const $ = s => document.querySelector(s);
const hp = new URLSearchParams(location.hash.slice(1).replace(/^([a-f0-9]+)/, 'id=$1'));
const id = (hp.get('id') || '').replace(/[^a-f0-9]/g, ''), startAt = hp.has('p') ? +hp.get('p') : null; // 1.7.1 : p = image ouverte
let info = null, cur = 0;
const st = (() => { try { return localStorage; } catch { return null; } })();
const get = (k, d) => { try { return st?.getItem(k) ?? d; } catch { return d; } };
const set = (k, v) => { try { st?.setItem(k, v); } catch {} };
const T = window.DRYAE_T || {};
const tr = s => T[s] || s;
async function load() {
  const r = await fetch('_list?id=' + id); if (!r.ok) { $('#title').textContent = tr('Fichier introuvable : rouvrez-le depuis le menu de DrYAE.'); return; }
  info = await r.json(); document.title = info.name + ' — DrYAE'; $('#title').textContent = info.name;
  const box = $('#pages');
  info.pages.forEach((n, i) => { const im = document.createElement('img'); im.alt = n; im.dataset.i = i; im.loading = i < 3 ? 'eager' : 'lazy'; im.decoding = 'async'; im.src = '_img?id=' + id + '&i=' + i; box.appendChild(im); });
  // 1.7.1 : images ouvertes depuis l'ordinateur : une image à la fois, à la hauteur de l'écran (réglages gardés à part de ceux des BD)
  const K = info.image ? 'img.' : 'bd.';
  $('#mode').value = get(K + 'mode', info.image ? 'page' : 'scroll'); $('#dir').value = get('bd.dir:' + info.key, get('bd.dir', 'ltr')); $('#fit').value = get(K + 'fit', info.image ? 'height' : 'width');
  apply(); go(startAt != null ? startAt : +get('bd.pos:' + info.key, 0), true);
}
const imgs = () => [...document.querySelectorAll('#pages img')];
function apply() {
  const m = $('#mode').value, d = $('#dir').value, f = $('#fit').value;
  document.body.className = `mode-${m} fit-${f} ${d}`;
  const K = info?.image ? 'img.' : 'bd.'; set(K + 'mode', m); set(K + 'fit', f); if (info) { set('bd.dir:' + info.key, d); set('bd.dir', d); }
  show();
}
function show() {
  const m = $('#mode').value, L = imgs(), step = m === 'double' ? 2 : 1;
  L.forEach((im, i) => { const on = m === 'scroll' || (i >= cur && i < cur + step); im.classList.toggle('on', on); im.classList.toggle('ahead', m !== 'scroll' && i >= cur + step && i < cur + step + 3); if (m !== 'scroll' && im.classList.contains('ahead')) im.loading = 'eager'; });
  $('#num').textContent = `${cur + 1} / ${L.length}`;
  if (info) set('bd.pos:' + info.key, cur);
}
function go(i, jump) {
  const L = imgs(); if (!L.length) return;
  cur = Math.max(0, Math.min(L.length - 1, i));
  if ($('#mode').value === 'scroll') { if (jump) L[cur].scrollIntoView({ block: 'start' }); }
  else scrollTo(0, 0);
  show();
}
const step = () => ($('#mode').value === 'double' ? 2 : 1);
const fwd = () => go(cur + step(), true), back = () => go(cur - step(), true);
$('#next').onclick = () => ($('#dir').value === 'rtl' ? back() : fwd());
$('#prev').onclick = () => ($('#dir').value === 'rtl' ? fwd() : back());
['#mode', '#dir', '#fit'].forEach(s => $(s).onchange = () => { apply(); go(cur, true); $(s).blur(); });
addEventListener('keydown', e => {
  if (e.target && e.target.closest && e.target.closest('select')) return;
  const rtl = $('#dir').value === 'rtl', scroll = $('#mode').value === 'scroll';
  if (e.key === 'ArrowRight') { e.preventDefault(); rtl ? back() : fwd(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); rtl ? fwd() : back(); }
  else if (!scroll && (e.key === ' ' || e.key === 'PageDown')) { e.preventDefault(); fwd(); }
  else if (!scroll && e.key === 'PageUp') { e.preventDefault(); back(); }
  else if (e.key === 'Home') { e.preventDefault(); go(0, true); }
  else if (e.key === 'End') { e.preventDefault(); go(1e9, true); }
});
// en défilement continu : la page affichée est celle qui occupe le haut de l'écran
let tick = 0;
addEventListener('scroll', () => { if ($('#mode').value !== 'scroll') return; cancelAnimationFrame(tick); tick = requestAnimationFrame(() => { const L = imgs(); const k = L.findIndex(im => im.getBoundingClientRect().bottom > 80); if (k >= 0 && k !== cur) { cur = k; show(); } }); }, { passive: true });
// clic sur la moitié gauche / droite de la page : précédente / suivante (page par page)
$('#pages').addEventListener('click', e => { if ($('#mode').value === 'scroll' || e.target.tagName !== 'IMG') return; const r = e.target.getBoundingClientRect(); const right = e.clientX > r.left + r.width / 2; ($('#dir').value === 'rtl') !== right ? fwd() : back(); });
load();
