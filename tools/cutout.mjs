import { removeBackground } from '@imgly/background-removal-node';
import sharp from '../node_modules/@imgly/background-removal-node/node_modules/sharp/lib/index.js';

for (const arg of process.argv.slice(2)) {
  const [name, box] = arg.split(':');
  let img = sharp(`assets-src/images/${name}.jpg`);
  if (box) {
    const [left, top, width, height] = box.split(',').map(Number);
    img = img.extract({ left, top, width, height });
  }
  const buf = await img.png().toBuffer();
  const blob = await removeBackground(new Blob([buf], { type: 'image/png' }), { model: process.env.MODEL || 'medium', output: { format: 'image/png' } });
  const out = Buffer.from(await blob.arrayBuffer());
  await sharp(out).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toFile(`assets-src/cutouts/${name}.png`);
  const m = await sharp(`assets-src/cutouts/${name}.png`).metadata();
  console.log(name, m.width, 'x', m.height);
}
