// Vidéos en ligne (YouTube et ~1800 sites) via yt-dlp : choix MP4 / MP3 / M4A et de la qualité, playlists
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn, execFile } = require('child_process');
const { Item } = require('./base');
const { sanitize, catFolder, sleep } = require('../util');
const tools = require('../tools');

const isWin = process.platform === 'win32';
const RESERVED = new Set(); // noms déjà attribués pendant cette session

// hôtes reconnus automatiquement comme « vidéo en ligne »
const YT_HOSTS = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|dailymotion\.com|dai\.ly|facebook\.com|fb\.watch|instagram\.com|tiktok\.com|twitter\.com|x\.com|twitch\.tv|soundcloud\.com|bilibili\.com|reddit\.com|v\.redd\.it|rumble\.com|odysee\.com|bandcamp\.com|mixcloud\.com|streamable\.com|9gag\.com|pinterest\.[a-z.]+|linkedin\.com|tumblr\.com|vk\.com|ok\.ru|bitchute\.com|archive\.org|ted\.com|arte\.tv|france\.tv|tf1\.fr|6play\.fr|rts\.ch|rtbf\.be)$/i;
const isOnlineVideo = url => { try { return YT_HOSTS.test(new URL(url).hostname); } catch { return false; } };

// l'exécutable de DrYAE se comporte comme Node quand ELECTRON_RUN_AS_NODE=1 (pour yt-dlp)
function ytEnv() { return { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ELECTRON_RUN_AS_NODE: '1' }; }
function killTree(p) {
  if (!p || p.exitCode !== null) return;
  try { if (isWin) execFile('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true }); else p.kill('SIGTERM'); } catch {}
}

class YtdlHub {
  constructor(ctx, userDir) {
    this.ctx = ctx;
    this.dir = path.join(userDir, 'bin');
    fs.mkdirSync(this.dir, { recursive: true });
    this.bundled = path.join(tools.binDir(), isWin ? 'yt-dlp.exe' : 'yt-dlp');
    this.exe = path.join(this.dir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
    this.qjs = path.join(tools.binDir(), isWin ? 'qjs.exe' : 'qjs');
    this.deno = path.join(tools.binDir(), isWin ? 'deno.exe' : 'deno');
    // copie modifiable (pour « Mettre à jour yt-dlp »)
    try {
      const b = fs.statSync(this.bundled);
      const c = fs.existsSync(this.exe) ? fs.statSync(this.exe) : null;
      if (!c || (c.mtimeMs < b.mtimeMs && c.size !== b.size && !this.ctx.settings.get().ytdl?.updated)) { fs.copyFileSync(this.bundled, this.exe); if (!isWin) fs.chmodSync(this.exe, 0o755); }
    } catch (e) { console.error('yt-dlp', e.message); }
  }
  available() { return fs.existsSync(this.exe) || fs.existsSync(this.bundled); }
  bin() { return fs.existsSync(this.exe) ? this.exe : this.bundled; }
  baseArgs(item) {
    const S = this.ctx.settings.get();
    const a = ['--no-colors', '--no-warnings', '--ignore-config', '--no-check-certificates'];
    const ff = tools.ffmpegPath();
    if (ff) a.push('--ffmpeg-location', path.dirname(ff));
    if (fs.existsSync(this.deno)) a.push('--js-runtimes', 'deno:' + this.deno);
    if (process.versions.electron && parseInt(process.versions.node, 10) >= 22) a.push('--js-runtimes', 'node:' + process.execPath);
    if (fs.existsSync(this.qjs)) a.push('--js-runtimes', 'quickjs:' + this.qjs);
    const p = S.proxy;
    if (p.enabled && p.url) a.push('--proxy', p.url.includes('://') ? p.url : 'http://' + p.url);
    const ua = item?.headers?.['User-Agent'];
    if (ua) a.push('--user-agent', ua);
    const ref = item?.pageUrl || item?.headers?.Referer;
    if (ref && ref !== item.url && !/youtube|youtu\.be/.test(item.url)) a.push('--referer', ref);
    return a;
  }
  run(args, opts = {}) {
    return new Promise((resolve, reject) => {
      const p = spawn(this.bin(), args, { windowsHide: true, env: ytEnv() });
      let out = '', err = '';
      p.stdout.on('data', d => { out += d; if (out.length > 64e6) p.kill(); });
      p.stderr.on('data', d => { err += d; if (err.length > 1e5) err = err.slice(-5e4); });
      const t = opts.timeout ? setTimeout(() => killTree(p), opts.timeout) : null;
      p.on('error', reject);
      p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(cleanErr(err) || `yt-dlp a échoué (${code})`)); });
    });
  }
  // Infos avant ajout : titre, durée, qualités disponibles, ou liste d'une playlist
  async inspect(url, headers, cookieFile) {
    if (!this.available()) throw new Error('yt-dlp est introuvable');
    const args = [...this.baseArgs({ url, headers }), '-J', '--flat-playlist'];
    if (cookieFile) args.push('--cookies', cookieFile);
    args.push(url);
    const j = JSON.parse(await this.run(args, { timeout: 120000 }));
    if (j._type === 'playlist' || Array.isArray(j.entries)) {
      return { playlist: true, title: j.title || 'Playlist', count: (j.entries || []).length,
        entries: (j.entries || []).filter(Boolean).slice(0, 1000).map(e => ({ url: e.url && /^https?:/.test(e.url) ? e.url : e.webpage_url || (e.id && /youtube/.test(url) ? 'https://www.youtube.com/watch?v=' + e.id : e.url), title: e.title || e.id, duration: e.duration || 0 })) };
    }
    const fmts = j.formats || [];
    const audioBest = fmts.filter(f => f.vcodec === 'none' && f.acodec !== 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
    const aSize = audioBest ? (audioBest.filesize || audioBest.filesize_approx || 0) : 0;
    const byH = new Map();
    for (const f of fmts) {
      if (!f.height || f.vcodec === 'none') continue;
      const sz = (f.filesize || f.filesize_approx || 0) + (f.acodec === 'none' ? aSize : 0);
      const cur = byH.get(f.height);
      if (!cur || sz > cur.size) byH.set(f.height, { h: f.height, size: sz, fps: f.fps || 0 });
    }
    const heights = [...byH.values()].sort((a, b) => b.h - a.h);
    return { playlist: false, title: j.title || j.id, duration: j.duration || 0, uploader: j.uploader || j.channel || '', thumbnail: j.thumbnail || '',
      extractor: j.extractor_key || j.extractor || '', heights, audioSize: aSize, hasVideo: heights.length > 0 || fmts.some(f => f.vcodec !== 'none' && !(f.acodec && f.acodec !== 'none' && f.vcodec == null && /^(mp3|m4a|aac|opus|ogg|wav|flac)$/i.test(f.ext || ''))) || (!fmts.length && !!j.url), webpage: j.webpage_url || url };
  }
  async update() {
    if (!fs.existsSync(this.exe)) fs.copyFileSync(this.bundled, this.exe);
    const out = await this.run(['-U'], { timeout: 180000 });
    this.ctx.settings.set({ ytdl: { updated: Date.now() } });
    return (out.match(/(Updated yt-dlp to|yt-dlp is up to date)[^\n]*/) || [out.trim().split('\n').pop()])[0];
  }
  async version() { try { return (await this.run(['--version'], { timeout: 20000 })).trim(); } catch { return '?'; } }
}

function cleanErr(s) {
  const l = String(s).split(/\r?\n/).filter(x => /ERROR/.test(x)).pop() || String(s).trim().split(/\r?\n/).pop() || '';
  const m = l.replace(/^.*?ERROR:\s*/, '').replace(/\[\w+\]\s*[\w-]+:\s*/, '');
  if (/Sign in to confirm|not a bot/i.test(m)) return 'YouTube demande une connexion : connecte-toi à YouTube dans le navigateur DrYAE puis réessaie';
  if (/Private video/i.test(m)) return 'Vidéo privée';
  if (/age/i.test(m) && /confirm|restricted/i.test(m)) return 'Vidéo soumise à une limite d\'âge : connecte-toi dans le navigateur DrYAE puis réessaie';
  if (/Unsupported URL/i.test(m)) return 'Ce site n\'est pas pris en charge pour les vidéos en ligne';
  if (/DRM/i.test(m)) return 'Vidéo protégée (DRM) : téléchargement impossible';
  if (/Requested format is not available/i.test(m)) return 'Cette qualité n\'est pas disponible pour cette vidéo';
  if (/HTTP Error 403/i.test(m)) return 'Accès refusé par le site (403). Essaie « Mettre à jour yt-dlp » dans les paramètres';
  if (/Unable to download webpage|getaddrinfo|timed out/i.test(m)) return 'Impossible de joindre le site (connexion internet ?)';
  return m.slice(0, 300);
}

class YtdlDownload extends Item {
  constructor(data, ctx) {
    super({ ...data, type: 'ytdl' }, ctx);
    this.mode = data.mode || 'video';           // video | audio
    this.quality = data.quality || 'best';      // hauteur (1080…) ou 'best'
    this.audioFormat = data.audioFormat || 'mp3';
    this.audioBitrate = data.audioBitrate || '320';
    this.title = data.title || data.name || '';
    this._base = data._base || null;
    this.thumbnail = data.thumbnail || '';
    this.duration = data.duration || 0;
    this.doneBytes = data.doneBytes || 0;
    this.cur = { done: 0, total: 0 };
    this.phase = data.phase || '';
    this.proc = null;
  }
  get category() { return this.mode === 'audio' ? 'audio' : 'video'; }
  downloaded() { return this.status === 'done' && this.size > 0 ? this.size : this.doneBytes + (this.cur.done || 0); }
  toJSON() { return { ...super.toJSON(), _base: this._base, mode: this.mode, quality: this.quality, audioFormat: this.audioFormat, audioBitrate: this.audioBitrate, title: this.title, thumbnail: this.thumbnail, duration: this.duration }; }
  view() {
    const v = super.view();
    v.phase = this.phase;
    v.progress = this.status === 'done' ? 1 : this.cur.total > 0 ? Math.min(1, this.cur.done / this.cur.total) : 0;
    v.curTotal = this.cur.total;
    v.speed = this.status === 'running' ? this.speed : 0;
    v.eta = this.status === 'running' ? (this._eta ?? -1) : -1;
    v.displayName = this.name || this.title || '';
    v.formatLabel = this.mode === 'audio' ? `${this.audioFormat.toUpperCase()}${this.audioFormat === 'mp3' ? ' ' + this.audioBitrate + ' kb/s' : ''}` : `MP4 ${this.quality === 'best' ? 'meilleure qualité' : this.quality + 'p'}`;
    return v;
  }
  tick() { this.speed = this._spd || 0; this.ctx.countData?.(0); }

  async start() {
    if (this.status === 'running') return;
    const hub = this.ctx.ytdl;
    this.status = 'running'; this.error = null; this.changed();
    const S = this.ctx.settings.get();
    try {
      if (!hub.available()) throw new Error('yt-dlp est introuvable');
      let dir = this.dir || S.dir;
      if (this.autoDir && S.categorize) dir = path.join(S.dir, catFolder(this.category));
      await fsp.mkdir(dir, { recursive: true });
      this.dir = dir;
      let base = this._base || sanitize(this.title || 'video').slice(0, 150);
      if (!this._base) {
        // nom unique : ne jamais retomber sur un fichier déjà présent (yt-dlp le sauterait)
        const exists = b => RESERVED.has(path.join(dir, b).toLowerCase()) || ['mp4', 'mkv', 'webm', 'mp3', 'm4a', 'opus', 'ogg'].some(e => fs.existsSync(path.join(dir, b + '.' + e)));
        for (let i = 2; exists(base) && i < 1000; i++) base = sanitize(this.title || 'video').slice(0, 150) + ` (${i})`;
        this._base = base;
        RESERVED.add(path.join(dir, base).toLowerCase());
      }
      const args = [...hub.baseArgs(this), '--newline', '--progress', '--no-playlist', '--continue', '--no-mtime', '--windows-filenames',
        '--progress-template', 'download:DRYAEP %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s',
        '--print', 'before_dl:DRYAET %(title)s', '--print', 'after_move:DRYAEF %(filepath)s', '--no-simulate', '-o', path.join(dir, base + '.%(ext)s')];
      if (this.mode === 'audio') {
        args.push('-f', 'ba/b', '-x', '--audio-format', this.audioFormat);
        if (this.audioFormat === 'mp3') args.push('--audio-quality', this.audioBitrate + 'K');
        args.push('--embed-thumbnail', '--embed-metadata', '--convert-thumbnails', 'jpg');
      } else {
        const h = this.quality === 'best' ? '' : `[height<=${this.quality}]`;
        args.push('-f', `bv*${h}+ba/b${h}/bv*+ba/b`, '-S', 'vcodec:h264,acodec:m4a,res,fps', '--merge-output-format', 'mp4', '--embed-metadata');
      }
      const lim = Math.min(...[this.speedLimit, S.speedLimitOn ? S.speedLimit : 0].filter(x => x > 0), Infinity);
      if (isFinite(lim)) args.push('--limit-rate', lim + 'K');
      const ck = await this.ctx.cookieFileFor?.(this.url);
      if (ck) args.push('--cookies', ck);
      args.push(this.url);
      this.doneBytes = 0; this.cur = { done: 0, total: 0 }; this.phase = 'vidéo';
      let finalFile = null, lastTotal = 0, err = '';
      await new Promise((resolve, reject) => {
        const p = spawn(hub.bin(), args, { windowsHide: true, env: ytEnv() });
        this.proc = p;
        let buf = '';
        const onLine = line => {
          if (line.startsWith('DRYAEP ')) {
            const [, d, t, te, sp, eta] = line.split(' ');
            const total = +t || +te || 0;
            if (lastTotal && total && Math.abs(total - lastTotal) > lastTotal * 0.2 && this.cur.done > 0 && (+d) < this.cur.done * 0.5) {
              // nouveau flux (audio après vidéo)
              this.doneBytes += this.cur.done; this.phase = 'audio';
            }
            lastTotal = total || lastTotal;
            this.cur = { done: +d || 0, total };
            this._spd = +sp || 0; this._eta = +eta >= 0 ? +eta : -1;
            if (this.size < 0 || this.size < this.doneBytes + total) this.size = this.doneBytes + total;
          } else if (line.startsWith('DRYAEF ')) finalFile = line.slice(7).trim();
          else if (line.startsWith('DRYAET ')) { const t = line.slice(7).trim(); if (!this.title && t && !/^(master|index|playlist|video)([-_.]|$)/i.test(t)) { this.title = t; this.changed(); } }
          else if (/^\[(Merger|ExtractAudio|VideoConvertor|FixupM3u8|EmbedThumbnail|Metadata)\]/.test(line)) { this.phase = 'conversion'; if (this.status === 'running') { this.status = 'merging'; this.changed(); } }
          else if (/\[download\] Destination: .*\.f\d+\.\w+$/.test(line) && this.cur.done > 0) { this.doneBytes += this.cur.done; this.cur = { done: 0, total: 0 }; this.phase = 'audio'; }
        };
        p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); } });
        p.stderr.on('data', d => { err += d; if (err.length > 1e5) err = err.slice(-5e4); });
        p.on('error', reject);
        p.on('close', code => { this.proc = null; if (buf) onLine(buf); code === 0 ? resolve() : reject(new Error(cleanErr(err) || `yt-dlp a échoué (${code})`)); });
      });
      if (!['running', 'merging'].includes(this.status)) return;
      if (!(finalFile && fs.existsSync(finalFile))) {
        // repli : le fichier le plus récent du dossier qui porte le nom prévu
        try {
          const cands = fs.readdirSync(dir).filter(f => f.startsWith(base) && !/\.(part|ytdl|tmp)$|\.f\d+\.|\.temp\./.test(f)).map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
          if (cands[0]) finalFile = cands[0];
        } catch {}
      }
      if (finalFile && fs.existsSync(finalFile)) { this.file = finalFile; this.name = path.basename(finalFile); this.size = fs.statSync(finalFile).size; }
      this.complete();
    } catch (e) {
      if (['running', 'merging'].includes(this.status)) this.fail(e.message);
    }
  }
  stop() { killTree(this.proc); this.proc = null; this._spd = 0; }
  pause() {
    if (!['running', 'queued', 'scheduled', 'merging'].includes(this.status)) return;
    this.status = 'paused'; this.stop(); this.speed = 0; this.changed(); this.emit('finished');
  }
  async reset() {
    this.stop(); await sleep(500);
    await this.removeFiles(false);
    this.file = null; this.size = -1; this.doneBytes = 0; this.cur = { done: 0, total: 0 }; this.error = null; this.finished = null; this._base = null;
    if (this.autoDir) this.dir = '';
  }
  refreshUrl(url) { this.url = url; this.changed(); }
  partPath() { return this.file || this.dir; }
  async removeFiles(deleteDone) {
    const base = this._base || sanitize(this.title || 'video').slice(0, 150);
    if (this.dir) {
      try {
        for (const f of await fsp.readdir(this.dir)) if (f.startsWith(base) && /\.(part|ytdl|f\d+\.\w+|temp\.\w+)$|\.part-Frag/.test(f)) await fsp.rm(path.join(this.dir, f), { force: true });
      } catch {}
    }
    if (deleteDone && this.status === 'done' && this.file) await fsp.rm(this.file, { force: true }).catch(() => {});
  }
}

module.exports = { YtdlHub, YtdlDownload, isOnlineVideo };
