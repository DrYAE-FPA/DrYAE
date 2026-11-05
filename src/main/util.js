const fs = require('fs');
const path = require('path');

const CATS = {
  video: { label: 'Vidéos', ext: 'mp4 mkv avi mov webm flv wmv m4v 3gp ts m3u8 mpg mpeg vob' },
  audio: { label: 'Musique', ext: 'mp3 wav flac aac ogg m4a opus wma amr' },
  doc: { label: 'Documents', ext: 'pdf doc docx xls xlsx ppt pptx txt odt ods odp rtf epub csv mobi djvu' },
  img: { label: 'Images', ext: 'jpg jpeg png gif webp bmp svg heic tiff ico psd' },
  arc: { label: 'Archives', ext: 'zip rar 7z tar gz bz2 xz iso tgz cab' },
  app: { label: 'Programmes', ext: 'exe msi apk dmg deb rpm appimage bat msix xapk' },
  sub: { label: 'Sous-titres', ext: 'srt vtt ass ssa sub' },
};

const extOf = n => (path.extname(n || '').slice(1) || '').toLowerCase();
function catOf(name) {
  const e = extOf(name);
  for (const k in CATS) if (CATS[k].ext.split(' ').includes(e)) return k;
  return 'other';
}
function catFolder(cat) { return cat === 'other' ? 'Autres' : cat === 'torrent' ? 'Torrents' : CATS[cat]?.label || 'Autres'; }

function sanitize(name) {
  name = String(name || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/[. ]+$/, '').trim();
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(name)) name = '_' + name;
  return name.slice(0, 180) || 'fichier';
}

function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name), i = 1;
  while (fs.existsSync(p) || fs.existsSync(p + '.dryae') || fs.existsSync(p + '.dryae-hls')) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
}

function nameFromHeaders(url, headers) {
  const cd = headers.get ? headers.get('content-disposition') : headers['content-disposition'];
  if (cd) {
    let m = String(cd).match(/filename\*\s*=\s*([\w-]+)?''([^;]+)/i);
    if (m) { try { return sanitize(decodeURIComponent(m[2].replace(/"/g, ''))); } catch {} }
    m = String(cd).match(/filename\s*=\s*"?([^";]+)"?/i);
    if (m) { try { return sanitize(decodeURIComponent(escape(m[1]))); } catch { return sanitize(m[1]); } }
  }
  return nameFromUrl(url);
}
function nameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    return sanitize(last || u.hostname);
  } catch { return 'fichier'; }
}

const EXT_BY_MIME = {
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg',
  'application/pdf': 'pdf', 'application/zip': 'zip', 'image/jpeg': 'jpg', 'image/png': 'png', 'application/x-bittorrent': 'torrent',
  'application/vnd.android.package-archive': 'apk', 'text/plain': 'txt', 'audio/wav': 'wav', 'image/gif': 'gif', 'image/webp': 'webp',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

// expansion "lot" : http://x/img[001-120].jpg ou [a-z]
function expandBatch(pattern) {
  const m = pattern.match(/\[(\w+)-(\w+)(?::(\d+))?\]/);
  if (!m) return [pattern];
  const [all, a, b, stepS] = m;
  const step = Math.max(1, parseInt(stepS || '1', 10));
  const out = [];
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const pad = a.length > 1 && a.startsWith('0') ? a.length : 0;
    const s = parseInt(a, 10), e = parseInt(b, 10);
    for (let i = s; s <= e ? i <= e : i >= e; i += s <= e ? step : -step) {
      out.push(...expandBatch(pattern.replace(all, String(i).padStart(pad, '0'))));
      if (out.length > 5000) break;
    }
  } else if (/^[a-zA-Z]$/.test(a) && /^[a-zA-Z]$/.test(b)) {
    for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c += step) out.push(...expandBatch(pattern.replace(all, String.fromCharCode(c))));
  } else return [pattern];
  return out;
}

module.exports = { CATS, extOf, catOf, catFolder, sanitize, uniquePath, nameFromHeaders, nameFromUrl, EXT_BY_MIME, sleep, uid, hostOf, expandBatch };
