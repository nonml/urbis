// Traffic: fleet bodies from the M2.T3 pipeline model, lights in one pool set.
// Cars run headlights-on through blackouts — the contrast sells the hack.
// The hero (player) car reuses the same model file with its own materials
// plus a real headlight spot so wet asphalt answers the beams.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { blend, drawAlpha } from '../game/loop.js';
import { getGlowTex } from './signs.js';

// --- Car bodies from a side profile, not boxes -----------------------------
// A car used to be a stack of BoxGeometry: one saloon stretched into five
// shapes by per-instance scale, which is why the whole fleet read as moulded
// plastic (VGA-084 sub-slice 3). Each silhouette is now a THREE.Shape of the
// car seen from the side — bonnet, windscreen rake, roof, rear screen, boot and
// two wheel-arch cut-outs — run through ExtrudeGeometry with a small bevel so
// the edges roll off instead of meeting at a CG corner. A handful of numbers
// per shape builds all five. Width is the extrusion depth, so the profile is
// drawn in (length, height) and turned onto the car's z axis after centring.
const CAR_SPECS = [
  { len: 4.50, width: 1.82, ground: 0.22, wheelR: 0.34, axleF: 1.38, axleR: -1.38,
    archR: 0.46, belt: 0.94, nose: 0.72, winsh: 0.60, roofF: 0.16, roofR: -0.80,
    roofY: 1.44, deck: 0.94, rearBase: -1.14, winRear: -1.06 },   // saloon
  { len: 5.10, width: 1.94, ground: 0.24, wheelR: 0.36, axleF: 1.62, axleR: -1.58,
    archR: 0.48, belt: 1.06, nose: 0.98, winsh: 1.44, roofF: 1.16, roofR: -1.98,
    roofY: 2.00, deck: 1.86, rearBase: -2.10, winRear: 0.24 },    // van
  { len: 3.85, width: 1.72, ground: 0.22, wheelR: 0.32, axleF: 1.16, axleR: -1.16,
    archR: 0.44, belt: 0.90, nose: 0.68, winsh: 0.56, roofF: 0.12, roofR: -0.72,
    roofY: 1.40, deck: 0.90, rearBase: -1.02, winRear: -0.94 },   // compact
  { len: 4.80, width: 1.84, ground: 0.22, wheelR: 0.35, axleF: 1.45, axleR: -1.48,
    archR: 0.47, belt: 0.96, nose: 0.74, winsh: 0.72, roofF: 0.28, roofR: -1.98,
    roofY: 1.52, deck: 1.16, rearBase: -2.06, winRear: -1.98 },   // wagon
  { len: 4.45, width: 1.86, ground: 0.21, wheelR: 0.33, axleF: 1.46, axleR: -1.42,
    archR: 0.45, belt: 0.86, nose: 0.66, winsh: 0.48, roofF: -0.10, roofR: -0.96,
    roofY: 1.28, deck: 0.82, rearBase: -1.52, winRear: -1.22 },   // coupe
];
const BEVEL = 0.03;
const EXTRUDE = {
  bevelEnabled: true, bevelSegments: 2, bevelThickness: BEVEL, bevelSize: 0.02,
  bevelOffset: 0, curveSegments: 7, steps: 1,
};

// The wheel arch is the only concave edge in the profile: travel along the
// rocker to the left of the wheel, then sweep over the top to its right.
function arch(shape, cx, wheelR, archR, ground) {
  const dy = wheelR - ground;
  const dx = Math.sqrt(Math.max(0.01, archR * archR - dy * dy));
  shape.lineTo(cx - dx, ground);
  shape.absarc(cx, wheelR, archR,
    Math.atan2(ground - wheelR, -dx), Math.atan2(ground - wheelR, dx), true);
}

function carProfile(s) {
  const h = s.len / 2;
  const p = new THREE.Shape();
  p.moveTo(h, s.ground);
  p.lineTo(h, s.nose);
  p.lineTo(s.winsh, s.belt);
  p.lineTo(s.roofF, s.roofY);
  p.lineTo(s.roofR, s.roofY);
  p.lineTo(s.rearBase, s.deck);
  p.lineTo(-h, s.deck);
  p.lineTo(-h, s.ground);
  arch(p, s.axleR, s.wheelR, s.archR, s.ground);
  arch(p, s.axleF, s.wheelR, s.archR, s.ground);
  p.lineTo(h, s.ground);
  return p;
}

