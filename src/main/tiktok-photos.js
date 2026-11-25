// 1.7.2 : publications « photos » de TikTok (diaporama d'images + musique). yt-dlp ne les prend pas : DrYAE ouvre la
// page dans une fenêtre cachée (même session que le navigateur DrYAE, donc mêmes cookies) et lit la liste des images
// que la page contient. On peut ensuite télécharger chaque image seule, et la musique à part si on veut.
const TEST_HOST = process.env.DRYAE_TIKTOK_TEST || ''; // tests : page locale qui imite la structure
const isTikTokPhoto = u => { try { const x = new URL(u); return (/(^|\.)tiktok\.com$/i.test(x.hostname) || (TEST_HOST && x.host === TEST_HOST)) && /\/photo\/\d+/.test(x.pathname); } catch { return false; } };
// liens courts (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/…) : on ne sait qu'après l'ouverture si c'est un diaporama
const isTikTokShort = u => { try { const x = new URL(u); return /^(vm|vt)\.tiktok\.com$/i.test(x.hostname) || (/(^|\.)tiktok\.com$/i.test(x.hostname) && /^\/t\//.test(x.pathname)); } catch { return false; } };

// lit la publication dans les données de la page (format connu), sinon dans les images affichées
// cherche, n'importe où dans les données de la page, la publication qui a des images (la structure change souvent)
function findPost(o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 9) return null;
  if (o.imagePost && Array.isArray(o.imagePost.images) && o.imagePost.images.length) return o;
  for (const k of Object.keys(o)) { const r = findPost(o[k], depth + 1); if (r) return r; }
  return null;
}
function fromData(j) {
  const sc = j && (j.__DEFAULT_SCOPE__ || j);
  const st = sc && (sc['webapp.video-detail']?.itemInfo?.itemStruct || sc['webapp.reflow.video.detail']?.itemInfo?.itemStruct || findPost(j));
  if (!st) return null;
  const imgs = (st.imagePost?.images || []).map(im => {
    const L = im.imageURL?.urlList || im.displayImage?.urlList || [];
    // de préférence le JPEG (s'ouvre partout), sinon la première adresse
    const url = L.find(u => /\.jpe?g(\?|$)|format=jpe?g|\.jpeg~/i.test(u)) || L[0];
    return url ? { url, w: im.imageWidth || 0, h: im.imageHeight || 0 } : null;
  }).filter(Boolean);
  return { title: (st.desc || '').trim() || (st.imagePost?.title || '').trim() || 'TikTok ' + st.id, uploader: st.author?.uniqueId || st.author?.nickname || '', id: st.id || '',
    images: imgs, music: st.music?.playUrl || '', musicTitle: [st.music?.title, st.music?.authorName].filter(Boolean).join(' — '), thumbnail: imgs[0]?.url || st.video?.cover || '' };
}

const PAGE_JS = `(() => {
  const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__') || document.getElementById('SIGI_STATE');
  let data = null; try { data = el ? JSON.parse(el.textContent) : null; } catch {}
  const seen = new Set(), imgs = [];
  for (const im of document.querySelectorAll('img')) { const s = im.currentSrc || im.src || ''; if (/photomode|tplv-photomode|-image\\./i.test(s) && !seen.has(s.split('?')[0])) { seen.add(s.split('?')[0]); imgs.push({ url: s, w: im.naturalWidth, h: im.naturalHeight }); } }
  return { data, imgs, href: location.href, title: document.title, description: (document.querySelector('[data-e2e="browse-video-desc"],[data-e2e="photo-desc"]')?.textContent || '').trim() };
})()`;

async function inspect(url, { session, ua, BrowserWindow, timeout = 30000 }) {
  const win = new BrowserWindow({ show: false, width: 1100, height: 900, webPreferences: { session, contextIsolation: true, sandbox: true, offscreen: false, backgroundThrottling: false } });
  try {
    win.webContents.setAudioMuted(true);
    const t0 = Date.now();
    await Promise.race([win.loadURL(url, { userAgent: ua }), new Promise((_, rej) => setTimeout(() => rej(new Error('TikTok met trop de temps à répondre')), timeout))]).catch(e => { if (!/ERR_ABORTED/.test(e.message)) throw e; });
    let r = null;
    // la page peut finir de se construire après le chargement : on relit quelques secondes
    while (Date.now() - t0 < timeout) {
      r = await win.webContents.executeJavaScript(PAGE_JS).catch(() => null);
      const d = r && fromData(r.data);
      if (d && d.images.length) return { photos: true, ...d, webpage: r.href };
      if (d && !d.images.length && r.href && /\/video\//.test(r.href)) return { photos: false, webpage: r.href }; // c'est une vraie vidéo
      if (r && r.imgs.length >= 1 && Date.now() - t0 > 6000) {
        // titre de l'onglet souvent générique (« (5) TikTok - Make Your Day ») : sinon l'auteur et le numéro de la publication
        const m = /\/@([^/?#]+)\/photo\/(\d+)/.exec(r.href || url) || [];
        let t = (r.description || r.title || '').replace(/^\(\d+\)\s*/, '').replace(/\s*[|\-–]\s*TikTok.*$/i, '').trim();
        if (!t || /^TikTok\b/i.test(t)) t = m[1] ? `TikTok @${m[1]} ${m[2]}` : 'TikTok';
        return { photos: true, title: t, uploader: m[1] ? decodeURIComponent(m[1]) : '', images: r.imgs, music: '', musicTitle: '', thumbnail: r.imgs[0].url, webpage: r.href };
      }
      await new Promise(res => setTimeout(res, 800));
    }
    if (r && r.href && !isTikTokPhoto(r.href)) return { photos: false, webpage: r.href };
    throw new Error('Aucune image trouvée dans cette publication TikTok (connecte-toi à TikTok dans le navigateur DrYAE puis réessaie)');
  } finally { try { win.destroy(); } catch {} }
}

module.exports = { isTikTokPhoto, isTikTokShort, fromData, inspect };
