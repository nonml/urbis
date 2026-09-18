// Contact shadows: one instanced dark ellipse under every walker, car, and the
// hero. Floating objects read as toys; this grounds them for +1 draw.
import * as THREE from 'three';

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function buildBlobs(street) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: blobTexture(), transparent: true, opacity: 0.65, depthWrite: false,
  });
  // +2: the player and the hero car each hold a slot permanently. They used to
  // own private blob planes as well, which double-darkened the ground under a
  // parked car and cost two draws for a shadow this mesh was already drawing.
  const mesh = new THREE.InstancedMesh(geo, mat, street.npcs.length + street.cars.length + 2);
  mesh.renderOrder = 1;
  return mesh;
}

const _d = new THREE.Object3D();

export function updateBlobs(mesh, street, player, heroCar) {
  let k = 0;
  for (const n of street.npcs) {
    _d.position.set(n.x, 0.16, n.z);
    _d.rotation.set(0, 0, 0);
    _d.scale.set(0.9 * (n.bulk ?? 1), 1, 1.1);
    _d.updateMatrix();
    mesh.setMatrixAt(k++, _d.matrix);
  }
  for (const c of street.cars) {
    const x = c.x ?? c.lane;
    _d.position.set(x, 0.16, c.z);
    _d.rotation.set(0, c.axis === 'x' ? Math.PI / 2 : 0, 0);
    _d.scale.set(2.2, 1, 4.6);
    _d.updateMatrix();
    mesh.setMatrixAt(k++, _d.matrix);
  }
  const driving = player.mode === 'drive';
  // On foot the player casts and the car sits parked with its own shadow; in
  // the car the player's slot collapses to nothing and only the car casts.
  _d.position.set(player.x, 0.16, player.z);
  _d.rotation.set(0, 0, 0);
  _d.scale.set(driving ? 0 : 0.9, 1, driving ? 0 : 1.1);
  _d.updateMatrix();
  mesh.setMatrixAt(k++, _d.matrix);
  _d.position.set(heroCar.x, 0.16, heroCar.z);
  _d.rotation.set(0, heroCar.yaw, 0);
  _d.scale.set(2.2, 1, 4.6);
  _d.updateMatrix();
  mesh.setMatrixAt(k++, _d.matrix);
  mesh.instanceMatrix.needsUpdate = true;
}
