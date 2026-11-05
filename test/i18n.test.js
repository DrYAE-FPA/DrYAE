const { _electron } = require('playwright');
const fs=require('fs');
const OUT='/tmp/claude-0/shots-i18n';fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const FR=/\b(le|la|les|des|du|une|est|pour|avec|dans|sur|aucun|aucune|télécharg\w*|paramètres|fichier\w*|lien\w*|navigateur|ajouter|onglet\w*|vidéo\w*|mot de passe)\b|[éèêàùç]/i;
const scan = () => { const out=new Set(); const w=document.createTreeWalker(document.body,5); let n;
  while((n=w.nextNode())){ if(n.nodeType===3){ const p=n.parentElement; if(!p||p.closest('script,style,[data-notr],.name,.mono,.tab .t,code')) continue; const v=n.nodeValue.trim(); if(v) out.add(v);} else for(const a of ['placeholder','title']){const v=n.getAttribute(a); if(v) out.add('@'+v);} }
  return [...out]; };
(async()=>{
 const HOME='/tmp/claude-0/uihome-i18n';fs.rmSync(HOME,{recursive:true,force:true});fs.mkdirSync(HOME,{recursive:true});
 const launch=async()=>{const app=await _electron.launch({args:['.','--no-sandbox','--lang=en-US'],cwd:'/home/claude/dryae3',executablePath:'/home/claude/dryae3/node_modules/electron/dist/electron',env:{...process.env,HOME,XDG_CONFIG_HOME:HOME+'/.config'}});
   const w=await app.firstWindow(); w.on('pageerror',e=>console.log('[uierr]',e.message)); await w.waitForTimeout(2000); return {app,w};};
 for (const lang of ['en','ar','ru']) {
  let {app,w}=await launch();
  const cur=await w.evaluate(()=>window.DRYAE_LANG);
  if (cur!==lang){ await w.evaluate(l=>window.dryae.call('setLang',l),lang).catch(()=>{}); await w.waitForTimeout(2500); }
  console.log('\n=== langue', await w.evaluate(()=>window.DRYAE_LANG), 'dir', await w.evaluate(()=>document.documentElement.dir));
  await w.screenshot({path:`${OUT}/${lang}-1-main.png`});
  let left=new Set(await w.evaluate(scan));
  for (const m of [...await w.$$eval('.overlay',x=>x.map(e=>e.id))]) { await w.evaluate(id=>document.getElementById(id).classList.add('on'),m); await w.waitForTimeout(120); (await w.evaluate(scan)).forEach(x=>left.add(x)); if(m!=='sModal') await w.evaluate(id=>document.getElementById(id).classList.remove('on'),m); }
  for (const s of await w.$$eval('#sNav [data-s]',x=>x.map(e=>e.dataset.s))) { await w.click(`#sNav [data-s="${s}"]`); await w.waitForTimeout(150); (await w.evaluate(scan)).forEach(x=>left.add(x)); if(s==='about') await w.screenshot({path:`${OUT}/${lang}-2b-about.png`}); }
  await w.screenshot({path:`${OUT}/${lang}-2-settings.png`});
  await w.keyboard.press('Escape');
  await w.evaluate(()=>window.dryae.call('openBrowser','about:blank'));
  let b; for(let i=0;i<40&&!b;i++){ b=app.windows().find(x=>x.url().includes('browser.html')); await new Promise(r=>setTimeout(r,250)); }
  b.on('pageerror',e=>console.log('[brerr]',e.message)); await b.waitForTimeout(1500);
  (await b.evaluate(scan)).forEach(x=>left.add('B:'+x));
  await b.click('#bMenu'); await b.waitForTimeout(300); (await b.evaluate(scan)).forEach(x=>left.add('B:'+x));
  await b.screenshot({path:`${OUT}/${lang}-3-menu.png`});
  const tray = await app.evaluate(()=>global.DRYAE_T('Ouvrir DrYAE'));
  console.log('T main:', tray);
  console.log('Restes :', [...left].filter(x=>lang==='en'?FR.test(x):/[a-zà-ÿ]{4,}/.test(x.replace(/DrYAE|YouTube|Vimeo|TikTok|Chrome|Windows|GitHub|Google|Bing|Brave|Qwant|Yahoo|DuckDuckGo|AdGuard|Adblock|EasyList|https?:\S+|chrome:\S+|manifest\.json|yt-dlp|ffmpeg|magnet|torrent|referer|cookies|user-agent|Store|Web|Extension|example\.com|AMOLED|DNS-over-HTTPS|shutdown|Cloudflare|Ctrl|Shift|Alt|Maj|\w+\.\w+/gi,''))).slice(0,150));
  await app.close();
 }
 process.exit(0);
})();
