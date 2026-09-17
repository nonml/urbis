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
  // Glasshouse pulled in with a raked windshield band.
  (() => { const g = new THREE.BoxGeometry(1.55, 0.5, 2.0); g.translate(0, 1.15, -0.2); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.5, 0.34, 0.5); g.rotateX(-0.35); g.translate(0, 1.12, 0.95); return g; })(),
  // Bumpers + side mirrors: the details the eye checks first.
  (() => { const g = new THREE.BoxGeometry(1.86, 0.22, 0.3); g.translate(0, 0.42, 2.1); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.86, 0.22, 0.3); g.translate(0, 0.42, -2.1); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.12, 0.1, 0.2); g.translate(-0.95, 1.05, 0.5); return g; })(),
  (() => { const g = new THREE.BoxGeometry(0.12, 0.1, 0.2); g.translate(0.95, 1.05, 0.5); return g; })(),
]);
export const wheelGeo = (() => {
  const parts = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const g = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    g.rotateZ(Math.PI / 2);
    g.translate(x, 0.35, z);
    parts.push(g);
    // Hubs merged into the same mesh: tires stop reading as oil drums.
    const hub = new THREE.CylinderGeometry(0.17, 0.17, 0.27, 10);
    hub.rotateZ(Math.PI / 2);
    hub.translate(x, 0.35, z);
    parts.push(hub);
  }
  return mergeGeometries(parts);
})();
export const beamGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(-0.55, 0.7, 2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(0.55, 0.7, 2.11); return g; })(),
]);
export const tailGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(-0.55, 0.75, -2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(0.55, 0.75, -2.11); return g; })(),
]);
const canopyGeo = (() => {
  const g = new THREE.BoxGeometry(1.5, 0.42, 1.9);
  g.translate(0, 1.12, -0.2);
  return g;
})();
export const hubGeo = (() => {
  const parts = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const g = new THREE.CylinderGeometry(0.17, 0.17, 0.27, 10);
    g.rotateZ(Math.PI / 2);
    g.translate(x, 0.35, z);
    parts.push(g);
  }
  return mergeGeometries(parts);
})();
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x0a121c, metalness: 0.9, roughness: 0.06, envMapIntensity: 2.2,
});
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

function placeOnCar(dummy, car, yOff) {
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
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.24, metalness: 0.6, envMapIntensity: 1.9 }), N);
  bodies.castShadow = true;
  const wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 }), N);
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), N);
  const tails = new THREE.InstancedMesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }), N);
  const glass = new THREE.InstancedMesh(canopyGeo, glassMat, N);
  const hubs = new THREE.InstancedMesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.9, roughness: 0.3 }), N);
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
  group.add(bodies, wheels, beams, tails, glass, hubs, pools);
  const rig = { bodies, wheels, beams, tails, glass, hubs, pools, glows, dummy };
  updateCarPools(rig, [0, 0, 0].map(() => ({ x: 0, z: 0, yaw: 0, speed: 0, on: false })));
  updateTraffic(rig, street);
  return { group, rig };
}

export function updateTraffic(rig, street, camera = null) {
  const { bodies, wheels, beams, tails, glass, hubs, pools, glows, dummy } = rig;
  street.cars.forEach((c, i) => {
    const m = placeOnCar(dummy, c, 0);
    bodies.setMatrixAt(i, m);
    wheels.setMatrixAt(i, m);
    hubs.setMatrixAt(i, m);
    glass.setMatrixAt(i, m);
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
  hubs.instanceMatrix.needsUpdate = true;
  beams.instanceMatrix.needsUpdate = true;
  tails.instanceMatrix.needsUpdate = true;
  glass.instanceMatrix.needsUpdate = true;
  pools.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
}


export function updateCarPools(rig, cars, camera = null) {
  const { pools, dummy } = rig;
  const base = pools.count - POOL_EXTRA;
  cars.forEach((c, i) => {
    dummy.position.set(c.x, POOL_Y, c.z);
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
    color: 0xb96a12, roughness: 0.22, metalness: 0.65, envMapIntensity: 2.0,
  }));
  paint.castShadow = true;
  const wheels = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 }));
  const beams = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xe8f4ff }));
  const tailMat = new THREE.MeshBasicMaterial({ color: TAIL_DIM.clone() });
  const tails = new THREE.Mesh(tailGeo, tailMat);
  const canopy = new THREE.Mesh(canopyGeo, glassMat);
  const hubs = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.9, roughness: 0.3 }));
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
  group.add(paint, wheels, beams, tails, canopy, hubs);
  // Contact shadow under the hero car.
  const carBlobC = document.createElement('canvas');
  carBlobC.width = carBlobC.height = 64;
  const carBlobG = carBlobC.getContext('2d');
  const carBlobGrad = carBlobG.createRadialGradient(32, 32, 0, 32, 32, 32);
  carBlobGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
  carBlobGrad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  carBlobGrad.addColorStop(1, 'rgba(0,0,0,0)');
  carBlobG.fillStyle = carBlobGrad;
  carBlobG.fillRect(0, 0, 64, 64);
  const carBlobTex = new THREE.CanvasTexture(carBlobC);
  carBlobTex.colorSpace = THREE.SRGBColorSpace;
  const carBlobMat = new THREE.MeshBasicMaterial({
    map: carBlobTex, transparent: true, depthWrite: false, fog: false,
  });
  const carBlob = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.0), carBlobMat);
  carBlob.rotation.x = -Math.PI / 2;
  carBlob.position.y = 0.01;
  group.add(carBlob);
  const rig = { group, paint, wheels, beams, tails, tailMat, glows, spot, beacon, carBlob };
  updatePlayerCar(rig, car, false);
  return rig;
}

export function updatePlayerCar(rig, car, braking) {
  rig.group.position.set(car.x, 0, car.z);
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
      0.7,
      car.z + s.userData.sx * rz + 2.15 * fz
    );
  }
  rig.spot.position.set(car.x, 1.0, car.z);
  rig.spot.target.position.set(car.x + fx * 18, 0, car.z + fz * 18);
}
