const http=require('http'),fs=require('fs');
const R='/home/claude/dryae3/src/main/';
const {Settings}=require(R+'settings');const {Manager}=require(R+'manager');
const ud='/tmp/claude-0/ytn/ud';fs.rmSync('/tmp/claude-0/ytn',{recursive:true,force:true});fs.mkdirSync(ud,{recursive:true});
const S=new Settings({getPath:k=>k==='downloads'?'/tmp/claude-0/ytn/dl':ud});
const vid=fs.readFileSync('/tmp/claude-0/media/clip_audio.mp4');
http.createServer((q,r)=>{if(q.url.startsWith('/hls/'))return r.end(fs.readFileSync('/tmp/claude-0/hls/'+q.url.slice(5).split('?')[0]));r.writeHead(200,{'Content-Type':'video/mp4','Content-Length':vid.length});r.end(vid);}).listen(8880,async()=>{
  const m=new Manager({userDir:ud,settings:S});
  const a=m.add({type:'ytdl',url:'http://127.0.0.1:8880/hls/master.m3u8?t=1',title:'',mode:'video'});
  await new Promise(r=>setTimeout(r,200));
  const b=m.add({type:'ytdl',url:'http://127.0.0.1:8880/hls/master.m3u8?t=2',title:'',mode:'video'});
  const c=m.add({type:'ytdl',url:'http://127.0.0.1:8880/films/ep.mp4',title:'Épisode 07 VF',mode:'video'});
  const c2=m.add({type:'ytdl',url:'http://127.0.0.1:8880/films/ep2.mp4',title:'Épisode 07 VF',mode:'video'});
  await new Promise(res=>{const t=setInterval(()=>{if(m.list.every(d=>['done','error'].includes(d.status))){clearInterval(t);res()}},300)});
  m.list.forEach(d=>console.log(d.status, '| nom:', d.name, '| titre:', d.title, '| fichier existe:', !!(d.file&&fs.existsSync(d.file)), d.error||''));
  process.exit(0);
});
setTimeout(()=>{console.log('TIMEOUT');process.exit(1)},150000);
