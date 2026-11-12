/* dryae://tasks — gestionnaire des tâches : mémoire et processeur de chaque onglet et extension */
shell('Gestionnaire des tâches');
let ROWS = [], sel = null, sort = 'mem';
const mb = k => (k / 1024).toFixed(k > 102400 ? 0 : 1) + ' ' + TR('Mo');
async function load() {
  ROWS = await call('tasks');
  ROWS.sort((a, b) => sort === 'name' || sort === 'kind' ? String(a[sort]).localeCompare(String(b[sort])) : b[sort] - a[sort]);
  const tot = ROWS.reduce((a, r) => a + r.mem, 0);
  $('#sum').textContent = TRF('Mémoire totale utilisée par DrYAE : {0}', mb(tot));
  $('#rows').innerHTML = ROWS.map((r, i) => `<tr data-i="${i}" tabindex="0" class="${sel && sel === r.id && r.id ? 'sel' : ''}"><td class="n notr" title="${esc(r.url || r.name)}">${esc(r.name)}</td><td>${esc(TR(r.kind))}</td><td class="r">${mb(r.mem)}</td><td class="r">${r.cpu.toFixed(1)} %</td></tr>`).join('');
  const s = ROWS.find(r => r.id === sel); $('#end').disabled = !(s && s.end);
}
$('#rows').onclick = e => { const tr = e.target.closest('[data-i]'); if (!tr) return; sel = ROWS[+tr.dataset.i].id; load(); };
$('#rows').onkeydown = e => { if (e.key === 'Enter') e.target.click(); };
$('thead').onclick = e => { const th = e.target.closest('[data-s]'); if (th) { sort = th.dataset.s; load(); } };
$('#end').onclick = async () => { if (sel) { await call('taskEnd', sel); sel = null; setTimeout(load, 400); } };
load(); setInterval(load, 2000);
