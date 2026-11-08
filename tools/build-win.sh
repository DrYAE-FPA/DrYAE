#!/usr/bin/env bash
# Construit la version Windows de DrYAE : dossier portable dist/DrYAE puis installateur NSIS.
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./package.json').version")
node tools/build-locales.js && node tools/build-ext-locales.js
rm -rf dist
npx @electron/packager . DrYAE --platform=win32 --arch=x64 --out=dist --icon=assets/icon.ico \
  --app-version="$VER" --build-version="$VER" --app-copyright="DrYAE contributors — GPL-3.0" \
  --win32metadata.CompanyName="DrYAE" --win32metadata.FileDescription="DrYAE" --win32metadata.ProductName="DrYAE" \
  --extra-resource=THIRD_PARTY_NOTICES.txt --extra-resource=dryae.config.json --extra-resource=LICENSE \
  --ignore="^/test" --ignore="^/bin/linux" --ignore="^/dist" --ignore="^/extension" --ignore="^/locales" \
  --ignore="^/tools" --ignore="^/\.github" --ignore="^/README" --ignore="\.gitignore" --overwrite --quiet
mv dist/DrYAE-win32-x64 dist/DrYAE
A=dist/DrYAE/resources/app
# retirer les binaires des autres systèmes
find $A/node_modules -type d -path "*/prebuilds/*" ! -name "win32-x64" -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf $A/node_modules/7zip-bin/linux $A/node_modules/7zip-bin/mac
# licences
mv dist/DrYAE/LICENSE dist/DrYAE/LICENSE.electron.txt
cp LICENSE dist/DrYAE/LICENSE.txt
cp THIRD_PARTY_NOTICES.txt dist/DrYAE/
cp -r extension "dist/DrYAE/Extension Chrome DrYAE"
echo "DrYAE $VER — portable build ready: dist/DrYAE"

# ---- installateur (NSIS, via electron-builder ; sous Linux il faut wine + wine32) ----
# nom affiché « Español » au lieu de « Español (Alfabetización Internacional) » dans le choix de langue
find ~/.cache/electron-builder -name "SpanishInternational.nsh" -exec sed -i 's/"Español (Alfabetización Internacional)" "Espanol (Alfabetizacion Internacional)"/"Español" "Espanol"/' {} + 2>/dev/null || true
rm -rf dist/installer
OWNER=$(node -p "(require('./dryae.config.json').github||{}).owner||''")
REPO=$(node -p "(require('./dryae.config.json').github||{}).repo||''")
PUB=(); [ -n "$OWNER" ] && [ -n "$REPO" ] && PUB=(-c.publish.owner="$OWNER" -c.publish.repo="$REPO")
npx electron-builder --win nsis --x64 --prepackaged dist/DrYAE --publish never "${PUB[@]}"
echo "Installer: dist/installer/DrYAE-Setup-$VER.exe (+ latest.yml, .blockmap)"
