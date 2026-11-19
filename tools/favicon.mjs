import fs from 'node:fs';
import sharp from 'sharp';

sharp.cache(false);
const logo = fs.readFileSync('public/logo.svg', 'utf8');
const [, , LW, LH] = logo.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const path = logo.match(/<path[\s\S]*?\/>/)[0];
const S = Math.round(LW / 0.8);
const tx = (S - LW) / 2, ty = (S - LH) / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#000"/><g transform="translate(${tx} ${ty})" fill="#fff" fill-rule="evenodd">${path.replace(/\s(fill|fill-rule)="[^"]*"/g, '')}</g></svg>`;
fs.writeFileSync('public/favicon.svg', svg);

const sizes = { 'favicon-32.png': 32, 'favicon-48.png': 48, 'apple-touch-icon.png': 180 };
for (const [name, px] of Object.entries(sizes)) {
  await sharp(Buffer.from(svg), { density: Math.ceil((72 * px) / S) * 4 }).resize(px, px).png({ compressionLevel: 9 }).toFile(`public/${name}`);
}
console.log('favicon.svg +', Object.keys(sizes).join(', '));
