// 1.7.1 : torrents plus rapides — porte ouverte sur la box (UPnP, faux routeur local), CGNAT repéré, file d'attente des torrents
const dgram = require('dgram'); const http = require('http'); const path = require('path');
const ok = (n, v, x) => console.log((v ? 'OK  ' : 'ÉCHEC ') + n, x !== undefined ? JSON.stringify(x).slice(0, 300) : '');
(async () => {
  let ext = '81.10.20.30', refuse = false; const maps = [], dels = [];
  const web = http.createServer((q, r) => {
    if (q.url === '/desc.xml') return r.end(`<?xml version="1.0"?><root><device><deviceList><device><serviceList><service><serviceType>urn:schemas-upnp-org:service:WANIPConnection:1</serviceType><controlURL>/ctl</controlURL></service></serviceList></device></deviceList></device></root>`);
    let b = ''; q.on('data', d => (b += d)); q.on('end', () => {
      const act = /#(\w+)"/.exec(q.headers.soapaction || '')[1];
      if (act === 'GetExternalIPAddress') return r.end(`<s:Envelope><s:Body><u:GetExternalIPAddressResponse><NewExternalIPAddress>${ext}</NewExternalIPAddress></u:GetExternalIPAddressResponse></s:Body></s:Envelope>`);
      if (act === 'AddPortMapping') { if (refuse) { r.statusCode = 500; return r.end('<errorDescription>ConflictInMappingEntry</errorDescription>'); } maps.push({ port: /<NewExternalPort>(\d+)/.exec(b)[1], proto: /<NewProtocol>(\w+)/.exec(b)[1], client: /<NewInternalClient>([^<]+)/.exec(b)[1] }); return r.end('<ok/>'); }
      if (act === 'DeletePortMapping') { dels.push(/<NewProtocol>(\w+)/.exec(b)[1]); return r.end('<ok/>'); }
      r.statusCode = 500; r.end();
    });
  }).listen(0, '127.0.0.1');
  await new Promise(r => web.on('listening', r));
  const ssdp = dgram.createSocket('udp4');
  ssdp.on('message', (m, rinfo) => { if (/M-SEARCH/.test(m)) ssdp.send(Buffer.from(`HTTP/1.1 200 OK\r\nST: x\r\nLOCATION: http://127.0.0.1:${web.address().port}/desc.xml\r\n\r\n`), rinfo.port, rinfo.address); });
  await new Promise(r => ssdp.bind(0, '127.0.0.1', r));
  process.env.DRYAE_SSDP = '127.0.0.1:' + ssdp.address().port; process.env.DRYAE_NATPMP = '127.0.0.1';
  const { PortMap, privateIp } = require('../src/main/portmap');
  const pm = new PortMap();
  let st = await pm.open(45123, null);
  ok('porte ouverte sur la box (UPnP)', st.verdict === 'open' && st.via === 'UPnP', st);
  ok('TCP et UDP ouverts vers ce PC', maps.map(m => m.proto).sort().join() === 'TCP,UDP' && maps.every(m => m.port === '45123' && m.client === '127.0.0.1'), maps);
  await pm.close();
  ok('porte refermée en quittant', dels.sort().join() === 'TCP,UDP', dels);
  ext = '100.72.4.9'; st = await pm.open(45123, null);
  ok('adresse partagée par le fournisseur (CGNAT) repérée', st.verdict === 'cgnat', st); await pm.close();
  ext = '81.10.20.30'; refuse = true; st = await pm.open(45123, null);
  ok('box qui refuse : voyant « fermée »', st.verdict === 'box' && /Conflict/.test(st.error), st); await pm.close();
  ok('adresses privées reconnues', privateIp('192.168.1.4') && privateIp('100.64.0.1') && !privateIp('41.202.1.1'));
  // file d'attente des torrents
  const mk = (id, type, status, done, size, speed = 0) => ({ id, type, status, size, speed, host: type === 'torrent' ? '' : 'site.test', downloaded: () => done, started: 0, start() { this.started++; this.status = 'running'; } });
  const ctx = { settings: { get: () => ({ parallel: 3, siteLimits: [], perSite: 0, torrent: { maxActive: 3 } }) } };
  const list = [mk(1, 'torrent', 'running', 10, 100), mk(2, 'torrent', 'running', 10, 100), mk(3, 'torrent', 'queued', 5, 100), mk(4, 'torrent', 'queued', 90, 100), mk(5, 'torrent', 'queued', 50, 100), mk(6, 'http', 'queued', 0, 100)];
  const sched = require('../src/main/manager').Manager.prototype.schedule;
  sched.call({ ...ctx, list });
  ok('3 torrents actifs au plus, le plus avancé d\'abord', list[3].started === 1 && list[2].started === 0 && list[4].started === 0, list.map(d => d.status));
  ok('les fichiers normaux ne sont pas bloqués par les torrents', list[5].started === 1);
  list[0]._slowSince = Date.now() - 200000; sched.call({ ...ctx, list });
  ok('un torrent bloqué depuis 3 min laisse sa place', list[4].started === 1 && list[2].started === 0, list.map(d => d.status));
  web.close(); ssdp.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
