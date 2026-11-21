// 1.7.1 : fenêtre d'ajout d'un torrent, la même dans le gestionnaire et dans le navigateur.
// À gauche : « Enregistrer dans » (Torrents par défaut, dossier de chaque catégorie, Parcourir), options, informations.
// À droite : fichiers en arbre (dossiers dépliables, cases par dossier), filtre. En bas : « Ne plus afficher ».
// Utilisation : TorrentAdd.mount(conteneur, info, api) — api fournit les appels (dirs, free, pickDir, saveFile, add, prefs),
// la traduction T, fmt (tailles), toast, defaults { seq, seed }, back (bouton Retour, facultatif) et done(d) après l'ajout.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VID = /\.(mp4|mkv|avi|mov|webm|m4v|wmv|flv|ts)$/i;
  const icon = name => { const e = (/\.([a-z0-9]+)$/i.exec(name) || [])[1]?.toLowerCase() || ''; return /^(mp4|mkv|avi|mov|webm|m4v|wmv|flv|ts|mpg|mpeg)$/.test(e) ? '🎬' : /^(mp3|flac|wav|aac|ogg|m4a|opus)$/.test(e) ? '🎵' : /^(jpe?g|png|gif|webp|bmp)$/.test(e) ? '🖼️' : /^(zip|rar|7z|iso|gz|tar|bin)$/.test(e) ? '🗜️' : /^(exe|msi|apk)$/.test(e) ? '⚙️' : /^(srt|vtt|ass|ssa|sub)$/.test(e) ? '💬' : '📄'; };
  const svg = id => `<svg><use href="#i-${id}"/></svg>`;

  function html(T, hasBack) {
    const t = s => esc(T(s));
    return `<div class="tadd">
      <div class="tadd-l">
        <div class="sect">${t('Enregistrer dans')}</div>
        <div class="row"><select id="tDirSel" title="${t('Dossier où le torrent sera enregistré')}"></select><button class="btn" id="tDirPick" title="${t('Choisir un autre dossier')}">${svg('folder')}${t('Parcourir')}</button></div>
        <div class="hint mono" id="tDirPath"></div>
        <label class="check"><input type="checkbox" id="tRemember"> ${t('Se souvenir du dernier dossier choisi')}</label>
        <div class="sect">${t('Options')}</div>
        <div class="tadd-opts">
          <label class="check"><input type="checkbox" id="tStart" checked> ${t('Démarrer le torrent')}</label>
          <label class="check"><input type="checkbox" id="tTop"> ${t("Ajouter en haut de la file d'attente")}</label>
          <label class="check"><input type="checkbox" id="tSeq"> ${t('Téléchargement séquentiel (lecture pendant le téléchargement)')}</label>
          <label class="check"><input type="checkbox" id="tFL"> ${t("Premiers et derniers morceaux d'abord")}</label>
          <label class="check"><input type="checkbox" id="tSeed"> ${t('Partager (seed) une fois terminé')}</label>
          <label class="check"><input type="checkbox" id="tSchedule"> ${t('Planifier (avec les heures du planificateur)')}</label>
        </div>
        <div class="sect">${t('Informations')}</div>
        <dl class="kv" id="tKv"></dl>
        <button class="btn sm" id="tSaveFile">${svg('dl')}${t('Enregistrer le fichier .torrent sous…')}</button>
      </div>
      <div class="tadd-r">
        <div class="row tadd-bar"><button class="btn sm" id="tAll">${t('Tout')}</button><button class="btn sm" id="tNone">${t('Aucun')}</button><button class="btn sm" id="tVideos">${t('Vidéos seulement')}</button><input type="text" id="tFilter" placeholder="${t('Filtrer les fichiers…')}"></div>
        <div class="ttree" id="tFiles"></div>
      </div>
    </div>
    <div class="modal-foot"><label class="check l" style="margin:0 14px 0 0" title="${t('Les prochains torrents seront ajoutés tout de suite. Pour revoir cette fenêtre : Paramètres → Torrents')}"><input type="checkbox" id="tNoAsk"> ${t('Ne plus afficher')}</label><span class="l" id="tSel"></span>${hasBack ? `<button class="btn" id="tBack">${t('Retour')}</button>` : ''}<button class="btn primary" id="tOk">${t('Télécharger')}</button></div>`;
  }

  function mount(root, info, api) {
    const T = api.T || (s => s), fmt = api.fmt, TF = (s, ...a) => T(s).replace(/\{(\d)\}/g, (m, i) => (a[i] ?? ''));
    root.innerHTML = html(T, !!api.back);
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    $('#tSeq').checked = !!api.defaults?.seq; $('#tSeed').checked = !!api.defaults?.seed;
    // arbre des fichiers
    const tree = { key: '', kids: new Map(), files: [] };
    for (const f of info.files) {
      const parts = String(f.path).split(/[\\/]/); let n = tree, key = '';
      for (const p of parts.slice(0, -1)) { key += '/' + p; if (!n.kids.has(p)) n.kids.set(p, { key, name: p, kids: new Map(), files: [] }); n = n.kids.get(p); }
      n.files.push({ ...f, name: parts[parts.length - 1] });
    }
    let sel = new Set(info.files.map(f => f.i)), dirs = [], free = -1;
    const open = new Set();
    if (tree.kids.size === 1 && [...tree.kids.values()][0].kids) open.add([...tree.kids.values()][0].key); // un seul dossier racine : déjà ouvert
    const allIn = n => [...n.files.map(f => f.i), ...[...n.kids.values()].flatMap(allIn)];
    const sizeOf = n => n.files.reduce((a, f) => a + f.length, 0) + [...n.kids.values()].reduce((a, k) => a + sizeOf(k), 0);
    const node = key => { let n = tree; for (const p of key.split('/').slice(1)) n = n.kids.get(p); return n; };
    const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
    function draw() {
      const q = $('#tFilter').value.trim().toLowerCase(), out = [], match = f => !q || String(f.path).toLowerCase().includes(q);
      const walk = (n, depth) => {
        for (const k of [...n.kids.values()].sort(cmp)) {
          const ids = allIn(k), shown = q ? ids.filter(i => match(info.files[i])) : ids; if (!shown.length) continue;
          const on = ids.filter(i => sel.has(i)).length, isOpen = q || open.has(k.key);
          out.push(`<div class="tr${on ? '' : ' off'}" style="padding-left:${4 + depth * 16}px"><button class="tg" data-tg="${esc(k.key)}">${isOpen ? '▼' : '▶'}</button><input type="checkbox" data-td="${esc(k.key)}" ${on === ids.length ? 'checked' : ''} ${on && on < ids.length ? 'data-mid="1"' : ''}><span class="ic">📁</span><span class="n" title="${esc(k.key.slice(1))}">${esc(k.name)}</span><span class="s">${fmt(sizeOf(k))}</span></div>`);
          if (isOpen) walk(k, depth + 1);
        }
        for (const f of n.files.slice().sort(cmp)) {
          if (!match(f)) continue;
          out.push(`<div class="tr${sel.has(f.i) ? '' : ' off'}" style="padding-left:${4 + depth * 16}px"><span></span><input type="checkbox" data-ti="${f.i}" ${sel.has(f.i) ? 'checked' : ''}><span class="ic">${icon(f.name)}</span><span class="n" title="${esc(f.path)}">${esc(f.name)}</span><span class="s">${fmt(f.length)}</span></div>`);
        }
      };
      walk(tree, 0);
      $('#tFiles').innerHTML = out.join('') || `<div class="hint" style="padding:10px">${esc(T('Aucun fichier ne correspond'))}</div>`;
      $$('#tFiles [data-mid]').forEach(x => (x.indeterminate = true));
    }
    const chosen = () => info.files.map(f => f.i).filter(i => sel.has(i));
    function kv() {
      const sz = info.files.filter(f => sel.has(f.i)).reduce((a, f) => a + f.length, 0);
      const fr = free >= 0 ? ` <span style="color:${free < sz ? 'var(--danger,#e05050)' : 'var(--muted)'}">(${esc(TF('place libre sur le disque : {0}', fmt(free)))})</span>` : '';
      const date = info.created ? new Date(info.created).toLocaleDateString() : T('Non indiquée');
      $('#tKv').innerHTML = `<dt>${esc(T('Nom'))}</dt><dd>${esc(info.name)}</dd><dt>${esc(T('Taille'))}</dt><dd>${fmt(info.size)}${fr}</dd><dt>${esc(T('Fichiers'))}</dt><dd>${info.files.length}</dd><dt>${esc(T('Créé le'))}</dt><dd>${esc(date)}</dd><dt>${esc(T('Empreinte'))}</dt><dd class="mono">${esc(info.infoHash)}</dd>` + (info.comment ? `<dt>${esc(T('Commentaire'))}</dt><dd>${esc(info.comment)}</dd>` : '');
    }
    function count() { const c = chosen(), sz = c.reduce((a, i) => a + info.files[i].length, 0); $('#tSel').textContent = TF('{0}/{1} fichier(s) · {2}', c.length, info.files.length, fmt(sz)); kv(); api.onCount?.(c.length, sz); return c; }
    // dossiers
    const dirName = d => d.key === 'auto' ? T('Torrents (par défaut)') : d.key === 'temp' || d.key === 'last' ? T(d.label) : d.key === 'pick' ? (d.dir.split(/[\\/]/).filter(Boolean).pop() || d.dir) : T('Dossier') + ' ' + T(d.label);
    const dirNow = () => dirs[+$('#tDirSel').value] || dirs[0] || { key: 'auto', dir: '' };
    async function dirShow() { const d = dirNow(); $('#tDirPath').textContent = d.dir || ''; free = -1; kv(); free = await Promise.resolve(api.free(d.dir)).catch(() => -1); kv(); }
    $('#tDirSel').onchange = dirShow;
    $('#tDirPick').onclick = async () => {
      const p = await api.pickDir(dirNow().dir); if (!p) return;
      let i = dirs.findIndex(d => d.key === 'pick');
      if (i < 0) { dirs.push({ key: 'pick', label: '', dir: p }); i = dirs.length - 1; $('#tDirSel').insertAdjacentHTML('beforeend', `<option value="${i}"></option>`); }
      dirs[i].dir = p; $('#tDirSel').querySelector(`option[value="${i}"]`).textContent = dirName(dirs[i]); $('#tDirSel').value = String(i); dirShow();
    };
    // fichiers
    $('#tFiles').onclick = e => { const g = e.target.closest('[data-tg]'); if (g) { const k = g.dataset.tg; open.has(k) ? open.delete(k) : open.add(k); draw(); } };
    $('#tFiles').onchange = e => {
      const x = e.target; if (x.dataset.ti != null) x.checked ? sel.add(+x.dataset.ti) : sel.delete(+x.dataset.ti);
      else if (x.dataset.td != null) for (const i of allIn(node(x.dataset.td))) x.checked ? sel.add(i) : sel.delete(i);
      draw(); count();
    };
    const visible = () => { const q = $('#tFilter').value.trim().toLowerCase(); return info.files.filter(f => !q || String(f.path).toLowerCase().includes(q)).map(f => f.i); };
    $('#tFilter').oninput = draw;
    $('#tAll').onclick = () => { visible().forEach(i => sel.add(i)); draw(); count(); };
    $('#tNone').onclick = () => { visible().forEach(i => sel.delete(i)); draw(); count(); };
    $('#tVideos').onclick = () => { sel = new Set(info.files.filter(f => VID.test(f.path)).map(f => f.i)); draw(); count(); };
    if (api.back) $('#tBack').onclick = api.back;
    $('#tSaveFile').onclick = async () => { try { const f = await api.saveFile(info.torrentFile, info.name); if (f) api.toast?.(TF('Enregistré : {0}', f)); } catch (e) { api.toast?.(T(e.message)); } };
    $('#tOk').onclick = async () => {
      const c = count(); if (!c.length) return api.toast?.(T('Sélectionne au moins un fichier'));
      const d0 = dirNow(), dir = d0.key === 'auto' ? '' : d0.dir, rem = $('#tRemember').checked;
      $('#tOk').disabled = true;
      try {
        await Promise.resolve(api.prefs({ remember: rem, lastDir: rem ? dir : '', noAsk: $('#tNoAsk').checked })).catch(() => {});
        const d = await api.add({ ...info, selected: c.length === info.files.length ? null : c, dir, sequential: $('#tSeq').checked, firstLast: $('#tFL').checked, top: $('#tTop').checked, startNow: $('#tStart').checked, seedAfter: $('#tSeed').checked, schedule: $('#tSchedule').checked });
        api.done?.(d);
      } catch (e) { api.toast?.(T(e.message)); }
      $('#tOk').disabled = false;
    };
    // départ
    draw(); count();
    Promise.resolve(api.dirs()).catch(() => ({ list: [], remember: false })).then(r => {
      dirs = r.list || []; $('#tRemember').checked = !!r.remember;
      $('#tDirSel').innerHTML = dirs.map((d, i) => `<option value="${i}">${esc(dirName(d))}</option>`).join('');
      const last = dirs.findIndex(d => d.key === 'last');
      $('#tDirSel').value = r.remember && last >= 0 ? String(last) : '0';
      dirShow();
    });
  }
  window.TorrentAdd = { mount };
})();
