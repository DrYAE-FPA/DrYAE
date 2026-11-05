// serveur de test : fichiers, HLS, page web avec vidéo
const http=require('http'),fs=require('fs');
const data=fs.readFileSync('/tmp/claude-0/t/big.bin');
module.exports=(port,slow=16384)=>new Promise(res=>{const s=http.createServer((q,r)=>{
 if(q.url.startsWith('/hls/')){const f='/tmp/claude-0/hls/'+q.url.slice(5).split('?')[0];if(!fs.existsSync(f)){r.statusCode=404;return r.end();}
   r.setHeader('Content-Type',f.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t');return r.end(fs.readFileSync(f));}
 if(q.url==='/page'){r.setHeader('Content-Type','text/html; charset=utf-8');return r.end(`<!doctype html><html><head><title>Page de test vidéo</title></head><body style="font-family:sans-serif;background:#fff">
 <h1>Page de test</h1><video id=v src="/media/clip.mp4" controls muted autoplay width=480></video>
 <p><a href="/files/Rapport.pdf">Rapport.pdf</a> · <a href="/files/Archive.zip">Archive.zip</a> · <a href="/files/Setup.exe">Setup.exe</a></p>
 <div class="ad-banner" id="ad_300x250">PUB</div><img src="/ads/banner.gif" width=1 height=1>
 <script src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script><script src="https://www.googletagmanager.com/gtm.js?id=GTM-X"></script><script>fetch('/hls/master.m3u8')</script></body></html>`);}
 const m=(q.headers.range||'').match(/bytes=(\d+)-(\d*)/);const st=m?+m[1]:0,e=m&&m[2]?+m[2]:data.length-1;
 const ct=q.url.endsWith('.mp4')?'video/mp4':q.url.endsWith('.pdf')?'application/pdf':'application/octet-stream';
 r.writeHead(m?206:200,{'Content-Range':`bytes ${st}-${e}/${data.length}`,'Accept-Ranges':'bytes','Content-Length':e-st+1,'Content-Type':ct});
 let o=st;const t=setInterval(()=>{if(o>e){clearInterval(t);return r.end();}const n=Math.min(e+1,o+slow);r.write(data.subarray(o,n));o=n;},20);r.on('close',()=>clearInterval(t));
}).listen(port,()=>res(s));});
