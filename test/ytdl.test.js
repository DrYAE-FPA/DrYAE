const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/dryae3/src/main/';
const {Settings}=require(R+'settings');const {Manager}=require(R+'manager');
const ud='/tmp/claude-0/yt/ud';fs.rmSync('/tmp/claude-0/yt',{recursive:true,force:true});fs.mkdirSync(ud,{recursive:true});
const app={getPath:k=>k==='downloads'?'/tmp/claude-0/yt/dl':ud};
const S=new Settings(app);
const vid=fs.readFileSync('/tmp/claude-0/media/clip_audio.mp4');
http.createServer((q,r)=>{
  if(q.url==='/page.m3u8'){r.setHeader('Content-Type','text/plain');return r.end(fs.readFileSync('/tmp/claude-0/hls/master.m3u8'));}
  if(q.url.startsWith('/hls/')){return r.end(fs.readFileSync('/tmp/claude-0/hls/'+q.url.slice(5)));}
  if(q.url==='/fakefile'){r.setHeader('Content-Type','application/octet-stream');return r.end('<!DOCTYPE html><html><body>page</body></html>');}
  const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const s=m?+m[1]:0,e=m&&m[2]?+m[2]:vid.length-1;
  r.writeHead(m?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':e-s+1,'Content-Range':`bytes ${s}-${e}/${vid.length}`});r.end(vid.subarray(s,e+1));
}).listen(8800,async()=>{
  const m=new Manager({userDir:ud,settings:S});
  const info=await m.ytdl.inspect('http://127.0.0.1:8800/videos/ma_video.mp4');
  console.log('inspect',info.title,info.playlist,info.heights.map(h=>h.h),info.extractor);
  const a=m.add({type:'ytdl',url:'http://127.0.0.1:8800/videos/ma_video.mp4',title:'Ma vidéo test',mode:'video',quality:'360'});
  const b=m.add({type:'ytdl',url:'http://127.0.0.1:8800/videos/ma_video.mp4',title:'Ma musique test',mode:'audio',audioFormat:'mp3',audioBitrate:'192'});
  // corrections : m3u8 sans extension et page web déguisée
  const c=m.add({type:'http',url:'http://127.0.0.1:8800/page.m3u8'.replace('.m3u8','')+'.m3u8?x=1'.replace('.m3u8?x=1','')+'/../page.m3u8'});
  const c2=m.add({type:'http',url:'http://127.0.0.1:8800/hls/master.m3u8'.replace('master.m3u8','master.m3u8')});
  const w=m.add({type:'http',url:'http://127.0.0.1:8800/fakefile'});
  await new Promise(res=>{const t=setInterval(()=>{if(m.list.every(d=>['done','error'].includes(d.status))){clearInterval(t);res()}},300)});
  for(const d of m.list){ let probe=''; if(d.file&&fs.existsSync(d.file)) probe=require('child_process').execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name:format=duration,bit_rate','-of','csv=p=0',d.file]).toString().trim().replace(/\n/g,' | '); console.log(d.type,d.status,d.name,d.error||'',probe); }
  process.exit(0);
});
setTimeout(()=>{console.log('TIMEOUT');process.exit(1)},150000);
