<p align="center"><img src="assets/logo.png" width="96" alt="DrYAE"></p>
<h1 align="center">DrYAE</h1>
<p align="center">Free download manager with a built-in browser, for Windows<br>Gestionnaire de téléchargements gratuit avec navigateur intégré, pour Windows</p>

---

## ✨ Nouveautés de la version 1.6.5 / What's new

- 🧩 **Menu des extensions** : toutes les extensions (intégrées et Chrome) au même endroit, avec une punaise pour les **épingler** dans la barre d'outils. Les fenêtres des extensions Chrome s'ouvrent sous leur bouton, entièrement visibles.
- 🌐 **Traducteur repensé** : traduction en direct du texte saisi, bouton plus fiable sur la sélection (masqué si le texte est déjà dans votre langue), deuxième langue automatique, sites traduits automatiquement.
- 🖼️ **Traducteur de scans repensé** : capture d'une zone (Ctrl+Maj+S), traduction automatique par site, bulles plus propres, texte vertical (japonais, coréen, chinois), icônes pour comparer l'original et la traduction.
- 💡 **Lumières tamisées** : opacité et couleur en direct, protection des yeux, lueur, outils vidéo (vitesse, boucle, zoom, filtres, capture, plein onglet), mode nuit programmé.
- 🛡️ Bloqueur : fenêtre avec **mode de filtrage par site** (Aucun / Basique / Optimal) et la liste de Peter Lowe par défaut.
- ⭐ « Choisir un autre dossier… » pour les favoris, sélection à la souris dans les listes, choix du compte enregistré à la connexion.
- 🔄 **Mises à jour sans fenêtre d'installation** : DrYAE redémarre avec vos réglages et votre langue ; le téléchargement de la mise à jour s'affiche dans le gestionnaire.

👉 Toutes les nouveautés : [CHANGELOG.md](CHANGELOG.md) · ⬇️ [Télécharger DrYAE](https://github.com/DrYAE-FPA/DrYAE/releases/latest)

---

## Français

DrYAE télécharge vos fichiers plus vite en plusieurs morceaux, gère les torrents et les flux vidéo, et inclut un navigateur avec bloqueur de publicités.

**Fonctions**
- Téléchargements HTTP multi-connexions, avec reprise, file d'attente, planificateur et limite de vitesse
- Torrents et liens magnet
- Flux vidéo HLS (m3u8) et vidéos de sites en ligne, en MP4 (choix de la qualité) ou MP3, avec la taille affichée avant le téléchargement
- Navigateur intégré : onglets, favoris (barre et gestionnaire), historique, mots de passe chiffrés avec vérification, cartes et adresses, extensions Chrome, bloqueur de publicités, traducteur de pages et de scans, lumières tamisées, image dans l'image
- Extension pour Google Chrome (dossier `extension`)
- Interface en anglais, espagnol, français, arabe, portugais et russe

**Mode d'emploi complet : [docs/GUIDE.md](docs/GUIDE.md)**

**Installation :** téléchargez `DrYAE-Setup-x.y.z.exe` dans la page [Releases](https://github.com/DrYAE-FPA/dryae/releases/latest). L'installateur demande la langue (modifiable ensuite dans Paramètres → Général).

**Mises à jour :** DrYAE vérifie les nouvelles versions publiées ici. Pour installer la nouvelle version, cliquez sur « Mettre à jour » dans le bandeau ou dans Paramètres → À propos.

**Avis et problèmes :** utilisez le bouton « Donner mon avis » dans l'application, ou la page [Issues](https://github.com/DrYAE-FPA/dryae/issues).

**Soutenir le projet :** DrYAE est gratuit et le restera. Si vous voulez soutenir son développement, vous pouvez faire un don : <!-- ajoutez ici votre lien de don -->

### Utilisation responsable
DrYAE est un outil neutre, comme un navigateur. **Téléchargez uniquement des contenus que vous avez le droit de copier :** vos propres fichiers, des contenus libres ou des contenus dont l'auteur autorise le téléchargement. DrYAE ne contourne aucune protection anti-copie (DRM). Respectez les conditions d'utilisation des sites que vous visitez. Les auteurs de DrYAE ne sont pas responsables de l'usage qui en est fait.

---

## English

DrYAE downloads files faster by splitting them into several parts. It handles torrents and video streams, and it includes a browser with an ad blocker.

**Features**
- Multi-connection HTTP downloads, with resume, queue, scheduler and speed limit
- Torrents and magnet links
- HLS (m3u8) streams and online videos, as MP4 (choose the quality) or MP3, with the size shown before downloading
- Built-in browser: tabs, bookmarks, history, encrypted passwords, autofill, Chrome extensions and an ad blocker
- Google Chrome extension (`extension` folder)
- Available in English, Spanish, French, Arabic, Portuguese and Russian

**Full user guide: [docs/GUIDE.en.md](docs/GUIDE.en.md)**

**Install:** download `DrYAE-Setup-x.y.z.exe` from [Releases](https://github.com/DrYAE-FPA/dryae/releases/latest). The installer asks for your language. You can change it later in Settings → General.

**Updates:** DrYAE checks for new versions published here. To install one, click "Update" in the banner or in Settings → About.

**Feedback and bugs:** use the "Give feedback" button in the app, or the [Issues](https://github.com/DrYAE-FPA/dryae/issues) page.

**Support:** DrYAE is free and will stay free. Donations help development: <!-- add your donation link here -->

### Responsible use
DrYAE is a neutral tool, like a web browser. **Only download content you have the right to copy:** your own files, free content, or content whose owner allows downloading. DrYAE does not bypass copy protection (DRM). Follow the terms of service of the sites you visit. The DrYAE authors are not responsible for how it is used.

---

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/) (once approved). Details: [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md) · Privacy: [PRIVACY.md](PRIVACY.md)

## License / Licence

DrYAE is free software, released under the **GNU General Public License v3.0 or later**. See [LICENSE](LICENSE). Anyone may use, study, modify and share it. Any copy or modified version must stay under the same license, with its source code. Bundled third-party components are listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

DrYAE est un logiciel libre sous licence **GNU GPL v3.0 ou ultérieure**. Toute copie ou version modifiée doit rester sous cette licence, avec son code source.

## Build / Compiler

```
npm install
npm start                 # run from source
```
Windows build: see `tools/BUILD.md`.
