// Pedestrians: tapered raincoats + heads + swinging legs, all instanced.
// Matrices from sim; swing amplitude freezes when the walker freezes.
import * as THREE from 'three';
import { NPC_COUNT, isDark, zoneAt } from '../sim/street.js';

export function buildNPCs(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const coatGeo = new THREE.CylinderGeometry(0.24, 0.42, 1.2, 9);
  coatGeo.translate(0, 0.95, 0);
  const coatMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05, envMapIntensity: 0.7 });
  const bodies = new THREE.InstancedMesh(coatGeo, coatMat, NPC_COUNT);
  // No shadow: 36 tiny capsules cost a full extra draw for invisible blobs.
  const headGeo = new THREE.SphereGeometry(0.15, 10, 8);
  headGeo.translate(0, 1.68, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x9a7b62, roughness: 0.6 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, NPC_COUNT);
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8);
  legGeo.translate(0, -0.3, 0);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.85 });
  const legL = new THREE.InstancedMesh(legGeo, legMat, NPC_COUNT);
  const legR = new THREE.InstancedMesh(legGeo, legMat, NPC_COUNT);
  street.npcs.forEach((n, i) => {
    bodies.setColorAt(i, new THREE.Color(n.coat));
  });
  bodies.instanceColor.needsUpdate = true;
  group.add(bodies, heads, legL, legR);
  const rig = { bodies, heads, legL, legR, dummy };
  updateNPCs(rig, street);
  return { group, ...rig };
}

export function updateNPCs(rig, street) {
  const { bodies, heads, legL, legR, dummy } = rig;
  street.npcs.forEach((n, i) => {
    const yaw = n.dir > 0 ? 0 : Math.PI;
    const moving = !isDark(street, zoneAt(n.z));
    const bob = moving ? Math.abs(Math.sin(n.phase)) * 0.05 : 0;
    const swing = moving ? Math.sin(n.phase) * 0.5 : 0;
    const flip = n.dir > 0 ? 1 : -1;
    dummy.position.set(n.x, bob, n.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, n.h, 1);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    dummy.position.set(n.x + 0.13 * flip, 0.62 * n.h + bob, n.z);
    dummy.rotation.set(swing, yaw, 0, 'YXZ');
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    legL.setMatrixAt(i, dummy.matrix);
    dummy.position.set(n.x - 0.13 * flip, 0.62 * n.h + bob, n.z);
    dummy.rotation.set(-swing, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    legR.setMatrixAt(i, dummy.matrix);
  });
  bodies.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  legL.instanceMatrix.needsUpdate = true;
  legR.instanceMatrix.needsUpdate = true;
}
