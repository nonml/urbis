// re-001 bootstrap: sim ticks, render reads. HUD shows measured numbers only.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createClock, tickClock } from './sim/clock.js';
import { buildGround, buildTowers } from './render/block.js';
import { buildSigns, buildPools } from './render/signs.js';
import { buildLamps } from './render/lamps.js';
import { buildRain, tickRain } from './render/rain.js';
import { createRenderer, buildAtmosphere, createComposer, fitRenderer } from './render/atmosphere.js';

const DRAW_BUDGET = 150;
const bootStart = performance.now();

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const texLoader = new THREE.TextureLoader();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(2.5, 4.2, 26);

buildAtmosphere(scene, renderer);
scene.add(buildGround(texLoader, maxAniso));
scene.add(buildTowers(texLoader, maxAniso));
const signs = buildSigns();
scene.add(signs.group);
const lamps = buildLamps();
scene.add(lamps.group);
scene.add(buildPools([...signs.pools, ...lamps.pools]));
const rain = buildRain();
scene.add(rain);

const composer = createComposer(renderer, scene, camera);
window.addEventListener('resize', () => fitRenderer(renderer, composer, camera));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.5, 5, -10);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = 1.53;
controls.minDistance = 3;
controls.maxDistance = 70;

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const clock = createClock();
const hud = document.getElementById('hud');
// Minimal probe for scripted verification (screenshots, control checks).
window.__re = {
  cam: () => camera.position.toArray().map((v) => +v.toFixed(2)),
  draws: () => renderer.info.render.calls,
};
let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
let fpsShown = 0;
let hudTimer = 0;
let firstFrame = true;
let bootMs = 0;
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();

function glide(dt) {
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).negate();
  const speed = (keys.has('shift') ? 18 : 8) * dt;
  const move = new THREE.Vector3();
  if (keys.has('w')) move.add(fwd);
  if (keys.has('s')) move.sub(fwd);
  if (keys.has('a')) move.add(right);
  if (keys.has('d')) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
    controls.target.add(move);
  }
}

function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  tickClock(clock, dt);
  tickRain(rain, clock.elapsed);
  glide(dt);
  controls.update();
  renderer.info.reset();
  composer.render();
  if (firstFrame) {
    firstFrame = false;
    bootMs = Math.round(now - bootStart);
    console.log(`[re-001] boot ${bootMs}ms, draws ${renderer.info.render.calls}`);
  }
  fpsAcc += dt;
  fpsN++;
  hudTimer += dt;
  if (hudTimer > 0.25) {
    fpsShown = Math.round(fpsN / fpsAcc);
    fpsAcc = 0;
    fpsN = 0;
    hudTimer = 0;
    const draws = renderer.info.render.calls;
    const tris = (renderer.info.render.triangles / 1e6).toFixed(2);
    const over = draws > DRAW_BUDGET;
    hud.innerHTML =
      `<b>NEON BLOCK 001</b> · night · rain<br>` +
      `draws <b class="${over ? 'warn' : ''}">${draws}</b> / ${DRAW_BUDGET} · ` +
      `${fpsShown} fps · ${tris}M tris<br>` +
      `boot ${bootMs}ms · seed-fixed rain`;
  }
}
render();
