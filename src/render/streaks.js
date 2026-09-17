// Wet-road reflection streaks (VGA-001): vertical neon smears under every
// light source. Static sources merge per zone (2 draws, die with blackouts);
// hero + pursuit streaks are one instanced mesh (1 draw) with a strobing
// pursuit tint. Render-only; main drives opacity per frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

let streakTex = null;
function getStreakTex() {
  if (!streakTex) streakTex = streakTexture();
  return streakTex;
}

// sources: [{x, z, color, len, width}]. Returns per-zone meshes.
export function buildStreaks(sources) {
  const geos = [[], []];
  const color = new THREE.Color();
  for (const s of sources) {
    const zone = s.z < 0 ? 0 : 1;
    const p = new THREE.PlaneGeometry(s.width || 1.2, s.len || 8);
    p.rotateX(-Math.PI / 2);
    p.translate(s.x, 0.035, s.z);
    color.set(s.color);
    const n = p.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
    p.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geos[zone].push(p);
  }
  return geos.map((list) => {
    const mat = new THREE.MeshBasicMaterial({
      map: getStreakTex(), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true,
    });
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    mesh.frustumCulled = false;
    return mesh;
  });
}

export const STREAK_CARS = 3;

export function buildCarStreaks() {
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.6, 9),
    new THREE.MeshBasicMaterial({
      map: getStreakTex(), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
    STREAK_CARS
  );
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  dummy.rotation.set(-Math.PI / 2, 0, 0);
  dummy.position.set(0, 0.04, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  for (let i = 0; i < STREAK_CARS; i++) mesh.setMatrixAt(i, dummy.matrix);
  mesh.setColorAt(0, new THREE.Color(0xd8ecff));
  mesh.setColorAt(1, new THREE.Color(0xff2a20));
  mesh.setColorAt(2, new THREE.Color(0x2a60ff));
  mesh.instanceColor.needsUpdate = true;
  return { mesh, dummy };
}

const _strobe = new THREE.Color();
export function updateCarStreaks(rig, heroCar, driving, pursuit, night, time) {
  const { mesh, dummy } = rig;
  dummy.rotation.set(-Math.PI / 2, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.position.set(heroCar.x, 0.04, heroCar.z);
  dummy.updateMatrix();
  mesh.setMatrixAt(0, dummy.matrix);
  mesh.setColorAt(0, _strobe.set(0xd8ecff).multiplyScalar(driving ? 1 : 0.25));
  for (let i = 0; i < 2; i++) {
    const p = pursuit[i];
    if (p && p.active) {
      dummy.position.set(p.x, 0.04, p.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i + 1, dummy.matrix);
      // Alternating lightbar wash.
      const red = (time * 3 + i) % 2 < 1;
      mesh.setColorAt(i + 1, _strobe.set(red ? 0xff2a20 : 0x2a60ff));
    } else {
      dummy.position.set(0, -10, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i + 1, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.material.opacity = 0.15 + 0.4 * night;
}
