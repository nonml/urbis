// Traffic: instanced bodies, wheels, head/taillights, one moving pool set.
// Cars run headlights-on through blackouts — the contrast sells the hack.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAR_COUNT } from '../sim/street.js';
import { getGlowTex } from './signs.js';

function carFacingMatrices(car, dummy, out) {
  dummy.position.set(car.lane, 0, car.z);
  dummy.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

export function buildTraffic(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();

  const bodyGeo = mergeGeometries([
    (() => { const g = new THREE.BoxGeometry(1.8, 0.55, 4.2); g.translate(0, 0.65, 0); return g; })(),
    (() => { const g = new THREE.BoxGeometry(1.6, 0.5, 2.1); g.translate(0, 1.15, -0.2); return g; })(),
  ]);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6, envMapIntensity: 1.6 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, CAR_COUNT);
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
  const wheels = new THREE.InstancedMesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 }), CAR_COUNT);
  const beamGeo = mergeGeometries([
    (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(-0.55, 0.7, 2.11); return g; })(),
    (() => { const g = new THREE.PlaneGeometry(0.35, 0.18); g.translate(0.55, 0.7, 2.11); return g; })(),
  ]);
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }), CAR_COUNT);
  const tailGeo = mergeGeometries([
    (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(-0.55, 0.75, -2.11); return g; })(),
    (() => { const g = new THREE.PlaneGeometry(0.3, 0.12); g.rotateY(Math.PI); g.translate(0.55, 0.75, -2.11); return g; })(),
  ]);
  const tails = new THREE.InstancedMesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }), CAR_COUNT);
  const poolGeo = new THREE.PlaneGeometry(5, 8);
  poolGeo.rotateX(-Math.PI / 2);
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
  group.add(bodies, wheels, beams, tails, pools);
  const rig = { bodies, wheels, beams, tails, pools, glows, dummy, out: new THREE.Matrix4() };
  updateTraffic(rig, street);
  return { group, rig };
}

export function updateTraffic(rig, street) {
  const { bodies, wheels, beams, tails, pools, glows, dummy } = rig;
  street.cars.forEach((c, i) => {
    const m = carFacingMatrices(c, dummy);
    bodies.setMatrixAt(i, m);
    wheels.setMatrixAt(i, m);
    beams.setMatrixAt(i, m);
    tails.setMatrixAt(i, m);
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
  pools.instanceMatrix.needsUpdate = true;
}