function centerX(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, 0, 0);
}

function carBodyGeo(s) {
  const g = new THREE.ExtrudeGeometry(carProfile(s), { ...EXTRUDE, depth: s.width - 2 * BEVEL });
  g.rotateY(-Math.PI / 2);
  centerX(g);
  return g;
}

function quadGeo(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    ...a, ...b, ...c, ...a, ...c, ...d,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

// One raked screen: a quad on the profile edge, pushed a few millimetres along
// the outward normal so it sits proud of the painted body instead of z-fighting.
function screenQuad(s, za, ya, zb, yb, xIn) {
  const dz = zb - za;
  const dy = yb - ya;
  const L = Math.hypot(dz, dy) || 1;
  const nz = dy / L;
  const ny = -dz / L;
  const off = 0.012;
  return quadGeo(
    [-xIn, ya + ny * off, za + nz * off],
    [xIn, ya + ny * off, za + nz * off],
    [xIn, yb + ny * off, zb + nz * off],
    [-xIn, yb + ny * off, zb + nz * off],
  );
}

// Glass is the dark band along the cabin: a pane per side between the pillars,
// a raked windscreen and a rear screen. Inset from the pillars so paint always
// frames it, and double-sided so both flanks read from the chase camera.
function carGlassGeo(s) {
  const xw = s.width / 2 + 0.006;
  const bottom = s.belt + 0.02;
  const top = s.roofY - 0.03;
  const parts = [];
  for (const side of [1, -1]) {
    const X = side * xw;
    parts.push(quadGeo(
      [X, bottom, s.winsh - 0.10],
      [X, top, s.roofF + 0.10],
      [X, top, s.roofR - 0.10],
      [X, bottom, s.winRear],
    ));
  }
  const xIn = s.width / 2 - 0.09;
  parts.push(screenQuad(s, s.winsh, s.belt, s.roofF, s.roofY, xIn));
  parts.push(screenQuad(s, s.roofR, s.roofY, s.rearBase, s.deck, xIn));
  return mergeGeometries(parts);
}

// Bumpers, rockers and mirrors are flat plates — the one place boxes still earn
// their keep. The old pillar and arch-flare boxes are gone: the profile owns
// the pillars and the arches now.
function carTrimGeo(s) {
  const h = s.len / 2;
  const x = s.width / 2;
  const plate = (w, ht, d, px, py, pz) => {
    const g = new THREE.BoxGeometry(w, ht, d);
    g.translate(px, py, pz);
    return g;
  };
  const rockerLen = Math.max(0.6, Math.abs(s.axleF - s.axleR) - s.archR * 1.7);
  const midZ = (s.axleF + s.axleR) / 2;
  return mergeGeometries([
    plate(s.width * 0.98, 0.22, 0.20, 0, 0.40, h - 0.07),
    plate(s.width * 0.98, 0.22, 0.20, 0, 0.42, -(h - 0.07)),
    plate(0.08, 0.12, rockerLen, -x + 0.02, s.ground + 0.04, midZ),
    plate(0.08, 0.12, rockerLen, x - 0.02, s.ground + 0.04, midZ),
    plate(0.10, 0.09, 0.16, -x - 0.05, s.belt + 0.06, s.winsh - 0.05),
    plate(0.10, 0.09, 0.16, x + 0.05, s.belt + 0.06, s.winsh - 0.05),
  ]);
}

// Tyre and rim in one mesh, told apart by a vertex-colour multiplier rather
// than by a second material. They used to be two meshes whose hub cylinders
// were exactly coincident — identical radius, length and centre — so they
// z-fought, and the rim cost a draw per fleet on top. One mesh, no fight,
// and every car on the map gets its rims back for free.
const TYRE_SHADE = 0.05;
const RIM_SHADE = 0.34;
function carWheelGeo(s) {
  const track = s.width / 2 - 0.06;
  const parts = [];
  const shades = [];
  for (const [x, z] of [[-track, s.axleF], [track, s.axleF], [-track, s.axleR], [track, s.axleR]]) {
    for (const [geo, shade] of [
      [new THREE.CylinderGeometry(s.wheelR, s.wheelR, 0.25, 12), TYRE_SHADE],
      [new THREE.CylinderGeometry(s.wheelR * 0.44, s.wheelR * 0.44, 0.27, 10), RIM_SHADE],
    ]) {
      geo.rotateZ(Math.PI / 2);
      geo.translate(x, s.wheelR, z);
      parts.push(geo);
      shades.push([geo.attributes.position.count, shade]);
    }
  }
  const merged = mergeGeometries(parts);
  const color = new Float32Array(merged.attributes.position.count * 3);
  let at = 0;
  for (const [count, shade] of shades) {
    for (let i = 0; i < count; i++, at++) color[at * 3] = color[at * 3 + 1] = color[at * 3 + 2] = shade;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return merged;
}

// The saloon is what the player's car and the police cruiser build from.
export const bodyGeo = carBodyGeo(CAR_SPECS[0]);
export const trimGeo = carTrimGeo(CAR_SPECS[0]);
export const wheelGeo = carWheelGeo(CAR_SPECS[0]);
export function wheelMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc2c8d0, roughness: 0.55, metalness: 0.6, vertexColors: true,
  });
}

