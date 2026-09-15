// Traffic: instanced bodies, wheels, head/taillights, one moving pool set.
// Cars run headlights-on through blackouts — the contrast sells the hack.
// The hero (player) car reuses the same geometries with its own materials
// plus a real headlight spot so wet asphalt answers the beams.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR_COUNT } from '../sim/street.js';
import { getGlowTex } from './signs.js';

const bodyGeo = mergeGeometries([
  (() => { const g = new THREE.BoxGeometry(1.8, 0.55, 4.2); g.translate(0, 0.65, 0); return g; })(),
  (() => { const g = new THREE.BoxGeometry(1.6, 0.5, 2.1); g.translate(0, 1.15, -0.2); return g; })(),
]);
const wheelGeo = (() => {
  const parts = [];
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const g = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
    g.rotateZ(Math.PI / 2);
    g.translate(x, 0.35, z);
    parts.push(g);
  }
  return mergeGeometries(parts);
})();
const beamGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(-0.55, 0.7, 2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(0.55, 0.7, 2.11); return g; })(),
]);
const tailGeo = mergeGeometries([
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(-0.55, 0.75, -2.11); return g; })(),
  (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(0.55, 0.75, -2.11); return g; })(),
]);
const canopyGeo = (() => {
  const g = new THREE.BoxGeometry(1.5, 0.42, 1.9);
  g.translate(0, 1.12, -0.2);
  return g;
})();
const hubGeo = (() => {
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
const poolGeo = (() => {
  const g = new THREE.PlaneGeometry(5, 8);
  g.rotateX(-Math.PI / 2);
  return g;
})();

const TAIL_DIM = new THREE.Color(0x7a140e);
const TAIL_BRAKE = new THREE.Color(0xff2a20);

function placeOnCar(dummy, car, yOff) {
  dummy.position.set(car.x ?? car.lane, yOff, car.z);
  dummy.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
  if (car.yaw !== undefined) dummy.rotation.set(0, car.yaw, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

export function buildTraffic(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6, envMapIntensity: 1.6 }), CAR_COUNT);
  const wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 }), CAR_COUNT);
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), CAR_COUNT);
  const tails = new THREE.InstancedMesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }), CAR_COUNT);
  const glass = new THREE.InstancedMesh(canopyGeo, glassMat, CAR_COUNT);
  const poolMat = new THREE.MeshBasicMaterial({
    map: getGlowTex(), color: 0x4d6a8a, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, CAR_COUNT);
  const glows = [];
  street.cars.forEach((c, i) => {
    bodies.setColorAt(i, new THREE.Color(c.paint));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xcfe6ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.set(2.4, 1.4, 1);
    group.add(s);
    glows.push(s);
  });
  bodies.instanceColor.needsUpdate = true;
  group.add(bodies, wheels, beams, tails, glass, pools);
  const rig = { bodies, wheels, beams, tails, glass, pools, glows, dummy };
  updateTraffic(rig, street);
  return { group, rig };
}

export function updateTraffic(rig, street) {
  const { bodies, wheels, beams, tails, glass, pools, glows, dummy } = rig;
  street.cars.forEach((c, i) => {
    const m = placeOnCar(dummy, c, 0);
    bodies.setMatrixAt(i, m);
    wheels.setMatrixAt(i, m);
    beams.setMatrixAt(i, m);
    tails.setMatrixAt(i, m);
    glass.setMatrixAt(i, m);
    dummy.position.set(c.lane, 0.05, c.z + c.dir * 3.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
    glows[i].position.set(c.lane, 0.7, c.z + c.dir * 2.3);
  });
  bodies.instanceMatrix.needsUpdate = true;
  wheels.instanceMatrix.needsUpdate = true;
  beams.instanceMatrix.needsUpdate = true;
  tails.instanceMatrix.needsUpdate = true;
  glass.instanceMatrix.needsUpdate = true;
  pools.instanceMatrix.needsUpdate = true;
}

// --- Hero car (player-driven): own materials, brake lights, real headlight spot.
export function buildPlayerCar(scene, car) {
  const group = new THREE.Group();
  const paint = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: 0xb96a12, roughness: 0.28, metalness: 0.65, envMapIntensity: 1.7,
  }));
  const wheels = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 }));
  const beams = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xe8f4ff }));
  const tailMat = new THREE.MeshBasicMaterial({ color: TAIL_DIM.clone() });
  const tails = new THREE.Mesh(tailGeo, tailMat);
  const canopy = new THREE.Mesh(canopyGeo, glassMat);
  const hubs = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.9, roughness: 0.3 }));
  const pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
    map: getGlowTex(), color: 0x6a8ab0, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pool.position.y = 0.05;
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
  group.add(paint, wheels, beams, tails, canopy, hubs, pool);
  const rig = { group, paint, wheels, beams, tails, tailMat, pool, glows, spot };
  updatePlayerCar(rig, car, false);
  return rig;
}

export function updatePlayerCar(rig, car, braking) {
  rig.group.position.set(car.x, 0, car.z);
  rig.group.rotation.y = car.yaw;
  rig.tailMat.color.copy(braking ? TAIL_BRAKE : TAIL_DIM);
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
