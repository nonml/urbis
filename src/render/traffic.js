// Traffic: instanced bodies, wheels, head/taillights, one moving pool set.
// Cars run headlights-on through blackouts — the contrast sells the hack.
// The hero (player) car reuses the same geometries with its own materials
// plus a real headlight spot so wet asphalt answers the beams.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';

export const bodyGeo = mergeGeometries([
  (() => { const g = new THREE.BoxGeometry(1.8, 0.55, 4.2); g.translate(0, 0.65, 0); return g; })(),
  // Sloped hood + trunk: break the shoebox with wedges, not more boxes.
  (() => { const g = new THREE.BoxGeometry(1.7, 0.28, 1.0); g.rotateX(0.22); g.translate(0, 0.82, 1.75); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.7, 0.28, 0.9); g.rotateX(-0.22); g.translate(0, 0.82, -1.75); return g; })(),
  // Greenhouse as a frame, not a lid. The painted box that used to sit here
  // enclosed the glass canopy on every side, so no car on the map had a single
  // visible window — the whole fleet read as moulded plastic. Body keeps only
  // the belt, the roof and four pillars; the glass fills the openings between.
  (() => { const g = new THREE.BoxGeometry(1.58, 0.10, 2.06); g.translate(0, 0.925, -0.15); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.56, 0.09, 1.62); g.translate(0, 1.335, -0.02); return g; })(),
]);
// Everything a real car wears in black rubber and plastic — bumpers, mirrors,
// pillars, rocker sills, wheel arches. Painting these body colour is what made
// the fleet read as one moulded lump: a car is two materials, not one.
export const trimGeo = mergeGeometries([
  (() => { const g = new THREE.BoxGeometry(0.10, 0.40, 0.12); g.rotateX(-0.35); g.translate(-0.71, 1.12, 0.90); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.10, 0.40, 0.12); g.rotateX(-0.35); g.translate(0.71, 1.12, 0.90); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.10, 0.42, 0.13); g.rotateX(0.42); g.translate(-0.70, 1.13, -0.98); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.10, 0.42, 0.13); g.rotateX(0.42); g.translate(0.70, 1.13, -0.98); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.86, 0.22, 0.3); g.translate(0, 0.42, 2.1); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.86, 0.22, 0.3); g.translate(0, 0.42, -2.1); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.12, 0.1, 0.2); g.translate(-0.95, 1.05, 0.5); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.12, 0.1, 0.2); g.translate(0.95, 1.05, 0.5); return g; })(),
  // Rockers run the wheelbase, arches flare 5cm proud of the door: the dark
  // band is what stops a 1.8m-wide box from reading as a brick on castors.
  (() => { const g = new THREE.BoxGeometry(0.10, 0.20, 2.7); g.translate(-0.87, 0.41, 0); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.10, 0.20, 2.7); g.translate(0.87, 0.41, 0); return g; })(),
  ...[[-0.90, 1.35], [0.90, 1.35], [-0.90, -1.35], [0.90, -1.35]].map(([x, z]) => {
    const g = new THREE.BoxGeometry(0.10, 0.34, 1.05);
    g.translate(x, 0.56, z);
    return g;
  }),
]);
// Tyre and rim in one mesh, told apart by a vertex-colour multiplier rather
// than by a second material. They used to be two meshes whose hub cylinders
// were exactly coincident — identical radius, length and centre — so they
// z-fought, and the rim cost a draw per fleet on top. One mesh, no fight,
// and every car on the map gets its rims back for free.
const TYRE_SHADE = 0.05;
const RIM_SHADE = 0.34;
export const WHEEL_HUBS = [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]];
export const wheelGeo = (() => {
  const parts = [];
  const shades = [];
  for (const [x, z] of WHEEL_HUBS) {
    for (const [geo, shade] of [
      [new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), TYRE_SHADE],
      [new THREE.CylinderGeometry(0.155, 0.155, 0.27, 10), RIM_SHADE],
    ]) {
      geo.rotateZ(Math.PI / 2);
      geo.translate(x, 0.35, z);
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
})();
export function wheelMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xc2c8d0, roughness: 0.55, metalness: 0.6, vertexColors: true,
  });
}
export const beamGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(-0.55, 0.7, 2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(0.55, 0.7, 2.11); return g; })(),
]);
export const tailGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(-0.55, 0.75, -2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(0.55, 0.75, -2.11); return g; })(),
]);
// Cabin + raked windshield in one glass shell, sized to fill the body frame
// above with a hair of overlap at belt and roof so no seam of sky shows through.
const canopyGeo = mergeGeometries([
  (() => { const g = new THREE.BoxGeometry(1.50, 0.46, 1.66); g.translate(0, 1.13, -0.06); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.44, 0.36, 0.44); g.rotateX(-0.35); g.translate(0, 1.11, 0.92); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.44, 0.38, 0.52); g.rotateX(0.42); g.translate(0, 1.11, -0.99); return g; })(),
]);
const glassMat = new THREE.MeshStandardMaterial({
  // envMapIntensity is the whole story here. scene.environment is a PMREM of
  // RoomEnvironment, which is a lit studio and far brighter than 1.0; at 2.2 the
  // cabin mirrored it into a white slab and the chase camera — the view the
  // player holds for the whole game — stared at a blank block. Bisected against
  // envMapIntensity 0: 0.22 keeps a tinted sheen without saturating.
  color: 0x0b1119, metalness: 0.55, roughness: 0.12, envMapIntensity: 0.22,
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

// Five bodies out of one. A second vehicle mesh would cost four draws — a
// paint pass, a glass pass, a trim pass, a wheel pass — and the street does
// not need four more models, it needs to stop being one model repeated.
// Stretching the shared body per instance gives a van, a compact, a long
// wagon and a low coupe for nothing, because the greenhouse and the glass
// ride the same numbers and the roofline changes with them.
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
  // colour, and there is still enough gloss for the neon to land on it.
  const paintMat = new THREE.MeshStandardMaterial({
    roughness: 0.32, metalness: 0.14, envMapIntensity: 1.05,
  });
  const bodies = new THREE.InstancedMesh(bodyGeo, paintMat, N);
  bodies.castShadow = true;
  const wheels = new THREE.InstancedMesh(wheelGeo, wheelMaterial(), N);
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), N);
  const tails = new THREE.InstancedMesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }), N);
  const glass = new THREE.InstancedMesh(canopyGeo, glassMat, N);
  const trim = new THREE.InstancedMesh(trimGeo, trimMat, N);
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
  });
  bodies.instanceColor.needsUpdate = true;
  group.add(bodies, wheels, beams, tails, glass, trim, pools);
  const rig = { bodies, wheels, beams, tails, glass, trim, pools, glows, dummy };
  updateCarPools(rig, [0, 0, 0].map(() => ({ x: 0, z: 0, yaw: 0, speed: 0, on: false })));
  updateTraffic(rig, street);
  return { group, rig };
}

export function updateTraffic(rig, street, camera = null) {
  const { bodies, wheels, beams, tails, glass, trim, pools, glows, dummy } = rig;
  street.cars.forEach((c, i) => {
    const m = placeOnCar(dummy, c, 0);
    bodies.setMatrixAt(i, m);
    glass.setMatrixAt(i, m);
    trim.setMatrixAt(i, m);
    wheels.setMatrixAt(i, placeOnCar(dummy, c, 0, true));
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
  // Finder beacon: faint cyan pillar so the car is findable on foot.
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTex(), color: 0x54f0ff, transparent: true, opacity: 0.3,
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
