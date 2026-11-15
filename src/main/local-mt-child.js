// DrYAE — processus de la « Traduction sur le PC » (moteur fxtranslate, licence MPL-2.0).
// Reçoit les fichiers des modèles et les textes, renvoie les traductions. Les moteurs chargés sont gardés
// (3 au plus) pour que les pages suivantes soient traduites tout de suite.
const fs = require('fs'); const path = require('path');
const FX = path.dirname(require.resolve('fxtranslate'));
const { Translator } = require(path.join(FX, '..', 'wasm', 'fxtranslate_wasm.js'));
const engines = new Map();
function engine(files) {
  const k = files.model;
  if (engines.has(k)) { const e = engines.get(k); engines.delete(k); engines.set(k, e); return e; }
  const rd = p => new Uint8Array(fs.readFileSync(p));
  const sv = rd(files.srcVocab), tv = files.trgVocab === files.srcVocab ? sv : rd(files.trgVocab);
  const e = new Translator(rd(files.model), sv, tv);
  engines.set(k, e);
  while (engines.size > 3) { const [old, eo] = engines.entries().next().value; engines.delete(old); try { eo.free(); } catch {} }
  return e;
}
process.parentPort.on('message', ({ data: m }) => {
  try {
    if (m.cmd !== 'translate') return;
    const eng = m.legs.map(engine);
    const texts = m.texts.map(t => {
      if (!String(t || '').trim()) return t;
      // chaque ligne garde sa place (une bulle peut avoir plusieurs phrases)
      return eng.reduce((x, e) => e.translate_long(x), String(t));
    });
    process.parentPort.postMessage({ id: m.id, texts });
  } catch (e) { process.parentPort.postMessage({ id: m.id, error: String(e && e.message || e) }); }
});
