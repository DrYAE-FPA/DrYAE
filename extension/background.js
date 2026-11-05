// DrYAE pour Chrome : relais vers l'application DrYAE (http://127.0.0.1:47321…47325)
const PORTS = [47321, 47322, 47323, 47324, 47325];
let port = null, lastCheck = 0, alive = false;

async function findPort(force) {
  if (!force && Date.now() - lastCheck < 5000) return alive ? port : null;
  lastCheck = Date.now();
  for (const p of port ? [port, ...PORTS.filter(x => x !== port)] : PORTS) {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 700);
      const r = await fetch(`http://127.0.0.1:${p}/ping`, { signal: ac.signal }); clearTimeout(t);
      if (r.ok && (await r.json()).app === 'DrYAE') { port = p; alive = true; return p; }
    } catch {}
  }
  alive = false; return null;
}

async function cookieHeader(url) {
  try { return (await chrome.cookies.getAll({ url })).map(c => `${c.name}=${c.value}`).join('; '); } catch { return ''; }
}

async function send(payload) {
  const p = await findPort(true);
  if (!p) { notifyOff(); return false; }
  if (payload.url && /^https?:/.test(payload.url) && payload.cookie === undefined) payload.cookie = await cookieHeader(payload.url);
  payload.ua = navigator.userAgent;
  try {
    const r = await fetch(`http://127.0.0.1:${p}/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return r.ok;
  } catch { return false; }
}
function notifyOff() {
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

// ---------- menus du clic droit ----------
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ intercept: true }, v => chrome.storage.local.set(v));
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'link', title: chrome.i18n.getMessage('mLink'), contexts: ['link'] });
    chrome.contextMenus.create({ id: 'media', title: chrome.i18n.getMessage('dlWith'), contexts: ['image', 'video', 'audio'] });
    chrome.contextMenus.create({ id: 'page', title: chrome.i18n.getMessage('mPage'), contexts: ['page', 'frame'] });
    chrome.contextMenus.create({ id: 'sel', title: chrome.i18n.getMessage('mSel'), contexts: ['selection'] });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const ref = info.pageUrl || tab?.url || '';
  if (info.menuItemId === 'link') send({ url: info.linkUrl, referer: ref });
  if (info.menuItemId === 'media') send({ url: info.srcUrl, referer: ref });
  if (info.menuItemId === 'page') send({ url: info.frameUrl || ref, referer: ref, kind: 'page' });
  if (info.menuItemId === 'sel') { const t = (info.selectionText || '').trim(); if (/^(https?:\/\/|magnet:)\S+$/i.test(t)) send({ url: t, referer: ref }); }
});

// ---------- interception des téléchargements de Chrome ----------
const handled = new Set(), passThrough = new Set();
chrome.downloads.onCreated.addListener(async item => {
  const { intercept } = await chrome.storage.local.get({ intercept: true });
  if (!intercept) return;
  const url = item.finalUrl || item.url;
  if (!/^https?:/i.test(url) || handled.has(item.id)) return;
  if (passThrough.has(item.url) || passThrough.has(url)) { passThrough.delete(item.url); passThrough.delete(url); return; }
  if (!(await findPort(false)) && !(await findPort(true))) return; // DrYAE fermé : Chrome garde le téléchargement
  handled.add(item.id);
  try { await chrome.downloads.cancel(item.id); await chrome.downloads.erase({ id: item.id }); } catch {}
  const name = (item.filename || '').split(/[\\/]/).pop();
  const torrent = item.mime === 'application/x-bittorrent' || /\.torrent(\?|$)/i.test(url);
  const ok = await send({ url, name, referer: item.referrer || '', kind: torrent ? 'torrent' : undefined });
  if (!ok) { passThrough.add(url); chrome.downloads.download({ url }); } // repli : on relance dans Chrome
});

// ---------- détection des vidéos et audios dans les onglets ----------
const media = new Map(); // tabId -> [{url, kind, mime, size, name}]
const SKIP = /(^|\.)(googlevideo\.com|ytimg\.com|doubleclick\.net)$/;
function badge(tabId) {
  const n = (media.get(tabId) || []).filter(m => m.kind !== 'subtitle').length;
  chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6', tabId });
  chrome.action.setBadgeText({ text: n ? String(n) : '', tabId });
}
chrome.webRequest.onHeadersReceived.addListener(d => {
  if (d.tabId < 0 || d.method !== 'GET' || d.statusCode >= 400) return;
  let u; try { u = new URL(d.url); } catch { return; }
  if (SKIP.test(u.hostname)) return;
  const h = {}; for (const x of d.responseHeaders || []) h[x.name.toLowerCase()] = x.value || '';
  const ct = (h['content-type'] || '').split(';')[0].toLowerCase();
  const ext = (u.pathname.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase() || '';
  let kind = null;
  if (ct.includes('mpegurl') || ext === 'm3u8') kind = 'hls';
  else if (ct === 'video/mp2t' || ['ts', 'm4s'].includes(ext)) return;
  else if (ct.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'm4v'].includes(ext)) kind = 'video';
  else if (ct.startsWith('audio/') || ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav'].includes(ext)) kind = 'audio';
  else if (ct === 'text/vtt' || ['vtt', 'srt'].includes(ext)) kind = 'subtitle';
  if (!kind) return;
  let size = -1; const cr = h['content-range'];
  if (cr && /\/(\d+)/.test(cr)) size = +cr.match(/\/(\d+)/)[1]; else if (h['content-length']) size = +h['content-length'];
  if ((kind === 'video' || kind === 'audio') && size >= 0 && size < 100 * 1024) return;
  const list = media.get(d.tabId) || [];
  const key = d.url.replace(/([?&])(range|bytestart|byteend)=[^&]*/gi, '$1');
  if (list.some(m => m.key === key)) return;
  list.unshift({ key, url: d.url, kind, mime: ct, size, name: decodeURIComponent(u.pathname.split('/').pop() || '') });
  media.set(d.tabId, list.slice(0, 50));
  badge(d.tabId);
}, { urls: ['<all_urls>'] }, ['responseHeaders']);
chrome.tabs.onUpdated.addListener((tabId, ch) => { if (ch.status === 'loading' && ch.url) { media.delete(tabId); badge(tabId); } });
chrome.tabs.onRemoved.addListener(tabId => media.delete(tabId));

// ---------- fenêtre de l'extension ----------
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  (async () => {
    if (msg.type === 'status') reply({ alive: !!(await findPort(true)), port, media: media.get(msg.tabId) || [], intercept: (await chrome.storage.local.get({ intercept: true })).intercept });
    else if (msg.type === 'send') reply({ ok: await send(msg.payload) });
    else if (msg.type === 'intercept') { await chrome.storage.local.set({ intercept: !!msg.value }); reply({ ok: true }); }
  })();
  return true;
});
