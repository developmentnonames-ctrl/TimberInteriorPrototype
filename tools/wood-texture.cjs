const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1000 });
  const dataUrl = await p.evaluate(() => {
    const W = 1920, H = 1200;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    let s = 1234567;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const N = 256, perm = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) perm[i] = rnd();
    const at = (x, y) => perm[((y & (N - 1)) * N) + (x & (N - 1))];
    const sm = (t) => t * t * (3 - 2 * t);
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const n00 = at(xi, yi), n10 = at(xi + 1, yi), n01 = at(xi, yi + 1), n11 = at(xi + 1, yi + 1);
      return n00 + (n10 - n00) * xf + (n01 - n00) * yf + (n00 - n10 - n01 + n11) * xf * yf;
    };
    const fbm = (x, y, o) => { let v = 0, amp = 0.5, f = 1; for (let i = 0; i < o; i++) { v += amp * noise(x * f, y * f); f *= 2; amp *= 0.5; } return v; };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + 220 * (fbm(x / 900, y / 600, 3) - 0.5);
        const wy = y + 55 * (fbm(x / 600 + 7, y / 420, 3) - 0.5);
        const dx = (wx + W * 0.1) * 0.2, dy = wy - H * 0.58;
        const r = Math.sqrt(dx * dx + dy * dy);
        const ring = r / 36 + 1.8 * fbm(r / 220, x / 1600, 2);
        const fr = ring - Math.floor(ring);
        const late = Math.pow(fr, 7) * 0.95 + Math.pow(Math.max(0, Math.sin(fr * Math.PI)), 14) * 0.25;
        const pores = Math.max(0, fbm(x / 90, y / 1.4, 2) - 0.58) * 1.8;
        const tone = 0.10 + 0.05 * fbm(x / 700, y / 500, 3);
        const a = Math.min(1, tone + late * 0.42 + pores * 0.35);
        const i = (y * W + x) * 4;
        img.data[i] = 92; img.data[i + 1] = 58; img.data[i + 2] = 28; img.data[i + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(process.argv[2] || 'wood.png', Buffer.from(dataUrl.split(',')[1], 'base64'));
  await p.setContent(`<style>body{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#555}
    .s{position:relative;height:1000px;background:#dcb985;overflow:hidden;display:grid;place-items:center}
    .s::before{content:'';position:absolute;inset:0;background:url(${dataUrl}) center/cover;opacity:var(--o)}
    .s b{position:relative;color:#f3e8d4;font:800 96px/0.86 Arial;text-align:center;text-transform:uppercase}</style>
    <div class="s" style="--o:.5"><b>People<br>ignore<br>design<br>that<br>ignores<br>people.</b></div>
    <div class="s" style="--o:.75"><b>People<br>ignore<br>design<br>that<br>ignores<br>people.</b></div>`);
  await new Promise((r) => setTimeout(r, 800));
  await p.screenshot({ path: 'woodgen-preview.png' });
  await b.close();
})();
