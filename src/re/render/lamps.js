// Street lighting: instanced poles + heads + cones, glow sprites, pool list.
// Real lights (2 spots) live in atmosphere.js — everything else is faked.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';

const LAMPS = [-45, -27, -9, 9, 27, 45].map((z, i) => ({
  z, side: i % 2 === 0 ? -1 : 1,
}));
const POLE_X = 5.4;
const HEAD_Y = 7;

function lampHeadPositions() {
  return LAMPS.map((l) => new THREE.Vector3(l.side * (POLE_X - 1.8), HEAD_Y, l.z));
}

export function buildLamps() {
  const group = new THREE.Group();
  const pools = [];
  const dummy = new THREE.Object3D();

  const poleGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.09, 0.12, HEAD_Y, 8); g.translate(0, HEAD_Y / 2, 0); return g; })(),
    (() => { const g = new THREE.BoxGeometry(1.9, 0.1, 0.1); g.translate(-0.85, HEAD_Y, 0); return g; })(),
  ]);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.5, metalness: 0.8 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, LAMPS.length);
  const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.3);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, LAMPS.length);
  const coneGeo = new THREE.ConeGeometry(3.4, HEAD_Y, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a, transparent: true, opacity: 0.03,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, LAMPS.length);

  LAMPS.forEach((l, i) => {
    const dir = l.side > 0 ? -1 : 1; // arm reaches toward road
    dummy.position.set(l.side * POLE_X, 0, l.z);
    dummy.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    const hx = l.side * (POLE_X - 1.8);
    dummy.position.set(hx, HEAD_Y, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    dummy.position.set(hx, HEAD_Y / 2, l.z);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xffc98a, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(hx, HEAD_Y, l.z);
    glow.scale.set(3.2, 3.2, 1);
    group.add(glow);
    pools.push({ x: hx, z: l.z, size: 11, color: '#b97c3a' });
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  cones.instanceMatrix.needsUpdate = true;
  group.add(poles, heads, cones);
  return { group, pools, heads: lampHeadPositions() };
}
