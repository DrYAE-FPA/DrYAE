// 1.7.2 : aider à améliorer DrYAE, avec l'accord de l'utilisateur.
// DrYAE n'a pas de serveur : rien ne part tout seul. Quand l'utilisateur a accepté et qu'une erreur arrive,
// DrYAE prépare un signalement GitHub déjà rempli (versions, Windows, dernières erreurs du journal, sans mots de passe,
// sans historique, sans adresse de page) ; l'utilisateur le relit dans son navigateur et clique lui-même sur « Envoyer ».
// Une mauvaise traduction de scan peut aussi être signalée depuis la bulle (texte lu et traduction seulement, pas l'image).
const { dialog, shell, clipboard } = require('electron');
const crypto = require('crypto');
const LOG = require('./log');

const REPO = 'https://github.com/DrYAE-FPA/DrYAE';
const MAX_URL = 7000; // au-delà, GitHub refuse l'adresse : le journal est raccourci
let ctx = null, asked = false, shownAt = 0;
const seen = new Set();

function issueUrl(template, title, fields) {
  const base = `${REPO}/issues/new?template=${template}&title=${encodeURIComponent(title)}`;
  let url = base;
  for (const [k, v] of Object.entries(fields)) url += `&${k}=${encodeURIComponent(String(v || ''))}`;
  if (url.length <= MAX_URL) return url;
  // trop long : le rapport perd ses plus anciennes lignes
  const rep = String(fields.report || ''), lines = rep.split(/\r?\n/);
  while (lines.length > 8) {
    lines.splice(8, 1);
    url = base; for (const [k, v] of Object.entries({ ...fields, report: lines.join('\n') })) url += `&${k}=${encodeURIComponent(String(v || ''))}`;
    if (url.length <= MAX_URL) return url;
  }
  return base;
}

const T = s => (ctx?.T ? ctx.T(s) : s);
const on = () => ctx?.settings.get().browser?.bugHelp === true;

// à l'installation ou à la première ouverture de la 1.7.2 : une seule question, la réponse est gardée
async function ask(win) {
  if (!ctx || asked || process.env.DRYAE_NO_BUGASK) return;
  const v = ctx.settings.get().browser?.bugHelp;
  if (v === true || v === false) return;
  asked = true;
  const o = {
    type: 'question', buttons: [T('Oui, aider'), T('Non merci')], defaultId: 0, cancelId: 1, noLink: true,
    title: T('Aider à améliorer DrYAE ?'),
    message: T('Aider à améliorer DrYAE ?'),
    detail: T('Quand DrYAE rencontre un problème, il peut préparer un signalement pour ses créateurs : versions, Windows et dernières erreurs, sans mots de passe, sans historique, sans adresses de pages. Rien n\'est envoyé tout seul : le signalement s\'ouvre sur GitHub, vous le relisez et c\'est vous qui cliquez sur « Envoyer ». Vous pourrez changer d\'avis dans Paramètres → Système.') + '\n\n' + T('Pour envoyer, il faut un compte GitHub (gratuit).'),
  };
  const r = await (win && !win.isDestroyed() ? dialog.showMessageBox(win, o) : dialog.showMessageBox(o)).catch(() => ({ response: 1 }));
  ctx.settings.set({ browser: { bugHelp: r.response === 0 } });
}

// une erreur notée dans le journal : proposer un signalement (une fois par erreur, au plus une fois toutes les 10 minutes)
function onError(where, msg) {
  if (!ctx || !on()) return;
  const m = String(msg || '');
  // pas pour les coupures d'Internet ni les pages fermées normalement : seulement les vrais problèmes de DrYAE
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|socket hang up|net::ERR_|aborted|AbortError|ERR_ABORTED/i.test(m)) return;
  if (where === 'page plantée' && !/crashed|oom|launch-failed|integrity/i.test(m)) return;
  if (where === 'processus' && !/crashed|oom|launch-failed/i.test(m)) return;
  const sig = crypto.createHash('sha1').update(String(where) + '|' + String(msg).split('\n')[0].replace(/\d+/g, '#')).digest('hex').slice(0, 12);
  const sent = ctx.settings.get().browser?.bugSeen || [];
  if (seen.has(sig) || sent.includes(sig) || Date.now() - shownAt < 10 * 60e3) return;
  seen.add(sig); shownAt = Date.now();
  setTimeout(async () => {
    const r = await dialog.showMessageBox({
      type: 'warning', buttons: [T('Préparer le signalement'), T('Plus tard'), T('Ne plus proposer')], defaultId: 0, cancelId: 1, noLink: true,
      title: 'DrYAE', message: T('DrYAE a rencontré un problème'),
      detail: T('Voulez-vous préparer un signalement ? Il s\'ouvrira sur GitHub : vous pourrez le relire, ajouter ce que vous faisiez, puis cliquer sur « Envoyer ». Rien ne part sans votre clic.') + '\n\n' + T('Pour envoyer, il faut un compte GitHub (gratuit). Le rapport est aussi copié : collez-le (Ctrl+V) si la page ne le montre pas.'),
    }).catch(() => ({ response: 1 }));
    if (r.response === 2) { ctx.settings.set({ browser: { bugHelp: false } }); return; }
    if (r.response !== 0) return;
    ctx.settings.set({ browser: { bugSeen: [...sent, sig].slice(-50) } });
    open(`${where}: ${String(msg).split('\n')[0]}`.slice(0, 120));
  }, 1500);
}

function open(title, what, text) {
  const rep = text || LOG.report(ctx?.extra ? ctx.extra() : {});
  // 1.7.2 : modèle sans liste obligatoire (avant : « Où ? » à choisir, sinon GitHub refusait l'envoi) ;
  // le rapport est aussi copié dans le presse-papiers (si la page GitHub le perd, Ctrl+V suffit)
  try { clipboard.writeText(rep); } catch {}
  const url = issueUrl('rapport.yml', '[Erreur] ' + LOG.clean(title || 'Problème'), {
    what: what || T('(Écrivez ici ce que vous faisiez quand le problème est arrivé.)'),
    version: ctx?.version || '', windows: require('os').release(), report: rep.replace(/\r/g, ''),
  });
  shell.openExternal(url);
  return url;
}

// « Signaler cette traduction » (bulle d'un scan) : texte lu, traduction, langues — jamais l'image ni l'adresse de la page
function translation(o = {}) {
  const t = s => LOG.clean(String(s || '')).slice(0, 1500);
  const url = issueUrl('traduction.yml', `[Traduction] ${t(o.text).replace(/\s+/g, ' ').slice(0, 60)}`, {
    what: `Mauvaise traduction / Wrong translation — Traducteur de scans (${o.from || '?'} → ${o.to || '?'})\n\nTexte lu / Text read :\n${t(o.text)}\n\nTraduction de DrYAE / DrYAE's translation :\n${t(o.tr)}\n\nTraduction attendue / Expected translation :\n${t(o.want) || '…'}`,
    version: ctx?.version || '', windows: require('os').release(),
  });
  shell.openExternal(url);
  return url;
}

function init(c) { ctx = c; LOG.onError = onError; }
module.exports = { init, ask, onError, open, translation, issueUrl };
