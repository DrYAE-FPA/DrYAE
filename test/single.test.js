const { _electron } = require('playwright');
const fs=require('fs'),http=require('http');
const OUT='/tmp/claude-0/shots7';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const vid=fs.readFileSync('/tmp/claude-0/media/clip_audio.mp4');
let hits={};
http.createServer((q,r)=>{
  if(q.url.startsWith('/p')){hits[q.url]=(hits[q.url]||0)+1;r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Page ${q.url}</title><h1>${q.url}</h1><video src="/v.mp4" muted autoplay width=480 height=270></video>`);}
  const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const s=m?+m[1]:0,e=m&&m[2]?+m[2]:vid.length-1;
  r.writeHead(m?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':e-s+1,'Content-Range':`bytes ${s}-${e}/${vid.length}`});r.end(vid.subarray(s,e+1));
}).listen(8870, async()=>{
 const HOME='/tmp/claude-0/uihome7';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const launch=async()=>{const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
   const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.waitForTimeout(1800); return {app,w};};
 const bwin=async app=>{for(let i=0;i<40;i++){const b=app.windows().find(x=>x.url().includes('browser.html')); if(b) return b; await new Promise(r=>setTimeout(r,250));}};
 const nWin=app=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);
 let {app,w}=await launch();
 console.log('1er lancement — fenêtres:', await nWin(app), '| navigateur ouvert ?', !!app.windows().find(x=>x.url().includes('browser.html')));
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8870/p1'));
 let b=await bwin(app); b.on('pageerror',e=>console.log('[brerr]',e.message)); await b.waitForTimeout(1500);
 await b.evaluate(()=>{newTab('http://127.0.0.1:8870/p2');newTab('http://127.0.0.1:8870/p3');}); await b.waitForTimeout(3000);
 console.log('après ouverture du navigateur — fenêtres:', await nWin(app), '| titre:', await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()));
 console.log('compteur du bouton télécharger:', await b.textContent('#dlN'), '| ancien bouton présent ?', !!(await b.$('#bMediaBig')), !!(await b.$('#bMedia')));
 await b.click('#bDrYAE'); await b.waitForTimeout(500); await b.screenshot({path:OUT+'/01-panneau.png'});
 await b.click('#bMenu'); await b.waitForTimeout(300); await b.screenshot({path:OUT+'/02-menu.png'});
 const before={...hits};
 await b.click('#menu button:has-text("Gestionnaire de téléchargements")'); await b.waitForTimeout(800);
 console.log('vue gestionnaire — titre:', await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()));
 await w.screenshot({path:OUT+'/03-gestionnaire.png'});
 await w.click('#openBrowser'); await b.waitForTimeout(1200);
 console.log('retour navigateur : pages rechargées ?', JSON.stringify(before)===JSON.stringify(hits) ? 'non' : 'OUI', hits);
 await app.close();
 // relance : rien ne s'ouvre seul, onglets non chargés tant qu'on n'y entre pas
 hits={};
 ({app,w}=await launch());
 console.log('relance — navigateur ouvert tout seul ?', !!app.windows().find(x=>x.url().includes('browser.html')), '| fenêtres:', await nWin(app));
 await w.evaluate(()=>window.dryae.call('openBrowser')); b=await bwin(app); await b.waitForTimeout(2500);
 console.log('onglets restaurés:', await b.$$eval('.tab .t',x=>x.map(e=>e.textContent)), '| pages chargées:', hits);
 await b.click('.tab:nth-child(1)'); await b.waitForTimeout(1500);
 console.log('après clic sur le 1er onglet:', hits);
 await app.close(); process.exit(0);
});
