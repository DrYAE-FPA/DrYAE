/* DrYAE — petit générateur de documents Word (.docx), sans bibliothèque externe.
   Sert à l'export des collections : titres, paragraphes, citations, notes, liens et images PNG.
   Le fichier est une archive ZIP construite ici (compression zlib de Node). */
'use strict';
const zlib = require('zlib');

// ---------- ZIP minimal ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const parts = [], central = []; let off = 0;
  for (const [name, data0] of files) {
    const data = Buffer.isBuffer(data0) ? data0 : Buffer.from(data0, 'utf8');
    const def = zlib.deflateRawSync(data); const n = Buffer.from(name, 'utf8'); const crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(0, 10);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(def.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, n, def);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt32LE(0, 12);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(def.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, n); off += 30 + n.length + def.length;
  }
  const cd = Buffer.concat(central); const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}

// ---------- document ----------
const x = s => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const run = (t, rpr = '') => String(t).split('\n').map((l, i) => (i ? '<w:r><w:br/></w:r>' : '') + `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(l)}</w:t></w:r>`).join('');
function makeDocx(blocks, o = {}) {
  const lang = o.lang || 'fr-FR', rtl = /^ar/.test(lang);
  const media = [], rels = [], body = [];
  let rid = 10;
  for (const b of blocks) {
    const bidi = rtl ? '<w:bidi/>' : '';
    if (b.h) body.push(`<w:p><w:pPr><w:pStyle w:val="Heading${b.h}"/>${bidi}</w:pPr>${run(b.text)}</w:p>`);
    else if (b.img) {
      const id = 'rId' + (++rid), n = media.length + 1;
      media.push([`word/media/image${n}.png`, b.img.png]);
      rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${n}.png"/>`);
      const maxW = 5900000, emu = 9525; let cx = b.img.w * emu, cy = b.img.h * emu; if (cx > maxW) { cy = Math.round(cy * maxW / cx); cx = maxW; }
      body.push(`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Image ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="image${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
    } else if (b.link) {
      const id = 'rId' + (++rid);
      rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(b.link)}" TargetMode="External"/>`);
      body.push(`<w:p><w:pPr><w:pStyle w:val="Source"/>${bidi}</w:pPr><w:hyperlink r:id="${id}">${run(b.text, '<w:rStyle w:val="Hyperlink"/>')}</w:hyperlink></w:p>`);
    } else body.push(`<w:p><w:pPr><w:pStyle w:val="${b.quote ? 'Quote' : b.note ? 'Note' : b.small ? 'Source' : 'Normal'}"/>${bidi}</w:pPr>${run(b.text)}</w:p>`);
  }
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const L = `<w:lang w:val="${lang}" w:eastAsia="${lang}" w:bidi="${lang}"/>`;
  const st = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"${id === 'Normal' ? ' w:default="1"' : ''}><w:name w:val="${name}"/>${id !== 'Normal' ? '<w:basedOn w:val="Normal"/>' : ''}${extra}<w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/>${L}</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    + st('Normal', 'Normal', '', '')
    + st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="0" w:after="240"/><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="4C1D95"/><w:sz w:val="40"/><w:szCs w:val="40"/>', '<w:next w:val="Normal"/><w:qFormat/>')
    + st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/>', '<w:b/><w:color w:val="1F2937"/><w:sz w:val="28"/><w:szCs w:val="28"/>', '<w:next w:val="Normal"/><w:qFormat/>')
    + st('Quote', 'Quote', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="7C3AED"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F5F3FF"/><w:ind w:left="284"/>', '<w:i/>', '<w:qFormat/>')
    + st('Note', 'Note', '<w:shd w:val="clear" w:color="auto" w:fill="FFF7D6"/>', '')
    + st('Source', 'Source', '<w:spacing w:after="160"/>', '<w:color w:val="555555"/><w:sz w:val="18"/><w:szCs w:val="18"/>')
    + `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="2563EB"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:themeFontLang w:val="${lang}"/></w:settings>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(o.title || '')}</dc:title><dc:creator>DrYAE</dc:creator><dc:language>${lang}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${rels.join('')}</Relationships>`],
    ['word/document.xml', doc],
    ['word/styles.xml', styles],
    ['word/settings.xml', settings],
    ...media,
  ]);
}
module.exports = { makeDocx, zip };
