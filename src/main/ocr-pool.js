// 1.7.2 : la lecture des bulles passe par un fil à part (ocr-worker.js) au lieu du processus principal.
// - DrYAE reste fluide (défilement, onglets, téléchargements) pendant qu'un chapitre est lu ;
// - « Arrêter » le traducteur arrête vraiment le travail en cours (le fil est arrêté puis relancé à la demande) ;
// - si le fil ne peut pas démarrer, la lecture se fait comme avant, dans le processus principal.
const path = require('path');
const { Worker } = require('worker_threads');
const PO = require('./paddle-ocr');
let worker = null, dir = '', seq = 0, broken = false;
const jobs = new Map(); // id -> { ok, no, owner }
function setDir(d) { dir = d; PO.setDir(d); }
function start() {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, 'ocr-worker.js'), { workerData: { dir } });
  worker.on('message', m => {
    const j = jobs.get(m.id); if (!j) return; jobs.delete(m.id);
    if (!m.ok) return j.no(new Error(m.err));
    const r = m.list; Object.assign(r, m.extra || {}); j.ok(r);
  });
  const fail = e => { const w = worker; worker = null; for (const [id, j] of jobs) { jobs.delete(id); j.no(e || new Error('lecture interrompue')); } try { w && w.terminate(); } catch {} };
  worker.on('error', e => { broken = true; fail(e); });
  worker.on('exit', code => { if (worker) fail(new Error('lecture interrompue (' + code + ')')); });
  return worker;
}
async function readBubbles(img, opts = {}, owner = 0) {
  if (broken || process.env.DRYAE_OCR_INLINE) return PO.readBubbles(img, opts);
  try { start(); } catch { broken = true; return PO.readBubbles(img, opts); }
  const id = ++seq;
  // copie des pixels (le tampon d'origine peut encore servir au processus principal)
  const data = new Uint8Array(img.data).buffer;
  return new Promise((ok, no) => { jobs.set(id, { ok, no, owner }); worker.postMessage({ cmd: 'read', id, width: img.width, height: img.height, data, opts }, [data]); });
}
// arrête les lectures demandées par cette page ; le fil est arrêté s'il ne travaille plus que pour elle
function cancel(owner) {
  let others = 0, mine = 0;
  for (const j of jobs.values()) j.owner === owner ? mine++ : others++;
  if (!mine) return 0;
  if (!others && worker) { const w = worker; worker = null; for (const [id, j] of jobs) { jobs.delete(id); j.no(Object.assign(new Error('arrêté'), { cancelled: true })); } w.terminate().catch(() => {}); }
  else for (const [id, j] of jobs) if (j.owner === owner) { jobs.delete(id); j.no(Object.assign(new Error('arrêté'), { cancelled: true })); }
  return mine;
}
function stop() { if (worker) { const w = worker; worker = null; w.terminate().catch(() => {}); } }
module.exports = { readBubbles, cancel, stop, setDir, busy: () => jobs.size };
