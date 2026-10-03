// Throwaway rig for spike M3.S1 — can this Mac draw the pooled city? Not game
// code. 2,000 unit-shell buildings in per-architecture pools with the tower
// materials and zone attribute, 300 road pieces, shadows. Numbers go to
// docs/spikes/m3-render.md; rerun command is in its header.
import * as THREE from 'three';
import { facadeMaterial, concreteFacadeMaterial, loadPolyHavenMaps, zoneView } from '../../src/render/materials.js';
const q = new URLSearchParams(location.search);
const MODE = q.get('mesh') === 'batched' ? 'batched' : 'instanced';
const CAM = q.get('cam') === 'city' ? 'city' : 'play';
const DPR = q.get('dpr') === '2' ? 2 : 1;
const NIGHT = q.get('night') === '1';
const COLS = 40, ROWS = 50, PITCH = 40, WARMUP = 60, SAMPLES = 600, ROAD_PIECES = 300;
const ARCH = [
  [{ w: [18, 24], d: [10, 12], h: [10, 18] }, { w: [16, 22], d: [10, 12], h: [16, 28] }],
  [{ w: [20, 26], d: [10, 12], h: [24, 46] }, { w: [14, 20], d: [10, 12], h: [42, 96] }],
  [{ w: [22, 26], d: [10, 12], h: [14, 26] }, { w: [16, 22], d: [10, 12], h: [30, 68] }],
].flat();
let seed = 0x2f6e2b1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const range = ([a, b]) => a + rnd() * (b - a);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('view'), antialias: true });
renderer.setPixelRatio(DPR);
renderer.setSize(1280, 720, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = NIGHT ? 0.75 : 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false; // 0.160 resets info after the shadow pass; count whole frames
const gl = renderer.getContext();
const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT ? 0x04060c : 0x9fb6cf);
scene.fog = new THREE.FogExp2(NIGHT ? 0x070b16 : 0x9fb6cf, NIGHT ? 0.0022 : 0.0011);
const camera = new THREE.PerspectiveCamera(CAM === 'city' ? 45 : 60, 1280 / 720, 0.5, 6000);
const cx = COLS * PITCH / 2;
const cz = ROWS * PITCH / 2;
const look = CAM === 'city' ? [cx, 0, cz] : [PITCH * 5.5, 40, -PITCH * 2];
if (CAM === 'city') camera.position.set(cx, 1250, cz + 950);
else camera.position.set(PITCH * 1.6, 8, PITCH * 3.2);
camera.lookAt(...look);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const loader = new THREE.TextureLoader();
const tex = (url, srgb) => {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
};
const glass = {};
for (const [slot, file, srgb] of [['color', 'color', 1], ['emission', 'emission', 1], ['normal', 'normal', 0], ['rough', 'roughness', 0], ['metal', 'metalness', 0]]) {
  glass[slot] = tex(`/assets/facade_glass_night/${file}.jpg`, srgb);
}
const dayColor = tex('/assets/facade_glass/color.jpg', true);
const poly = (dir, rx, ry) => loadPolyHavenMaps(loader, maxAniso, `/assets/${dir}`, rx, ry);
const concrete = [['concrete_wall_008', 1, 1, 0x767a83], ['red_brick', 8, 8, 0x8a7a72],
  ['yellow_brick', 6, 6, 0x8c8880], ['sandstone_blocks_08', 4, 4, 0x86837d]];
