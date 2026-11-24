// 1.7.2 : centre des signalements (Paramètres → Signalements).
// Les problèmes détectés (erreurs de DrYAE, téléchargements qui échouent, traductions de scans signalées) et les
// signalements écrits à la main sont gardés sur ce PC, même hors connexion. Rien ne part tout seul : l'utilisateur
// relit, choisit la section, valide, puis DrYAE ouvre la page GitHub préremplie (il clique lui-même sur « Create »).
// Chaque signalement porte un code (« R-7K2Q ») que DrYAE retrouve ensuite sur GitHub pour montrer l'état,
// les réponses et la version qui le corrige (lecture publique, sans compte).
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const LOG = require('./log');

const REPO = 'DrYAE-FPA/DrYAE';
// adresse courte : avec les cookies d'un compte GitHub connecté, une adresse trop longue fait échouer la page
// (« Whoops, something went wrong! ») ; le rapport complet est alors copié pour être collé avec Ctrl+V
const MAX = 100, KEEP_DAYS = 60, MAX_URL = 2800;
const SECTIONS = ['downloads', 'browser', 'torrents', 'scans', 'player', 'updates', 'other'];
const SECTION_FR = { downloads: 'Téléchargements', browser: 'Navigateur', torrents: 'Torrents', scans: 'Traducteur de scans', player: 'Lecteur vidéo', updates: 'Mises à jour', other: 'Autre' };
const KINDS = { bug: 'Bug', translation: 'Mauvaise traduction', idea: 'Idée' };
// phrases prêtes, par section (en français : traduites à l'affichage, et la version française est aussi envoyée)
const PHRASES = {
  downloads: ['Le téléchargement ne démarre pas.', 'Le téléchargement s\'arrête avant la fin.', 'Le téléchargement est très lent.', 'Le fichier téléchargé ne s\'ouvre pas.', 'DrYAE ne détecte pas la vidéo de la page.'],
  browser: ['La page reste blanche.', 'Le site ne s\'affiche pas correctement.', 'Je n\'arrive pas à me connecter à un site.', 'Un onglet s\'est fermé tout seul.', 'Le navigateur est lent.'],
  torrents: ['Le torrent ne démarre pas.', 'Le torrent reste bloqué à 0 %.', 'Le lien magnet ne s\'ouvre pas dans DrYAE.'],
  scans: ['La traduction ne veut rien dire.', 'Un mot est resté en anglais.', 'Le texte d\'une bulle n\'a pas été lu.', 'La traduction dépasse de la bulle.', 'La gomme laisse une tache sur le dessin.'],
  player: ['La vidéo ne se lit pas.', 'Il n\'y a pas de son.', 'Les sous-titres ne s\'affichent pas.'],
  updates: ['La mise à jour ne s\'installe pas.', 'Après la mise à jour, quelque chose ne marche plus.'],
  other: ['DrYAE s\'est fermé tout seul.', 'DrYAE est devenu très lent.', 'Un bouton ne fait rien.'],
};

const codeOf = () => 'R-' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
const idOf = () => crypto.randomBytes(6).toString('hex');
const sigOf = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const hostOf = u => { try { return new URL(u).host; } catch { return ''; } };
const vnum = v => String(v || '').split('.').map(n => +n || 0).reduce((a, n) => a * 1000 + n, 0);

// d'après l'endroit de l'erreur, la section la plus probable
function guessSection(where = '', msg = '') {
  const s = (where + ' ' + msg).toLowerCase();
  if (/scan|ocr|bulle|traduct|local-mt|comics|bd\b/.test(s)) return 'scans';
  if (/torrent|magnet|aria2|webtorrent/.test(s)) return 'torrents';
  if (/updat|mise à jour|updater/.test(s)) return 'updates';
  if (/lecteur|player|ffmpeg|vidéo locale/.test(s)) return 'player';
  if (/téléchargement|download|yt-dlp|manager|http\d{3}/.test(s)) return 'downloads';
  if (/page plantée|webview|navigateur|browser|extension|onglet/.test(s)) return 'browser';
  return 'other';
}

