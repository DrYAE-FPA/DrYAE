// 1.7.0 (correction) : sous Windows, les dictionnaires arrivent avec des fins de ligne « \r\n ». Avant, chaque mot gardait
// un « \r » : le dictionnaire était vide pour DrYAE → corrections U/L, 6/G… sans effet, et des mots ordinaires (SOMEONE,
// AGAIN, SAME HERE) pris pour des noms et laissés en anglais. Ce test reproduit les fichiers de Windows.
const fs = require('fs'); const path = require('path'); const os = require('os');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const ROOT = path.resolve(__dirname, '..');
const T = path.join(ROOT, '.tmp-crlf'); fs.rmSync(T, { recursive: true, force: true });
fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(path.join(T, 'src', 'main'), { recursive: true }); fs.mkdirSync(path.join(T, 'assets', 'dict'), { recursive: true });
for (const f of ['scan-fix.js', 'modules.js']) fs.copyFileSync(path.join(ROOT, 'src/main', f), path.join(T, 'src/main', f));
for (const f of fs.readdirSync(path.join(ROOT, 'src/main'))) if (!fs.existsSync(path.join(T, 'src/main', f))) try { fs.symlinkSync(path.join(ROOT, 'src/main', f), path.join(T, 'src/main', f)); } catch {}
for (const f of ['en-words.txt', 'fr-words.txt']) fs.writeFileSync(path.join(T, 'assets/dict', f), fs.readFileSync(path.join(ROOT, 'assets/dict', f), 'utf8').replace(/\r?\n/g, '\r\n'));
const SF = require(path.join(T, 'src/main/scan-fix.js'));
const M = require(path.join(T, 'src/main/modules.js'));
ok('dictionnaire anglais chargé malgré les fins de ligne Windows', !SF.isName('someone') && !SF.isName('again'));
const p = M.protect('BUT IF ANY OF YOU LAY YOUR HANDS ON SOMEONE IMPORTANT TO ME AGAIN... SAME HERE.', 'en', []);
ok('mots ordinaires pas pris pour des noms (SOMEONE, AGAIN, SAME, HERE)', p.keep.length === 0, p.keep);
const fx = SF.fixWords ? SF.fixWords('BLT IF ANY OF YOU') : '';
ok('« BLT » corrigé en BUT (U lu L)', /^BUT IF/.test(fx), fx);
ok('« 6OOD » corrigé en GOOD (G lu 6)', /GOOD/.test(SF.fixWords('THAT\'S 6OOD')), SF.fixWords('THAT\'S 6OOD'));
ok('dictionnaire français chargé (UINE → UNE)', SF.fixFrench('UINE FILLE') === 'UNE FILLE', SF.fixFrench('UINE FILLE'));
for (const [x, y] of [['….OU ARE MY ENEMIES.', '….YOU ARE MY ENEMIES.'], ["THOSE TWO GIRLS... IHOPE THEY'RE OKAY.", "THOSE TWO GIRLS... I HOPE THEY'RE OKAY."], ['ILL HELP TOO!', "I'LL HELP TOO!"], ['HE IS ILL TODAY', 'HE IS ILL TODAY'], ["THEY'RE PROBABLYIN THE HANOS OF EXORCISTS", "THEY'RE PROBABLY IN THE HANDS OF EXORCISTS"], ['IFONLY ALL OWNERS', 'IF ONLY ALL OWNERS'], ['ARLMI AND MIMANE', 'ARUMI AND MIMANE']]) { const r = SF.fixWords(x); ok(`${x} → ${y}`, r === y, r); }
for (const [x, y] of [['….OU ARE MY ENEMIES.', '….YOU ARE MY ENEMIES.'], ["THOSE TWO GIRLS... IHOPE THEY'RE OKAY.", "THOSE TWO GIRLS... I HOPE THEY'RE OKAY."], ['ILL HELP TOO!', "I'LL HELP TOO!"], ['HE IS ILL TODAY', 'HE IS ILL TODAY'], ["THEY'RE PROBABLYIN THE HANOS OF EXORCISTS", "THEY'RE PROBABLY IN THE HANDS OF EXORCISTS"], ['IFONLY ALL OWNERS', 'IF ONLY ALL OWNERS'], ['ARLMI AND MIMANE', 'ARUMI AND MIMANE']]) { const r = SF.fixWords(x); ok(`${x} → ${y}`, r === y, r); }
fs.rmSync(T, { recursive: true, force: true });