// Five silhouettes in one draw, the way policekit.js folds its four kit parts:
// every vertex carries aShape, every instance carries iShape, and the vertex
// shader folds the other four shapes onto a point. Law 4 keeps the fleet at one
// InstancedMesh per material, whatever the body count.
function tagShape(geo, part) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aShape', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  return geo;
}
const foldShapes = (build) => mergeGeometries(CAR_SPECS.map((s, i) => tagShape(build(s), i)));
const fleetBodyGeo = foldShapes(carBodyGeo);
const fleetGlassGeo = foldShapes(carGlassGeo);
const fleetTrimGeo = foldShapes(carTrimGeo);
const fleetWheelGeo = foldShapes(carWheelGeo);

export function patchCarShape(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = `attribute float aShape;\nattribute float iShape;\n${sh.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (abs(aShape - iShape) > 0.5) transformed = vec3(0.0);`);
    if (!sh.vertexShader.includes('aShape - iShape')) console.error(`[${key}] car shape patch missed`);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
export const beamGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(-0.55, 0.7, 2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(0.55, 0.7, 2.11); return g; })(),
]);
export const tailGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(-0.55, 0.75, -2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(0.55, 0.75, -2.11); return g; })(),
]);
// Saloon glass; the fleet folds all five bands into one geometry below.
const canopyGeo = carGlassGeo(CAR_SPECS[0]);
const glassMat = new THREE.MeshStandardMaterial({
  // envMapIntensity is the whole story here. scene.environment is a PMREM of
  // RoomEnvironment, which is a lit studio and far brighter than 1.0; at 2.2 the
  // cabin mirrored it into a white slab and the chase camera — the view the
  // player holds for the whole game — stared at a blank block. Bisected against
  // envMapIntensity 0: 0.22 keeps a tinted sheen without saturating. Double-sided
  // because each window pane is a single quad: one winding faces out per flank.
  color: 0x0b1119, metalness: 0.55, roughness: 0.12, envMapIntensity: 0.22,
  side: THREE.DoubleSide,
});
// Shared by every car on the map, so trim costs one draw for the whole fleet.
const trimMat = new THREE.MeshStandardMaterial({
  color: 0x15171b, roughness: 0.62, metalness: 0.25, envMapIntensity: 1.1,
});
export function carTrimMesh() {
  return new THREE.Mesh(trimGeo, trimMat);
}
export function carGlassMesh() {
  return new THREE.Mesh(canopyGeo, glassMat);
}
// Headlight throw (VGA-004): two lens pools per car, laid along the heading and
// stretched by speed, so a lit car reads as a car coming at you instead of a
// quad floating on the road. Each lens is a trapezoid — narrow at the bumper,
// spreading downroad — and the pair lives in one merged geometry, so it costs
// exactly what the single oval cost. The traffic set stays one instanced draw.
const POOL_NEAR = 1.6;        // the throw starts just past the bumper
const POOL_FAR = 11;
const POOL_NEAR_HALF = 0.45;  // lens-wide at the car
const POOL_FAR_HALF = 1.5;    // spread downroad; the pair overlaps out there
const POOL_LENS_X = 0.6;      // sits under the beam quads on the nose
const POOL_Y = 0.045;
const THROW_IDLE = 0.5;       // creeping: a short spill at the bumper
const THROW_SPEED = 9;        // m/s that earns the full throw
// Hero and pursuit cars ride the same instanced set: every lit car on the map
// lays its throw in one draw, instead of one pool mesh each.
const POOL_EXTRA = 3;
const POOL_FADE_NEAR = 2.0;   // a throw you are standing inside is a white frame,
const POOL_FADE_FAR = 6.0;    // so it shrinks away as its car reaches the camera

