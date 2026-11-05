const { _electron } = require('playwright');
const fs=require('fs');
const OUT='/tmp/claude-0/shots';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 await require('./server')(8780);
 const HOME='/tmp/claude-0/uihome';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME+'/Downloads',{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae2',executablePath:'/home/claude/dryae2/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 app.process().stderr.on('data',d=>{const s=String(d);if(!/dbus|gpu|GLES|viz|Fontconfig|vaapi|ALSA|sandbox/i.test(s))process.stderr.write('[main] '+s)});
 app.process().stdout.on('data',d=>process.stdout.write('[out] '+d));
 const w=await app.firstWindow(); await w.setViewportSize({width:1300,height:800});
 w.on('console',m=>{if(m.type()==='error')console.log('[ui]',m.text())}); w.on('pageerror',e=>console.log('[uierr]',e.message));
 await w.waitForTimeout(1500);
 await w.screenshot({path:OUT+'/01-empty.png'});
 // ajout de liens
 await w.click('#addBtn'); await w.fill('#aUrls','http://127.0.0.1:8780/files/Film_Vacances.mp4\nhttp://127.0.0.1:8780/files/Rapport_annuel.pdf\nhttp://127.0.0.1:8780/files/Setup_Logiciel.exe');
 await w.waitForTimeout(900); await w.screenshot({path:OUT+'/02-add.png'});
 await w.click('#aOk'); await w.waitForTimeout(500);
 // HLS
 await w.click('#addBtn'); await w.fill('#aUrls','http://127.0.0.1:8780/hls/master.m3u8'); await w.fill('#aName','Ma vidéo HLS'); await w.waitForTimeout(1500);
 await w.screenshot({path:OUT+'/03-hls.png'}); await w.click('#aOk');
 await w.waitForTimeout(3000);
 await w.screenshot({path:OUT+'/04-list.png'});
 // détails
 await w.click('.item:has-text("Film_Vacances") .name'); await w.waitForTimeout(1500);
 await w.screenshot({path:OUT+'/05-details.png'});
 await w.click('#dClose');
 // paramètres
 await w.click('#setBtn'); await w.waitForTimeout(400); await w.screenshot({path:OUT+'/06-settings.png'});
 await w.click('#sNav [data-s=tor]'); await w.waitForTimeout(200); await w.screenshot({path:OUT+'/07-settings-torrent.png'});
 await w.click('#sModal [data-close]');
 // navigateur
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8780/page'));
 let bw=null; for(let i=0;i<30&&!bw;i++){await w.waitForTimeout(300); bw=app.windows().find(x=>x.url().includes('browser.html'));}
 bw.on('pageerror',e=>console.log('[brerr]',e.message)); bw.on('console',m=>{if(m.type()==='error')console.log('[br]',m.text())});
 await bw.setViewportSize({width:1300,height:800}); await bw.waitForTimeout(5000);
 await bw.screenshot({path:OUT+'/08-browser.png'});
 console.log('media badge', await bw.textContent('#mediaN'), 'blocked', await bw.textContent('#shieldN'));
 await bw.click('#bMedia'); await bw.waitForTimeout(500); await bw.screenshot({path:OUT+'/09-browser-media.png'});
 // télécharger le premier média -> fenêtre principale propose l'ajout
 await bw.click('[data-dl="0"]').catch(e=>console.log('nodl',e.message)); await w.waitForTimeout(1200);
 await w.screenshot({path:OUT+'/10-from-browser.png'});
 await w.click('#addModal [data-close]').catch(()=>{});
 await bw.evaluate(()=>{ document.querySelector('#bMenu').click(); }); await bw.waitForTimeout(300); await bw.screenshot({path:OUT+'/11-browser-menu.png'});
 await bw.keyboard.press('Escape');
 await bw.evaluate(()=>grabLinks()); await bw.waitForTimeout(800); await bw.screenshot({path:OUT+'/12-grab.png'});
 await bw.evaluate(()=>newTab()); await bw.waitForTimeout(500); await bw.screenshot({path:OUT+'/13-start.png'});
 // attendre fin
 for(let i=0;i<60;i++){ const st=await w.evaluate(()=>window.dryae.call('list')); if(st.every(d=>['done','error'].includes(d.status))) break; await w.waitForTimeout(1000); }
 const L=await w.evaluate(()=>window.dryae.call('list')); L.forEach(d=>console.log(d.type,d.status,d.name,d.error||''));
 await w.screenshot({path:OUT+'/14-done.png'});
 await app.close(); process.exit(0);
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
