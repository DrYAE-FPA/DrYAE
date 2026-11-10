# Nouveautés / Changelog

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