class Reports extends EventEmitter {
  constructor(o) {
    super();
    Object.assign(this, o); // dir, settings, T, version, open(url), online(), fetch (tests)
    Reports.last = this;
    this.file = path.join(this.dir, 'reports.json');
    this.imgDir = path.join(this.dir, 'reports');
    this.list = [];
    this.meta = {};
    try { const j = JSON.parse(fs.readFileSync(this.file, 'utf8')); this.list = Array.isArray(j.list) ? j.list : []; this.meta = j.meta || {}; } catch {}
    this.purge();
  }
  // ---------- rangement ----------
  saveSoon() { clearTimeout(this._sv); this._sv = setTimeout(() => this.saveNow(), 300); this.emit('changed'); }
  saveNow() { clearTimeout(this._sv); try { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ list: this.list, meta: this.meta })); fs.renameSync(this.file + '.tmp', this.file); } catch {} }
  purge() {
    const old = Date.now() - KEEP_DAYS * 864e5;
    const drop = x => { if (x.shot) try { fs.unlinkSync(path.join(this.imgDir, x.shot)); } catch {} };
    this.list = this.list.filter(x => { const keep = !(['draft', 'queued'].includes(x.state) && (x.last || x.at) < old); if (!keep) drop(x); return keep; });
    while (this.list.length > MAX) { // d'abord les plus anciens déjà corrigés ou envoyés
      let i = this.list.map((x, k) => [x, k]).filter(([x]) => x.state === 'fixed').pop()?.[1];
      if (i === undefined) i = this.list.map((x, k) => [x, k]).filter(([x]) => x.state !== 'draft' && x.state !== 'queued').pop()?.[1];
      if (i === undefined) i = this.list.length - 1;
      drop(this.list[i]); this.list.splice(i, 1);
    }
  }
  get(id) { return this.list.find(x => x.id === id); }
  // signalements qui attendent l'utilisateur : à envoyer, et réponses pas encore lues
  counts() {
    return {
      pending: this.list.filter(x => x.state === 'draft' && x.auto && !x.seen).length + this.list.filter(x => x.state === 'queued').length,
      waiting: this.list.filter(x => x.state === 'draft' || x.state === 'queued').length,
      answers: this.list.filter(x => x.unread).length,
    };
  }
  view() {
    const v = this.version;
    return {
      list: [...this.list].sort((a, b) => (+!!(b.state === 'draft' || b.state === 'queued' || b.unread) - +!!(a.state === 'draft' || a.state === 'queued' || a.unread)) || (b.last || b.at) - (a.last || a.at)).map(({ report, ...x }) => ({ ...x, reportLines: String(report || '').split(/\r?\n/).length, fixedHere: x.fixedIn ? vnum(v) >= vnum(x.fixedIn) : false })),
      sections: SECTIONS.map(id => ({ id, name: SECTION_FR[id] })), kinds: Object.entries(KINDS).map(([id, name]) => ({ id, name })), phrases: PHRASES,
      counts: this.counts(), checkedAt: this.meta.checkedAt || 0, online: this.online ? this.online() : true, version: v,
    };
  }

  // ---------- ajout ----------
  // o : { kind, section, title, msg, report, sig, where, auto, site, page, shot (Buffer jpeg), text (traduction) }
  async add(o = {}) {
    const sig = o.sig || sigOf((o.kind || 'bug') + '|' + (o.title || '') + '|' + (o.msg || ''));
    const ex = this.list.find(x => x.sig === sig && x.state !== 'fixed');
    if (ex && o.auto) { ex.count = (ex.count || 1) + 1; ex.last = Date.now(); if (ex.state !== 'draft' && ex.state !== 'queued') ex.again = true; ex.seen = false; this.saveSoon(); return ex; }
    const x = {
      id: idOf(), code: codeOf(), sig, kind: KINDS[o.kind] ? o.kind : 'bug', section: SECTIONS.includes(o.section) ? o.section : guessSection(o.where, o.title),
      title: String(o.title || '').slice(0, 140), msg: String(o.msg || ''), report: String(o.report || ''), where: o.where || '',
      auto: !!o.auto, count: 1, at: Date.now(), last: Date.now(), state: 'draft',
      site: o.site || hostOf(o.page), page: o.page || '', pageOn: !!o.page, shotOn: false, tr: o.tr || null,
    };
    if (o.shot) {
      try { await fsp.mkdir(this.imgDir, { recursive: true }); x.shot = x.id + '.jpg'; await fsp.writeFile(path.join(this.imgDir, x.shot), o.shot); x.shotOn = true; } catch { x.shot = ''; }
    }
    this.list.unshift(x); this.purge(); this.saveSoon();
    return x;
  }
  update(id, p = {}) {
    const x = this.get(id); if (!x) return null;
    for (const k of ['msg', 'title']) if (typeof p[k] === 'string') x[k] = p[k].slice(0, k === 'title' ? 140 : 5000);
    if (SECTIONS.includes(p.section)) x.section = p.section;
    if (KINDS[p.kind]) x.kind = p.kind;
    for (const k of ['pageOn', 'shotOn']) if (typeof p[k] === 'boolean') x[k] = p[k];
    if (Array.isArray(p.dropLines)) { const L = String(x.report).split(/\r?\n/); x.report = L.filter((_, i) => !p.dropLines.includes(i)).join('\n'); }
    if (p.seen) { x.seen = true; x.unread = false; }
    this.saveSoon(); return x;
  }
  remove(id) { const i = this.list.findIndex(x => x.id === id); if (i < 0) return false; const x = this.list[i]; if (x.shot) try { fs.unlinkSync(path.join(this.imgDir, x.shot)); } catch {} this.list.splice(i, 1); this.saveSoon(); return true; }
  clear() { for (const x of this.list) if (x.shot) try { fs.unlinkSync(path.join(this.imgDir, x.shot)); } catch {} this.list = []; this.saveSoon(); }
  seenAll() { let n = 0; for (const x of this.list) if (x.auto && !x.seen && x.state === 'draft') { x.seen = true; n++; } if (n) this.saveSoon(); }
  async shotData(id) { const x = this.get(id); if (!x?.shot) return ''; try { return 'data:image/jpeg;base64,' + (await fsp.readFile(path.join(this.imgDir, x.shot))).toString('base64'); } catch { return ''; } }
  reportOf(id) { return this.get(id)?.report || ''; }

  // ---------- envoi (page GitHub préremplie) ----------
  frMsg(x) {
    // phrase prête traduite : la version française est ajoutée pour le créateur de DrYAE
    const T = this.T || (s => s);
    const all = Object.values(PHRASES).flat();
    const fr = all.filter(p => T(p) !== p && String(x.msg).includes(T(p)));
    return fr.length ? `\n\n(FR : ${fr.join(' ')})` : '';
  }
  body(x) {
    const lines = [
      `Code : ${x.code}`, `Section : ${SECTION_FR[x.section]}`, `Type : ${KINDS[x.kind]}`, `Signature : ${x.sig}`,
      x.count > 1 ? `Arrivé ${x.count} fois (du ${new Date(x.at).toISOString().slice(0, 10)} au ${new Date(x.last).toISOString().slice(0, 10)})` : `Date : ${new Date(x.at).toISOString().slice(0, 16).replace('T', ' ')}`,
      x.site ? `Site : ${x.site}` : '', x.pageOn && x.page ? `Page : ${x.page}` : '',
    ].filter(Boolean);
    return lines.join('\n') + '\n\n' + String(x.report || '').replace(/\r/g, '');
  }
  url(x) { return this.build(x).url; }
  build(x) {
    const T = this.T || (s => s);
    const tpl = x.kind === 'translation' ? 'traduction.yml' : 'rapport.yml';
    const title = `[${x.code}] [${SECTION_FR[x.section]}] ${LOG.clean(x.title || KINDS[x.kind])}`.slice(0, 160);
    const base = `https://github.com/${REPO}/issues/new?template=${tpl}&title=${encodeURIComponent(title)}`;
    const what0 = (String(x.msg || '').trim() || '…') + this.frMsg(x);
    const full = this.body(x);
    const mk = (r, cut, w = what0) => {
      const note = cut ? '\n\n' + T('(Rapport raccourci : le rapport complet est copié, collez-le ici avec Ctrl+V)') : '';
      const what = w + (x.shotOn && x.shot ? '\n\n' + T('(Capture : collez-la ici avec Ctrl+V)') : '');
      const f = { what: tpl === 'traduction.yml' ? what + '\n\n' + r + note : what, version: this.version || '', windows: require('os').release(), ...(tpl === 'traduction.yml' ? {} : { report: r + note }) };
      let u = base; for (const [k, v] of Object.entries(f)) u += `&${k}=${encodeURIComponent(String(v || ''))}`; return u;
    };
    let u = mk(full, false);
    if (u.length <= MAX_URL) return { url: u, cut: false, full };
    // trop long : on garde le début (code, section, versions) et les dernières lignes du journal
    const L = full.split('\n'); const head = L.slice(0, 14); let tail = L.slice(14);
    while (tail.length && (u = mk(head.concat(['…'], tail).join('\n'), true)).length > MAX_URL) tail = tail.slice(Math.max(1, Math.ceil(tail.length / 6)));
    if (u.length > MAX_URL) u = mk(head.join('\n'), true);
    if (u.length > MAX_URL) u = mk(head.slice(0, 7).join('\n'), true, what0.slice(0, 1200));
    return { url: u, cut: true, full };
  }
  async send(id, opts = {}) {
    const x = this.get(id); if (!x) return { ok: false };
    if (this.online && !this.online()) { x.state = 'queued'; x.queuedAt = Date.now(); this.saveSoon(); return { ok: true, queued: true }; }
    const B = this.build(x), u = B.url;
    // presse-papiers : le rapport complet s'il a été raccourci, sinon la capture (à coller dans la page GitHub)
    try { const { clipboard, nativeImage } = require('electron'); if (!B.cut && x.shotOn && x.shot) clipboard.writeImage(nativeImage.createFromPath(path.join(this.imgDir, x.shot))); else clipboard.writeText(B.full); } catch {}
    x.cut = B.cut;
    await this.open(u, opts);
    x.state = x.issue ? x.state : 'sent'; x.sentAt = Date.now(); x.seen = true; x.notFound = false;
    this.saveSoon();
    // GitHub met un moment à créer le signalement : on regarde dans quelques minutes
    clearTimeout(this._ck); this._ck = setTimeout(() => this.check(true).catch(() => {}), 4 * 60e3); this._ck.unref?.();
    return { ok: true, url: u, cut: B.cut, shot: !!(x.shotOn && x.shot) };
  }
  copyShot(id) { const x = this.get(id); if (!x?.shot) return false; try { const { clipboard, nativeImage } = require('electron'); clipboard.writeImage(nativeImage.createFromPath(path.join(this.imgDir, x.shot))); return true; } catch { return false; } }
  async sendQueued() { const q = this.list.filter(x => x.state === 'queued'); for (const x of q) await this.send(x.id); return q.length; }

  // ---------- suivi sur GitHub (lecture publique, sans compte) ----------
  async api(p) {
    const f = this.fetch || require('electron').net.fetch;
    const r = await f(`https://api.github.com/repos/${REPO}${p}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DrYAE/' + (this.version || '') } });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    return r.json();
  }
  async issues() {
    if (this._iss && Date.now() - this._iss.t < 60e3) return this._iss.l;
    const l = await this.api('/issues?state=all&per_page=100&sort=created&direction=desc');
    this._iss = { t: Date.now(), l: l.filter(i => !i.pull_request) };
    return this._iss.l;
  }
  // une fois par jour (ou tout de suite avec « Vérifier ») : état, réponses, version qui corrige
  async check(force) {
    const mine = this.list.filter(x => x.state !== 'draft' && x.state !== 'queued');
    if (!mine.length) return { ok: true, n: 0 };
    if (!force && Date.now() - (this.meta.checkedAt || 0) < 864e5) return { ok: true, n: 0, skipped: true };
    let iss; try { iss = await this.issues(); } catch (e) { return { ok: false, error: String(e.message || e) }; }
    let changed = 0;
    for (const x of mine) {
      const i = iss.find(a => x.issue ? a.number === x.issue : String(a.title || '').includes(x.code));
      if (!i) { if (x.state === 'sent' && Date.now() - (x.sentAt || 0) > 864e5 && !x.notFound) { x.notFound = true; changed++; } continue; }
      if (!x.issue) { x.issue = i.number; x.url = i.html_url; x.author = i.user?.login || ''; x.notFound = false; changed++; }
      const lab = (i.labels || []).map(l => typeof l === 'string' ? l : l.name);
      const fixed = (lab.join(' ') + ' ' + (i.milestone?.title || '')).match(/(\d+\.\d+\.\d+)/);
      if (i.comments > (x.nComments || 0)) {
        try {
          const cs = await this.api(`/issues/${i.number}/comments?per_page=100`);
          const rep = cs.filter(c => c.user?.login !== x.author).map(c => ({ who: c.user?.login || '', at: Date.parse(c.created_at) || 0, body: String(c.body || '').slice(0, 4000) }));
          const before = (x.replies || []).length;
          x.replies = rep; x.nComments = cs.length;
          if (rep.length > before) { x.unread = true; changed++; }
          const fx = rep.map(r => r.body.match(/corrig[ée]+\s+dans\s+(?:la\s+(?:version\s+)?)?(\d+\.\d+\.\d+)/i)).filter(Boolean).pop();
          if (fx && !x.fixedIn) x.fixedIn = fx[1];
        } catch {}
      }
      if (fixed && !x.fixedIn) { x.fixedIn = fixed[1]; changed++; }
      const st = i.state === 'closed' ? (i.state_reason === 'not_planned' ? 'closed' : 'fixed') : (x.replies || []).length ? 'answered' : 'sent';
      if (st !== x.state) { x.state = st; changed++; }
    }
    this.meta.checkedAt = Date.now();
    this.saveSoon();
    return { ok: true, n: changed };
  }
  // avant l'envoi : la même erreur est-elle déjà signalée (ouverte) sur GitHub ?
  async dup(id) {
    const x = this.get(id); if (!x) return null;
    let iss; try { iss = await this.issues(); } catch { return null; }
    const i = iss.find(a => a.state === 'open' && String(a.body || '').includes('Signature : ' + x.sig) && !String(a.title || '').includes(x.code));
    return i ? { number: i.number, title: i.title, url: i.html_url } : null;
  }
  // « Ajouter mon cas » à un signalement existant / « Répondre » : la page GitHub s'ouvre, le texte est copié (Ctrl+V)
  async comment(id, number, text) {
    const x = this.get(id); if (!x) return false;
    const t = String(text || '').trim() || (String(x.msg || '').trim() + '\n\n' + this.body(x));
    try { require('electron').clipboard.writeText(t); } catch {}
    await this.open(`https://github.com/${REPO}/issues/${number || x.issue}#new_comment_field`);
    if (number && !x.issue) { x.issue = number; x.url = `https://github.com/${REPO}/issues/${number}`; x.state = 'sent'; x.sentAt = Date.now(); x.seen = true; }
    if (x.unread) x.unread = false;
    this.saveSoon(); return true;
  }
}

module.exports = { Reports, PHRASES, SECTIONS, SECTION_FR, KINDS, guessSection, sigOf };
