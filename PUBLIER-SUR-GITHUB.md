# Publier DrYAE sur GitHub (pas à pas)

## 1. Créer le dépôt (une seule fois)
1. Sur github.com : **New repository**. Nom conseillé : `DrYAE`. Choisir **Public**, sans README (il existe déjà).
2. Ouvrir `dryae.config.json` et remplir :
   ```json
   "github": { "owner": "TON_NOM_GITHUB", "repo": "DrYAE" },
   "donateUrl": "https://… (ton lien de don, facultatif)"
   ```
3. Dans `README.md`, remplacer les deux commentaires `<!-- … lien de don … -->` par ton lien de don.
4. Facultatif : décommenter `.github/FUNDING.yml` pour afficher le bouton « Sponsor » sur GitHub.
5. Envoyer le code : `git init`, `git add .`, `git commit -m "DrYAE 1.6"`, puis `git remote add origin https://github.com/TON_NOM/DrYAE.git` et `git push -u origin main`.

Le dossier `node_modules`, le dossier `dist` et les gros `.exe` de `bin/win` ne vont pas dans le dépôt (voir `.gitignore`). Ils sont livrés dans les versions publiées.

## 2. Publier une version (à chaque mise à jour)
1. Changer `"version"` dans `package.json` (ex. `1.6.1`), puis reconstruire l'installateur. **Important : le dépôt doit être renseigné dans `dryae.config.json` avant la construction**, sinon les copies installées ne sauront pas où chercher les mises à jour.
2. Sur GitHub : **Releases → Draft a new release**. Tag : `v1.6.1`, avec le même numéro que dans `package.json`.
3. Joindre ces fichiers :
   - `DrYAE-Setup-1.6.1.exe`
   - `DrYAE-Setup-1.6.1.exe.blockmap`
   - `latest.yml` (indispensable pour la mise à jour en un clic)
   - le zip de la version portable (facultatif)
   - **une fois**, la source de FFmpeg : `ffmpeg-6.0.tar.xz`, téléchargée sur https://ffmpeg.org/releases/. La licence GPL de FFmpeg l'exige quand on distribue son programme.
4. **Publish release**.

Les utilisateurs de la version installée voient alors un bandeau « DrYAE 1.6.1 est disponible ». Un clic sur « Mettre à jour » télécharge la mise à jour, puis « Redémarrer et installer » l'installe. Avec la version portable, le bouton ouvre la page de téléchargement.

## 3. Avis et critiques
Le bouton **« Donner mon avis »** (en bas à gauche du gestionnaire, dans le menu ⋮ du navigateur et dans Paramètres → À propos) ouvre la page *Issues* du dépôt. Les modèles « Problème » et « Avis / idée » sont déjà prêts dans `.github/ISSUE_TEMPLATE`. Tu reçois une notification GitHub pour chaque message.
