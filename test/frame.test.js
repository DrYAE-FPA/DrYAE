const { _electron } = require('playwright');
const http=require('http'),fs=require('fs');
(async()=>{
 http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');
  if(q.url.startsWith('/frame')) return r.end('<title>f</title><script>window.EARLY={csi:typeof (window.chrome&&window.chrome.csi), wd:navigator.webdriver, t:performance.now()}</script>');
  r.end('<title>main</title><iframe src="http://localhost:8841/frame"></iframe>');}).listen(8840);
 http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end('<title>f</title><script>window.EARLY={csi:typeof (window.chrome&&window.chrome.csi), wd:navigator.webdriver}</script>');}).listen(8841);
 const HOME='/tmp/claude-0/frhome';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); await w.waitForTimeout(1200);
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8840/'));
 await new Promise(r=>setTimeout(r,5000));
 const res=await app.evaluate(async({webContents})=>{const wv=webContents.getAllWebContents().find(x=>x.getType()==='webview'); if(!wv) return 'no webview';
   const out=[]; for(const f of wv.mainFrame.framesInSubtree){ try{ out.push(f.url+' => '+JSON.stringify(await f.executeJavaScript('JSON.stringify({early:window.EARLY, now:typeof (window.chrome&&window.chrome.csi)})'))); }catch(e){out.push(f.url+' ERR '+e.message)} } return out; });
 console.log(res);
 await app.close(); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
