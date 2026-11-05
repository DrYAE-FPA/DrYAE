const { _electron } = require('playwright');
const fs=require('fs'),http=require('http');
const OUT='/tmp/claude-0/shots5';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const big=Buffer.alloc(3*1024*1024,7);
http.createServer((q,r)=>{
  if(q.url.startsWith('/page')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Page ${q.url}</title><h1>${q.url}</h1><a href="/f/rapport.pdf">Rapport</a> <a href="/f/archive.zip">Archive</a> <a href="/f/setup.exe">Setup</a>`);}
  const n=q.url.includes('rapport')?512000:q.url.includes('archive')?2*1024*1024:big.length;
  r.writeHead(q.headers.range?206:200,{'Content-Type':'application/octet-stream','Content-Range':`bytes 0-0/${n}`,'Content-Length':q.headers.range?1:n});r.end(q.headers.range?'x':big.subarray(0,n));
}).listen(8850, async()=>{
 const HOME='/tmp/claude-0/uihome4';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.setViewportSize({width:1300,height:800}); await w.waitForTimeout(1200);
 // tailles de plusieurs liens
 await w.click('#addBtn'); await w.fill('#aUrls','http://127.0.0.1:8850/f/rapport.pdf\nhttp://127.0.0.1:8850/f/archive.zip\nhttp://127.0.0.1:8850/f/setup.exe'); await w.waitForTimeout(2000);
 console.log('total:', await w.textContent('#aInfo'));
 await w.screenshot({path:OUT+'/01-sizes.png'}); await w.keyboard.press('Escape');
 // navigateur : 3 onglets, glisser le 3e en premier
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8850/page-A'));
 let b;for(let i=0;i<40&&!b;i++){await w.waitForTimeout(250);b=app.windows().find(x=>x.url().includes('browser.html'));}
 b.on('pageerror',e=>console.log('[brerr]',e.message)); await b.setViewportSize({width:1300,height:800}); await b.waitForTimeout(1500);
 await b.evaluate(()=>{newTab('http://127.0.0.1:8850/page-B');newTab('http://127.0.0.1:8850/page-C');}); await b.waitForTimeout(1500);
 await b.locator('.tab').nth(2).dragTo(b.locator('.tab').nth(0),{targetPosition:{x:10,y:10}}); await b.waitForTimeout(500);
 console.log('ordre après glisser:', await b.$$eval('.tab .t',x=>x.map(e=>e.textContent)));
 // extraction des liens + tailles
 await b.evaluate(()=>grabLinks()); await b.waitForTimeout(700); await b.click('#gSz'); await b.waitForTimeout(1500);
 await b.click('#gAll'); await b.waitForTimeout(200);
 console.log('bouton:', await b.textContent('#gDl'));
 await b.screenshot({path:OUT+'/02-grab-sizes.png'});
 await app.close(); process.exit(0);
});
