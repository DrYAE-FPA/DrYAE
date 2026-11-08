# Nouveautés / Changelog

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
