// Player avatar: lathe-profile raincoat, long legs, small head, backpack.
// Matches NPC fidelity — same silhouette language, hero-specific details.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  const coatProfile = [[0.30, 0], [0.285, 0.20], [0.245, 0.50], [0.215, 0.70], [0.20, 0.82]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const coatLathe = new THREE.LatheGeometry(coatProfile, 10);
  coatLathe.translate(0, 0.68, 0);
  // A body of revolution is a chess pawn. People are wide across and thin
  // front-to-back, and they have a shoulder line the head sits between — this
  // squash plus the yoke below is what turns the cone into a back to follow.
  coatLathe.scale(1.24, 1, 0.80);
  const coatGeo = mergeGeometries([
    coatLathe,
    (() => { const g = new THREE.BoxGeometry(0.50, 0.13, 0.25); g.translate(0, 1.44, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.115, 0.135, 0.14, 10); g.translate(0, 1.55, -0.01); return g; })(),
  ]);
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x0e2a30, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9 });
  const coat = new THREE.Mesh(coatGeo, coatMat);
  coat.castShadow = true;
  const headGeo = new THREE.SphereGeometry(0.13, 12, 10);
  headGeo.scale(0.92, 1.12, 1.0);
  const head = new THREE.Mesh(
    headGeo,
    new THREE.MeshStandardMaterial({ map: heroFaceTexture(), roughness: 0.6 })
  );
  head.position.y = 1.70;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.04, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x54f0ff })
  );
  visor.position.set(0, 1.71, 0.11);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.85 });
  // Boot merged into the leg, so both feet ride the walk cycle for free. A leg
  // that ends in a flat cylinder cap is the last thing that read as a peg.
  const legGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.075, 0.09, 0.72, 8); g.translate(0, -0.36, 0); return g; })(),
    (() => { const g = new THREE.BoxGeometry(0.135, 0.09, 0.26); g.translate(0, -0.685, 0.04); return g; })(),
  ]);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.11, 0.72, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.11, 0.72, 0);
  const armGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.52, 7);
  armGeo.translate(0, -0.26, 0);
  const armL = new THREE.Mesh(armGeo, coatMat);
  armL.position.set(-0.235, 1.40, 0);
  const armR = new THREE.Mesh(armGeo, coatMat);
  armR.position.set(0.235, 1.40, 0);
  // One dark-kit mesh: pack plus the hair cap. Same material, so the head stops
  // being a bare ball without costing a draw.
  const kitGeo = mergeGeometries([
    (() => { const g = new THREE.BoxGeometry(0.20, 0.24, 0.11); g.translate(0, 1.25, -0.21); return g; })(),
    (() => {
      const g = new THREE.SphereGeometry(0.138, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62);
      g.scale(0.94, 1.12, 1.06);
      g.translate(0, 1.695, -0.012);
      return g;
    })(),
  ]);
  const backpack = new THREE.Mesh(
    kitGeo,
    new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.8, metalness: 0.2 })
  );
  group.add(coat, head, visor, legL, legR, armL, armR, backpack);
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
