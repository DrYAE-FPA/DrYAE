const { _electron } = require('playwright');
const fs=require('fs');
const OUT='/tmp/claude-0/shots';
(async()=>{
 const {Server}=await import('bittorrent-tracker');
 const tr=new Server({udp:false,ws:false,http:true,stats:false}); await new Promise(r=>tr.listen(8790,'127.0.0.1',r));
 const WT=(await import('webtorrent')).default; const ct=(await import('create-torrent')).default;
 // dossier multi-fichiers
 const src='/tmp/claude-0/tsrc/Mon Pack'; fs.rmSync('/tmp/claude-0/tsrc',{recursive:true,force:true}); fs.mkdirSync(src+'/Bonus',{recursive:true});
 const big=fs.readFileSync('/tmp/claude-0/t/big.bin'); fs.writeFileSync(src+'/Episode 01.mp4',big.subarray(0,12e6)); fs.writeFileSync(src+'/Episode 02.mp4',big.subarray(12e6,24e6)); fs.writeFileSync(src+'/Bonus/making-of.mkv',big.subarray(24e6)); fs.writeFileSync(src+'/lisez-moi.txt','Bonjour');
 const buf=await new Promise(r=>ct(src,{announceList:[['http://127.0.0.1:8790/announce']]},(e,b)=>r(b)));
 fs.writeFileSync('/tmp/claude-0/pack.torrent',buf);
 const seeder=new WT({dht:false,lsd:false}); await new Promise(r=>seeder.add(buf,{path:'/tmp/claude-0/tsrc'},t=>{console.log('seeder progress',t.progress);r()}));
 const HOME='/tmp/claude-0/uihome2'; fs.rmSync(HOME,{recursive:true,force:true}); fs.mkdirSync(HOME+'/.config/DrYAE',{recursive:true}); fs.mkdirSync(HOME+'/Downloads',{recursive:true});
 fs.writeFileSync(HOME+'/.config/DrYAE/settings.json',JSON.stringify({torrent:{dht:false,lsd:false,useDefaultTrackers:false,trackersUrl:'',seed:true,ratio:0}}));
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); await w.setViewportSize({width:1300,height:800});
 w.on('pageerror',e=>console.log('[uierr]',e.message));
 await w.waitForTimeout(1200);
 await w.keyboard.press('Control+t'); await w.fill('#tSrc','/tmp/claude-0/pack.torrent'); await w.click('#tFetch'); await w.waitForTimeout(800);
 // décocher le bonus
 await w.click('#tFiles .frow:has-text("making-of") input');
 await w.screenshot({path:OUT+'/20-torrent-add.png'});
 await w.click('#tOk');
 for(let i=0;i<60;i++){ const L=await w.evaluate(()=>window.dryae.call('list')); const t=L[0]; if(t&&i%3==0)console.log(t.status,(t.downloaded/1e6).toFixed(1),'/',(t.size/1e6).toFixed(1),'peers',t.numPeers); if(t&&['seeding','done','error'].includes(t.status)) break; await w.waitForTimeout(1000); if(i===3){await w.click('.item .name'); await w.waitForTimeout(500); await w.screenshot({path:OUT+'/21-torrent-running.png'});} }
 await w.waitForTimeout(1200);
 await w.screenshot({path:OUT+'/22-torrent-done.png'});
 const L=await w.evaluate(()=>window.dryae.call('list')); console.log(L[0].status,L[0].error||'',L[0].size);
 console.log(fs.readdirSync(HOME+'/DrYAE/Torrents/Mon Pack',{recursive:true}));
 const ok=fs.readFileSync(HOME+'/DrYAE/Torrents/Mon Pack/Episode 02.mp4').equals(big.subarray(12e6,24e6)); console.log('episode2 intact',ok);
 await app.close(); process.exit(0);
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
