const { _electron } = require('playwright');
const fs=require('fs'),http=require('http');
const HOME='/tmp/claude-0/fphome';
http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end('<!doctype html><title>fp</title><iframe src="http://localhost:8820/inner"></iframe>');}).listen(8820, async()=>{
 fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const app=await _electron.launch({args:['.','--no-sandbox','--lang=fr'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
 const w=await app.firstWindow(); await w.waitForTimeout(1200);
 await w.evaluate(()=>window.dryae.call('openBrowser','http://127.0.0.1:8820/'));
 let b;for(let i=0;i<40&&!b;i++){await new Promise(r=>setTimeout(r,250));b=app.windows().find(x=>x.url().includes('browser.html'));}
 await b.waitForTimeout(2500);
 const fp=await b.evaluate(()=>cur.wv.executeJavaScript(`JSON.stringify({ua:navigator.userAgent, chrome:typeof window.chrome, chromeKeys: window.chrome?Object.keys(window.chrome):null, plugins:navigator.plugins.length, pdf:navigator.pdfViewerEnabled, webdriver:navigator.webdriver, brands:navigator.userAgentData&&navigator.userAgentData.brands, platform:navigator.platform, langs:navigator.languages, notif: typeof Notification!=='undefined'?Notification.permission:'none', hw:navigator.hardwareConcurrency, mem:navigator.deviceMemory, outer:[outerWidth,outerHeight], frameChrome: (()=>{try{return typeof frames[0].chrome}catch(e){return 'xo'}})() })`));
 console.log(fp);
 await app.close(); process.exit(0);
});
