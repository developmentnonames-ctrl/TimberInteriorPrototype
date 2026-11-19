import fs from 'node:fs';
import sharp from 'sharp';

sharp.cache(false);
const SETS = [
  ['cutouts', { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true }],
  ['figures', { lossless: true, effort: 6 }],
];
let before = 0, after = 0;
for (const [dir, opts] of SETS) {
  for (const f of fs.readdirSync(`assets-src/${dir}`).filter((name) => name.endsWith('.png'))) {
    const src = fs.readFileSync(`assets-src/${dir}/${f}`);
    const out = await sharp(src).webp(opts).toBuffer();
    fs.writeFileSync(`public/${dir}/${f.replace(/\.png$/, '.webp')}`, out);
    before += src.length; after += out.length;
    console.log(`${(src.length / 1024).toFixed(0).padStart(5)} KB -> ${(out.length / 1024).toFixed(0).padStart(4)} KB  ${dir}/${f}`);
  }
}
console.log(`total ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