function throwScale(speed) {
  return THROW_IDLE + (1 - THROW_IDLE) * Math.min(1, Math.abs(speed) / THROW_SPEED);
}

function poolFade(x, z, cam) {
  if (!cam) return 1;
  const d = Math.hypot(x - cam.position.x, z - cam.position.z);
  return Math.max(0, Math.min(1, (d - POOL_FADE_NEAR) / (POOL_FADE_FAR - POOL_FADE_NEAR)));
}

// Dark at the lens, hot a few metres out, gone by the far end, soft at both
// flanks — the shape wet asphalt actually takes. A centred radial blob reads as
// a puddle of light parked under the car, which is the floating-quad look this
// item exists to kill.
function throwTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const along = g.createLinearGradient(0, 0, 0, 64);
  along.addColorStop(0, 'rgba(255,255,255,0)');
  along.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  along.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = along;
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'destination-in';
  const across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(0,0,0,0)');
  across.addColorStop(0.5, 'rgba(0,0,0,1)');
  across.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const throwTex = { current: null };
function getThrowTex() {
  if (!throwTex.current) throwTex.current = throwTexture();
  return throwTex.current;
}

// v = 1 at the bumper end, which is where the canvas above starts.
function lensGeo(sx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    sx - POOL_NEAR_HALF, 0, POOL_NEAR, sx + POOL_NEAR_HALF, 0, POOL_NEAR,
    sx - POOL_FAR_HALF, 0, POOL_FAR, sx + POOL_FAR_HALF, 0, POOL_FAR,
  ], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  g.setIndex([0, 2, 1, 2, 3, 1]);
  return g;
}

const poolGeo = mergeGeometries([lensGeo(-POOL_LENS_X), lensGeo(POOL_LENS_X)]);

const TAIL_DIM = new THREE.Color(0x7a140e);
const TAIL_BRAKE = new THREE.Color(0xff2a20);

// Five fleet shapes, all cut from the M2.T3 pipeline body (car.glb, credited
// in public/assets/CREDITS.md): the saloon tub baked at five scales — van
// taller and longer, compact shorter, wagon longer, coupe lower — so the
// street keeps its five silhouettes from one model file. Index matches
// SHAPE_COUNT in sim/street.js. Bodies carry their baked size (placeShape
// sets scale 1); the light quads and road pools still take the per-shape
// stretch, so the table serves them and the model bake alike. Parked and
// moving cars share these pools: N covers street.cars, parked included.
export const FLEET_MODEL = 'assets/models/car/car.glb';
const FLEET_SHAPES = [
  { s: [1.00, 1.00, 1.00] },  // saloon
  { s: [1.05, 1.24, 1.14] },  // van
  { s: [0.93, 0.95, 0.84] },  // compact
  { s: [1.02, 1.05, 1.21] },  // wagon
  { s: [1.07, 0.87, 1.03] },  // coupe
];

const _n = new THREE.Vector3();

// One model part cleaned to what the fleet merges: indexed or not, every
// part must carry the same attributes or mergeGeometries returns null.
function fleetPart(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  }
  return g;
}

// A baked variant: the pipeline part at one fleet scale, normals fixed for
// the non-uniform stretch (divide by the scale, renormalise) so the paint
// keeps the model's own shading instead of going flat or blotchy.
function fleetVariant(base, s) {
  const g = base.clone();
  g.scale(s[0], s[1], s[2]);
  const n = g.attributes.normal;
  if (n) {
    for (let i = 0; i < n.count; i++) {
      _n.set(n.getX(i) / s[0], n.getY(i) / s[1], n.getZ(i) / s[2]).normalize();
      n.setXYZ(i, _n.x, _n.y, _n.z);
    }
    n.needsUpdate = true;
  }
  return g;
}

