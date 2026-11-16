// lancé par test/v170ai.test.js dans Electron : appels à un faux service IA local
const { app } = require('electron'); const http = require('http'); const path = require('path');
app.whenReady().then(async () => {
  const M = require(path.join(__dirname, '..', '..', 'src', 'main', 'modules.js'));
  const out = []; let n = 0;
  const srv = http.createServer((q, r) => {
    let b = ''; q.on('data', d => (b += d)); q.on('end', () => {
      n++;
      if (/hang/.test(q.url)) return; // ne répond jamais
      if (/thinkonly/.test(q.url) && /thinkingBudget/.test(b)) { r.statusCode = 400; return r.end('{"error":{"message":"Unknown name \\"thinkingBudget\\""}}'); }
      if (/minute/.test(q.url) && n === 1) { r.statusCode = 429; return r.end('{"error":{"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"1s"}]}}'); }
      if (/day/.test(q.url)) { r.statusCode = 429; return r.end('{"error":{"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}'); }
      if (/busyall/.test(q.url) || (/busyonce/.test(q.url) && n === 1) || (/busyalt/.test(q.url) && !/gemini-2\.5-flash:/.test(q.url))) { r.statusCode = 503; return r.end('{"error":{"code":503,"message":"The model is overloaded."}}'); }
      if (/badkey/.test(q.url)) { r.statusCode = 400; return r.end('{"error":{"message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID"}]}}'); }
      if (/models\?/.test(q.url)) { r.statusCode = q.headers['x-goog-api-key'] === 'AIzaGOOD' ? 200 : 400; return r.end('{}'); }
      r.setHeader('Content-Type', 'application/json');
      r.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ source_language: 'en', items: [{ i: 1, text: 'HELLO', tr: 'BONJOUR' }] }) }] } }] }));
    });
  }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const base = p => `http://127.0.0.1:${srv.address().port}/${p}`;
  const run = async (name, p, extra = {}) => { n = 0; const t = Date.now(); try { const r = await M.aiScan(Buffer.from('x'), 'image/png', ['HELLO'], 'fr', { key: 'k', url: base(p), ...extra }); out.push({ name, ok: true, tr: r.texts[0], ms: Date.now() - t, calls: n }); } catch (e) { out.push({ name, ok: false, err: e.message, quota: !!e.quota, minute: !!e.minute, badKey: !!e.badKey, busy: !!e.busy, ms: Date.now() - t }); } };
  await run('normal', 'ok');
  await run('hang', 'hang', { timeout: 1500 });
  await run('thinking', 'thinkonly', { model: 'm2' });
  await run('minute', 'minute', { model: 'm3' });
  await run('day', 'day', { model: 'm4' });
  await run('badkey', 'badkey', { model: 'm5' });
  await run('busyonce', 'busyonce', { model: 'm6' });
  await run('busyalt', 'busyalt', { model: 'm7' });
  await run('busyall', 'busyall', { model: 'm8' });
  out.push({ name: 'check-good', ...(await M.aiCheck('AIzaGOOD', base('x'))) });
  out.push({ name: 'check-bad', ...(await M.aiCheck('AIzaBAD', base('x'))) });
  console.log('RESULT ' + JSON.stringify(out));
  srv.close(); app.quit();
});
