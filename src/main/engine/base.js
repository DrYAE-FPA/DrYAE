const { EventEmitter } = require('events');
const { uid, catOf } = require('../util');
const { Limiter } = require('../limiter');

// Statuts : queued | running | paused | scheduled | done | seeding | error | merging
class Item extends EventEmitter {
  constructor(data, ctx) {
    super();
    this.ctx = ctx;
    this.id = data.id || uid();
    this.type = data.type;
    this.url = data.url || '';
    this.dir = data.dir || '';
    this.autoDir = data.autoDir ?? !data.dir;
    this.file = data.file || null;
    this.name = data.name || null;
    this.size = data.size ?? -1;
    this.status = data.status || 'queued';
    this.error = data.error || null;
    this.errorCode = data.errorCode || null;
    this.added = data.added || Date.now();
    this.finished = data.finished || null;
    this.activeMs = data.activeMs || 0; // temps réellement passé à télécharger
    this.speedLimit = data.speedLimit || 0; // Ko/s
    this.headers = data.headers || {};
    this.pageUrl = data.pageUrl || '';
    this.md5 = data.md5 || null;
    if (this.status === 'running' || this.status === 'merging') this.status = 'queued';
    this.speed = 0;
    this.limiter = new Limiter(this.speedLimit * 1024);
    this._lastBytes = 0;
    this._lastTime = Date.now();
  }
  get category() { return catOf(this.name || this.url); }
  get host() { try { return new URL(this.url).hostname; } catch { return ''; } }
  downloaded() { return 0; }
  setSpeedLimit(kb) { this.speedLimit = Math.max(0, kb | 0); this.limiter.setRate(this.speedLimit * 1024); this.changed(); }
  tick() {
    const now = Date.now(), b = this.downloaded(), dt = (now - this._lastTime) / 1000;
    if (dt > 0) {
      if (this.status === 'running' && dt < 30) this.activeMs += dt * 1000;
      const inst = Math.max(0, (b - this._lastBytes) / dt);
      this.speed = this.speed ? this.speed * 0.6 + inst * 0.4 : inst;
      this.ctx.countData?.(Math.max(0, b - this._lastBytes));
    }
    this._lastBytes = b; this._lastTime = now;
  }
  resetTick() { this._lastBytes = this.downloaded(); this._lastTime = Date.now(); this.speed = 0; }
  changed() { this.emit('update'); }
  fail(msg, code) {
    this.status = 'error'; this.error = msg; this.errorCode = code || null; this.speed = 0;
    this.stop?.();
    this.changed(); this.emit('finished');
  }
  complete() {
    this.status = 'done'; this.finished = Date.now(); this.speed = 0; this.error = null;
    this.changed(); this.emit('finished');
  }
  toJSON() {
    const { id, type, url, dir, autoDir, file, name, size, status, error, errorCode, added, finished, speedLimit, headers, pageUrl, md5, activeMs } = this;
    return { id, type, url, dir, autoDir, file, name, size, status, error, errorCode, added, finished, speedLimit, headers, pageUrl, md5, activeMs: Math.round(activeMs) };
  }
  view() {
    const d = this.downloaded();
    const run = this.status === 'running';
    return {
      ...this.toJSON(), category: this.category, downloaded: d, speed: run ? this.speed : 0,
      eta: run && this.speed > 0 && this.size > 0 ? (this.size - d) / this.speed : -1,
    };
  }
}
module.exports = { Item };
