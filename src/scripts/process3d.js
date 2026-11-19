import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const raf = globalThis.requestAnimationFrame
  ? (f) => globalThis.requestAnimationFrame(f)
  : (f) => setTimeout(() => f(performance.now()), 16);
const caf = globalThis.cancelAnimationFrame ? (id) => globalThis.cancelAnimationFrame(id) : (id) => clearTimeout(id);
const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

function dequantize(model) {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    for (const name of Object.keys(g.attributes)) {
      const a = g.attributes[name];
      if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue;
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    o.matrix.identity(); o.matrix.decompose(o.position, o.quaternion, o.scale);
    let p = o.parent;
    while (p && p !== model) { p.position.set(0, 0, 0); p.quaternion.identity(); p.scale.set(1, 1, 1); p = p.parent; }
  });
  model.updateMatrixWorld(true);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const MODEL_URL = '/models/chair.glb';
const STRANDS = 56;

function oakFloorTexture() {
  const c = makeCanvas(1024, 1024);
  const g = c.getContext('2d');
  const planks = 8;
  for (let i = 0; i < planks; i++) {
    const y = (i * 1024) / planks, h = 1024 / planks;
    const l = 196 + Math.random() * 16;
    g.fillStyle = `rgb(${l}, ${l - 30}, ${l - 72})`;
    g.fillRect(0, y, 1024, h);
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = `rgba(120, 80, 40, ${0.05 + Math.random() * 0.08})`;
      g.lineWidth = 1 + Math.random() * 2;
      const yy = y + Math.random() * h;
      g.beginPath(); g.moveTo(0, yy);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, yy + Math.sin(x * 0.01 + k) * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(80, 50, 25, 0.25)';
    g.fillRect(0, y, 1024, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7.5, 3);
  return t;
}

function chairMaterial(src, u, height, cells) {
  const m = new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uReveal: u.uReveal, uWeave: u.uWeave, uCushion: u.uCushion, uHeight: { value: height }, uStrands: { value: STRANDS }, uCells: { value: cells } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNorm;
        uniform float uReveal, uWeave, uCushion, uHeight, uStrands, uCells;
        float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float n3(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float hN = vWPos.y / uHeight;
        float cutT = hN;
        float edge = uReveal * 1.1 - 0.03;
        if (uReveal < 0.999) {
          cutT += (n3(vWPos * 14.0) - 0.5) * 0.07;
          if (cutT > edge) discard;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 tex = diffuseColor.rgb;
        float cushion = smoothstep(0.12, 0.3, tex.r - max(tex.g, tex.b) * 1.15);
        float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
        float lumSoft = dot(texture2D(map, vMapUv, 2.5).rgb, vec3(0.2126, 0.7152, 0.0722));
        float ao = mix(0.62, 1.0, smoothstep(0.004, 0.04, lumSoft));
        vec3 cane = vec3(0.80, 0.66, 0.46);
        if (uWeave < 0.999) cane *= 0.86 + 0.14 * n3(vWPos * vec3(60.0, 6.0, 60.0));
        float band = floor(hN * uStrands) / uStrands;
        float woven = step(band, uWeave * 1.02 - 0.0001);

        float pitch = uHeight / uStrands;
        vec3 wn = normalize(vWNorm);
        float flatF = smoothstep(0.55, 0.9, abs(wn.y));
        float wv = mix(vWPos.y, length(vWPos.xz), flatF) / pitch;
        float rowI = floor(wv);
        float ws = atan(vWPos.z, vWPos.x) / 6.28318530718 * uCells + mod(rowI, 2.0) * 0.5;
        float segI = floor(ws);
        float fv = fract(wv), fs = fract(ws);
        float cs = fs - 0.5;
        float acrossF = pow(max(sin(fv * 3.14159265), 0.0), 0.55);
        float run = smoothstep(0.5, 0.28, abs(cs));
        float strandH = acrossF * (0.5 + 0.5 * run);
        float sx = (0.5 - abs(cs)) / 0.14;
        float stakeH = 0.8 * sqrt(max(0.0, 1.0 - sx * sx));
        float wvH = max(strandH, stakeH);
        float onStake = step(strandH, stakeH);
        float wsA = atan(vWPos.z, vWPos.x) / 6.28318530718 * uCells;
        float dsx = dFdx(wsA), dsy = dFdy(wsA);
        dsx -= uCells * floor(dsx / uCells + 0.5);
        dsy -= uCells * floor(dsy / uCells + 0.5);
        float detailS = 1.0 - smoothstep(0.16, 0.38, abs(dsx) + abs(dsy));
        float detailV = 1.0 - smoothstep(0.3, 0.72, fwidth(wv));
        float seg = mix(1.0, 0.88 + 0.24 * h3(vec3(rowI, segI, 7.0)), detailS);
        float fibre = 0.0;
        if (detailS > 0.001) fibre = (n3(vec3(ws * 10.0, wv * 1.4, rowI)) - 0.5) * detailS;
        vec3 gapCol = vec3(0.016, 0.009, 0.005);
        vec3 midCol = vec3(0.098, 0.052, 0.026);
        vec3 hiCol  = vec3(0.19, 0.105, 0.05);
        vec3 strand = mix(midCol, hiCol, clamp(run * acrossF * 0.8 + fibre * 0.35, 0.0, 1.0)) * seg;
        vec3 stake = mix(midCol * 0.78, hiCol * 0.82, stakeH);
        vec3 full = mix(gapCol, mix(strand, stake, onStake), smoothstep(0.04, 0.4, wvH));
        float rowsH = acrossF * 0.8;
        vec3 rows = mix(gapCol, mix(midCol, hiCol, clamp(acrossF * 0.5 + fibre * 0.3, 0.0, 1.0)), smoothstep(0.04, 0.4, rowsH));
        float wvHf = mix(rowsH, wvH, detailS);
        vec3 wicker = mix(mix(gapCol, midCol, 0.8), mix(rows, full, detailS), detailV) * ao;

        float ct = smoothstep(0.04, 0.16, lum);
        vec3 burnt = mix(vec3(0.16, 0.036, 0.011), vec3(0.46, 0.108, 0.03), ct);
        vec2 fp = (abs(wn.y) > 0.6 ? vWPos.xz : (abs(wn.x) > abs(wn.z) ? vWPos.zy : vWPos.xy)) / (pitch * 0.16);
        float canvas = 0.5 + 0.5 * sin(fp.x * 6.2832) * sin(fp.y * 6.2832);
        float fabDetail = 1.0 - smoothstep(0.12, 0.3, max(fwidth(fp.x), fwidth(fp.y)));
        burnt *= 1.0 + (canvas - 0.5) * 0.09 * fabDetail;

        vec3 col = mix(cane, wicker, woven * (1.0 - cushion));
        vec3 muslin = vec3(0.79, 0.73, 0.62);
        if (uCushion < 0.999) muslin *= 0.94 + 0.06 * n3(vWPos * 40.0);
        col = mix(col, mix(muslin, burnt, uCushion), cushion);
        diffuseColor.rgb = col;
        float wvAmt = woven * (1.0 - cushion) * detailV;
        float fabAmt = cushion * uCushion * fabDetail;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.9, 0.52, smoothstep(0.3, 0.95, wvHf)), wvAmt);
        roughnessFactor = mix(roughnessFactor, 0.96, cushion);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float bh = wvHf * wvAmt * pitch * 0.42 + canvas * fabAmt * pitch * 0.035;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dFdx(bh) * r1 + dFdy(bh) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.62, 0.28) * smoothstep(0.04, 0.0, edge - cutT) * step(uReveal, 0.999) * 0.9;`);
  };
  return m;
}

const NOISE = `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;
const DRAWN = 'float drawn = (1.0 - vWPos.y / uHeight) * 0.78 + n3(vWPos * 18.0) * 0.22;';
const visibleAt = (lag) => `(drawn <= ${(1.16 - lag).toFixed(2)})`;
const GRAPHITE = 'vec3(0.24, 0.205, 0.17)';

function contourMaterial(u, height, { thick, jitter, seed, alpha, lag, breaks }) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    uniforms: { uFade: u.uFade, uHeight: { value: height } },
    vertexShader: `
      varying vec3 vWPos;${NOISE}
      void main() {
        float j = n3(position * 9.0 + ${seed.toFixed(1)}) - 0.5;
        vec4 wp = modelMatrix * vec4(position + normal * (${thick.toFixed(4)} + j * ${jitter.toFixed(4)}), 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uFade, uHeight; varying vec3 vWPos;${NOISE}
      void main() {
        ${DRAWN}
        if (!${visibleAt(lag)}) discard;
        if (n3(vWPos * vec3(46.0) + ${seed.toFixed(1)}) < ${breaks.toFixed(2)}) discard;
        gl_FragColor = vec4(${GRAPHITE}, ${alpha.toFixed(2)} * uFade);
      }`,
  });
}

