// Téléchargement de flux HLS (.m3u8) : variantes, piste audio séparée, AES-128, fMP4, conversion en MP4 via ffmpeg
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { Item } = require('./base');
const { errMsg } = require('./http');
const { sanitize, uniquePath, nameFromUrl, sleep, catFolder } = require('../util');

function attrs(line) {
  const out = {};
  const re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let m;
  while ((m = re.exec(line))) out[m[1]] = m[2].replace(/^"|"$/g, '');
  return out;
}

function parseMaster(text, base) {
  const lines = text.split(/\r?\n/);
  const variants = [], audios = [], subs = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('#EXT-X-STREAM-INF:')) {
      const a = attrs(l.slice(18));
      let j = i + 1; while (j < lines.length && (!lines[j].trim() || lines[j].startsWith('#'))) j++;
      if (lines[j]) variants.push({ url: new URL(lines[j].trim(), base).href, bandwidth: +a.BANDWIDTH || 0, resolution: a.RESOLUTION || '', audio: a.AUDIO || '', codecs: a.CODECS || '' });
    } else if (l.startsWith('#EXT-X-MEDIA:')) {
      const a = attrs(l.slice(13));
      if (a.URI) (a.TYPE === 'AUDIO' ? audios : a.TYPE === 'SUBTITLES' ? subs : []).push({ url: new URL(a.URI, base).href, group: a['GROUP-ID'], name: a.NAME, lang: a.LANGUAGE, def: a.DEFAULT === 'YES' });
    }
  }
  variants.sort((a, b) => b.bandwidth - a.bandwidth);
  return { variants, audios, subs };
}

function parseMedia(text, base) {
  const lines = text.split(/\r?\n/);
  const segs = [];
  let key = null, map = null, seq = 0, dur = 0, total = 0;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith('#EXT-X-MEDIA-SEQUENCE:')) seq = parseInt(l.split(':')[1], 10) || 0;
    else if (l.startsWith('#EXT-X-KEY:')) {
      const a = attrs(l.slice(11));
      key = a.METHOD === 'NONE' ? null : { method: a.METHOD, uri: a.URI ? new URL(a.URI, base).href : null, iv: a.IV || null };
    } else if (l.startsWith('#EXT-X-MAP:')) {
      const a = attrs(l.slice(11)); map = { url: new URL(a.URI, base).href, range: a.BYTERANGE || null };
    } else if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8)) || 0;
    else if (!l.startsWith('#')) {
      segs.push({ url: new URL(l, base).href, key, seq: seq + segs.length, dur });
      total += dur; dur = 0;
    }
  }
  return { segs, map, total, isMaster: false };
}

class HlsDownload extends Item {
  constructor(data, ctx) {
    super({ ...data, type: 'hls' }, ctx);
    this.quality = data.quality || null;     // url de la variante choisie
    this.variantInfo = data.variantInfo || '';
    this.tracks = data.tracks || null;       // [{kind:'video'|'audio', url, count, done:[...], bytes}]
    this.duration = data.duration || 0;
    this.controllers = new Set();
    this.keys = new Map();
  }
  get tmpDir() { return this.file + '.dryae-hls'; }
  downloaded() {
    if (!this.tracks) return 0;
    return this.tracks.reduce((a, t) => a + (t.bytes || 0), 0);
  }
  progressFrac() {
    if (!this.tracks) return 0;
    const tot = this.tracks.reduce((a, t) => a + t.count, 0), d = this.tracks.reduce((a, t) => a + t.done.length, 0);
    return tot ? d / tot : 0;
  }
  toJSON() { return { ...super.toJSON(), quality: this.quality, variantInfo: this.variantInfo, tracks: this.tracks, duration: this.duration }; }
  view() {
    const v = super.view();
    const f = this.progressFrac();
    const d = this.downloaded();
    v.progress = this.status === 'done' ? 1 : f;
    v.estSize = this.status === 'done' ? this.size : f > 0.02 ? d / f : -1;
    v.eta = this.status === 'running' && this.speed > 0 && v.estSize > 0 ? (v.estSize - d) / this.speed : -1;
    v.segInfo = this.tracks ? this.tracks.map(t => `${t.kind === 'audio' ? 'audio' : 'vidéo'} ${t.done.length}/${t.count}`).join(' · ') : '';
    return v;
  }