const kinds = [
  facadeMaterial(glass, dayColor, 0x9aa2ae), facadeMaterial(glass, dayColor, 0x8a94a8),
  ...concrete.map(([dir, rx, ry, tint]) => concreteFacadeMaterial(poly(dir, rx, ry), glass.emission, tint)),
];
for (const k of [0, 1]) kinds[k].userData.uNight.value = NIGHT ? 1 : 0;
for (let z = 0; z < 2; z += 1) for (const m of kinds) zoneView(m, z).emissiveIntensity = NIGHT ? 0.75 : 0;
const buildings = [];
for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
  const a = Math.floor(rnd() * ARCH.length);
  buildings.push({
    x: (c + 0.5) * PITCH, z: (r + 0.5) * PITCH, a,
    w: range(ARCH[a].w), d: range(ARCH[a].d), h: range(ARCH[a].h), zone: rnd() < 0.5 ? 0 : 1,
  });
}
const unit = new THREE.BoxGeometry(1, 1, 1);
const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q0 = new THREE.Quaternion();
const place = (b) => m4.compose(p.set(b.x, b.h / 2, b.z), q0, s.set(b.w, b.h, b.d));
const group = new THREE.Group();
const byKind = kinds.map(() => []);
for (const b of buildings) byKind[b.a].push(b);
const pools = kinds.map((mat, k) => {
  const list = byKind[k];
  if (MODE === 'batched') {
    // 0.160's BatchedMesh is one material and one geometry per building; the zone
    // attribute rides each copied geometry because there is no per-instance one.
    const bm = new THREE.BatchedMesh(list.length, list.length * 24, list.length * 36, mat);
    list.forEach((b) => {
      const g = unit.clone();
      g.setAttribute('zone', new THREE.BufferAttribute(new Float32Array(24).fill(b.zone), 1));
      bm.setMatrixAt(bm.addGeometry(g, 24, 36), place(b));
    });
    bm.computeBoundingSphere();
    return bm;
  }
  const g = unit.clone();
  const zones = new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1);
  g.setAttribute('zone', zones);
  const im = new THREE.InstancedMesh(g, mat, list.length);
  list.forEach((b, i) => { im.setMatrixAt(i, place(b)); zones.setX(i, b.zone); });
  return im;
});
for (const m of pools) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
const roadMesh = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({
  color: 0x2a2d33, roughness: 0.95, metalness: 0,
}), ROAD_PIECES);
let n = 0;
for (let i = 0; n < ROAD_PIECES; i += 1) {
  const line = Math.floor(i / 20) * 2 * PITCH;
  const seg = ((i % 20) + 0.5) * 2 * PITCH;
  const [x, z, w, d] = i % 2 ? [line, seg, 12, 2 * PITCH] : [seg, line, 2 * PITCH, 12];
  roadMesh.setMatrixAt(n, m4.compose(p.set(x, 0.03, z), q0, s.set(w, 0.12, d)));
  n += 1;
}
roadMesh.receiveShadow = true;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 3000), new THREE.MeshStandardMaterial({
  color: 0x1c1f24, roughness: 1,
}));
ground.rotation.x = -Math.PI / 2;
ground.position.set(cx, -0.02, cz);
ground.receiveShadow = true;
const hemi = new THREE.HemisphereLight(NIGHT ? 0x24314d : 0xbfd4ea, 0x05070a, NIGHT ? 0.3 : 0.7);
const sun = new THREE.DirectionalLight(0xfff0d8, NIGHT ? 0 : 2.3);
sun.position.set(-700, 1100, -500);
sun.target.position.set(cx, 0, cz);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const S = 1600;
Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 4000 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.8;
sun.shadow.autoUpdate = !NIGHT; // the game holds the map still through the night
const moon = new THREE.DirectionalLight(0x8fb0ff, NIGHT ? 0.25 : 0);
scene.add(hemi, moon, sun, sun.target, ground, roadMesh, group);
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
const times = [], works = [];
let draws = 0, frame = 0, last = performance.now();
const pct = (a, q2) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.ceil(q2 * a.length) - 1)];
function finish() {
  window.__spike.result = {
    mesh: MODE, cam: CAM, dpr: DPR, night: NIGHT, gpu, frames: times.length, draws,
    backing: `${renderer.domElement.width}x${renderer.domElement.height}`,
    p50: +pct(times, 0.5).toFixed(2), p95: +pct(times, 0.95).toFixed(2),
    max: +Math.max(...times).toFixed(2), late: times.filter((t) => t > 20).length,
    renderP95: +pct(works, 0.95).toFixed(2), error: null,
  };
  window.__spike.done = true;
}
function tick() {
  requestAnimationFrame(tick);
  if (window.__spike.done) return;
  const t0 = performance.now();
  renderer.info.reset();
  renderer.render(scene, camera);
  gl.finish();
  if (frame < WARMUP) { frame += 1; last = performance.now(); return; }
  times.push(t0 - last);
  works.push(performance.now() - t0);
  last = performance.now();
  draws = Math.max(draws, renderer.info.render.calls);
  if (times.length === SAMPLES) finish();
}
window.__spike = { done: false, result: null };
tick();