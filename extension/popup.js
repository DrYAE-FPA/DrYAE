const $ = s => document.querySelector(s);
const t = k => chrome.i18n.getMessage(k) || k;
document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
document.documentElement.lang = chrome.i18n.getUILanguage();
if (/^ar/.test(chrome.i18n.getUILanguage())) document.documentElement.dir = 'rtl';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = b => { if (b == null || b < 0) return ''; const u = t('units').split(' '); let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return (i ? b.toFixed(1) : b) + ' ' + u[i]; };
const KIND = { video: t('kVideo'), audio: t('kAudio'), hls: t('kHls'), subtitle: t('kSub') };
let tab = null, items = [];

async function refresh() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const r = await chrome.runtime.sendMessage({ type: 'status', tabId: tab?.id });
  $('#st').textContent = r.alive ? t('connected') : t('offline');
  $('#st').className = 'st ' + (r.alive ? 'on' : 'off');
  $('#off').style.display = r.alive ? 'none' : '';
  $('#intercept').checked = r.intercept;
  items = r.media;
  $('#list').innerHTML = items.length ? items.map((m, i) => `<div class="m"><div class="n"><span class="k">${KIND[m.kind] || m.kind}</span>${esc(m.name || t('media'))}</div><div class="u">${fmt(m.size)} ${esc(m.mime || '')}</div><button class="sec" data-i="${i}">${t('dlWith')}</button></div>`).join('')
    : `<p class="hint">${t('playHint')}</p>`;
}
$('#page').onclick = async () => { const r = await chrome.runtime.sendMessage({ type: 'send', payload: { url: tab.url, referer: tab.url, kind: 'page' } }); if (r.ok) window.close(); else refresh(); };
$('#intercept').onchange = e => chrome.runtime.sendMessage({ type: 'intercept', value: e.target.checked });
$('#list').onclick = async e => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  const m = items[+b.dataset.i];
  const r = await chrome.runtime.sendMessage({ type: 'send', payload: { url: m.url, referer: tab.url, name: m.name, kind: m.kind === 'hls' ? 'hls' : undefined } });
  if (r.ok) window.close();
};
refresh();
