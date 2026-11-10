/* dryae://settings — paramètres du navigateur */
let C = null, STATS = null, OCR = null, ABOUT = null, LANGS = [];
shell('Paramètres', null, 'Rechercher dans les paramètres');
const search = $('#q');
const SECS = [
  ['startup', 'power', 'Au démarrage'], ['look', 'palette', 'Apparence'], ['search', 'search', 'Moteur de recherche'], ['autofill', 'key', 'Saisie automatique et mots de passe'],
  ['privacy', 'shield', 'Confidentialité et sécurité'], ['downloads', 'dl', 'Téléchargements'], ['langs', 'lang', 'Langues'],
  ['-', '', 'Extensions intégrées'], ['adblock', 'shield', 'Bloqueur de publicités'], ['translate', 'translate', 'Traducteur'], ['scan', 'scan', 'Traducteur de scans'], ['lights', 'bulb', 'Lumières tamisées'], ['pip', 'pip', "Image dans l'image"],
  ['-', '', ''], ['system', 'sys', 'Système'], ['reset', 'reload', 'Réinitialiser'], ['extensions', 'puzzle', 'Extensions'], ['about', 'info', 'À propos de DrYAE'],
];
$('#nav').innerHTML = SECS.map(([id, i, l]) => id === '-' ? (l ? `<h5>${esc(TR(l))}</h5>` : '<hr>') : `<button data-s="${id}">${ic(i)}<span>${esc(TR(l))}</span></button>`).join('');
$('#nav').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; if (b.dataset.s === 'extensions') return D.call('openPage', 'extensions'); show(b.dataset.s); };
function show(id) { const el = $('#s-' + id); if (!el) return; el.scrollIntoView({ block: 'start' }); mark(id); history.replaceState(null, '', '#' + id); }
function mark(id) { $$('#nav [data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === id)); }
$('#main').addEventListener('scroll', () => { const secs = $$('[id^="s-"]'); let cur = secs[0]; for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s; if (cur) mark(cur.id.slice(2)); });
search.oninput = () => {
  const v = search.value.trim().toLowerCase();
  $$('.pcard .prow, .pcard .cbx').forEach(r => { r.style.display = !v || r.textContent.toLowerCase().includes(v) ? '' : 'none'; });
  $$('[id^="s-"]').forEach(s => { const any = !v || s.querySelector('h2').textContent.toLowerCase().includes(v) || $$('.prow, .cbx', s).some(r => r.style.display !== 'none'); s.style.display = any ? '' : 'none'; if (v && s.querySelector('h2').textContent.toLowerCase().includes(v)) $$('.prow, .cbx', s).forEach(r => (r.style.display = '')); });
};
const B = () => C;
const setB = async patch => { C = await call('setBrowser', patch); };
const setRoot = async patch => { C = await call('setRoot', patch); };
const setMod = async (id, patch) => { await call('setModule', id, patch); C = await call('cfg'); };
const row = (t, s, ctl, attrs = '') => `<div class="prow" ${attrs}><div class="tx"><b>${esc(TR(t))}</b>${s ? `<span>${esc(TR(s))}</span>` : ''}</div>${ctl}</div>`;
const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(TR(l))}</option>`).join('')}</select>`;
const sec = (id, title, body, desc = '') => `<section id="s-${id}" style="scroll-margin-top:10px"><div class="phead" style="margin-top:${id === 'startup' ? 0 : 28}px"><h2>${esc(TR(title))}</h2>${desc ? `<p>${esc(TR(desc))}</p>` : ''}</div><div class="pcard">${body}</div></section>`;
const modRow = id => { const m = C.mods[id] || {}; return m.installed === false ? row('Extension retirée', 'Rajoutez-la depuis la page des extensions.', `<button class="btn sm" data-goext>${esc(TR('Gérer les extensions'))}</button>`) : row('Activer', '', sw('mod_' + id, m.enabled !== false)) + row('Bouton dans la barre d\'outils', '', sw('pin_' + id, m.pinned !== false)); };
const TLANGS = ['fr', 'en', 'es', 'pt', 'ru', 'ar', 'de', 'it', 'nl', 'pl', 'tr', 'uk', 'ro', 'el', 'sv', 'ja', 'ko', 'zh-CN', 'zh-TW', 'hi', 'id', 'vi', 'th', 'fa', 'he', 'sw', 'ha', 'yo', 'wo', 'ln'];
const lname = c => { try { const n = new Intl.DisplayNames([(window.I18N && I18N.lang) || 'fr'], { type: 'language' }).of(c); return n.charAt(0).toUpperCase() + n.slice(1); } catch { return c; } };
const langOpts = (withAuto) => [...(withAuto ? [['', 'Langue de DrYAE']] : []), ...TLANGS.map(c => [c, lname(c)])];

async function load() {
  C = await call('cfg'); STATS = await call('adStats'); OCR = await call('ocrLangs'); ABOUT = await call('about'); LANGS = await call('languages');
  draw();
  const h = location.hash.replace('#', ''); if (h) setTimeout(() => show(h), 50); else mark('startup');
}
function draw() {
  const b = C, T2 = b.translate || {}, S = b.scan || {}, L = b.lights || {}, P = b.pip || {}, AL = b.adLists || {}, N = b.nativeDl || {};
  const theme = b.rawTheme || {};
  const startPages = (b.startupPages || []);
  const hides = STATS.hides || {};
  const upd = ABOUT.update || {};
  const updTxt = { checking: 'Recherche de mises à jour…', available: 'DrYAE {0} est disponible.', downloading: 'Téléchargement de la mise à jour… {0} %', ready: 'La mise à jour {0} est prête.', latest: 'DrYAE est à jour.', error: 'Vérification impossible.' }[upd.status] || '';
  $('#wrap').innerHTML =
    sec('startup', 'Au démarrage', `
      <label class="cbx" style="padding:12px 18px"><input type="radio" name="st" value="restore" ${b.startup === 'restore' || !b.startup ? 'checked' : ''}><div><b>${esc(TR('Reprendre là où je m\'étais arrêté'))}</b><span>${esc(TR('Les onglets ouverts sont rouverts (chargés au moment où vous les affichez).'))}</span></div></label>
      <label class="cbx" style="padding:12px 18px;border-top:1px solid var(--line)"><input type="radio" name="st" value="newtab" ${b.startup === 'newtab' ? 'checked' : ''}><div><b>${esc(TR('Ouvrir la page d\'accueil de DrYAE'))}</b></div></label>
      <label class="cbx" style="padding:12px 18px;border-top:1px solid var(--line)"><input type="radio" name="st" value="pages" ${b.startup === 'pages' ? 'checked' : ''}><div><b>${esc(TR('Ouvrir des pages précises'))}</b><span>${esc(TR('Une adresse par ligne.'))}</span></div></label>
      <div class="prow" style="${b.startup === 'pages' ? '' : 'display:none'}" id="spRow"><textarea id="sp" placeholder="https://www.exemple.com" style="font:inherit;min-height:70px">${esc(startPages.join('\n'))}</textarea></div>`) +
    sec('look', 'Apparence', `
      ${row('Thème', 'Le thème s\'applique au navigateur et au gestionnaire.', sel('theme', [['dark', 'Sombre'], ['light', 'Clair'], ['amoled', 'Noir (AMOLED)'], ['system', 'Comme Windows']], theme.mode || 'dark'))}
      ${row('Couleur d\'accent', 'La couleur choisie dans Windows, ou la vôtre.', `<label class="hint" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="accSys" ${!theme.accent || theme.accent === 'system' ? 'checked' : ''}> ${esc(TR('Couleur de Windows'))}</label><input type="color" id="acc" value="${/^#[0-9a-f]{6}$/i.test(theme.accent || '') ? theme.accent : '#8b5cf6'}" style="width:44px;height:30px;padding:2px;border-radius:6px">`)}
      ${row('Afficher la barre de favoris', 'Raccourci : Ctrl+Maj+B', sw('bar', b.showBookmarksBar))}
      ${row('Afficher le bouton Accueil', '', sw('home', b.showHome !== false))}`) +
    sec('search', 'Moteur de recherche', `
      ${row('Moteur de recherche utilisé dans la barre d\'adresse', '', sel('eng', [['google', 'Google'], ['bing', 'Bing'], ['duckduckgo', 'DuckDuckGo'], ['qwant', 'Qwant'], ['brave', 'Brave'], ['ecosia', 'Ecosia'], ['startpage', 'Startpage'], ['yahoo', 'Yahoo']], b.search))}`) +
    sec('autofill', 'Saisie automatique et mots de passe', `
      <div class="prow click" data-page="passwords"><span>${ic('key')}</span><div class="tx"><b>${esc(TR('Gestionnaire de mots de passe'))}</b><span>${esc(TR('Mots de passe enregistrés, vérification, sites refusés'))}</span></div><span class="chev">${ic('open')}</span></div>
      <div class="prow click" data-page="passwords#cards"><span>${ic('card')}</span><div class="tx"><b>${esc(TR('Modes de paiement'))}</b><span>${esc(TR('Cartes enregistrées et confirmation par Windows Hello'))}</span></div><span class="chev">${ic('open')}</span></div>
      <div class="prow click" data-page="passwords#addresses"><span>${ic('pin')}</span><div class="tx"><b>${esc(TR('Adresses et coordonnées'))}</b><span>${esc(TR('Pour remplir les formulaires en un clic'))}</span></div><span class="chev">${ic('open')}</span></div>`) +
    sec('privacy', 'Confidentialité et sécurité', `
      <div class="prow click" data-page="history#clear"><span>${ic('trash')}</span><div class="tx"><b>${esc(TR('Effacer les données de navigation'))}</b><span>${esc(TR('Historique, cookies, cache… (Ctrl+Maj+Suppr)'))}</span></div><span class="chev">${ic('open')}</span></div>
      ${row('Effacer l\'historique et les cookies en fermant DrYAE', '', sw('clrExit', b.clearOnExit))}
      ${row('Bloquer les fenêtres pop-up', 'Un message propose de les ouvrir quand même.', sw('pop', b.blockPopups))}
      ${row('Transmettre les cookies du navigateur aux téléchargements', 'Nécessaire pour les sites où il faut être connecté.', sw('cook', b.cookies))}
      ${row('DNS sécurisé', 'Appliqué au prochain démarrage.', sel('doh', [['', 'Désactivé (DNS de Windows)'], ['https://cloudflare-dns.com/dns-query', 'Cloudflare'], ['https://dns.google/dns-query', 'Google'], ['https://dns.quad9.net/dns-query', 'Quad9'], ['https://dns.adguard-dns.com/dns-query', 'AdGuard (bloque les pubs)']], b.doh))}`) +
    sec('downloads', 'Téléchargements', `
      ${row('Téléchargements par DrYAE', 'Activé : les fichiers passent par le gestionnaire DrYAE (reprise, vitesse, formats des vidéos). Désactivé : le navigateur télécharge lui-même, comme un navigateur ordinaire.', sw('mod_capture', C.mods.capture?.on))}
      <div ${C.mods.capture?.on ? 'style="display:none"' : ''}>
        ${row('Dossier des téléchargements du navigateur', N.dir || TR('Dossier « Téléchargements » de Windows'), `<button class="btn sm" id="ndDir">${esc(TR('Modifier'))}</button>`)}
        ${row('Toujours demander où enregistrer chaque fichier', '', sw('ndAsk', N.ask))}
      </div>
      <div class="prow click" id="mgrDl"><span>${ic('gear')}</span><div class="tx"><b>${esc(TR('Paramètres du gestionnaire de téléchargements'))}</b><span>${esc(TR('Dossier, connexions, vitesse, vidéos, torrents…'))}</span></div><span class="chev">${ic('open')}</span></div>`) +
    sec('langs', 'Langues', `
      ${row('Langue de DrYAE', 'Le navigateur et le gestionnaire se rechargent.', sel('lang', LANGS.map(l => [l.code, l.name]), C.lang))}
      ${row('Langue de traduction', 'Langue dans laquelle les pages, les textes et les scans sont traduits.', sel('trTo', langOpts(true), T2.target || ''))}`) +
    sec('adblock', 'Bloqueur de publicités', `
      ${modRow('adblock')}
      ${row('Éléments bloqués depuis l\'ouverture', '', `<span class="tag">${STATS.total}</span>`)}
      <div class="prow" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${esc(TR('Listes de filtres'))}</b><span>${esc(TR('Les listes sont mises à jour tous les 4 jours.'))} ${b.adblockUpdated ? esc(TRF('Dernière mise à jour : {0}', new Date(b.adblockUpdated).toLocaleString(LOC()))) : ''}</span></div>
        <label class="cbx"><input type="checkbox" checked disabled><div><b>${esc(TR('Publicités'))}</b><span>${esc(TR('Toujours active'))}</span></div></label>
        ${[['privacy', 'Traqueurs et statistiques', 'Empêche le suivi d\'un site à l\'autre.'], ['cookies', 'Bannières de cookies', 'Masque les demandes de consentement aux cookies.'], ['annoyances', 'Éléments gênants', 'Fenêtres d\'inscription, bulles de discussion, incitations à installer une appli…'], ['regional', 'Liste française', 'Publicités des sites en français.'], ['malware', 'Sites malveillants', 'Bloque les adresses connues pour diffuser des logiciels malveillants.']].map(([k, l, s]) => `<label class="cbx"><input type="checkbox" data-al="${k}" ${AL[k] ? 'checked' : ''}><div><b>${esc(TR(l))}</b><span>${esc(TR(s))}</span></div></label>`).join('')}
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button class="btn sm" id="adUpd">${ic('reload')}${esc(TR('Mettre à jour les filtres maintenant'))}</button><span class="hint" id="adSt"></span></div></div>
      ${row('Sites autorisés', 'Le bloqueur est désactivé sur ces sites (bouclier → « Désactiver le bloqueur sur ce site »).', '')}
      ${(b.whitelist || []).map(h => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><button class="icon-btn" data-wl="${esc(h)}">${ic('x')}</button></div>`).join('')}
      ${row('Éléments masqués à la main', 'Clic droit sur un élément → « Masquer cet élément… ».', '')}
      ${Object.entries(hides).map(([h, l]) => `<div class="prow" style="padding-left:40px"><div class="tx"><b class="notr">${esc(h)}</b><span class="mono notr" style="word-break:break-all">${l.map(esc).join('<br>')}</span></div><button class="btn sm" data-hide="${esc(h)}">${esc(TR('Tout réafficher'))}</button></div>`).join('') || ''}
      <div class="prow" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${esc(TR('Listes supplémentaires'))}</b><span>${esc(TR('Une adresse de liste par ligne.'))}</span></div><textarea id="adLists" spellcheck="false">${esc((b.filterLists || []).join('\n'))}</textarea>
        <div class="tx" style="margin-top:8px"><b>${esc(TR('Filtres personnalisés'))}</b><span>${esc(TR('Syntaxe Adblock, un filtre par ligne. Exemple : ||pub.exemple.com^'))}</span></div><textarea id="adCustom" spellcheck="false">${esc(b.customFilters || '')}</textarea>
        <div style="margin-top:8px"><button class="btn sm primary" id="adSave">${esc(TR('Enregistrer les listes et les filtres'))}</button></div></div>`, 'Bloque les publicités et les traqueurs. Vous pouvez le retirer pour utiliser votre propre extension de blocage.') +
    sec('translate', 'Traducteur', `
      ${modRow('translate')}
      ${row('Texte sélectionné', 'Ce qui se passe quand vous sélectionnez du texte sur une page.', sel('trSel', [['button', 'Afficher un bouton « Traduire »'], ['auto', 'Traduire tout de suite'], ['off', 'Rien (clic droit ou Ctrl+Maj+E)']], T2.selection || 'button'))}
      ${row('Service de traduction', '', sel('trProv', [['google', 'Google Traduction (gratuit, sans compte)'], ['deepl', 'DeepL (clé API personnelle)'], ['libre', 'LibreTranslate (serveur au choix)']], T2.provider || 'google'))}
      <div id="trDeepl" ${T2.provider === 'deepl' ? '' : 'style="display:none"'}>${row('Clé API DeepL', 'Gratuite jusqu\'à 500 000 caractères par mois sur deepl.com.', `<input type="password" id="trKey" value="${esc(T2.deeplKey || '')}" spellcheck="false">`)}</div>
      <div id="trLibre" ${T2.provider === 'libre' ? '' : 'style="display:none"'}>${row('Adresse du serveur LibreTranslate', '', `<input type="url" id="trUrl" value="${esc(T2.libreUrl || '')}" placeholder="https://…" spellcheck="false">`)}${row('Clé API (si le serveur en demande une)', '', `<input type="password" id="trLKey" value="${esc(T2.libreKey || '')}" spellcheck="false">`)}</div>
      ${row('Langue de traduction', '', sel('trTo2', langOpts(true), T2.target || ''))}`, 'Traduit le texte sélectionné ou la page entière. Le texte est envoyé au service choisi.') +
    sec('scan', 'Traducteur de scans', `
      ${modRow('scan')}
      ${row('Langue du texte dans les images', 'La première fois, les données de lecture de cette langue sont téléchargées (2 à 15 Mo).', sel('scSrc', Object.entries(OCR.langs).map(([k, l]) => [k, TR(l) + (OCR.have.includes(k) ? ' ✓' : '')]), S.source || 'eng'))}
      ${row('Traduire vers', '', sel('scTo', langOpts(true), S.target || ''))}
      <div class="prow"><div class="tx"><span>${esc(TR('Utilisation : bouton du traducteur de scans dans la barre d\'outils (ou Ctrl+Maj+S) pour toutes les images de la page, ou clic droit sur une image → « Traduire le texte de l\'image ». Cliquez sur une bulle traduite pour revoir le texte d\'origine.'))}</span></div></div>`, 'Lit le texte des images (mangas, manhwas, webtoons…) et place la traduction sur chaque bulle. La lecture se fait sur ce PC ; seul le texte trouvé est envoyé au service de traduction.') +
    sec('lights', 'Lumières tamisées', `
      ${modRow('lights')}
      ${row('Opacité de l\'assombrissement', '', `<input type="range" id="liOp" min="40" max="97" value="${L.opacity || 85}" style="width:200px"><b id="liOpV" style="width:44px;text-align:right">${L.opacity || 85} %</b>`)}
      ${row('Couleur', '', `<input type="color" id="liCol" value="${/^#[0-9a-f]{6}$/i.test(L.color || '') ? L.color : '#000000'}" style="width:44px;height:30px;padding:2px;border-radius:6px">`)}
      ${row('Éteindre automatiquement quand une vidéo démarre', 'Et rallumer à la pause.', sw('liAuto', L.auto))}
      ${row('Sites en mode nuit', 'Menu ⋮ → Outils supplémentaires → « Mode nuit sur ce site ».', '')}
      ${(L.nightHosts || []).map(h => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><button class="icon-btn" data-night="${esc(h)}">${ic('x')}</button></div>`).join('')}`, 'Assombrit la page autour de la vidéo. Cliquez à côté de la vidéo ou appuyez sur Échap pour rallumer.') +
    sec('pip', "Image dans l'image", `
      ${modRow('pip')}
      ${row('Position du bouton sur les vidéos', '', sel('pipSide', [['left', 'En haut à gauche'], ['right', 'En haut à droite']], P.side || 'left'))}
      ${row('Sites où le bouton est masqué', '', '')}
      ${(P.hidden || []).map(h => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><button class="icon-btn" data-piph="${esc(h)}">${ic('x')}</button></div>`).join('')}`, 'Un bouton apparaît quand la souris passe sur une vidéo : la vidéo continue dans une petite fenêtre au-dessus des autres.') +
    sec('system', 'Système', `
      ${row('Mode d\'affichage des sites', '', sel('ua', [['desktop', 'Ordinateur'], ['mobile', 'Mobile']], b.ua))}
      ${row('Détecter les sous-titres', 'Dans le panneau des fichiers détectés.', sw('subs', b.captureSubtitles))}
      ${row('Types de fichiers supplémentaires à détecter', '', `<input type="text" id="extra" value="${esc(b.sniffExtra || '')}" placeholder="zip,rar,apk,pdf">`)}`) +
    sec('reset', 'Réinitialiser', `
      ${row('Rétablir les paramètres du navigateur par défaut', 'Les favoris, l\'historique, les mots de passe et les extensions sont conservés.', `<button class="btn sm danger" id="reset">${esc(TR('Réinitialiser'))}</button>`)}`) +
    sec('about', 'À propos de DrYAE', `
      <div class="prow"><img src="/_assets/logo.png" style="width:48px;height:48px;border-radius:12px" alt=""><div class="tx"><b style="font-size:15px">DrYAE ${esc(ABOUT.version)}</b><span>${esc(TR('Logiciel libre (GPL-3.0)'))} · Chromium ${esc(ABOUT.chrome)}</span></div></div>
      <div class="prow"><div class="tx"><b id="updTxt">${esc(TRF(updTxt, upd.status === 'downloading' ? Math.round(upd.progress || 0) : upd.version || ''))}</b><span>${upd.error ? esc(upd.error) : ''}</span></div><button class="btn sm" id="updChk">${esc(TR('Rechercher des mises à jour'))}</button>${['available', 'ready'].includes(upd.status) ? `<button class="btn sm primary" id="updGo">${esc(TR(upd.status === 'ready' ? 'Redémarrer et installer' : 'Mettre à jour'))}</button>` : ''}</div>
      <div class="prow click" data-url="https://github.com/DrYAE-FPA/DrYAE"><div class="tx"><b>${esc(TR('Code source et nouveautés'))}</b><span>github.com/DrYAE-FPA/DrYAE</span></div><span class="chev">${ic('open')}</span></div>
      <div class="prow click" data-url="https://github.com/DrYAE-FPA/DrYAE/blob/main/docs/GUIDE.md"><div class="tx"><b>${esc(TR('Mode d\'emploi'))}</b></div><span class="chev">${ic('open')}</span></div>
      <div class="prow"><div class="tx"><span>${esc(TR('Ne téléchargez que ce que vous avez le droit de copier.'))}</span></div></div>`);
  bind();
  search.oninput();
}
function bind() {
  const w = $('#wrap');
  const v = id => $('#' + id);
  w.onchange = async e => {
    const t = e.target, id = t.id;
    if (t.name === 'st') { await setB({ startup: t.value }); await setRoot({ restoreSession: t.value === 'restore' }); v('spRow').style.display = t.value === 'pages' ? '' : 'none'; }
    else if (id === 'sp') await setB({ startupPages: t.value.split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => (/^[a-z]+:\/\//i.test(x) ? x : 'https://' + x)) });
    else if (id === 'theme') await setRoot({ theme: { ...(C.rawTheme || {}), mode: t.value } });
    else if (id === 'acc' || id === 'accSys') await setRoot({ theme: { ...(C.rawTheme || {}), accent: v('accSys').checked ? 'system' : v('acc').value } });
    else if (id === 'bar') await setB({ showBookmarksBar: t.checked });
    else if (id === 'home') await setB({ showHome: t.checked });
    else if (id === 'eng') await setB({ search: t.value });
    else if (id === 'clrExit') await setB({ clearOnExit: t.checked });
    else if (id === 'pop') await setB({ blockPopups: t.checked });
    else if (id === 'cook') await setB({ cookies: t.checked });
    else if (id === 'doh') await setB({ doh: t.value });
    else if (id === 'ndAsk') await setB({ nativeDl: { ...(C.nativeDl || {}), ask: t.checked } });
    else if (id === 'lang') { await setRoot({ lang: t.value }); }
    else if (id === 'trTo' || id === 'trTo2') await setB({ translate: { ...(C.translate || {}), target: t.value } });
    else if (id === 'trSel') await setB({ translate: { ...(C.translate || {}), selection: t.value } });
    else if (id === 'trProv') { await setB({ translate: { ...(C.translate || {}), provider: t.value } }); v('trDeepl').style.display = t.value === 'deepl' ? '' : 'none'; v('trLibre').style.display = t.value === 'libre' ? '' : 'none'; return; }
    else if (id === 'trKey') await setB({ translate: { ...(C.translate || {}), deeplKey: t.value.trim() } });
    else if (id === 'trUrl') await setB({ translate: { ...(C.translate || {}), libreUrl: t.value.trim() } });
    else if (id === 'trLKey') await setB({ translate: { ...(C.translate || {}), libreKey: t.value.trim() } });
    else if (id === 'scSrc') await setB({ scan: { ...(C.scan || {}), source: t.value } });
    else if (id === 'scTo') await setB({ scan: { ...(C.scan || {}), target: t.value } });
    else if (id === 'liOp') await setB({ lights: { ...(C.lights || {}), opacity: +t.value } });
    else if (id === 'liCol') await setB({ lights: { ...(C.lights || {}), color: t.value } });
    else if (id === 'liAuto') await setB({ lights: { ...(C.lights || {}), auto: t.checked } });
    else if (id === 'pipSide') await setB({ pip: { ...(C.pip || {}), side: t.value } });
    else if (id === 'ua') await setB({ ua: t.value });
    else if (id === 'subs') await setB({ captureSubtitles: t.checked });
    else if (id === 'extra') await setB({ sniffExtra: t.value });
    else if (t.dataset.al) await setB({ adLists: { ...(C.adLists || {}), [t.dataset.al]: t.checked } });
    else if (id.startsWith('mod_')) { await setMod(id.slice(4), { enabled: t.checked }); if (id === 'mod_capture') draw(); toast(t.checked ? 'Extension activée : actualisez les pages ouvertes' : 'Extension désactivée'); return; }
    else if (id.startsWith('pin_')) await setMod(id.slice(4), { pinned: t.checked });
    else return;
    toast('Paramètre enregistré');
  };
  w.oninput = e => { if (e.target.id === 'liOp') v('liOpV').textContent = e.target.value + ' %'; };
  w.onclick = async e => {
    const g = a => e.target.closest('[data-' + a + ']')?.dataset[a];
    let x;
    if ((x = g('page'))) { const [p, h] = x.split('#'); return D.call('openPage', p, h || ''); }
    if ((x = g('url'))) return D.call('open', x, {});
    if (e.target.closest('[data-goext]')) return D.call('openPage', 'extensions');
    if ((x = g('wl'))) { await setB({ whitelist: (C.whitelist || []).filter(h => h !== x) }); return draw(); }
    if ((x = g('hide'))) { STATS.hides = await call('hideRemove', x); return draw(); }
    if ((x = g('night'))) { await setB({ lights: { ...(C.lights || {}), nightHosts: (C.lights.nightHosts || []).filter(h => h !== x) } }); return draw(); }
    if ((x = g('piph'))) { await setB({ pip: { ...(C.pip || {}), hidden: (C.pip.hidden || []).filter(h => h !== x) } }); return draw(); }
    const id = e.target.closest('button')?.id;
    if (id === 'ndDir') { const d = await call('pickDir', (C.nativeDl || {}).dir); if (d) { await setB({ nativeDl: { ...(C.nativeDl || {}), dir: d } }); draw(); } }
    if (e.target.closest('#mgrDl')) D.call('openManager');
    if (id === 'adUpd') { v('adSt').textContent = TR('Mise à jour…'); const ok = await call('adUpdate').catch(() => false); v('adSt').textContent = TR(ok ? 'Filtres à jour ✔' : 'Impossible de mettre à jour (connexion ?)'); C = await call('cfg'); }
    if (id === 'adSave') { await setB({ filterLists: v('adLists').value.split(/\n+/).map(s => s.trim()).filter(Boolean), customFilters: v('adCustom').value }); toast('Listes enregistrées : mise à jour des filtres en cours'); }
    if (id === 'reset') { if (await confirmBox(TR('Rétablir les paramètres du navigateur par défaut ?'), 'Réinitialiser')) { C = await call('resetBrowser'); draw(); toast('Paramètres réinitialisés'); } }
    if (id === 'updChk') { v('updTxt').textContent = TR('Recherche de mises à jour…'); await call('updateCheck'); ABOUT = await call('about'); draw(); }
    if (id === 'updGo') call('updateInstall');
  };
}
D.on('update-state', async () => { ABOUT = await call('about'); if ($('#s-about')) draw(); });
addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h) show(h); });
load();
