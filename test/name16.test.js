const { _electron } = require('playwright');
const fs=require('fs'),http=require('http'),path=require('path');
const OUT='/tmp/claude-0/shots16';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
http.createServer((q,r)=>{
  if(q.url.startsWith('/ep')){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Fallout S2 E6 - MonSite streaming VF</title><h1>ep</h1>`);}
  const f=path.join('/tmp/claude-0/hlsv',q.url.split('?')[0]); if(!fs.existsSync(f)){r.statusCode=404;return r.end();}
  r.setHeader('Content-Type',f.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'); r.end(fs.readFileSync(f));
}).listen(8890, async()=>{
 const HOME='/tmp/claude-0/uihome16';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.waitForTimeout(1500);
 await w.setViewportSize({width:1600,height:860}).catch(()=>{});
 console.log('version affichée:', await w.textContent('#ver'), '| badge TEST ?', (await w.content()).includes('>TEST<'));
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8890/ep6'));
 let b; for(let i=0;i<40&&!b;i++){ b=app.windows().find(x=>x.url().includes('browser.html')); await new Promise(r=>setTimeout(r,250)); }
 await b.waitForTimeout(2500);
 const r=await b.evaluate(()=>B.call('br:quickAdd',{url:'http://127.0.0.1:8890/master.m3u8?t=abc&s=123',page:'http://127.0.0.1:8890/ep6',name:'master.m3u8',kind:'hls'}));
 console.log('nom à l\'ajout:', r && r.name);
 // 25 éléments pour tester la barre latérale
 for(let i=0;i<25;i++) await b.evaluate(i=>B.call('br:quickAdd',{url:'http://127.0.0.1:8890/master.m3u8?n='+i,page:'http://127.0.0.1:8890/ep6',kind:'hls',startNow:false}),i);
 await b.evaluate(()=>B.call('br:openMain')); await w.waitForTimeout(6000);
 const names=await w.$$eval('.item .name',x=>x.slice(0,3).map(e=>e.textContent));
 console.log('noms affichés:', names);
 const foot=await w.evaluate(()=>{const r=document.querySelector('.side-foot').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight};});
 console.log('pied de la barre latérale:', foot, foot.bottom<=foot.vh?'VISIBLE':'CACHÉ');
 await w.screenshot({path:OUT+'/main.png'});
 const done=await w.evaluate(async()=>{const l=await window.dryae.call('list');const d=l.find(x=>x.status==='done');return d&&{name:d.name,file:d.file,activeMs:d.activeMs,id:d.id};});
 console.log('terminé:', done);
 if(done){ await w.click(`.item[data-id="${done.id}"]`).catch(()=>{}); await w.waitForTimeout(1500); console.log('infos:', (await w.textContent('#dBody')).replace(/\s+/g,' ').slice(0,400)); await w.screenshot({path:OUT+'/info.png'}); }
 await app.close(); process.exit(0);
});
