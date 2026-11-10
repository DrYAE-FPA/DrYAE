#!/usr/bin/env bash
# Construit la version Windows de DrYAE.
#   ./tools/build-win.sh            -> tout (dossier portable dist/DrYAE + installateur)
#   ./tools/build-win.sh package    -> seulement le dossier portable (à signer avant l'installateur)
#   ./tools/build-win.sh installer  -> seulement l'installateur, à partir de dist/DrYAE
# Sous Linux, l'installateur demande wine + wine32. Sous Windows (GitHub Actions), rien de plus.
set -euo pipefail
cd "$(dirname "$0")/.."
STAGE="${1:-all}"
VER=$(node -p "require('./package.json').version")

if [ "$STAGE" != "installer" ]; then
  node tools/build-locales.js && node tools/build-ext-locales.js
  rm -rf dist
  npx @electron/packager . DrYAE --platform=win32 --arch=x64 --out=dist --icon=assets/icon.ico \
    --app-version="$VER" --build-version="$VER" --app-copyright="DrYAE contributors — GPL-3.0" \
    --win32metadata.CompanyName="DrYAE" --win32metadata.FileDescription="DrYAE" --win32metadata.ProductName="DrYAE" \
    --extra-resource=THIRD_PARTY_NOTICES.txt --extra-resource=dryae.config.json --extra-resource=LICENSE \
    --ignore="^/test" --ignore="^/bin/linux" --ignore="^/dist" --ignore="^/extension" --ignore="^/locales" \
    --ignore="^/tools" --ignore="^/\.github" --ignore="^/README" --ignore="^/docs" --ignore="^/build" --ignore="\.gitignore" --overwrite --quiet
  mv dist/DrYAE-win32-x64 dist/DrYAE
  A=dist/DrYAE/resources/app
  # retirer les binaires des autres systèmes
  find $A/node_modules -type d -path "*/prebuilds/*" ! -name "win32-x64" -prune -exec rm -rf {} + 2>/dev/null || true
  rm -rf $A/node_modules/7zip-bin/linux $A/node_modules/7zip-bin/mac
  # lecture du texte des images : les copies « .wasm.js » (version navigateur) ne servent pas ici (~25 Mo)
  T=$A/node_modules/tesseract.js-core
  [ -d "$T" ] && find "$T" -maxdepth 1 -name '*.wasm.js' -delete
  rm -rf $A/node_modules/tesseract.js/dist
  # moteur de lecture des scans : seule la version WebAssembly simple sert sous Node (~125 Mo retirés)
  O=$A/node_modules/onnxruntime-web
  if [ -d "$O" ]; then
    find "$O/dist" -type f ! -name 'ort.node.min.js' ! -name 'ort.node.min.mjs' ! -name 'ort-wasm-simd-threaded.wasm' ! -name 'ort-wasm-simd-threaded.mjs' -delete
    rm -rf "$O/lib" "$O/docs"
  fi
  # licences et notes
  mv dist/DrYAE/LICENSE dist/DrYAE/LICENSE.electron.txt
  cp LICENSE dist/DrYAE/LICENSE.txt
  cp THIRD_PARTY_NOTICES.txt PRIVACY.md dist/DrYAE/
  cp -r extension "dist/DrYAE/Extension Chrome DrYAE"
  # fichier lu par la mise à jour en un clic (electron-updater)
  node -e "const c=require('./dryae.config.json').github||{};if(c.owner&&c.repo)require('fs').writeFileSync('dist/DrYAE/resources/app-update.yml','provider: github\\nowner: '+c.owner+'\\nrepo: '+c.repo+'\\nupdaterCacheDirName: dryae-updater\\n')"
  cat > dist/DrYAE/LISEZMOI.txt <<TXT
DrYAE $VER — version portable / portable version
FR : lancez DrYAE.exe. La langue se change dans Paramètres → Général. Pour les mises à jour en un clic, utilisez l'installateur DrYAE-Setup-$VER.exe. F1 affiche les raccourcis clavier.
EN : run DrYAE.exe. Change the language in Settings → General. For one-click updates, use the DrYAE-Setup-$VER.exe installer. Press F1 for keyboard shortcuts.
Logiciel libre / Free software — GPL-3.0 (LICENSE.txt, THIRD_PARTY_NOTICES.txt, PRIVACY.md)
TXT
  echo "DrYAE $VER — portable build ready: dist/DrYAE"
fi

if [ "$STAGE" != "package" ]; then
  # nom affiché « Español » au lieu de « Español (Alfabetización Internacional) » dans le choix de langue
  for c in "$HOME/.cache/electron-builder" "${LOCALAPPDATA:-/nonexistent}/electron-builder"; do
    find "$c" -name "SpanishInternational.nsh" -exec sed -i 's/"Español (Alfabetización Internacional)" "Espanol (Alfabetizacion Internacional)"/"Español" "Espanol"/' {} + 2>/dev/null || true
  done
  rm -rf dist/installer
  OWNER=$(node -p "(require('./dryae.config.json').github||{}).owner||''")
  REPO=$(node -p "(require('./dryae.config.json').github||{}).repo||''")
  PUB=(); [ -n "$OWNER" ] && [ -n "$REPO" ] && PUB=(-c.publish.owner="$OWNER" -c.publish.repo="$REPO")
  npx electron-builder --win nsis --x64 --prepackaged dist/DrYAE --publish never "${PUB[@]}"
  echo "Installer: dist/installer/DrYAE-Setup-$VER.exe (+ latest.yml, .blockmap)"
fi
