// Player avatar: lathe-profile raincoat, long legs, small head, backpack.
// Matches NPC fidelity — same silhouette language, hero-specific details.
import * as THREE from 'three';

function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function heroFaceTexture() {
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
  const coatProfile = [[0.38, 0], [0.34, 0.20], [0.26, 0.50], [0.22, 0.70], [0.20, 0.82]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const coatGeo = new THREE.LatheGeometry(coatProfile, 10);
  coatGeo.translate(0, 0.68, 0);
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x0e2a30, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 });
  const coat = new THREE.Mesh(coatGeo, coatMat);
  coat.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 10),
    new THREE.MeshStandardMaterial({ map: heroFaceTexture(), roughness: 0.6 })
  );
  head.position.y = 1.70;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.04, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x54f0ff })
  );
  visor.position.set(0, 1.71, 0.11);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.85 });
  const legGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.72, 8);
  legGeo.translate(0, -0.36, 0);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.11, 0.72, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.11, 0.72, 0);
  const armGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.52, 7);
  armGeo.translate(0, -0.26, 0);
  const armL = new THREE.Mesh(armGeo, coatMat);
  armL.position.set(-0.26, 1.38, 0);
  const armR = new THREE.Mesh(armGeo, coatMat);
  armR.position.set(0.26, 1.38, 0);
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.10),
    new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.8, metalness: 0.2 })
  );
  backpack.position.set(0, 1.25, -0.20);
  group.add(coat, head, visor, legL, legR, armL, armR, backpack);
  const blobMat = new THREE.MeshBasicMaterial({
    map: blobShadowTexture(), transparent: true, depthWrite: false, fog: false,
  });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  group.add(blob);
  return { group, legL, legR, armL, armR, blob };
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
