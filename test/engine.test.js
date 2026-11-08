const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const R='/home/claude/dryae3/src/main/';
const {Settings}=require(R+'settings');const {Manager}=require(R+'manager');
const ud='/tmp/claude-0/eng/ud';fs.rmSync(ud,{recursive:true,force:true});fs.mkdirSync(ud,{recursive:true});
const app={getPath:k=>k==='downloads'?'/tmp/claude-0/eng/dl':ud};
fs.rmSync('/tmp/claude-0/eng/dl',{recursive:true,force:true});
const S=new Settings(app);S.set({torrent:{dht:false,lsd:false,useDefaultTrackers:false,seed:false,trackersUrl:''}});
const data=fs.readFileSync('/tmp/claude-0/t/big.bin');
http.createServer((q,r)=>{
 if(q.url.startsWith('/hls/')){const f='/tmp/claude-0/hls/'+q.url.slice(5);return fs.existsSync(f)?r.end(fs.readFileSync(f)):(r.statusCode=404,r.end());}
 if(q.url==='/page'){r.setHeader('Content-Type','text/html');return r.end('<html></html>');}
 const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const s=m?+m[1]:0,e=m&&m[2]?+m[2]:data.length-1;
 r.writeHead(m?206:200,{'Content-Range':`bytes ${s}-${e}/${data.length}`,'Content-Length':e-s+1,'Content-Type':'video/mp4'});
 let o=s;const t=setInterval(()=>{if(o>e){clearInterval(t);return r.end();}const n=Math.min(e+1,o+16384);r.write(data.subarray(o,n));o=n;},20);r.on('close',()=>clearInterval(t));
}).listen(8770,async()=>{
 const m=new Manager({userDir:ud,settings:S});
 m.on('notice',n=>console.log('notice',n));
 const a=m.add({type:'http',url:'http://127.0.0.1:8770/film.mp4'});
 const h=m.add({type:'hls',url:'http://127.0.0.1:8770/hls/master.m3u8',name:'MaVideo'});
 const w=m.add({type:'http',url:'http://127.0.0.1:8770/page'});
 // (les torrents sont testés dans torrent2.test.js, moteur aria2)
 await new Promise(r=>setTimeout(r,2500));
 const A=m.get(a.id);console.log('http mid',A.status,A.segments.length,A.segments.filter(s=>s.active).length,(A.downloaded()/1e6).toFixed(1));
 m.pause(a.id);await new Promise(r=>setTimeout(r,300));m.resume(a.id);
 await new Promise(r=>{const x=setInterval(()=>{if(m.list.every(d=>['done','error'].includes(d.status))){clearInterval(x);r()}},200)});
 const md5=b=>crypto.createHash('md5').update(b).digest('hex');
 for(const d of m.list){console.log(d.type,d.status,d.name,d.error||'',d.file||'', d.type!=='hls'&&d.status==='done'?md5(fs.readFileSync(d.type==='torrent'?d.rootPath():d.file))===md5(data):'');}
 const hf=m.get(h.id).file; console.log('hls', require('child_process').execFileSync('ffprobe',['-v','error','-show_entries','format=duration,format_name','-of','csv=p=0',hf]).toString().trim());
 console.log(fs.readdirSync('/tmp/claude-0/eng/dl',{recursive:true}));
 process.exit(0);
});
setTimeout(()=>{console.log('TIMEOUT');process.exit(1)},120000);
