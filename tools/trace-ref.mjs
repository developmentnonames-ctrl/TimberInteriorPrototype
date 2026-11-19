import sharp from 'sharp';
import potrace from 'potrace';
import { writeFileSync } from 'node:fs';

const [src, out, box, minR = '205', minG = '196', S = '2', strict] = process.argv.slice(2);
const boxes = strict ? strict.split(';').map((b) => b.split(',').map(Number)) : [];
const [left, top, width, height] = box.split(',').map(Number);
const s = +S;
const MAXRB = +(process.env.MAXRB || 75);
const { data, info } = await sharp(src).extract({ left, top, width, height }).resize(width * s, height * s, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const mask = Buffer.alloc(info.width * info.height);
for (let i = 0; i < mask.length; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  const x = left + (i % info.width) / s, y = top + Math.floor(i / info.width) / s;
  const inStrict = boxes.some((sb) => x >= sb[0] && x <= sb[0] + sb[2] && y >= sb[1] && y <= sb[1] + sb[3]);
  const [mr, mg] = inStrict ? [205, 196] : [+minR, +minG];
  mask[i] = r > mr && g > mg && r - b < MAXRB && r >= b ? 0 : 255;
}
const png = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } }).png().toBuffer();
writeFileSync(out.replace(/\.js$/, '-mask.png'), png);
potrace.trace(png, { turdSize: 25, optTolerance: 0.4 }, (err, svg) => {
  if (err) throw err;
  const d = svg.match(/ d="([^"]+)"/)[1];
  writeFileSync(out, `export const viewBox = '0 0 ${info.width} ${info.height}';\nexport const crop = { left: ${left}, top: ${top}, scale: ${s} };\nexport const path = ${JSON.stringify(d)};\n`);
  console.log('traced', d.length, 'chars');
});
