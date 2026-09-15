// Player avatar: long raincoat silhouette + lit visor. Reads at night, cheap up close.
import * as THREE from 'three';

export function buildPlayer() {
  const group = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x0e2a30, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 });
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 1.25, 10), coatMat);
  coat.position.y = 0.95;
  coat.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.4 })
  );
  head.position.y = 1.72;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.06, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x54f0ff })
  );
  visor.position.set(0, 1.73, 0.15);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.85 });
  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.55, 8);
  legGeo.translate(0, -0.275, 0);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.13, 0.55, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.13, 0.55, 0);
  group.add(coat, head, visor, legL, legR);
  return { group, legL, legR };
}

export function updatePlayer(avatar, player) {
  avatar.group.position.set(player.x, 0, player.z);
  avatar.group.rotation.y = player.yaw;
  const swing = Math.sin(player.walkPhase) * Math.min(1, player.speed / 3) * 0.55;
  avatar.legL.rotation.x = swing;
  avatar.legR.rotation.x = -swing;
  avatar.group.position.y = Math.abs(Math.sin(player.walkPhase)) * 0.03 * Math.min(1, player.speed / 3);
}