function sketchFillMaterial(u, height, paper) {
  return new THREE.ShaderMaterial({
    transparent: true,
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    uniforms: { uFade: u.uFade, uShade: u.uShade, uHeight: { value: height }, uPaper: { value: new THREE.Color(paper) }, uLight: { value: new THREE.Vector3(-0.5, 0.75, 0.45).normalize() } },
    vertexShader: `
      varying vec3 vWPos; varying vec3 vN;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uFade, uShade, uHeight; uniform vec3 uPaper, uLight; varying vec3 vWPos; varying vec3 vN;${NOISE}
      float hatch(vec2 p, float ang, float spacing, float tone) {
        float c = cos(ang), s = sin(ang);
        float d = abs(fract((c * p.x + s * p.y) / spacing) - 0.5) * spacing;
        float w = tone * spacing * 0.32;
        return 1.0 - smoothstep(w, w + 0.9, d);
      }
      void main() {
        ${DRAWN}
        if (!${visibleAt(0)}) discard;
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWPos);
        if (!gl_FrontFacing) N = -N;
        float facing = abs(dot(N, V));
        float rim = 1.0 - smoothstep(0.12, 0.3, facing);
        float fold = smoothstep(0.18, 0.45, length(fwidth(N)) * 2.2);
        float line = max(rim, fold);
        float shade = 1.0 - max(dot(N, uLight), 0.0);
        float tone = 0.04 + 0.96 * smoothstep(0.38, 0.95, shade);
        vec2 px = gl_FragCoord.xy + vec2(n3(vWPos * 14.0), n3(vWPos * 14.0 + 7.0)) * 2.0;
        float hatchInk = max(hatch(px, 0.95, 9.0, tone) * smoothstep(0.0, 0.25, tone + 0.05),
                             hatch(px, -0.7, 11.0, smoothstep(0.72, 1.0, tone)) * 0.8);
        hatchInk *= 0.42 * uShade;
        float ink = max(line * 0.95, hatchInk);
        gl_FragColor = vec4(mix(uPaper, ${GRAPHITE}, clamp(ink, 0.0, 1.0)), uFade);
        #include <colorspace_fragment>
      }`,
  });
}