  async getText(url, ac) {
    const res = await this.ctx.fetch(url, { headers: this.ctx.buildHeaders(this, {}), signal: ac?.signal });
    if (!res.ok) throw new Error(`Playlist inaccessible (${res.status})`);
    return { text: await res.text(), url: res.url || url };
  }

  // Lecture de la playlist maître pour proposer les qualités (utilisé par l'UI avant l'ajout)
  static async inspect(ctx, url, headers) {
    const fake = { headers: headers || {}, url, host: '' };
    const res = await ctx.fetch(url, { headers: ctx.buildHeaders(fake, {}) });
    if (!res.ok) throw new Error(`Playlist inaccessible (${res.status})`);
    const text = await res.text();
    if (!text.includes('#EXTM3U')) throw new Error("Ce lien n'est pas une playlist m3u8 valide");
    if (text.includes('#EXT-X-STREAM-INF')) {
      const m = parseMaster(text, res.url || url);
      return { master: true, variants: m.variants.map(v => ({ url: v.url, label: [v.resolution, v.bandwidth ? Math.round(v.bandwidth / 1000) + ' kb/s' : ''].filter(Boolean).join(' · ') || 'Variante' })), audios: m.audios.length };
    }
    const p = parseMedia(text, res.url || url);
    return { master: false, variants: [], duration: p.total, segments: p.segs.length };
  }

  async resolveTracks(ac) {
    const S = this.ctx.settings.get();
    const top = await this.getText(this.url, ac);
    if (!top.text.includes('#EXTM3U')) throw new Error("Ce lien n'est pas une playlist m3u8 valide");
    const tracks = [];
    if (top.text.includes('#EXT-X-STREAM-INF')) {
      const m = parseMaster(top.text, top.url);
      if (!m.variants.length) throw new Error('Aucune variante vidéo dans la playlist');
      let v = m.variants.find(x => x.url === this.quality);
      if (!v) v = S.hls.quality === 'lowest' ? m.variants[m.variants.length - 1] : m.variants[0];
      this.variantInfo = [v.resolution, v.bandwidth ? Math.round(v.bandwidth / 1000) + ' kb/s' : ''].filter(Boolean).join(' · ');
      tracks.push({ kind: 'video', url: v.url });
      const aud = m.audios.filter(a => a.group === v.audio);
      const a = aud.find(x => x.def) || aud[0];
      if (a && a.url !== v.url) tracks.push({ kind: 'audio', url: a.url });
    } else tracks.push({ kind: 'video', url: top.url, text: top.text });
    for (const t of tracks) {
      const media = t.text ? { text: t.text, url: t.url } : await this.getText(t.url, ac);
      const p = parseMedia(media.text, media.url);
      if (!p.segs.length) throw new Error('Playlist vide');
      t.segs = p.segs; t.map = p.map; t.count = p.segs.length; t.done = []; t.bytes = 0;
      if (t.kind === 'video') this.duration = p.total;
      delete t.text;
    }
    return tracks;
  }

  async keyFor(k, ac) {
    if (!k || k.method !== 'AES-128') return null;
    if (!this.keys.has(k.uri)) {
      const res = await this.ctx.fetch(k.uri, { headers: this.ctx.buildHeaders(this, {}), signal: ac.signal });
      if (!res.ok) throw new Error(`Clé de déchiffrement inaccessible (${res.status})`);
      this.keys.set(k.uri, Buffer.from(await res.arrayBuffer()));
    }
    return this.keys.get(k.uri);
  }

