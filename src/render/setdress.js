// Set dressing: lit shopfronts, merged puddle mirrors, animated steam vents.
// Shops + puddles are static merges (2 draws); steam is 3 live sprites.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';
import { mulberry32 } from '../sim/rng.js';
import { zoneAt } from '../sim/street.js';
import { loadPBRMaps, standardFromMaps, wetness } from './materials.js';
import { PUDDLES, SHOPS, VENTS } from '../sim/dressing.js';

// A signwriter's colours: a painted board and the letters on it. Lacquer red
// under lantern orange, navy under old gold, white on medical blue.
const SHOP_STYLES = [
  { board: '#4a1610', letters: '#ff9a3c', name: 'RAMEN' },
  { board: '#161d2c', letters: '#c9a24a', name: 'PAWN' },
  { board: '#1d5c9e', letters: '#f2f5f7', name: 'CLINIC' },
];

// The old version painted a whole fake shopfront — sign band plus four lit
// window rectangles — onto a flat plane and hung it on the wall. Since the
// podium grew real glazing with real interiors behind it, that plane was a
// sticker of a shop stuck over an actual shop, and it cost one draw each.
//
// What a commercial street has and this one did not is signage with depth: a
// fascia board over the door and a blade projecting out across the pavement,
// so the trade reads from the far end of the block instead of only head-on.
//
// 256x200 atlas: three 256x64 trade bands, then an 8px black strip at the
// bottom that every face which is not a sign face points at.
const SIGN_BAND = 64 / 200;

// Crisp edges, no blur: a halo round glowing letters on a black board reads as
// bent glass tubing, and a shop fascia is paint with the lettering lit.
function paintSignCell(g, kind, oy) {
  const st = SHOP_STYLES[kind];
  g.fillStyle = st.board;
  g.fillRect(0, oy, 256, 64);
  g.strokeStyle = st.letters;
  g.lineWidth = 2;
  g.strokeRect(5, oy + 5, 246, 54);
  g.fillStyle = st.letters;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(st.name, 128, oy + 33);
}

function shopSignAtlas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#05070c';
  g.fillRect(0, 0, 256, 200);
  for (let k = 0; k < SHOP_STYLES.length; k += 1) paintSignCell(g, k, k * 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// BoxGeometry lays its faces out +X, -X, +Y, -Y, +Z, -Z, four vertices each.
// Faces listed in `lit` read the trade band; the rest point at the black
// strip, so one material covers the sign, its edges and its back.
function mapSignFaces(geo, kind, lit) {
  const uv = geo.attributes.uv;
  const v0 = 1 - (kind + 1) * SIGN_BAND;
  for (let f = 0; f < 6; f += 1) {
    for (let k = 0; k < 4; k += 1) {
      const i = f * 4 + k;
      if (lit.includes(f)) uv.setXY(i, uv.getX(i), v0 + uv.getY(i) * SIGN_BAND);
      else uv.setXY(i, 0.5, 0.01);
    }
  }
  return geo;
}

function shopSignGeos(s, signGeos, brackets) {
  const zone = s.z < 0 ? 0 : 1;
  const dx = Math.sin(s.ry);
  const dz = Math.cos(s.ry);
  const fascia = mapSignFaces(new THREE.BoxGeometry(6.0, 0.92, 0.24), s.kind, [4]);
  fascia.rotateY(s.ry);
  fascia.translate(s.x + dx * 0.2, 3.62, s.z + dz * 0.2);
  signGeos[zone].push(fascia);
  // Both broad faces of the blade carry the name: the whole point of a
  // projecting sign is being read side-on from down the block, where a flat
  // fascia is edge-on and says nothing.
  const blade = mapSignFaces(new THREE.BoxGeometry(1.9, 0.86, 0.1), s.kind, [4, 5]);
  blade.rotateY(s.ry + Math.PI / 2);
  blade.translate(s.x + dx * 1.2, 5.1, s.z + dz * 1.2);
  signGeos[zone].push(blade);
  const arm = new THREE.BoxGeometry(0.1, 0.1, 0.62);
  arm.rotateY(s.ry);
  arm.translate(s.x + dx * 0.42, 5.44, s.z + dz * 0.42);
  const stay = new THREE.BoxGeometry(0.08, 0.5, 0.08);
  stay.translate(s.x + dx * 0.68, 5.25, s.z + dz * 0.68);
  const cap = new THREE.BoxGeometry(7.0, 0.14, 1.1);
  cap.rotateY(s.ry);
  cap.translate(s.x + dx * 0.5, 4.2, s.z + dz * 0.5);
  brackets.push(arm, stay, cap);
}

export function buildShops(texLoader, maxAniso) {
  const group = new THREE.Group();
  const signTex = shopSignAtlas();
  const signGeos = [[], []];
  const brackets = [];
  for (const s of SHOPS) shopSignGeos(s, signGeos, brackets);
  // One sign mesh per power zone, so a blackout still takes a zone's trade
  // names out with its lamps. Six materials became two.
  const mats = signGeos.map((geos, zone) => {
    const mat = new THREE.MeshBasicMaterial({ map: signTex });
    if (geos.length) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      group.add(mesh);
    }
    return { mat, zone, seed: zone * 2.6 + 3 };
  });
  const plate = loadPBRMaps(texLoader, maxAniso, 'metalplates006', 'color', 9, 1, { normal: 'normalgl', metal: 'metalness' });
  const capMat = standardFromMaps(plate, { roughness: 0.62, metalness: 0.25, envMapIntensity: 0.9, color: 0x8b949f });
  const bracketMesh = new THREE.Mesh(mergeGeometries(brackets), capMat);
  group.add(bracketMesh);
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
    if (zoneGeos.length) group.add(new THREE.Mesh(mergeGeometries(zoneGeos), mats[zone]));
  }
  return { group, mats };
}

// Zone dimmer: the mirror dies with the lights it reflects (VGA-010), and the
// water itself is the weather's: no wetness, no puddle. It fades out over the
// two game minutes the roads take to dry, so the same 0-1 the roads read.
export function setPuddleGlow(puddles, zone, glow) {
  puddles.mats[zone].reflectivity = MIRROR_GAIN * (MIRROR_FLOOR + (1 - MIRROR_FLOOR) * glow);
  puddles.mats[zone].opacity = wetness();
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
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  return { mesh, mat };
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
