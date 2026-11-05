// Torrents (magnet / .torrent) via WebTorrent : sélection de fichiers, séquentiel, partage avec ratio, trackers, pairs, streaming
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Item } = require('./base');
const { catFolder, sanitize } = require('../util');

let WT = null, parseTorrentFn = null;
async function libs() {
  if (!WT) WT = (await import('webtorrent')).default;
  if (!parseTorrentFn) parseTorrentFn = (await import('parse-torrent')).default;
  return { WebTorrent: WT, parseTorrent: parseTorrentFn };
}

class TorrentHub {
  constructor(ctx) { this.ctx = ctx; this.client = null; this.server = null; this.serverPort = 0; this.extraTrackers = []; }
  async get() {
    if (this.client && !this.client.destroyed) return this.client;
    const { WebTorrent } = await libs();
    const T = this.ctx.settings.get().torrent;
    this.client = new WebTorrent({
      dht: T.dht, lsd: T.lsd, maxConns: T.maxConns || 55, torrentPort: T.port || 0, dhtPort: T.port || 0,
      downloadLimit: T.downloadLimit > 0 ? T.downloadLimit * 1024 : -1, uploadLimit: T.uploadLimit > 0 ? T.uploadLimit * 1024 : -1,
    });
    this.client.on('error', e => console.error('webtorrent', e.message));
    return this.client;
  }
  applyLimits() {
    if (!this.client) return;
    const T = this.ctx.settings.get().torrent;
    const S = this.ctx.settings.get();
    let down = T.downloadLimit > 0 ? T.downloadLimit * 1024 : -1;
    if (S.speedLimitOn && S.speedLimit > 0) down = down > 0 ? Math.min(down, S.speedLimit * 1024) : S.speedLimit * 1024;
    this.client.throttleDownload(down);
    this.client.throttleUpload(T.uploadLimit > 0 ? T.uploadLimit * 1024 : -1);
  }
  trackers() {
    const T = this.ctx.settings.get().torrent;
    if (!T.useDefaultTrackers) return [];
    const own = String(T.trackers || '').split(/\s+/).filter(x => /^(udp|https?|wss?):\/\//.test(x));
    return [...new Set([...own, ...this.extraTrackers])];
  }
  async refreshTrackerList(fetchFn) {
    const T = this.ctx.settings.get().torrent;
    if (!T.trackersUrl) return;
    try {
      const r = await fetchFn(T.trackersUrl);
      if (r.ok) this.extraTrackers = (await r.text()).split(/\s+/).filter(x => /^(udp|https?|wss?):\/\//.test(x)).slice(0, 80);
    } catch {}
  }
  async ensureServer() {
    const c = await this.get();
    if (this.server) return this.serverPort;
    this.server = c.createServer({ hostname: '127.0.0.1' });
    await new Promise(r => this.server.listen(0, '127.0.0.1', r));
    this.serverPort = this.server.address().port;
    return this.serverPort;
  }
  // Lit les métadonnées (fichiers) d'un magnet/fichier torrent sans démarrer le téléchargement
  async inspect(src, torrentDir) {
    const { parseTorrent } = await libs();
    let buf = null;
    if (Buffer.isBuffer(src)) buf = src;
    else if (/^https?:\/\//i.test(src)) {
      const r = await this.ctx.fetch(src, { headers: this.ctx.buildHeaders({ headers: {}, url: src }, {}) });
      if (!r.ok) throw new Error(`Fichier torrent inaccessible (${r.status})`);
      buf = Buffer.from(await r.arrayBuffer());
    } else if (!/^magnet:/i.test(src) && fs.existsSync(src)) buf = await fsp.readFile(src);
    if (buf) {
      const p = await parseTorrent(buf);
      if (!p.infoHash) throw new Error('Fichier torrent invalide');
      const file = path.join(torrentDir, p.infoHash + '.torrent');
      await fsp.writeFile(file, buf);
      return { infoHash: p.infoHash, name: p.name, size: p.length, files: p.files.map((f, i) => ({ i, path: f.path, length: f.length })), torrentFile: file, magnet: null };
    }
    // magnet : il faut récupérer les métadonnées auprès des pairs
    const p = await parseTorrent(src).catch(() => null);
    if (!p || !p.infoHash) throw new Error('Lien magnet invalide');
    const c = await this.get();
    const existing = await c.get(p.infoHash);
    if (existing) throw new Error('Ce torrent est déjà dans la liste');
    return await new Promise((resolve, reject) => {
      const tmp = path.join(torrentDir, '_meta');
      const t = c.add(src, { path: tmp, deselect: true, announce: this.trackers(), storeCacheSlots: 0 });
      const timer = setTimeout(() => { c.remove(t, { destroyStore: true }); reject(new Error('Impossible de récupérer les informations du magnet (aucun pair trouvé en 90 s)')); }, 90000);
      t.on('error', e => { clearTimeout(timer); reject(e); });
      t.on('metadata', async () => {
        clearTimeout(timer);
        const file = path.join(torrentDir, t.infoHash + '.torrent');
        try { await fsp.writeFile(file, t.torrentFile); } catch {}
        const info = { infoHash: t.infoHash, name: t.name, size: t.length, files: t.files.map((f, i) => ({ i, path: f.path, length: f.length })), torrentFile: file, magnet: src };
        c.remove(t, { destroyStore: true }, () => resolve(info));
      });
    });
  }
}

class TorrentDownload extends Item {
  constructor(data, ctx) {
    super({ ...data, type: 'torrent' }, ctx);
    this.infoHash = data.infoHash || null;
    this.torrentFile = data.torrentFile || null;
    this.selected = data.selected || null;   // indices des fichiers à télécharger (null = tous)
    this.files = data.files || [];
    this.sequential = data.sequential ?? ctx.settings.get().torrent.sequential;
    this.uploaded = data.uploaded || 0;
    this.doneBytes = data.doneBytes || 0;
    this.trackersExtra = data.trackersExtra || [];
    this.seedAfter = data.seedAfter ?? ctx.settings.get().torrent.seed;
    this.ratio = data.ratio ?? ctx.settings.get().torrent.ratio;
    this.t = null;
    this.uploadSpeed = 0; this._lastUp = 0;
    if (this.status === 'seeding') this.status = 'queued', this._resumeSeed = true;
  }
  get category() { return 'torrent'; }
  get host() { return ''; }
  toJSON() {
    return { ...super.toJSON(), infoHash: this.infoHash, torrentFile: this.torrentFile, selected: this.selected, files: this.files,
      sequential: this.sequential, uploaded: this.uploaded, doneBytes: this.downloaded(), trackersExtra: this.trackersExtra, seedAfter: this.seedAfter, ratio: this.ratio };
  }
  selSize() {
    if (!this.files.length) return -1;
    return this.files.filter((f, i) => !this.selected || this.selected.includes(i)).reduce((a, f) => a + f.length, 0);
  }
  downloaded() {
    if (this.t && this.t.files && this.t.files.length) {
      let d = 0;
      this.t.files.forEach((f, i) => { if (!this.selected || this.selected.includes(i)) d += f.downloaded; });
      return d;
    }
    return this.status === 'done' && this.size > 0 ? this.size : this.doneBytes;
  }
  view() {
    const v = super.view();
    const t = this.t;
    v.uploadSpeed = t ? t.uploadSpeed : 0;
    v.uploaded = t ? this.uploaded + (t.uploaded - (this._baseUp || 0)) : this.uploaded;
    v.numPeers = t ? t.numPeers : 0;
    v.ratioNow = this.size > 0 ? v.uploaded / this.size : 0;
    v.speed = t && (this.status === 'running' || this.status === 'seeding') ? t.downloadSpeed : 0;
    v.eta = this.status === 'running' && v.speed > 0 && this.size > 0 ? (this.size - v.downloaded) / v.speed : -1;
    v.meta = !!this.files.length;
    v.fileCount = this.files.length;
    return v;
  }
  details() {
    const t = this.t;
    const files = this.files.map((f, i) => {
      const tf = t?.files?.[i];
      return { i, path: f.path, length: f.length, selected: !this.selected || this.selected.includes(i), progress: tf ? tf.progress : (this.status === 'done' ? 1 : 0) };
    });
    const peers = t ? t.wires.slice(0, 200).map(w => ({ addr: w.remoteAddress ? `${w.remoteAddress}:${w.remotePort}` : (w.type || 'webrtc'), type: w.type, down: w.downloadSpeed(), up: w.uploadSpeed(), client: w.peerExtendedHandshake?.v ? String(w.peerExtendedHandshake.v) : '' })) : [];
    const trackers = t ? (t.announce || []) : [...this.ctx.torrents.trackers(), ...this.trackersExtra];
    return { files, peers, trackers, infoHash: this.infoHash, magnet: t?.magnetURI || this.url, pieces: t ? t.pieces.length : 0, pieceLength: t?.pieceLength || 0 };
  }
  rootPath() {
    if (!this.files.length) return this.dir;
    if (this.files.length === 1) return path.join(this.dir, this.files[0].path);
    return path.join(this.dir, this.files[0].path.split(/[\\/]/)[0]);
  }
  get fileForOpen() { return this.rootPath(); }

  async start() {
    if (this.status === 'running' || this.status === 'seeding') return;
    const wasDone = this.status === 'done';
    this.status = wasDone ? 'seeding' : 'running'; this.error = null; this.changed();
    const S = this.ctx.settings.get();
    try {
      const client = await this.ctx.torrents.get();
      this.ctx.torrents.applyLimits();
      if (!this.dir || this.autoDir) { this.dir = S.categorize ? path.join(S.dir, catFolder('torrent')) : S.dir; }
      await fsp.mkdir(this.dir, { recursive: true });
      let src = this.url;
      if (this.torrentFile && fs.existsSync(this.torrentFile)) src = await fsp.readFile(this.torrentFile);
      if (this.infoHash) { const ex = await client.get(this.infoHash); if (ex) await new Promise(r => client.remove(ex, { destroyStore: false }, r)); }
      const announce = [...new Set([...this.ctx.torrents.trackers(), ...this.trackersExtra])];
      const t = client.add(src, { path: this.dir, deselect: !!this.selected, announce, strategy: this.sequential ? 'sequential' : 'rarest' });
      this.t = t; this._baseUp = 0;
      t.on('infoHash', () => { this.infoHash = t.infoHash; });
      t.on('error', e => { if (this.t === t) this.fail('Torrent : ' + (e.message || e)); });
      t.on('warning', () => {});
      const onMeta = async () => {
        if (this.t !== t) return;
        this.infoHash = t.infoHash;
        this.name = this.name || sanitize(t.name);
        this.files = t.files.map(f => ({ path: f.path, length: f.length }));
        if (!this.torrentFile) {
          this.torrentFile = path.join(this.ctx.torrentDir, t.infoHash + '.torrent');
          fsp.writeFile(this.torrentFile, t.torrentFile).catch(() => {});
        }
        if (this.selected) {
          t.files.forEach((f, i) => (this.selected.includes(i) ? f.select() : f.deselect()));
        }
        this.size = this.selSize();
        this.ctx.save(); this.changed();
      };
      if (t.metadata) onMeta(); else t.once('metadata', onMeta);
      t.on('ready', () => { if (this.t === t) { onMeta(); this.checkDone(); } });
      t.on('done', () => this.checkDone());
      t.on('download', () => {});
      this.resetTick();
    } catch (e) {
      this.fail('Torrent : ' + (e.message || e));
    }
  }

  checkDone() {
    const t = this.t;
    if (!t || !t.files || !t.files.length) return;
    const all = t.files.every((f, i) => (this.selected && !this.selected.includes(i)) || f.progress >= 1);
    if (!all) return;
    if (this.status === 'running') {
      this.finished = Date.now();
      this.doneBytes = this.selSize();
      if (this.seedAfter && (this.ratio === 0 || this.ratioNow() < this.ratio)) { this.status = 'seeding'; this.changed(); this.emit('finished'); this.emit('torrentDone'); }
      else { this.detach(); this.complete(); }
    }
  }
  ratioNow() { const up = this.t ? this.uploaded + this.t.uploaded : this.uploaded; return this.size > 0 ? up / this.size : 0; }

  tick() {
    super.tick();
    if (this.status === 'running' && this.t && this.t.files?.length) this.checkDone();
    if (this.status === 'seeding' && this.t && this.ratio > 0 && this.ratioNow() >= this.ratio) { this.detach(); this.complete(); }
  }

  detach() {
    const t = this.t;
    if (!t) return;
    this.uploaded += t.uploaded || 0;
    this.doneBytes = this.downloaded();
    this.t = null;
    try { this.ctx.torrents.client?.remove(t, { destroyStore: false }); } catch {}
  }
  stop() { this.detach(); }
  pause() {
    if (this.status === 'seeding') { this.detach(); this.complete(); return; }
    if (!['running', 'queued', 'scheduled'].includes(this.status)) return;
    this.detach(); this.status = 'paused'; this.speed = 0; this.changed(); this.emit('finished');
  }
  async setSelection(sel) {
    this.selected = sel && sel.length === this.files.length ? null : sel;
    if (this.t && this.t.files?.length) {
      this.t.files.forEach((f, i) => (!this.selected || this.selected.includes(i) ? f.select() : f.deselect()));
    }
    this.size = this.selSize();
    if (this.status === 'done' && this.size > this.doneBytes) { this.status = 'queued'; }
    this.changed();
  }
  setSequential(v) { this.sequential = !!v; if (this.t) this.t.strategy = v ? 'sequential' : 'rarest'; this.changed(); }
  addTrackers(list) {
    this.trackersExtra = [...new Set([...this.trackersExtra, ...list.filter(x => /^(udp|https?|wss?):\/\//.test(x))])];
    if (this.t) list.forEach(u => { try { this.t.discovery?.tracker?._trackers && this.t.announce.push(u); } catch {} });
    this.changed();
  }
  async streamUrl(index) {
    if (!this.t) await this.start();
    const port = await this.ctx.torrents.ensureServer();
    const t = this.t;
    if (!t.metadata) await new Promise(r => t.once('metadata', r));
    const f = t.files[index ?? this.biggestMedia()];
    f.select(1);
    try { t.critical(f._startPiece, Math.min(f._endPiece, f._startPiece + 8)); } catch {}
    return { url: `http://127.0.0.1:${port}/webtorrent/${t.infoHash}/${encodeURI(f.path.replace(/\\/g, '/'))}`, name: f.name };
  }
  biggestMedia() {
    let best = 0, sz = -1;
    this.files.forEach((f, i) => { if (/\.(mp4|mkv|webm|avi|mov|mp3|m4a|flac|ogg|wav)$/i.test(f.path) && f.length > sz) { best = i; sz = f.length; } });
    return best;
  }
  async reset() {
    this.detach();
    await this.removeFiles(true, true);
    this.doneBytes = 0; this.uploaded = 0; this.finished = null; this.error = null;
  }
  partPath() { return this.rootPath(); }
  async removeFiles(deleteData, force) {
    this.detach();
    if ((deleteData || force) && this.files.length) await fsp.rm(this.rootPath(), { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { TorrentHub, TorrentDownload };