// The five variants folded into one geometry, the policekit.js way: every
// vertex carries aShape, every instance carries iShape, and the patched
// material folds the other four shapes onto a point. One draw per material
// for the whole fleet, whatever the body count (law 4).
function foldFleetVariants(partGeos) {
  const clean = partGeos.map(fleetPart);
  const base = mergeGeometries(clean);
  if (!base) return null;
  return mergeGeometries(FLEET_SHAPES.map((f, i) => tagShape(fleetVariant(base, f.s), i)));
}

// Fill the fleet's bodies once the GLB lands; the procedural shells below
// stand in until then so the street is never empty. Paint, trim and wheels
// each keep their pool — same meshes, same draws — and the separate glass
// band retires, its glazing baked into the paint atlas. Parked cars ride the
// same swap: they are slots in the same pools, not a second fleet.
function loadFleetModels(rig) {
  new GLTFLoader().loadAsync(FLEET_MODEL).then(async (gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const out = { paintGeos: [], trimGeos: [], wheelGeos: [] };
    gltf.scene.traverse((o) => { if (o.isMesh) heroSort(o, out); });
    if (!out.paintGeos.length || (!out.trimGeos.length && !out.wheelGeos.length)) return;
    const paint = foldFleetVariants(out.paintGeos);
    const trim = out.trimGeos.length ? foldFleetVariants(out.trimGeos) : null;
    const wheels = out.wheelGeos.length ? foldFleetVariants(out.wheelGeos) : null;
    if (!paint || !trim || !wheels) return;
    for (const g of [paint, trim, wheels]) g.setAttribute('iShape', rig.iShape);
    rig.bodies.geometry.dispose();
    rig.bodies.geometry = paint;
    rig.bodies.material = patchCarShape(out.paintMat, 'car-fleet-body');
    rig.bodies.userData.model = FLEET_MODEL;
    rig.trim.geometry.dispose();
    rig.trim.geometry = trim;
    rig.trim.material = patchCarShape(out.trimMat, 'car-fleet-trim');
    rig.trim.userData.model = FLEET_MODEL;
    rig.wheels.geometry.dispose();
    rig.wheels.geometry = wheels;
    rig.wheels.material = patchCarShape(out.wheelMat ?? out.trimMat, 'car-fleet-wheel');
    rig.wheels.userData.model = FLEET_MODEL;
    rig.glass.visible = false;
    rig.credited = (await fetch('assets/CREDITS.md').then((r) => r.text()).catch(() => ''))
      .includes('models/car/car.glb');
    rig.modelReady = true;
  }).catch(() => {});
}

