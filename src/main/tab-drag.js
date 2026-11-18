// 1.7.1 (version perso) : déplacer un onglet à la souris, comme dans les autres navigateurs.
// - L'onglet sort de la barre : une vignette de la page suit la souris (sur tous les écrans).
// - Lâché au-dessus d'une autre fenêtre DrYAE : il y passe (à l'endroit montré dans sa barre d'onglets).
// - Lâché ailleurs : il devient une nouvelle fenêtre à cet endroit (2e écran compris).
// - Seul onglet de sa fenêtre : c'est la fenêtre entière qui suit la souris ; lâchée sur une autre fenêtre, elle s'y fond.
// La position vient de la souris de Windows (lue ici en continu) et, à défaut, de celle envoyée par la fenêtre.
const { ipcMain, BrowserWindow, screen, webContents } = require('electron');

module.exports = function tabDrag(br) {
  let D = null; // glisser en cours

  // toutes les fenêtres du navigateur : la principale et celles ouvertes par « Nouvelle fenêtre »
  const wins = () => {
    const out = [];
    if (br.win && !br.win.isDestroyed() && br.mainWc) out.push({ win: br.win, wc: br.mainWc, main: true });
    for (const w of br.extraWins || []) if (!w.isDestroyed() && w._view && !w._view.webContents.isDestroyed()) out.push({ win: w, wc: w._view.webContents, main: false });
    for (const x of out) if (!x.win._dragFocus) { x.win._dragFocus = true; x.win._lastFocus = x.win.isFocused() ? Date.now() : 0; x.win.on('focus', () => { x.win._lastFocus = Date.now(); }); }
    return out;
  };
  const fromSender = wc => wins().find(x => x.wc === wc) || null;
  // fenêtre sous la souris (la plus récemment utilisée si elles se chevauchent), sans la fenêtre d'origine
  const under = (p, skip) => wins().filter(x => x.win !== skip && x.win.isVisible() && !x.win.isMinimized()).filter(x => {
    const b = x.win.getContentBounds(); return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
  }).sort((a, b) => (b.win._lastFocus || 0) - (a.win._lastFocus || 0))[0] || null;
  const local = (x, p) => { const b = x.win.getContentBounds(); let z = 1; try { z = x.wc.getZoomFactor() || 1; } catch {} return { x: (p.x - b.x) / z, y: (p.y - b.y) / z }; };

  // vignette qui suit la souris
  const ghostHtml = (title, img, inc) => `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent;overflow:hidden;font:12px "Segoe UI",system-ui,sans-serif;user-select:none}
    .c{margin:6px;border-radius:10px;background:${inc ? '#2a1846' : '#161a22'};border:2px solid #8b5cf6;box-shadow:0 8px 24px rgba(0,0,0,.45);overflow:hidden;color:#e6e8ee}
    .h{display:flex;align-items:center;gap:6px;padding:6px 9px;background:${inc ? '#3b2163' : '#1f2430'}}
    .h b{flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    img{display:block;width:100%;height:132px;object-fit:cover;object-position:top;background:#0d0f14}
    .l{padding:5px 9px;color:#c4b5fd;font-size:11px}
  </style><div class="c"><div class="h"><b></b></div>${img ? `<img src="${img}">` : ''}<div class="l" id="l"></div></div>
  <script>document.querySelector('b').textContent=${JSON.stringify(title || '')};window.setL=t=>{document.getElementById('l').textContent=t}</script>`;
  function ghostMake() {
    const g = new BrowserWindow({ width: 252, height: D.thumb ? 200 : 76, frame: false, transparent: true, resizable: false, movable: false, focusable: false,
      skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: true } });
    g.setIgnoreMouseEvents(true); g.setAlwaysOnTop(true, 'pop-up-menu');
    g.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(ghostHtml(D.title, D.thumb, D.inc)));
    return g;
  }
  const T = s => (global.DRYAE_T || (x => x))(s);

  function setTarget(t, p) {
    if (D.target && D.target !== t) try { D.target.wc.send('tab-drag-over', null); } catch {}
    D.target = t;
    if (t) try { t.wc.send('tab-drag-over', local(t, p)); } catch {}
  }
  function step(p) {
    if (!D) return;
    D.p = p;
    if (!D.out) return;
    const t = under(p, D.src.win);
    setTarget(t, p);
    if (D.only && !t) {
      // seul onglet : la fenêtre entière suit la souris
      if (D.ghost?.isVisible()) D.ghost.hide();
      try { const b = D.src.win.getBounds(); D.src.win.setBounds({ ...b, x: Math.round(p.x - D.grab.x), y: Math.round(p.y - D.grab.y) }); } catch {}
      return;
    }
    if (!D.ghost || D.ghost.isDestroyed()) D.ghost = ghostMake();
    try {
      D.ghost.setPosition(Math.round(p.x - 40), Math.round(p.y - 14));
      const lab = t ? T('Lâcher pour l\'ajouter à cette fenêtre') : T('Lâcher pour ouvrir une nouvelle fenêtre');
      if (D.lab !== lab) { D.lab = lab; D.ghost.webContents.executeJavaScript(`window.setL&&setL(${JSON.stringify(lab)})`).catch(() => {}); }
      if (!D.ghost.isVisible()) D.ghost.showInactive();
    } catch {}
  }
  function stop() {
    if (!D) return;
    clearInterval(D.poll);
    try { D.ghost?.destroy(); } catch {}
    if (D.target) try { D.target.wc.send('tab-drag-over', null); } catch {}
    D = null;
  }

  ipcMain.handle('br:tabDragStart', async (e, o = {}) => {
    stop();
    const src = fromSender(e.sender); if (!src || typeof o.url !== 'string') return false;
    D = { src, url: o.url, title: String(o.title || ''), inc: !!o.inc, only: !!o.only, out: false, p: null, last: null, target: null, ghost: null, lab: '' };
    try { const c = screen.getCursorScreenPoint(); D.last = c; } catch {}
    // endroit où la fenêtre a été attrapée (pour qu'elle suive la souris sans sauter)
    try { const b = src.win.getBounds(), p = Number.isFinite(o.x) ? { x: o.x, y: o.y } : screen.getCursorScreenPoint(); D.grab = { x: p.x - b.x, y: p.y - b.y }; } catch { D.grab = { x: 120, y: 20 }; }
    // vignette de la page
    try { const w = Number.isFinite(o.wcId) && webContents.fromId(o.wcId); if (w && !w.isDestroyed()) { const im = await w.capturePage(); if (D && !im.isEmpty()) D.thumb = im.resize({ width: 240 }).toDataURL(); } } catch {}
    if (!D) return false;
    // la souris de Windows, lue en continu (même hors de la fenêtre) ; elle ne compte que si elle bouge vraiment
    D.poll = setInterval(() => { try { const c = screen.getCursorScreenPoint(); if (D && (!D.last || c.x !== D.last.x || c.y !== D.last.y)) { D.last = c; D.moved = true; step(c); } } catch {} }, 16);
    return true;
  });
  // la fenêtre dit si l'onglet est sorti de sa barre, et où est la souris
  ipcMain.handle('br:tabDragMove', (e, o = {}) => {
    if (!D || fromSender(e.sender)?.win !== D.src.win) return;
    // hors de la fenêtre d'origine = sorti, même si la fenêtre ne l'a pas encore vu
    let outside = false; try { const b = D.src.win.getContentBounds(); outside = Number.isFinite(o.x) && (o.x < b.x || o.y < b.y || o.x >= b.x + b.width || o.y >= b.y + b.height); } catch {}
    D.out = D.only && D.out ? true : !!o.out || outside; // seul onglet : une fois sorti, la fenêtre suit la souris jusqu'au lâcher
    if (!D.out) { setTarget(null); if (D.ghost?.isVisible()) D.ghost.hide(); return; }
    if (!D.moved && Number.isFinite(o.x) && Number.isFinite(o.y)) step({ x: o.x, y: o.y });
    else if (D.last || D.p) step(D.moved ? D.last : D.p);
  });
  ipcMain.handle('br:tabDragCancel', () => stop());
  // lâcher : l'onglet passe dans une autre fenêtre, ouvre une nouvelle fenêtre, ou (seul onglet) la fenêtre reste là où on l'a posée
  ipcMain.handle('br:tabDragEnd', (e, o = {}) => {
    if (!D || fromSender(e.sender)?.win !== D.src.win) { stop(); return { act: 'none' }; }
    let p = D.p;
    if (D.moved) { try { p = screen.getCursorScreenPoint(); } catch {} } else if (Number.isFinite(o.x) && Number.isFinite(o.y)) p = { x: o.x, y: o.y };
    const d = D; stop();
    if (!d.out || !p) return { act: 'none' };
    const t = under(p, d.src.win);
    if (t) {
      if (t.main) { try { br.showView?.(); } catch {} } else br.extraShow(t.win, true);
      t.wc.send('tab-drop-in', { url: d.url, title: d.title, inc: d.inc, ...local(t, p) });
      try { if (t.win.isMinimized()) t.win.restore(); t.win.focus(); } catch {}
      return { act: 'moved' };
    }
    if (d.only) return { act: 'window' };
    const w = br.newWindow(d.url, { incognito: d.inc });
    try { if (w && !w.isDestroyed()) { const b = w.getBounds(); w.setBounds({ ...b, x: Math.round(p.x - 120), y: Math.round(p.y - 18) }); } } catch {}
    return { act: 'new' };
  });
};
