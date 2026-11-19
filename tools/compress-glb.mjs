import fs from 'node:fs';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

sharp.cache(false);
const IN = process.argv[2] || 'assets-src/models/chair-original.glb';
const OUT = process.argv[3] || 'public/models/chair.glb';

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(IN);

for (const tex of doc.getRoot().listTextures()) {
  if (tex.getMimeType() !== 'image/png') continue;
  const png = Buffer.from(tex.getImage());
  const { isOpaque } = await sharp(png).stats();
  if (!isOpaque) { console.log('keeping a PNG that uses transparency'); continue; }
  const jpg = await sharp(png).flatten().jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg').setURI(tex.getURI().replace(/\.png$/i, '.jpg'));
  console.log(`texture ${(png.length / 1024).toFixed(0)} KB png -> ${(jpg.length / 1024).toFixed(0)} KB jpg`);
}

await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14, quantizeTexcoord: 12 }));

await io.write(OUT, doc);
console.log(`${IN}: ${(fs.statSync(IN).size / 1024).toFixed(0)} KB -> ${OUT}: ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
