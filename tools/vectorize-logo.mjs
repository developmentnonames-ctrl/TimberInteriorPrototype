import sharp from 'sharp';
import potrace from 'potrace';
import { writeFileSync } from 'node:fs';

const SCALE = 8;
const src = sharp('assets-src/logo.png');
const { width, height } = await src.metadata();

const mask = await sharp('assets-src/logo.png')
  .extractChannel('alpha')
  .resize(width * SCALE, height * SCALE, { kernel: 'lanczos3' })
  .blur(SCALE * 0.55)
  .negate()
  .png()
  .toBuffer();

const svg = await new Promise((res, rej) =>
  potrace.trace(mask, { threshold: 128, turdSize: 20, optTolerance: 1.2, alphaMax: 1.25, color: '#000', background: 'transparent' }, (err, out) => (err ? rej(err) : res(out)))
);

const path = svg.match(/<path[^>]*d="([^"]+)"/)[1];
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width * SCALE} ${height * SCALE}" width="${width}" height="${height}"><path d="${path}" fill="#000" fill-rule="evenodd"/></svg>\n`;
writeFileSync('public/logo.svg', out);
console.log('public/logo.svg', (out.length / 1024).toFixed(1), 'KB');
