# Nouveautés / Changelog

## 1.6.8

### 🇫🇷 Français
- **Traducteur de scans sur MangaDex (vraie cause trouvée)** : MangaDex protège ses pages avec une règle de sécurité (« Trusted Types ») qui bloquait l'affichage de tout ce que DrYAE ajoute dans la page (bulles traduites, barre du traducteur, bouton de traduction, lumières…). DrYAE construit maintenant ces éléments d'une façon acceptée par ces pages. Corrige aussi les autres sites qui utilisent cette protection.
- Traducteur de scans : les petits signes japonais ou chinois isolés (bruitages dessinés) ne sont plus traduits sur une page en français, anglais, portugais…
- **Lumières tamisées** : elles restent éteintes quand on clique dans la page ou sur la vidéo (les clics passent à travers la zone sombre). On rallume avec Échap, Ctrl+Maj+L ou le bouton. Mettre en pause une vidéo ne rallume plus.

### 🇬🇧 English
- **Image text translator on MangaDex (real cause found)**: MangaDex protects its pages with a security rule ("Trusted Types") that blocked everything DrYAE adds to the page (translated bubbles, translator bar, translate button, dimmed lights…). DrYAE now builds these elements in a way such pages accept. Also fixes other sites using this protection.
- Image text translator: small isolated Japanese/Chinese signs (drawn sound effects) are no longer translated on Latin-script pages.
- **Dimmed lights**: they stay on when you click in the page or on the video (clicks go through the dark area). Turn the lights back on with Esc, Ctrl+Shift+L or the button. Pausing a video no longer turns the lights back on.

## 1.6.7

### 🇫🇷 Français
- **Traducteur de scans sur MangaDex** (et les sites qui font pareil) : ces sites affichent l'image puis effacent aussitôt sa copie temporaire ; DrYAE recopie maintenant l'image depuis la page. Une image pas encore lisible (hors de l'écran) est retentée quand elle devient visible (3 fois au plus).
- **Extensions Chrome : connexion à un compte** (fonction « identity ») ajoutée. Les extensions qui demandent de se connecter (ex. « Continue with Google ») ouvrent la page de connexion dans une petite fenêtre, qui se ferme toute seule à la fin.

### 🇬🇧 English
- **Image text translator on MangaDex** (and sites doing the same): these sites show the image then immediately delete its temporary copy; DrYAE now copies the image from the page itself. An image not yet readable (off screen) is retried when it becomes visible (up to 3 times).
- **Chrome extensions: account sign-in** ("identity" API) added. Extensions asking you to sign in (e.g. "Continue with Google") open the sign-in page in a small window that closes by itself when done.

## 1.6.6

### 🇫🇷 Français
- **Extensions Chrome** : leur script d'arrière-plan démarre maintenant correctement (avant, beaucoup s'arrêtaient au lancement, par exemple Simple Translate) ; la fenêtre du navigateur fonctionne en « bac à sable », comme demandé par les extensions récentes.
- **Ordre des extensions** : glissez un bouton dans la barre d'outils, ou une ligne dans le menu des extensions, pour changer l'ordre. Les extensions épinglées (y compris le bouclier du bloqueur) sont toujours à gauche du bouton des extensions ; seuls les boutons de téléchargements restent à droite.
- **Traducteur de scans** : nouveau moteur de lecture du texte (modèles PP-OCRv5, sur votre PC, sans compte). Il repère les lignes de texte, ignore beaucoup mieux le dessin, et lit français, anglais, espagnol, portugais, allemand, italien, japonais et chinois sans avoir à choisir la langue (« Automatique »). Le coréen, le thaï, l'arabe, le cyrillique… restent disponibles avec l'ancien moteur.
- Traducteur de scans : les images WebP / AVIF sont lues en entier ; les longues pages (webtoons) sont lues par morceaux ; les mots coupés en fin de ligne sont recollés.
- Traduction en **français par défaut** (modifiable), et si le texte est déjà en français il est traduit en **anglais** (« Deuxième langue : automatique »). Valable pour le traducteur de scans, la fenêtre du traducteur et la bulle de sélection.
- **Fenêtre du traducteur** : le texte sélectionné dans la page est repris tout seul et traduit.
- Le bouton de traduction apparaît aussi sur un texte déjà en français (il est alors traduit en anglais).
- Gestionnaire : onglets « Extension Chrome » et « Mots de passe » retirés des paramètres.

