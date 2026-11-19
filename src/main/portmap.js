// 1.7.1 : ouvrir la « porte » des torrents sur la box internet, pour que les autres puissent venir vers toi.
// Code écrit pour DrYAE (aucune bibliothèque extérieure) :
//  - UPnP IGD : on cherche la box sur le réseau (SSDP), puis on lui demande d'ouvrir le port (TCP + UDP) ;
//  - NAT-PMP (RFC 6886) si la box ne parle pas UPnP.
// On sait aussi si le fournisseur partage l'adresse entre plusieurs clients (CGNAT) : la porte ne peut alors pas être ouverte.
// Et, sous Windows, si le pare-feu laisse entrer le moteur torrent (et, sur demande, on ajoute la règle avec l'accord de Windows).
const dgram = require('dgram');
const http = require('http');
const os = require('os');
const { execFile } = require('child_process');

const SSDP = { host: '239.255.255.250', port: 1900 };
const RULE = 'DrYAE (torrents)';
const DESC = 'DrYAE torrents';

// adresse privée ou partagée par le fournisseur (CGNAT 100.64.0.0/10) : la porte ne s'ouvre pas depuis la maison
function privateIp(ip) {
  const p = String(ip || '').split('.').map(Number); if (p.length !== 4 || p.some(x => !(x >= 0 && x <= 255))) return false;
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] === 127 || (p[0] === 169 && p[1] === 254);
}

function get(url, ms = 3000) {
  return new Promise((res, rej) => {
    const rq = http.get(url, { timeout: ms }, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c).toString('utf8'))); });
    rq.on('error', rej); rq.on('timeout', () => rq.destroy(new Error('timeout')));
  });
}
function soap(ctl, type, action, args = {}, ms = 4000) {
  const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${type}">${Object.entries(args).map(([k, v]) => `<${k}>${String(v).replace(/[<&>]/g, '')}</${k}>`).join('')}</u:${action}></s:Body></s:Envelope>`;
  return new Promise((res, rej) => {
    const u = new URL(ctl);
    const rq = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'POST', timeout: ms,
      headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPAction: `"${type}#${action}"`, 'Content-Length': Buffer.byteLength(body) } }, r => {
      const c = []; r.on('data', d => c.push(d)); r.on('end', () => { const t = Buffer.concat(c).toString('utf8'); r.statusCode === 200 ? res(t) : rej(new Error((/<errorDescription>([^<]*)/.exec(t) || [])[1] || 'HTTP ' + r.statusCode)); });
    });
    rq.on('error', rej); rq.on('timeout', () => rq.destroy(new Error('timeout'))); rq.end(body);
  });
}
const tag = (xml, t) => (new RegExp(`<(?:\\w+:)?${t}>\\s*([^<]*)\\s*</(?:\\w+:)?${t}>`, 'i').exec(xml) || [])[1] || '';

// adresse de ce PC vue depuis la box (celle qui va vers la passerelle)
function localIpFor(host) {
  return new Promise(res => {
    const s = dgram.createSocket('udp4');
    s.on('error', () => { try { s.close(); } catch {} res(null); });
    try { s.connect(9, host, () => { let a = null; try { a = s.address().address; } catch {} try { s.close(); } catch {} res(a); }); } catch { res(null); }
  });
}

// recherche de la box (SSDP) : renvoie l'adresse de sa description
function discover(ms = 2500, target = process.env.DRYAE_SSDP) {
  return new Promise(res => {
    const [h, p] = target ? target.split(':') : [SSDP.host, SSDP.port];
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: true }); const found = []; let done = false;
    const end = () => { if (done) return; done = true; try { s.close(); } catch {} res(found); };
    s.on('error', end);
    s.on('message', m => { const loc = /^location:\s*(.+)$/im.exec(m.toString()); if (loc && !found.includes(loc[1].trim())) found.push(loc[1].trim()); });
    s.bind(0, () => {
      for (const st of ['urn:schemas-upnp-org:device:InternetGatewayDevice:1', 'urn:schemas-upnp-org:device:InternetGatewayDevice:2', 'urn:schemas-upnp-org:service:WANIPConnection:1', 'urn:schemas-upnp-org:service:WANPPPConnection:1']) {
        const msg = Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: ${SSDP.host}:${SSDP.port}\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${st}\r\n\r\n`);
        s.send(msg, +p, h, () => {});
      }
    });
    setTimeout(end, ms);
  });
}
// service « WAN » de la box (celui qui ouvre les ports)
async function wanService(loc) {
  const xml = await get(loc);
  const base = tag(xml, 'URLBase') || loc;
  const re = /<service>([\s\S]*?)<\/service>/gi; let m;
  while ((m = re.exec(xml))) {
    const type = tag(m[1], 'serviceType');
    if (/WAN(IP|PPP)Connection:\d/.test(type)) return { type, ctl: new URL(tag(m[1], 'controlURL'), base).href, host: new URL(loc).hostname };
  }
  return null;
}

// ---- NAT-PMP ----
function natpmp(gw, op, port, life = 7200, ms = 1500) {
  return new Promise((res, rej) => {
    const s = dgram.createSocket('udp4'); const b = op === 0 ? Buffer.from([0, 0]) : Buffer.alloc(12);
    if (op) { b[1] = op; b.writeUInt16BE(port, 4); b.writeUInt16BE(port, 6); b.writeUInt32BE(life, 8); }
    const t = setTimeout(() => { try { s.close(); } catch {} rej(new Error('timeout')); }, ms);
    s.on('message', m => { clearTimeout(t); try { s.close(); } catch {} const code = m.readUInt16BE(2); if (code) return rej(new Error('NAT-PMP ' + code)); res(op === 0 ? m.slice(8, 12).join('.') : m.readUInt16BE(10)); });
    s.on('error', e => { clearTimeout(t); rej(e); });
    s.send(b, 5351, gw);
  });
}

// ---- pare-feu Windows ----
const isWin = process.platform === 'win32';
function firewallHas(exe) {
  if (!isWin) return Promise.resolve('n/a');
  return new Promise(res => execFile('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${RULE}`, 'verbose'], { windowsHide: true, timeout: 8000 }, (e, out) => {
    if (e) return res('missing');
    const s = String(out || '').toLowerCase();
    res(!exe || s.includes(String(exe).toLowerCase()) ? 'ok' : 'missing');
  }));
}
// règle ajoutée par Windows lui-même, avec la fenêtre « Autoriser cette application à apporter des modifications ? »
function firewallAdd(exe) {
  if (!isWin || !exe) return Promise.resolve(false);
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  const args = `advfirewall firewall delete rule name="${RULE}" & netsh advfirewall firewall add rule name="${RULE}" dir=in action=allow enable=yes profile=any program="${exe}"`;
  const ps = `Start-Process -FilePath cmd.exe -ArgumentList ${q('/c netsh ' + args)} -Verb RunAs -WindowStyle Hidden -Wait`;
  return new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 120000 }, e => res(!e)));
}

