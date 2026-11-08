// Après la signature, l'installateur change : on met à jour l'empreinte et la taille dans latest.yml
// (sinon la mise à jour en un clic refuserait le fichier). Le .blockmap, devenu faux, est retiré :
// DrYAE téléchargera alors la mise à jour en entier, ce qui marche toujours.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.argv[2] || path.join(__dirname, '..', 'dist', 'installer');
const yml = path.join(dir, 'latest.yml');
let y = fs.readFileSync(yml, 'utf8');
const file = /path:\s*(.+)/.exec(y)[1].trim();
const buf = fs.readFileSync(path.join(dir, file));
const sha = crypto.createHash('sha512').update(buf).digest('base64');
y = y.replace(/sha512:\s*\S+/g, 'sha512: ' + sha).replace(/size:\s*\d+/, 'size: ' + buf.length);
fs.writeFileSync(yml, y);
fs.rmSync(path.join(dir, file + '.blockmap'), { force: true });
console.log('latest.yml mis à jour :', file, buf.length, 'octets');
