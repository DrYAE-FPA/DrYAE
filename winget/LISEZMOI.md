# Publier DrYAE dans winget

winget est le catalogue d'applications de Windows : avec lui, on installe DrYAE par une seule commande
(`winget install DrYAE-FPA.DrYAE`). C'est gratuit.

Les fichiers sont dans `manifests/d/DrYAE-FPA/DrYAE/<version>/`. Ils sont créés par `node tools/winget.js DrYAE-Setup-X.Y.Z.exe`
pour l'installateur publié (son empreinte SHA-256 doit correspondre exactement).

## Proposer DrYAE (une fois, avec le compte GitHub du propriétaire)

1. Ouvrir https://github.com/microsoft/winget-pkgs et cliquer sur **Fork** (copie du dépôt sur votre compte).
2. Dans votre copie, cliquer sur **Add file → Upload files**.
3. Glisser le dossier `manifests` (il contient `d/DrYAE-FPA/DrYAE/<version>/` et les 3 fichiers).
4. En bas, choisir **Create a new branch**, puis **Propose changes**, puis **Create pull request**.
5. Les robots de Microsoft vérifient l'installateur ; un relecteur accepte la demande (souvent en quelques jours).

Pour chaque nouvelle version : refaire les mêmes étapes avec le nouveau dossier de version.