### 🇬🇧 English
- **Chrome extensions**: their background script now starts correctly (many stopped at launch before, e.g. Simple Translate); the browser window now runs sandboxed, as recent extensions require.
- **Extension order**: drag a toolbar button, or a row in the extensions menu, to reorder. Pinned extensions (including the blocker shield) always sit left of the extensions button.
- **Image text translator**: new on-device text reading engine (PP-OCRv5 models), far more accurate, ignores artwork better, reads French, English, Spanish, Portuguese, German, Italian, Japanese and Chinese without choosing the language ("Automatic").
- WebP / AVIF images read in full, long webtoon pages read in parts, words split at line ends rejoined.
- Translation into **French by default** (changeable); text already in French is translated into **English**.
- **Translator window** picks up the text selected on the page.
- Manager settings: "Chrome extension" and "Passwords" tabs removed.

## 1.6.5

### 🇫🇷 Français

**Extensions**
- Nouveau **menu des extensions** (bouton à côté du bouclier) : les extensions intégrées à DrYAE et les extensions Chrome sont listées ensemble. Une **punaise** épingle ou retire chaque extension de la barre d'outils ; le menu ⋮ d'une extension Chrome donne ses options, la désactive ou la retire.
- Les fenêtres des extensions Chrome s'ouvrent **sous leur bouton et entièrement à l'écran**, même quand DrYAE est agrandi ou sur un deuxième écran. Si une fenêtre ne donne pas sa taille, DrYAE la mesure et l'affiche quand même.
- L'onglet affiché est bien celui que voit l'extension quand on clique sur son bouton.
- Les icônes des extensions s'affichent dans la page Extensions et dans le menu.

**Traducteur** (repensé)
- **Fenêtre du traducteur** dans la barre d'outils : traduction **en direct** du texte saisi, langue de destination, deuxième langue, copier / écouter, « Traduire la page », interrupteur **Activé sur ce site**, et **Traduire automatiquement ce site**.
- Le bouton sur le texte sélectionné réagit dès qu'on appuie dessus, et la bulle peut montrer le texte d'origine.
- Option **Ne pas afficher le bouton si la traduction n'est pas nécessaire** (texte déjà dans votre langue, reconnu sur le PC), **délai** avant l'apparition du bouton, **deuxième langue** utilisée automatiquement.
- Clic droit sur un lien → **Traduire le texte du lien**.
- Service Google plus fiable (requête simple pour les textes courts, message clair si le service refuse temporairement).

