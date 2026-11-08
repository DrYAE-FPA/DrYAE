const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Item } = require('./base');
const { sanitize, uniquePath, nameFromHeaders, extOf, EXT_BY_MIME, sleep, catOf, catFolder } = require('../util');

const MIN_SPLIT = 512 * 1024;

class HttpDownload extends Item {
  constructor(data, ctx) {
    super({ ...data, type: 'http' }, ctx);
    this.resumable = data.resumable ?? false;
    this.connections = data.connections || ctx.settings.get().connections;
    this.segments = (data.segments || []).map(s => ({ start: s.start, end: s.end, done: s.done }));
    this.finalUrl = null;
    this.controllers = new Set();
    this.mime = data.mime || '';
    this.allowPage = !!data.allowPage;
  }

  downloaded() {
    if (this.status === 'done' && this.size > 0) return this.size;
    return this.segments.reduce((a, s) => a + s.done, 0);
  }

  toJSON() {
    return { ...super.toJSON(), allowPage: this.allowPage, resumable: this.resumable, connections: this.connections, mime: this.mime,
      segments: this.segments.map(({ start, end, done }) => ({ start, end, done })) };
  }
  view() {
    const v = super.view();
    v.activeConnections = this.segments.filter(s => s.active).length;
    return v;
  }

  async probe() {
    const ac = new AbortController();
    this.controllers.add(ac);
    try {
      const res = await this.ctx.fetch(this.url, { headers: this.ctx.buildHeaders(this, { Range: 'bytes=0-' }), signal: ac.signal });
      if (res.status === 401 || res.status === 407) throw Object.assign(new Error('Authentification requise pour ' + this.host), { code: 'auth' });
      if (!res.ok) throw Object.assign(new Error(`Le serveur a répondu ${res.status} ${res.statusText || ''}`.trim()), { code: 'http' + res.status });
      let size = -1;
      const cr = res.headers.get('content-range');
      if (res.status === 206 && cr && /\/(\d+)/.test(cr)) size = parseInt(cr.match(/\/(\d+)/)[1], 10);
      else if (res.headers.get('content-length')) size = parseInt(res.headers.get('content-length'), 10);
      const ctype = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      this.mime = ctype;
      if (res.url && res.url !== this.url) this.finalUrl = res.url;
      // lecture des premiers octets : page web ou playlist m3u8 déguisée ?
      let head = '';
      try {
        const reader = res.body.getReader();
        const r = await Promise.race([reader.read(), new Promise(z => setTimeout(() => z({}), 8000))]);
        if (r && r.value) head = Buffer.from(r.value.buffer, r.value.byteOffset, Math.min(r.value.byteLength, 1024)).toString('latin1');
      } catch {}
      const isHtml = /^\s*(<!--[\s\S]*?-->\s*)?<(!doctype\s+html|html|head|body)[\s>]/i.test(head);
      const isM3u8 = /^\s*#EXTM3U/.test(head) || ctype.includes('mpegurl');
      return { size, resumable: res.status === 206 && size > 0, ctype, isHtml, isM3u8, name: nameFromHeaders(res.url || this.url, res.headers) };
    } finally {
      ac.abort();
      this.controllers.delete(ac);
    }
  }

  planSegments() {
    if (!this.resumable || this.size <= 0) { this.segments = [{ start: 0, end: this.size > 0 ? this.size - 1 : -1, done: 0 }]; return; }
    const n = Math.max(1, Math.min(this.connections, Math.ceil(this.size / MIN_SPLIT)));
    const part = Math.floor(this.size / n);
    this.segments = [];
    for (let i = 0; i < n; i++) {
      const start = i * part, end = i === n - 1 ? this.size - 1 : start + part - 1;
      this.segments.push({ start, end, done: 0 });
    }
  }

