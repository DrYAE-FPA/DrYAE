const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { EventEmitter } = require('events');
const undici = require('undici');
const { HttpDownload } = require('./engine/http');
const { HlsDownload } = require('./engine/hls');
const { TorrentDownload, TorrentHub } = require('./engine/torrent');
const { YtdlHub, YtdlDownload } = require('./engine/ytdl');
const { Limiter } = require('./limiter');
const tools = require('./tools');

const UA_DEFAULT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${(process.versions.chrome || '152').split('.')[0]}.0.0.0 Safari/537.36`;
const ACTIVE = ['running', 'merging'];

class Manager extends EventEmitter {
  constructor({ userDir, settings, decrypt }) {
    super();
    this.settings = settings;
    this.decrypt = decrypt || (x => x);
    this.storeFile = path.join(userDir, 'downloads.json');
    this.torrentDir = path.join(userDir, 'torrents');
    fs.mkdirSync(this.torrentDir, { recursive: true });
    this.limiter = new Limiter();
    this.torrents = new TorrentHub(this);
    this.ytdl = new YtdlHub(this, userDir);
    this.cookieFileFor = null; // fourni par le processus principal (cookies du navigateur)
    this.list = [];
    this.makeDispatcher();
    this.applySpeed();
    settings.on('change', (_d, patch) => {
      if (patch.proxy) this.makeDispatcher();
      if ('speedLimit' in patch || 'speedLimitOn' in patch || patch.torrent) { this.applySpeed(); }
      this.schedule();
    });
    try { JSON.parse(fs.readFileSync(this.storeFile, 'utf8')).forEach(d => this.attach(this.create(d))); } catch {}
    this._wasBusy = false;
    setInterval(() => this.loop(), 500);
    setInterval(() => this.schedulerTick(), 15000);
    setTimeout(() => this.torrents.refreshTrackerList(u => this.fetch(u)), 4000);
  }

  // --- réseau ---
  makeDispatcher() {
    const p = this.settings.get().proxy;
    const opts = { connect: { timeout: 20000 }, headersTimeout: 30000, bodyTimeout: 60000, connections: 64 };
    try {
      this.dispatcher = p.enabled && p.url ? new undici.ProxyAgent({ uri: p.url.includes('://') ? p.url : 'http://' + p.url, ...opts }) : new undici.Agent(opts);
    } catch { this.dispatcher = new undici.Agent(opts); }
  }
  fetch(url, opts = {}) { return undici.fetch(url, { redirect: 'follow', dispatcher: this.dispatcher, ...opts }); }
  buildHeaders(item, extra) {
    const S = this.settings.get();
    const h = { 'User-Agent': S.userAgent || UA_DEFAULT, Accept: '*/*', 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' };
    const ih = item.headers || {};
    for (const k in ih) if (ih[k]) h[k] = ih[k];
    if (item.pageUrl && !h.Referer) h.Referer = item.pageUrl;
    let host = '';
    try { host = new URL(item.url).hostname; } catch {}
    const cred = S.passwords.find(p => p.host && (host === p.host || host.endsWith('.' + p.host)));
    if (cred && !h.Authorization) h.Authorization = 'Basic ' + Buffer.from(`${cred.user}:${this.decrypt(cred.pass)}`).toString('base64');
    return { ...h, ...extra };
  }
  // taille d'un fichier distant sans le télécharger (-1 = inconnue)
  async probeSize(url, headers = {}) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    try {
      const r = await this.fetch(url, { headers: this.buildHeaders({ headers, url }, { Range: 'bytes=0-0' }), signal: ac.signal });
      let size = -1; const cr = r.headers.get('content-range');
      if (cr && /\/(\d+)/.test(cr)) size = +cr.match(/\/(\d+)/)[1]; else if (r.status === 200 && r.headers.get('content-length')) size = +r.headers.get('content-length');
      const type = (r.headers.get('content-type') || '').split(';')[0];
      try { await r.body?.cancel(); } catch {}
      return { url, size, type, status: r.status };
    } catch { return { url, size: -1, type: '', status: 0 }; } finally { clearTimeout(t); ac.abort(); }
  }
  async probeSizes(urls, headers) {
    const out = new Array(urls.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => { while (i < urls.length) { const k = i++; out[k] = await this.probeSize(urls[k], headers); } }));
    return out;
  }
  applySpeed() {
    const S = this.settings.get();
    this.limiter.setRate(S.speedLimitOn && S.speedLimit > 0 ? S.speedLimit * 1024 : 0);
    this.torrents.applyLimits();
  }
  ffmpeg() { return tools.ffmpegPath(); }
  runFfmpeg(a) { return tools.runFfmpeg(a); }

  countData(n) {
    const L = this.settings.get().dataLimit;
    if (!L.enabled || !L.mb) return;
    const day = new Date().toISOString().slice(0, 10);
    this._data = this._data || { day: L.day, used: L.used || 0 };
    if (this._data.day !== day) this._data = { day, used: 0 };
    this._data.used += n;
    if (this._data.used > L.mb * 1024 * 1024 && !this._dataHit) {
      this._dataHit = true;
      this.pauseAll();
      this.emit('notice', { title: 'Limite de données atteinte', body: `Les ${L.mb} Mo autorisés aujourd'hui sont consommés. Téléchargements mis en pause.` });
      this.settings.set({ dataLimit: { used: this._data.used, day } });
    }
  }

  // --- éléments ---
  create(d) {
    if (d.type === 'torrent') return new TorrentDownload(d, this);
    if (d.type === 'hls') return new HlsDownload(d, this);
    if (d.type === 'ytdl') return new YtdlDownload(d, this);
    return new HttpDownload(d, this);
  }
  attach(d) {
    d.on('update', () => { this.emit('changed', d.view()); this.save(); });
    d.on('finished', () => {
      if (d.errorCode === 'ishls' && d.type === 'http') return this.convertToHls(d);
      this.emit('itemFinished', d); this.schedule();
    });
    this.list.push(d);
  }
  add(opts) {
    const S = this.settings.get();
    this._lastAdded = Math.max(Date.now(), (this._lastAdded || 0) + 1);
    const data = { ...opts, added: this._lastAdded, dir: opts.dir || '', autoDir: !opts.dir };
    data.status = opts.schedule ? 'scheduled' : opts.startNow === false ? 'paused' : 'queued';
    if (S.scheduler.enabled && S.scheduler.addNew && !opts.startNow && !opts.schedule) data.status = 'scheduled';
    const d = this.create(data);
    if (opts.type === 'http' && opts.connections) d.connections = opts.connections;
    this.attach(d);
    this.save();
    this.emit('changed', d.view());
    this.schedule();
    return d.view();
  }
  get(id) { return this.list.find(d => d.id === id); }
  // un lien http qui s'avère être une playlist m3u8 devient un téléchargement de flux vidéo
  convertToHls(d) {
    const i = this.list.indexOf(d);
    if (i < 0) return;
    const j = d.toJSON();
    const h = this.create({ ...j, type: 'hls', status: 'queued', error: null, errorCode: null, file: null, size: -1,
      name: j.name && !/\.m3u8$/i.test(j.name) ? j.name : (j.name || '').replace(/\.m3u8$/i, '') || null });
    d.removeAllListeners();
    this.list.splice(i, 1);
    this.attach(h);
    this.list.splice(this.list.length - 1, 1); this.list.splice(i, 0, h);
    this.emit('reload'); this.save(); this.schedule();
  }
  findDup(url) { return this.list.find(d => d.url === url && d.status !== 'done'); }

  schedule() {
    const S = this.settings.get();
    const max = S.parallel || 3;
    const running = this.list.filter(d => ACTIVE.includes(d.status));
    let n = running.length;
    const perHost = {};
    running.forEach(d => (perHost[d.host] = (perHost[d.host] || 0) + 1));
    for (const d of this.list) {
      if (n >= max) break;
      if (d.status !== 'queued') continue;
      const h = d.host;
      const lim = (S.siteLimits.find(x => x.host && (h === x.host || h.endsWith('.' + x.host))) || {}).max || S.perSite || 0;
      if (h && lim && (perHost[h] || 0) >= lim) continue;
      n++; perHost[h] = (perHost[h] || 0) + 1;
      d.start();
    }
  }

  loop() {
    const act = this.list.filter(d => ACTIVE.includes(d.status) || d.status === 'seeding');
    act.forEach(d => d.tick());
    if (act.length) { this.emit('progress', act.map(d => d.view())); this.save(); }
    const busy = this.list.some(d => ACTIVE.includes(d.status) || d.status === 'queued');
    if (this._wasBusy && !busy) this.emit('allDone', this.list.some(d => d.status === 'error'));
    this._wasBusy = busy;
  }

  schedulerTick() {
    const C = this.settings.get().scheduler;
    if (!C.enabled) return;
    const now = new Date();
    const hm = now.toTimeString().slice(0, 5);
    const day = now.toISOString().slice(0, 10);
    if (!C.days.includes(now.getDay())) return;
    const inWindow = C.stop ? (C.start <= C.stop ? hm >= C.start && hm < C.stop : hm >= C.start || hm < C.stop) : hm >= C.start;
    if (inWindow && this._schedDay !== day + C.start) {
      this._schedDay = day + C.start;
      let k = 0;
      this.list.forEach(d => { if (d.status === 'scheduled') { d.status = 'queued'; d._fromSched = true; d.changed(); k++; } });
      if (k) { this.emit('notice', { title: 'Planificateur', body: `${k} téléchargement(s) démarré(s)` }); this._schedShutdown = C.shutdown; }
      this.schedule();
    }
    if (C.stop && !inWindow && this.list.some(d => d._fromSched && ['running', 'queued'].includes(d.status))) {
      this.list.forEach(d => { if (d._fromSched && ['running', 'queued'].includes(d.status)) { d.pause(); d.status = 'scheduled'; d.changed(); } });
      this.emit('notice', { title: 'Planificateur', body: 'Plage horaire terminée : téléchargements arrêtés' });
    }
  }

  resume(id) {
    const d = this.get(id);
    if (!d) return;
    if (['paused', 'error', 'scheduled'].includes(d.status)) { d.status = 'queued'; d.error = null; d.changed(); this.schedule(); }
    else if (d.status === 'done' && d.type === 'torrent') d.start(); // repartager
  }
  pause(id) { this.get(id)?.pause(); }
  pauseAll() { this.list.forEach(d => d.pause()); }
  resumeAll() { this._dataHit = false; this.list.forEach(d => { if (['paused', 'error'].includes(d.status)) { d.status = 'queued'; d.error = null; d.changed(); } }); this.schedule(); }
  setScheduled(ids, on) {
    ids.forEach(id => { const d = this.get(id); if (!d) return; if (on && ['paused', 'queued', 'error'].includes(d.status)) { d.pause(); d.status = 'scheduled'; d.changed(); } else if (!on && d.status === 'scheduled') { d.status = 'paused'; d.changed(); } });
  }
  async remove(ids, deleteFiles) {
    for (const id of [].concat(ids)) {
      const d = this.get(id);
      if (!d) continue;
      d.pause?.();
      d.stop?.();
      this.list = this.list.filter(x => x !== d);
      await d.removeFiles(deleteFiles).catch(() => {});
      if (d.type === 'torrent' && d.torrentFile) fsp.rm(d.torrentFile, { force: true }).catch(() => {});
    }
    this.save(); this.emit('reload');
  }
  async restart(id) {
    const d = this.get(id);
    if (!d) return;
    d.pause?.();
    await d.reset();
    d.status = 'queued'; d.changed(); this.schedule();
  }
  refresh(id, url) {
    const d = this.get(id);
    if (!d || !d.refreshUrl) return;
    d.pause();
    d.refreshUrl(url);
    d.status = 'queued'; d.changed(); this.schedule();
  }
  rename(id, name) {
    const d = this.get(id);
    if (!d) return false;
    const { sanitize } = require('./util');
    name = sanitize(name);
    if (d.status === 'done' && d.file && d.type !== 'torrent') {
      const np = path.join(path.dirname(d.file), name);
      if (fs.existsSync(np)) throw new Error('Un fichier porte déjà ce nom');
      fs.renameSync(d.file, np); d.file = np; d.name = name;
    } else if (!d.file) d.name = name;
    else throw new Error('Le renommage est possible avant le démarrage ou une fois le fichier terminé');
    d.changed(); return true;
  }
  async move(id, dir) {
    const d = this.get(id);
    if (!d || d.status !== 'done') throw new Error('Seuls les fichiers terminés peuvent être déplacés');
    const src = d.type === 'torrent' ? d.rootPath() : d.file;
    const dst = path.join(dir, path.basename(src));
    await fsp.mkdir(dir, { recursive: true });
    try { await fsp.rename(src, dst); } catch { await fsp.cp(src, dst, { recursive: true }); await fsp.rm(src, { recursive: true, force: true }); }
    d.dir = dir; d.autoDir = false; if (d.type !== 'torrent') d.file = dst;
    d.changed();
  }
  clearFinished() { this.list = this.list.filter(d => d.status !== 'done'); this.save(); this.emit('reload'); }
  views() { return this.list.map(d => d.view()); }
  save() {
    if (this._t) return;
    this._t = setTimeout(() => { this._t = null; this._flush(); }, 3000);
  }
  _flush() {
    fsp.writeFile(this.storeFile + '.tmp', JSON.stringify(this.list.map(d => d.toJSON()))).then(() => fsp.rename(this.storeFile + '.tmp', this.storeFile)).catch(() => {});
  }
  saveSync() { try { fs.writeFileSync(this.storeFile, JSON.stringify(this.list.map(d => d.toJSON()))); } catch {} }
  shutdownAll() {
    this.list.forEach(d => { if (ACTIVE.includes(d.status) || d.status === 'seeding') { const st = d.status === 'seeding' ? 'seeding' : 'queued'; d.stop?.(); d.status = st; } });
    this.saveSync();
    try { this.torrents.client?.destroy(); } catch {}
  }
}

module.exports = { Manager, UA_DEFAULT };