function guideLines(size, mat) {
  const hx = size.x / 2, hz = size.z / 2, H = size.y, o = 0.07;
  const P = [];
  const seg = (a, b) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A).normalize().multiplyScalar(o);
    P.push(...A.clone().sub(d).toArray(), ...B.clone().add(d).toArray());
  };
  for (const y of [0, H]) {
    seg([-hx, y, -hz], [hx, y, -hz]); seg([-hx, y, hz], [hx, y, hz]);
    seg([-hx, y, -hz], [-hx, y, hz]); seg([hx, y, -hz], [hx, y, hz]);
  }
  for (const x of [-hx, hx]) for (const z of [-hz, hz]) seg([x, 0, z], [x, H, z]);
  seg([-hx * 3.2, 0, hz], [hx * 3.2, 0, hz]);
  seg([0, -0.04, 0], [0, H + 0.12, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const l = new THREE.LineSegments(g, mat);
  l.computeLineDistances();
  return l;
}

export async function createProcessScene(canvas, { width = 1, height: cssH = 1, dpr = 1, lite = false, paper = '#ede4d3', notesAt = [], onNotes = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 1.5, powerPreference: 'high-performance' });
  renderer.setClearColor(new THREE.Color(paper), 1);
  renderer.setPixelRatio(Math.min(dpr, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x9a8068, 1.5);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
  sun.position.set(-2.4, 3.6, 2.9);
  const fill = new THREE.DirectionalLight(0xe8eef0, 0.7);
  fill.position.set(3, 1.6, 1.5);
  scene.add(fill);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6 });
  sun.shadow.radius = 10;
  sun.shadow.bias = -0.0004;
  scene.add(hemi, sun);

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL(MODEL_URL, globalThis.location.href).href);
  const model = gltf.scene;
  dequantize(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const height = size.y;

  const u = { uReveal: { value: 0 }, uWeave: { value: 0 }, uCushion: { value: 0 }, uFade: { value: 1 }, uShade: { value: 0 } };
  const contours = [
    contourMaterial(u, height, { thick: height * 0.0065, jitter: height * 0.005, seed: 1.7, alpha: 1.0, lag: 0.06, breaks: 0.05 }),
    contourMaterial(u, height, { thick: height * 0.0035, jitter: height * 0.009, seed: 9.3, alpha: 0.4, lag: 0.12, breaks: 0.25 }),
  ];
  const sketchFill = sketchFillMaterial(u, height, paper);
  const sketchMeshes = [];
  const creaseMat = new THREE.LineDashedMaterial({ color: 0x3d342b, transparent: true, opacity: 0.4, dashSize: 0, gapSize: 1e3 });
  const creases = [];
  const guideMat = new THREE.LineDashedMaterial({ color: 0x3d342b, transparent: true, opacity: 0.28, dashSize: 0, gapSize: 1e3 });
  const guides = guideLines(size, guideMat);
  const guideDist = guides.geometry.attributes.lineDistance;
  const guideTotal = guideDist.getX(guideDist.count - 1);
  scene.add(guides);
  let creaseTotal = 0;
  const weaveCells = Math.round((Math.PI * Math.max(size.x, size.z)) / ((height / STRANDS) * 1.9));
  const meshes = [];
  model.traverse((o) => o.isMesh && meshes.push(o));
  meshes.forEach((o) => {
    o.geometry.computeVertexNormals();
    o.material = chairMaterial(o.material, u, height, weaveCells);
    o.castShadow = true;
    o.receiveShadow = true;
    [sketchFill, ...contours].forEach((mat) => {
      const sm = new THREE.Mesh(o.geometry, mat);
      o.add(sm);
      sketchMeshes.push(sm);
    });
    const crease = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 32), creaseMat);
    crease.computeLineDistances();
    const cd = crease.geometry.attributes.lineDistance;
    creaseTotal = Math.max(creaseTotal, cd.getX(cd.count - 1));
    o.add(crease);
    creases.push(crease);
  });
  scene.add(model);

  const room = new THREE.Group();
  const floorMat = new THREE.MeshStandardMaterial({ map: oakFloorTexture(), roughness: 0.8, transparent: true, opacity: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const WALL = new THREE.Color(0x8ba2a4);
  const wallMat = new THREE.MeshBasicMaterial({ color: WALL, toneMapped: false, transparent: true, opacity: 0 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), wallMat);
  wall.position.set(0, 3, -1.7);
  const wallShadowMat = new THREE.ShadowMaterial({ opacity: 0 });
  const wallShadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), wallShadowMat);
  wallShadow.position.set(0, 3, -1.699);
  wallShadow.receiveShadow = true;
  room.add(wallShadow);
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: 0.7, transparent: true, opacity: 0 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(30, 0.09, 0.02), skirtMat);
  skirt.position.set(0, 0.045, -1.69);
  room.add(floor, wall, skirt);
  scene.add(room);

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0 });
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), shadowMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.001;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  const H = height;
  const KEYS = [
    [0.0, 30, H * 1.15, H * 3.9, H * 0.5],
    [0.25, 36, H * 1.2, H * 3.8, H * 0.5],
    [0.5, -40, H * 1.35, H * 3.7, H * 0.46],
    [0.62, -16, H * 1.9, H * 3.4, H * 0.44],
    [0.75, 10, H * 1.6, H * 3.6, H * 0.44],
    [1.0, 24, H * 1.15, H * 4.9, H * 0.48],
  ];
  const camAt = (p) => {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const [p0, a0, e0, d0, l0] = KEYS[i], [p1, a1, e1, d1, l1] = KEYS[i + 1];
    const t = smooth(p0, p1, p);
    return { az: lerp(a0, a1, t), el: lerp(e0, e1, t), dist: lerp(d0, d1, t), look: lerp(l0, l1, t) };
  };

  let progress = 0, w = 0, h = 0, idle = 0, frame = 0, running = false, noteAlpha = 0;
  const anchors = notesAt.map(([fx, fy, fz]) => new THREE.Vector3(fx * size.x, fy * size.y, fz * size.z));
  const tmp = new THREE.Vector3();
  let notesShown = true;
  function placeNotes() {
    if (!noteAlpha && !notesShown) return;
    notesShown = noteAlpha > 0;
    onNotes(anchors.map((v) => { tmp.copy(v).project(camera); return [((tmp.x + 1) / 2) * w, ((1 - tmp.y) / 2) * h]; }), noteAlpha);
  }

  function apply(p) {
    guideMat.dashSize = guideTotal * 1.02;
    guideMat.opacity = 0.28 * (1 - smooth(0.26, 0.36, p));
    guides.visible = guideMat.opacity > 0.001;
    u.uShade.value = smooth(0.06, 0.2, p);
    u.uFade.value = 1 - smooth(0.42, 0.54, p);
    sketchMeshes.forEach((m) => (m.visible = u.uFade.value > 0.001));
    creaseMat.dashSize = creaseTotal * 1.02 * smooth(0.02, 0.14, p);
    creaseMat.opacity = 0.4 * (1 - smooth(0.36, 0.48, p));
    creases.forEach((c) => (c.visible = creaseMat.opacity > 0.001 && p > 0.02));
    noteAlpha = smooth(0.14, 0.2, p) * (1 - smooth(0.27, 0.34, p));
    u.uReveal.value = smooth(0.24, 0.5, p);
    shadowMat.opacity = 0.18 * smooth(0.3, 0.5, p) * (1 - smooth(0.78, 0.92, p));
    shadowFloor.visible = shadowMat.opacity > 0.001;
    u.uWeave.value = smooth(0.5, 0.7, p);
    u.uCushion.value = smooth(0.66, 0.73, p);
    const live = smooth(0.76, 0.94, p);
    floorMat.opacity = wallMat.opacity = skirtMat.opacity = live;
    wallShadowMat.opacity = 0.16 * live;
    room.visible = live > 0.001;
    sun.intensity = lerp(2.1, 2.4, live);
    hemi.intensity = lerp(1.5, 1.3, live);
    const c = camAt(p);
    const az = THREE.MathUtils.degToRad(c.az + Math.sin(idle * 0.35) * 1.2);
    camera.position.set(Math.sin(az) * c.dist, c.el, Math.cos(az) * c.dist);
    camera.lookAt(0, c.look, 0);
  }

  let sized = false, nextW = width, nextH = cssH;
  function resize() {
    sized = true;
    if (nextW === w && nextH === h) return;
    w = nextW; h = nextH;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w / h < 0.9) {
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(13.5)) / (w / h)));
      camera.setViewOffset(w, h, 0, h * 0.11, w, h);
    } else {
      camera.fov = w / h < 1.3 ? 38 : 32;
      camera.setViewOffset(w, h, -w * 0.14, 0, w, h);
    }
    camera.updateProjectionMatrix();
  }

  renderer.shadowMap.autoUpdate = false;
  let dprNow = renderer.getPixelRatio(), dtAvg = 0, dtN = 0, lastT = 0, wasChanged = false;
  function adapt(t, changed) {
    const dt = t - lastT;
    if (changed && wasChanged && dt > 0 && dt < 250) {
      dtAvg = dtN ? dtAvg * 0.92 + dt * 0.08 : dt;
      if (++dtN > 40 && dtAvg > 24 && dprNow > 1) {
        dprNow = Math.max(1, dprNow - 0.25);
        renderer.setPixelRatio(dprNow);
        dtN = 0;
      }
    }
    lastT = t;
    wasChanged = changed;
  }
  let drawn = -1, lastDraw = 0;
  function tick(t) {
    frame = raf(tick);
    const changed = progress !== drawn || !sized;
    if (!changed && t - lastDraw < 100) return;
    adapt(t, changed);
    lastDraw = t;
    idle = t / 1000;
    if (!sized) resize();
    if (drawn < 0) renderer.shadowMap.needsUpdate = true;
    drawn = progress;
    apply(progress);
    renderer.render(scene, camera);
    if (anchors.length) placeNotes();
  }

  return {
    setProgress(p) { progress = clamp01(p); },
    setSize(cw, ch) { if (cw > 0 && ch > 0) { nextW = cw; nextH = ch; sized = false; } },
    start() { if (!running) { running = true; frame = raf(tick); } },
    stop() { running = false; caf(frame); },
  };
}
