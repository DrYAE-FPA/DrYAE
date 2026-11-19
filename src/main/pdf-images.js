// 1.7.1 : PDF fait d'images JPEG, une page par image, à la taille exacte de l'image (plus de page blanche entre deux pages).
// Code écrit pour DrYAE (format PDF 1.4 de base : chaque JPEG est gardé tel quel, sans recompression).
function jpegSize(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if ((m >= 0xC0 && m <= 0xC3) || (m >= 0xC5 && m <= 0xC7) || (m >= 0xC9 && m <= 0xCB) || (m >= 0xCD && m <= 0xCF)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), comps: b[i + 9] };
    }
    i += 2 + len;
  }
  return null;
}
function imagesToPdf(jpegs) {
  const objs = []; // texte ou Buffer de chaque objet (numéros à partir de 1)
  const add = o => { objs.push(o); return objs.length; };
  const catalog = add(null), pages = add(null), kids = [];
  for (const j of jpegs) {
    const s = jpegSize(j); if (!s || !s.w || !s.h) continue;
    // 1 pixel = 0,75 point (96 ppp) : taille d'écran ; les grandes images restent nettes, rien n'est réduit
    const W = +(s.w * 0.75).toFixed(2), H = +(s.h * 0.75).toFixed(2);
    const cs = s.comps === 1 ? '/DeviceGray' : s.comps === 4 ? '/DeviceCMYK' : '/DeviceRGB';
    const img = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${s.w} /Height ${s.h} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode${s.comps === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : ''} /Length ${j.length} >>\nstream\n`), j, Buffer.from('\nendstream')]));
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    const content = add(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]; let pos = parts[0].length; const xref = [];
  objs.forEach((o, i) => {
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(o) ? o : Buffer.from(o, 'latin1'), Buffer.from('\nendobj\n')]);
    xref.push(pos); parts.push(b); pos += b.length;
  });
  const x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(Buffer.from(x, 'latin1'));
  return { pdf: Buffer.concat(parts), pages: kids.length };
}
module.exports = { imagesToPdf, jpegSize };
