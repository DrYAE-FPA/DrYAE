# Guide d'utilisation de DrYAE

*[English version](GUIDE.en.md)*

## 1. Installer
1. Téléchargez **DrYAE-Setup-x.y.z.exe** dans la page [Releases](https://github.com/DrYAE-FPA/dryae/releases/latest).
2. Lancez-le et choisissez votre langue dans la liste (anglais par défaut).
3. Acceptez la licence et suivez les étapes. L'installateur crée un raccourci sur le Bureau et dans le menu Démarrer.

Windows peut afficher « Windows a protégé votre ordinateur », parce que l'application n'est pas signée par un éditeur payant. Cliquez sur **Informations complémentaires → Exécuter quand même**.

**Version portable :** décompressez le zip et lancez `DrYAE.exe`. Il n'y a rien à installer, mais les mises à jour en un clic ne sont pas disponibles.

## 2. Le gestionnaire de téléchargements
Le gestionnaire s'utilise comme un dossier de Windows :
- **à gauche**, les filtres : Tous, En cours, Terminés, En pause, Planifiés, Échecs, ainsi que les types (Torrents, Vidéos en ligne…) et les catégories (Vidéos, Musique, Documents…) ;
- **en haut**, le bouton **Ajouter**, **Tout reprendre**, **Tout mettre en pause** et la recherche (Ctrl+F ou F3) ;
- **la barre de commandes** : Nouveau, Copier, Copier le chemin, Renommer, Supprimer, Ouvrir, Pause, Reprendre, Propriétés, **Trier**, **Affichage**, ⋯ (plus de commandes) et **Détails** (volet des détails) ;
- **au centre**, la liste, et **en bas** la barre d'état (nombre d'éléments, sélection et taille).

### Affichages
**Affichage** propose : Grandes icônes, Icônes moyennes, Petites icônes, Liste, Détails et Contenu. Vous pouvez aussi utiliser **Ctrl+molette** ou **Ctrl+Maj+2…8**. En affichage Détails, cliquez sur un en-tête de colonne pour trier, et faites glisser son bord pour changer sa largeur.