// Every car is placed from the traffic pose — x, z and yaw, the fields
// sim/traffic.js writes (M3.T30, M3.T32). The old axis/dir fallback is gone:
// street.js's static curb plan is resolved to the same pose by curbPose.
function placeOnCar(dummy, car, yOff) {
  const [sx, sy, sz] = FLEET_SHAPES[car.shape ?? 0].s;
  dummy.position.set(car.x, yOff, car.z);
  dummy.rotation.set(0, car.yaw, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return dummy.matrix;
}

// The shaped bodies carry their own dimensions, so they are never scaled. The
// beams and pools keep riding placeOnCar's stretch untouched.
function placeShape(dummy, car, yOff) {
  dummy.position.set(car.x, yOff, car.z);
  dummy.rotation.set(0, car.yaw, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

// street.js's static curb plan speaks lane + axis + dir; the moving fleet
// speaks x/z/yaw. Resolve the plan to the traffic pose so the frame path is one
// shape for every car on screen (M3.T32). Parked cars never move.
function curbPose(car, out) {
  out.x = car.lane;
  out.z = car.z;
  out.yaw = car.axis === 'x'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.dir > 0 ? 0 : Math.PI);
  out.v = 0;
  return out;
}

export function buildTraffic(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  // Sized by the street, not the moving count: parked cars ride free.
  const N = street.cars.length;
  // Car paint is pigment under clearcoat, not bare metal. At metalness 0.6
  // with env 1.9 every up-facing panel became a mirror of the sky, so from a
  // chase camera the roof and boot of each car read as one blown-out white
  // slab with no colour left in them — the single worst object in the frame.
  // Metalness down, env down, roughness up a touch: the paint keeps its
  // colour, and there is still enough gloss for shop and street light to land on it.
  const paintMat = patchCarShape(new THREE.MeshStandardMaterial({
    roughness: 0.32, metalness: 0.14, envMapIntensity: 1.05,
  }), 'car-body');
  const bodies = new THREE.InstancedMesh(fleetBodyGeo, paintMat, N);
  bodies.name = 'fleet-car-body';
  bodies.userData.model = FLEET_MODEL;
  bodies.castShadow = true;
  bodies.customDepthMaterial = patchCarShape(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'car-body-depth'
  );
  // One iShape array drives every folded mesh: a car's body, glass, trim and
  // wheels all read their silhouette from the same instance value.
  const iShape = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  for (const g of [fleetBodyGeo, fleetGlassGeo, fleetTrimGeo, fleetWheelGeo]) g.setAttribute('iShape', iShape);
  const wheels = new THREE.InstancedMesh(fleetWheelGeo, patchCarShape(wheelMaterial(), 'car-wheel'), N);
  wheels.name = 'fleet-wheels';
  wheels.userData.model = FLEET_MODEL;
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), N);
  beams.name = 'fleet-beams';
  beams.userData.model = FLEET_MODEL;
  const tails = new THREE.InstancedMesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }), N);
  tails.name = 'fleet-tails';
  tails.userData.model = FLEET_MODEL;
  const glass = new THREE.InstancedMesh(fleetGlassGeo, patchCarShape(new THREE.MeshStandardMaterial({
    color: 0x0b1119, metalness: 0.55, roughness: 0.12, envMapIntensity: 0.22, side: THREE.DoubleSide,
  }), 'car-glass'), N);
  glass.name = 'fleet-glass';
  glass.userData.model = FLEET_MODEL;
  const trim = new THREE.InstancedMesh(fleetTrimGeo, patchCarShape(new THREE.MeshStandardMaterial({
    color: 0x15171b, roughness: 0.62, metalness: 0.25, envMapIntensity: 1.1,
  }), 'car-trim'), N);
  trim.name = 'fleet-trim';
  trim.userData.model = FLEET_MODEL;
  const poolMat = new THREE.MeshBasicMaterial({
    map: getThrowTex(), color: 0x7ba0c8, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, N + POOL_EXTRA);
  pools.name = 'fleet-pools';
  const glows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: getGlowTex(), color: 0xcfe6ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    N
  );
  glows.name = 'fleet-glows';
  glows.frustumCulled = false;
  group.add(glows);
  street.cars.forEach((c, i) => {
    bodies.setColorAt(i, new THREE.Color(c.paint));
    iShape.setX(i, c.shape ?? 0);
  });
  bodies.instanceColor.needsUpdate = true;
  iShape.needsUpdate = true;
  group.add(bodies, wheels, beams, tails, glass, trim, pools);
  const rig = {
    bodies, wheels, beams, tails, glass, trim, pools, glows, dummy, iShape,
    model: FLEET_MODEL, modelReady: false, credited: false,
    // One blended pose per car, reused every frame (M0-9).
    poses: street.cars.map(() => ({})),
    inspect() {
      const fleet = [rig.bodies, rig.trim, rig.wheels].filter((m) => m?.isMesh);
      return {
        model: rig.model, credits: rig.credited, ready: rig.modelReady,
        files: FLEET_SHAPES.length,
        geoTypes: fleet.map((m) => m.geometry.type),
        meshes: fleet.length,
      };
    },
  };
  if (typeof window !== 'undefined') window.__fleetRig = rig;
  loadFleetModels(rig);
  updateCarPools(rig, [0, 0, 0].map(() => ({ x: 0, z: 0, yaw: 0, speed: 0, on: false })));
  updateTraffic(rig, street);
  return { group, rig };
}

