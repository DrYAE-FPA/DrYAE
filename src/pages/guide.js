/* dryae://guide — mode d'emploi intégré (touche F1), lu depuis docs/GUIDE.md (français) ou GUIDE.en.md */
shell("Mode d'emploi");
// petit lecteur Markdown : titres, listes (avec sous-listes), gras, italique, code, liens, images, paragraphes
function md(src) {
  const inline = t => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, a, u) => `<img alt="${a}" src="${/^https?:/.test(u) ? u : '/_doc/' + u.replace(/^\.?\//, '')}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, a, u) => `<a href="${/^https?:/.test(u) ? u : '#'}" data-ext="${/^https?:/.test(u) ? u : ''}">${a}</a>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  const out = []; let list = []; let para = [];
  const flushP = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushL = () => { while (list.length) out.push(`</${list.pop()}>`); };
  let n = 0;
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    let m;
    if (!line.trim()) { flushP(); flushL(); continue; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flushP(); flushL(); const lv = m[1].length; out.push(`<h${lv} id="s${n++}">${inline(m[2])}</h${lv}>`); continue; }
    if ((m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line))) {
      flushP(); const depth = Math.floor(m[1].length / 2) + 1, tag = /\d/.test(m[2]) ? 'ol' : 'ul';
      while (list.length > depth) out.push(`</${list.pop()}>`);
      while (list.length < depth) { out.push(`<${tag}>`); list.push(tag); }
      out.push(`<li>${inline(m[3])}</li>`); continue;
    }
    if (/^!\[/.test(line.trim())) { flushP(); flushL(); out.push(inline(line.trim())); continue; }
    if (list.length && /^\s{2,}/.test(raw)) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>'); continue; }
    flushL(); para.push(line.trim());
  }
  flushP(); flushL();
  return out.join('\n');
}
(async () => {
  const lang = (window.I18N && I18N.lang) || 'fr';
  let txt = '';
  for (const f of lang === 'fr' ? ['GUIDE.md'] : ['GUIDE.en.md', 'GUIDE.md']) { try { const r = await fetch('/_doc/' + f); if (r.ok) { txt = await r.text(); break; } } catch {} }
  $('#doc').innerHTML = md(txt.replace(/^\*\[[^\]]+\]\([^)]+\)\*\s*$/m, ''));
  $('#nav').innerHTML = $$('#doc h2').map(h => `<button data-to="${h.id}">${esc(h.textContent)}</button>`).join('');
  $('#nav').onclick = e => { const b = e.target.closest('[data-to]'); if (b) document.getElementById(b.dataset.to).scrollIntoView({ block: 'start' }); };
  $('#doc').onclick = e => { const a = e.target.closest('a[data-ext]'); if (a) { e.preventDefault(); if (a.dataset.ext) D.call('open', a.dataset.ext, {}); } };
})();
$('#keys').onclick = () => D.call('showShortcuts');
$('#report').onclick = () => D.call('report');