### Souris
- **Clic** : sélectionne. **Ctrl+clic** et **Maj+clic** : sélection multiple.
- **Double-clic** : ouvre le fichier terminé (ou les propriétés d'un téléchargement en cours).
- **Glisser dans le vide** : sélection au rectangle.
- **Clic droit** sur un élément : ouvrir, dossier, pause, renommer, copier, retirer… ; **clic droit dans le vide** : affichage, tri, coller un lien, tout sélectionner, actualiser.
- **Glisser un fichier terminé** vers un dossier, le Bureau ou une autre application pour le copier.

### Supprimer
- **Suppr** retire l'élément de la liste (le fichier reste sur le disque). Un bouton **Annuler** apparaît quelques secondes ; **Ctrl+Z** fait la même chose.
- **Maj+Suppr** supprime aussi le fichier, après confirmation.

### Ajouter un téléchargement
- **Ajouter → Lien :** collez une ou plusieurs adresses (une par ligne). Vous pouvez choisir le dossier, le nom, le nombre de connexions et une limite de vitesse.
- **Glisser-déposer :** déposez des liens ou des fichiers `.torrent` sur la fenêtre.
- **Presse-papiers :** quand vous copiez un lien, DrYAE propose de le télécharger. Vous pouvez désactiver cela dans Paramètres.
- **Lot :** une adresse contenant `[1-50]` est remplacée par 1, 2, 3… jusqu'à 50.

### Doublons
Si vous ajoutez un fichier déjà présent (même lien ou même titre), DrYAE demande : **Remplacer**, **Garder les deux (numéroter)** ou **Annuler**. Cochez « Toujours faire ce choix » pour ne plus être interrogé (modifiable dans Paramètres → Téléchargements).

### Vider la liste
La **corbeille** en haut retire les téléchargements terminés de la liste (les fichiers restent sur le disque). Une confirmation s'affiche ; cochez « Ne plus prévenir » pour la supprimer (réactivable dans Paramètres → Général).

### Si un lien a expiré
Faites un clic droit → **Rafraîchir le lien** et collez un nouveau lien vers le même fichier. Le téléchargement reprend là où il s'était arrêté.

## 3. Vidéos (MP4 / MP3)
1. Ouvrez le **navigateur DrYAE** avec le bouton à gauche ou Ctrl+B, puis allez sur la page de la vidéo.
2. Cliquez sur l'**icône de téléchargement** en haut à droite. Le petit chiffre indique le nombre de vidéos trouvées.
3. Le panneau **Choisir un format** affiche :
   - **Vidéo · MP4**, avec la qualité (1080p, 720p…) et la taille de chaque fichier ;
   - **Audio MP3**, en 320, 192 ou 128 kb/s, ou M4A sans réencodage ;
   - les fichiers détectés pendant la lecture.
4. Cliquez sur **Télécharger**. Le téléchargement continue en arrière-plan, et vous pouvez continuer à naviguer.

**Plus d'options** permet de changer le nom, le dossier ou la vitesse, d'ajouter en pause ou de planifier.

Si aucune vidéo n'est trouvée, lancez la lecture puis réessayez. Si une vidéo YouTube ne se télécharge plus, allez dans **Paramètres → Téléchargements → Mettre à jour yt-dlp**.

Les vidéos protégées par DRM (Netflix, Disney+…) ne peuvent pas être téléchargées.

## 4. Torrents
- **Ajouter → Torrent**, ou cliquez sur un lien `magnet:` / `.torrent` dans le navigateur DrYAE (le choix des fichiers s'ouvre sur la page, sans la quitter), ou déposez un fichier `.torrent`.
- Le moteur torrent (aria2) est natif et très léger : il ne tourne que pendant les téléchargements de torrents.
- DrYAE lit la liste des fichiers. Cochez ceux que vous voulez.
- **Téléchargement séquentiel** : permet de regarder une vidéo pendant qu'elle se télécharge.
- Le **partage** (seeding) après la fin et le ratio se règlent dans Paramètres → Torrents.

## 5. Le navigateur intégré
- **Onglets :** Ctrl+T pour un nouvel onglet, Ctrl+Maj+N pour un onglet privé, Ctrl+W pour fermer. Faites glisser les onglets pour les réorganiser. Un onglet ne se charge que lorsque vous l'ouvrez.
- **Souris :** boutons latéraux pour page précédente / suivante ; clic du milieu ou Ctrl+clic sur un lien pour l'ouvrir dans un onglet en arrière-plan ; clic du milieu sur un onglet pour le fermer ; double-clic dans la barre d'onglets pour en ouvrir un ; Ctrl+molette pour le zoom.
- **Menu ⋮ :** nouvel onglet, onglet privé, **Mots de passe et saisie automatique**, **Historique** (avec les onglets fermés récemment), **Téléchargements**, **Favoris**, **Extensions**, effacer les données de navigation, zoom, imprimer, traduire la page, rechercher, enregistrer sous, outils supplémentaires, aide, **Paramètres**.
- **Pages de gestion :** Historique (Ctrl+H), Favoris (Ctrl+Maj+O), Mots de passe, Extensions (Ctrl+Maj+A) et Paramètres s'ouvrent dans un onglet. Elles se pilotent au clavier comme le gestionnaire : ↑ ↓ pour se déplacer, Maj+↑↓ ou Ctrl+clic pour sélectionner, Ctrl+A tout sélectionner, Entrée ouvrir, Ctrl+Entrée nouvel onglet, Suppr supprimer, F2 modifier, Ctrl+Z annuler, Ctrl+F rechercher.
- **Historique :** par date ou par site ; « Effacer les données de navigation » (Ctrl+Maj+Suppr) avec la période (15 minutes, 1 heure, 24 heures, 7 jours, 4 semaines, depuis le début).
- **Favoris :** l'étoile (Ctrl+D) ajoute la page et permet de choisir son nom et son dossier ; Ctrl+Maj+D ajoute tous les onglets ; Ctrl+Maj+B affiche la **barre de favoris** (glisser-déposer, clic droit, dossiers). Le gestionnaire de favoris range, trie, importe et exporte (fichier HTML).
- **Fichier(s) détecté(s) :** le bouton de téléchargement liste tout ce que la page lit, avec la taille (estimée « ~ » pour les flux), le nombre de morceaux, la résolution et la durée. **Tout effacer** vide la liste, **Réinitialiser** la réaffiche, **Trier** change l'ordre, et « Sélectionner les fichiers » permet d'en télécharger plusieurs d'un coup.
- **Mots de passe :** après une connexion, DrYAE propose de l'enregistrer ; sur une page d'inscription, il propose un mot de passe fort. Les mots de passe sont chiffrés par Windows sur votre PC. La page Mots de passe les range par site et propose :
  - **Vérification** : mots de passe compromis (fuites connues), réutilisés ou faibles ;
  - **Modes de paiement** (cartes, sans le code CVC) et **Adresses**, proposés dans les formulaires ;
  - **Paramètres** : Windows Hello avant d'afficher un mot de passe, import / export .csv (colonnes url, username, password), sites refusés.
- **Menu des extensions** (bouton à 3 blocs) : toutes les extensions, intégrées et Chrome. Cliquez sur une extension pour l'ouvrir, sur la **punaise** pour l'épingler dans la barre d'outils (ou l'en retirer), sur ⋮ pour ses options. **Glissez** une ligne du menu, ou un bouton de la barre d'outils, pour changer l'ordre.
- **Extensions intégrées** (activer, épingler, retirer, options) :
  - **Bloqueur de publicités** : le bouclier ouvre une fenêtre avec la protection du site, le **mode de filtrage** (Aucun, Basique, Optimal), le nombre d'éléments bloqués et « Masquer un élément » ;
  - **Téléchargements par DrYAE** : désactivée, le navigateur enregistre lui-même les fichiers (bouton de téléchargements dans la barre d'outils) ;
  - **Traducteur** : sélectionnez un texte puis cliquez sur le bouton qui apparaît ; la fenêtre du traducteur reprend le texte sélectionné dans la page et traduit en direct ce que vous tapez, traduit la page (Ctrl+Maj+E) et peut traduire un site automatiquement. Une **deuxième langue** sert quand le texte est déjà dans la première. Clic droit sur un lien → « Traduire le texte du lien » ;
  - **Traducteur de scans** : la langue des images est reconnue toute seule (« Automatique ») et le texte est traduit en français, ou en anglais s'il est déjà en français. Bouton de la barre d'outils pour toutes les images, **Ctrl+Maj+S** pour traduire une zone (dessinez un rectangle puis « Traduire la zone »), ou clic droit sur une image. Au survol d'une image traduite, des icônes permettent de revoir l'original, de **comparer** en glissant, de relire ou de copier le texte ;
  - **Lumières tamisées** (Ctrl+Maj+L) : opacité (Alt+↑ / Alt+↓), couleur, protection des yeux (Alt+F10), lueur, outils vidéo (vitesse, boucle, zoom, filtres, capture, plein onglet), mode nuit par site ou partout (avec horaire) ;
  - **Image dans l'image** : bouton sur les vidéos, ou Ctrl+Maj+U.
- **Listes (historique, favoris, mots de passe)** : cliquez sur une ligne pour la sélectionner, ou maintenez le clic et glissez pour en sélectionner plusieurs (Ctrl pour ajouter).
- **Favoris** : dans la bulle de l'étoile, « Choisir un autre dossier… » ouvre une fenêtre avec le nom, l'adresse, les dossiers et « Nouveau dossier ».
- **Connexion en deux étapes** (adresse puis mot de passe) : un clic dans le champ de l'adresse affiche vos comptes enregistrés pour ce site.
- **Extensions Chrome :** ouvrez le Chrome Web Store depuis la page Extensions, puis cliquez sur « Ajouter à Chrome ». Si la boutique ne s'affiche pas, copiez le lien de la page de l'extension (ou son identifiant) dans **Installer avec un lien**.
- Si une vérification « Êtes-vous un humain ? » ne passe pas, utilisez **⋮ → Ouvrir cette page dans Chrome** avec l'extension DrYAE (voir section 7).

## 6. Planificateur et limites
- **Planificateur :** choisissez une heure de début et une heure de fin, ainsi que les jours. Vous pouvez aussi éteindre le PC à la fin.
- **Limite de vitesse :** le compteur en bas à gauche, ou Paramètres → Vitesse & réseau. Il existe aussi un quota quotidien en Mo.
- **Arrêt automatique :** DrYAE peut éteindre le PC quand tous les téléchargements sont terminés. Vous avez 60 secondes pour annuler.

## 7. Extension Chrome (facultatif)
Elle envoie à DrYAE les téléchargements de Google Chrome, les vidéos et les liens magnet.
1. Paramètres → **Extension Chrome → Ouvrir le dossier de l'extension**.
2. Dans Chrome, ouvrez `chrome://extensions` et activez le **Mode développeur**.
3. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier **Extension Chrome DrYAE**.
4. Épinglez l'icône DrYAE. DrYAE doit être ouvert pour recevoir les téléchargements.

## 8. Paramètres utiles
- **Général :** langue, dossier de téléchargement, démarrage avec Windows (DrYAE reste alors caché dans les icônes de la barre des tâches ; un clic sur son icône ouvre le navigateur), garder DrYAE dans la zone de notification.
- **Téléchargements :** connexions par fichier (jusqu'à 32), téléchargements simultanés, que faire si le fichier existe déjà, qualité MP4/MP3 par défaut.
- **Apparence :** thème clair, sombre ou noir (AMOLED), et couleur d'accent (par défaut, celle de Windows).
- **À propos :** version, **Rechercher les mises à jour**, **Donner mon avis**, licences.

## 9. Mises à jour et avis
- Quand une nouvelle version sort, un bandeau **Mettre à jour** apparaît. Cliquez dessus : le téléchargement s'affiche dans le gestionnaire. Puis cliquez sur **Redémarrer et installer** : DrYAE s'installe sans fenêtre et se rouvre avec vos réglages et votre langue.
- Le bouton **Donner mon avis** ouvre la page [Issues](https://github.com/DrYAE-FPA/dryae/issues) pour signaler un problème ou proposer une idée.

## 10. Raccourcis clavier
Appuyez sur **F1** dans le gestionnaire ou dans le navigateur pour afficher la liste complète.

**Gestionnaire (raccourcis de Windows) :** Ctrl+A (tout sélectionner) · Ctrl+clic / Maj+clic · flèches et Maj+flèches · Début / Fin · Entrée (ouvrir) · Espace (pause / reprendre) · F2 (renommer) · Suppr (retirer de la liste) · Maj+Suppr (supprimer définitivement) · Ctrl+Z (annuler le retrait) · Ctrl+C (copier le fichier) · Ctrl+Maj+C (copier le chemin) · Ctrl+V (coller un lien) · Alt+Entrée (propriétés) · Alt+Maj+P (volet des détails) · Ctrl+Maj+2…8 (affichages) · F3 / Ctrl+F (rechercher) · F5 (actualiser) · Ctrl+E (dossier) · Ctrl+N (ajouter un lien) · Ctrl+T (torrent) · Ctrl+O (fichier .torrent) · Ctrl+B (navigateur) · Échap.

**Navigateur (raccourcis standards) :** Ctrl+T · Ctrl+Maj+P (onglet privé) · Ctrl+W · Ctrl+Maj+T (rouvrir l'onglet fermé) · Ctrl+Tab · Ctrl+1…9 · Ctrl+L / F6 · Ctrl+F / F3 · F5 / Ctrl+R · Alt+←/→ · Ctrl+D · Ctrl+H · Ctrl+J (gestionnaire) · Ctrl+Maj+Y (fichiers détectés) · Ctrl+P · Ctrl+S · Ctrl+U · Ctrl+M (son) · Ctrl+ +/−/0 · F11 · F12 · Ctrl+Maj+Suppr · Ctrl+Maj+Q.

## Utilisation responsable
Téléchargez uniquement ce que vous avez le droit de copier : vos fichiers, des contenus libres ou autorisés. Respectez les conditions d'utilisation des sites que vous visitez.
