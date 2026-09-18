// Pursuit cars: hero-grade meshes with police paint and alternating lightbars.
// Hidden (visible=false) until heat calls them — zero draws when clean.
import * as THREE from 'three';
import { bodyGeo, wheelGeo, wheelMaterial, beamGeo, tailGeo, carGlassMesh, trimGeo } from './traffic.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RED_HOT = new THREE.Color(0xff2222);
const RED_DIM = new THREE.Color(0x440000);
const BLUE_HOT = new THREE.Color(0x2266ff);
const BLUE_DIM = new THREE.Color(0x000844);

// A pursuit car is the one thing that can appear on top of an already-full
// frame, so it pays for itself twice over: the light-bar base rides the trim
// geometry, and the white headlight quads and red tail quads share one basic
// material told apart by vertex colour. Nine meshes became seven.
const kitGeo = mergeGeometries([
  trimGeo,
  (() => { const g = new THREE.BoxGeometry(1.2, 0.08, 0.3); g.translate(0, 1.45, -0.2); return g; })(),
]);
const LAMP_WHITE = new THREE.Color(0xd8ecff);
const LAMP_RED = new THREE.Color(0xff2a20);
const lampGeo = (() => {
  const merged = mergeGeometries([beamGeo, tailGeo]);
  const nBeam = beamGeo.attributes.position.count;
  const c = new Float32Array(merged.attributes.position.count * 3);
  for (let i = 0; i < merged.attributes.position.count; i++) {
    const t = i < nBeam ? LAMP_WHITE : LAMP_RED;
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return merged;
})();

export function buildPursuitCar() {
  const group = new THREE.Group();
  const paint = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: 0x0e1826, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.5,
  }));
  paint.castShadow = true;
  const wheels = new THREE.Mesh(wheelGeo, wheelMaterial());
  const lamps = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  const kit = new THREE.Mesh(kitGeo, new THREE.MeshStandardMaterial({
    color: 0x15171b, roughness: 0.62, metalness: 0.25, envMapIntensity: 1.1,
  }));
  const redMat = new THREE.MeshBasicMaterial({ color: RED_HOT.clone() });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), redMat);
  red.position.set(-0.3, 1.55, -0.2);
  const blueMat = new THREE.MeshBasicMaterial({ color: BLUE_DIM.clone() });
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), blueMat);
  blue.position.set(0.3, 1.55, -0.2);
  group.add(paint, wheels, lamps, carGlassMesh(), kit, red, blue);
  group.visible = false;
  return { group, redMat, blueMat };
}

export function updatePursuit(rig, state, elapsed) {
  rig.group.visible = state.active;
  if (!state.active) return;
  rig.group.position.set(state.x, state.y, state.z);
  rig.group.rotation.y = state.yaw;
  const flip = Math.floor(elapsed * 4) % 2 === 0;
  rig.redMat.color.copy(flip ? RED_HOT : RED_DIM);
  rig.blueMat.color.copy(flip ? BLUE_DIM : BLUE_HOT);
}
