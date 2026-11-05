const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const isWin = process.platform === 'win32';
function binDir() {
  // empaqueté : resources/bin ; développement : ./bin/<plateforme>
  if (process.resourcesPath) {
    const packed = path.join(process.resourcesPath, 'bin');
    if (fs.existsSync(path.join(packed, isWin ? 'ffmpeg.exe' : 'ffmpeg'))) return packed;
  }
  return path.join(__dirname, '..', '..', 'bin', isWin ? 'win' : 'linux');
}
function ffmpegPath() {
  const p = path.join(binDir(), isWin ? 'ffmpeg.exe' : 'ffmpeg');
  return fs.existsSync(p) ? p : null;
}
function sevenZipPath() {
  const p = path.join(binDir(), isWin ? '7za.exe' : '7za');
  if (fs.existsSync(p)) return p;
  try { const z = require('7zip-bin').path7za.replace('app.asar', 'app.asar.unpacked'); if (fs.existsSync(z)) return z; } catch {}
  return null;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ff = ffmpegPath();
    if (!ff) return reject(new Error('ffmpeg introuvable'));
    const p = spawn(ff, args, { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || 'ffmpeg a échoué (' + code + ')'))));
  });
}

function checksum(file, algo = 'md5', onProgress) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algo);
    const total = fs.statSync(file).size; let done = 0, last = 0;
    fs.createReadStream(file, { highWaterMark: 1 << 20 })
      .on('data', d => { h.update(d); done += d.length; if (onProgress && Date.now() - last > 200) { last = Date.now(); onProgress(done / total); } })
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

function extract(archive, outDir, password) {
  return new Promise((resolve, reject) => {
    const z = sevenZipPath();
    if (!z) return reject(new Error('Outil d\'extraction introuvable'));
    const args = ['x', archive, '-o' + outDir, '-y', '-bso0', '-bsp0'];
    args.push(password ? '-p' + password : '-p-');
    execFile(z, args, { windowsHide: true, maxBuffer: 1 << 24 }, (e, _o, se) => {
      if (e) {
        const m = String(se || e.message);
        if (/Wrong password|password/i.test(m)) return reject(Object.assign(new Error('Mot de passe incorrect ou requis'), { code: 'password' }));
        if (/Unsupported|Can not open/i.test(m)) return reject(new Error('Format d\'archive non pris en charge (zip, 7z, tar, gz, iso… sont pris en charge)'));
        return reject(new Error(m.trim().split('\n').pop()));
      }
      resolve(outDir);
    });
  });
}

function mergeAV(video, audio, out) {
  return runFfmpeg(['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', out]);
}
function convert(input, out) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
  if (/\.(mp3)$/i.test(out)) args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2');
  else if (/\.(aac|m4a)$/i.test(out)) args.push('-vn', '-c:a', 'copy');
  else args.push('-c', 'copy');
  args.push(out);
  return runFfmpeg(args);
}

function shutdown(mode = 'shutdown') {
  if (!isWin) return;
  const args = mode === 'sleep' ? null : mode === 'restart' ? ['/r', '/t', '60'] : ['/s', '/t', '60', '/c', 'DrYAE : tous les téléchargements sont terminés. Arrêt dans 60 secondes (shutdown /a pour annuler).'];
  if (args) execFile('shutdown', args, { windowsHide: true });
  else execFile('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], { windowsHide: true });
}
function cancelShutdown() { if (isWin) execFile('shutdown', ['/a'], { windowsHide: true }); }

module.exports = { binDir, ffmpegPath, runFfmpeg, checksum, extract, mergeAV, convert, shutdown, cancelShutdown, sevenZipPath };