export function updateTraffic(rig, street, camera = null) {
  const { bodies, wheels, beams, tails, glass, trim, pools, glows, dummy, poses } = rig;
  const alpha = drawAlpha();
  street.cars.forEach((c, i) => {
    const p = c.parked ? curbPose(c, poses[i]) : blend(c, alpha, poses[i]);
    bodies.setMatrixAt(i, placeShape(dummy, p, 0));
    glass.setMatrixAt(i, placeShape(dummy, p, 0));
    trim.setMatrixAt(i, placeShape(dummy, p, 0));
    wheels.setMatrixAt(i, placeShape(dummy, p, 0));
    const m = placeOnCar(dummy, p, 0);
    if (c.parked) {
      // Dark and quiet: parked cars wear no headlight glow.
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      beams.setMatrixAt(i, dummy.matrix);
      pools.setMatrixAt(i, dummy.matrix);
      glows.setMatrixAt(i, dummy.matrix);
      tails.setMatrixAt(i, m);
      return;
    }
    beams.setMatrixAt(i, m);
    tails.setMatrixAt(i, m);
    // The pool rides the car's heading, not the world axis: before this,
    // connector traffic threw its light across the street it was crossing.
    placeOnCar(dummy, p, POOL_Y);
    const fade = poolFade(p.x, p.z, camera);
    dummy.scale.set(fade, 1, throwScale(p.v) * fade);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x + Math.sin(p.yaw) * 2.3, 0.7, p.z + Math.cos(p.yaw) * 2.3);
    if (camera) dummy.quaternion.copy(camera.quaternion);
    else dummy.rotation.set(0, 0, 0);
    // The same near-camera fade as the throw: a headlight glare the lens is
    // standing inside reads as a bright rectangle, not as light.
    dummy.scale.set(fade, fade, 1);
    dummy.updateMatrix();
    glows.setMatrixAt(i, dummy.matrix);
  });
  bodies.instanceMatrix.needsUpdate = true;
  wheels.instanceMatrix.needsUpdate = true;
  beams.instanceMatrix.needsUpdate = true;
  tails.instanceMatrix.needsUpdate = true;
  glass.instanceMatrix.needsUpdate = true;
  trim.instanceMatrix.needsUpdate = true;
  pools.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
}


export function updateCarPools(rig, cars, camera = null) {
  const { pools, dummy } = rig;
  const base = pools.count - POOL_EXTRA;
  cars.forEach((c, i) => {
    dummy.position.set(c.x, (c.y ?? 0) + POOL_Y, c.z);
    dummy.rotation.set(0, c.yaw, 0);
    const fade = c.on ? poolFade(c.x, c.z, camera) : 0;
    dummy.scale.set(fade, 1, throwScale(c.speed) * fade);
    dummy.updateMatrix();
    pools.setMatrixAt(base + i, dummy.matrix);
  });
  pools.instanceMatrix.needsUpdate = true;
}

// --- Hero car (player-driven): M2.T3 model body, kept lights, brake, spot.
// The slab is gone (D16): paint, trim and wheels come from car.glb — the body
// carries its own glass, so the old canopy and box trim are deleted with it.
// Beams, tails, glows, beacon and the real headlight spot stay exactly where
// the saloon tuned them; the model is 4.41 m on the same +Z nose.
export const HERO_MODEL = 'assets/models/car/car.glb';

// Sort one loaded mesh into paint, body trim or wheels. Paint wears the baked
// atlas (it has a map); trim and wheels share the dark material, told apart
// by the separate wheel nodes clean_car.py left for a later spin.
function heroSort(mesh, out) {
  const baked = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  if (/wheel/i.test(mesh.name)) {
    out.wheelGeos.push(baked);
    out.wheelMat = out.wheelMat ?? mesh.material;
  } else if (mesh.material?.map) {
    out.paintGeos.push(baked);
    out.paintMat = out.paintMat ?? mesh.material;
  } else {
    out.trimGeos.push(baked);
    out.trimMat = out.trimMat ?? mesh.material;
  }
}

function heroBodyMesh(geos, mat, name, shadow) {
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.name = name;
  mesh.userData.model = HERO_MODEL;
  mesh.castShadow = shadow;
  return mesh;
}

