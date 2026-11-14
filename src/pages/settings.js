/* dryae://settings — paramètres du navigateur */
let SAFE = {}, C = null, STATS = null, OCR = null, ABOUT = null, LANGS = [];
shell('Paramètres', null, 'Rechercher dans les paramètres');
const search = $('#q');
const SECS = [
  ['startup', 'power', 'Au démarrage'], ['look', 'palette', 'Apparence'], ['a11y', 'eye', 'Accessibilité'], ['perf', 'power', 'Onglets et performances'], ['work', 'folder', 'Travail et études'], ['keys', 'kbd', 'Raccourcis clavier'], ['search', 'search', 'Moteur de recherche'], ['autofill', 'key', 'Saisie automatique et mots de passe'],
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
// 1.6.5 : réglage générique « groupe.clé » (interrupteur, liste, heure)
const swk = (k, on) => sw('k_' + k.replace(/\./g, '__'), on, `data-k="${k}"`);
const selk = (k, opts, v) => `<select data-k="${k}">${opts.map(([o, l]) => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(TR(l))}</option>`).join('')}</select>`;
const sites = (k, list) => (list || []).map(h => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><button class="icon-btn" data-rm="${k}|${esc(h)}" title="${esc(TR('Retirer'))}">${ic('x')}</button></div>`).join('');
const TLANGS = ['fr', 'en', 'es', 'pt', 'ru', 'ar', 'de', 'it', 'nl', 'pl', 'tr', 'uk', 'ro', 'el', 'sv', 'ja', 'ko', 'zh-CN', 'zh-TW', 'hi', 'id', 'vi', 'th', 'fa', 'he', 'sw', 'ha', 'yo', 'wo', 'ln'];
const lname = c => { try { const n = new Intl.DisplayNames([(window.I18N && I18N.lang) || 'fr'], { type: 'language' }).of(c); return n.charAt(0).toUpperCase() + n.slice(1); } catch { return c; } };
const langOpts = (withAuto) => [...(withAuto ? [['', 'Langue de DrYAE']] : []), ...TLANGS.map(c => [c, lname(c)])];

