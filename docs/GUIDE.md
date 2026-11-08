# Guide d'utilisation de DrYAE

*[English version](GUIDE.en.md)*

## 1. Installer
1. Téléchargez **DrYAE-Setup-x.y.z.exe** dans la page [Releases](https://github.com/DrYAE-FPA/dryae/releases/latest).
2. Lancez-le et choisissez votre langue dans la liste (anglais par défaut).
3. Acceptez la licence et suivez les étapes. L'installateur crée un raccourci sur le Bureau et dans le menu Démarrer.

Windows peut afficher « Windows a protégé votre ordinateur », parce que l'application n'est pas signée par un éditeur payant. Cliquez sur **Informations complémentaires → Exécuter quand même**.

**Version portable :** décompressez le zip et lancez `DrYAE.exe`. Il n'y a rien à installer, mais les mises à jour en un clic ne sont pas disponibles.

## 2. Le gestionnaire de téléchargements
La fenêtre principale contient :
- **à gauche**, les filtres : Tous, En cours, Terminés, En pause, Planifiés, Échecs, ainsi que les types (Torrents, Vidéos en ligne…) et les catégories (Vidéos, Musique, Documents…) ;
- **en haut**, le bouton **Ajouter**, **Tout reprendre**, **Tout mettre en pause** et la recherche (Ctrl+F) ;
- **au centre**, la liste. Chaque ligne montre le titre, la taille, la vitesse et le temps restant. Faites un clic droit sur une ligne pour l'ouvrir, la mettre en pause, la reprendre, renommer le fichier, renouveler le lien, copier le lien, ou la supprimer.

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
- **Menu ⋮ (comme Firefox) :** nouvel onglet, historique, marque-pages, Téléchargements (le gestionnaire), mots de passe, extensions, imprimer, enregistrer sous, traduire la page, rechercher, zoom, **Paramètres du navigateur** (moteur de recherche, vie privée, bloqueur de publicités…, séparés de ceux du gestionnaire), outils supplémentaires, aide.
- **Fichier(s) détecté(s) :** le bouton de téléchargement liste tout ce que la page lit, avec la taille (estimée « ~ » pour les flux), le nombre de morceaux, la résolution et la durée. **Tout effacer** vide la liste, **Réinitialiser** la réaffiche, **Trier** change l'ordre, et « Sélectionner les fichiers » permet d'en télécharger plusieurs d'un coup.
- **Bloqueur de publicités :** cliquez sur le bouclier pour le désactiver sur un site.
- **Mots de passe :** après une connexion, DrYAE propose de l'enregistrer. Les mots de passe sont chiffrés par Windows sur votre PC.
- **Saisie automatique :** remplissez votre profil (nom, e-mail, adresse…). DrYAE propose ensuite « Remplir avec mon profil » dans les formulaires.
- **Extensions Chrome :** ouvrez le Chrome Web Store depuis le panneau Extensions, puis cliquez sur « Ajouter à Chrome ».
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
- **Général :** langue, dossier de téléchargement, démarrage avec Windows, garder DrYAE dans la zone de notification.
- **Téléchargements :** connexions par fichier (jusqu'à 32), téléchargements simultanés, que faire si le fichier existe déjà, qualité MP4/MP3 par défaut.
- **Apparence :** thème clair, sombre ou noir (AMOLED), et couleur d'accent.
- **À propos :** version, **Rechercher les mises à jour**, **Donner mon avis**, licences.

## 9. Mises à jour et avis
- Quand une nouvelle version sort, un bandeau **Mettre à jour** apparaît. Cliquez dessus, puis sur **Redémarrer et installer**.
- Le bouton **Donner mon avis** ouvre la page [Issues](https://github.com/DrYAE-FPA/dryae/issues) pour signaler un problème ou proposer une idée.

## 10. Raccourcis clavier
Appuyez sur **F1** dans le gestionnaire ou dans le navigateur pour afficher la liste complète.

**Gestionnaire :** Ctrl+A (tout sélectionner) · Maj+clic / Ctrl+clic · ↑/↓ et Maj+↑/↓ · Entrée (ouvrir) · Espace (pause/reprendre) · Suppr (retirer) · Maj+Suppr (retirer et supprimer les fichiers) · F2 (renommer) · Ctrl+I (informations) · Ctrl+C (copier le lien) · Ctrl+E (dossier) · Ctrl+N (ajouter un lien) · Ctrl+T (torrent) · Ctrl+O (fichier .torrent) · Ctrl+V (coller un lien) · Ctrl+B (navigateur) · Échap.

**Navigateur (comme Firefox) :** Ctrl+T · Ctrl+Maj+P (onglet privé) · Ctrl+W · Ctrl+Maj+T (rouvrir l'onglet fermé) · Ctrl+Tab · Ctrl+1…9 · Ctrl+L / F6 · Ctrl+F / F3 · F5 / Ctrl+R · Alt+←/→ · Ctrl+D · Ctrl+H · Ctrl+J (gestionnaire) · Ctrl+Maj+Y (fichiers détectés) · Ctrl+P · Ctrl+S · Ctrl+U · Ctrl+M (son) · Ctrl+ +/−/0 · F11 · F12 · Ctrl+Maj+Suppr · Ctrl+Maj+Q.

## Utilisation responsable
Téléchargez uniquement ce que vous avez le droit de copier : vos fichiers, des contenus libres ou autorisés. Respectez les conditions d'utilisation des sites que vous visitez.
