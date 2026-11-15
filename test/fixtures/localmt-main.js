// lancé par test/v170localmt.test.js dans Electron : « Traduction sur le PC » avec les vrais modèles (CI seulement :
// l'environnement de Claude ne peut pas les télécharger). Phrases écrites pour le test (aucune page privée).
const { app } = require('electron'); const path = require('path'); const fs = require('fs'); const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'dryae-lmt-')));
app.whenReady().then(async () => {
  const L = require(path.join(__dirname, '..', '..', 'src', 'main', 'local-mt.js'));
  const out = {};
  try { await L.records(); } catch (e) { console.log('RESULT ' + JSON.stringify({ skip: e.message })); return app.quit(); }
  const EN = ["Where are you going?", "I told you not to touch it!", "We have to find the village before nightfall.", "Thank you for saving me.", "Is this really the best idea you have?", "Don't worry, I'll protect you.", "The witch prepared a strange potion.", "Go ahead, I'm right behind you!"];
  const JA = ["ありがとう", "どこへ行くの？", "大丈夫、私が守る！", "早く逃げて！"];
  const run = async (k, texts, to, from) => { const t0 = Date.now(); try { const r = await L.translate(texts, to, from); out[k] = { ms: Date.now() - t0, from: r.from, pivot: r.pivot, texts: r.texts }; } catch (e) { out[k] = { error: e.message, ms: Date.now() - t0 }; } };
  await run('enfr_first', EN, 'fr', 'auto');      // premier appel : téléchargement + chargement du modèle
  await run('enfr_again', EN, 'fr', 'auto');      // modèle déjà chargé : vitesse réelle
  await run('jafr', JA, 'fr', 'auto');            // japonais → anglais → français
  await run('enes', EN.slice(0, 3), 'es', 'en');
  out.installed = L.installed(); out.size = L.sizeOnDisk();
  out.detect = { fr: L.detect('Je ne sais pas ce que tu veux dire.'), en: L.detect('I do not know what you mean.'), ja: L.detect('ありがとう'), ko: L.detect('고마워') };
  console.log('RESULT ' + JSON.stringify(out));
  L.stop(); app.quit();
});
