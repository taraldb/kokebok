const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '../../public/assets/logo.png');
const out = path.join(__dirname, '../../public/assets');

Promise.all([
  sharp(src).resize(32, 32).toFile(path.join(out, 'favicon-32.png')),
  sharp(src).resize(180, 180).toFile(path.join(out, 'apple-touch-icon.png')),
]).then(() => console.log('Favicons generated: favicon-32.png, apple-touch-icon.png'));
