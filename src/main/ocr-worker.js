// 1.7.2 : lecture du texte des images (PaddleOCR) dans un fil à part : DrYAE ne se fige plus pendant un chapitre
const { parentPort, workerData } = require('worker_threads');
const PO = require('./paddle-ocr');
if (workerData && workerData.dir) PO.setDir(workerData.dir);
parentPort.on('message', async m => {
  if (!m || m.cmd !== 'read') return;
  try {
    const img = { width: m.width, height: m.height, data: new Uint8Array(m.data) };
    const r = await PO.readBubbles(img, m.opts || {});
    // le tableau des bulles porte aussi des informations (modèle utilisé, qualité, langue…) : envoyées à part
    const extra = {}; for (const k of Object.keys(r)) if (!/^\d+$/.test(k)) extra[k] = r[k];
    parentPort.postMessage({ id: m.id, ok: true, list: Array.from(r), extra });
  } catch (e) { parentPort.postMessage({ id: m.id, ok: false, err: String(e && e.message || e) }); }
});