class PortMap {
  constructor() { this.state = { port: 0, box: 'pending', via: '', externalIp: '', cgnat: false, localIp: '', firewall: isWin ? 'unknown' : 'n/a', error: '' }; this.maps = []; this.timer = null; this.exe = null; }
  // ouvre le port (TCP + UDP) ; renouvelé toutes les heures
  async open(port, exe) {
    this.exe = exe || this.exe;
    if (this.state.port && this.state.port !== port) await this.close();
    this.state = { ...this.state, port, box: 'pending', via: '', error: '' };
    try {
      const locs = await discover();
      for (const loc of locs) {
        let svc = null; try { svc = await wanService(loc); } catch {}
        if (!svc) continue;
        const me = await localIpFor(svc.host); if (!me) continue;
        let ext = ''; try { ext = tag(await soap(svc.ctl, svc.type, 'GetExternalIPAddress'), 'NewExternalIPAddress'); } catch {}
        let ok = 0, err = '';
        for (const proto of ['TCP', 'UDP']) {
          for (const life of [0, 7200]) {
            try {
              await soap(svc.ctl, svc.type, 'AddPortMapping', { NewRemoteHost: '', NewExternalPort: port, NewProtocol: proto, NewInternalPort: port, NewInternalClient: me, NewEnabled: 1, NewPortMappingDescription: DESC, NewLeaseDuration: life });
              ok++; this.maps.push({ kind: 'upnp', svc, port, proto }); break;
            } catch (e) { err = e.message; }
          }
        }
        this.state = { ...this.state, localIp: me, externalIp: ext, cgnat: privateIp(ext), via: 'UPnP', box: ok ? 'ok' : 'refused', error: ok ? '' : err };
        if (ok) break;
      }
      if (this.state.box !== 'ok') {
        // NAT-PMP : la box est en général la première adresse du réseau
        const me = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal && privateIp(i.address) && !/^100\./.test(i.address));
        const gw = process.env.DRYAE_NATPMP || (me ? me.address.replace(/\.\d+$/, '.1') : null);
        if (gw) {
          try {
            const ext = await natpmp(gw, 0);
            await natpmp(gw, 2, port); await natpmp(gw, 1, port);
            this.maps.push({ kind: 'pmp', gw, port });
            this.state = { ...this.state, via: 'NAT-PMP', externalIp: ext, cgnat: privateIp(ext), box: 'ok', localIp: me?.address || '', error: '' };
          } catch {}
        }
      }
      if (this.state.box === 'pending') this.state.box = 'none';
    } catch (e) { this.state = { ...this.state, box: 'none', error: e.message }; }
    this.state.firewall = await firewallHas(this.exe);
    clearInterval(this.timer); this.timer = setInterval(() => this.open(port).catch(() => {}), 55 * 60 * 1000); this.timer.unref?.();
    return this.status();
  }
  async close() {
    clearInterval(this.timer); this.timer = null;
    const maps = this.maps; this.maps = [];
    await Promise.all(maps.map(m => (m.kind === 'upnp'
      ? soap(m.svc.ctl, m.svc.type, 'DeletePortMapping', { NewRemoteHost: '', NewExternalPort: m.port, NewProtocol: m.proto }, 1500)
      : Promise.all([natpmp(m.gw, 1, m.port, 0, 800), natpmp(m.gw, 2, m.port, 0, 800)])).catch(() => {})));
  }
  async allowFirewall() { const ok = await firewallAdd(this.exe); this.state.firewall = await firewallHas(this.exe); return ok && this.state.firewall === 'ok'; }
  // bilan pour le voyant : 'open' (les autres peuvent venir), 'cgnat', 'firewall', 'box', 'pending'
  status() {
    const s = this.state;
    const verdict = s.box === 'pending' ? 'pending' : s.cgnat ? 'cgnat' : s.box !== 'ok' ? 'box' : s.firewall === 'missing' ? 'firewall' : 'open';
    return { ...s, verdict };
  }
}

module.exports = { PortMap, privateIp, RULE };
