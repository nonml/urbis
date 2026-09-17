// Player avatar: short jacket, long legs, small head with hair + face.
// The beige ball was the closest toy in every frame; this kills it for +0 draws.
import * as THREE from 'three';

function heroFaceTexture() {
  // SphereGeometry faces +z at u=0.25: eyes flank it, hair caps v<0.38.
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a7b62';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#14100c';
  g.fillRect(0, 0, 64, 24);
  g.fillStyle = '#1a1210';
  g.beginPath(); g.ellipse(12, 36, 3, 4, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(20, 36, 3, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(12, 46, 8, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildPlayer() {
  const group = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x0e2a30, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 });
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.9, 10), coatMat);
  coat.position.y = 1.10;
  coat.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshStandardMaterial({ map: heroFaceTexture(), roughness: 0.6 })
  );
  head.position.y = 1.70;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.045, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x54f0ff })
  );
  visor.position.set(0, 1.71, 0.11);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.85 });
  const legGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.75, 8);
  legGeo.translate(0, -0.375, 0);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.12, 0.72, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.12, 0.72, 0);
  const armGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.55, 7);
  armGeo.translate(0, -0.275, 0);
  const armL = new THREE.Mesh(armGeo, coatMat);
  armL.position.set(-0.27, 1.42, 0);
  const armR = new THREE.Mesh(armGeo, coatMat);
  armR.position.set(0.27, 1.42, 0);
  group.add(coat, head, visor, legL, legR, armL, armR);
  return { group, legL, legR, armL, armR };
}

export function updatePlayer(avatar, player) {
  avatar.group.position.set(player.x, 0, player.z);
  avatar.group.rotation.y = player.yaw;
  const swing = Math.sin(player.walkPhase) * Math.min(1, player.speed / 3) * 0.55;
  avatar.legL.rotation.x = swing;
  avatar.legR.rotation.x = -swing;
  avatar.armL.rotation.x = -swing * 0.7;
  avatar.armR.rotation.x = swing * 0.7;
  avatar.group.position.y = Math.abs(Math.sin(player.walkPhase)) * 0.03 * Math.min(1, player.speed / 3);
}
