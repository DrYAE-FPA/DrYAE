// Classement des erreurs de téléchargement : un « genre » (kind) qui décide du message clair affiché
// à l'utilisateur (traduit dans sa langue par l'interface) et des boutons pour réparer.
// Le texte d'origine (technique) reste visible dans « Détails ».
const NET = /^(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ENETDOWN|EPIPE|UND_ERR_[A-Z_]+|ERR_INTERNET_DISCONNECTED)$/;
const TEXT = {
  net: "Internet est coupé ou le site ne répond pas. DrYAE reprendra tout seul quand la connexion reviendra.",
  disk: "Il n'y a plus assez de place sur le disque.",
  perm: "DrYAE n'a pas le droit d'enregistrer dans ce dossier.",
  nodir: "Le dossier d'enregistrement n'est plus disponible (clé USB ou disque retiré ?).",
  gone: "Le fichier n'existe plus sur le site : le lien a peut-être expiré.",
  denied: 'Le site refuse le téléchargement : le lien a peut-être expiré ou demande une connexion.',
  server: 'Le site a un problème passager. DrYAE réessaiera tout seul.',
  engine: "Le moteur des torrents ne démarre pas : l'antivirus ou le pare-feu de Windows l'a peut-être bloqué.",
  nopeers: "Personne ne partage ce torrent pour le moment, ou le pare-feu bloque les connexions.",
  auth: 'Ce site demande un identifiant et un mot de passe.',
  webpage: "Ce lien mène à une page web, pas à un fichier. Ouvre-la dans le navigateur DrYAE pour trouver le vrai lien.",
  sizechanged: 'Le fichier a changé sur le site depuis le début du téléchargement.',
  drm: 'Cette vidéo est protégée : la télécharger est impossible.',
  tool: 'Un outil de DrYAE est introuvable : réinstalle DrYAE.',
  other: '',
};

function classify(msg, code) {
  const m = String(msg || ''), c = String(code || '');
  if (!m && !c) return '';
  if (['auth', 'webpage', 'sizechanged', 'drm', 'ishls'].includes(c)) return c;
  if (c === 'ENOSPC' || /ENOSPC|espace disque|place sur le disque|not enough space/i.test(m)) return 'disk';
  if (c === 'EACCES' || c === 'EPERM' || c === 'EROFS' || /Accès refusé au dossier|EACCES|EPERM/i.test(m)) return 'perm';
  if (c === 'ENOENT' || c === 'ENOTDIR' || c === 'nodir' || /ENOENT|ENOTDIR|no such file or directory|not a directory/i.test(m)) return 'nodir';
  if (NET.test(c) || /ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|UND_ERR|Serveur introuvable|Connexion réinitialisée|Délai de connexion|Connexion fermée prématurément|fetch failed|socket hang up|network/i.test(m)) return 'net';
  const st = +(/^http(\d{3})$/.exec(c) || /(?:répondu|serveur|erreur|inaccessible \(|refusée par le serveur \()\s*(\d{3})/i.exec(m) || [])[1] || 0;
  if (st === 404 || st === 410) return 'gone';
  if (st === 401 || st === 407) return 'auth';
  if (st === 403 || st === 451) return 'denied';
  if (st >= 500 || st === 429 || st === 408) return 'server';
  if (/moteur torrent|aria2/i.test(m)) return 'engine';
  if (/aucun pair|no peer/i.test(m)) return 'nopeers';
  if (/yt-dlp est introuvable|ffmpeg.*introuvable/i.test(m)) return 'tool';
  if (/Torrent : .*(network|timeout|connect)/i.test(m)) return 'net';
  return 'other';
}
// erreurs que DrYAE réessaie tout seul (avec une attente qui grandit)
const AUTO = new Set(['net', 'server']);

module.exports = { classify, TEXT, AUTO };
