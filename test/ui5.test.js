const { _electron } = require('playwright');
const fs=require('fs'),http=require('http');
const OUT='/tmp/claude-0/shots6';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const vid=fs.readFileSync('/tmp/claude-0/media/clip_audio.mp4');
http.createServer((q,r)=>{
  if(q.url.startsWith('/film')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Mon film de vacances</title><body style="background:#222;color:#eee"><h2>Lecteur</h2><video src="/media/vacances.mp4" controls muted autoplay width=720 height=405></video></body>`);}
  if(q.url.startsWith('/login')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Connexion</title><form action="/ok" method="post"><input name="user" id="u" type="email" placeholder="E-mail"><input type="password" id="p" name="pass"><button id="go">Se connecter</button></form>`);}
  if(q.url.startsWith('/ok')){r.setHeader('Content-Type','text/html');return r.end('<title>Bienvenue</title><h1>OK</h1>');}
  if(q.url.startsWith('/inscription')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Inscription</title><form><label for=a>Prénom</label><input id=a name="prenom"><label for=b>Nom</label><input id=b name="nom"><input id=c name="email" type=email placeholder="E-mail"><input id=d name="ville" placeholder="Ville"></form>`);}
  const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const s=m?+m[1]:0,e=m&&m[2]?+m[2]:vid.length-1;
  r.writeHead(m?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':e-s+1,'Content-Range':`bytes ${s}-${e}/${vid.length}`});r.end(vid.subarray(s,e+1));
}).listen(8860, async()=>{
 const HOME='/tmp/claude-0/uihome5';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME+'/.config/DrYAE/extensions',{recursive:true});
 fs.cpSync('/tmp/claude-0/testext',HOME+'/.config/DrYAE/extensions/local-testext',{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 app.process().stderr.on('data',d=>{const s=String(d);if(/error|Error/.test(s)&&!/bus.cc|gpu|GLES|viz|Fontconfig|vaapi|ALSA|dbus|sandbox/i.test(s))process.stderr.write('[main] '+s.slice(0,300))});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.waitForTimeout(1500);
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8860/film'));
 let b;for(let i=0;i<40&&!b;i++){await w.waitForTimeout(250);b=app.windows().find(x=>x.url().includes('browser.html'));}
 b.on('pageerror',e=>console.log('[brerr]',e.message)); await b.setViewportSize({width:1300,height:820}); await b.waitForTimeout(3500);
 // 1. panneau universel
 await b.click('#bDrYAE'); await b.waitForTimeout(400); await b.click('#pBody .dfile'); await b.waitForTimeout(9000);
 console.log('panneau:', (await b.textContent('#qsBody')).replace(/\s+/g,' ').slice(0,200));
 await b.click('#qsMore'); await b.waitForTimeout(300); await b.screenshot({path:OUT+'/01-universel.png'});
 await b.fill('#qaName','Vacances 2026'); await b.click('#qsBody .qopt[data-f="mp3"][data-b="192"]'); await b.waitForTimeout(500);
 console.log('fenêtre principale visible ?', await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().filter(x=>x.isFocused()).map(x=>x.getTitle())));
 // 2. fichier simple depuis le navigateur
 await b.evaluate(()=>window.br.call('br:download',{url:'http://127.0.0.1:8860/media/rapport.mp4',page:'http://127.0.0.1:8860/film'})); await b.waitForTimeout(1500);
 await b.screenshot({path:OUT+'/02-fichier.png'}); console.log('fichier:', await b.textContent('#qsTitle'), '|', await b.textContent('#qsMeta'));
 await b.click('#qfGo'); await b.waitForTimeout(500);
 // 3. mot de passe : enregistrement puis remplissage
 await b.evaluate(()=>navigate(cur,'http://127.0.0.1:8860/login')); await b.waitForTimeout(2000);
 await b.evaluate(()=>cur.wv.executeJavaScript(`document.getElementById('u').value='moi@exemple.com';document.getElementById('p').value='Secret123!';document.getElementById('go').click()`)); await b.waitForTimeout(1500);
 console.log('barre mot de passe:', await b.evaluate(()=>document.querySelector('#pwBar').classList.contains('on')), (await b.textContent('#pwBar span')));
 await b.screenshot({path:OUT+'/03-pwbar.png'});
 await b.click('#pwSave'); await b.waitForTimeout(300);
 await b.evaluate(()=>navigate(cur,'http://127.0.0.1:8860/login?2')); await b.waitForTimeout(2500);
 console.log('remplissage auto:', await b.evaluate(()=>cur.wv.executeJavaScript(`document.getElementById('u').value+' / '+document.getElementById('p').value`)));
 // 4. saisie automatique
 await b.evaluate(()=>window.br.call('br:afSet',{enabled:true,profile:{givenName:'Awa',familyName:'Koné',email:'awa@exemple.com',city:'Abidjan'}}));
 await b.evaluate(()=>navigate(cur,'http://127.0.0.1:8860/inscription')); await b.waitForTimeout(2000);
 const box=await b.evaluate(()=>{const r=cur.wv.getBoundingClientRect();return {x:r.x,y:r.y}});
 await b.evaluate(()=>cur.wv.focus()); await b.evaluate(()=>cur.wv.executeJavaScript(`document.getElementById('a').focus()`)); await b.waitForTimeout(800);
 await b.screenshot({path:OUT+'/04-autofill.png'});
 const pos=await b.evaluate(()=>cur.wv.executeJavaScript(`(()=>{const r=document.getElementById('a').getBoundingClientRect();return {x:r.left+20,y:r.bottom+30}})()`));
 await b.mouse.click(box.x+pos.x, box.y+pos.y); await b.waitForTimeout(500);
 console.log('formulaire:', await b.evaluate(()=>cur.wv.executeJavaScript(`[...document.querySelectorAll('input')].map(i=>i.value).join(' | ')`)));
 // 5. extension
 console.log('extensions:', JSON.stringify(await b.evaluate(()=>window.br.call('br:extList'))).slice(0,200));
 console.log('script de l\'extension dans la page:', await b.evaluate(()=>cur.wv.executeJavaScript(`document.documentElement.dataset.extTest||'absent'`)));
 await b.evaluate(()=>togglePanel('extensions',true)); await b.waitForTimeout(600); await b.screenshot({path:OUT+'/05-extensions.png'});
 await b.waitForTimeout(6000);
 const L=await w.evaluate(()=>window.dryae.call('list')); L.forEach(d=>console.log(' ',d.type,d.status,d.name,d.formatLabel||'',d.error||''));
 await app.close(); process.exit(0);
});
