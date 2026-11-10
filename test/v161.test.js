const { _electron } = require('playwright');
const fs=require('fs'),http=require('http'),path=require('path');
const OUT='/tmp/claude-0/shots161'; fs.mkdirSync(OUT,{recursive:true});
const big=fs.readFileSync('/tmp/claude-0/t/big.bin');
http.createServer((q,r)=>{
  const u=q.url.split('?')[0];
  if(u==='/ep'){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><title>Série S1 E3 - Exemple streaming</title><h1>ep</h1><a id="tor" href="/pack.torrent">torrent</a> <a href="/doc.pdf">pdf</a><script>fetch('/hls/master.m3u8')</script>`);}
  if(u==='/pack.torrent'){r.setHeader('Content-Type','application/x-bittorrent');return r.end(fs.readFileSync('/tmp/claude-0/pack.torrent'));}
  if(u==='/doc.pdf'){r.setHeader('Content-Type','application/pdf');return r.end(big.subarray(0,300000));}
  if(u.startsWith('/hls/')){const f=path.join('/tmp/claude-0/hlsv',u.slice(5)); if(!fs.existsSync(f)){r.statusCode=404;return r.end();} r.setHeader('Content-Type',f.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'); return r.end(fs.readFileSync(f));}
  r.statusCode=404;r.end();
}).listen(8891, async()=>{
 const HOME='/tmp/claude-0/uihome161b';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME+'/.config/DrYAE',{recursive:true});
 fs.writeFileSync(HOME+'/.config/DrYAE/settings.json',JSON.stringify({lang:'fr',langChosen:true,torrent:{dht:false,lsd:false,useDefaultTrackers:false,trackersUrl:''}}));
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.setViewportSize({width:1400,height:860}).catch(()=>{}); await w.waitForTimeout(1500);
 // --- gestionnaire ---
 const add=(url,name)=>w.evaluate(o=>window.dryae.call('add',{urls:[o.url],name:o.name,startNow:false}),{url,name});
 await add('http://127.0.0.1:8891/doc.pdf','rapport.pdf'); await add('http://127.0.0.1:8891/doc.pdf?x=2','autre.pdf'); await add('http://127.0.0.1:8891/doc.pdf?x=3','troisieme.pdf');
 const dup=await add('http://127.0.0.1:8891/doc.pdf','rapport.pdf'); console.log('doublon détecté :', JSON.stringify(dup[0].duplicate&&{name:dup[0].duplicate.name,status:dup[0].duplicate.status}));
 const dupT=await add('http://127.0.0.1:8891/doc.pdf?y=9','Rapport.pdf'); console.log('doublon par le titre :', !!dupT[0].duplicate);
 await w.waitForTimeout(800);
 // ajout via la fenêtre « Ajouter » -> boîte de doublon
 await w.click('#addBtn'); await w.fill('#aUrls','http://127.0.0.1:8891/doc.pdf'); await w.waitForTimeout(400); await w.click('#aLater'); await w.waitForTimeout(700);
 console.log('boîte doublon :', await w.evaluate(()=>document.querySelector('#askModal').classList.contains('on')), '|', (await w.textContent('#askModal')).replace(/\s+/g,' ').slice(0,160));
 await w.screenshot({path:OUT+'/m1-doublon.png'});
 await w.click('#askBtns [data-v="rename"]'); await w.waitForTimeout(800);
 let L=await w.evaluate(()=>window.dryae.call('list')); console.log('éléments après « garder les deux » :', L.length);
 // clavier
 await w.click('#list'); await w.keyboard.press('Control+a'); await w.waitForTimeout(200); console.log('Ctrl+A sélectionnés :', await w.$$eval('.item.sel',x=>x.length));
 await w.keyboard.press('Escape'); await w.keyboard.press('ArrowDown'); await w.keyboard.press('Shift+ArrowDown'); await w.waitForTimeout(150); console.log('↓ puis Maj+↓ :', await w.$$eval('.item.sel',x=>x.length));
 await w.keyboard.press('F1'); await w.waitForTimeout(300); console.log('F1 raccourcis :', await w.evaluate(()=>document.querySelectorAll('#pBody .kbd-list div').length)); await w.screenshot({path:OUT+'/m2-raccourcis.png'}); await w.keyboard.press('Escape');
 // corbeille avec confirmation
 const done=await w.evaluate(()=>window.dryae.call('list')); 
 await w.evaluate(async()=>{const l=await window.dryae.call('list'); await window.dryae.call('resume',l[0].id);}); await w.waitForTimeout(2500);
 await w.click('#clearDone'); await w.waitForTimeout(400);
 console.log('confirmation corbeille :', await w.evaluate(()=>document.querySelector('#askModal').classList.contains('on')), '| case :', await w.textContent('#askChkTxt'));
 await w.screenshot({path:OUT+'/m3-corbeille.png'});
 await w.click('#askBtns [data-v=""]');
 console.log('bouton navigateur en haut :', await w.evaluate(()=>!!document.querySelector('.top #openBrowser')));
 await w.screenshot({path:OUT+'/m4-gestionnaire.png'});
 // --- navigateur ---
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8891/ep'));
 let b; for(let i=0;i<40&&!b;i++){ b=app.windows().find(x=>x.url().includes('browser.html')); await new Promise(r=>setTimeout(r,250)); }
 b.on('pageerror',e=>console.log('[brerr]',e.message)); await b.setViewportSize({width:1400,height:860}).catch(()=>{}); await b.waitForTimeout(3000);
 await b.click('#bMenu'); await b.waitForTimeout(300); console.log('menu :', (await b.$$eval('#menu .ml',x=>x.map(e=>e.textContent))).join(' | ')); await b.screenshot({path:OUT+'/b1-menu.png'});
 await b.click('#menu button:has-text("Historique")'); await b.waitForTimeout(200); console.log('sous-menu :', (await b.$$eval('#menu .ml',x=>x.slice(0,3).map(e=>e.textContent))).join(' | '));
 await b.keyboard.press('Escape');
 // raccourci depuis la page (focus dans la page)
 const n0=await b.evaluate(()=>tabs.length); await b.evaluate(()=>cur.wv.focus()); await b.waitForTimeout(200); await b.keyboard.press('Control+t'); await b.waitForTimeout(600);
 console.log('Ctrl+T depuis la page :', n0, '->', await b.evaluate(()=>tabs.length)); await b.keyboard.press('Control+w'); await b.waitForTimeout(400); console.log('Ctrl+W :', await b.evaluate(()=>tabs.length));
 await b.keyboard.press('F1'); await b.waitForTimeout(300); console.log('F1 navigateur :', await b.evaluate(()=>document.querySelectorAll('#kbModal .kbd-list div').length)); await b.screenshot({path:OUT+'/b2-raccourcis.png'}); await b.keyboard.press('Escape');
 // paramètres du navigateur
 await b.evaluate(()=>B.call('br:openPage','settings')); let sp; for(let i=0;i<30&&!sp;i++){ sp=app.windows().find(x=>x.url().startsWith('dryae://settings')); await new Promise(r=>setTimeout(r,200)); } await sp.waitForTimeout(800); console.log('paramètres navigateur :', (await sp.$$eval('#nav button',x=>x.map(e=>e.textContent))).join(' | ')); await b.evaluate(()=>{ const t=tabs.find(x=>/^dryae:/.test(x.url)); if(t) closeTab(t); select(tabs[0]); }); await b.waitForTimeout(400);
 // fichiers détectés
 await b.click('#bDrYAE'); await b.waitForTimeout(3500); await b.screenshot({path:OUT+'/b4-detectes.png'});
 console.log('détectés :', (await b.textContent('#pBody')).replace(/\s+/g,' ').slice(0,260));
 console.log('pied :', (await b.textContent('#pFoot')).replace(/\s+/g,' '));
 await b.click('#dClear'); await b.waitForTimeout(300); console.log('après Tout effacer :', await b.$$eval('#pBody .dfile',x=>x.length), '| badge :', await b.textContent('#dlN'));
 await b.click('#dReset'); await b.waitForTimeout(300); console.log('après Réinitialiser :', await b.$$eval('#pBody .dfile',x=>x.length));
 // torrent cliqué sur la page : reste dans le navigateur
 await b.evaluate(()=>cur.wv.executeJavaScript("document.getElementById('tor').click()")); await b.waitForTimeout(3000);
 console.log('feuille torrent dans le navigateur :', await b.evaluate(()=>document.querySelector('#qs').classList.contains('on')), '|', (await b.textContent('#qsTitleH')), '|', (await b.textContent('#qsMeta')));
 await b.screenshot({path:OUT+'/b5-torrent.png'});
 console.log('vue active :', await b.evaluate(()=>document.title));
 await app.close(); process.exit(0);
});
