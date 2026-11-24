// 1.7.2 : yt-dlp trop ancien (« Requested format is not available ») → mis à jour tout seul, puis nouvel essai
const fs = require('fs'), os = require('os'), path = require('path');
const { YtdlHub } = require('../src/main/engine/ytdl.js');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x) : '');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytauto-'));
let data = { proxy: {}, ytdl: { updated: 0 } };
const ctx = { settings: { get: () => data, set: p => { data = { ...data, ...p }; return data; } } };
const hub = new YtdlHub(ctx, dir);
const fake = path.join(dir, 'fake-yt-dlp'), mark = path.join(dir, 'updated'), log = path.join(dir, 'calls');
fs.writeFileSync(fake, `#!/bin/sh
echo "$*" >> "${log}"
case " $* " in *" -U "*) touch "${mark}"; echo "Updated yt-dlp to 2099.01.01"; exit 0;; esac
if [ -f "${mark}" ]; then echo '{"id":"x","title":"Vidéo test","duration":10,"formats":[{"format_id":"18","height":360,"vcodec":"avc1","acodec":"mp4a","filesize":1000}]}'; exit 0; fi
echo "ERROR: [youtube] x: Requested format is not available. Use --list-formats for a list of available formats" >&2; exit 1
`, { mode: 0o755 });
hub.exe = fake; hub.bundled = fake;
(async () => {
  const v = await hub.inspect('https://www.youtube.com/watch?v=x');
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
  ok('vidéo lue après mise à jour automatique de yt-dlp', v.title === 'Vidéo test' && v.heights[0].h === 360, v.title);
  ok('ordre : essai, mise à jour (-U), nouvel essai', calls.length === 3 && /-U/.test(calls[1]) && !/-U/.test(calls[0]) && !/-U/.test(calls[2]), calls.map(c => c.slice(0, 20)));
  ok('date de la tentative gardée', data.ytdl.autoTried > 0 && data.ytdl.updated > 0);
  // une deuxième erreur dans les 6 h : pas de nouvelle mise à jour (pas de boucle)
  fs.rmSync(mark); fs.writeFileSync(log, '');
  let err = null; try { await hub.inspect('https://www.youtube.com/watch?v=x'); } catch (e) { err = e.message; }
  const c2 = fs.readFileSync(log, 'utf8').trim().split('\n');
  ok('pas plus d\'une mise à jour automatique toutes les 6 h', c2.length === 1 && /qualité n'est pas disponible/.test(err || ''), [c2.length, err]);
  // autre erreur (vidéo privée) : jamais de mise à jour
  data.ytdl.autoTried = 0;
  ok('erreur sans rapport (vidéo privée) : pas de mise à jour', !hub.isStale('ERROR: [youtube] x: Private video') && hub.isStale('WARNING: Only images are available for download'));
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
})().catch(e => { console.log('ÉCHEC exception', e.message); process.exit(1); });