  async start() {
    if (this.status === 'running') return;
    this.status = 'running'; this.error = null; this.errorCode = null;
    this.changed();
    const S = this.ctx.settings.get();
    try {
      const info = await this.probe();
      if (this.status !== 'running') return;
      if (info.isM3u8 && !this.file) throw Object.assign(new Error('Flux vidéo m3u8 détecté'), { code: 'ishls' });
      if (S.autoOpenWebpage && !this.file && !this.allowPage && !/^(html?|php|aspx?)$/.test(extOf(info.name))) {
        if (info.isHtml || (info.ctype === 'text/html' && info.size < 2 * 1024 * 1024)) throw Object.assign(new Error('Le lien mène à une page web, pas à un fichier. Ouvre-la dans le navigateur DrYAE pour trouver la vidéo ou le vrai lien.'), { code: 'webpage' });
      }
      if (!this.file) {
        let name = this.name ? sanitize(this.name) : info.name;
        if (!extOf(name) && EXT_BY_MIME[info.ctype]) name += '.' + EXT_BY_MIME[info.ctype];
        let dir = this.dir || S.dir;
        if (this.autoDir && S.categorize) dir = path.join(S.dir, catFolder(catOf(name)));
        await fsp.mkdir(dir, { recursive: true });
        this.dir = dir;
        let target = path.join(dir, name);
        if (fs.existsSync(target) && (this.onExist || S.duplicate) === 'overwrite') await fsp.rm(target, { force: true });
        else target = uniquePath(dir, name);
        this.file = target; this.name = path.basename(target);
        this.size = info.size; this.resumable = info.resumable;
        this.planSegments();
        this.ctx.save();
      } else {
        // reprise : vérifier que le fichier distant n'a pas changé
        if (this.size > 0 && info.size > 0 && info.size !== this.size) throw Object.assign(new Error(`La taille du fichier distant a changé (${info.size} au lieu de ${this.size}). Utilise « Rafraîchir le lien » ou recommence.`), { code: 'sizechanged' });
        this.resumable = info.resumable;
        if (!this.resumable) { this.size = info.size; this.planSegments(); }
      }
      const part = this.file + '.dryae';
      if (!fs.existsSync(part)) { this.segments.forEach(s => (s.done = 0)); await fsp.writeFile(part, ''); }
      const fd = await fsp.open(part, 'r+');
      if (this.size > 0) await fd.truncate(this.size).catch(() => {});
      this.resetTick();
      this.changed();
      try {
        const workers = new Set();
        const launch = seg => {
          const p = this.runSegment(seg, fd).then(() => {
            workers.delete(p);
            if (this.status === 'running' && this.resumable) { const ns = this.split(); if (ns) launch(ns); }
          });
          workers.add(p);
        };
        this.segments.forEach(launch);
        while (workers.size) await Promise.race([...workers]);
      } finally { await fd.close(); }
      if (this.status !== 'running') return;
      if (this.size > 0 && this.downloaded() < this.size) throw new Error('Téléchargement incomplet');
      await fsp.rename(part, this.file);
      if (this.size < 0) this.size = this.downloaded();
      this.segments = [{ start: 0, end: this.size - 1, done: this.size }];
      this.complete();
    } catch (e) {
      if (this.status === 'running') this.fail(errMsg(e), e.code);
    }
  }

  // découpage dynamique : la plus grosse part restante est coupée en deux
  split() {
    let best = null, bestLeft = 0;
    for (const s of this.segments) {
      if (s.end < 0) continue;
      const left = s.end - (s.start + s.done) + 1;
      if (left > bestLeft) { best = s; bestLeft = left; }
    }
    if (!best || bestLeft < MIN_SPLIT * 2) return null;
    const active = this.segments.filter(s => s.active).length;
    if (active >= this.connections) return null;
    const mid = best.start + best.done + Math.floor(bestLeft / 2);
    const ns = { start: mid, end: best.end, done: 0 };
    best.end = mid - 1;
    this.segments.push(ns);
    this.segments.sort((a, b) => a.start - b.start);
    return ns;
  }

