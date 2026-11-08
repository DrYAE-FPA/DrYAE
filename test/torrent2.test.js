// Torrents via aria2 : .torrent multi-fichiers avec sélection, puis magnet (lecture des métadonnées)
const { _electron } = require('playwright');
const fs=require('fs'),http=require('http'),{spawn}=require('child_process');
const OUT='/tmp/claude-0/shots161'; fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const bencode=(await import('bencode')).default; const ct=(await import('create-torrent')).default;
 // mini tracker HTTP
 const peers=new Map();
 http.createServer((q,r)=>{const u=new URL(q.url,'http://x');const ih=u.searchParams.get('info_hash');const port=+u.searchParams.get('port');const key=q.socket.remoteAddress.replace('::ffff:','')+':'+port;
   const list=peers.get(ih)||new Map(); list.set(key,{ip:'127.0.0.1',port}); peers.set(ih,list);
   const comp=Buffer.concat([...list.values()].filter(p=>p.port!==port).map(p=>{const b=Buffer.alloc(6);[127,0,0,1].forEach((x,i)=>b[i]=x);b.writeUInt16BE(p.port,4);return b;}));
   r.end(bencode.encode({interval:5,'min interval':2,peers:comp}));}).listen(8790,'127.0.0.1');
 const src='/tmp/claude-0/tsrc/Mon Pack'; fs.rmSync('/tmp/claude-0/tsrc',{recursive:true,force:true}); fs.mkdirSync(src+'/Bonus',{recursive:true});
 const big=fs.readFileSync('/tmp/claude-0/t/big.bin'); fs.writeFileSync(src+'/Episode 01.mp4',big.subarray(0,12e6)); fs.writeFileSync(src+'/Episode 02.mp4',big.subarray(12e6,24e6)); fs.writeFileSync(src+'/Bonus/making-of.mkv',big.subarray(24e6)); fs.writeFileSync(src+'/lisez-moi.txt','Bonjour');
 const buf=await new Promise(r=>ct(src,{announceList:[['http://127.0.0.1:8790/announce']],pieceLength:262144},(e,b)=>r(b)));
 fs.writeFileSync('/tmp/claude-0/pack.torrent',buf);
 const seeder=spawn('aria2c',['--dir=/tmp/claude-0/tsrc','--seed-ratio=0.0','--check-integrity=true','--bt-seed-unverified=false','--enable-dht=false','--bt-enable-lpd=false','--listen-port=6991','--quiet=true','/tmp/claude-0/pack.torrent'],{stdio:'ignore'});
 await new Promise(r=>setTimeout(r,2500));
 const HOME='/tmp/claude-0/uihome161'; fs.rmSync(HOME,{recursive:true,force:true}); fs.mkdirSync(HOME+'/.config/DrYAE',{recursive:true});
 fs.writeFileSync(HOME+'/.config/DrYAE/settings.json',JSON.stringify({lang:'fr',langChosen:true,torrent:{dht:false,lsd:false,useDefaultTrackers:false,trackersUrl:'',seed:false,ratio:0}}));
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.waitForTimeout(1200);
 const info=await w.evaluate(()=>window.dryae.call('torrent:inspect','/tmp/claude-0/pack.torrent'));
 console.log('inspect:',info.name,info.files.map(f=>f.path));
 const sel=info.files.map(f=>f.i).filter(i=>!/making-of/.test(info.files[i].path));
 await w.evaluate(o=>window.dryae.call('torrent:add',o),{...info,selected:sel});
 let t0=Date.now(),last;
 for(let i=0;i<60;i++){ const L=await w.evaluate(()=>window.dryae.call('list')); last=L[0]; if(i%3==0)console.log(last.status,(last.downloaded/1e6).toFixed(1),'/',(last.size/1e6).toFixed(1),'pairs',last.numPeers,last.error||''); if(['seeding','done','error'].includes(last.status)) break; await w.waitForTimeout(1000); }
 console.log('final',last.status,'en',((Date.now()-t0)/1000).toFixed(1),'s');
 const dir=HOME+'/DrYAE/Torrents/Mon Pack';
 console.log(fs.existsSync(dir)?fs.readdirSync(dir,{recursive:true}):'pas de dossier');
 console.log('episode2 intact', fs.existsSync(dir+'/Episode 02.mp4') && fs.readFileSync(dir+'/Episode 02.mp4').equals(big.subarray(12e6,24e6)));
 const det=await w.evaluate(id=>window.dryae.call('details',id),last.id).catch(e=>String(e)); console.log('details pieces', det?.torrent?.pieces, 'fichiers', det?.torrent?.files?.map(f=>Math.round(f.progress*100)+'%'));
 // magnet : métadonnées récupérées auprès du seeder
 const ih=info.infoHash; fs.rmSync(HOME+'/.config/DrYAE/torrents/'+ih+'.torrent',{force:true});
 await w.evaluate(id=>window.dryae.call('remove',[id],true),last.id).catch(e=>console.log('remove err',String(e).slice(0,100)));
 await w.waitForTimeout(1500);
 const mag='magnet:?xt=urn:btih:'+ih+'&tr='+encodeURIComponent('http://127.0.0.1:8790/announce');
 const t1=Date.now(); const mi=await w.evaluate(m=>window.dryae.call('torrent:inspect',m),mag).catch(e=>({err:String(e)}));
 console.log('magnet inspect:',mi.err||mi.files?.length+' fichiers', ((Date.now()-t1)/1000).toFixed(1),'s');
 const ps=require('child_process').execSync('ps aux | grep -c "[a]ria2c --enable-rpc"').toString().trim(); console.log('processus aria2 RPC:',ps);
 await app.close(); seeder.kill(); await new Promise(r=>setTimeout(r,1500));
 console.log('aria2 après fermeture:', require('child_process').execSync('ps aux | grep -c "[a]ria2c --enable-rpc" || true').toString().trim());
 process.exit(0);
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
