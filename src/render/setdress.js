// Set dressing: lit shopfronts, merged puddle mirrors, animated steam vents.
// Shops + puddles are static merges (2 draws); steam is 3 live sprites.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';
import { mulberry32 } from '../sim/rng.js';
import { zoneAt } from '../sim/street.js';
import { loadPBRMaps, standardFromMaps } from './materials.js';

const SHOPS = [
  { x: -6.0, z: -12, ry: Math.PI / 2, kind: 0 },
  { x: 6.0, z: 2, ry: -Math.PI / 2, kind: 1 },
  { x: -6.0, z: 22, ry: Math.PI / 2, kind: 2 },
  { x: 35.5, z: -20, ry: Math.PI / 2, kind: 1 },
  { x: 50.0, z: 14, ry: -Math.PI / 2, kind: 0 },
  { x: 10, z: -60.9, ry: Math.PI, kind: 2 },
];

const SHOP_STYLES = [
  { glow: '#ff9a3c', name: 'RAMEN' },
  { glow: '#35e0ff', name: 'PAWN' },
  { glow: '#52ff9e', name: 'CLINIC' },
];

function shopTexture(kind) {
  const st = SHOP_STYLES[kind];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#05070c';
  g.fillRect(0, 0, 256, 160);
  g.shadowColor = st.glow;
  g.shadowBlur = 16;
  g.fillStyle = st.glow;
  g.fillRect(0, 0, 256, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#000';
  g.font = 'bold 24px sans-serif';
  g.textAlign = 'center';
  g.fillText(st.name, 128, 25);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 62;
    const lit = (i + kind) % 3 !== 0;
    g.fillStyle = lit ? '#ffe9c4' : '#131a24';
    g.shadowColor = st.glow;
    g.shadowBlur = lit ? 12 : 0;
    g.fillRect(x, 52, 48, 88);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(x, 52, 48, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildShops(texLoader, maxAniso) {
  const group = new THREE.Group();
  const texes = [shopTexture(0), shopTexture(1), shopTexture(2)];
  const canopies = [];
  const mats = [];
  for (const [si, s] of SHOPS.entries()) {
    const mat = new THREE.MeshBasicMaterial({ map: texes[s.kind] });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4), mat);
    m.position.set(s.x, 2.0, s.z);
    m.rotation.y = s.ry;
    group.add(m);
    mats.push({ mat, zone: s.z < 0 ? 0 : 1, seed: si * 1.9 + 3 });
    const dirX = Math.sin(s.ry);
    const dirZ = Math.cos(s.ry);
    const cap = new THREE.BoxGeometry(7.0, 0.14, 1.1);
    cap.translate(s.x + dirX * 0.5, 3.85, s.z + dirZ * 0.5);
    canopies.push(cap);
  }
  const plate = loadPBRMaps(texLoader, maxAniso, 'metalplates006', 'color', 9, 1, { normal: 'normalgl', metal: 'metalness' });
  const capMat = standardFromMaps(plate, { roughness: 0.62, metalness: 0.25, envMapIntensity: 0.9, color: 0x8b949f });
  group.add(new THREE.Mesh(mergeGeometries(canopies), capMat));
  return { group, mats };
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(64, 64, 52, 34, 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    g.beginPath();
    g.ellipse(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 34, 8 + (i % 5) * 3, 6, a, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

const PUDDLES = [
  // x, z, size, surface y (0.025 road / 0.145 sidewalk)
  // First entry is the hero puddle: left-lane water a few metres from the start
  // camera, clear of the z=20 zebra. Both facts are the whole slice — water far
  // down the street is a few grey pixels, and a mirror laid over crosswalk paint
  // reads as a stain rather than as water.
  [-1.5, 25.5, 8, 0.025], [2.2, -8, 9, 0.025], [42.5, 4, 8, 0.025], [46, -24, 6, 0.025],
  [20, -64, 8, 0.025], [1.2, 34, 6, 0.025], [43, 30, 7, 0.025],
  [-5.9, -3, 4, 0.145], [5.9, 30, 4, 0.145], [38.2, 22, 4, 0.145],
  [49.8, -12, 4, 0.145], [16, -69.3, 5, 0.145], [0.5, 2, 6, 0.025],
];

// Mirror puddles (VGA-002). The water reflects the city itself, sampled from a
// cube the street re-shoots only when the light changes. A probe running every
// frame cost 16 draws of the 175, and a standard material would have paid a
// PMREM blur chain on top; a basic material reads the cube raw, so the water is
// two draws and the probe only spends when the light it mirrors has moved.
const MIRROR_LAYER = 1;
const MIRROR_FACES = [0, 1, 2, 4, 5]; // px nx py pz nz — a flat mirror never looks down
const MIRROR_SIZE = 512;
const MIRROR_EYE_Y = 0.3;      // just above the water, so near geometry lines up
const MIRROR_MAX_AGE = 6;      // seconds before the city is re-shot anyway
const MIRROR_MOVE = 20;        // metres of travel that make the old cube wrong
const MIRROR_GAIN = 3.0;       // the cube is already tone-mapped once; lift it back
const WATER_TINT = 0x0a0e14;   // the water itself darkens the asphalt it covers
const MIRROR_FLOOR = 0.12;     // a dead zone still holds a trace of skyglow

export function buildPuddles() {
  const geos = [[], []];
  for (const [x, z, size, y] of PUDDLES) {
    const q = new THREE.PlaneGeometry(size, size * 0.7);
    q.rotateX(-Math.PI / 2);
    q.rotateY((x * 7 + z * 3) % 3);
    q.translate(x, y, z);
    geos[zoneAt(z)].push(q);
  }
  // One mesh per power zone, like the facades: a blackout has to kill the
  // reflections in its own zone only, and reflectivity is the dimmer.
  const edge = blobTexture();
  const group = new THREE.Group();
  const mats = geos.map(() => new THREE.MeshBasicMaterial({
    color: WATER_TINT, combine: THREE.AddOperation, reflectivity: MIRROR_GAIN,
    transparent: true, alphaMap: edge, depthWrite: false,
  }));
  for (const [zone, zoneGeos] of geos.entries()) {
    group.add(new THREE.Mesh(mergeGeometries(zoneGeos), mats[zone]));
  }
  return { group, mats };
}

// Zone dimmer: the mirror dies with the lights it reflects (VGA-010).
export function setPuddleGlow(puddles, zone, glow) {
  puddles.mats[zone].reflectivity = MIRROR_GAIN * (MIRROR_FLOOR + (1 - MIRROR_FLOOR) * glow);
}

export function buildCityMirror() {
  const rt = new THREE.WebGLCubeRenderTarget(MIRROR_SIZE);
  const cubeCamera = new THREE.CubeCamera(0.3, 260, rt);
  for (const faceCam of cubeCamera.children) faceCam.layers.set(MIRROR_LAYER);
  return { cubeCamera, texture: rt.texture, pending: 0, at: -MIRROR_MAX_AGE, x: 0, z: 0 };
}

// Everything the water is allowed to see. Lights ride along at +0 draws —
// without them the probe renders unlit facades and every mirror comes back
// black except the emissive windows.
export function showInMirror(...objects) {
  for (const o of objects) o.layers.enable(MIRROR_LAYER);
}

// Proxy geometry: seen by the water, never by the player.
export function onlyInMirror(...objects) {
  for (const o of objects) o.layers.set(MIRROR_LAYER);
}

export function cityMirrorStale(mirror, time, x, z) {
  if (mirror.pending > 0) return false;
  return time - mirror.at > MIRROR_MAX_AGE || Math.hypot(x - mirror.x, z - mirror.z) > MIRROR_MOVE;
}

export function requestCityMirror(mirror, time, x, z) {
  mirror.cubeCamera.position.set(x, MIRROR_EYE_Y, z);
  mirror.cubeCamera.updateMatrixWorld();
  mirror.pending = MIRROR_FACES.length;
  mirror.at = time;
  mirror.x = x;
  mirror.z = z;
}

// One face per frame: a whole cube in a single frame would spike the budget by
// five times the cost of the frame it interrupts.
export function tickCityMirror(renderer, scene, mirror) {
  if (mirror.pending <= 0) return;
  const face = MIRROR_FACES[MIRROR_FACES.length - mirror.pending];
  mirror.pending--;
  const { cubeCamera } = mirror;
  if (cubeCamera.coordinateSystem !== renderer.coordinateSystem) {
    cubeCamera.coordinateSystem = renderer.coordinateSystem;
    cubeCamera.updateCoordinateSystem();
  }
  const prevTarget = renderer.getRenderTarget();
  const prevFace = renderer.getActiveCubeFace();
  const prevLevel = renderer.getActiveMipmapLevel();
  const prevShadows = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;   // the probe reuses the frame's shadow map
  renderer.setRenderTarget(cubeCamera.renderTarget, face);
  renderer.render(scene, cubeCamera.children[face]);
  renderer.setRenderTarget(prevTarget, prevFace, prevLevel);
  renderer.shadowMap.autoUpdate = prevShadows;
}

const VENTS = [
  { x: -5.5, z: -30, phase: 0 },
  { x: 46.5, z: 8, phase: 0.8 },
  { x: -5.5, z: -14, phase: 1.6 },
];

// Aviation beacons on tall crowns: one merged mesh, one synced pulse.
// Stars: one static dome of points above the fog.

export function buildBeacons(points) {
  const geos = [];
  for (const [x, y, z] of points) {
    const g = new THREE.SphereGeometry(0.28, 8, 6);
    g.translate(x, y, z);
    geos.push(g);
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a20 });
  return { mesh: new THREE.Mesh(mergeGeometries(geos), mat), mat };
}

export function buildStars() {
  const rand = mulberry32(4242);
  const N = 450;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.12 + rand() * 1.4;
    const r = 320;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xaac4e8, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.75, fog: false, depthWrite: false,
  }));
  points.frustumCulled = false;
  return points;
}

export function buildSteam() {
  const group = new THREE.Group();
  const sprites = [];
  for (const v of VENTS) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xbccbe0, transparent: true, opacity: 0.2,
      depthWrite: false,
    }));
    s.userData = v;
    group.add(s);
    sprites.push(s);
  }
  return { group, sprites, erupt: [0, 0] };
}

export function tickSteam(rig, elapsed, dt) {
  for (let zi = 0; zi < 2; zi++) rig.erupt[zi] = Math.max(0, rig.erupt[zi] - dt * 0.8);
  for (const s of rig.sprites) {
    const zone = s.userData.z < 0 ? 0 : 1;
    const e = rig.erupt[zone];
    const prog = ((elapsed * (0.45 + e * 1.6) + s.userData.phase) % 2.2) / 2.2;
    s.position.set(s.userData.x, 0.4 + prog * (3.2 + e * 3.5), s.userData.z);
    const sc = (1.4 + prog * 3.0) * (1 + e * 0.7);
    s.scale.set(sc, sc, 1);
    s.material.opacity = Math.min(0.7, 0.36 * (1 - prog) * (1 + e * 2.4));
  }
}
