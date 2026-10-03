// Traffic: instanced bodies, wheels, head/taillights, one moving pool set.
// Cars run headlights-on through blackouts — the contrast sells the hack.
// The hero (player) car reuses the same geometries with its own materials
// plus a real headlight spot so wet asphalt answers the beams.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
  along.addColorStop(0, 'rgba(255,255,255,0.15)');
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

// The shaped bodies carry their own dimensions; only the light quads and the
// road pools still take a per-shape stretch, so this table survives for them.
// Index matches SHAPE_COUNT in sim/street.js.
const CAR_SHAPES = [
  [1.00, 1.00, 1.00],  // saloon
  [1.05, 1.24, 1.14],  // van
  [0.93, 0.95, 0.84],  // compact
  [1.02, 1.05, 1.21],  // wagon
  [1.07, 0.87, 1.03],  // coupe
];

function placeOnCar(dummy, car, yOff, roundWheels = false) {
  const [sx, sy, sz] = CAR_SHAPES[car.shape ?? 0];
  dummy.position.set(car.x ?? car.lane, yOff, car.z);
  if (car.yaw !== undefined) dummy.rotation.set(0, car.yaw, 0);
  else if (car.axis === 'x') dummy.rotation.set(0, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  else dummy.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
  // Wheels widen their track with the body but never squash: an ellipse
  // where a tyre should be is worse than no variety at all.
  dummy.scale.set(sx, roundWheels ? 1 : sy, sz);
  dummy.updateMatrix();
  return dummy.matrix;
}

// The shaped bodies carry their own dimensions, so they are never scaled. The
// beams and pools keep riding placeOnCar's old stretch untouched.
function placeShape(dummy, car, yOff) {
  dummy.position.set(car.x ?? car.lane, yOff, car.z);
  if (car.yaw !== undefined) dummy.rotation.set(0, car.yaw, 0);
  else if (car.axis === 'x') dummy.rotation.set(0, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  else dummy.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  return dummy.matrix;
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
  bodies.castShadow = true;
  bodies.customDepthMaterial = patchCarShape(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'car-body-depth'
  );
  // One iShape array drives every folded mesh: a car's body, glass, trim and
  // wheels all read their silhouette from the same instance value.
  const iShape = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  for (const g of [fleetBodyGeo, fleetGlassGeo, fleetTrimGeo, fleetWheelGeo]) g.setAttribute('iShape', iShape);
  const wheels = new THREE.InstancedMesh(fleetWheelGeo, patchCarShape(wheelMaterial(), 'car-wheel'), N);
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), N);
  const tails = new THREE.InstancedMesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }), N);
  const glass = new THREE.InstancedMesh(fleetGlassGeo, patchCarShape(new THREE.MeshStandardMaterial({
    color: 0x0b1119, metalness: 0.55, roughness: 0.12, envMapIntensity: 0.22, side: THREE.DoubleSide,
  }), 'car-glass'), N);
  const trim = new THREE.InstancedMesh(fleetTrimGeo, patchCarShape(new THREE.MeshStandardMaterial({
    color: 0x15171b, roughness: 0.62, metalness: 0.25, envMapIntensity: 1.1,
  }), 'car-trim'), N);
  const poolMat = new THREE.MeshBasicMaterial({
    map: getThrowTex(), color: 0x7ba0c8, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, N + POOL_EXTRA);
  const glows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: getGlowTex(), color: 0xcfe6ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    N
  );
  glows.frustumCulled = false;
  group.add(glows);
  street.cars.forEach((c, i) => {
    bodies.setColorAt(i, new THREE.Color(c.paint));
    iShape.setX(i, c.shape ?? 0);
  });
  bodies.instanceColor.needsUpdate = true;
  iShape.needsUpdate = true;
  group.add(bodies, wheels, beams, tails, glass, trim, pools);
  const rig = { bodies, wheels, beams, tails, glass, trim, pools, glows, dummy };
  updateCarPools(rig, [0, 0, 0].map(() => ({ x: 0, z: 0, yaw: 0, speed: 0, on: false })));
  updateTraffic(rig, street);
  return { group, rig };
}

export function updateTraffic(rig, street, camera = null) {
  const { bodies, wheels, beams, tails, glass, trim, pools, glows, dummy } = rig;
  street.cars.forEach((c, i) => {
    bodies.setMatrixAt(i, placeShape(dummy, c, 0));
    glass.setMatrixAt(i, placeShape(dummy, c, 0));
    trim.setMatrixAt(i, placeShape(dummy, c, 0));
    wheels.setMatrixAt(i, placeShape(dummy, c, 0));
    const m = placeOnCar(dummy, c, 0);
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
    placeOnCar(dummy, c, POOL_Y);
    const fade = poolFade(c.x ?? c.lane, c.z, camera);
    dummy.scale.set(fade, 1, throwScale(c.speed) * fade);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
    if (c.axis === 'x') {
      dummy.position.set(c.x + c.dir * 2.3, 0.7, c.z);
    } else {
      dummy.position.set(c.x ?? c.lane, 0.7, c.z + c.dir * 2.3);
    }
    if (camera) dummy.quaternion.copy(camera.quaternion);
    else dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
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

// --- Hero car (player-driven): own materials, brake lights, real headlight spot.
export function buildPlayerCar(scene, car) {
  const group = new THREE.Group();
  const paint = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: 0x8f4a0c, roughness: 0.30, metalness: 0.16, envMapIntensity: 1.1,
  }));
  paint.castShadow = true;
  const wheels = new THREE.Mesh(wheelGeo, wheelMaterial());
  const beams = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xe8f4ff }));
  const tailMat = new THREE.MeshBasicMaterial({ color: TAIL_DIM.clone() });
  const tails = new THREE.Mesh(tailGeo, tailMat);
  const canopy = new THREE.Mesh(canopyGeo, glassMat);
  const glows = [];
  for (const sx of [-0.55, 0.55]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xd8ecff, transparent: true, opacity: 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
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
  beacon.scale.set(1.6, 3.2, 1);
  group.add(beacon);
  group.add(paint, wheels, beams, tails, canopy, carTrimMesh());
  const rig = { group, paint, wheels, beams, tails, tailMat, glows, spot, beacon };
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
