// Pedestrians: two instanced draws (raincoat bodies + heads), matrices from sim.
import * as THREE from 'three';
import { NPC_COUNT } from '../sim/street.js';

const BODY_H = 1.5;

export function buildNPCs(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.86, 4, 10);
  bodyGeo.translate(0, 0.95, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, envMapIntensity: 0.6 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, NPC_COUNT);
  const headGeo = new THREE.SphereGeometry(0.155, 10, 8);
  headGeo.translate(0, 1.68, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x9a7b62, roughness: 0.6 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, NPC_COUNT);
  street.npcs.forEach((n, i) => bodies.setColorAt(i, new THREE.Color(n.coat)));
  bodies.instanceColor.needsUpdate = true;
  group.add(bodies, heads);
  updateNPCs({ bodies, heads, dummy }, street);
  return { group, bodies, heads, dummy };
}

export function updateNPCs(rig, street) {
  const { bodies, heads, dummy } = rig;
  street.npcs.forEach((n, i) => {
    const bob = Math.abs(Math.sin(n.phase)) * 0.05;
    dummy.position.set(n.x, bob, n.z);
    dummy.rotation.set(0, n.dir > 0 ? 0 : Math.PI, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
  });
  bodies.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
}
