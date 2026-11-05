const { _electron } = require('playwright');
const fs=require('fs'),http=require('http');
const OUT='/tmp/claude-0/shots3';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const vid=fs.readFileSync('/tmp/claude-0/media/clip_audio.mp4');
const HOME='/tmp/claude-0/uihome3';
const srv=http.createServer((q,r)=>{
  if(q.url.startsWith('/page')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Page ${q.url}</title><h1>Page ${q.url}</h1><video src="/v.mp4" muted autoplay></video>`);}
  const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const s=m?+m[1]:0,e=m&&m[2]?+m[2]:vid.length-1;
  r.writeHead(m?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':e-s+1,'Content-Range':`bytes ${s}-${e}/${vid.length}`});r.end(vid.subarray(s,e+1));
});
const launch=async()=>{const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.setViewportSize({width:1300,height:800}); await w.waitForTimeout(1500); return {app,w};};
const brWin=async app=>{let b;for(let i=0;i<40&&!b;i++){await new Promise(r=>setTimeout(r,250));b=app.windows().find(x=>x.url().includes('browser.html'));} if(b){b.on('pageerror',e=>console.log('[brerr]',e.message));await b.setViewportSize({width:1300,height:800});} return b;};
(async()=>{
 await new Promise(r=>srv.listen(8810,r));
 fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 let {app,w}=await launch();
 // 1. vidéo en ligne via le menu
 await w.click('#addMenuBtn'); await w.click('#menu button:has-text("Vidéo d\'un site")');
 await w.fill('#aUrls','http://127.0.0.1:8810/films/Sintel_extrait.mp4'); await w.waitForTimeout(6000);
 await w.click('#aYtSeg [data-v="mp3"]'); await w.waitForTimeout(200);
 await w.screenshot({path:OUT+'/01-ytdl-add.png'});
 await w.click('#aYtSeg [data-v="video"]'); await w.click('#aOk'); await w.waitForTimeout(500);
 for(const n of ['a','b','c']){ await w.click('#addBtn'); await w.fill('#aUrls',`http://127.0.0.1:8810/files/fichier_${n}.mp4`); await w.waitForTimeout(400); await w.click('#aOk'); await w.waitForTimeout(300);}
 await w.waitForTimeout(6000);
 // 2. sélection multiple
 await w.click('#selBtn'); await w.waitForTimeout(200);
 const chks=await w.$$('.item [data-chk]'); await chks[0].click(); await chks[1].click(); await w.waitForTimeout(300);
 await w.screenshot({path:OUT+'/02-select.png'});
 await w.click('[data-bulk="remove"]'); await w.waitForTimeout(300); await w.screenshot({path:OUT+'/03-remove-dialog.png'});
 await w.click('#pModal [data-close]').catch(()=>{});
 await w.click('[data-bulk="none"]');
 // 3. thème clair
 await w.click('#themeBtn'); await w.waitForTimeout(400); await w.screenshot({path:OUT+'/04-light.png'});
 // 4. navigateur : historique, suggestions, onglets
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8810/page-un'));
 let b=await brWin(app); await b.waitForTimeout(2000);
 await b.click('#url'); await b.keyboard.type('http://127.0.0.1:8810/page-deux'); await b.keyboard.press('Enter'); await b.waitForTimeout(1500);
 await b.evaluate(()=>newTab('http://127.0.0.1:8810/page-trois')); await b.waitForTimeout(1500);
 await b.click('#url'); await b.fill('#url',''); await b.keyboard.type('page'); await b.waitForTimeout(700);
 await b.screenshot({path:OUT+'/05-suggest.png'});
 console.log('suggestions', await b.$$eval('#sug button', x=>x.map(e=>e.textContent.trim().slice(0,60))));
 await b.keyboard.press('Escape');
 // extension : serveur local
 const ping=async origin=>new Promise(res=>{const rq=http.get({host:'127.0.0.1',port:47321,path:'/ping',headers:origin?{Origin:origin}:{}},rr=>{let d='';rr.on('data',c=>d+=c);rr.on('end',()=>res(rr.statusCode+' '+d))});rq.on('error',e=>res('ERR '+e.message));});
 console.log('ext ok:', await ping('chrome-extension://pbgpfnhoilokfcjmfamemnjaddkpmmhf'));
 console.log('site refusé:', await ping('https://site-malveillant.com'));
 console.log('sans origine:', await ping(null));
 const L=await w.evaluate(()=>window.dryae.call('list')); L.forEach(d=>console.log(' ',d.type,d.status,d.name,d.error||''));
 await app.close();
 // 5. relance : onglets et fenêtres restaurés
 ({app,w}=await launch());
 b=await brWin(app);
 if(!b) console.log('navigateur NON restauré'); else { await b.waitForTimeout(1500); console.log('onglets restaurés', await b.$$eval('.tab .t', x=>x.map(e=>e.textContent))); await b.screenshot({path:OUT+'/06-restored.png'}); }
 console.log('thème conservé', await w.evaluate(()=>document.documentElement.dataset.mode));
 await app.close(); process.exit(0);
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
