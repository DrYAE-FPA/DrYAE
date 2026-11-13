// 1.7.0 : DrYAE déclaré à Windows comme navigateur (liens http/https, pages .html/.htm, fichiers .pdf au choix).
// Windows (depuis Windows 10) ne laisse aucune application se mettre « par défaut » toute seule : DrYAE se déclare
// (clés de registre de l'utilisateur, sans droits administrateur), puis ouvre la page des Paramètres de Windows
// où l'utilisateur choisit DrYAE. Désactiver l'option retire la déclaration.
const { app, shell } = require('electron');
const { execFile } = require('child_process');

const NAME = 'DrYAE';
const KEY = 'HKCU\\Software\\Clients\\StartMenuInternet\\DrYAE';
const CAP = KEY + '\\Capabilities';
const PROG_URL = 'DrYAEURL', PROG_HTML = 'DrYAEHTML', PROG_PDF = 'DrYAEPDF';

const reg = args => new Promise(res => execFile('reg', args, { windowsHide: true }, (err, out) => res({ ok: !err, out: String(out || '') })));
// version portable : le programme peut changer de dossier, Windows ne peut pas la retenir comme navigateur
const portable = () => !!process.env.PORTABLE_EXECUTABLE_DIR;
const supported = () => process.platform === 'win32' && app.isPackaged && !portable();
const cmd = () => `"${process.execPath}" --browse "%1"`;

async function register(pdf) {
  if (!supported()) return false;
  const exe = process.execPath, icon = `"${exe}",0`;
  const add = (k, v, d, t = 'REG_SZ') => reg(['add', k, ...(v === null ? ['/ve'] : ['/v', v]), '/t', t, '/d', d, '/f']);
  const prog = async (id, desc) => {
    const k = 'HKCU\\Software\\Classes\\' + id;
    await add(k, null, desc); await add(k + '\\DefaultIcon', null, icon);
    await add(k + '\\shell\\open\\command', null, cmd());
    if (id === PROG_URL) await add(k, 'URL Protocol', '');
  };
  await prog(PROG_URL, 'DrYAE URL'); await prog(PROG_HTML, 'DrYAE HTML'); if (pdf) await prog(PROG_PDF, 'DrYAE PDF');
  await add(KEY, null, NAME);
  await add(KEY + '\\DefaultIcon', null, icon);
  await add(KEY + '\\shell\\open\\command', null, `"${exe}"`);
  await add(CAP, 'ApplicationName', NAME);
  await add(CAP, 'ApplicationIcon', icon);
  await add(CAP, 'ApplicationDescription', 'DrYAE — navigateur et gestionnaire de téléchargements libre');
  for (const p of ['http', 'https']) await add(CAP + '\\URLAssociations', p, PROG_URL);
  for (const e of ['.html', '.htm', '.xhtml', '.svg']) await add(CAP + '\\FileAssociations', e, PROG_HTML);
  if (pdf) await add(CAP + '\\FileAssociations', '.pdf', PROG_PDF);
  else await reg(['delete', CAP + '\\FileAssociations', '/v', '.pdf', '/f']);
  await add('HKCU\\Software\\RegisteredApplications', NAME, 'Software\\Clients\\StartMenuInternet\\DrYAE\\Capabilities');
  return true;
}
async function unregister() {
  if (process.platform !== 'win32') return false;
  await reg(['delete', 'HKCU\\Software\\RegisteredApplications', '/v', NAME, '/f']);
  await reg(['delete', KEY, '/f']);
  for (const id of [PROG_URL, PROG_HTML, PROG_PDF]) await reg(['delete', 'HKCU\\Software\\Classes\\' + id, '/f']);
  return true;
}
// DrYAE est-il le navigateur choisi pour les liens https ?
async function isDefault() {
  if (process.platform !== 'win32') return false;
  const r = await reg(['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId']);
  return r.ok && /DrYAEURL/i.test(r.out);
}
// page des Paramètres de Windows où l'on choisit le navigateur (Windows 11 : directement la fiche de DrYAE)
function openWindowsSettings() {
  return shell.openExternal('ms-settings:defaultapps?registeredAppUser=' + encodeURIComponent(NAME)).catch(() => shell.openExternal('ms-settings:defaultapps'));
}
module.exports = { register, unregister, isDefault, openWindowsSettings, supported, portable };