async function load() {
  C = await call('cfg'); STATS = await call('adStats'); SAFE = await call('safeInfo').catch(() => ({})); OCR = await call('ocrLangs'); ABOUT = await call('about'); LANGS = await call('languages');
  draw();
  const h = location.hash.replace('#', ''); if (h) setTimeout(() => show(h), 50); else mark('startup');
}
function draw() {
  const b = C, T2 = b.translate || {}, S = b.scan || {}, L = b.lights || {}, P = b.pip || {}, AL = b.adLists || {}, N = b.nativeDl || {};
  const theme = b.rawTheme || {};
  const startPages = (b.startupPages || []);
  const AX = b.a11yRaw || {};
  const KMAP = Object.fromEntries((b.keyList || []).map(x => [x.id, x.c]));
  const KEYS = [['newTab', 'Nouvel onglet', 'Ctrl+T'], ['newPrivate', 'Nouvel onglet privé', 'Ctrl+Maj+N'], ['closeTab', 'Fermer l\'onglet', 'Ctrl+W'], ['reopen', 'Rouvrir l\'onglet fermé', 'Ctrl+Maj+T'], ['tabSearch', 'Rechercher dans les onglets', 'Ctrl+Maj+A'], ['nextTab', 'Onglet suivant', 'Ctrl+Tab'], ['prevTab', 'Onglet précédent', 'Ctrl+Maj+Tab'], ['address', 'Aller à la barre d\'adresse', 'Ctrl+L'], ['find', 'Rechercher dans la page', 'Ctrl+F'], ['reload', 'Actualiser', 'F5'], ['back', 'Page précédente', 'Alt+←'], ['forward', 'Page suivante', 'Alt+→'], ['home', 'Accueil', 'Alt+Début'], ['bookmark', 'Ajouter aux favoris', 'Ctrl+D'], ['bookmarks', 'Gestionnaire de favoris', 'Ctrl+Maj+O'], ['bar', 'Barre de favoris', 'Ctrl+Maj+B'], ['history', 'Historique', 'Ctrl+H'], ['downloads', 'Téléchargements', 'Ctrl+J'], ['extensions', 'Extensions', 'Ctrl+Maj+X'], ['settings', 'Paramètres', ''], ['zoomIn', 'Zoom +', 'Ctrl++'], ['zoomOut', 'Zoom −', 'Ctrl+-'], ['zoomReset', 'Zoom 100 %', 'Ctrl+0'], ['fullscreen', 'Plein écran', 'F11'], ['print', 'Imprimer', 'Ctrl+P'], ['mute', 'Couper le son de l\'onglet', 'Ctrl+M'], ['reader', 'Mode lecture', 'F9'], ['speak', 'Lire la page à voix haute', 'F8'], ['translate', 'Traduire', 'Ctrl+Maj+E'], ['scanZone', 'Traduire une zone (scans)', 'Ctrl+Maj+S'], ['lights', 'Lumières tamisées', 'Ctrl+Maj+L'], ['side', 'Panneau latéral', ''], ['newWindow', 'Nouvelle fenêtre', 'Ctrl+N'], ['palette', 'Palette de commandes', 'Ctrl+K'], ['spaces', 'Espaces de travail', ''], ['cols', 'Collections', ''], ['cite', 'Citer cette page', ''], ['present', 'Mode présentation', ''], ['focus', 'Mode concentration', ''], ['shot', 'Capture de la page entière', ''], ['offline', 'Garder la page hors ligne', ''], ['qr', 'Code QR de la page', ''], ['tasks', 'Gestionnaire des tâches', 'Maj+Échap'], ['manager', 'Gestionnaire de téléchargements', '']];
  const KWDEF = [{ k: 'w', url: 'https://fr.wikipedia.org/w/index.php?search=%s' }, { k: 'yt', url: 'https://www.youtube.com/results?search_query=%s' }, { k: 'gh', url: 'https://github.com/search?q=%s' }];
  const R = b.root || {};
  const NET = () => [
    ['Recherche des nouvelles versions de DrYAE', 'Au démarrage puis toutes les quelques heures, vers github.com. Rien d\'autre n\'est envoyé que la demande de la dernière version.', `<label class="sw"><input type="checkbox" data-root="autoUpdateCheck" ${R.autoUpdateCheck !== false ? 'checked' : ''}><i></i></label>`],
    ['Listes du bloqueur de publicités', 'Tous les 4 jours, depuis les sites des listes choisies.', swk('adAutoUpdate', b.adAutoUpdate !== false)],
    ['Liste des sites dangereux', 'Une fois par semaine, depuis github.com (environ 10 Mo).', swk('safeBrowsing', b.safeBrowsing !== false)],
    ['Mises à jour des extensions Chrome', 'Depuis le Chrome Web Store, pour les extensions installées.', swk('extAutoUpdate', b.extAutoUpdate !== false)],
    ['Trackers supplémentaires pour les torrents', 'Au démarrage, une liste publique de serveurs de contact (rend les torrents plus rapides).', `<label class="sw"><input type="checkbox" data-root="torrent.fetchTrackers" ${R.fetchTrackers !== false ? 'checked' : ''}><i></i></label>`],
    ['Traduction', 'Seulement quand vous traduisez : le texte choisi est envoyé au service de traduction choisi (Paramètres → Traducteur).', ''],
    ['Lecture des images et modèles de lecture', 'Seulement la première fois qu\'une langue est utilisée ou téléchargée : les données de lecture sont téléchargées puis gardées sur ce PC. Les images, elles, ne quittent jamais ce PC.', ''],
    ['Traduction IA des scans (facultative)', 'Seulement si vous l\'activez avec votre propre clé : l\'image de la page et le texte lu sont envoyés à Google Gemini.', ''],
    ['Vérification des mots de passe divulgués', 'Seulement quand vous la lancez : 5 caractères de l\'empreinte de chaque mot de passe (jamais le mot de passe lui-même).', ''],
    ['Icônes des sites', 'Demandées au site que vous visitez, comme le ferait la page elle-même.', ''],
    ['Nombre de téléchargements de DrYAE', 'Seulement quand vous ouvrez « À propos de DrYAE » : le total public est demandé à github.com (une fois par jour au plus). Rien ne vous identifie.', ''],
    ['Taux de change', 'Seulement quand vous tapez une conversion de monnaie dans la barre d\'adresse (par exemple « 30 euros en FCFA ») : les taux du jour sont demandés au site public open.er-api.com, au plus deux fois par jour. Rien d\'autre n\'est envoyé.', ''],
    ['Correcteur d\'orthographe', 'Sous Windows, DrYAE utilise le correcteur de Windows : rien n\'est envoyé ni téléchargé.', ''],
  ];
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
    sec('a11y', 'Accessibilité', `
      ${row('Taille du texte de DrYAE', 'Menus, barre d\'outils et gestionnaire (les pages web gardent leur zoom : Ctrl + / Ctrl −).', `<input type="range" id="a11yScale" min="80" max="200" step="10" value="${AX.scale || 100}" style="width:200px" aria-label="${esc(TR('Taille du texte de DrYAE'))}"><b id="a11yScaleV" style="width:52px;text-align:right">${AX.scale || 100} %</b>`)}
      ${row('Contraste élevé', 'Texte blanc sur fond noir, contours épais. « Comme Windows » suit le thème de contraste de Windows.', sel('a11yContrast', [['auto', 'Comme Windows'], ['on', 'Activé'], ['off', 'Désactivé']], AX.contrast || 'auto'))}
      ${row('Lecture facilitée', 'Police simple, lettres et mots plus espacés, dans DrYAE et dans les pages (aide les personnes dyslexiques).', sw('a11yEasy', !!AX.easy))}
      ${row('Réduire les animations', '« Comme Windows » suit le réglage « Effets d\'animation » de Windows.', sel('a11yMotion', [['auto', 'Comme Windows'], ['on', 'Activé'], ['off', 'Désactivé']], AX.motion || 'auto'))}
      ${row('Mode simple', 'Seulement les boutons essentiels. Les fonctions avancées restent dans les Paramètres.', sw('a11ySimple', !!AX.simple))}
      ${row('Clavier', 'Tab : élément suivant · F6 : barre d\'adresse, boutons, page · Alt+F : menu · Échap : fermer · F1 : tous les raccourcis.', `<button class="btn sm" id="a11yKeys">${esc(TR('Raccourcis clavier'))}</button>`)}
      ${row('Lecteurs d\'écran', 'DrYAE fonctionne avec les lecteurs d\'écran (par exemple NVDA, gratuit, ou le Narrateur de Windows : Ctrl+Windows+Entrée).', '')}`, 'Pour que chacun puisse utiliser DrYAE confortablement.') +
    sec('perf', 'Onglets et performances', `
      ${row('Économiseur de mémoire', 'Les onglets que vous n\'utilisez pas sont mis en veille et se rechargent quand vous y revenez. Jamais pour un onglet qui joue du son, une vidéo en image dans l\'image ou un formulaire en cours.', selk('tabsx.memSaver', [['off', 'Désactivé'], ['light', 'Léger (après 1 heure)'], ['balanced', 'Équilibré (après 20 minutes)'], ['max', 'Maximal (après 5 minutes)']], (b.tabsx || {}).memSaver || 'balanced'))}
      ${row('Sites toujours actifs', 'Jamais mis en veille (musique, messagerie…). Un nom de site par ligne.', `<textarea id="keepAct" style="font:inherit;min-height:54px;width:260px" placeholder="exemple.com">${esc(((b.tabsx || {}).keepActive || []).join('\n'))}</textarea>`)}
      ${row('Économiseur d\'énergie', 'Ralentit les onglets en arrière-plan et les animations pour que la batterie dure plus longtemps.', selk('tabsx.energy', [['battery', 'Quand l\'ordinateur est sur batterie'], ['always', 'Toujours'], ['off', 'Jamais']], (b.tabsx || {}).energy || 'battery'))}
      ${row('Économiseur de données', 'Pour les forfaits internet limités : pas de vidéo lancée toute seule, pages allégées quand le site le permet, mises à jour en arrière-plan suspendues.', swk('dataSaver', !!b.dataSaver))}
      ${row('Aperçu de l\'onglet au survol', 'Petite image de la page, son adresse et la mémoire utilisée.', `<label class="sw"><input type="checkbox" data-k="tabsx.preview" ${(b.tabsx || {}).preview !== false ? 'checked' : ''}><i></i></label>`)}
      ${row('Onglets verticaux', 'La liste des onglets à gauche plutôt qu\'en haut.', `<label class="sw"><input type="checkbox" data-k="tabsx.vertical" ${(b.tabsx || {}).vertical ? 'checked' : ''}><i></i></label>`)}
      ${row('Gestionnaire des tâches', 'Mémoire et processeur utilisés par chaque onglet et chaque extension (Maj+Échap).', `<button class="btn sm" data-page="tasks">${esc(TR('Ouvrir'))}</button>`)}`, 'Pour que DrYAE reste rapide, même sur un ordinateur modeste.') +
    sec('work', 'Travail et études', `
      ${row('Rappels de pause', 'Un petit rappel pendant que vous utilisez DrYAE : reposer les yeux (regarder au loin 20 secondes) et se lever. Le temps ne compte pas quand l\'ordinateur n\'est pas utilisé.', swk('breaks.on', (b.breaks || {}).on !== false))}
      ${row('Repos des yeux toutes les', 'minutes', `<input type="number" data-k="breaks.eye" min="10" max="120" value="${+(b.breaks || {}).eye || 20}" style="width:80px">`)}
      ${row('Se lever toutes les', 'minutes', `<input type="number" data-k="breaks.stand" min="30" max="240" value="${+(b.breaks || {}).stand || 60}" style="width:80px">`)}
      ${row('Onglets inactifs', 'Proposer de ranger les onglets que vous n\'avez pas ouverts depuis plusieurs jours. Ils restent dans « Espaces de travail → Onglets inactifs » pour les rouvrir.', swk('inactive.on', (b.inactive || {}).on !== false) + ` <input type="number" data-k="inactive.days" min="1" max="60" value="${+(b.inactive || {}).days || 7}" style="width:70px"> ${esc(TR('jours'))}`)}
      ${row('Correcteur d\'orthographe', 'Souligne les fautes dans les zones de texte des pages ; propositions au clic droit. Sous Windows, DrYAE utilise le correcteur de Windows : rien n\'est téléchargé.', swk('spell.on', (b.spell || {}).on !== false))}
      ${row('Rechercher aussi dans le texte des pages visitées', 'L\'historique retrouve une page par un mot qu\'elle contenait. Le texte est gardé sur ce PC seulement, jamais dans les onglets privés, et effacé avec l\'historique.', swk('histText', b.histText !== false))}
      <div class="prow" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${esc(TR('Conteneurs'))}</b><span>${esc(TR('Un onglet dans un conteneur a ses propres cookies : vous pouvez être connecté à deux comptes du même site en même temps. Clic droit sur un onglet : « Rouvrir dans un conteneur ».'))}</span></div>
        ${[['c1', '#3b82f6'], ['c2', '#22c55e'], ['c3', '#f97316'], ['c4', '#ec4899']].map(([id, col], i) => `<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><i style="width:12px;height:12px;border-radius:50%;background:${col};flex:none"></i><input id="ctn_${id}" maxlength="30" value="${esc((b.containers || {})[id] || '')}" placeholder="${esc(TR('Conteneur {0}').replace('{0}', i + 1))}" style="flex:1;max-width:260px"><button class="btn sm" data-ctnclear="${id}">${ic('trash')}${esc(TR('Effacer ses cookies et données'))}</button></div>`).join('')}
      </div>`, 'Pour les longues sessions de révision, de cours ou de travail.') +
    sec('keys', 'Raccourcis clavier', `
      <div class="prow"><div class="tx"><span>${esc(TR('Cliquez sur « Modifier », puis appuyez sur la nouvelle combinaison (avec Ctrl, Alt ou Maj, ou une touche F1 à F12). Échap : annuler · Retour arrière : retirer.'))}</span></div><button class="btn sm" id="keysReset">${esc(TR('Tout rétablir'))}</button></div>
      ${KEYS.map(([id, l, d]) => { const c = KMAP[id]; return `<div class="prow" style="padding:8px 18px"><div class="tx"><b>${esc(TR(l))}</b><span>${esc(TR('Par défaut'))} : ${d ? `<kbd>${esc(TR(d))}</kbd>` : esc(TR('aucun'))}</span></div>${c ? `<kbd style="font-size:13px">${esc(TR(c))}</kbd>` : ''}<button class="btn sm" data-kset="${id}">${esc(TR('Modifier'))}</button>${c ? `<button class="icon-btn" data-kdel="${id}" title="${esc(TR('Rétablir'))}">${ic('x')}</button>` : ''}</div>`; }).join('')}`, 'Choisissez vos propres raccourcis. Tous les raccourcis : touche F1 dans le navigateur.') +
    sec('search', 'Moteur de recherche', `
      ${row('Moteur de recherche utilisé dans la barre d\'adresse', '', sel('eng', [['google', 'Google'], ['bing', 'Bing'], ['duckduckgo', 'DuckDuckGo'], ['qwant', 'Qwant'], ['brave', 'Brave'], ['ecosia', 'Ecosia'], ['startpage', 'Startpage'], ['yahoo', 'Yahoo']], b.search))}
      <div class="prow" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${esc(TR('Mots-clés de recherche'))}</b><span>${esc(TR('Tapez le mot-clé, une espace, puis votre recherche dans la barre d\'adresse (exemple : « yt chat »). Une ligne par mot-clé : mot-clé | adresse avec %s à la place de la recherche.'))}</span></div><textarea id="kwList" class="notr" style="font:12px Consolas,monospace;min-height:90px;margin-top:6px">${esc((b.keywords || KWDEF).map(x => x.k + ' | ' + x.url).join('\n'))}</textarea></div>`) +
    sec('autofill', 'Saisie automatique et mots de passe', `
      <div class="prow click" data-page="passwords"><span>${ic('key')}</span><div class="tx"><b>${esc(TR('Gestionnaire de mots de passe'))}</b><span>${esc(TR('Mots de passe enregistrés, vérification, sites refusés'))}</span></div><span class="chev">${ic('open')}</span></div>
      <div class="prow click" data-page="passwords#cards"><span>${ic('card')}</span><div class="tx"><b>${esc(TR('Modes de paiement'))}</b><span>${esc(TR('Cartes enregistrées et confirmation par Windows Hello'))}</span></div><span class="chev">${ic('open')}</span></div>
      <div class="prow click" data-page="passwords#addresses"><span>${ic('pin')}</span><div class="tx"><b>${esc(TR('Adresses et coordonnées'))}</b><span>${esc(TR('Pour remplir les formulaires en un clic'))}</span></div><span class="chev">${ic('open')}</span></div>`) +
    sec('privacy', 'Confidentialité et sécurité', `
      <div class="prow click" data-page="history#clear"><span>${ic('trash')}</span><div class="tx"><b>${esc(TR('Effacer les données de navigation'))}</b><span>${esc(TR('Historique, cookies, cache… (Ctrl+Maj+Suppr)'))}</span></div><span class="chev">${ic('open')}</span></div>
      ${row('Effacer l\'historique et les cookies en fermant DrYAE', '', sw('clrExit', b.clearOnExit))}
      ${row('Bloquer les fenêtres pop-up', 'Un message propose de les ouvrir quand même.', sw('pop', b.blockPopups))}
      ${row('Bloquer les onglets de publicité', 'Quand un clic sur la page (ailleurs que sur un vrai lien) ouvre un autre site dans un nouvel onglet. Un message propose de l\'ouvrir quand même.', swk('blockClickTabs', b.blockClickTabs !== false))}
      ${row('Refuser automatiquement les bandeaux de cookies', 'DrYAE clique sur « Refuser » à votre place quand c\'est possible. Réglable site par site avec le cadenas.', swk('cookieRefuse', b.cookieRefuse !== false))}
      ${row('Avertir avant d\'ouvrir un site dangereux', 'Sites connus pour les arnaques (hameçonnage) ou les virus. La liste est gardée sur ce PC : les adresses visitées ne sont envoyées à personne.' + (SAFE.count ? ' ' + TRF('{0} sites dans la liste, mise à jour du {1}.', SAFE.count.toLocaleString(LOC()), SAFE.updated ? new Date(SAFE.updated).toLocaleDateString(LOC()) : '—') : ''), swk('safeBrowsing', b.safeBrowsing !== false) + ` <button class="btn sm" id="safeUpd">${esc(TR('Mettre à jour'))}</button>`)}
      ${row('Les notifications des sites', 'Bloquées par défaut (souvent utilisées pour la publicité). Pour un site précis : cadenas de la barre d\'adresse → Notifications.', '')}
      <div class="prow" style="flex-direction:column;align-items:stretch"><div style="display:flex;align-items:center;gap:10px"><div class="tx" style="flex:1"><b>${esc(TR('Contrôle de sécurité'))}</b><span>${esc(TR('Vérifie en un clic : version de DrYAE, mots de passe faibles ou réutilisés, extensions qui demandent beaucoup d\'accès, protections actives.'))}</span></div><button class="btn sm primary" id="safety">${esc(TR('Lancer le contrôle'))}</button></div><div id="safetyRes"></div></div>
      <div class="prow" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${esc(TR('Ce que DrYAE envoie sur internet'))}</b><span>${esc(TR('DrYAE ne contient aucune publicité, ne demande aucun compte et ne collecte aucune statistique. Voici tout ce qu\'il envoie ou télécharge de lui-même, et quand :'))}</span></div>
        ${NET().map(([t, d, ctl]) => `<div class="prow" style="padding:8px 0 8px 14px;border:0"><div class="tx"><b>${esc(TR(t))}</b><span>${esc(TR(d))}</span></div>${ctl}</div>`).join('')}</div>
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
        ${[['privacy', 'Traqueurs et statistiques', 'Empêche le suivi d\'un site à l\'autre.'], ['cookies', 'Bannières de cookies', 'Masque les demandes de consentement aux cookies.'], ['annoyances', 'Éléments gênants', 'Fenêtres d\'inscription, bulles de discussion, incitations à installer une appli…'], ['regional', 'Liste française', 'Publicités des sites en français.'], ['malware', 'Sites malveillants', 'Bloque les adresses connues pour diffuser des logiciels malveillants.'], ['peterLowe', 'Liste de serveurs de Peter Lowe', 'Serveurs de publicité et de suivi connus.']].map(([k, l, s]) => `<label class="cbx"><input type="checkbox" data-al="${k}" ${AL[k] !== false && (AL[k] || k === 'peterLowe') ? 'checked' : ''}><div><b>${esc(TR(l))}</b><span>${esc(TR(s))}</span></div></label>`).join('')}
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button class="btn sm" id="adUpd">${ic('reload')}${esc(TR('Mettre à jour les filtres maintenant'))}</button><span class="hint" id="adSt"></span></div></div>
      ${row('Mode de filtrage par défaut', 'Basique : seulement les requêtes (publicités, traqueurs). Optimal : aussi les emplacements vides et les éléments de la page.', selk('adDefaultMode', [['basic', 'Basique'], ['optimal', 'Optimal']], b.adDefaultMode || 'optimal'))}
      ${row('Mode choisi pour certains sites', 'Bouclier de la barre d\'outils → mode de filtrage pour ce site.', '')}
      ${Object.entries(b.adModes || {}).filter(([, m]) => m).map(([h, m]) => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><span class="tag">${esc(TR({ none: 'Aucun', basic: 'Basique', optimal: 'Optimal' }[m] || m))}</span><button class="icon-btn" data-admode="${esc(h)}">${ic('x')}</button></div>`).join('')}
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
      ${row('Langue de traduction', '', sel('trTo2', langOpts(true), T2.target || ''))}
      ${row('Deuxième langue', 'Si le texte est déjà dans la langue de traduction, il est traduit dans celle-ci.', selk('translate.second', [['', 'Automatique (anglais ou français)'], ...TLANGS.map(c => [c, lname(c)])], T2.second || ''))}
      ${row('Ne pas afficher le bouton si la traduction n\'est pas nécessaire', 'Le bouton n\'apparaît pas quand le texte sélectionné est déjà dans votre langue.', swk('translate.hideSame', T2.hideSame !== false))}
      ${row('Délai avant l\'apparition du bouton', '', selk('translate.delay', [[0, 'Aucun'], [200, '0,2 s'], [500, '0,5 s'], [1000, '1 s']], T2.delay || 0))}
      ${row('Sites où le traducteur est éteint', 'Fenêtre du traducteur → « Activé sur ce site ».', '')}${sites('translate.offSites', T2.offSites)}
      ${row('Sites traduits automatiquement', '', '')}${sites('translate.autoSites', T2.autoSites)}`, 'Traduit le texte sélectionné ou la page entière. Le texte est envoyé au service choisi.') +
    sec('scan', 'Traducteur de scans', `
      ${modRow('scan')}
      ${row('Langue du texte dans les images', 'La première fois, les données de lecture de cette langue sont téléchargées (2 à 15 Mo).', sel('scSrc', Object.entries(OCR.langs).map(([k, l]) => [k, TR(l) + (OCR.have.includes(k) ? ' ✓' : '')]), S.source || 'eng'))}
      ${row('Traduire vers', '', sel('scTo', langOpts(true), S.target || ''))}
      ${row('Lire aussi l\'anglais', 'Pour les images qui mélangent deux langues (plus lent).', swk('scan.withEng', !!S.withEng))}
      ${row('Icônes d\'action sur les images', 'Au survol d\'une image traduite : original / traduction, comparer, relire, copier, retirer.', swk('scan.icons', S.icons !== false))}
      ${row('Police des bulles', '', selk('scan.font', [['auto', 'Bande dessinée'], ['sans', 'Standard'], ['serif', 'Avec empattements']], S.font === 'comic' ? 'auto' : S.font || 'auto'))}

      <div class="prow"><div class="tx"><span>${esc(TR('Utilisation : bouton du traducteur de scans dans la barre d\'outils pour toutes les images de la page, Ctrl+Maj+S pour traduire une zone de l\'écran, ou clic droit sur une image → « Traduire le texte de l\'image ». Cliquez sur une bulle traduite pour revoir le texte d\'origine.'))}</span></div></div>`, 'Lit le texte des images (mangas, manhwas, webtoons…) et place la traduction sur chaque bulle. La lecture se fait sur ce PC ; seul le texte trouvé est envoyé au service de traduction.') +
    sec('lights', 'Lumières tamisées', `
      ${modRow('lights')}
      ${row('Opacité de l\'assombrissement', '', `<input type="range" id="liOp" min="40" max="97" value="${L.opacity || 85}" style="width:200px"><b id="liOpV" style="width:44px;text-align:right">${L.opacity || 85} %</b>`)}
      ${row('Couleur', '', `<input type="color" id="liCol" value="${/^#[0-9a-f]{6}$/i.test(L.color || '') ? L.color : '#000000'}" style="width:44px;height:30px;padding:2px;border-radius:6px">`)}
      ${row('Éteindre automatiquement quand une vidéo démarre', 'Et rallumer à la pause.', sw('liAuto', L.auto))}
      ${row('Fondu à l\'extinction', '', swk('lights.fade', L.fade !== false))}
      ${row('Cliquer sur la zone sombre rallume', 'Sinon, appuyez sur Échap ou utilisez le bouton.', swk('lights.clickOff', L.clickOff !== false))}
      ${row('Lueur autour de la vidéo', 'Reprend les couleurs de l\'image quand c\'est possible.', swk('lights.glow', !!L.glow))}
      ${row('Volume avec la molette sur la vidéo', '', swk('lights.wheelVolume', !!L.wheelVolume))}
      ${row('Empêcher la lecture automatique des vidéos', 'Une vidéo ne démarre pas toute seule tant que vous n\'avez pas cliqué dans la page.', swk('lights.stopAutoplay', !!L.stopAutoplay))}
      ${row('Protection des yeux', 'Filtre orangé sur toutes les pages (Alt+F10).', swk('lights.eye', !!L.eye))}
      ${row('Intensité du filtre', '', `<input type="range" data-k="lights.eyeLevel" min="5" max="60" value="${L.eyeLevel || 30}" style="width:200px">`)}
      ${row('Raccourcis', 'Ctrl+Maj+L : éteindre / rallumer. Alt+↑ / Alt+↓ : opacité. Alt+F8 : opacité par défaut. Alt+F9 : garder l\'opacité actuelle. Alt+F10 : protection des yeux.', '')}
      ${row('Mode nuit sur tous les sites', 'Fonce les pages claires.', swk('lights.nightAll', !!L.nightAll))}
      ${row('Seulement aux heures choisies', '', swk('lights.nightSchedule', !!L.nightSchedule) + ` <input type="time" data-k="lights.nightFrom" value="${esc(L.nightFrom || '20:00')}" style="width:auto"> → <input type="time" data-k="lights.nightTo" value="${esc(L.nightTo || '07:00')}" style="width:auto">`)}
      ${row('Sites exclus du mode nuit', '', '')}${sites('lights.nightExcept', L.nightExcept)}
      ${row('Sites en mode nuit', 'Fenêtre des lumières tamisées → « Mode nuit sur ce site ».', '')}
      ${(L.nightHosts || []).map(h => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><button class="icon-btn" data-night="${esc(h)}">${ic('x')}</button></div>`).join('')}`, 'Assombrit la page autour de la vidéo. Cliquez à côté de la vidéo ou appuyez sur Échap pour rallumer.') +
    sec('pip', "Image dans l'image", `
      ${modRow('pip')}
      ${row('Position du bouton sur les vidéos', '', sel('pipSide', [['left', 'En haut à gauche'], ['right', 'En haut à droite']], P.side || 'left'))}
      ${row('Sites où le bouton est masqué', '', '')}
      ${(P.hidden || []).map(h => `<div class="prow" style="padding-left:40px"><span class="notr" style="flex:1">${esc(h)}</span><button class="icon-btn" data-piph="${esc(h)}">${ic('x')}</button></div>`).join('')}`, 'Un bouton apparaît quand la souris passe sur une vidéo : la vidéo continue dans une petite fenêtre au-dessus des autres.') +
    sec('system', 'Système', `
      ${row('Navigateur par défaut', 'Les liens ouverts depuis d\'autres programmes (Word, Discord, e-mails) s\'ouvrent dans DrYAE. Windows demande toujours de confirmer : DrYAE ouvre la bonne page des Paramètres de Windows, il suffit d\'y choisir DrYAE.', `<label class="sw"><input type="checkbox" id="defOn"><i></i></label>`)}
      <div class="prow" id="defRow"><div class="tx"><b id="defTxt">…</b><span id="defSub"></span></div><button class="btn sm" id="defGo">${esc(TR('Choisir DrYAE dans Windows'))}</button></div>
      ${row('Ouvrir aussi les PDF avec DrYAE', '', `<label class="sw"><input type="checkbox" id="defPdf"><i></i></label>`)}
      ${row('Mode d\'affichage des sites', '', sel('ua', [['desktop', 'Ordinateur'], ['mobile', 'Mobile']], b.ua))}
      ${row('Lecteur PDF de DrYAE', 'Ouvre les PDF avec des outils pour surligner, écrire, dessiner et signer, puis enregistrer le PDF modifié (bouton « Enregistrer » du lecteur).', swk('pdfViewer', b.pdfViewer !== false))}
      ${row('Détecter les sous-titres', 'Dans le panneau des fichiers détectés.', sw('subs', b.captureSubtitles))}
      ${row('Types de fichiers supplémentaires à détecter', '', `<input type="text" id="extra" value="${esc(b.sniffExtra || '')}" placeholder="zip,rar,apk,pdf">`)}
      <div class="prow" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${esc(TR('Exporter / importer toutes mes données'))}</b><span>${esc(TR('Un seul fichier avec vos réglages, favoris, liste des téléchargements et extensions — pour changer de PC librement, sans compte en ligne.'))}</span></div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:8px"><label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="exHist"> ${esc(TR('Avec l\'historique'))}</label><label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="exPw"> ${esc(TR('Avec les mots de passe'))}</label><input type="password" id="exPass" placeholder="${esc(TR('Mot de passe du fichier'))}" style="width:200px;display:none" autocomplete="new-password"></div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" id="imOther">${ic('import')}${esc(TR('Importer depuis un autre navigateur…'))}</button></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm primary" id="exGo">${ic('dl')}${esc(TR('Exporter…'))}</button><button class="btn sm" id="imGo">${ic('import')}${esc(TR('Importer…'))}</button></div></div>`) +
    sec('reset', 'Réinitialiser', `
      ${row('Rétablir les paramètres du navigateur par défaut', 'Les favoris, l\'historique, les mots de passe et les extensions sont conservés.', `<button class="btn sm danger" id="reset">${esc(TR('Réinitialiser'))}</button>`)}`) +
    sec('about', 'À propos de DrYAE', `
      <div class="prow"><img src="/_assets/logo.png" style="width:48px;height:48px;border-radius:12px" alt=""><div class="tx"><b style="font-size:15px">DrYAE ${esc(ABOUT.version)}</b><span>${esc(TR('Logiciel libre (GPL-3.0)'))} · Chromium ${esc(ABOUT.chrome)}</span></div></div>
      <div class="prow"><div class="tx"><b id="updTxt">${esc(TRF(updTxt, upd.status === 'downloading' ? Math.round(upd.progress || 0) : upd.version || ''))}</b><span>${upd.error ? esc(upd.error) : ''}</span></div><button class="btn sm" id="updChk">${esc(TR('Rechercher des mises à jour'))}</button>${['available', 'ready'].includes(upd.status) ? `<button class="btn sm primary" id="updGo">${esc(TR(upd.status === 'ready' ? 'Redémarrer et installer' : 'Mettre à jour'))}</button>` : ''}</div>
      <div class="prow"><div class="tx"><b id="dlCount">${esc(TR('Téléchargements de DrYAE'))} : …</b><span>${esc(TR('Compté par GitHub, pour toutes les versions. DrYAE ne sait pas qui vous êtes.'))}</span></div></div>
      <div class="prow click" data-url="https://github.com/DrYAE-FPA/DrYAE"><div class="tx"><b>${esc(TR('Code source et nouveautés'))}</b><span>github.com/DrYAE-FPA/DrYAE</span></div><span class="chev">${ic('open')}</span></div>
      <div class="prow click" data-url="https://github.com/DrYAE-FPA/DrYAE/blob/main/docs/GUIDE.md"><div class="tx"><b>${esc(TR('Mode d\'emploi'))}</b></div><span class="chev">${ic('open')}</span></div>
      <div class="prow"><div class="tx"><b>${esc(TR('Gratuit et libre, sans publicité, sans compte, sans collecte de données.'))}</b><span>${esc(TR('DrYAE ne vend rien et ne vous suit pas. Détail de ce qu\'il envoie sur internet : Confidentialité et sécurité.'))}</span></div></div>
      <div class="prow"><div class="tx"><span>${esc(TR('Ne téléchargez que ce que vous avez le droit de copier.'))}</span></div></div>`);
  bind();
  search.oninput();
  // navigateur par défaut
  if ($('#defOn')) {
    const show = d => {
      $('#defOn').checked = d.on; $('#defPdf').checked = d.pdf; $('#defPdf').disabled = !d.on || !d.supported; $('#defOn').disabled = !d.supported && !d.on;
      $('#defGo').hidden = !d.on || !d.supported;
      $('#defTxt').textContent = !d.supported ? TR(d.portable ? 'Version portable : impossible de la déclarer à Windows' : 'Seulement dans la version installée de DrYAE sous Windows') : d.isDefault ? TR('DrYAE est votre navigateur par défaut') : d.on ? TR('DrYAE est déclaré à Windows : choisissez-le comme navigateur') : TR('DrYAE n\'est pas déclaré comme navigateur');
      $('#defSub').textContent = !d.supported && d.portable ? TR('Une version portable peut changer de dossier : Windows ne peut pas la retenir. Installez DrYAE avec l\'installateur pour cette option.') : '';
    };
    call('defaultInfo').then(show).catch(() => {});
    $('#defOn').onchange = async e => show(await call('defaultSet', { on: e.target.checked, open: e.target.checked }));
    $('#defPdf').onchange = async e => show(await call('defaultSet', { pdf: e.target.checked }));
    $('#defGo').onclick = () => call('defaultOpen');
  }
  // le total n'est demandé à GitHub que quand la ligne « À propos » est affichée à l'écran
  if ($('#dlCount')) { const io = new IntersectionObserver(es => { if (!es.some(x => x.isIntersecting)) return; io.disconnect(); call('downloads').then(n => { const el = $('#dlCount'); if (el) el.textContent = TR('Téléchargements de DrYAE') + ' : ' + (n == null ? TR('indisponible') : Number(n).toLocaleString()); }).catch(() => {}); }); io.observe($('#dlCount')); }
}
function bind() {
  const w = $('#wrap');
  const v = id => $('#' + id);
  w.onchange = async e => {
    if (e.target.dataset && e.target.dataset.k) {
      const t = e.target, [g, k] = t.dataset.k.split('.');
      const val = t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.type === 'number' || k === 'delay') ? +t.value : t.value;
      await setB(k ? { [g]: { ...(C[g] || {}), [k]: val } } : { [g]: val });
      if (t.dataset.k === 'lights.eye') draw();
      return toast('Paramètre enregistré');
    }
    const t = e.target, id = t.id;
    if (id.startsWith('ctn_')) { await call('containerRename', id.slice(4), t.value); return toast('Paramètre enregistré'); }
    if (t.name === 'st') { await setB({ startup: t.value }); await setRoot({ restoreSession: t.value === 'restore' }); v('spRow').style.display = t.value === 'pages' ? '' : 'none'; }
    else if (id === 'sp') await setB({ startupPages: t.value.split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => (/^[a-z]+:\/\//i.test(x) ? x : 'https://' + x)) });
    else if (id === 'theme') await setRoot({ theme: { ...(C.rawTheme || {}), mode: t.value } });
    else if (id.startsWith('a11y')) { const k = { a11yScale: 'scale', a11yContrast: 'contrast', a11yEasy: 'easy', a11yMotion: 'motion', a11ySimple: 'simple' }[id]; if (!k) return; await setRoot({ a11y: { ...(C.a11yRaw || {}), [k]: t.type === 'checkbox' ? t.checked : k === 'scale' ? +t.value : t.value } }); }
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
    else if (id === 'kwList') await setB({ keywords: t.value.split('\n').map(l => l.split('|').map(x => x.trim())).filter(([k, u]) => k && /^https?:\/\/.*%s/.test(u || '')).map(([k, u]) => ({ k: k.slice(0, 12), name: k, url: u })).slice(0, 50) });
    else if (id === 'keepAct') await setB({ tabsx: { ...(C.tabsx || {}), keepActive: t.value.split(/[\s,]+/).map(x => x.trim().replace(/^https?:\/\//, '').split('/')[0]).filter(Boolean) } });
    else if (t.dataset.root) { const [a, k] = t.dataset.root.split('.'); await setRoot(k ? { [a]: { [k]: t.checked } } : { [a]: t.checked }); }
    else if (id === 'exPw') { v('exPass').style.display = t.checked ? '' : 'none'; return; }
    else if (id === 'exHist' || id === 'exPass') return;
    else if (t.dataset.al) await setB({ adLists: { ...(C.adLists || {}), [t.dataset.al]: t.checked } });
    else if (id.startsWith('mod_')) { await setMod(id.slice(4), { enabled: t.checked }); if (id === 'mod_capture') draw(); toast(t.checked ? 'Extension activée : actualisez les pages ouvertes' : 'Extension désactivée'); return; }
    else if (id.startsWith('pin_')) await setMod(id.slice(4), { pinned: t.checked });
    else return;
    toast('Paramètre enregistré');
  };
  w.oninput = e => { if (e.target.id === 'liOp') v('liOpV').textContent = e.target.value + ' %'; if (e.target.id === 'a11yScale') v('a11yScaleV').textContent = e.target.value + ' %'; };
  w.onclick = async e => {
    const cc = e.target.closest('[data-ctnclear]');
    if (cc) { if (!(await confirmBox(TR('Effacer les cookies et les données de ce conteneur ? Vous serez déconnecté des sites ouverts dedans.'), 'Effacer'))) return; await call('containerClear', cc.dataset.ctnclear); return toast('Données effacées'); }
    const g = a => e.target.closest('[data-' + a + ']')?.dataset[a];
    let x;
    if ((x = g('page'))) { const [p, h] = x.split('#'); return D.call('openPage', p, h || ''); }
    if ((x = g('url'))) return D.call('open', x, {});
    if (e.target.closest('[data-goext]')) return D.call('openPage', 'extensions');
    if ((x = g('wl'))) { await setB({ whitelist: (C.whitelist || []).filter(h => h !== x) }); return draw(); }
    if ((x = g('hide'))) { STATS.hides = await call('hideRemove', x); return draw(); }
    if ((x = g('rm'))) { const [path, h] = x.split('|'); const [gr, k] = path.split('.'); await setB({ [gr]: { ...(C[gr] || {}), [k]: ((C[gr] || {})[k] || []).filter(v => v !== h) } }); return draw(); }
    if ((x = g('admode'))) { await setB({ adModes: { [x]: null } }); return draw(); }
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
    if (id === 'a11yKeys') D.call('showShortcuts');
    if (id === 'keysReset') { await setB({ keyList: [] }); return draw(); }
    if ((x = g('kdel'))) { await setB({ keyList: (C.keyList || []).filter(k => k.id !== x) }); return draw(); }
    if ((x = g('kset'))) {
      const btn = e.target.closest('[data-kset]'); btn.textContent = TR('Appuyez sur la combinaison…'); btn.focus();
      btn.onkeydown = async ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) return;
        btn.onkeydown = null;
        if (ev.key === 'Escape') return draw();
        const k = Object.fromEntries((C.keyList || []).map(o => [o.id, o.c]));
        if (ev.key === 'Backspace') delete k[x];
        else {
          const key = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key.charAt(0).toUpperCase() + ev.key.slice(1);
          if (!ev.ctrlKey && !ev.altKey && !/^F\d{1,2}$/.test(key) && !(ev.shiftKey && key === 'Escape')) { toast('Ajoutez Ctrl, Alt ou Maj (ou une touche F1 à F12)'); return draw(); }
          const c = [ev.ctrlKey && 'Ctrl', ev.altKey && 'Alt', ev.shiftKey && 'Maj', key].filter(Boolean).join('+');
          const other = Object.keys(k).find(a => a !== x && k[a] === c); if (other) delete k[other];
          k[x] = c;
        }
        await setB({ keyList: Object.entries(k).map(([id, c]) => ({ id, c })) }); toast('Raccourci enregistré'); draw();
      };
      return;
    }
    if (id === 'safeUpd') { toast('Mise à jour de la liste…'); const ok = await call('safeUpdate').catch(() => false); SAFE = await call('safeInfo').catch(() => ({})); toast(ok ? 'Liste des sites dangereux à jour' : 'Mise à jour impossible (connexion ?)'); draw(); }
    if (id === 'safety') runSafety();
    if (id === 'exGo') { const f = await call('exportAll', { history: v('exHist').checked, passwords: v('exPw').checked, password: v('exPass').value }).catch(() => null); if (f) toast(TRF('Données exportées : {0}', f.split(/[\\/]/).pop())); }
    if (id === 'imGo') importAll();
    if (id === 'imOther') importOther();
  };
}
// favoris et historique d'un autre navigateur installé sur ce PC ; mots de passe : par leur export .csv
async function importOther() {
  const L = await call('importSources');
  if (!L.length) return dialog({ title: TR('Aucun autre navigateur trouvé sur ce PC'), html: `<p class="hint">${esc(TR('Vous pouvez importer un fichier de favoris (.html) depuis le gestionnaire de favoris.'))}</p>`, cancel: '' });
  const v = await dialog({ title: TR('Importer depuis un autre navigateur'), html: `<select id="imSrc" style="width:100%">${L.map(s => `<option value="${esc(s.key)}">${esc(s.name)}</option>`).join('')}</select><label class="hint" style="display:flex;gap:6px;margin-top:10px"><input type="checkbox" id="imB" checked> ${esc(TR('Favoris'))}</label><label class="hint" style="display:flex;gap:6px"><input type="checkbox" id="imH" checked> ${esc(TR('Historique'))}</label><p class="hint" style="margin-top:10px">${esc(TR('Mots de passe : dans l\'autre navigateur, exportez-les en fichier .csv, puis Gestionnaire de mots de passe → Importer.'))}</p>`, ok: 'Importer', read: d => ({ key: d.querySelector('#imSrc').value, b: d.querySelector('#imB').checked, h: d.querySelector('#imH').checked }) });
  if (!v) return;
  const r = await call('importFrom', v.key, { bookmarks: v.b, history: v.h }).catch(() => null);
  if (r) toast(TRF('Importé de {0} : {1} favori(s), {2} page(s) d\'historique', r.name, r.bookmarks, r.history));
}
// import : le mot de passe du fichier est demandé s'il est protégé
async function importAll(file, bad) {
  let pw = '';
  if (file) { pw = await promptBox(TR(bad ? 'Mot de passe incorrect. Mot de passe du fichier :' : 'Ce fichier est protégé. Mot de passe du fichier :'), '', 'password'); if (pw === null) return; }
  const r = await call('importAll', pw, file ? { file } : {}).catch(() => null);
  if (!r) return;
  if (r.needPassword) return importAll(r.file, r.bad);
  const d = r.done; toast(TRF('Importé : {0} favori(s), {1} téléchargement(s), {2} extension(s), {3} mot(s) de passe', d.bookmarks, d.downloads, d.extensions, d.passwords));
  C = await call('cfg'); draw();
}
// contrôle de sécurité : résultats lisibles, avec quoi faire
async function runSafety() {
  const box = $('#safetyRes'); box.innerHTML = `<p class="hint">${esc(TR('Vérification…'))}</p>`;
  const r = await call('safetyCheck').catch(e => ({ error: e.message }));
  if (r.error) { box.innerHTML = `<p class="hint">${esc(r.error)}</p>`; return; }
  const it = (ok, t, d, act = '') => `<div class="prow" style="padding:8px 0 8px 14px;border:0"><span style="font-size:18px">${ok ? '✅' : '⚠️'}</span><div class="tx"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ''}</div>${act}</div>`;
  const V = r.version, P = r.passwords;
  const upToDate = V.status === 'latest' || (!V.status || V.status === 'idle');
  box.innerHTML = it(V.status !== 'available' && V.status !== 'ready', TRF('DrYAE {0}', V.current), V.status === 'available' || V.status === 'ready' ? TRF('La version {0} est disponible.', V.latest) : TR(V.status === 'latest' ? 'À jour.' : V.status === 'checking' ? 'Vérification en cours.' : 'Pas encore vérifié : « À propos de DrYAE » → « Rechercher des mises à jour ».'), V.status === 'available' || V.status === 'ready' ? `<button class="btn sm" data-page="settings#about">${esc(TR('Mettre à jour'))}</button>` : '')
    + it(!P.weak.length && !P.reused.length, TRF('{0} mot(s) de passe enregistré(s)', P.total), [P.weak.length ? TRF('Faibles : {0}', P.weak.join(', ')) : '', P.reused.length ? TRF('Utilisés sur plusieurs sites : {0}', P.reused.join(', ')) : '', P.breached ? TRF('Trouvés dans des fuites : {0}', P.breached) : ''].filter(Boolean).join(' · ') || TR('Aucun mot de passe faible ou réutilisé.'), `<button class="btn sm" data-page="passwords">${esc(TR('Gérer'))}</button>`)
    + it(!r.extensions.some(e => e.risky.length), TRF('{0} extension(s) installée(s)', r.extensions.length), r.extensions.filter(e => e.risky.length).map(e => `${e.name} (${TR('accès étendu')})`).join(', ') || TR('Aucune extension avec des accès étendus.'), r.extensions.length ? `<button class="btn sm" data-goext>${esc(TR('Voir'))}</button>` : '')
    + it(r.safe.on && r.safe.loaded, TR('Protection contre les sites dangereux'), r.safe.on ? (r.safe.loaded ? TRF('{0} sites dans la liste', (r.safe.count || 0).toLocaleString(LOC())) : TR('Liste pas encore téléchargée')) : TR('Désactivée'))
    + it(r.adblock.on, TR('Bloqueur de publicités et de traqueurs'), r.adblock.on ? (r.adblock.updated ? TRF('Listes mises à jour le {0}', new Date(r.adblock.updated).toLocaleDateString(LOC())) : '') : TR('Désactivé'));
}
D.on('update-state', async () => { ABOUT = await call('about'); if ($('#s-about')) draw(); });
addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (h) show(h); });
load();