**Traducteur de scans** (repensé)
- **Fenêtre unique** : traduire les images de la page, **capture d'une zone** (Ctrl+Maj+S : dessinez un rectangle, puis « Traduire la zone » ou Annuler), langue des images, « Traduire vers », **traduction automatique des images d'un site**.
- **Icônes d'action** au survol d'une image traduite (désactivables) : original / traduction, **comparer** (glisser pour voir l'avant / après), relire l'image, copier le texte traduit, retirer.
- Bulles plus propres (taille du texte ajustée à la bulle, police au choix), **texte vertical** (japonais, coréen, chinois) et nouvelles langues : vietnamien, thaï, indonésien, allemand, italien, turc, polonais, ukrainien, hindi ; option « Lire aussi l'anglais ».
- Les images ajoutées pendant le défilement (webtoons) sont traduites aussi.

**Lumières tamisées** (repensées)
- Fenêtre avec interrupteur, **opacité et couleur en direct**, **protection des yeux** (filtre orangé réglable, Alt+F10), **lueur** autour de la vidéo, mode nuit sur ce site.
- **Outils vidéo** : vitesse, boucle, zoom, filtres, capture d'image (enregistrée dans Images\DrYAE), plein onglet, détacher, réinitialiser.
- Volume avec la molette sur la vidéo, empêcher la lecture automatique, fondu, clic sur la zone sombre (au choix).
- Raccourcis : Alt+↑ / Alt+↓ (opacité), Alt+F8 (opacité par défaut), Alt+F9 (garder l'opacité actuelle).
- **Mode nuit sur tous les sites**, avec horaire et sites exclus.

**Bloqueur de publicités**
- Fenêtre du bouclier : protection du site, **mode de filtrage par site** (Aucun, Basique, Optimal), éléments bloqués, masquer un élément, actualiser.
- La **liste de serveurs de Peter Lowe** est active par défaut (avec les filtres uBlock, EasyList et EasyPrivacy).

**Navigateur**
- Clic droit sur un lien : « Ouvrir dans un nouvel onglet », « Ouvrir dans un onglet privé » et « Copier le lien » en premier ; « Télécharger le lien avec DrYAE » est rangé avec « Télécharger l'image avec DrYAE ».
- Favoris : **Choisir un autre dossier…** ouvre une fenêtre avec le nom, l'adresse, l'arborescence des dossiers et **Nouveau dossier**.
- Historique, favoris, mots de passe : **sélection à la souris** (clic, ou glisser pour sélectionner plusieurs lignes).
- Connexion en deux étapes (adresse puis mot de passe, comme Google) : la liste des **comptes enregistrés** s'affiche dans le champ de l'adresse, et le mot de passe du compte choisi est proposé à l'étape suivante.

**Mises à jour**
- Le téléchargement de la mise à jour s'affiche dans le gestionnaire, dans une carte à part (progression, taille, vitesse).
- « Redémarrer et installer » installe **sans fenêtre d'installation** : DrYAE se rouvre normalement, avec vos réglages et **sans redemander la langue**.

### 🇬🇧 English
- New **extensions menu**: built-in and Chrome extensions in one place, with a pin to show or hide each one in the toolbar. Chrome extension pop-ups open under their button and fully on screen (maximized window, second screen).
- Reworked **Translator**: live translation window, more reliable selection button (hidden when the text is already in your language), delay option, automatic second language, per-site on/off, automatically translated sites, "Translate link text".
- Reworked **Image text translator**: single window, **area capture** (Ctrl+Shift+S), automatic translation per site, cleaner bubbles, vertical text, more languages, hover icons to compare original and translation.
- Reworked **Dimmed lights**: live opacity and color, eye protection, glow, video tools (speed, loop, zoom, filters, screenshot, fill tab), wheel volume, block autoplay, scheduled night mode.
- Ad blocker window with a **per-site filtering mode** (None / Basic / Optimal); Peter Lowe's list on by default.
- Context menu reordered; "Choose another folder…" bookmark dialog; mouse selection in lists; saved account chooser for two-step sign-in.
- Updates install **without an installer window** and keep your settings and language; the update download is shown in the manager.

## 1.6.4

### 🇫🇷 Français

**Pages de gestion du navigateur (dans un onglet, au lieu des petites fenêtres)**
- Historique, Favoris, Mots de passe, Extensions et Paramètres s'ouvrent maintenant dans un **onglet**, avec une barre de recherche (Ctrl+F) et une navigation à gauche.
- Les listes se gèrent **au clavier**, comme le gestionnaire de téléchargements : ↑ ↓, Maj+↑↓, Ctrl+clic, Ctrl+A, Entrée (ouvrir), Ctrl+Entrée (nouvel onglet), Suppr, F2, Ctrl+Z (annuler), Échap.

**Menu ⋮ réorganisé**
- Sous-menus **Mots de passe et saisie automatique**, **Historique** (avec les onglets fermés récemment), **Favoris**, **Extensions** ; **Effacer les données de navigation** ; **Traduire la page** ; **Aide**.

**Historique**
- Affichage **par date** ou **par site**, sélection multiple, suppression avec **Annuler**, « Plus de ce site », onglets fermés récemment.
- **Effacer les données de navigation** : période au choix (15 dernières minutes, dernière heure, 24 heures, 7 jours, 4 semaines, depuis le début) ; historique, cookies, cache, liste des téléchargements terminés, et plus.

**Favoris**
- **Barre de favoris** sous la barre d'adresse (Ctrl+Maj+B), avec dossiers, glisser-déposer et clic droit.
- Ctrl+D ouvre une petite fenêtre pour renommer le favori et choisir son dossier ; Ctrl+Maj+D ajoute tous les onglets.
- **Gestionnaire de favoris** (Ctrl+Maj+O) : dossiers, glisser-déposer, couper / coller, monter / descendre (Alt+↑↓), tri par nom, **import et export** au format HTML.

**Mots de passe et saisie automatique**
- Liste **par site** (« 2 comptes »…), fiche de chaque compte : identifiant, mot de passe, note, modifier, supprimer.
- **Vérification** : mots de passe **compromis** (fuites connues), **réutilisés** et **faibles**. Seuls 5 caractères d'une empreinte sont envoyés : le mot de passe ne quitte jamais le PC.
- **Windows Hello** (empreinte, visage ou code PIN) avant d'afficher, copier ou exporter un mot de passe (au choix).
- **Mot de passe fort proposé** sur les pages d'inscription.
- **Modes de paiement** : cartes enregistrées (chiffrées par Windows, sans le code CVC), remplies dans les formulaires après confirmation Windows Hello.
- **Adresses** : plusieurs adresses au lieu d'un seul profil.
- Paramètres : import / export .csv, raccourci sur le Bureau, suppression de toutes les données, **sites refusés**.

**Extensions intégrées** (activables, masquables de la barre d'outils, retirables)
- **Bloqueur de publicités** amélioré : listes au choix (traqueurs, bannières de cookies, éléments gênants, liste française, sites malveillants), **masquer un élément de la page** à la main (clic droit → « Masquer cet élément… »). Il peut être retiré pour utiliser sa propre extension de blocage.
- **Téléchargements par DrYAE** : désactivée, le navigateur télécharge lui-même les fichiers, comme un navigateur ordinaire (panneau de téléchargements, dossier au choix).
- **Traducteur** : bouton « Traduire » sur le texte sélectionné, traduction de la page entière avec « Afficher l'original », écoute du texte. Google Traduction, DeepL (clé personnelle) ou LibreTranslate.
- **Traducteur de scans** : lit le texte des images (mangas, manhwas, webtoons) sur le PC et place la traduction sur chaque bulle. Clic droit sur une image → « Traduire le texte de l'image ».
- **Lumières tamisées** : assombrit la page autour de la vidéo (Ctrl+Maj+L), automatique au démarrage d'une vidéo si souhaité, et **mode nuit** par site.
- **Image dans l'image** : bouton sur les vidéos (YouTube compris) pour les détacher dans une petite fenêtre (Ctrl+Maj+U).

**Paramètres du navigateur** (page complète, avec recherche) : démarrage, apparence, moteur de recherche, confidentialité, téléchargements, langues, extensions intégrées, système, réinitialisation, à propos.

**Connexion aux comptes**
- Pendant une connexion Google, l'onglet garde la même identité du début à la fin : la page ne se recharge plus en boucle et ne revient plus sur l'écran de l'adresse Gmail.
- Les fenêtres « Se connecter avec Google / Microsoft / Apple / Facebook… » s'ouvrent dans une vraie petite fenêtre reliée au site.

**Mises à jour** : l'icône de mise à jour s'affiche dès l'ouverture de DrYAE (navigateur et gestionnaire) et reste visible jusqu'à l'installation.

### 🇬🇧 English
- Browser management pages now open in a **tab**: History, Bookmarks, Passwords, Extensions and Settings, with search and full keyboard control (arrows, Shift/Ctrl selection, Ctrl+A, Enter, Del, F2, Ctrl+Z).
- Reorganized ⋮ menu with submenus (Passwords and autofill, History, Bookmarks, Extensions), Clear browsing data, Translate page and Help.
- History by date or by site; **Clear browsing data** with a time range.
- **Bookmarks bar** (Ctrl+Shift+B), bookmark edit bubble (Ctrl+D), bookmark all tabs (Ctrl+Shift+D), bookmark manager with folders, drag and drop, HTML import/export.
- Passwords grouped by site, **password check-up** (breached, reused, weak), optional **Windows Hello**, strong password suggestions, **payment cards** (without CVC) and multiple **addresses**, refused sites.
- **Built-in extensions** that can be turned off, hidden or removed: improved ad blocker (filter lists, hide an element by hand), Downloads with DrYAE (off = normal browser downloads), Translator, **Image text translator** for manga and webtoons, Dimmed lights with night mode, Picture-in-picture button on videos.
- Full browser **Settings** page with search.
- Google sign-in keeps the same identity for the whole sign-in; sign-in pop-ups open in a real small window linked to the site.
- The update icon is shown as soon as DrYAE opens and stays until the update is installed.

## 1.6.3 (correctif de la 1.6.2)

### 🇫🇷 Français
- **Paramètres** : le bouton Paramètres ne répondait pas quand la couleur d'accent de Windows était utilisée. C'est corrigé.
- **Démarrage avec Windows** : DrYAE reste bien caché dans les icônes de la barre des tâches, même si la fenêtre était agrandie la dernière fois.
- **Navigateur** : dans le menu ⋮, l'entrée **Téléchargements** (retour au gestionnaire) est mise en couleur pour être trouvée tout de suite.
- **Mises à jour** : juste avant une mise à jour, DrYAE fait une copie de sécurité de vos réglages, de la liste des téléchargements, de l'historique, des favoris et des mots de passe. Si un fichier manque après la mise à jour, il est repris automatiquement.

### 🇬🇧 English
- Fixed the Settings button not responding when the Windows accent color was in use.
- DrYAE now stays hidden in the taskbar icons when it starts with Windows, even if the window was maximized last time.
- Browser ⋮ menu: the **Downloads** entry (back to the download manager) is now highlighted.
- Before an update, DrYAE backs up your settings, download list, history, bookmarks and passwords, and restores any missing file afterwards.

## 1.6.2

### 🇫🇷 Français

**Démarrage avec Windows**
- Quand « Lancer DrYAE au démarrage de Windows » est coché, DrYAE démarre **caché dans les icônes de la barre des tâches**, sans ouvrir de fenêtre.
- Un clic sur l'icône DrYAE ouvre directement le **navigateur**.

**Gestionnaire de téléchargements, comme un dossier Windows**
- **Barre de commandes** : Nouveau, Copier, Copier le chemin, Renommer, Supprimer, Ouvrir, Pause, Reprendre, Propriétés, Trier, Affichage, Voir plus, Volet des détails.
- **Six affichages** : Grandes icônes, Icônes moyennes, Petites icônes, Liste, Détails (colonnes triables et redimensionnables), Contenu. Ctrl+molette ou Ctrl+Maj+2…8 pour changer.
- **Souris** : clic simple pour sélectionner, double-clic pour ouvrir, sélection au rectangle dans le vide, clic droit dans le vide (affichage, tri, coller un lien, tout sélectionner…), glisser un fichier terminé vers un dossier ou une autre application.
- **Raccourcis clavier de Windows** : Ctrl+A, Ctrl+C (copier le fichier), Ctrl+Maj+C (copier le chemin), Ctrl+V (coller un lien), Ctrl+Z (annuler le retrait), Suppr, Maj+Suppr, F2, F3, F5, Alt+Entrée, Alt+Maj+P, Début/Fin, flèches… **F1** affiche la liste.
- **Suppr** retire de la liste sans question, avec un bouton **Annuler** ; **Maj+Suppr** supprime aussi le fichier, après confirmation.
- **Barre d'état** en bas (nombre d'éléments, sélection et taille), police et couleur d'accent de Windows (option « Couleur de Windows »).

**Navigateur**
- **Souris** : boutons latéraux précédent / suivant, clic du milieu ou Ctrl+clic sur un lien (onglet en arrière-plan), clic du milieu sur un onglet pour le fermer, double-clic dans la barre d'onglets pour en ouvrir un, Ctrl+molette pour le zoom.
- **Vérification « Je ne suis pas un robot »** : le navigateur ne modifie plus les pages, garde la même identité partout et ne filtre plus rien pendant la vérification. La page ne devrait plus revenir sans fin à la vérification.
- **Extensions** : la boutique n'est plus filtrée par le bloqueur ; nouveau champ **Installer avec un lien** (lien de la boutique ou identifiant) si la page de la boutique ne s'affiche pas ; bouton *Réessayer* sur les pages en erreur.
- **Mots de passe** : **importer un fichier .csv** (exporté par un navigateur ou un gestionnaire de mots de passe) et **exporter en .csv**.

### 🇬🇧 English
- **Start with Windows:** DrYAE now starts hidden in the taskbar icons, with no window. Clicking the icon opens the browser.
- **Download manager that works like a Windows folder:**
  - a command bar and six views (large / medium / small icons, list, details with sortable columns, content);
  - Explorer-style mouse use: rectangle selection, double-click to open, right-click on empty space, drag files out;
  - standard Windows shortcuts (Ctrl+C copies the file, Ctrl+Z undoes a removal, Alt+Enter, F2, F5, Ctrl+Shift+2…8…);
  - a status bar and the Windows accent color.
- **Browser:**
  - mouse side buttons, middle-click / Ctrl+click on links, middle-click to close a tab, double-click on the tab bar, Ctrl+wheel zoom;
  - the "I'm not a robot" check should no longer keep coming back;
  - extensions can be installed from a link;
  - passwords can be imported and exported as .csv.

## 1.6.1

### 🇫🇷 Français

**Torrents plus légers**
- Nouveau moteur torrent **aria2** (natif et léger) : beaucoup moins de processeur et de batterie. Il ne tourne que pendant les téléchargements de torrents.
- Un lien `.torrent` ou `magnet:` cliqué dans le navigateur DrYAE ouvre le choix des fichiers **sur la page** : on ne quitte plus le site.

**Gestionnaire de téléchargements**
- **Raccourcis clavier** : Ctrl+A, Maj+clic, Ctrl+clic, ↑/↓, Entrée, Espace, Suppr, Maj+Suppr, F2, Ctrl+I, Ctrl+C, Ctrl+V… (**F1** affiche la liste complète).
- **Doublons** : si le même lien ou le même titre est déjà là, DrYAE demande : *Remplacer*, *Garder les deux (numéroter)* ou *Annuler*.
- **Corbeille** : demande de confirmation, avec la case « Ne plus prévenir ».
- Nouveau bouton **Navigateur** en haut à droite, et une vraie icône de paramètres, différente de celle du thème.

**Navigateur**
- **Nouveau menu ⋮** : historique, marque-pages, imprimer, enregistrer sous, traduire, zoom, plein écran, outils, aide…
- **Raccourcis clavier standards des navigateurs** (Ctrl+T, Ctrl+W, Ctrl+Maj+T, Ctrl+Tab, Ctrl+D, Ctrl+P, F11, F12…), même quand la page a le focus.
- **Paramètres propres au navigateur** : moteur de recherche, vie privée, bloqueur de publicités, mots de passe, extensions.
- Panneau **« Fichier(s) détecté(s) »** : taille estimée des flux vidéo, nombre de morceaux, résolution et durée. Boutons *Tout effacer*, *Réinitialiser* et *Trier*, filtre, et sélection de plusieurs fichiers.
- Les **tailles des vidéos** s'affichent désormais aussi sur les sites de streaming.

### 🇬🇧 English
- New native **aria2** torrent engine: much lighter on CPU and battery. Torrents clicked in the browser open the file picker **on the page**.
- Download manager: **keyboard shortcuts** (F1 shows the list), a **duplicate prompt** (replace / keep both / cancel), and a **confirmation before clearing** the list, with a "Don't ask again" option. The **Browser** button has moved to the top bar.
- Browser:
  - **new menu and standard browser shortcuts**, which also work while the page has focus;
  - its **own settings**, separate from the download manager's;
  - a new **Detected file(s)** panel showing estimated stream size, pieces, resolution and duration, with Clear all, Reset and Sort.
- Video sizes are now shown on streaming sites too.

## 1.6.0
- Première version publique : installateur avec choix de la langue (6 langues), mise à jour en un clic, bouton « Donner mon avis ».
- Titres des vidéos au lieu des liens, panneau **Informations** complet, barre latérale toujours visible.
- First public release: installer with language choice, one-click updates, feedback button.
