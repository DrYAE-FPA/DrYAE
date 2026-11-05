const { _electron } = require('playwright');
(async()=>{
 const app=await _electron.launch({args:['/home/claude/dryae2','--no-sandbox'],executablePath:'/home/claude/dryae2/node_modules/electron/dist/electron',env:{...process.env,HOME:'/tmp/claude-0/uihome'}});
 app.process().stderr.on('data',d=>process.stderr.write(String(d)));
 app.process().stdout.on('data',d=>process.stdout.write(String(d)));
 console.log('launched', app.windows().length);
 const w=await app.firstWindow({timeout:15000}).catch(e=>null);
 console.log('win', !!w); await app.close(); process.exit(0);
})();
