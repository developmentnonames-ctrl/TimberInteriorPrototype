import fs from 'node:fs';

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=Caveat:wght@500&family=Manrope:wght@200..800&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const css = await (await fetch(CSS_URL, { headers: { 'user-agent': UA } })).text();
fs.mkdirSync('public/fonts', { recursive: true });

const files = new Map();
let out = '';
for (const block of css.split('}').filter((b) => b.includes('@font-face'))) {
  const subset = (block.match(/\/\*\s*([\w-]+)\s*\*\//) || [null, 'all'])[1];
  const family = block.match(/font-family:\s*'([^']+)'/)[1];
  const url = block.match(/url\(([^)]+)\)/)[1];
  if (!files.has(url)) {
    const name = `${family.toLowerCase()}-${subset}.woff2`;
    fs.writeFileSync(`public/fonts/${name}`, Buffer.from(await (await fetch(url)).arrayBuffer()));
    files.set(url, name);
  }
  out += block.replace(/\/\*[^*]*\*\//, '').replace(url, `/fonts/${files.get(url)}`).trim() + '\n}\n';
}
fs.writeFileSync('src/styles/fonts.css', out);
console.log(`${files.size} font files -> public/fonts, src/styles/fonts.css written`);
