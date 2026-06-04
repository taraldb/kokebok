const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '../../public/assets/logo.png');
const out = path.join(__dirname, '../../public/assets');

const resizeOpts = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } };

Promise.all([
  sharp(src).trim().resize(32, 32, resizeOpts).toFile(path.join(out, 'favicon-32.png')),
  sharp(src).trim().resize(180, 180, resizeOpts).toFile(path.join(out, 'apple-touch-icon.png')),
]).then(() => console.log('Favicons generated: favicon-32.png, apple-touch-icon.png'));