// Fill the rig's body once the GLB lands; the lights exist from frame one so
// the car never loses its beams. Paint alone casts: the shadow reads from the
// shell, and the second shadow pass stays off the budget.
function loadHeroBody(rig) {
  const credit = fetch('assets/CREDITS.md').then((r) => r.text()).catch(() => '');
  new GLTFLoader().loadAsync(HERO_MODEL).then(async (gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const out = { paintGeos: [], trimGeos: [], wheelGeos: [] };
    gltf.scene.traverse((o) => { if (o.isMesh) heroSort(o, out); });
    if (!out.paintGeos.length) return;
    const paint = heroBodyMesh(out.paintGeos, out.paintMat, 'hero-body', true);
    rig.group.add(paint);
    rig.paint = paint;
    if (out.trimGeos.length) {
      const trim = heroBodyMesh(out.trimGeos, out.trimMat, 'hero-trim', false);
      rig.group.add(trim);
      rig.trim = trim;
    }
    if (out.wheelGeos.length) {
      const wheels = heroBodyMesh(out.wheelGeos, out.wheelMat, 'hero-wheels', false);
      rig.group.add(wheels);
      rig.wheels = wheels;
    }
    rig.credited = (await credit).includes('models/car/car.glb');
    rig.modelReady = true;
  }).catch(() => {});
}

export function buildPlayerCar(scene, car) {
  const group = new THREE.Group();
  group.name = 'hero-car';
  const beams = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xe8f4ff }));
  beams.name = 'hero-beams';
  beams.userData.model = HERO_MODEL;
  const tailMat = new THREE.MeshBasicMaterial({ color: TAIL_DIM.clone() });
  const tails = new THREE.Mesh(tailGeo, tailMat);
  tails.name = 'hero-tails';
  tails.userData.model = HERO_MODEL;
  const glows = [];
  for (const sx of [-0.55, 0.55]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xd8ecff, transparent: true, opacity: 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.name = 'hero-glow';
    s.scale.set(1.6, 1.0, 1);
    s.userData.sx = sx;
    group.add(s);
    glows.push(s);
  }
  const spot = new THREE.SpotLight(0xcfe2ff, 140, 42, 0.52, 0.45, 2);
  scene.add(spot, spot.target);
  // Finder beacon: faint pillar so the car is findable on foot. Warm white, not
  // a hue — a coloured column reads as a hologram — at the luminance the old
  // tinted one had, so it stands out no more than it did.
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTex(), color: 0xe8dcc6, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beacon.name = 'hero-beacon';
  beacon.scale.set(1.6, 3.2, 1);
  group.add(beacon);
  group.add(beams, tails);
  // Wheels arrive with the model; a flat-tyre sag needs the handle from frame
  // one, so a bare holder stands in until the mesh lands (police.js drawFlats).
  const rig = {
    group, paint: null, trim: null, wheels: new THREE.Object3D(), beams, tails, tailMat,
    glows, spot, beacon, model: HERO_MODEL, modelReady: false, credited: false,
    inspect() {
      const bodies = [rig.paint, rig.trim, rig.wheels].filter((m) => m?.isMesh);
      return {
        model: rig.model, credits: rig.credited,
        geoTypes: bodies.map((m) => m.geometry.type),
        meshes: bodies.length,
      };
    },
    lights() {
      return {
        beams: !!rig.beams, tails: !!rig.tails,
        glows: rig.glows.length, spot: rig.spot?.isSpotLight === true,
      };
    },
    tailHex() {
      return rig.tailMat.color.getHexString();
    },
  };
  if (typeof window !== 'undefined') window.__heroRig = rig;
  loadHeroBody(rig);
  updatePlayerCar(rig, car, false);
  return rig;
}

export function updatePlayerCar(rig, car, braking) {
  rig.group.position.set(car.x, car.y, car.z);
  rig.group.rotation.y = car.yaw;
  rig.tailMat.color.copy(braking ? TAIL_BRAKE : TAIL_DIM);
  rig.beacon.position.set(0, 3.4, 0);
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  for (const s of rig.glows) {
    s.position.set(
      car.x + s.userData.sx * rx + 2.15 * fx,
      car.y + 0.7,
      car.z + s.userData.sx * rz + 2.15 * fz
    );
  }
  rig.spot.position.set(car.x, car.y + 1.0, car.z);
  // The beam stays level with the car, not with the world: no road in this city
  // leaves the flat, so aiming it at y = 0 only matters off-road, and a beam
  // that dips into a verge it is driving over reads as a fault, not as physics.
  rig.spot.target.position.set(car.x + fx * 18, car.y, car.z + fz * 18);
}
