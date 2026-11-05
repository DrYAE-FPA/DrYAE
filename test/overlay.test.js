const { _electron } = require('playwright');
const http=require('http'),fs=require('fs');
const OUT='/tmp/claude-0/shots4';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const vid=fs.readFileSync('/tmp/claude-0/media/clip_audio.mp4');
(async()=>{
 http.createServer((q,r)=>{
  if(q.url==='/'||q.url.startsWith('/watch')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Ma vidéo de test - Lecteur</title><body style="margin:0;background:#111;color:#eee;font-family:sans-serif"><h2 style="padding:10px">Lecteur de test</h2><video src="/media/clip.mp4" controls autoplay muted style="width:854px;height:480px;margin-left:20px;background:#000"></video><iframe src="/frame" width=300 height=80></iframe>
  <script>window.FP={chrome:typeof window.chrome, keys:window.chrome?Object.keys(window.chrome):[], csi:typeof (window.chrome&&window.chrome.csi), webdriver:navigator.webdriver, notif:Notification.permission, langs:navigator.languages, ua:navigator.userAgent, brands:navigator.userAgentData.brands.map(b=>b.brand+' '+b.version)}</script>`);}
  if(q.url==='/frame'){r.setHeader('Content-Type','text/html');return r.end('<script>let o;try{o={frameChrome: typeof (window.chrome&&window.chrome.csi), wd: navigator.webdriver}}catch(e){o={err:e.message}};parent.postMessage(o,"*")</script>');}
  const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const s=m?+m[1]:0,e=m&&m[2]?+m[2]:vid.length-1;
  r.writeHead(m?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':e-s+1,'Content-Range':`bytes ${s}-${e}/${vid.length}`});r.end(vid.subarray(s,e+1));
 }).listen(8830);
 const HOME='/tmp/claude-0/ovhome';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 app.process().stderr.on('data',d=>{const s=String(d);if(/Error|error/.test(s)&&!/bus.cc|gpu|GLES|viz|Fontconfig|vaapi|ALSA|openssl|dbus/i.test(s))process.stderr.write('[main] '+s)});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.waitForTimeout(1500);
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8830/watch?v=test'));
 let b;for(let i=0;i<40&&!b;i++){await w.waitForTimeout(250);b=app.windows().find(x=>x.url().includes('browser.html'));}
 b.on('pageerror',e=>console.log('[brerr]',e.message)); await b.setViewportSize({width:1300,height:800});
 await b.waitForTimeout(4000);
 const fp=await b.evaluate(async()=>{const wv=document.querySelector('webview.on');return await wv.executeJavaScript(`new Promise(r=>{const out=window.FP; addEventListener('message',e=>{out.frame=e.data;r(JSON.stringify(out))}); setTimeout(()=>r(JSON.stringify(out)),1500); document.querySelector('iframe').src='/frame?'+Date.now();})`)});
 console.log('empreinte', fp);
 await b.screenshot({path:OUT+'/01-overlay.png'});
 // clic sur le bouton injecté : on vise le coin haut-droit de la vidéo
 const box=await b.evaluate(()=>{const wv=document.querySelector('webview.on').getBoundingClientRect();return {x:wv.x,y:wv.y}});
 await b.mouse.click(box.x+728, box.y+118).catch(()=>{});
 await b.waitForTimeout(800);
 let open=await b.evaluate(()=>document.querySelector('#qs').classList.contains('on'));
 if(!open){ console.log('clic direct raté, appel programmatique'); await b.evaluate(()=>openQuick(cur,{page:cur.url,src:'http://127.0.0.1:8830/media/clip.mp4',title:cur.title,duration:20})); await b.waitForTimeout(400);}
 await b.screenshot({path:OUT+'/02-quick-direct.png'});
 await b.click('[data-ana]'); await b.waitForTimeout(7000);
 await b.screenshot({path:OUT+'/03-quick-formats.png'});
 await b.click('.qopt[data-f="mp3"][data-b="320"]'); await b.waitForTimeout(500);
 await b.screenshot({path:OUT+'/04-toast.png'});
 for(let i=0;i<40;i++){const L=await w.evaluate(()=>window.dryae.call('list')); if(L.length&&L.every(d=>['done','error'].includes(d.status)))break; await w.waitForTimeout(1000);}
 const L=await w.evaluate(()=>window.dryae.call('list')); L.forEach(d=>console.log(d.type,d.status,d.name,d.formatLabel||'',d.error||''));
 // fenêtre principale : boutons de format
 await w.click('#addMenuBtn'); await w.click('#menu button:has-text("Vidéo d\'un site")'); await w.fill('#aUrls','http://127.0.0.1:8830/media/autre.mp4'); await w.waitForTimeout(6000);
 await w.click('#aYtSeg [data-v="mp3"]'); await w.waitForTimeout(200); await w.screenshot({path:OUT+'/05-main-seg.png'});
 await app.close(); process.exit(0);
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
