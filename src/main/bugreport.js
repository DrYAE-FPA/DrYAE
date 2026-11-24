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
    detail: T('Quand DrYAE rencontre un problème, il le garde dans « Signalements » (menu ☰), avec la date : versions, Windows et dernières erreurs, sans mots de passe ni historique. Rien n\'est envoyé tout seul : vous relisez, vous choisissez si vous joignez l\'adresse de la page et une capture, puis vous validez. Vous pourrez changer d\'avis dans Paramètres → Signalements.') + '\n\n' + T('Pour envoyer, il faut un compte GitHub (gratuit).'),
  };
  const r = await (win && !win.isDestroyed() ? dialog.showMessageBox(win, o) : dialog.showMessageBox(o)).catch(() => ({ response: 1 }));
  ctx.settings.set({ browser: { bugHelp: r.response === 0 } });
}

// une erreur notée dans le journal : elle est gardée dans Paramètres → Signalements (même hors connexion),
// avec une capture et l'adresse de la page (l'utilisateur choisit avant l'envoi s'il les joint)
function onError(where, msg) {
  if (!ctx || !on()) return;
  const m = String(msg || '');
  // pas pour les coupures d'Internet ni les pages fermées normalement : seulement les vrais problèmes de DrYAE
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|socket hang up|net::ERR_|aborted|AbortError|ERR_ABORTED/i.test(m)) return;
  if (where === 'page plantée' && !/crashed|oom|launch-failed|integrity/i.test(m)) return;
  if (where === 'processus' && !/crashed|oom|launch-failed/i.test(m)) return;
  const sig = crypto.createHash('sha1').update(String(where) + '|' + String(msg).split('\n')[0].replace(/\d+/g, '#')).digest('hex').slice(0, 12);
  if (seen.has(sig)) { ctx.reports?.add({ sig, auto: true }); return; }
  seen.add(sig);
  setTimeout(() => detected({ sig, where, title: `${where}: ${String(msg).split('\n')[0]}`.slice(0, 120) }).catch(() => {}), 800);
}
// problème détecté (erreur, téléchargement échoué) : rangé dans la boîte, petite notification au plus toutes les 10 minutes
async function detected(o) {
  if (!ctx?.reports) return null;
  const here = ctx.here ? await ctx.here().catch(() => ({})) : {};
  const x = await ctx.reports.add({ kind: 'bug', auto: true, report: LOG.report(ctx.extra ? ctx.extra() : {}), page: here.page || '', shot: here.shot || null, ...o });
  if (x && x.count === 1 && Date.now() - shownAt > 10 * 60e3) { shownAt = Date.now(); ctx.notice?.(T('DrYAE a rencontré un problème'), T('Il est gardé dans Signalements (menu ☰) : vous pourrez l\'envoyer quand vous voudrez.')); }
  return x;
}

// « Signaler un problème… » : nouveau signalement dans Paramètres → Signalements
async function open(title, what, text) {
  if (ctx?.reports && ctx.openReports) {
    const here = ctx.here ? await ctx.here().catch(() => ({})) : {};
    const x = await ctx.reports.add({ kind: 'bug', title: title || '', msg: what || '', report: text || LOG.report(ctx.extra ? ctx.extra() : {}), page: here.page || '', shot: here.shot || null, sig: crypto.randomBytes(6).toString('hex') });
    ctx.openReports(x.id);
    return x.id;
  }
  const rep = text || LOG.report(ctx?.extra ? ctx.extra() : {});
  try { clipboard.writeText(rep); } catch {}
  const url = issueUrl('rapport.yml', '[Erreur] ' + LOG.clean(title || 'Problème'), {
    what: what || T('(Écrivez ici ce que vous faisiez quand le problème est arrivé.)'),
    version: ctx?.version || '', windows: require('os').release(), report: rep.replace(/\r/g, ''),
  });
  shell.openExternal(url);
  return url;
}

// « Signaler cette traduction » (bulle d'un scan) : gardé dans Signalements (texte lu, traduction, langues — jamais l'image)
async function translation(o = {}) {
  const t = s => LOG.clean(String(s || '')).slice(0, 1500);
  const what = `Mauvaise traduction / Wrong translation — Traducteur de scans (${o.from || '?'} → ${o.to || '?'})\n\nTexte lu / Text read :\n${t(o.text)}\n\nTraduction de DrYAE / DrYAE's translation :\n${t(o.tr)}\n\nTraduction attendue / Expected translation :\n${t(o.want) || '…'}`;
  if (ctx?.reports) {
    const x = await ctx.reports.add({ kind: 'translation', section: 'scans', title: t(o.text).replace(/\s+/g, ' ').slice(0, 60), msg: what, report: '', sig: crypto.createHash('sha1').update('tr|' + t(o.text) + '|' + t(o.tr)).digest('hex').slice(0, 12) });
    return { kept: true, id: x.id };
  }
  const url = issueUrl('traduction.yml', `[Traduction] ${t(o.text).replace(/\s+/g, ' ').slice(0, 60)}`, { what, version: ctx?.version || '', windows: require('os').release() });
  shell.openExternal(url);
  return url;
}

function init(c) { ctx = c; LOG.onError = onError; }
module.exports = { init, ask, onError, open, translation, issueUrl, detected };
