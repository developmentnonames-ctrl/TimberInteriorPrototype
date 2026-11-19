import fs from 'node:fs';
import sharp from 'sharp';

sharp.cache(false);
const GROUPS = [
  { srcs: fs.readdirSync('public/cutouts').filter((f) => f.endsWith('.webp') && !/-\d+w\.webp$/.test(f)).map((f) => `/cutouts/${f}`), master: (s) => `assets-src${s.replace(/\.webp$/, '.png')}`, widths: [320, 480], webp: { quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true } },
  { srcs: ['craftsman', 'pencil', 'meet-kaia', 'meet-j', 'spaces-hotel', 'spaces-cafe', 'spaces-retreat'].map((n) => `/images/${n}.jpg`), master: (s) => `public${s}`, widths: [480, 800], webp: { quality: 84, effort: 6 } },
  { srcs: ['laurent', 'otto', 'marcel', 'kaizen'].map((n) => `/images/scenes/${n}.jpg`), master: (s) => `public${s}`, widths: [1280, 1920], webp: { quality: 84, effort: 6 } },
];

const out = {};
let saved = 0;
for (const g of GROUPS) {
  for (const src of g.srcs) {
    const master = fs.readFileSync(g.master(src));
    const { width } = await sharp(master).metadata();
    const set = [];
    for (const w of g.widths.filter((size) => size < width)) {
      const file = src.replace(/\.(webp|jpg)$/, `-${w}w.webp`);
      const buf = await sharp(master).resize({ width: w }).webp(g.webp).toBuffer();
      fs.writeFileSync(`public${file}`, buf);
      set.push(`${file} ${w}w`);
    }
    set.push(`${src} ${width}w`);
    out[src] = set.join(', ');
    saved += set.length - 1;
  }
}
fs.writeFileSync('src/data/srcset.json', JSON.stringify(out, null, 2) + '\n');
console.log(`${saved} smaller copies written, src/data/srcset.json updated (${Object.keys(out).length} images)`);