  async fetchSeg(t, i, ac) {
    const seg = t.segs[i];
    const res = await this.ctx.fetch(seg.url, { headers: this.ctx.buildHeaders(this, {}), signal: ac.signal });
    if (!res.ok) throw Object.assign(new Error(`Segment ${i + 1} : erreur ${res.status}`), { code: 'http' + res.status });
    const chunks = []; let n = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value)); n += value.byteLength; t.bytes += value.byteLength;
      const w1 = this.ctx.limiter.take(value.byteLength), w2 = this.limiter.take(value.byteLength);
      if (w1) await w1; if (w2) await w2;
      if (this.status !== 'running') throw Object.assign(new Error('stop'), { name: 'AbortError' });
    }
    let buf = Buffer.concat(chunks, n);
    if (seg.key && seg.key.method === 'AES-128') {
      const key = await this.keyFor(seg.key, ac);
      let iv;
      if (seg.key.iv) iv = Buffer.from(seg.key.iv.replace(/^0x/i, '').padStart(32, '0'), 'hex');
      else { iv = Buffer.alloc(16); iv.writeUInt32BE(seg.seq, 12); }
      const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
      buf = Buffer.concat([d.update(buf), d.final()]);
    } else if (seg.key && seg.key.method !== 'AES-128') throw Object.assign(new Error('Vidéo protégée (DRM) : téléchargement impossible'), { code: 'drm' });
    return buf;
  }

  async start() {
    if (this.status === 'running') return;
    this.status = 'running'; this.error = null; this.changed();
    const S = this.ctx.settings.get();
    const ac = new AbortController(); this.controllers.add(ac);
    try {
      if (!this.file) {
        let name = sanitize(this.name || nameFromUrl(this.url).replace(/\.m3u8$/i, '') || 'video');
        if (!/\.(mp4|ts|mkv)$/i.test(name)) name += S.hls.convert && this.ctx.ffmpeg() ? '.mp4' : '.ts';
        let dir = this.dir || S.dir;
        if (this.autoDir && S.categorize) dir = path.join(S.dir, catFolder('video'));
        await fsp.mkdir(dir, { recursive: true });
        this.dir = dir; this.file = uniquePath(dir, name); this.name = path.basename(this.file);
      }
      // les segments contiennent des URL qui expirent : on relit la playlist à chaque reprise
      const fresh = await this.resolveTracks(ac);
      if (this.tracks && this.tracks.length === fresh.length && this.tracks.every((t, i) => t.count === fresh[i].count)) {
        fresh.forEach((t, i) => { t.done = this.tracks[i].done || []; t.bytes = this.tracks[i].bytes || 0; });
      }
      this.tracks = fresh;
      await fsp.mkdir(this.tmpDir, { recursive: true });
      // vérifier les segments déjà présents sur le disque
      for (const [ti, t] of this.tracks.entries()) t.done = t.done.filter(i => fs.existsSync(path.join(this.tmpDir, `${ti}_${i}.seg`)));
      this.ctx.save(); this.resetTick(); this.changed();

      for (const [ti, t] of this.tracks.entries()) {
        if (t.map) {
          const mp = path.join(this.tmpDir, `${ti}_init.seg`);
          if (!fs.existsSync(mp)) {
            const h = t.map.range ? (() => { const [len, off = 0] = t.map.range.split('@').map(Number); return { Range: `bytes=${off}-${off + len - 1}` }; })() : {};
            const r = await this.ctx.fetch(t.map.url, { headers: this.ctx.buildHeaders(this, h), signal: ac.signal });
            await fsp.writeFile(mp, Buffer.from(await r.arrayBuffer()));
          }
        }
        const todo = [];
        const doneSet = new Set(t.done);
        for (let i = 0; i < t.count; i++) if (!doneSet.has(i)) todo.push(i);
        const workers = Math.max(1, Math.min(S.hls.connections || 6, 16));
        const max = S.maxRetries;
        await Promise.all(Array.from({ length: workers }, async () => {
          while (todo.length && this.status === 'running') {
            const i = todo.shift();
            for (let tries = 0; ; tries++) {
              const sac = new AbortController(); this.controllers.add(sac);
              try {
                const buf = await this.fetchSeg(t, i, sac);
                await fsp.writeFile(path.join(this.tmpDir, `${ti}_${i}.seg`), buf);
                t.done.push(i);
                break;
              } catch (e) {
                if (this.status !== 'running' || e.code === 'drm') throw e;
                if (tries >= max) throw e;
                await sleep(Math.min(10000, 700 * (tries + 1)));
              } finally { this.controllers.delete(sac); }
            }
          }
        }));
        if (this.status !== 'running') return;
      }
      // assemblage
      this.status = 'merging'; this.changed();
      const parts = [];
      for (const [ti, t] of this.tracks.entries()) {
        const out = path.join(this.tmpDir, `track${ti}.${t.map ? 'mp4' : 'ts'}`);
        const ws = fs.createWriteStream(out);
        const mp = path.join(this.tmpDir, `${ti}_init.seg`);
        if (t.map && fs.existsSync(mp)) ws.write(await fsp.readFile(mp));
        for (let i = 0; i < t.count; i++) {
          const b = await fsp.readFile(path.join(this.tmpDir, `${ti}_${i}.seg`));
          if (!ws.write(b)) await new Promise(r => ws.once('drain', r));
        }
        await new Promise((r, j) => ws.end(err => (err ? j(err) : r())));
        parts.push(out);
      }
      const ff = this.ctx.ffmpeg();
      const wantMp4 = /\.mp4$/i.test(this.file);
      if (ff && (wantMp4 || parts.length > 1)) {
        const args = ['-y', '-hide_banner', '-loglevel', 'error'];
        parts.forEach(p => args.push('-i', p));
        if (parts.length > 1) args.push('-map', '0:v?', '-map', '0:a?', '-map', '1:a?');
        args.push('-c', 'copy');
        if (wantMp4) args.push('-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart');
        args.push(this.file);
        await this.ctx.runFfmpeg(args).catch(async e => {
          // repli : garder le .ts brut
          const ts = this.file.replace(/\.mp4$/i, '.ts');
          await fsp.copyFile(parts[0], ts); this.file = ts; this.name = path.basename(ts);
          this.error = null; console.error('ffmpeg', e.message);
        });
      } else {
        const target = wantMp4 ? this.file.replace(/\.mp4$/i, '.ts') : this.file;
        await fsp.rename(parts[0], target); this.file = target; this.name = path.basename(target);
      }
      if (this.status !== 'merging') return;
      this.size = (await fsp.stat(this.file)).size;
      await fsp.rm(this.tmpDir, { recursive: true, force: true }).catch(() => {});
      this.complete();
    } catch (e) {
      if (this.status === 'running' || this.status === 'merging') this.fail(errMsg(e), e.code || e.cause?.code);
    } finally { this.controllers.delete(ac); }
  }
  stop() { for (const c of this.controllers) { try { c.abort(); } catch {} } this.controllers.clear(); }
  pause() {
    if (!['running', 'queued', 'scheduled'].includes(this.status)) return;
    this.status = 'paused'; this.stop(); this.speed = 0; this.changed(); this.emit('finished');
  }
  async reset() {
    this.stop();
    if (this.file) await fsp.rm(this.tmpDir, { recursive: true, force: true }).catch(() => {});
    this.file = null; this.tracks = null; this.size = -1; this.error = null; this.finished = null;
    if (this.autoDir) this.dir = '';
  }
  refreshUrl(url) { this.url = url; this.error = null; this.changed(); }
  partPath() { return this.status === 'done' ? this.file : this.file && this.tmpDir; }
  async removeFiles(deleteDone) {
    if (!this.file) return;
    await fsp.rm(this.tmpDir, { recursive: true, force: true }).catch(() => {});
    if (deleteDone && this.status === 'done') await fsp.rm(this.file, { force: true }).catch(() => {});
  }
}

module.exports = { HlsDownload, parseMaster, parseMedia };
