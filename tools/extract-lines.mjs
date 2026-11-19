import sharp from 'sharp';

const [src, out, box, S = '2', strict] = process.argv.slice(2);
const [left, top, width, height] = box.split(',').map(Number);
const s = +S;
const boxes = strict ? strict.split(';').map((b) => b.split(',').map(Number)) : [];
const CH = process.env.CHANNEL === 'R' ? 0 : 2;
const LINE_B = CH === 0 ? 245 : 212;
const LIGHTBG = +(process.env.LIGHTBG || 999), ABS_LO = +(process.env.ABS_LO || 172), ABS_HI = +(process.env.ABS_HI || 225);

const { data, info } = await sharp(src).extract({ left, top, width, height }).resize(width * s, height * s, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const B = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) B[i] = data[i * 3 + CH];

const R = 4 * s;
const tmp = new Float32Array(W * H), bg = new Float32Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let m = 255;
    for (let k = -R; k <= R; k++) { const xx = Math.min(W - 1, Math.max(0, x + k)); m = Math.min(m, B[y * W + xx]); }
    tmp[y * W + x] = m;
  }
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let m = 255;
    for (let k = -R; k <= R; k++) { const yy = Math.min(H - 1, Math.max(0, y + k)); m = Math.min(m, tmp[yy * W + x]); }
    bg[y * W + x] = m;
  }

const smooth = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const outBuf = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const x = left + (i % W) / s, y = top + Math.floor(i / W) / s;
  const strictHere = boxes.some((b) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]);
  const raw = (B[i] - bg[i]) / Math.max(30, LINE_B - bg[i]);
  const strictA = process.env.STRICT_ABS ? smooth(186, 204, B[i]) : smooth(0.28, 0.68, raw);
  const base = bg[i] > LIGHTBG ? smooth(ABS_LO, ABS_HI, B[i]) : smooth(0.2, 0.58, raw);
  const a = Math.min(1, 1.25 * (strictHere ? strictA : base));
  outBuf[i * 4] = 243; outBuf[i * 4 + 1] = 232; outBuf[i * 4 + 2] = 212;
  outBuf[i * 4 + 3] = Math.round(a * 255);
}
await sharp(outBuf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
console.log('wrote', out, W, 'x', H);