  async runSegment(seg, fd) {
    const max = this.ctx.settings.get().maxRetries;
    let tries = 0;
    while (this.status === 'running') {
      if (seg.end >= 0 && seg.start + seg.done > seg.end) return;
      const ac = new AbortController();
      this.controllers.add(ac);
      try {
        const extra = this.resumable ? { Range: `bytes=${seg.start + seg.done}-${seg.end}` } : {};
        const res = await this.ctx.fetch(this.finalUrl || this.url, { headers: this.ctx.buildHeaders(this, extra), signal: ac.signal });
        if (this.resumable && res.status !== 206) throw new Error(`Reprise refusée par le serveur (${res.status})`);
        if (!res.ok) throw new Error(`Erreur serveur ${res.status}`);
        if (!this.resumable) seg.done = 0;
        seg.active = true;
        this.changed();
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          let buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
          if (seg.end >= 0) {
            const left = seg.end - (seg.start + seg.done) + 1;
            if (left <= 0) break;
            if (buf.length > left) buf = buf.subarray(0, left);
          }
          await fd.write(buf, 0, buf.length, seg.start + seg.done);
          seg.done += buf.length;
          const w1 = this.ctx.limiter.take(buf.length), w2 = this.limiter.take(buf.length);
          if (w1) await w1; if (w2) await w2;
          if (this.status !== 'running') break;
          if (seg.end >= 0 && seg.start + seg.done > seg.end) break;
        }
        ac.abort();
        seg.active = false;
        if (this.status !== 'running') return;
        if (seg.end < 0 || seg.start + seg.done > seg.end) return;
        throw new Error('Connexion fermée prématurément');
      } catch (e) {
        seg.active = false;
        if (this.status !== 'running') return;
        if (++tries > max) throw e;
        await sleep(Math.min(15000, 800 * tries));
      } finally { this.controllers.delete(ac); }
    }
  }

  stop() {
    for (const c of this.controllers) { try { c.abort(); } catch {} }
    this.controllers.clear();
    this.segments.forEach(s => (s.active = false));
  }

  pause() {
    if (!['running', 'queued', 'scheduled'].includes(this.status)) return;
    this.status = 'paused'; this.stop(); this.speed = 0;
    this.changed(); this.emit('finished');
  }

  async reset() {
    this.stop();
    if (this.file) await fsp.rm(this.file + '.dryae', { force: true }).catch(() => {});
    this.file = null; this.segments = []; this.size = -1; this.error = null; this.finished = null; this.md5 = null;
    if (this.autoDir) this.dir = '';
  }

  refreshUrl(url) { this.url = url; this.finalUrl = null; this.error = null; this.changed(); }

  partPath() { return this.status === 'done' ? this.file : this.file && this.file + '.dryae'; }
  async removeFiles(deleteDone) {
    if (!this.file) return;
    await fsp.rm(this.file + '.dryae', { force: true }).catch(() => {});
    if (deleteDone && this.status === 'done') await fsp.rm(this.file, { force: true }).catch(() => {});
  }
}

function errMsg(e) {
  if (e.name === 'AbortError') return 'Interrompu';
  const c = e.cause?.code || e.code;
  const map = { ENOTFOUND: 'Serveur introuvable (vérifie ta connexion internet)', ECONNREFUSED: 'Connexion refusée par le serveur', ECONNRESET: 'Connexion réinitialisée', ETIMEDOUT: 'Délai de connexion dépassé', UND_ERR_CONNECT_TIMEOUT: 'Délai de connexion dépassé', ENOSPC: 'Espace disque insuffisant', EACCES: 'Accès refusé au dossier de destination', EPERM: 'Accès refusé au dossier de destination', CERT_HAS_EXPIRED: 'Certificat du site expiré' };
  return map[c] || e.message || String(e);
}

module.exports = { HttpDownload, errMsg };
