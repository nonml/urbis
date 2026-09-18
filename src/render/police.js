// Pursuit cars: hero-grade meshes with police paint and alternating lightbars.
// Hidden (visible=false) until heat calls them — zero draws when clean.
import * as THREE from 'three';
import { bodyGeo, wheelGeo, beamGeo, tailGeo, carTrimMesh, carGlassMesh } from './traffic.js';

const RED_HOT = new THREE.Color(0xff2222);
const RED_DIM = new THREE.Color(0x440000);
const BLUE_HOT = new THREE.Color(0x2266ff);
const BLUE_DIM = new THREE.Color(0x000844);

export function buildPursuitCar() {
  const group = new THREE.Group();
  const paint = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({
    color: 0x0e1826, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.5,
  }));
  paint.castShadow = true;
  const wheels = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 }));
  const beams = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xd8ecff }));
  const tails = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }));
  const barBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.08, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x05070a })
  );
  barBase.position.set(0, 1.45, -0.2);
  const redMat = new THREE.MeshBasicMaterial({ color: RED_HOT.clone() });
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), redMat);
  red.position.set(-0.3, 1.55, -0.2);
  const blueMat = new THREE.MeshBasicMaterial({ color: BLUE_DIM.clone() });
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), blueMat);
  blue.position.set(0.3, 1.55, -0.2);
  group.add(paint, wheels, beams, tails, carGlassMesh(), carTrimMesh(), barBase, red, blue);
  group.visible = false;
  return { group, redMat, blueMat };
}

export function updatePursuit(rig, state, elapsed) {
  rig.group.visible = state.active;
  if (!state.active) return;
  rig.group.position.set(state.x, 0, state.z);
  rig.group.rotation.y = state.yaw;
  const flip = Math.floor(elapsed * 4) % 2 === 0;
  rig.redMat.color.copy(flip ? RED_HOT : RED_DIM);
  rig.blueMat.color.copy(flip ? BLUE_DIM : BLUE_HOT);
}
