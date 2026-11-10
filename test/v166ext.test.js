// 1.6.6 : diagnostic des extensions Chrome 
const { _electron } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'); const OUT = (process.env.TMPH || '/tmp/claude-0') + '/v166'; fs.mkdirSync(OUT, { recursive: true });
const EXT = process.env.EXTDIR;
(async () => {
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/auth')) { r.writeHead(302, { Location: 'https://' + new URL(q.url, 'http://x').searchParams.get('id') + '.chromiumapp.org/cb?code=42' }); return r.end(); } r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end('<!doctype html><html><head><title>T</title></head><body style="font:18px sans-serif;padding:30px"><p id="p">Hello world, this is a simple sentence to translate.</p></body></html>'); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const HOME = (process.env.TMPH || '/tmp/claude-0') + '/uihome-v166ext'; fs.rmSync(HOME, { recursive: true, force: true });
  const UD = HOME + '/.config/DrYAE'; fs.mkdirSync(UD + '/extensions', { recursive: true });
  if (process.env.AUTHSW) { fs.mkdirSync(UD + '/extensions/local-x', { recursive: true }); fs.writeFileSync(UD + '/extensions/local-x/manifest.json', JSON.stringify({ manifest_version: 3, name: 'swauth', version: '1.0', background: { service_worker: 'bg.js' }, permissions: ['identity'] })); fs.writeFileSync(UD + '/extensions/local-x/bg.js', "setTimeout(() => (globalThis.browser || chrome).identity.launchWebAuthFlow({ url: '" + base + "/auth?id=' + chrome.runtime.id, interactive: true }).then(u => console.log('SWAUTH OK ' + u), e => console.log('SWAUTH ERR ' + e.message)), 3000);"); }
  else fs.cpSync(EXT, UD + '/extensions/local-x', { recursive: true });
  fs.writeFileSync(UD + '/settings.json', JSON.stringify({ lang: 'fr', langChosen: true }));
  const app = await _electron.launch({ chromiumSandbox: !!process.env.SANDBOX, args: process.env.SANDBOX ? ['.'] : ['.', '--no-sandbox'], cwd: ROOT, executablePath: ROOT + '/node_modules/electron/dist/electron', env: { ...process.env, HOME, XDG_CONFIG_HOME: HOME + '/.config' } });
  app.process().stdout.on('data', d => process.stdout.write('[main] ' + d)); app.process().stderr.on('data', d => { const s = String(d); if (/extension|Error|error/i.test(s)) process.stdout.write('[mainerr] ' + s); });
  await app.evaluate(({ session }) => { const s = session.fromPartition('persist:dryae-web'); s.serviceWorkers.on('console-message', (e, d) => console.log('[sw]', JSON.stringify(d || e).slice(0, 400))); console.log('[preloads]', JSON.stringify(s.getPreloadScripts ? s.getPreloadScripts() : s.getPreloads())); });
  const w = await app.firstWindow(); await w.waitForTimeout(1500);
  await w.evaluate(u => window.dryae.call('openBrowser', u), base + '/');
  let b; for (let i = 0; i < 40 && !b; i++) { b = app.windows().find(x => x.url().includes('browser.html')); await new Promise(r => setTimeout(r, 250)); }
  let pg; for (let i = 0; i < 40 && !pg; i++) { pg = app.windows().find(x => x.url().startsWith(base)); await new Promise(r => setTimeout(r, 250)); }
  await pg.waitForTimeout(2500);
  console.log('reload', await app.evaluate(async ({ session }) => { const s = session.fromPartition('persist:dryae-web'); const X = s.extensions || s; const e = X.getAllExtensions()[0]; X.removeExtension(e.id); await new Promise(r => setTimeout(r, 500)); await X.loadExtension(e.path, { allowFileAccess: true }); return e.id; }));
  await pg.waitForTimeout(2500);
  console.log('exts', JSON.stringify(await b.evaluate(() => EXTS.map(x => [x.id, x.name, x.enabled, x.popup]))));
  // journal de toutes les pages d'extension
  await app.evaluate(({ app }) => { app.on('web-contents-created', (_e, wc) => { wc.on('console-message', (e) => { const m = e.message || ''; if (/chrome-extension/.test(wc.getURL())) console.log('[ext-console]', wc.getURL().slice(0, 70), m.slice(0, 300)); }); }); });
  // sélectionner le texte
  await pg.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById('p')); getSelection().addRange(r); });
  const id = await b.evaluate(() => EXTS[0].id);
  await b.evaluate(id => activateExt(id, $('#bExt')), id); await b.waitForTimeout(5000);
  const info = await app.evaluate(async ({ BrowserWindow, webContents }) => { const p = BrowserWindow.getAllWindows().find(x => /^chrome-extension:/.test(x.webContents.getURL())); if (!p) return { none: webContents.getAllWebContents().map(w => w.getURL().slice(0, 80)) }; return { url: p.webContents.getURL(), b: p.getBounds(), vis: p.isVisible(), text: await p.webContents.executeJavaScript('document.body ? document.body.innerText.slice(0, 500) : ""').catch(e => String(e)), identity: await p.webContents.executeJavaScript('[typeof chrome.identity, typeof (globalThis.browser && browser.identity), chrome.identity && chrome.identity.getRedirectURL()].join(" ")').catch(e => String(e)) }; });
  console.log('popup', JSON.stringify(info, null, 1));
  if (process.env.AUTHTEST) console.log('auth', await app.evaluate(async ({ BrowserWindow, session }, u) => { const pp = BrowserWindow.getAllWindows().find(x => /^chrome-extension:/.test(x.webContents.getURL())); const url = pp.webContents.getURL(); const p = new BrowserWindow({ show: true, webPreferences: { session: session.fromPartition('persist:dryae-web'), sandbox: true, contextIsolation: true } }); await p.loadURL(url); await new Promise(r => setTimeout(r, 1500)); const t0 = Date.now(); const out = await p.webContents.executeJavaScript(`browser.identity.launchWebAuthFlow({ url: '${u}/auth?id=' + chrome.runtime.id, interactive: true }).then(x => 'OK ' + x, e => 'ERR ' + e.message)`); return out + ' (' + (Date.now() - t0) + ' ms, fenêtres: ' + BrowserWindow.getAllWindows().length + ')'; }, base));
  const p = app.windows().find(x => /^chrome-extension:/.test(x.url()));
  if (p) await p.screenshot({ path: OUT + '/ext-popup.png' }).catch(() => {});
  await app.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
