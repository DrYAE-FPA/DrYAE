#!/usr/bin/env bash
# Lance les tests de DrYAE (Electron + Playwright, écran virtuel) et échoue si une ligne « ÉCHEC » apparaît.
# Utilisé par GitHub Actions (.github/workflows/tests.yml) et à la main : ./tools/run-tests.sh
set -u
cd "$(dirname "$0")/.."
TESTS="${TESTS:-v168start v169dl v169tor v169bm v169a11y v169priv v169tabs v169pdf v169scan2 v169scan3 v169fr v170work v170open v170adtab v170lecture}"
fail=0
for t in $TESTS; do
  echo "::group::$t"
  out=$(timeout 300 xvfb-run -a node "test/$t.test.js" 2>&1); code=$?
  echo "$out" | grep -E "^(OK|ÉCHEC)|Error" || true
  if [ $code -ne 0 ] || echo "$out" | grep -q "^ÉCHEC"; then echo "✗ $t"; fail=1; else echo "✓ $t"; fi
  echo "::endgroup::"
done
exit $fail
