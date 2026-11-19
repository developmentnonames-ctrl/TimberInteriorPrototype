import fs from 'node:fs';
import sharp from 'sharp';

sharp.cache(false);
const SRC = 'assets-src/figures/laurent-woman.png';
const OUT = 'public/figures/laurent-woman-foot.webp';
const PATCHES = [
  { d: 'M 146 1323 C 180 1328, 222 1328, 258 1325', w: 5 },
  { d: 'M 364 1212 C 366 1208, 369 1205, 373 1202', w: 5 },
  { d: 'M 198 1040 C 210 1036, 222 1031, 234 1026', w: 5 },
  { d: 'M 931 734 C 925 766, 911 795, 885 814', w: 5 },
  { d: 'M 981 609 C 978 617, 975 623, 971 630', w: 4.5 },
];

const src = fs.readFileSync(SRC);
const { width, height } = await sharp(src).metadata();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${PATCHES.map((p) => `<path d="${p.d}" fill="none" stroke="#f3e8d4" stroke-width="${p.w}" stroke-linecap="round"/>`).join('')}</svg>`;
const out = await sharp(src).composite([{ input: Buffer.from(svg) }]).webp({ lossless: true, effort: 6 }).toBuffer();
fs.writeFileSync(OUT, out);
console.log(`${OUT}: ${width}x${height}, ${(out.length / 1024).toFixed(0)} KB`);
