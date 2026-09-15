// Night atmosphere: fog, image-based wet reflections, few real lights,
// renderer + composer. No light without a visible job (charter law #6).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getGlowTex } from './signs.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // Accumulate the whole frame (scene + bloom quads) for the honest HUD counter.
  renderer.info.autoReset = false;
  return renderer;
}

export function buildAtmosphere(scene, renderer) {
  const spots = [];
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.FogExp2(0x070b16, 0.016);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0x24314d, 0x05070a, 0.3));
  const moon = new THREE.DirectionalLight(0x8fb0ff, 0.25);
  moon.position.set(30, 50, -20);
  scene.add(moon);
  for (const z of [-9, 9]) {
    const spot = new THREE.SpotLight(0xffc98a, 90, 45, 0.65, 0.55, 2);
    spot.position.set(0, 7, z);
    spot.target.position.set(0, 0, z);
    scene.add(spot, spot.target);
    spots.push(spot);
  }
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTex(), color: 0x5f7fb8, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  moonGlow.position.set(45, 60, -90);
  moonGlow.scale.set(40, 40, 1);
  scene.add(moonGlow);
  return { spots };
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.55, 0.85
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return composer;
}

export function fitRenderer(renderer, composer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
