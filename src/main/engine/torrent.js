// Torrents (magnet / .torrent) via aria2 : moteur natif en C++ (très peu gourmand en processeur et en énergie).
// DrYAE pilote un seul processus aria2c en arrière-plan (JSON-RPC sur 127.0.0.1), lancé seulement quand un torrent est actif.
// Sélection de fichiers, priorité au début (lecture pendant le téléchargement), partage avec ratio, trackers, pairs.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Item } = require('./base');
const { catFolder, sanitize } = require('../util');

let parseTorrentFn = null;
async function parseTorrent(x) {
  if (!parseTorrentFn) parseTorrentFn = (await import('parse-torrent')).default;
  return parseTorrentFn(x);
}
const isWin = process.platform === 'win32';
function aria2Path() {
  const dirs = [];
  if (process.resourcesPath) dirs.push(path.join(process.resourcesPath, 'bin'));
  dirs.push(path.join(__dirname, '..', '..', '..', 'bin', isWin ? 'win' : 'linux'));
  for (const d of dirs) { const p = path.join(d, isWin ? 'aria2c.exe' : 'aria2c'); if (fs.existsSync(p)) return p; }
  return null;
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const kb = v => (v > 0 ? String(Math.round(v * 1024)) : '0');

class TorrentHub {
  constructor(ctx) {
    this.ctx = ctx; this.proc = null; this.port = 0; this.secret = ''; this.starting = null;
    this.extraTrackers = []; this.items = new Set(); this.timer = null; this.server = null; this.serverPort = 0; this.probeCancel = new Set();
  }
  // ---- processus aria2 ----
  async ensure() {
    if (this.proc && this.proc.exitCode === null) return;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const bin = aria2Path();
      if (!bin) throw new Error('Moteur torrent (aria2) introuvable');
      const T = this.ctx.settings.get().torrent, S = this.ctx.settings.get();
      this.port = await freePort();
      this.secret = crypto.randomBytes(16).toString('hex');
      const dhtFile = path.join(this.ctx.torrentDir, 'dht.dat');
      const args = [
        '--enable-rpc=true', `--rpc-listen-port=${this.port}`, '--rpc-listen-all=false', `--rpc-secret=${this.secret}`, '--rpc-max-request-size=64M',
        `--dir=${S.dir}`, '--continue=true', '--file-allocation=none', '--max-concurrent-downloads=200',
        `--enable-dht=${T.dht !== false}`, '--enable-dht6=false', `--dht-file-path=${dhtFile}`, `--bt-enable-lpd=${!!T.lsd}`, '--enable-peer-exchange=true',
        `--bt-max-peers=${Math.max(10, Math.min(T.maxConns || 55, 200))}`, '--bt-request-peer-speed-limit=100K',
        `--max-overall-download-limit=${kb(this.downLimit())}`, `--max-overall-upload-limit=${kb(T.uploadLimit)}`,
        '--seed-time=0', '--bt-detach-seed-only=true', '--follow-torrent=true', '--bt-save-metadata=true', '--bt-load-saved-metadata=true',
        '--disk-cache=32M', '--auto-save-interval=30', '--summary-interval=0', '--console-log-level=error', '--quiet=true',
        '--check-certificate=true', `--stop-with-process=${process.pid}`,
      ];
      if (T.port) args.push(`--listen-port=${T.port}`, `--dht-listen-port=${T.port}`);
      const p = spawn(bin, args, { windowsHide: true, stdio: 'ignore' });
      this.proc = p;
      p.on('exit', () => { if (this.proc === p) this.proc = null; });
      for (let i = 0; i < 80; i++) { // attendre que le serveur RPC réponde
        try { await this.call('getVersion'); return; } catch { await new Promise(r => setTimeout(r, 100)); }
        if (p.exitCode !== null) throw new Error('Le moteur torrent ne démarre pas');
      }
      throw new Error('Le moteur torrent ne répond pas');
    })();
    try { await this.starting; } finally { this.starting = null; }
  }
  call(method, ...params) {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: method.includes('.') ? method : 'aria2.' + method, params: method.startsWith('system.') ? params : ['token:' + this.secret, ...params] });
    return new Promise((resolve, reject) => {
      const rq = http.request({ host: '127.0.0.1', port: this.port, path: '/jsonrpc', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 15000 }, res => {
        const ch = []; res.on('data', c => ch.push(c));
        res.on('end', () => { try { const j = JSON.parse(Buffer.concat(ch).toString('utf8')); j.error ? reject(new Error(j.error.message)) : resolve(j.result); } catch (e) { reject(e); } });
      });
      rq.on('error', reject); rq.on('timeout', () => rq.destroy(new Error('timeout')));
      rq.end(body);
    });
  }
  multicall(calls) { return this.call('system.multicall', calls.map(([m, ...p]) => ({ methodName: 'aria2.' + m, params: ['token:' + this.secret, ...p] }))); }
  downLimit() {
    const T = this.ctx.settings.get().torrent, S = this.ctx.settings.get();
    let d = T.downloadLimit > 0 ? T.downloadLimit : 0;
    if (S.speedLimitOn && S.speedLimit > 0) d = d > 0 ? Math.min(d, S.speedLimit) : S.speedLimit;
    return d;
  }
  applyLimits() {
    if (!this.proc) return;
    const T = this.ctx.settings.get().torrent;
    this.call('changeGlobalOption', { 'max-overall-download-limit': kb(this.downLimit()), 'max-overall-upload-limit': kb(T.uploadLimit) }).catch(() => {});
  }
  trackers() {
    const T = this.ctx.settings.get().torrent;
    if (!T.useDefaultTrackers) return [];
    const own = String(T.trackers || '').split(/\s+/).filter(x => /^(udp|https?):\/\//.test(x));
    return [...new Set([...own, ...this.extraTrackers])];
  }
  async refreshTrackerList(fetchFn) {
    const T = this.ctx.settings.get().torrent;
    if (!T.trackersUrl) return;
    try { const r = await fetchFn(T.trackersUrl); if (r.ok) this.extraTrackers = (await r.text()).split(/\s+/).filter(x => /^(udp|https?):\/\//.test(x)).slice(0, 80); } catch {}
  }
  // ---- suivi des téléchargements actifs (une seule requête groupée par seconde, seulement s'il y en a) ----
  register(item) { this.items.add(item); if (!this.timer) this.timer = setInterval(() => this.poll(), 1000); }
  unregister(item) { this.items.delete(item); if (!this.items.size) { clearInterval(this.timer); this.timer = null; this.idleStop(); } }
  idleStop() { // plus rien à faire : on ferme aria2 pour ne rien consommer
    clearTimeout(this._idle);
    this._idle = setTimeout(() => { if (!this.items.size && this.proc) this.shutdown(); }, 20000);
  }
  async poll() {
    const list = [...this.items].filter(i => i.gid);
    if (!list.length || !this.proc || this._polling) return;
    this._polling = true;
    try {
      const keys = ['gid', 'status', 'totalLength', 'completedLength', 'uploadLength', 'downloadSpeed', 'uploadSpeed', 'connections', 'numSeeders', 'files', 'followedBy', 'infoHash', 'bittorrent', 'errorMessage', 'errorCode', 'seeder', 'numPieces', 'pieceLength', 'dir'];
      const res = await this.multicall(list.map(i => ['tellStatus', i.gid, i._wantBits ? [...keys, 'bitfield'] : keys]));
      res.forEach((r, k) => { const it = list[k]; if (Array.isArray(r)) it.onStatus(r[0]); else if (r && r.faultCode) it.onLost(r.faultString); });
      for (const it of list) if (it._wantPeers && it.gid) { it._wantPeers = false; this.call('getPeers', it.gid).then(p => { it._peers = p; }).catch(() => {}); }
    } catch {} finally { this._polling = false; }
  }
  shutdown() {
    const p = this.proc; if (!p) return;
    this.call('forceShutdown').catch(() => {});
    setTimeout(() => { try { p.kill(); } catch {} }, 3000);
    this.proc = null;
  }
  get client() { return { destroy: () => this.shutdown() }; }

  // ---- lecture pendant le téléchargement : petit serveur local qui sert la partie déjà reçue ----
  async ensureServer() {
    if (this.server) return this.serverPort;
    this.server = http.createServer((q, r) => this.serve(q, r).catch(() => { try { r.destroy(); } catch {} }));
    await new Promise(res => this.server.listen(0, '127.0.0.1', res));
    this.serverPort = this.server.address().port;
    return this.serverPort;
  }
  async serve(q, r) {
    const m = q.url.match(/^\/t\/([^/]+)\/(\d+)/);
    const it = m && this.ctx.get(decodeURIComponent(m[1]));
    if (!it) { r.statusCode = 404; return r.end(); }
    const idx = +m[2], f = it.files[idx];
    const file = path.join(it.dir, f.path);
    const size = f.length;
    let start = 0, end = size - 1;
    const rg = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
    if (rg) { if (rg[1]) start = +rg[1]; if (rg[2]) end = Math.min(+rg[2], size - 1); }
    const ext = path.extname(f.path).toLowerCase();
    const type = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.wav': 'audio/wav' }[ext] || 'application/octet-stream';
    r.writeHead(rg ? 206 : 200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(rg ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    it._wantBits = true;
    let pos = start, closed = false;
    q.on('close', () => { closed = true; });
    const fh = await fsp.open(file, 'r').catch(() => null);
    try {
      while (pos <= end && !closed) {
        const avail = it.availableIn(idx); // octets contigus disponibles depuis le début du fichier
        if (avail <= pos) { if (it.status !== 'running' && it.status !== 'seeding' && it.status !== 'done') break; await new Promise(res => setTimeout(res, 500)); continue; }
        const n = Math.min(end + 1, avail) - pos, len = Math.min(n, 1 << 20);
        const buf = Buffer.alloc(len);
        const h = fh || await fsp.open(file, 'r');
        const { bytesRead } = await h.read(buf, 0, len, pos);
        if (!fh) await h.close();
        if (!bytesRead) { await new Promise(res => setTimeout(res, 300)); continue; }
        if (!r.write(buf.subarray(0, bytesRead))) await new Promise(res => r.once('drain', res));
        pos += bytesRead;
      }
    } finally { if (fh) await fh.close().catch(() => {}); r.end(); }
  }

  // ---- lire les fichiers d'un magnet / .torrent sans démarrer le téléchargement ----
  async inspect(src, torrentDir) {
    let buf = null;
    if (Buffer.isBuffer(src)) buf = src;
    else if (/^https?:\/\//i.test(src)) {
      const r = await this.ctx.fetch(src, { headers: this.ctx.buildHeaders({ headers: {}, url: src }, {}) });
      if (!r.ok) throw new Error(`Fichier torrent inaccessible (${r.status})`);
      buf = Buffer.from(await r.arrayBuffer());
    } else if (!/^magnet:/i.test(src) && fs.existsSync(src)) buf = await fsp.readFile(src);
    const dupOf = h => this.ctx.list.find(d => d.type === 'torrent' && d.infoHash && d.infoHash.toLowerCase() === String(h).toLowerCase());
    // déjà dans la liste : on le signale et on propose d'ajouter ses trackers au téléchargement existant
    const dupInfo = (p, d) => ({ duplicate: { id: d.id, name: d.name || p.name || p.infoHash, trackers: (p.announce || []).filter(x => /^(udp|https?):\/\//.test(x)), newTrackers: (p.announce || []).filter(x => /^(udp|https?):\/\//.test(x) && !(d.trackersExtra || []).includes(x) && !this.trackers().includes(x)).length } });
    if (buf) {
      const p = await parseTorrent(buf);
      if (!p.infoHash) throw new Error('Fichier torrent invalide');
      const dd = dupOf(p.infoHash); if (dd) return dupInfo(p, dd);
      const file = path.join(torrentDir, p.infoHash + '.torrent');
      await fsp.writeFile(file, buf);
      return { infoHash: p.infoHash, name: p.name, size: p.length, files: p.files.map((f, i) => ({ i, path: f.path, length: f.length })), torrentFile: file, magnet: null };
    }
    const p = await parseTorrent(src).catch(() => null);
    if (!p || !p.infoHash) throw new Error('Lien magnet invalide');
    { const dd = dupOf(p.infoHash); if (dd) return dupInfo(p, dd); }
    const file = path.join(torrentDir, p.infoHash + '.torrent');
    if (!fs.existsSync(file)) {
      try { await this.ensure(); } catch (e) { throw Object.assign(new Error(e.message + ' — ' + "l'antivirus ou le pare-feu de Windows l'a peut-être bloqué."), { code: 'engine' }); }
      const metaDir = path.join(torrentDir, '_meta');
      await fsp.mkdir(metaDir, { recursive: true });
      const opts = { dir: metaDir, 'bt-metadata-only': 'true', 'bt-save-metadata': 'true', 'follow-torrent': 'false' };
      const tr = this.trackers(); if (tr.length) opts['bt-tracker'] = tr.join(',');
      const gid = await this.call('addUri', [src], opts);
      const t0 = Date.now(), hash = p.infoHash.toLowerCase();
      let ok = false, peers = 0;
      this.probeCancel.delete(hash);
      try {
        while (Date.now() - t0 < 90000) {
          await new Promise(r => setTimeout(r, 700));
          if (this.probeCancel.has(hash)) { this.probeCancel.delete(hash); throw Object.assign(new Error('Annulé'), { code: 'cancel' }); }
          const st = await this.call('tellStatus', gid, ['status', 'errorMessage', 'connections']).catch(() => null);
          if (st) peers = Math.max(peers, +st.connections || 0);
          // compteur visible (« Recherche de pairs… 12 s ») ; aucun pair après 30 s -> le pare-feu bloque peut-être
          this.ctx.emit('torrentProbe', { hash, s: Math.round((Date.now() - t0) / 1000), peers: +st?.connections || 0, max: 90, stuck: !peers && Date.now() - t0 > 30000 });
          if (st && st.status === 'complete') { ok = true; break; }
          if (st && st.status === 'error') throw new Error(st.errorMessage || 'Lien magnet invalide');
        }
      } finally {
        await this.call('forceRemove', gid).catch(() => {});
        setTimeout(() => this.call('removeDownloadResult', gid).catch(() => {}), 1500);
        if (!this.items.size) this.idleStop();
      }
      const saved = path.join(metaDir, p.infoHash.toLowerCase() + '.torrent');
      if (!ok || !fs.existsSync(saved)) throw Object.assign(new Error(peers ? 'Impossible de récupérer les informations du magnet en 90 s' : 'Impossible de récupérer les informations du magnet (aucun pair trouvé en 90 s)'), { code: 'nopeers' });
      await fsp.rename(saved, file).catch(async () => { await fsp.copyFile(saved, file); });
    }
    const t = await parseTorrent(await fsp.readFile(file));
    return { infoHash: t.infoHash, name: t.name, size: t.length, files: t.files.map((f, i) => ({ i, path: f.path, length: f.length })), torrentFile: file, magnet: src };
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
    this.gid = null; this.st = null; this._peers = []; this._fileDone = [];
    this._baseUp = 0;
    if (this.files.length && !(this.size > 0)) this.size = this.selSize();
    if (this.status === 'seeding') this.status = 'queued', this._resumeSeed = true;
  }
  get category() { return 'torrent'; }
  get host() { return ''; }
  get hub() { return this.ctx.torrents; }
  toJSON() {
    return { ...super.toJSON(), infoHash: this.infoHash, torrentFile: this.torrentFile, selected: this.selected, files: this.files,
      sequential: this.sequential, uploaded: this.uploadedNow(), doneBytes: this.downloaded(), trackersExtra: this.trackersExtra, seedAfter: this.seedAfter, ratio: this.ratio };
  }
  selSize() {
    if (!this.files.length) return -1;
    return this.files.filter((f, i) => !this.selected || this.selected.includes(i)).reduce((a, f) => a + f.length, 0);
  }
  downloaded() {
    if (this.st && this.files.length) {
      let d = 0;
      this._fileDone.forEach((c, i) => { if (!this.selected || this.selected.includes(i)) d += c; });
      return d;
    }
    return this.status === 'done' && this.size > 0 ? this.size : this.doneBytes;
  }
  uploadedNow() { return this.uploaded + (this.st ? (+this.st.uploadLength || 0) : 0); }
  ratioNow() { return this.size > 0 ? this.uploadedNow() / this.size : 0; }
  view() {
    const v = super.view();
    const live = this.st && (this.status === 'running' || this.status === 'seeding');
    v.uploadSpeed = live ? +this.st.uploadSpeed || 0 : 0;
    v.uploaded = this.uploadedNow();
    v.numPeers = live ? +this.st.connections || 0 : 0;
    v.ratioNow = this.ratioNow();
    v.speed = live ? +this.st.downloadSpeed || 0 : 0;
    v.eta = this.status === 'running' && v.speed > 0 && this.size > 0 ? (this.size - v.downloaded) / v.speed : -1;
    v.meta = !!this.files.length;
    v.fileCount = this.files.length;
    return v;
  }
  details() {
    if (this.gid) this._wantPeers = true;
    const files = this.files.map((f, i) => ({ i, path: f.path, length: f.length, selected: !this.selected || this.selected.includes(i),
      progress: this.status === 'done' ? (!this.selected || this.selected.includes(i) ? 1 : 0) : f.length ? Math.min(1, (this._fileDone[i] || 0) / f.length) : 0 }));
    const peers = (this._peers || []).slice(0, 200).map(p => ({ addr: `${p.ip}:${p.port}`, type: 'tcp', down: +p.downloadSpeed || 0, up: +p.uploadSpeed || 0, client: peerClient(p.peerId) }));
    const trackers = [...new Set([...(this.st?.bittorrent?.announceList || []).flat(), ...this.hub.trackers(), ...this.trackersExtra])];
    return { files, peers, trackers, infoHash: this.infoHash, magnet: this.infoHash ? `magnet:?xt=urn:btih:${this.infoHash}` + (this.name ? '&dn=' + encodeURIComponent(this.name) : '') : this.url,
      pieces: +this.st?.numPieces || 0, pieceLength: +this.st?.pieceLength || 0 };
  }
  rootPath() {
    if (!this.files.length) return this.dir;
    if (this.files.length === 1) return path.join(this.dir, this.files[0].path);
    return path.join(this.dir, this.files[0].path.split(/[\\/]/)[0]);
  }
  get fileForOpen() { return this.rootPath(); }

  options() {
    const o = { dir: this.dir, 'seed-time': '0', 'bt-save-metadata': 'true' };
    if (this.selected) o['select-file'] = this.selected.map(i => i + 1).join(',');
    const tr = [...new Set([...this.hub.trackers(), ...this.trackersExtra])];
    if (tr.length) o['bt-tracker'] = tr.join(',');
    if (this.seedAfter) { delete o['seed-time']; o['seed-ratio'] = this.ratio > 0 ? String(this.ratio) : '0.0'; }
    if (this.sequential) o['bt-prioritize-piece'] = 'head=32M,tail=2M';
    if (this.speedLimit > 0) o['max-download-limit'] = this.speedLimit + 'K';
    return o;
  }
  async start() {
    if (this.status === 'running' || this.status === 'seeding') return;
    const wasDone = this.status === 'done';
    this.status = wasDone ? 'seeding' : 'running'; this.error = null; this.changed();
    const S = this.ctx.settings.get();
    try {
      await this.hub.ensure();
      if (!this.dir || this.autoDir) { this.dir = S.categorize ? path.join(S.dir, catFolder('torrent')) : S.dir; }
      await fsp.mkdir(this.dir, { recursive: true });
      if (this.files.length) this.size = this.selSize();
      const o = this.options();
      if (wasDone || this._resumeSeed) { o['seed-ratio'] = this.ratio > 0 ? String(this.ratio) : '0.0'; delete o['seed-time']; o['check-integrity'] = 'true'; this._resumeSeed = false; }
      if (this.torrentFile && fs.existsSync(this.torrentFile)) {
        const b64 = (await fsp.readFile(this.torrentFile)).toString('base64');
        this.gid = await this.hub.call('addTorrent', b64, [], o);
      } else {
        this.gid = await this.hub.call('addUri', [this.url], o);
      }
      this._uploadBase = this.uploaded;
      this.hub.register(this);
      this.resetTick();
    } catch (e) {
      this.fail('Torrent : ' + (e.message || e));
    }
  }
  onStatus(st) {
    if (!this.gid || st.gid !== this.gid) return;
    // magnet : la première tâche ne sert qu'à récupérer les métadonnées, puis aria2 enchaîne sur le vrai téléchargement
    if (st.followedBy && st.followedBy.length) {
      this.gid = st.followedBy[0];
      this.hub.call('removeDownloadResult', st.gid).catch(() => {});
      return;
    }
    this.st = st;
    if (st.infoHash) this.infoHash = st.infoHash;
    const name = st.bittorrent?.info?.name;
    if (name && !this.name) this.name = sanitize(name);
    if (st.files && st.files.length && !(st.files.length === 1 && /^\[METADATA\]/.test(st.files[0].path))) {
      if (!this.files.length || this.files.length !== st.files.length) {
        const base = path.resolve(st.dir || this.dir);
        this.files = st.files.map(f => ({ path: path.relative(base, f.path) || path.basename(f.path), length: +f.length || 0 }));
        if (!this.torrentFile && this.infoHash) {
          const saved = path.join(this.dir, this.infoHash + '.torrent'), dest = path.join(this.ctx.torrentDir, this.infoHash + '.torrent');
          fsp.rename(saved, dest).then(() => { this.torrentFile = dest; this.ctx.save(); }).catch(() => {});
        }
        this.size = this.selSize();
        this.ctx.save(); this.changed();
      }
      this._fileDone = st.files.map(f => +f.completedLength || 0);
      if (this._wantBits && st.bitfield) this._bits = st.bitfield;
    }
    if (st.status === 'error') { const m = st.errorMessage || 'erreur ' + st.errorCode; this.detach(); return this.fail('Torrent : ' + m); }
    const doneDl = this.files.length && +st.totalLength > 0 && +st.completedLength >= +st.totalLength;
    if (this.status === 'running' && (st.seeder === 'true' || doneDl)) {
      this.finished = this.finished || Date.now();
      this.doneBytes = this.selSize();
      this.cleanUnselected();
      if (this.seedAfter && st.status === 'active') { this.status = 'seeding'; this.changed(); this.emit('finished'); this.emit('torrentDone'); }
      else { this.detach(); this.complete(); return; }
    }
    if (st.status === 'complete' && (this.status === 'running' || this.status === 'seeding')) { this.doneBytes = this.selSize(); this.detach(); this.complete(); }
  }
  // aria2 écrit parfois le bord des fichiers non choisis (morceaux partagés) : on retire ces restes incomplets
  cleanUnselected() {
    if (!this.selected) return;
    this.files.forEach((f, i) => {
      if (this.selected.includes(i) || (this._fileDone[i] || 0) >= f.length) return;
      const p = path.join(this.dir, f.path);
      fsp.rm(p, { force: true }).then(() => fsp.rmdir(path.dirname(p)).catch(() => {})).catch(() => {});
    });
  }
  onLost() { if (this.status === 'running' || this.status === 'seeding') { this.gid = null; this.st = null; this.hub.unregister(this); this.status = 'queued'; this.changed(); this.emit('finished'); } }
  // octets disponibles d'un trait depuis le début du fichier n° idx (pour la lecture pendant le téléchargement)
  availableIn(idx) {
    const f = this.files[idx]; if (!f) return 0;
    if (this.status === 'done' || (this._fileDone[idx] || 0) >= f.length) return f.length;
    const bits = this._bits, pl = +this.st?.pieceLength || 0;
    if (!bits || !pl) return 0;
    let off = 0; for (let i = 0; i < idx; i++) off += this.files[i].length;
    const first = Math.floor(off / pl);
    let p = first;
    const np = +this.st?.numPieces || bits.length * 4;
    const has = n => (parseInt(bits[n >> 2], 16) >> (3 - (n & 3))) & 1;
    while (p < np && has(p)) p++;
    return Math.max(0, Math.min(f.length, p * pl - off));
  }
  tick() { super.tick(); }
  detach() {
    if (!this.gid) { this.hub.unregister(this); return; }
    const gid = this.gid;
    this.uploaded = this.uploadedNow();
    this.doneBytes = this.downloaded();
    this.gid = null; this.st = null; this._bits = null;
    this.hub.call('forceRemove', gid).catch(() => {}).finally(() => setTimeout(() => this.hub.call('removeDownloadResult', gid).catch(() => {}), 1500));
    this.hub.unregister(this);
  }
  stop() { this.detach(); }
  pause() {
    if (this.status === 'seeding') { this.detach(); this.complete(); return; }
    if (!['running', 'queued', 'scheduled'].includes(this.status)) return;
    this.detach(); this.status = 'paused'; this.speed = 0; this.changed(); this.emit('finished');
  }
  async restartIfRunning() {
    if (this.status !== 'running') return;
    this.detach(); this.status = 'queued'; await this.start();
  }
  async setSelection(sel) {
    this.selected = sel && sel.length === this.files.length ? null : sel;
    this.size = this.selSize();
    if (this.status === 'done' && this.size > this.doneBytes) this.status = 'queued';
    await this.restartIfRunning();
    this.changed();
  }
  async setSequential(v) { this.sequential = !!v; await this.restartIfRunning(); this.changed(); }
  addTrackers(list) {
    this.trackersExtra = [...new Set([...this.trackersExtra, ...list.filter(x => /^(udp|https?):\/\//.test(x))])];
    if (this.gid) this.hub.call('changeOption', this.gid, { 'bt-tracker': [...new Set([...this.hub.trackers(), ...this.trackersExtra])].join(',') }).catch(() => {});
    this.changed();
  }
  setSpeedLimit(k) { super.setSpeedLimit(k); if (this.gid) this.hub.call('changeOption', this.gid, { 'max-download-limit': (this.speedLimit > 0 ? this.speedLimit : 0) + 'K' }).catch(() => {}); }
  async streamUrl(index) {
    if (!this.gid) await this.start();
    for (let i = 0; i < 180 && !this.files.length; i++) await new Promise(r => setTimeout(r, 500));
    if (!this.files.length) throw new Error('Métadonnées introuvables');
    const idx = index ?? this.biggestMedia();
    if (!this.sequential) await this.setSequential(true);
    this._wantBits = true;
    const port = await this.hub.ensureServer();
    return { url: `http://127.0.0.1:${port}/t/${encodeURIComponent(this.id)}/${idx}/${encodeURIComponent(path.basename(this.files[idx].path))}`, name: path.basename(this.files[idx].path) };
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
    if ((deleteData || force) && this.files.length) {
      await fsp.rm(this.rootPath(), { recursive: true, force: true }).catch(() => {});
      await fsp.rm(this.rootPath() + '.aria2', { force: true }).catch(() => {});
    }
  }
}
function peerClient(id) {
  try { const s = decodeURIComponent(id || ''); const m = /^-([A-Za-z]{2})(\d{4})-/.exec(s); if (!m) return ''; const n = { qB: 'qBittorrent', TR: 'Transmission', UT: 'µTorrent', DE: 'Deluge', LT: 'libtorrent', A2: 'aria2', BC: 'BitComet', WW: 'WebTorrent', lt: 'libtorrent' }[m[1]] || m[1]; return `${n} ${m[2].split('').join('.')}`; } catch { return ''; }
}

module.exports = { TorrentHub, TorrentDownload };
