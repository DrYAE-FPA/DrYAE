// Fichiers pour publier DrYAE dans winget (catalogue d'applications de Windows) :
//   node tools/winget.js <chemin de DrYAE-Setup-X.Y.Z.exe>
// Crée winget/manifests/d/DrYAE-FPA/DrYAE/X.Y.Z/ (3 fichiers). Ils sont ensuite proposés au dépôt
// microsoft/winget-pkgs (voir winget/LISEZMOI.md).
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const exe = process.argv[2];
if (!exe || !fs.existsSync(exe)) { console.error('usage : node tools/winget.js DrYAE-Setup-X.Y.Z.exe'); process.exit(1); }
const V = require('../package.json').version;
const sha = crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex').toUpperCase();
const ID = 'DrYAE-FPA.DrYAE', MV = '1.9.0';
const dir = path.join(__dirname, '..', 'winget', 'manifests', 'd', 'DrYAE-FPA', 'DrYAE', V); fs.mkdirSync(dir, { recursive: true });
const head = t => `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${t}.${MV}.schema.json\n`;
fs.writeFileSync(path.join(dir, `${ID}.yaml`), head('version') + `PackageIdentifier: ${ID}\nPackageVersion: ${V}\nDefaultLocale: fr-FR\nManifestType: version\nManifestVersion: ${MV}\n`);
fs.writeFileSync(path.join(dir, `${ID}.installer.yaml`), head('installer') + `PackageIdentifier: ${ID}
PackageVersion: ${V}
InstallerType: nullsoft
Scope: user
InstallModes:
- interactive
- silent
UpgradeBehavior: install
FileExtensions:
- torrent
- cbz
- cbr
- cb7
Protocols:
- magnet
Installers:
- Architecture: x64
  InstallerUrl: https://github.com/DrYAE-FPA/DrYAE/releases/download/v${V}/DrYAE-Setup-${V}.exe
  InstallerSha256: ${sha}
ManifestType: installer
ManifestVersion: ${MV}
`);
fs.writeFileSync(path.join(dir, `${ID}.locale.fr-FR.yaml`), head('defaultLocale') + `PackageIdentifier: ${ID}
PackageVersion: ${V}
PackageLocale: fr-FR
Publisher: DrYAE-FPA
PublisherUrl: https://github.com/DrYAE-FPA
PackageName: DrYAE
PackageUrl: https://dryae-fpa.github.io/DrYAE/
License: GPL-3.0
LicenseUrl: https://github.com/DrYAE-FPA/DrYAE/blob/main/LICENSE
ShortDescription: Gestionnaire de téléchargements et navigateur gratuits, avec traducteur de pages et de BD.
Description: DrYAE est un gestionnaire de téléchargements libre avec un navigateur intégré (bloqueur de publicités, extensions Chrome, lecteur PDF), un traducteur de pages, un traducteur des bulles de BD et de mangas et un lecteur de BD (.cbz, .cbr).
Tags:
- download-manager
- browser
- torrent
- translator
- comics
- manga
ReleaseNotesUrl: https://github.com/DrYAE-FPA/DrYAE/releases/tag/v${V}
ManifestType: defaultLocale
ManifestVersion: ${MV}
`);
console.log('winget :', dir, sha);
