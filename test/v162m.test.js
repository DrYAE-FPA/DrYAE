const { _electron } = require('playwright');
const fs=require('fs'),http=require('http');
const OUT='/tmp/claude-0/shots162'; fs.mkdirSync(OUT,{recursive:true});
const big=fs.readFileSync('/tmp/claude-0/t/big.bin');
http.createServer((q,r)=>{ r.setHeader('Content-Type','application/octet-stream'); r.end(big.subarray(0,200000+ (q.url.length*1000))); }).listen(8892, async()=>{
 const HOME='/tmp/claude-0/uihome162';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME+'/.config/DrYAE',{recursive:true});
 fs.writeFileSync(HOME+'/.config/DrYAE/settings.json',JSON.stringify({lang:'fr',langChosen:true,v161:true,duplicate:'rename'}));
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.setViewportSize({width:1400,height:860}).catch(()=>{}); await w.waitForTimeout(1500);
 const names=['Rapport annuel.pdf','Vacances plage.jpg','Musique fete.mp3','Film maison.mp4','Archive photos.zip','Notes cours.docx'];
 for(const n of names) await w.evaluate(o=>window.dryae.call('add',{urls:['http://127.0.0.1:8892/'+encodeURIComponent(o)],name:o,startNow:true}),n);
 await w.waitForTimeout(4000);
 for (const v of ['details','list','icons-l','icons-m','content']) { await w.evaluate(v=>setView(v),v); await w.waitForTimeout(300); await w.screenshot({path:`${OUT}/view-${v}.png`}); }
 await w.evaluate(()=>setView('details'));
 await w.click('.dhead [data-sort="name"]'); await w.waitForTimeout(200);
 console.log('tri par nom :', (await w.$$eval('.item .name',x=>x.map(e=>e.textContent))).join(' | '));
 // clic simple = sélection sans volet ; double-clic = ouvrir
 await w.click('.item >> nth=0'); await w.waitForTimeout(200); console.log('clic simple -> volet ouvert ?', await w.evaluate(()=>document.querySelector('#drawer').classList.contains('on')), '| sélectionnés', await w.$$eval('.item.sel',x=>x.length));
 // lasso
 const box=await w.$eval('#list',e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
 const it=await w.$$eval('.item',x=>x.map(e=>{const r=e.getBoundingClientRect();return {y:r.top+r.height/2,b:r.bottom};}));
 await w.mouse.move(box.x+box.w-40, it[1].y); await w.mouse.down(); await w.mouse.move(box.x+box.w-60, it[3].y, {steps:5}); await w.mouse.up(); await w.waitForTimeout(200);
 console.log('rectangle de sélection :', await w.$$eval('.item.sel',x=>x.length), '| barre d\'état :', (await w.textContent('#sbar')).replace(/\s+/g,' '));
 await w.screenshot({path:OUT+'/lasso.png'});
 // clavier Windows
 await w.keyboard.press('Control+a'); console.log('Ctrl+A :', await w.$$eval('.item.sel',x=>x.length));
 await w.keyboard.press('Escape'); await w.keyboard.press('ArrowDown'); await w.keyboard.press('Alt+Enter'); await w.waitForTimeout(300); console.log('Alt+Entrée -> propriétés :', await w.evaluate(()=>document.querySelector('#drawer').classList.contains('on')));
 await w.keyboard.press('Escape'); await w.waitForTimeout(100);
 await w.keyboard.press('Control+Shift+Digit2'); await w.waitForTimeout(200); console.log('Ctrl+Maj+2 :', await w.evaluate(()=>VIEW));
 await w.keyboard.press('Control+Shift+Digit6');
 const n0=await w.$$eval('.item',x=>x.length); await w.click('.item >> nth=0'); await w.keyboard.press('Delete'); await w.waitForTimeout(400);

 const n1=await w.$$eval('.item',x=>x.length); await w.keyboard.press('Control+z'); await w.waitForTimeout(800); const n2=await w.$$eval('.item',x=>x.length);
 console.log('Suppr puis Ctrl+Z :', n0,'->',n1,'->',n2);
 await w.click('.item >> nth=0', {button:'right'}); await w.waitForTimeout(200); await w.keyboard.press('Escape');
 await w.mouse.click(box.x+box.w-30, box.y+box.h-30, {button:'right'}); await w.waitForTimeout(200); console.log('menu clic droit dans le vide :', (await w.$$eval('#menu button',x=>x.length))); await w.screenshot({path:OUT+'/bgmenu.png'}); await w.keyboard.press('Escape');
 await w.keyboard.press('F1'); await w.waitForTimeout(200); console.log('F1 :', await w.evaluate(()=>document.querySelectorAll('.kbd-list div').length));
 await app.close(); process.exit(0);
});
